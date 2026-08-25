from datetime import datetime

from pydantic import Field

from provider.core.schemas import CamelCaseBaseModel


class SessionSummary(CamelCaseBaseModel):
    id: str = Field(
        description=(
            "The session's public name — a hash, never the cookie. Use it to "
            "sign that session out."
        )
    )
    current: bool = Field(description="Whether this is the session you are using.")
    authenticated_at: datetime
    amr: list[str] = Field(description="How this session was authenticated.")
    clients: list[str] = Field(description="Applications signed into during it.")


class SessionListResponse(CamelCaseBaseModel):
    sessions: list[SessionSummary]
