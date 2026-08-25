from datetime import datetime
from uuid import UUID

from pydantic import Field

from provider.core.schemas import CamelCaseBaseModel


class AuditEventResponse(CamelCaseBaseModel):
    id: UUID
    occurred_at: datetime
    action: str = Field(
        description="Method and route template, e.g. `POST /admin/users/{user_id}/roles`."
    )
    status_code: int = Field(
        description="What the request returned. Refused attempts are recorded too."
    )
    target: str | None = Field(
        description="Identifier of the object acted on, taken from the path."
    )
    actor_user_id: UUID | None = Field(
        description="Null for an unauthenticated request, and for a user deleted since."
    )
    actor_label: str | None = Field(
        description="The actor's email as it was at the time; outlives the account."
    )
    actor_client: str | None = Field(
        description="The OAuth `client_id` the request arrived through."
    )
    ip: str | None = Field(description="Socket peer address.")
    user_agent: str | None
    detail: dict = Field(
        description="Redacted request body and path parameters. Never contains secrets."
    )
