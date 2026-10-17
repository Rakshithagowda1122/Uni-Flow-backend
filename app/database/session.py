from collections.abc import AsyncIterator
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import get_settings
from app.dependencies.auth import (
    AuthenticatedPrincipal,
    get_current_principal,
)


import re


def normalize_database_url(url: str) -> str:
    raw = url.strip()

    # Automatically map IPv6-only Supabase direct host to IPv4 session pooler (required for Render)
    match = re.search(r"@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?", raw)
    if match:
        ref = match.group(1)
        pooler_region = "ap-northeast-1"
        pooler_host = f"aws-0-{pooler_region}.pooler.supabase.com:6543"
        raw = re.sub(r"@db\.[a-z0-9]+\.supabase\.co(?::\d+)?", f"@{pooler_host}", raw)
        raw = re.sub(r"(://)postgres(?!\.[a-z0-9]+)(:)", rf"\1postgres.{ref}\2", raw)

    if raw.startswith("postgres://"):
        raw = "postgresql+asyncpg://" + raw[len("postgres://"):]
    elif raw.startswith("postgresql://"):
        raw = "postgresql+asyncpg://" + raw[len("postgresql://"):]
    elif not raw.startswith("postgresql+asyncpg://"):
        raw = "postgresql+asyncpg://" + raw

    if "sslmode=" in raw:
        raw = (
            raw.replace("sslmode=require", "ssl=require")
            .replace("sslmode=verify-full", "ssl=require")
            .replace("sslmode=prefer", "ssl=require")
        )
    elif ("supabase.co" in raw or "supabase.com" in raw) and "ssl=" not in raw:
        separator = "&" if "?" in raw else "?"
        raw = f"{raw}{separator}ssl=require"

    return raw


@lru_cache
def get_engine() -> AsyncEngine:
    settings = get_settings()
    if not settings.database_url:
        raise ValueError("DATABASE_URL environment variable is not configured.")
    normalized_url = normalize_database_url(settings.database_url)
    return create_async_engine(normalized_url, pool_pre_ping=True)


@lru_cache
def get_session_factory() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), expire_on_commit=False)


async def dispose_database() -> None:
    if get_engine.cache_info().currsize:
        await get_engine().dispose()
    get_session_factory.cache_clear()
    get_engine.cache_clear()


async def get_tenant_session(
    principal: Annotated[
        AuthenticatedPrincipal, Depends(get_current_principal)
    ],
) -> AsyncIterator[AsyncSession]:
    session_factory = get_session_factory()
    async with session_factory() as session:
        async with session.begin():
            await session.execute(
                text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
                {"tenant_id": str(principal.college_id)},
            )
            yield session
