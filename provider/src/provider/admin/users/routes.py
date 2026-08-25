from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response

from provider.admin.users import service
from provider.admin.users.schemas import (
    EffectiveScopes,
    Named,
    PasswordReset,
    PasswordResetResult,
    RoleAssignment,
    ScopeAssignment,
    ScopeSource,
    UserCreate,
    UserCreated,
    UserResponse,
    UserUpdate,
)
from provider.authz.services.scope_resolver import scope_provenance
from provider.core.auth import require_scope
from provider.core.db import DBSessionDep
from provider.core.redis import RedisDep
from provider.core.schemas import ErrorResponse, Page, PageMeta, PaginationDep

router = APIRouter(prefix="/admin/users", tags=["admin: users"])

READ = Depends(require_scope("admin:users:read"))
WRITE = Depends(require_scope("admin:users:write"))


def to_response(user) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        display_name=user.display_name,
        is_active=user.is_active,
        roles=[
            Named(id=r.id, name=r.name)
            for r in sorted(user.roles, key=lambda r: r.name)
        ],
        groups=[
            Named(id=g.id, name=g.name)
            for g in sorted(user.groups, key=lambda g: g.name)
        ],
        direct_scopes=sorted(s.value for s in user.scopes),
        last_login_at=user.last_login_at,
        created_at=user.created_at,
    )


@router.get(
    "",
    response_model=Page[UserResponse],
    summary="List users",
    description=(
        "Filterable by group, role, active status, and a substring of email or "
        "username.\n\n"
        "**Required scope:** `admin:users:read`"
    ),
    dependencies=[READ],
)
async def list_users(
    session: DBSessionDep,
    page: PaginationDep,
    search: str | None = Query(None, description="Substring of email or username."),
    # Aliased so the query string is camelCase like every request and response
    # body. Without it a caller sending `groupId` gets an unfiltered list back,
    # which is the worst kind of wrong answer: a plausible one.
    group_id: UUID | None = Query(None, alias="groupId"),
    role_id: UUID | None = Query(None, alias="roleId"),
    is_active: bool | None = Query(None, alias="isActive"),
) -> Page[UserResponse]:
    users, total = await service.list_users(
        session,
        limit=page.limit,
        offset=page.offset,
        search=search,
        group_id=group_id,
        role_id=role_id,
        is_active=is_active,
    )

    return Page[UserResponse](
        items=[to_response(user) for user in users],
        meta=PageMeta(total=total, limit=page.limit, offset=page.offset),
    )


@router.post(
    "",
    response_model=UserCreated,
    status_code=201,
    summary="Create a user",
    description=(
        "Creates an account, optionally with roles and group memberships.\n\n"
        "Omit `password` and one is generated and returned **once** in "
        "`generatedPassword`. It is argon2-hashed on the way in and cannot be "
        "recovered afterwards.\n\n"
        "**Required scope:** `admin:users:write`"
    ),
    responses={
        404: {"model": ErrorResponse, "description": "Unknown role or group ids"},
        409: {"model": ErrorResponse, "description": "Email or username already taken"},
    },
    dependencies=[WRITE],
)
async def create_user(body: UserCreate, session: DBSessionDep) -> UserCreated:
    user, generated = await service.create_user(session, body)
    return UserCreated(**to_response(user).model_dump(), generated_password=generated)


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Read a user",
    description="**Required scope:** `admin:users:read`",
    responses={404: {"model": ErrorResponse, "description": "No such user"}},
    dependencies=[READ],
)
async def read_user(user_id: UUID, session: DBSessionDep) -> UserResponse:
    return to_response(await service.get_user(session, user_id))


