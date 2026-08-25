from uuid import UUID

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from provider.admin.apis.errors import (
    ApiInUse,
    ApiNameTaken,
    ApiNotFound,
    AudienceTaken,
    SystemApiImmutable,
)
from provider.admin.apis.schemas import ApiCreate, ApiUpdate
from provider.shared.models import (
    ClientScope,
    ResourceApi,
    Scope,
    role_scopes,
    user_scopes,
)


async def _scope_counts(session: AsyncSession, api_ids: list[UUID]) -> dict[UUID, int]:
    if not api_ids:
        return {}
    rows = await session.execute(
        select(Scope.api_id, func.count(Scope.id))
        .where(Scope.api_id.in_(api_ids))
        .group_by(Scope.api_id)
    )
    return {api_id: count for api_id, count in rows}


async def list_apis(
    session: AsyncSession, *, limit: int, offset: int
) -> tuple[list[ResourceApi], dict[UUID, int], int]:
    total = await session.scalar(select(func.count(ResourceApi.id))) or 0
    apis = list(
        await session.scalars(
            select(ResourceApi).order_by(ResourceApi.name).limit(limit).offset(offset)
        )
    )
    return apis, await _scope_counts(session, [api.id for api in apis]), total


async def get_api(session: AsyncSession, api_id: UUID) -> ResourceApi:
    api = await session.get(ResourceApi, api_id)
    if api is None:
        raise ApiNotFound
    return api


async def count_scopes(session: AsyncSession, api_id: UUID) -> int:
    return (await _scope_counts(session, [api_id])).get(api_id, 0)


async def create_api(session: AsyncSession, data: ApiCreate) -> ResourceApi:
    if await session.scalar(select(ResourceApi).where(ResourceApi.name == data.name)):
        raise ApiNameTaken
    if await session.scalar(
        select(ResourceApi).where(ResourceApi.audience == data.audience)
    ):
        raise AudienceTaken

    api = ResourceApi(
        name=data.name, audience=data.audience, description=data.description
    )
    session.add(api)
    await session.commit()
    await session.refresh(api)
    return api


async def update_api(
    session: AsyncSession, api_id: UUID, data: ApiUpdate
) -> ResourceApi:
    api = await get_api(session, api_id)
    if api.is_system:
        raise SystemApiImmutable

    if data.name is not None and data.name != api.name:
        if await session.scalar(
            select(ResourceApi).where(ResourceApi.name == data.name)
        ):
            raise ApiNameTaken
        api.name = data.name

    if data.description is not None:
        api.description = data.description

    await session.commit()
    return api


async def api_scopes_in_use(session: AsyncSession, api_id: UUID) -> bool:
    """Whether any of this API's scopes are granted to a role, user, or client."""
    scope_ids = select(Scope.id).where(Scope.api_id == api_id).scalar_subquery()

    return bool(
        await session.scalar(
            select(func.count())
            .select_from(role_scopes)
            .where(role_scopes.c.scope_id.in_(scope_ids))
        )
        or await session.scalar(
            select(func.count())
            .select_from(user_scopes)
            .where(user_scopes.c.scope_id.in_(scope_ids))
        )
        or await session.scalar(
            select(func.count())
            .select_from(ClientScope)
            .where(ClientScope.scope_id.in_(scope_ids))
        )
    )


async def delete_api(session: AsyncSession, api_id: UUID, *, force: bool) -> None:
    api = await get_api(session, api_id)
    if api.is_system:
        raise SystemApiImmutable

    # Deleting an API cascades to its scopes, which silently strips permissions
    # from whoever held them. That should be a deliberate act, not a side effect.
    if not force and await api_scopes_in_use(session, api_id):
        raise ApiInUse

    await session.delete(api)
    await session.commit()
