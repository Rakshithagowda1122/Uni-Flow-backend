from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import get_settings
from app.database.session import dispose_database, get_engine
from app.models import Base
from app.routes.api import api_router

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
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Content-Type"],
)
app.include_router(api_router)


@app.middleware("http")
async def protect_api_requests(request: Request, call_next):
    is_api_request = request.url.path.startswith("/api/v1/")
    is_mutating_request = request.method not in {"GET", "HEAD", "OPTIONS"}
    if is_api_request and is_mutating_request:
        origin = request.headers.get("origin")
        if origin not in allowed_origins:
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
async def health() -> dict[str, str]:
    async with get_engine().connect() as connection:
        await connection.execute(text("SELECT 1"))
    return {"status": "ok"}
