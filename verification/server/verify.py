from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db import get_session
from face import DetectedFace, ImageDecodeError, NoFaceFound, detect_all
from models import Identity
from responses import error, success
from schemas import FaceResult, MatchedIdentity, VerifyData, VerifyRequest

router = APIRouter()


async def _best_match(
    session: AsyncSession, embedding: list[float]
) -> tuple[Identity | None, float]:
    distance = Identity.embedding.cosine_distance(embedding)
    stmt = select(Identity, distance.label("distance")).order_by(distance).limit(1)
    row = (await session.execute(stmt)).first()
    if row is None:
        return None, 0.0
    identity, dist = row
    return identity, float(1.0 - dist)


def _build_result(
    index: int, face: DetectedFace, identity: Identity | None, score: float
) -> FaceResult:
    confidence = round(score, 4)
    bbox = list(face.bbox)
    if identity is None or score < settings.match_threshold:
        return FaceResult(
            face_index=index, bbox=bbox,
            match_found=False, identity=None, confidence=confidence,
        )
    return FaceResult(
        face_index=index, bbox=bbox, match_found=True,
        identity=MatchedIdentity(
            identity_id=identity.identity_id,
            identity_code=identity.identity_code,
            display_name=identity.display_name,
            confidence=confidence,
        ),
        confidence=confidence,
    )


@router.post("/verify")
async def verify(
    request: Request,
    body: VerifyRequest,
    session: AsyncSession = Depends(get_session),
):
    try:
        faces = detect_all(body.image_base64)
    except NoFaceFound:
        return error(request, code="NO_FACE_DETECTED",
                     message="No face detected in the image", status=400)
    except ImageDecodeError:
        return error(request, code="INVALID_IMAGE",
                     message="Image could not be decoded", status=400)

    results: list[FaceResult] = []
    for i, face in enumerate(faces):
        identity, score = await _best_match(session, face.embedding)
        results.append(_build_result(i, face, identity, score))

    matched = sum(1 for r in results if r.match_found)
    data = VerifyData(
        total_faces=len(faces),
        matched=matched,
        unmatched=len(faces) - matched,
        results=results,
    )
    return success(request, data.model_dump(), "Verification completed successfully")
