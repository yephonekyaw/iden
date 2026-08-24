"""Client authentication, redirect validation, and authorization codes."""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from provider.authz.oauth.errors import InvalidClient, InvalidGrant
from provider.authz.services.pkce import verify_challenge
from provider.authz.services.token_service import now
from provider.core.config import settings
from provider.core.security import generate_token, hash_token, verify_secret
from provider.shared.enums import ClientType, GrantType
from provider.shared.models import AuthorizationCode, Client, User


async def get_client(session: AsyncSession, client_id: str | None) -> Client | None:
    if not client_id:
        return None
    return await session.scalar(select(Client).where(Client.client_id == client_id))


def redirect_uri_registered(client: Client, redirect_uri: str | None) -> bool:
    """Exact string comparison — RFC 6749 §3.1.2.3.

    Not a prefix or hostname match: sub-path and query tricks on a permissive
    comparison are how authorization codes get exfiltrated.
    """
    return redirect_uri is not None and redirect_uri in client.redirect_uris


async def authenticate_client(
    session: AsyncSession, client_id: str | None, client_secret: str | None, grant: str
) -> Client:
    """Client authentication for the token endpoint — RFC 6749 §2.3."""
    client = await get_client(session, client_id)
    if client is None:
        raise InvalidClient("Unknown client.")

    if client.client_type == ClientType.CONFIDENTIAL:
        if not client_secret or not verify_secret(client.client_secret_hash, client_secret):
            raise InvalidClient()
    elif client_secret:
        raise InvalidClient("A public client must not present a secret.")

    if grant not in client.allowed_grants:
        raise InvalidClient(f"This client may not use the {grant} grant.")

    return client


async def issue_code(
    session: AsyncSession,
    *,
    client: Client,
    user: User,
    params: dict[str, str],
    scopes: set[str],
    acr: str,
    amr: list[str],
) -> str:
    code = generate_token()
    session.add(
        AuthorizationCode(
            code_hash=hash_token(code),
            client_id=client.id,
            user_id=user.id,
            redirect_uri=params["redirect_uri"],
            scope=" ".join(sorted(scopes)),
            code_challenge=params["code_challenge"],
            code_challenge_method=params["code_challenge_method"],
            nonce=params.get("nonce"),
            acr=acr,
            amr=amr,
            expires_at=now() + timedelta(seconds=settings.iden_auth_code_ttl),
        )
    )
    await session.flush()
    return code


async def consume_code(
    session: AsyncSession,
    *,
    code: str,
    client: Client,
    redirect_uri: str | None,
    code_verifier: str | None,
) -> AuthorizationCode:
    """Validate and burn an authorization code — RFC 6749 §4.1.3, RFC 7636 §4.6."""
    record = await session.scalar(
        select(AuthorizationCode).where(AuthorizationCode.code_hash == hash_token(code))
    )
    if record is None:
        raise InvalidGrant("Unknown authorization code.")

    if record.used_at is not None:
        # RFC 6749 §4.1.2: a code presented twice is assumed compromised.
        raise InvalidGrant("This authorization code has already been used.")

    if record.expires_at <= now():
        raise InvalidGrant("This authorization code has expired.")

    if record.client_id != client.id:
        raise InvalidGrant("This code was issued to a different client.")

    if record.redirect_uri != redirect_uri:
        raise InvalidGrant("redirect_uri does not match the authorization request.")

    if not code_verifier or not verify_challenge(
        code_verifier, record.code_challenge, record.code_challenge_method
    ):
        raise InvalidGrant("PKCE verification failed.")

    record.used_at = now()
    await session.flush()
    return record


def grant_allowed(client: Client, grant: GrantType) -> bool:
    return grant in client.allowed_grants
