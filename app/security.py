import base64
import hashlib
import hmac
import json
import secrets
import time
from uuid import UUID

from fastapi import HTTPException, Request, status
from sqlalchemy import select, text

from app.config import get_settings
from app.dependencies.auth import AuthenticatedPrincipal, UserRole
from app.database.session import get_session_factory
from app.models import College, User

SESSION_COOKIE_NAME = "uniflow_session"


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    iterations = 310_000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return "pbkdf2_sha256${}${}${}".format(
        iterations,
        base64.urlsafe_b64encode(salt).decode(),
        base64.urlsafe_b64encode(digest).decode(),
    )


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, raw_iterations, raw_salt, raw_digest = password_hash.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(raw_iterations)
        if iterations < 100_000 or iterations > 2_000_000:
            return False
        salt = base64.urlsafe_b64decode(raw_salt)
        expected = base64.urlsafe_b64decode(raw_digest)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def _encode_segment(value: dict[str, object]) -> str:
    raw = json.dumps(value, separators=(",", ":"), sort_keys=True).encode()
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def create_access_token(principal: AuthenticatedPrincipal) -> tuple[str, int]:
    settings = get_settings()
    expires_at = int(time.time()) + settings.token_expiry_minutes * 60
    payload = {
        "sub": str(principal.user_id),
        "college_id": str(principal.college_id),
        "role": principal.role.value,
        "auth_version": principal.auth_version,
        "exp": expires_at,
    }
    signing_input = f"{_encode_segment({'alg': 'HS256', 'typ': 'JWT'})}.{_encode_segment(payload)}"
    signature = hmac.new(
        settings.token_secret.encode(), signing_input.encode(), hashlib.sha256
    ).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).rstrip(b"=").decode()
    return f"{signing_input}.{encoded_signature}", expires_at


def decode_access_token(token: str) -> AuthenticatedPrincipal:
    settings = get_settings()
    try:
        header, payload, encoded_signature = token.split(".")
        signing_input = f"{header}.{payload}"
        expected_signature = hmac.new(
            settings.token_secret.encode(), signing_input.encode(), hashlib.sha256
        ).digest()
        supplied_signature = base64.urlsafe_b64decode(
            encoded_signature + "=" * (-len(encoded_signature) % 4)
        )
        if not hmac.compare_digest(expected_signature, supplied_signature):
            raise ValueError("Invalid token signature")
        decoded_payload = json.loads(
            base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4))
        )
        if int(decoded_payload["exp"]) <= int(time.time()):
            raise ValueError("Expired token")
        return AuthenticatedPrincipal(
            user_id=UUID(decoded_payload["sub"]),
            college_id=UUID(decoded_payload["college_id"]),
            role=UserRole(decoded_payload["role"]),
            auth_version=int(decoded_payload["auth_version"]),
        )
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A valid access token is required.",
            headers={"WWW-Authenticate": "Session"},
        ) from error


async def principal_from_request(request: Request) -> AuthenticatedPrincipal:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
        if auth_header and auth_header.lower().startswith("bearer "):
            token = auth_header[7:].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    principal = decode_access_token(token)
    session_factory = get_session_factory()
    async with session_factory() as session:
        async with session.begin():
            await session.execute(
                text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
                {"tenant_id": str(principal.college_id)},
            )
            user = await session.scalar(
                select(User)
                .join(College, College.id == User.college_id)
                .where(
                    User.id == principal.user_id,
                    User.college_id == principal.college_id,
                    User.role == principal.role.value,
                    User.status == "active",
                    User.auth_version == principal.auth_version,
                    College.status == "active",
                )
            )
            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="The session is no longer valid.",
                    headers={"WWW-Authenticate": "Session"},
                )
    return principal
