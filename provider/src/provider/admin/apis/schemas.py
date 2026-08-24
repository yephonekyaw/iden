from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator

from provider.core.schemas import CamelCaseBaseModel

NAME_PATTERN = r"^[a-z][a-z0-9-]*$"


class ApiCreate(CamelCaseBaseModel):
    name: str = Field(
        pattern=NAME_PATTERN,
        max_length=128,
        description="Short identifier, lowercase and hyphenated — e.g. `attendance`.",
    )
    audience: str = Field(
        max_length=512,
        description=(
            "Absolute URI identifying this API. Every access token minted for its "
            "scopes carries this as `aud`, and the API must reject tokens carrying "
            "anything else."
        ),
    )
    description: str | None = Field(default=None, description="What this API is for.")

    @field_validator("audience")
    @classmethod
    def audience_must_be_absolute(cls, value: str) -> str:
        if not value.startswith(("http://", "https://")):
            raise ValueError("audience must be an absolute URI")
        return value.rstrip("/")


class ApiUpdate(CamelCaseBaseModel):
    """Audience is deliberately absent — see the endpoint description."""

    name: str | None = Field(default=None, pattern=NAME_PATTERN, max_length=128)
    description: str | None = None


class ApiResponse(CamelCaseBaseModel):
    id: UUID
    name: str
    audience: str
    description: str | None
    is_system: bool = Field(
        description="System APIs are defined by IDEN itself and cannot be changed."
    )
    scope_count: int = Field(description="How many scopes are defined under this API.")
    created_at: datetime
