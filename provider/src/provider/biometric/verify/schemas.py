from pydantic import Field

from provider.core.schemas import CamelCaseBaseModel


class VerifyResponse(CamelCaseBaseModel):
    face_found: bool = Field(description="Whether a face was detected in the image.")
    match: bool = Field(description="Whether the face matches the claimed identity.")
    liveness_passed: bool = Field(
        description="Whether the face passed the liveness check."
    )
    confidence: float | None = Field(
        default=None,
        description=(
            "Similarity to the claimed identity's embedding, in [0, 1]. Null "
            "when no face was found or that user has no enrollment."
        ),
    )
