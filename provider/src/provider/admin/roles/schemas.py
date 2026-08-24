from datetime import datetime
from uuid import UUID

from pydantic import Field

from provider.core.schemas import CamelCaseBaseModel


class RoleCreate(CamelCaseBaseModel):
    name: str = Field(
        max_length=128,
        description="A job function, as the organization says it — e.g. `attendance-officer`.",
    )
    description: str | None = None
    scope_ids: list[UUID] = Field(
        default_factory=list, description="Scopes to bundle, from any API."
    )


class RoleUpdate(CamelCaseBaseModel):
    name: str | None = Field(default=None, max_length=128)
    description: str | None = None


class RoleScopeAssignment(CamelCaseBaseModel):
    scope_ids: list[UUID] = Field(
        description="The complete new set. Scopes not listed are removed from the role."
    )


class ScopeSummary(CamelCaseBaseModel):
    id: UUID
    value: str
    description: str
    audience: str


class RoleResponse(CamelCaseBaseModel):
    id: UUID
    name: str
    description: str | None
    is_system: bool
    scopes: list[ScopeSummary]
    created_at: datetime
