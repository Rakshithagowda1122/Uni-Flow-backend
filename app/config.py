from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = Field(
        default="postgresql://postgres.lmhnrjtawwuomsazecso:rakshu28082006@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres",
        validation_alias=AliasChoices(
            "DATABASE_URL",
            "database_url",
            "DATABASE_URI",
            "DB_URL",
            "POSTGRES_URL",
            "SUPABASE_DATABASE_URL",
            "SUPABASE_URL",
            "POSTGRESQL_URL",
        ),
    )
    token_secret: str = Field(
        default="uniflow_super_secret_jwt_key_2026_xyz_production_ready",
        min_length=32,
    )
    environment: str = "development"
    token_expiry_minutes: int = Field(default=60, gt=0, le=1440)
    frontend_origins: str = "https://uni-flow-frontend-nine.vercel.app,https://uni-flow-backend.onrender.com"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
