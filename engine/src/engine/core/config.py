from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Application
    engine_env: Literal["dev", "prod"] = "dev"
    engine_log_level: str = "info"

    # Face detection + recognition (InsightFace). `buffalo_l` is downloaded
    # from the InsightFace model zoo on first `prepare()` and cached under
    # `engine_model_root/models/<pack>` afterward.
    engine_model_pack: str = "buffalo_l"
    engine_model_root: Path = Path("models")
    engine_det_size: int = 640
    engine_min_detection_score: float = 0.5

    # Frame quality gate (`models/quality.py`), used when a request sends
    # several candidate frames for one pose and the engine must pick one.
    # Laplacian-variance sharpness has no universal unit — tune against real
    # kiosk frames. Brightness is a 0-255 grayscale mean.
    engine_min_sharpness: float = 100.0
    engine_min_brightness: float = 40.0
    engine_max_brightness: float = 215.0
    # onnxruntime tries providers in order and falls back. Set to
    # ["CUDAExecutionProvider", "CPUExecutionProvider"] on a machine with a
    # GPU and `onnxruntime-gpu` installed instead of `onnxruntime`.
    engine_providers: list[str] = ["CPUExecutionProvider"]

    # Liveness / anti-spoofing. Off by default: there is no bundled model, and
    # a missing one should not block exercising the enroll/verify/search
    # pipeline. See engine/models/liveness.py.
    engine_liveness_enabled: bool = False
    engine_liveness_model_path: Path | None = None
    engine_liveness_threshold: float = 0.5

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False
    )


settings = Settings()