@router.get(
    "/{user_id}/effective-scopes",
    response_model=EffectiveScopes,
    summary="Explain a user's permissions",
    description=(
        "Every scope this user holds, annotated with **where it came from** — a "
        "direct grant, a role, or a group's role.\n\n"
        "This is the endpoint that answers *why can this person do that?*, and "
        "the answer a permission audit needs. It is computed with the same "
        "resolver that runs at token issuance, so it cannot disagree with what a "
        "token would actually carry.\n\n"
        "**Required scope:** `admin:users:read`"
    ),
    responses={404: {"model": ErrorResponse, "description": "No such user"}},
    dependencies=[READ],
)
async def effective_scopes(user_id: UUID, session: DBSessionDep) -> EffectiveScopes:
    user = await service.get_user(session, user_id)

    return EffectiveScopes(
        user_id=user.id,
        scopes=[
            ScopeSource(
                value=source.value,
                via_direct=source.via_direct,
                via_roles=source.via_roles,
                via_groups=source.via_groups,
            )
            for source in scope_provenance(user)
        ],
    )


@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update a user",
    description=(
        "Deactivating a user (`isActive: false`) immediately revokes every "
        "session and refresh token — otherwise the account stays usable until "
        "they expire on their own.\n\n"
        "**Required scope:** `admin:users:write`"
    ),
    responses={
        404: {"model": ErrorResponse, "description": "No such user"},
        409: {"model": ErrorResponse, "description": "Email or username already taken"},
    },
    dependencies=[WRITE],
)
async def update_user(
    user_id: UUID, body: UserUpdate, session: DBSessionDep, redis: RedisDep
) -> UserResponse:
    return to_response(await service.update_user(session, redis, user_id, body))


@router.put(
    "/{user_id}/roles",
    response_model=UserResponse,
    summary="Set a user's roles",
    description=(
        "**Replaces the entire set.** Roles inherited from groups are unaffected "
        "— those are managed on the group.\n\n"
        "**Required scope:** `admin:users:write`"
    ),
    responses={
        404: {
            "model": ErrorResponse,
            "description": "No such user, or unknown role ids",
        }
    },
    dependencies=[WRITE],
)
async def set_roles(
    user_id: UUID, body: RoleAssignment, session: DBSessionDep
) -> UserResponse:
    return to_response(await service.set_roles(session, user_id, body.role_ids))


@router.put(
    "/{user_id}/scopes",
    response_model=UserResponse,
    summary="Set a user's direct scope grants",
    description=(
        "Individual grants for exceptions that do not deserve a role. "
        "**Replaces the entire set.**\n\n"
        "Prefer roles: a direct grant is invisible in any role listing and is "
        "easy to forget when someone changes jobs.\n\n"
        "**Required scope:** `admin:users:write`"
    ),
    responses={
        404: {
            "model": ErrorResponse,
            "description": "No such user, or unknown scope ids",
        }
    },
    dependencies=[WRITE],
)
async def set_scopes(
    user_id: UUID, body: ScopeAssignment, session: DBSessionDep
) -> UserResponse:
    return to_response(
        await service.set_direct_scopes(session, user_id, body.scope_ids)
    )


@router.post(
    "/{user_id}/reset-password",
    response_model=PasswordResetResult,
    summary="Reset a user's password",
    description=(
        "Sets a new password and signs the user out everywhere — every session "
        "and refresh token is revoked, because a credential change that leaves "
        "old sessions alive has not really taken effect.\n\n"
        "Omit `password` to have one generated and returned once.\n\n"
        "**Required scope:** `admin:users:write`"
    ),
    responses={404: {"model": ErrorResponse, "description": "No such user"}},
    dependencies=[WRITE],
)
async def reset_password(
    user_id: UUID, body: PasswordReset, session: DBSessionDep, redis: RedisDep
) -> PasswordResetResult:
    generated = await service.reset_password(session, redis, user_id, body.password)
    return PasswordResetResult(password=generated, sessions_revoked=True)


@router.delete(
    "/{user_id}",
    status_code=204,
    summary="Delete a user",
    description=(
        "Removes the account and everything hanging off it. Consider "
        "deactivating instead — deletion loses the audit trail of who did what.\n\n"
        "**Required scope:** `admin:users:write`"
    ),
    responses={404: {"model": ErrorResponse, "description": "No such user"}},
    dependencies=[WRITE],
)
async def delete_user(
    user_id: UUID, session: DBSessionDep, redis: RedisDep
) -> Response:
    await service.delete_user(session, redis, user_id)
    return Response(status_code=204)
