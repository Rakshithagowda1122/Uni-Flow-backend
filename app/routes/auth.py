import time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, text, update
from sqlalchemy.sql import func

from app.config import get_settings
from app.database.session import get_session_factory
from app.dependencies.auth import (
    AuthenticatedPrincipal,
    UserRole,
    get_current_principal,
)
from app.models import College, User
from app.security import (
    SESSION_COOKIE_NAME,
    create_access_token,
    principal_from_request,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=255)
    password: str = Field(min_length=1, max_length=256)
    role: UserRole
    college_slug: str = Field(min_length=1, max_length=63)

    model_config = ConfigDict(extra="forbid")


class LoginResponse(BaseModel):
    user: dict[str, str]


CurrentPrincipal = Annotated[AuthenticatedPrincipal, Depends(get_current_principal)]


def _cookie_secure() -> bool:
    return get_settings().environment.lower() not in {"development", "test"}


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, response: Response) -> LoginResponse:
    try:
        session_factory = get_session_factory()
        async with session_factory() as session:
            async with session.begin():
                college = await session.scalar(
                    select(College).where(
                        College.slug == payload.college_slug,
                        College.status == "active",
                    )
                )
                if college is None:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid email, password, role, or campus.",
                    )

                await session.execute(
                    text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
                    {"tenant_id": str(college.id)},
                )
                user = await session.scalar(
                    select(User).where(
                        User.college_id == college.id,
                        User.email == payload.email.lower(),
                        User.role == payload.role.value,
                        User.status == "active",
                    )
                )
                if user is None or not verify_password(payload.password, user.password_hash):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid email, password, role, or campus.",
                    )

                await session.execute(
                    update(User)
                    .where(User.id == user.id, User.college_id == college.id)
                    .values(last_login_at=func.clock_timestamp())
                )
                principal = AuthenticatedPrincipal(
                    user_id=user.id,
                    college_id=college.id,
                    role=UserRole(user.role),
                    auth_version=user.auth_version,
                )
                access_token, expires_at = create_access_token(principal)
                response.set_cookie(
                    key=SESSION_COOKIE_NAME,
                    value=access_token,
                    max_age=max(0, expires_at - int(time.time())),
                    httponly=True,
                    secure=_cookie_secure(),
                    samesite="lax",
                    path="/",
                )
                return LoginResponse(
                    user={
                        "id": str(user.id),
                        "name": user.full_name,
                        "email": user.email,
                        "role": user.role.lower(),
                        "college_name": college.name,
                        "college_slug": college.slug,
                    },
                )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service connection error. Please verify your Supabase database status.",
        ) from exc


@router.get("/session")
async def get_session(principal: CurrentPrincipal) -> dict[str, object]:
    return {
        "authenticated": True,
        "user": {
            "id": str(principal.user_id),
            "role": principal.role.value.lower(),
        },
    }


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
) -> dict[str, str]:
    try:
        principal = await principal_from_request(request)
    except HTTPException as error:
        if error.status_code != status.HTTP_401_UNAUTHORIZED:
            raise
    else:
        session_factory = get_session_factory()
        async with session_factory() as session:
            async with session.begin():
                await session.execute(
                    text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
                    {"tenant_id": str(principal.college_id)},
                )
                await session.execute(
                    update(User)
                    .where(
                        User.id == principal.user_id,
                        User.college_id == principal.college_id,
                        User.auth_version == principal.auth_version,
                    )
                    .values(auth_version=User.auth_version + 1)
                )

    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        secure=_cookie_secure(),
        httponly=True,
        samesite="lax",
    )
    return {"message": "Signed out."}
