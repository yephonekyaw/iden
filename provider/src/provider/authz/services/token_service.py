"""Minting and lifecycle for every token IDEN issues."""

import uuid
from datetime import UTC, datetime, timedelta

from redis.asyncio import Redis
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from provider.core.config import settings
from provider.core.crypto import sign_jwt
from provider.core.security import generate_token, hash_token
from provider.shared.models import Client, RefreshToken, ResourceApi, Scope, User


def now() -> datetime:
    return datetime.now(UTC)


async def audiences_for(session: AsyncSession, values: set[str]) -> list[str]:
    """The `aud` of an access token is the audience of every API owning a
    granted scope, so a resource server can reject tokens minted for someone
    else (RFC 9068 §3).

    Falls back to the issuer when only OIDC scopes were granted: the token
    describes the user to IDEN itself and reaches no other API.
    """
    if not values:
        return [settings.iden_issuer]

    rows = await session.scalars(
        select(ResourceApi.audience)
        .join(Scope, Scope.api_id == ResourceApi.id)
        .where(Scope.value.in_(values))
        .distinct()
    )
    return sorted(rows) or [settings.iden_issuer]


async def mint_access_token(
    session: AsyncSession,
    *,
    subject: str,
    client: Client,
    scopes: set[str],
    acr: str | None = None,
    amr: list[str] | None = None,
) -> tuple[str, str, int]:
    """Returns (token, jti, expires_in)."""
    issued_at = now()
    jti = str(uuid.uuid7())
    audience = await audiences_for(session, scopes)

    claims = {
        "iss": settings.iden_issuer,
        "sub": subject,
        "aud": audience,
        "client_id": client.client_id,
        "scope": " ".join(sorted(scopes)),
        "jti": jti,
        "iat": int(issued_at.timestamp()),
        "exp": int((issued_at + timedelta(seconds=settings.iden_access_token_ttl)).timestamp()),
    }
    # Absent for client_credentials: no person authenticated, so there is no
    # assurance level to report.
    if acr:
        claims["acr"] = acr
    if amr:
        claims["amr"] = amr

    return sign_jwt(claims), jti, settings.iden_access_token_ttl


def mint_id_token(
    user: User,
    client: Client,
    *,
    scopes: set[str],
    acr: str,
    amr: list[str],
    authenticated_at: datetime,
    nonce: str | None = None,
) -> str:
    """The ID token describes the authentication event to the client that asked
    for it — hence `aud` is the client, not an API (OIDC Core §2)."""
    issued_at = now()
    claims = {
        "iss": settings.iden_issuer,
        "sub": str(user.id),
        "aud": client.client_id,
        "iat": int(issued_at.timestamp()),
        "exp": int((issued_at + timedelta(seconds=settings.iden_id_token_ttl)).timestamp()),
        "auth_time": int(authenticated_at.timestamp()),
        "acr": acr,
        "amr": amr,
    }
    # Binds the token to the client's authorization request, defeating replay.
    if nonce:
        claims["nonce"] = nonce

    claims |= identity_claims(user, scopes)
    return sign_jwt(claims)


def identity_claims(user: User, scopes: set[str]) -> dict[str, object]:
    """Claims released by scope — OIDC Core §5.4. Shared with /userinfo so the
    two can never disagree."""
    claims: dict[str, object] = {}

    if "profile" in scopes:
        claims["name"] = user.display_name
        claims["preferred_username"] = user.username

    if "email" in scopes:
        claims["email"] = user.email
        claims["email_verified"] = user.email_verified_at is not None

    return claims


async def issue_refresh_token(
    session: AsyncSession,
    *,
    client: Client,
    user: User,
    scope: str,
    acr: str,
    amr: list[str],
    family_id: uuid.UUID | None = None,
) -> tuple[str, RefreshToken]:
    token = generate_token()
    record = RefreshToken(
        token_hash=hash_token(token),
        client_id=client.id,
        user_id=user.id,
        scope=scope,
        acr=acr,
        amr=amr,
        family_id=family_id or uuid.uuid7(),
        expires_at=now() + timedelta(seconds=settings.iden_refresh_token_ttl),
    )
    session.add(record)
    await session.flush()
    return token, record


class RefreshTokenReuse(Exception):
    """A rotated or revoked token was presented again — assume it was stolen."""


async def consume_refresh_token(session: AsyncSession, token: str) -> RefreshToken | None:
    """Validate a refresh token for rotation.

    Returns None when the token is unknown or expired. Raises RefreshTokenReuse
    when a token that was already rotated or revoked is presented again, having
    revoked the whole family first: with rotation, a second use means two
    parties hold the same token, and only one of them is legitimate.
    """
    record = await session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(token))
    )
    if record is None:
        return None

    if record.revoked_at is not None or record.rotated_to_id is not None:
        await revoke_family(session, record.family_id)
        raise RefreshTokenReuse

    if record.expires_at <= now():
        return None

    return record


async def revoke_family(session: AsyncSession, family_id: uuid.UUID) -> None:
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now())
    )


def _denylist_key(jti: str) -> str:
    return f"denylist:{jti}"


async def denylist_access_token(redis: Redis, jti: str, expires_at: int) -> None:
    """Revoke an access token before it expires.

    Access tokens are stateless, so revocation means remembering the few that
    died early — and only until they would have expired anyway, which is what
    keeps this set small.
    """
    ttl = expires_at - int(now().timestamp())
    if ttl > 0:
        await redis.set(_denylist_key(jti), "1", ex=ttl)


async def is_denylisted(redis: Redis, jti: str) -> bool:
    return await redis.exists(_denylist_key(jti)) == 1
