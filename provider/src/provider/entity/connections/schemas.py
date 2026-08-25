from datetime import datetime

from pydantic import Field

from provider.core.schemas import CamelCaseBaseModel


class ConnectionSummary(CamelCaseBaseModel):
    client_id: str
    name: str
    scopes: list[str] = Field(description="What you agreed this application may do.")
    granted_at: datetime


class ConnectionListResponse(CamelCaseBaseModel):
    connections: list[ConnectionSummary]
