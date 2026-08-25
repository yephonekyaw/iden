from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from provider.admin.apis.service import get_api
from provider.admin.scopes.errors import (
    ScopeInUse,
    ScopeNotFound,
    ScopeValueTaken,
    SystemScopeImmutable,
)
from provider.admin.scopes.schemas import ScopeCreate, ScopeUpdate
from provider.shared.models import ClientScope, Scope, role_scopes, user_scopes


async def list_scopes(
    session: AsyncSession, api_id: UUID, *, limit: int, offset: int
) -> tuple[list[Scope], int]:
    await get_api(session, api_id)

    total = await session.scalar(
        select(func.count(Scope.id)).where(Scope.api_id == api_id)
    )
    scopes = list(
        await session.scalars(
            select(Scope)
            .where(Scope.api_id == api_id)
            .order_by(Scope.value)
            .limit(limit)
            .offset(offset)
        )
    )
    return scopes, total


async def get_scope(session: AsyncSession, scope_id: UUID) -> Scope:
    scope = await session.get(Scope, scope_id)
    if scope is None:
        raise ScopeNotFound
    return scope


async def create_scope(session: AsyncSession, api_id: UUID, data: ScopeCreate) -> Scope:
    api = await get_api(session, api_id)

    if await session.scalar(select(Scope).where(Scope.value == data.value)):
        raise ScopeValueTaken

    scope = Scope(api_id=api_id, value=data.value, description=data.description)
    # Assigned rather than left to load later: the relationship is unset on a new
    # object, and a lazy load inside async code fails.
    scope.api = api
    session.add(scope)
    await session.commit()
    return scope


async def update_scope(
    session: AsyncSession, scope_id: UUID, data: ScopeUpdate
) -> Scope:
    scope = await get_scope(session, scope_id)
    if scope.is_system:
        raise SystemScopeImmutable

    if data.description is not None:
        scope.description = data.description

    await session.commit()
    return scope


async def scope_in_use(session: AsyncSession, scope_id: UUID) -> bool:
    return bool(
        await session.scalar(
            select(func.count())
            .select_from(role_scopes)
            .where(role_scopes.c.scope_id == scope_id)
        )
        or await session.scalar(
            select(func.count())
            .select_from(user_scopes)
            .where(user_scopes.c.scope_id == scope_id)
        )
        or await session.scalar(
            select(func.count())
            .select_from(ClientScope)
            .where(ClientScope.scope_id == scope_id)
        )
    )


async def delete_scope(session: AsyncSession, scope_id: UUID, *, force: bool) -> None:
    scope = await get_scope(session, scope_id)
    if scope.is_system:
        raise SystemScopeImmutable

    if not force and await scope_in_use(session, scope_id):
        raise ScopeInUse

    await session.delete(scope)
    await session.commit()
