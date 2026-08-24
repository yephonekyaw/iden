from datetime import datetime
from uuid import UUID

from pydantic import Field

from provider.core.schemas import CamelCaseBaseModel

# `attendance:records:read` — a namespace and at least one segment. Namespacing
# by API is convention rather than rule, but it is how collisions are avoided
# now that values are globally unique.
SCOPE_PATTERN = r"^[a-z][a-z0-9_-]*(:[a-z0-9_-]+)+$"


class ScopeCreate(CamelCaseBaseModel):
    value: str = Field(
        pattern=SCOPE_PATTERN,
        max_length=128,
        description="The permission string, e.g. `attendance:records:read`.",
    )
    description: str = Field(
        min_length=1,
        description=(
            "Required. This is the sentence a user reads on the consent screen, "
            "so write it for them: 'View your attendance records.'"
        ),
    )


class ScopeUpdate(CamelCaseBaseModel):
    """Value is absent on purpose — see the endpoint description."""

    description: str | None = Field(default=None, min_length=1)


class ScopeResponse(CamelCaseBaseModel):
    id: UUID
    api_id: UUID
    api_name: str
    audience: str = Field(description="The `aud` a token carrying this scope will have.")
    value: str
    description: str
    is_system: bool
    created_at: datetime
