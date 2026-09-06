from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile

from provider.biometric.enroll import service
from provider.biometric.enroll.schemas import EnrollResponse
from provider.core.auth import require_scope
from provider.core.db import DBSessionDep
from provider.core.schemas import ErrorResponse

router = APIRouter(prefix="/biometric", tags=["biometric"])


@router.post(
    "/enroll",
    response_model=EnrollResponse,
    status_code=201,
    summary="Enroll a face",
    description=(
        "Registers a 5-pose capture (frontal, slight left/right/up/down) as "
        "`userId`'s face template, replacing any existing one — the same "
        "relationship a password change has to the old hash. Each pose field "
        "takes a few candidate frames of that pose; the engine picks the "
        "sharpest usable one per pose.\n\n"
        "**Required scope:** `biometric:enroll`"
    ),
    responses={
        404: {"model": ErrorResponse, "description": "No such user"},
        409: {
            "model": ErrorResponse,
            "description": "This face is already enrolled under a different account",
        },
        422: {
            "model": ErrorResponse,
            "description": (
                "No acceptable frame for one of the poses, or that pose failed "
                "the liveness check"
            ),
        },
    },
    dependencies=[Depends(require_scope("biometric:enroll"))],
)
async def enroll(
    session: DBSessionDep,
    user_id: Annotated[UUID, Form(alias="userId")],
    frontal: list[UploadFile] = File(...),
    left: list[UploadFile] = File(...),
    right: list[UploadFile] = File(...),
    up: list[UploadFile] = File(...),
    down: list[UploadFile] = File(...),
) -> EnrollResponse:
    poses = {
        "frontal": frontal,
        "left": left,
        "right": right,
        "up": up,
        "down": down,
    }
    images = {pose: [await f.read() for f in files] for pose, files in poses.items()}
    enrollment = await service.enroll(session, user_id, images)
    return EnrollResponse(enrolled=True, user_id=enrollment.user_id)
