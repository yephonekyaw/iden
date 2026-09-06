from fastapi import APIRouter, Depends, File, UploadFile

from provider.biometric.liveness import service
from provider.biometric.liveness.schemas import LivenessResponse
from provider.core.auth import require_scope

router = APIRouter(prefix="/biometric", tags=["biometric"])


@router.post(
    "/liveness",
    response_model=LivenessResponse,
    summary="Check whether a captured face is live",
    description=(
        "Liveness only — no identity is looked up or compared.\n\n"
        "**Required scope:** `biometric:liveness`"
    ),
    dependencies=[Depends(require_scope("biometric:liveness"))],
)
async def liveness(image: UploadFile = File(...)) -> LivenessResponse:
    data = await image.read()
    result = await service.check(data)
    return LivenessResponse(
        face_found=result.face_found,
        liveness_passed=result.liveness_passed,
        confidence=result.confidence,
    )
