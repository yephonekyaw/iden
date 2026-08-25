from fastapi import APIRouter, Depends

from provider.core.auth import require_scope
from provider.core.db import DBSessionDep
from provider.core.schemas import ErrorResponse
from provider.entity.deps import CurrentUserDep
from provider.entity.profile import service
from provider.entity.profile.schemas import (
    FieldSchema,
    ProfileResponse,
    ProfileSchemaResponse,
    ProfileUpdate,
)

router = APIRouter(prefix="/entity/profile", tags=["entity: profile"])

READ = Depends(require_scope("entity:profile:read"))
WRITE = Depends(require_scope("entity:profile:write"))


@router.get(
    "",
    response_model=ProfileResponse,
    summary="Read your own profile",
    description=(
        "The signed-in person's profile. There is no path parameter and no way "
        "to ask for anyone else's — the subject comes from the token.\n\n"
        "`fields` holds whatever this organization defined, filtered to the "
        "fields marked readable and to those that apply to the groups this "
        "person belongs to.\n\n"
        "**Required scope:** `entity:profile:read`"
    ),
    dependencies=[READ],
)
async def read_profile(user: CurrentUserDep, session: DBSessionDep) -> ProfileResponse:
    return ProfileResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        display_name=user.display_name,
        email_verified=user.email_verified_at is not None,
        fields=await service.read_profile(session, user),
    )


@router.patch(
    "",
    response_model=ProfileResponse,
    summary="Update your own profile",
    description=(
        "Accepts exactly the fields an administrator marked writable. Writing "
        "anything else is refused rather than quietly dropped, so a client "
        "never believes it saved something it did not.\n\n"
        "Nothing here can change what you are *allowed* to do: roles, groups "
        "and scopes are absent from this module entirely.\n\n"
        "**Required scope:** `entity:profile:write`"
    ),
    responses={
        404: {"model": ErrorResponse, "description": "No field with that key"},
        409: {"model": ErrorResponse, "description": "A unique field's value is taken"},
        422: {
            "model": ErrorResponse,
            "description": "Field is not yours to write, or the value does not fit",
        },
    },
    dependencies=[WRITE],
)
async def update_profile(
    body: ProfileUpdate, user: CurrentUserDep, session: DBSessionDep
) -> ProfileResponse:
    if body.display_name is not None:
        user.display_name = body.display_name

    await service.write_values(session, user, body.fields, enforce_writable=True)
    await session.commit()

    return ProfileResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        display_name=user.display_name,
        email_verified=user.email_verified_at is not None,
        fields=await service.read_profile(session, user),
    )


@router.get(
    "/schema",
    response_model=ProfileSchemaResponse,
    summary="Read the shape of your profile",
    description=(
        "The field definitions that apply to you, in display order. A dashboard "
        "renders its form from this rather than hardcoding one organization's "
        "fields into a general-purpose identity provider.\n\n"
        "`writable: false` means the field is shown but belongs to the "
        "organization — a student sees `student_id` and cannot change it.\n\n"
        "**Required scope:** `entity:profile:read`"
    ),
    dependencies=[READ],
)
async def read_schema(
    user: CurrentUserDep, session: DBSessionDep
) -> ProfileSchemaResponse:
    fields = await service.fields_for(session, user)
    return ProfileSchemaResponse(
        fields=[
            FieldSchema(
                key=field.key,
                label=field.label,
                description=field.description,
                data_type=field.data_type,
                options=field.options,
                required=field.required,
                writable=field.user_writable,
                validators=field.validators,
            )
            for field in fields
            if field.user_readable
        ]
    )
