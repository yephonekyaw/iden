from pydantic import Field

from provider.core.schemas import CamelCaseBaseModel


class LivenessResponse(CamelCaseBaseModel):
    face_found: bool = Field(description="Whether a face was detected in the image.")
    liveness_passed: bool = Field(
        description="Whether the face passed the liveness check."
    )
    confidence: float = Field(
        description="Liveness score in [0, 1]. 0 when no face was found."
    )
