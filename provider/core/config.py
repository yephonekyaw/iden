from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, populated from env vars and an optional .env file.

    Env vars use the ``IDEN_`` prefix (e.g. ``IDEN_ENV``, ``IDEN_LOG_LEVEL``).
    """

    model_config = SettingsConfigDict(
        env_prefix="IDEN_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    env: Literal["development", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"

    # SQLAlchemy URL. The ``+asyncpg`` scheme is required — it tells
    # SQLAlchemy to use the asyncpg driver for the async engine.
    database_url: str = "your-database-url"

    # Origins allowed to call ``/admin/*`` (the admin console). Comma-separated
    # in env: ``IDEN_ADMIN_ALLOWED_ORIGINS=http://localhost:3000,https://admin.example.com``.
    admin_allowed_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)

    @field_validator("admin_allowed_origins", mode="before")
    @classmethod
    def _split_csv(cls, v: object) -> object:
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        return v


settings = Settings()
