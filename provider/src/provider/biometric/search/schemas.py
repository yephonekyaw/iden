from uuid import UUID

from pydantic import Field

from provider.core.schemas import CamelCaseBaseModel


class SearchResponse(CamelCaseBaseModel):
    face_found: bool = Field(description="Whether a face was detected in the image.")
    matched: bool = Field(description="Whether the face matched an enrolled identity.")
    user_id: UUID | None = Field(
        default=None, description="The matched user's id. Null when there is no match."
    )
    liveness_passed: bool = Field(
        description="Whether the face passed the liveness check."
    )
    confidence: float | None = Field(
        default=None,
        description=(
            "Similarity to the matched embedding, in [0, 1]. Null when no "
            "face was found or nothing matched."
        ),
    )
