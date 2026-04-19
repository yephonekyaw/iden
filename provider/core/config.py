from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


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


settings = Settings()
