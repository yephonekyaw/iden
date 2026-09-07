from typing import Any
from uuid import UUID

from pydantic import Field

from provider.core.schemas import CamelCaseBaseModel


class ProfileResponse(CamelCaseBaseModel):
    """The built-in identity fields, plus whatever this organization defined."""

    id: UUID
    email: str
    username: str
    display_name: str | None
    picture_url: str | None = Field(
        description=(
            "Where the profile photo is served from, or null when none is set. "
            "The name in the URL changes whenever the photo does, so the value "
            "is safe to cache forever."
        )
    )
    email_verified: bool
    fields: dict[str, Any] = Field(
        description="Organization-defined values, keyed by field key."
    )


class ProfileUpdate(CamelCaseBaseModel):
    display_name: str | None = Field(default=None, max_length=255)
    fields: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "Organization-defined values to set, keyed by field key. Only fields "
            "an administrator marked writable are accepted; anything else is "
            "refused rather than ignored."
        ),
    )


class FieldSchema(CamelCaseBaseModel):
    """One field, as the form should render it."""

    key: str
    label: str
    description: str | None
    data_type: str
    options: list[str]
    required: bool
    writable: bool = Field(
        description="False means the value is shown but belongs to the organization."
    )
    validators: dict


class ProfileSchemaResponse(CamelCaseBaseModel):
    fields: list[FieldSchema]
