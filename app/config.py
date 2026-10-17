from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = Field(
        default="",
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
    frontend_origins: str = "http://localhost:3000,http://127.0.0.1:3000,https://uni-flow-frontend-nine.vercel.app"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
