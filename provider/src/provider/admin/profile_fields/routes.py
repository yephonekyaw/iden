from uuid import UUID

from fastapi import APIRouter, Depends, Response

from provider.admin.profile_fields import service
from provider.admin.profile_fields.schemas import (
    FieldPresetList,
    FieldPresetResponse,
    ProfileFieldCreate,
    ProfileFieldResponse,
    ProfileFieldUpdate,
)
from provider.core.auth import require_scope
from provider.core.db import DBSessionDep
from provider.core.schemas import ErrorResponse, Page, PageMeta, PaginationDep
from provider.shared.models import ProfileField
from provider.shared.profile_presets import PRESETS

router = APIRouter(prefix="/admin/profile-fields", tags=["admin: profile fields"])

READ = Depends(require_scope("admin:profile-fields:read"))
WRITE = Depends(require_scope("admin:profile-fields:write"))


def to_response(field: ProfileField) -> ProfileFieldResponse:
    return ProfileFieldResponse(
        id=field.id,
        key=field.key,
        label=field.label,
        description=field.description,
        data_type=field.data_type,
        options=field.options,
        required=field.required,
        unique=field.unique,
        validators=field.validators,
        user_readable=field.user_readable,
        user_writable=field.user_writable,
        group_id=field.group_id,
        group_name=field.group.name if field.group else None,
        claim_name=field.claim_name,
        claim_scope=field.claim_scope,
        display_order=field.display_order,
        is_system=field.is_system,
        created_at=field.created_at,
    )


@router.get(
    "",
    response_model=Page[ProfileFieldResponse],
    summary="List profile fields",
    description=(
        "The schema this organization collects about its people. IDEN ships "
        "none of these — a university needs `student_id`, a company needs "
        "`employee_id`, and shipping either would make the other's deployment "
        "wrong.\n\n"
        "**Required scope:** `admin:profile-fields:read`"
    ),
    dependencies=[READ],
)
async def list_fields(
    session: DBSessionDep, page: PaginationDep
) -> Page[ProfileFieldResponse]:
    fields, total = await service.list_fields(
        session, limit=page.limit, offset=page.offset
    )
    return Page[ProfileFieldResponse](
        items=[to_response(field) for field in fields],
        meta=PageMeta(total=total, limit=page.limit, offset=page.offset),
    )


@router.post(
    "",
    response_model=ProfileFieldResponse,
    status_code=201,
    summary="Define a profile field",
    description=(
        "`userWritable` is the decision that matters: it is what "
        "`PATCH /entity/profile` will accept. A registrar sets `student_id` "
        "through the admin API and the student cannot touch it; "
        "`preferred_name` is the student's own.\n\n"
        "`groupId` binds the field to a group, so students and staff get "
        "different forms without a second grouping concept.\n\n"
        "Setting `claimName` and `claimScope` releases the value as a token "
        "claim, but only to clients granted that scope. Fields are invisible to "
        "clients until then.\n\n"
        "**Required scope:** `admin:profile-fields:write`"
    ),
    responses={
        404: {"model": ErrorResponse, "description": "Unknown group"},
        409: {"model": ErrorResponse, "description": "Key already in use"},
        422: {
            "model": ErrorResponse,
            "description": "Enum without options, reserved claim name, or unknown claim scope",
        },
    },
    dependencies=[WRITE],
)
async def create_field(
    body: ProfileFieldCreate, session: DBSessionDep
) -> ProfileFieldResponse:
    return to_response(await service.create_field(session, body))


@router.get(
    "/presets",
    response_model=FieldPresetList,
    summary="Ready-made field definitions to start from",
    description=(
        "A catalogue of the fields most organizations end up defining, each with "
        "its type, validators and permissions already decided.\n\n"
        "**Nothing here exists until you create it.** These are templates: pick "
        "one, change whatever you like, and post it to `POST /admin/profile-fields` "
        "like any other definition.\n\n"
        "The value in them is `userWritable`. Who owns a piece of data is the "
        "question people get wrong — a preferred name belongs to its owner, a "
        "student number belongs to the registrar — so every preset answers it and "
        "says why in `rationale`.\n\n"
        "**Required scope:** `admin:profile-fields:read`"
    ),
    dependencies=[READ],
)
async def list_presets() -> FieldPresetList:
    return FieldPresetList(
        presets=[
            FieldPresetResponse(
                key=preset.key,
                label=preset.label,
                description=preset.description,
                data_type=preset.data_type.value,
                options=list(preset.options),
                required=preset.required,
                unique=preset.unique,
                validators=preset.validators,
                user_readable=preset.user_readable,
                user_writable=preset.user_writable,
                rationale=preset.rationale,
                category=preset.category,
            )
            for preset in PRESETS
        ]
    )


@router.get(
    "/{field_id}",
    response_model=ProfileFieldResponse,
    summary="Read a profile field",
    description="**Required scope:** `admin:profile-fields:read`",
    responses={404: {"model": ErrorResponse, "description": "No such field"}},
    dependencies=[READ],
)
async def read_field(field_id: UUID, session: DBSessionDep) -> ProfileFieldResponse:
    return to_response(await service.get_field(session, field_id))


@router.patch(
    "/{field_id}",
    response_model=ProfileFieldResponse,
    summary="Update a profile field",
    description=(
        "`key`, `dataType`, `unique` and `groupId` are absent on purpose. Each "
        "would rewrite the meaning of values already stored — changing a type "
        "cannot recast them, and adding `unique` to a field with duplicates "
        "cannot succeed. Define a new field instead.\n\n"
        "**Required scope:** `admin:profile-fields:write`"
    ),
    responses={
        404: {"model": ErrorResponse, "description": "No such field"},
        409: {"model": ErrorResponse, "description": "Built-in field"},
        422: {"model": ErrorResponse, "description": "Invalid claim mapping"},
    },
    dependencies=[WRITE],
)
async def update_field(
    field_id: UUID, body: ProfileFieldUpdate, session: DBSessionDep
) -> ProfileFieldResponse:
    return to_response(await service.update_field(session, field_id, body))


@router.delete(
    "/{field_id}",
    status_code=204,
    summary="Delete a profile field",
    description=(
        "**This deletes every answer to it.** An organization that stops "
        "collecting a field should stop holding the data, and nothing else "
        "accomplishes that.\n\n"
        "**Required scope:** `admin:profile-fields:write`"
    ),
    responses={
        404: {"model": ErrorResponse, "description": "No such field"},
        409: {"model": ErrorResponse, "description": "Built-in field"},
    },
    dependencies=[WRITE],
)
async def delete_field(field_id: UUID, session: DBSessionDep) -> Response:
    await service.delete_field(session, field_id)
    return Response(status_code=204)
