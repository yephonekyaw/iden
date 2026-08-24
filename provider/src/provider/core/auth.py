"""The gate every resource-server route depends on."""

from dataclasses import dataclass
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request

from provider.core.config import settings
from provider.core.crypto import verify_jwt
from provider.core.redis import RedisDep
from provider.authz.services.token_service import is_denylisted


@dataclass
class AccessToken:
    subject: str
    client_id: str
    scopes: set[str]
    audience: list[str]
    jti: str
    acr: str | None
    amr: list[str]
    claims: dict


def _audience_for(scope: str) -> str:
    """The audience a scope's API was registered under.

    IDEN's own APIs are named after the scope prefix (`admin:users:read` →
    the `admin` API), so the audience is derivable rather than repeated on
    every route. Externally registered APIs are validated by their own
    resource servers, never here.
    """
    return f"{settings.iden_issuer}/{scope.split(':')[0]}"


def _bearer(request: Request) -> str:
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")

    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=401,
            detail="Missing bearer token.",
            headers={"WWW-Authenticate": 'Bearer realm="iden"'},
        )
    return token


def require_scope(*required: str):
    """Verify the access token and enforce scopes.

    401 means *authenticate again* — no token, bad signature, expired, revoked.
    403 means *authentication will not help* — the token is valid but lacks the
    scope. Collapsing the two would tell a client to retry a login that cannot
    fix anything.
    """
    audience = _audience_for(required[0]) if required else None

    async def dependency(request: Request, redis: RedisDep) -> AccessToken:
        raw = _bearer(request)

        try:
            claims = verify_jwt(raw, audience=audience)
        except jwt.PyJWTError as exc:
            raise HTTPException(
                status_code=401,
                detail=f"Invalid token: {exc}",
                headers={"WWW-Authenticate": 'Bearer error="invalid_token"'},
            ) from exc

        if await is_denylisted(redis, claims["jti"]):
            raise HTTPException(
                status_code=401,
                detail="Token has been revoked.",
                headers={"WWW-Authenticate": 'Bearer error="invalid_token"'},
            )

        granted = set(claims.get("scope", "").split())
        missing = set(required) - granted
        if missing:
            raise HTTPException(
                status_code=403,
                detail=f"Missing required scope: {' '.join(sorted(missing))}",
            )

        aud = claims["aud"]
        return AccessToken(
            subject=claims["sub"],
            client_id=claims["client_id"],
            scopes=granted,
            audience=aud if isinstance(aud, list) else [aud],
            jti=claims["jti"],
            acr=claims.get("acr"),
            amr=claims.get("amr", []),
            claims=claims,
        )

    return dependency


# For routes that need an authenticated caller but gate on nothing further.
CurrentTokenDep = Annotated[AccessToken, Depends(require_scope())]
