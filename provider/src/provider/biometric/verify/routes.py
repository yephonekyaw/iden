from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile

from provider.biometric.verify import service
from provider.biometric.verify.schemas import VerifyResponse
from provider.core.auth import require_scope
from provider.core.db import DBSessionDep

router = APIRouter(prefix="/biometric", tags=["biometric"])


@router.post(
    "/verify",
    response_model=VerifyResponse,
    summary="Verify a face against a claimed identity",
    description=(
        "1:1 — does this face belong to `userId`?\n\n"
        "**Required scope:** `biometric:verify`"
    ),
    dependencies=[Depends(require_scope("biometric:verify"))],
)
async def verify(
    session: DBSessionDep,
    user_id: Annotated[UUID, Form(alias="userId")],
    image: UploadFile = File(...),
) -> VerifyResponse:
    data = await image.read()
    result = await service.verify(session, user_id, data)
    return VerifyResponse(
        face_found=result.face_found,
        match=result.match,
        liveness_passed=result.liveness_passed,
        confidence=result.confidence,
    )
