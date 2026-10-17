from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import logging
from urllib.parse import urlparse

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import get_settings
from app.database.session import dispose_database, get_engine
from app.models import Base
from app.routes.api import api_router

logger = logging.getLogger("uvicorn.error")

TENANT_TABLES = (
    "departments",
    "users",
    "courses",
    "classes",
    "enrollments",
    "course_materials",
    "attendance_records",
    "audit_logs",
    "portal_dashboards",
    "class_meetings",
    "notices",
    "test_assessments",
    "student_marks",
    "academic_calendar_entries",
    "faculty_attendance",
)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    try:
        engine = get_engine()
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
            await connection.execute(
                text(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
                    "auth_version INTEGER NOT NULL DEFAULT 0"
                )
            )
            for table_name in TENANT_TABLES:
                await connection.execute(
                    text(f"ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY")
                )
                await connection.execute(
                    text(f"ALTER TABLE {table_name} FORCE ROW LEVEL SECURITY")
                )
                policy_exists = await connection.scalar(
                    text(
                        "SELECT EXISTS (SELECT 1 FROM pg_policies "
                        "WHERE schemaname = current_schema() AND tablename = :table_name "
                        "AND policyname = 'uniflow_tenant_policy')"
                    ),
                    {"table_name": table_name},
                )
                if not policy_exists:
                    await connection.execute(
                        text(
                            f"CREATE POLICY uniflow_tenant_policy ON {table_name} "
                            "USING (college_id = NULLIF("
                            "current_setting('app.current_tenant_id', true), '')::uuid) "
                            "WITH CHECK (college_id = NULLIF("
                            "current_setting('app.current_tenant_id', true), '')::uuid)"
                        )
                    )
    except Exception as exc:
        logger.warning("Database startup initialization deferred: %s", exc)
    yield
    await dispose_database()


app = FastAPI(title="UniFlow API", version="1.0.0", lifespan=lifespan)
allowed_origins = [
    origin.strip()
    for origin in get_settings().frontend_origins.split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https://.*\.vercel\.app$|^https://.*\.onrender\.com$|^http://localhost(:\d+)?$|^http://127\.0\.0\.1(:\d+)?$",
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)


def _is_origin_permitted(origin: str | None) -> bool:
    if not origin:
        return True
    if origin in allowed_origins or "*" in allowed_origins:
        return True
    try:
        hostname = urlparse(origin).hostname or ""
        if (
            hostname.endswith(".vercel.app")
            or hostname.endswith(".onrender.com")
            or hostname in {"localhost", "127.0.0.1"}
        ):
            return True
    except Exception:
        pass
    return False


@app.middleware("http")
async def protect_api_requests(request: Request, call_next):
    is_api_request = request.url.path.startswith("/api/v1/")
    is_mutating_request = request.method not in {"GET", "HEAD", "OPTIONS"}
    if is_api_request and is_mutating_request:
        origin = request.headers.get("origin")
        if not _is_origin_permitted(origin):
            return JSONResponse(
                {"detail": "A valid request origin is required."},
                status_code=403,
                headers={"Cache-Control": "no-store"},
            )

    response = await call_next(request)
    if is_api_request:
        response.headers["Cache-Control"] = "no-store, private, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


@app.get("/health")
async def health():
    try:
        engine = get_engine()
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "degraded",
                "database": "disconnected",
                "detail": f"Database check failed: {type(exc).__name__}",
            },
        )
