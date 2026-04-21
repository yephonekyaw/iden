"""HTTP endpoints for OIDC client admin operations."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from admin.clients import service
from admin.clients.errors import (
    ClientInUseError,
    ClientNotFound,
    OrgNotFound,
    PublicClientError,
)
from admin.clients.schemas import (
    ClientCreate,
    ClientCreateResponse,
    ClientKind,
    ClientList,
    ClientResponse,
    ClientSecretResponse,
    ClientUpdate,
)
from core.auth import require_scope
from core.db import get_session
from shared.scopes import ADMIN_CLIENTS_READ, ADMIN_CLIENTS_WRITE

router = APIRouter(prefix="/clients", tags=["admin:clients"])


@router.post(
    "",
    response_model=ClientCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new OIDC client",
    description=(
        "Creates a new OIDC/OAuth2 client. For confidential clients "
        "(``is_public=false``) the generated ``client_secret`` is returned **once** "
        "in the response body and cannot be retrieved later."
        f"\n\n**Required scope:** `{ADMIN_CLIENTS_WRITE}`"
    ),
    responses={404: {"description": "Organization not found"}},
    dependencies=[Depends(require_scope(ADMIN_CLIENTS_WRITE))],
)
async def create_client(
    payload: ClientCreate,
    session: AsyncSession = Depends(get_session),
) -> ClientCreateResponse:
    try:
        client, secret = await service.create_client(session, payload)
    except OrgNotFound:
        raise HTTPException(status_code=404, detail="Organization not found")
    return ClientCreateResponse.model_validate(client).model_copy(
        update={"client_secret": secret}
    )


@router.get(
    "",
    response_model=ClientList,
    summary="List registered OIDC clients",
    description=f"**Required scope:** `{ADMIN_CLIENTS_READ}`",
    dependencies=[Depends(require_scope(ADMIN_CLIENTS_READ))],
)
async def list_clients(
    org_id: UUID | None = Query(default=None, description="Filter by organization."),
    client_kind: ClientKind | None = Query(
        default=None, description="Filter by client kind."
    ),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_session),
) -> ClientList:
    items, total = await service.list_clients(
        session,
        org_id=org_id,
        client_kind=client_kind,
        limit=limit,
        offset=offset,
    )
    items = [ClientResponse.model_validate(item) for item in items]
    return ClientList(items=items, total=total, limit=limit, offset=offset)


@router.get(
    "/{client_id}",
    response_model=ClientResponse,
    summary="Get a single OIDC client",
    description=f"**Required scope:** `{ADMIN_CLIENTS_READ}`",
    responses={404: {"description": "Client not found"}},
    dependencies=[Depends(require_scope(ADMIN_CLIENTS_READ))],
)
async def get_client(
    client_id: str,
    session: AsyncSession = Depends(get_session),
) -> ClientResponse:
    try:
        client = await service.get_client(session, client_id)
        return ClientResponse.model_validate(client)
    except ClientNotFound:
        raise HTTPException(status_code=404, detail="Client not found")


@router.patch(
    "/{client_id}",
    response_model=ClientResponse,
    summary="Update mutable fields on an OIDC client",
    description=(
        "Only mutable fields may be changed. Changing ``org_id``, ``is_public``, or "
        "``client_kind`` requires deleting and recreating the client."
        f"\n\n**Required scope:** `{ADMIN_CLIENTS_WRITE}`"
    ),
    responses={404: {"description": "Client not found"}},
    dependencies=[Depends(require_scope(ADMIN_CLIENTS_WRITE))],
)
async def update_client(
    client_id: str,
    payload: ClientUpdate,
    session: AsyncSession = Depends(get_session),
) -> ClientResponse:
    try:
        client = await service.update_client(session, client_id, payload)
        return ClientResponse.model_validate(client)
    except ClientNotFound:
        raise HTTPException(status_code=404, detail="Client not found")


@router.delete(
    "/{client_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an OIDC client",
    description=f"**Required scope:** `{ADMIN_CLIENTS_WRITE}`",
    responses={
        404: {"description": "Client not found"},
        409: {"description": "Client is still referenced by other resources"},
    },
    dependencies=[Depends(require_scope(ADMIN_CLIENTS_WRITE))],
)
async def delete_client(
    client_id: str,
    session: AsyncSession = Depends(get_session),
) -> None:
    try:
        await service.delete_client(session, client_id)
    except ClientNotFound:
        raise HTTPException(status_code=404, detail="Client not found")
    except ClientInUseError:
        raise HTTPException(
            status_code=409,
            detail="Client is still referenced by other resources (e.g. kiosks).",
        )


@router.post(
    "/{client_id}/rotate-secret",
    response_model=ClientSecretResponse,
    summary="Rotate the client secret",
    description=(
        "Generates a new client secret for a confidential client. The previous "
        "secret is invalidated. The new cleartext secret is returned **once**."
        f"\n\n**Required scope:** `{ADMIN_CLIENTS_WRITE}`"
    ),
    responses={
        400: {"description": "Cannot rotate secret on a public client"},
        404: {"description": "Client not found"},
    },
    dependencies=[Depends(require_scope(ADMIN_CLIENTS_WRITE))],
)
async def rotate_secret(
    client_id: str,
    session: AsyncSession = Depends(get_session),
) -> ClientSecretResponse:
    try:
        client, secret = await service.rotate_secret(session, client_id)
    except ClientNotFound:
        raise HTTPException(status_code=404, detail="Client not found")
    except PublicClientError:
        raise HTTPException(
            status_code=400, detail="Public clients do not have a secret."
        )
    return ClientSecretResponse(id=client.id, client_secret=secret)
