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
    last_seen_at: datetime = Field(
        description=(
            "When this session last made a request. Equal to `authenticatedAt` "
            "for a session that predates this being recorded, and accurate to "
            "within a minute."
        )
    )
    amr: list[str] = Field(description="How this session was authenticated.")
    clients: list[str] = Field(description="Applications signed into during it.")
    ip: str | None = Field(
        default=None,
        description=(
            "The address this session signed in from. Behind a reverse proxy "
            "this is the proxy's address — the socket peer is what IDEN can "
            "observe, and a forwarding header is a claim the caller makes."
        ),
    )
    device: str | None = Field(
        default=None,
        description='Best effort, from the User-Agent — e.g. `"Mac"`, `"iPhone"`.',
    )
    browser: str | None = Field(
        default=None,
        description='Best effort, from the User-Agent — e.g. `"Chrome 142"`.',
    )


class SessionListResponse(CamelCaseBaseModel):
    sessions: list[SessionSummary]
