from pydantic import BaseModel, Field


class OpenIDConfiguration(BaseModel):
    """OpenID Provider Metadata — OIDC Discovery 1.0 §3.

    Plain snake_case field names: this document's keys are fixed by the spec,
    so it is the one place the project does not camelCase its JSON.
    """

    issuer: str
    authorization_endpoint: str
    token_endpoint: str
    userinfo_endpoint: str
    jwks_uri: str
    revocation_endpoint: str
    introspection_endpoint: str
    end_session_endpoint: str
    scopes_supported: list[str] = Field(
        description="Read live from the database — admins define scopes at runtime."
    )
    response_types_supported: list[str]
    grant_types_supported: list[str]
    subject_types_supported: list[str]
    id_token_signing_alg_values_supported: list[str]
    token_endpoint_auth_methods_supported: list[str]
    code_challenge_methods_supported: list[str] = Field(
        description="`S256` only — `plain` offers no protection and is rejected."
    )
    acr_values_supported: list[str]
    amr_values_supported: list[str]
    prompt_values_supported: list[str] = Field(
        description="`none` is how a browser application checks silently for a session."
    )
    backchannel_logout_supported: bool
    backchannel_logout_session_supported: bool = Field(
        description="Logout tokens carry `sid`, so a client can end one session of several."
    )
    claims_supported: list[str]

    # Declared rather than omitted. Each of these defaults to `true` when absent
    # (OIDC Discovery 1.0 §3), so silence here advertised support for request
    # objects, request URIs, and the `claims` parameter — none of which IDEN
    # implements. A conforming client would have believed it.
    response_modes_supported: list[str] = Field(
        description="Only the query response mode; IDEN issues codes, never fragments."
    )
    request_parameter_supported: bool = Field(
        description="False — IDEN does not accept request objects by value (JAR)."
    )
    request_uri_parameter_supported: bool = Field(
        description="False — IDEN does not accept request objects by reference."
    )
    claims_parameter_supported: bool = Field(
        description="False — claims are released by scope, not per-request."
    )
    authorization_response_iss_parameter_supported: bool = Field(
        description="True — every authorization response carries `iss` (RFC 9207)."
    )
    revocation_endpoint_auth_methods_supported: list[str]
    introspection_endpoint_auth_methods_supported: list[str] = Field(
        description="Confidential clients only — `none` is deliberately absent (RFC 7662 §2.1)."
    )


class JsonWebKeySet(BaseModel):
    keys: list[dict]
