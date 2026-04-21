"""Database operations for OIDC client admin CRUD."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from admin.clients.errors import (
    ClientInUseError,
    ClientNotFound,
    OrgNotFound,
    PublicClientError,
)
from admin.clients.schemas import ClientCreate, ClientUpdate
from core.security import (
    generate_client_id,
    generate_client_secret,
    hash_secret,
)
from shared.models import OIDCClient, Organization


async def _ensure_org_exists(session: AsyncSession, org_id: UUID) -> None:
    org_exists = await session.scalar(
        select(Organization.id).where(Organization.id == org_id)
    )
    if org_exists is None:
        raise OrgNotFound(str(org_id))


async def create_client(
    session: AsyncSession, payload: ClientCreate
) -> tuple[OIDCClient, str | None]:
    await _ensure_org_exists(session, payload.org_id)

    cleartext_secret: str | None = None
    secret_hash: str | None = None
    if not payload.is_public:
        cleartext_secret = generate_client_secret()
        secret_hash = hash_secret(cleartext_secret)

    client = OIDCClient(
        id=generate_client_id(),
        secret_hash=secret_hash,
        client_name=payload.client_name,
        description=payload.description,
        logo_uri=payload.logo_uri,
        client_uri=payload.client_uri,
        tos_uri=payload.tos_uri,
        policy_uri=payload.policy_uri,
        contacts=[str(c) for c in payload.contacts],
        token_endpoint_auth_method=payload.token_endpoint_auth_method,
        require_pkce=payload.require_pkce,
        post_logout_redirect_uris=list(payload.post_logout_redirect_uris),
        backchannel_logout_uri=payload.backchannel_logout_uri,
        access_token_ttl_seconds=payload.access_token_ttl_seconds,
        refresh_token_ttl_seconds=payload.refresh_token_ttl_seconds,
        id_token_ttl_seconds=payload.id_token_ttl_seconds,
        refresh_token_rotation=payload.refresh_token_rotation,
        consent_required=payload.consent_required,
        redirect_uris=list(payload.redirect_uris),
        grant_types=list(payload.grant_types),
        response_types=list(payload.response_types),
        allowed_scopes=list(payload.allowed_scopes),
        audience=list(payload.audience),
        is_public=payload.is_public,
        org_id=payload.org_id,
        client_kind=payload.client_kind,
    )
    session.add(client)
    await session.commit()
    await session.refresh(client)
    return client, cleartext_secret


async def list_clients(
    session: AsyncSession,
    *,
    org_id: UUID | None,
    client_kind: str | None,
    limit: int,
    offset: int,
) -> tuple[list[OIDCClient], int]:
    filters = []
    if org_id is not None:
        filters.append(OIDCClient.org_id == org_id)
    if client_kind is not None:
        filters.append(OIDCClient.client_kind == client_kind)

    total = await session.scalar(
        select(func.count()).select_from(OIDCClient).where(*filters)
    ) or 0
    items = (
        await session.scalars(
            select(OIDCClient)
            .where(*filters)
            .order_by(OIDCClient.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return list(items), total


async def get_client(session: AsyncSession, client_id: str) -> OIDCClient:
    client = await session.get(OIDCClient, client_id)
    if client is None:
        raise ClientNotFound(client_id)
    return client


async def update_client(
    session: AsyncSession, client_id: str, payload: ClientUpdate
) -> OIDCClient:
    client = await get_client(session, client_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(client, field, value)
    await session.commit()
    await session.refresh(client)
    return client


async def delete_client(session: AsyncSession, client_id: str) -> None:
    client = await get_client(session, client_id)
    await session.delete(client)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise ClientInUseError(client_id) from exc


async def rotate_secret(
    session: AsyncSession, client_id: str
) -> tuple[OIDCClient, str]:
    client = await get_client(session, client_id)
    if client.is_public:
        raise PublicClientError(client_id)
    cleartext = generate_client_secret()
    client.secret_hash = hash_secret(cleartext)
    await session.commit()
    await session.refresh(client)
    return client, cleartext
