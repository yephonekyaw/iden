from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Application
    kiosk_env: Literal["dev", "prod"] = "dev"
    kiosk_log_level: str = "info"
    kiosk_api_prefix: str = ""
    kiosk_allowed_origins: list[str] = []

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False
    )


settings = Settings()
