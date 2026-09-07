from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class TokenResponse(BaseModel):
    """RFC 6749 Section 5.1. Snake_case and no aliasing — the wire format is fixed by
    the spec, not by this project's conventions."""

    access_token: str
    token_type: Literal["Bearer"] = "Bearer"
    expires_in: int = Field(description="Access token lifetime in seconds.")
    scope: str = Field(
        description="Space-delimited scopes actually granted, after pruning."
    )
    refresh_token: str | None = Field(
        default=None,
        description="Absent for client_credentials — the client just asks again.",
    )
    id_token: str | None = Field(
        default=None, description="Present when `openid` was granted."
    )


class UserInfoResponse(BaseModel):
    """Claims released by granted scope — OIDC Core Section 5.3.

    Extra keys are allowed through: an organization defines its own fields at
    runtime, so the claim set is not knowable when this class is written.
    """

    model_config = ConfigDict(extra="allow")

    sub: str
    name: str | None = None
    preferred_username: str | None = None
    email: str | None = None
    email_verified: bool | None = None


class IntrospectionResponse(BaseModel):
    """RFC 7662 Section 2.2. `active` is the only guaranteed field."""

    active: bool
    scope: str | None = None
    client_id: str | None = None
    sub: str | None = None
    aud: list[str] | str | None = None
    exp: int | None = None
    iat: int | None = None
    jti: str | None = None
    token_type: str | None = None


class OAuthErrorResponse(BaseModel):
    """RFC 6749 Section 5.2."""

    error: str
    error_description: str
