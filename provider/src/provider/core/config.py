from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Application
    iden_env: Literal["dev", "prod"] = "dev"
    iden_log_level: str = "info"
    # Each router declares its own prefix (/oauth2, /admin, /entity, /api/v1/auth).
    # This is only for deployments that mount the whole app under a sub-path, and
    # must stay empty otherwise: OIDC requires /.well-known/* at the host root.
    iden_api_prefix: str = ""
    iden_allowed_admin_origins: list[str] = []

    # Issuer
    iden_issuer: str = "http://localhost:8000"
    iden_auth_ui_base_url: str = "http://localhost:4000"

    # Storage
    iden_database_url: str = "postgresql+asyncpg://iden:iden@localhost:5432/iden"
    iden_redis_url: str = "redis://localhost:6379/0"

    # Crypto
    iden_signing_key_dir: Path = Path("keys")
    iden_signing_algorithm: str = "RS256"

    # Lifetimes (seconds)
    iden_access_token_ttl: int = 600
    iden_id_token_ttl: int = 600
    iden_refresh_token_ttl: int = 2_592_000
    iden_auth_code_ttl: int = 60
    iden_session_ttl: int = 86_400
    iden_challenge_ttl: int = 600
    # How long a spent refresh token keeps returning the tokens it was already
    # exchanged for. Two browser tabs refreshing at once, or one request that
    # timed out and was retried, are indistinguishable from theft without it.
    # Long enough to cover a stalled request; short enough that a stolen token
    # is unlikely to be spent inside it.
    iden_refresh_grace_period: int = 30

    # Rate limiting. Off only for load tests against a deployment you own —
    # with it off, `/api/v1/auth/login` is both a brute-force target and a way
    # to exhaust the machine's CPU, since argon2 is expensive for the server.
    iden_rate_limit_enabled: bool = True

    # Bootstrap
    iden_bootstrap_admin_email: str = "admin@localhost"
    iden_bootstrap_admin_password: str = ""

    # Biometric extension
    iden_biometric_enabled: bool = False
    iden_engine_base_url: str = "http://engine:8000"

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False
    )

    @property
    def admin_audience(self) -> str:
        return f"{self.iden_issuer}/admin"

    @property
    def entity_audience(self) -> str:
        return f"{self.iden_issuer}/entity"

    @property
    def biometric_audience(self) -> str:
        return f"{self.iden_issuer}/biometric"


settings = Settings()
