from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from provider.core.schemas import CamelCaseBaseModel

DataType = Literal[
    "string", "integer", "boolean", "date", "enum", "email", "phone", "url"
]


class ProfileFieldCreate(CamelCaseBaseModel):
    key: str = Field(
        max_length=64,
        pattern=r"^[a-z][a-z0-9_]*$",
        description="Stable identifier, e.g. `student_id`. Referenced by claim mapping.",
    )
    label: str = Field(max_length=128, description="What the form renders.")
    description: str | None = Field(default=None)
    data_type: DataType = "string"
    options: list[str] = Field(
        default_factory=list, description="Allowed values when `dataType` is `enum`."
    )
    required: bool = False
    unique: bool = Field(
        default=False,
        description=(
            "Enforced by a database constraint, so two people cannot end up "
            "sharing a student number under load."
        ),
    )
    validators: dict = Field(
        default_factory=dict,
        description="Any of `pattern`, `min`, `max`, `minLength`, `maxLength`.",
    )
    user_readable: bool = True
    user_writable: bool = Field(
        default=False,
        description=(
            "The self-service surface. `PATCH /entity/profile` accepts exactly "
            "the fields marked here — nothing else is editable by its owner."
        ),
    )
    group_id: UUID | None = Field(
        default=None,
        description="Bound to a group, the field applies only to its members.",
    )
    claim_name: str | None = Field(
        default=None,
        max_length=64,
        description="Release this field as a token claim under `claimScope`.",
    )
    claim_scope: str | None = Field(
        default=None, description="The scope a client must hold to receive the claim."
    )
    display_order: int = 0

    @model_validator(mode="after")
    def claims_come_in_pairs(self):
        if bool(self.claim_name) != bool(self.claim_scope):
            raise ValueError(
                "claimName and claimScope go together: a claim with no scope "
                "would be released to everyone."
            )
        return self


class ProfileFieldUpdate(CamelCaseBaseModel):
    label: str | None = Field(default=None, max_length=128)
    description: str | None = None
    options: list[str] | None = None
    required: bool | None = None
    validators: dict | None = None
    user_readable: bool | None = None
    user_writable: bool | None = None
    claim_name: str | None = None
    claim_scope: str | None = None
    display_order: int | None = None


class ProfileFieldResponse(CamelCaseBaseModel):
    id: UUID
    key: str
    label: str
    description: str | None
    data_type: str
    options: list[str]
    required: bool
    unique: bool
    validators: dict
    user_readable: bool
    user_writable: bool
    group_id: UUID | None
    group_name: str | None
    claim_name: str | None
    claim_scope: str | None
    display_order: int
    is_system: bool
    created_at: datetime


class FieldPresetResponse(CamelCaseBaseModel):
    """A ready-made field definition, not a stored one.

    Every value here can be edited before it is created; the response is shaped
    to be posted straight back to `POST /admin/profile-fields` once the
    administrator is happy with it.
    """

    key: str
    label: str
    description: str
    data_type: DataType
    options: list[str]
    required: bool
    unique: bool
    validators: dict
    user_readable: bool
    user_writable: bool
    rationale: str = Field(
        description="Why this field is shaped the way it is — written for the administrator choosing it."
    )
    category: str = Field(description="How the catalogue groups this preset.")


class FieldPresetList(CamelCaseBaseModel):
    presets: list[FieldPresetResponse]
