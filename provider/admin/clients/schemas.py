"""Pydantic schemas for the /admin/clients endpoints."""

from datetime import datetime
from typing import Annotated
from urllib.parse import urlparse
from uuid import UUID

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    model_validator,
)

from shared.oidc import (
    ClientKind,
    ClientStatus,
    GrantType,
    ResponseType,
    TokenEndpointAuthMethod,
)


def _validate_http_url(uri: str) -> str:
    parsed = urlparse(uri)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("URL must use http or https")
    if not parsed.netloc:
        raise ValueError("URL must be absolute")
    if parsed.fragment:
        raise ValueError("URL must not contain a fragment")
    return uri


HttpUrlStr = Annotated[str, AfterValidator(_validate_http_url)]
RedirectURI = HttpUrlStr


class ClientBase(BaseModel):
    client_kind: ClientKind = Field(description="Client application type.")
    is_public: bool = Field(
        description="Public clients (SPA, native, kiosk with PKCE) do not receive a secret."
    )
    client_name: str = Field(
        min_length=1,
        description="Human-readable name shown on consent screens and admin UI.",
    )
    description: str | None = Field(
        default=None, description="Internal admin-only notes."
    )
    logo_uri: HttpUrlStr | None = Field(
        default=None, description="URL to the client's logo (shown on consent)."
    )
    client_uri: HttpUrlStr | None = Field(
        default=None, description="Home page for the client."
    )
    tos_uri: HttpUrlStr | None = Field(
        default=None, description="Terms of service URL."
    )
    policy_uri: HttpUrlStr | None = Field(
        default=None, description="Privacy policy URL."
    )
    contacts: list[EmailStr] = Field(
        default_factory=list,
        description="Admin/support email addresses for this client.",
    )
    redirect_uris: list[RedirectURI] = Field(
        default_factory=list,
        description="Allowed redirect URIs for the authorization_code flow.",
    )
    grant_types: list[GrantType] = Field(default_factory=list)
    response_types: list[ResponseType] = Field(default_factory=list)
    allowed_scopes: list[str] = Field(
        default_factory=list,
        description="Scopes this client may request (e.g. 'openid', 'profile').",
    )
    audience: list[str] = Field(
        default_factory=list,
        description="Resource identifiers that may appear in the token 'aud' claim.",
    )
    post_logout_redirect_uris: list[HttpUrlStr] = Field(
        default_factory=list,
        description="Allowed post-logout redirect URIs (RP-initiated logout).",
    )
    backchannel_logout_uri: HttpUrlStr | None = Field(
        default=None,
        description="OIDC back-channel logout endpoint.",
    )
    require_pkce: bool = Field(
        default=False,
        description=(
            "Require PKCE on authorization_code flows. Forced to true for public "
            "clients using authorization_code."
        ),
    )
    access_token_ttl_seconds: int | None = Field(
        default=None,
        gt=0,
        description="Per-client access token lifetime. Null = global default.",
    )
    refresh_token_ttl_seconds: int | None = Field(
        default=None,
        gt=0,
        description="Per-client refresh token lifetime. Null = global default.",
    )
    id_token_ttl_seconds: int | None = Field(
        default=None,
        gt=0,
        description="Per-client id_token lifetime. Null = global default.",
    )
    refresh_token_rotation: bool = Field(
        default=True,
        description="Rotate the refresh token on each use (recommended for SPAs).",
    )
    consent_required: bool = Field(
        default=True,
        description="Show the consent screen. Disable only for trusted first-party clients.",
    )


class ClientCreate(ClientBase):
    org_id: UUID = Field(description="Organization that owns this client.")
    token_endpoint_auth_method: TokenEndpointAuthMethod | None = Field(
        default=None,
        description=(
            "How the client authenticates at /token. Defaults to 'client_secret_basic' "
            "for confidential clients and 'none' for public clients."
        ),
    )

    @model_validator(mode="after")
    def _apply_cross_field_rules(self) -> "ClientCreate":
        if "authorization_code" in self.grant_types and not self.redirect_uris:
            raise ValueError(
                "redirect_uris is required when authorization_code is in grant_types"
            )

        if self.is_public:
            if self.token_endpoint_auth_method is None:
                self.token_endpoint_auth_method = "none"
            elif self.token_endpoint_auth_method != "none":
                raise ValueError(
                    "token_endpoint_auth_method must be 'none' for public clients"
                )
            if "authorization_code" in self.grant_types:
                self.require_pkce = True
        else:
            if self.token_endpoint_auth_method is None:
                self.token_endpoint_auth_method = "client_secret_basic"
            elif self.token_endpoint_auth_method == "none":
                raise ValueError(
                    "token_endpoint_auth_method must be 'client_secret_basic' or "
                    "'client_secret_post' for confidential clients"
                )

        return self


class ClientUpdate(BaseModel):
    """Partial update. Immutable: id, org_id, is_public, client_kind,
    token_endpoint_auth_method (tied to is_public)."""

    client_name: str | None = Field(default=None, min_length=1)
    description: str | None = None
    logo_uri: HttpUrlStr | None = None
    client_uri: HttpUrlStr | None = None
    tos_uri: HttpUrlStr | None = None
    policy_uri: HttpUrlStr | None = None
    contacts: list[EmailStr] | None = None
    redirect_uris: list[RedirectURI] | None = None
    grant_types: list[GrantType] | None = None
    response_types: list[ResponseType] | None = None
    allowed_scopes: list[str] | None = None
    audience: list[str] | None = None
    post_logout_redirect_uris: list[HttpUrlStr] | None = None
    backchannel_logout_uri: HttpUrlStr | None = None
    status: ClientStatus | None = None
    require_pkce: bool | None = None
    access_token_ttl_seconds: int | None = Field(default=None, gt=0)
    refresh_token_ttl_seconds: int | None = Field(default=None, gt=0)
    id_token_ttl_seconds: int | None = Field(default=None, gt=0)
    refresh_token_rotation: bool | None = None
    consent_required: bool | None = None


class ClientResponse(ClientBase):
    model_config = ConfigDict(from_attributes=True)

    id: str = Field(description="Server-generated client_id.")
    org_id: UUID
    status: ClientStatus
    token_endpoint_auth_method: TokenEndpointAuthMethod
    created_at: datetime
    updated_at: datetime


class ClientCreateResponse(ClientResponse):
    client_secret: str | None = Field(
        default=None,
        description="Cleartext client secret. Returned only on creation; store it securely.",
    )


class ClientSecretResponse(BaseModel):
    id: str
    client_secret: str = Field(
        description="New cleartext client secret. Returned only once."
    )


class ClientList(BaseModel):
    items: list[ClientResponse]
    total: int
    limit: int
    offset: int
