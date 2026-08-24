from datetime import datetime
from uuid import UUID

from pydantic import Field

from provider.core.schemas import CamelCaseBaseModel


class GroupCreate(CamelCaseBaseModel):
    name: str = Field(
        max_length=128,
        description="A department, team, or cohort — e.g. `Students`, `Registrar`.",
    )
    description: str | None = None


class GroupUpdate(CamelCaseBaseModel):
    name: str | None = Field(default=None, max_length=128)
    description: str | None = None


class GroupRoleAssignment(CamelCaseBaseModel):
    role_ids: list[UUID] = Field(
        description="The complete new set. Roles not listed are removed from the group."
    )


class MemberAssignment(CamelCaseBaseModel):
    user_ids: list[UUID] = Field(description="Users to add. Already-members are ignored.")


class RoleSummary(CamelCaseBaseModel):
    id: UUID
    name: str
    description: str | None


class MemberSummary(CamelCaseBaseModel):
    id: UUID
    email: str
    username: str
    display_name: str | None
    is_active: bool


class GroupResponse(CamelCaseBaseModel):
    id: UUID
    name: str
    description: str | None
    roles: list[RoleSummary]
    member_count: int
    created_at: datetime
