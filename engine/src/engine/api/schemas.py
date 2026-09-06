from typing import Literal

from pydantic import BaseModel, Field

# Accepted for observability only — every mode runs the same detect + embed +
# liveness pipeline. The caller (the provider's Biometric RS) decides what to
# do with the result: store it, compare it, or search with it.
ProcessMode = Literal["enroll", "verify", "search", "liveness"]


class ProcessResponse(BaseModel):
    face_found: bool = Field(description="Whether a face was detected in the image.")
    liveness_passed: bool = Field(
        description="Whether the detected face passed the liveness check."
    )
    liveness_confidence: float = Field(description="Liveness score in [0, 1].")
    embedding: list[float] | None = Field(
        default=None,
        description="512-d ArcFace embedding. Null when no face was found.",
    )
    detection_score: float | None = Field(
        default=None,
        description="Face detector's confidence. Null when no face was found.",
    )
    quality_score: float | None = Field(
        default=None,
        description=(
            "Sharpness score of the frame that was used (the best of however "
            "many were sent). Null when no frame had a detectable face."
        ),
    )
