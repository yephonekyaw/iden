from fastapi import APIRouter
from sqlalchemy import select

from provider.authz.discovery.schemas import JsonWebKeySet, OpenIDConfiguration
from provider.authz.services import auth_methods
from provider.authz.services.scope_resolver import OIDC_SCOPES
from provider.core.config import settings
from provider.core.crypto import jwks
from provider.core.db import DBSessionDep
from provider.shared.enums import AcrLevel, CodeChallengeMethod, GrantType
from provider.shared.models import Scope

router = APIRouter(tags=["discovery"])


@router.get(
    "/.well-known/openid-configuration",
    response_model=OpenIDConfiguration,
    summary="OpenID provider metadata",
    description=(
        "Everything a client needs to talk to IDEN, per OIDC Discovery 1.0.\n\n"
        "`scopes_supported` is queried from the database on every request rather "
        "than hard-coded, because administrators define scopes at runtime.\n\n"
        "**Required scope:** none — this endpoint is public."
    ),
)
async def openid_configuration(session: DBSessionDep) -> OpenIDConfiguration:
    values = await session.scalars(select(Scope.value).order_by(Scope.value))
    issuer = settings.iden_issuer

    return OpenIDConfiguration(
        issuer=issuer,
        authorization_endpoint=f"{issuer}/oauth2/authorize",
        token_endpoint=f"{issuer}/oauth2/token",
        userinfo_endpoint=f"{issuer}/oauth2/userinfo",
        jwks_uri=f"{issuer}/.well-known/jwks.json",
        revocation_endpoint=f"{issuer}/oauth2/revoke",
        introspection_endpoint=f"{issuer}/oauth2/introspect",
        end_session_endpoint=f"{issuer}/oauth2/logout",
        scopes_supported=sorted(OIDC_SCOPES) + list(values),
        response_types_supported=["code"],
        grant_types_supported=[g.value for g in GrantType],
        subject_types_supported=["public"],
        id_token_signing_alg_values_supported=[settings.iden_signing_algorithm],
        token_endpoint_auth_methods_supported=[
            "client_secret_basic",
            "client_secret_post",
            "none",
        ],
        code_challenge_methods_supported=[CodeChallengeMethod.S256.value],
        acr_values_supported=[level.value for level in AcrLevel],
        amr_values_supported=auth_methods.supported(),
        claims_supported=[
            "sub",
            "iss",
            "aud",
            "exp",
            "iat",
            "auth_time",
            "nonce",
            "acr",
            "amr",
            "name",
            "preferred_username",
            "email",
            "email_verified",
        ],
    )


@router.get(
    "/.well-known/jwks.json",
    response_model=JsonWebKeySet,
    summary="JSON Web Key Set",
    description=(
        "Public signing keys, one JWK per `kid`. Resource servers validate "
        "access tokens against these offline — no call back to IDEN.\n\n"
        "**Required scope:** none — this endpoint is public."
    ),
)
def json_web_key_set() -> JsonWebKeySet:
    return JsonWebKeySet(**jwks())
