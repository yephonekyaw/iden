from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="IDEN_")

    database_url: str = ""
    local_storage_dir: str = "local_store"
    insightface_model: str = "buffalo_l"
    detector_size: int = 640
    embedding_dim: int = 512
    match_threshold: float = 0.50


settings = Settings()
