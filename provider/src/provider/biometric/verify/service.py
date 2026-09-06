"""1:1 verification against a claimed identity."""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from provider.biometric import engine_client
from provider.core.config import settings
from provider.shared.models import FaceEnrollment


@dataclass
class VerifyResult:
    face_found: bool
    match: bool
    liveness_passed: bool
    confidence: float | None


async def verify(session: AsyncSession, user_id: UUID, image: bytes) -> VerifyResult:
    result = await engine_client.process([image], mode="verify")
    if not result.face_found or result.embedding is None:
        return VerifyResult(
            face_found=False, match=False, liveness_passed=False, confidence=None
        )

    distance_expr = FaceEnrollment.embedding.cosine_distance(result.embedding)
    distance = await session.scalar(
        select(distance_expr).where(FaceEnrollment.user_id == user_id)
    )
    matched = (
        distance is not None and distance <= settings.iden_biometric_match_threshold
    )

    return VerifyResult(
        face_found=True,
        match=matched,
        liveness_passed=result.liveness_passed,
        confidence=(1 - distance) if distance is not None else None,
    )
