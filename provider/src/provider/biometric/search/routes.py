from fastapi import APIRouter, Depends, File, UploadFile

from provider.biometric.search import service
from provider.biometric.search.schemas import SearchResponse
from provider.core.auth import require_scope
from provider.core.db import DBSessionDep

router = APIRouter(prefix="/biometric", tags=["biometric"])


@router.post(
    "/search",
    response_model=SearchResponse,
    summary="Identify a face against every enrolled template",
    description=(
        '1:N — "who is this?" The kiosk\'s main walk-up call.\n\n'
        "A missing face or a failed liveness check are not errors here: they "
        "are ordinary responses with the corresponding flag `false`, since "
        "the caller — not this endpoint — decides what to show for each.\n\n"
        "**Required scope:** `biometric:search`"
    ),
    dependencies=[Depends(require_scope("biometric:search"))],
)
async def search(
    session: DBSessionDep, image: UploadFile = File(...)
) -> SearchResponse:
    data = await image.read()
    result = await service.identify(session, data)
    return SearchResponse(
        face_found=result.face_found,
        matched=result.matched,
        user_id=result.user_id,
        liveness_passed=result.liveness_passed,
        confidence=result.confidence,
    )
