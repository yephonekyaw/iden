from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="IDEN_")

    database_url: str = ""
    local_storage_dir: str = "local_store"

    insightface_model: str = "buffalo_l"
    detector_size: int = 640
    embedding_dim: int = 512
    match_threshold: float = 0.50

    max_images_per_request: int = 8
    max_image_bytes: int = 10 * 1024 * 1024
    max_image_side: int = 1280
    min_det_score: float = 0.6
    min_face_pixels: int = 60

    allowed_origins: list[str] = ["*"]
    log_level: str = "INFO"


settings = Settings()
