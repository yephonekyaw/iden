"""1:N identification — "who is this?"

Reused by the biometric login path (`authz/login/routes.py`) as well as the
Biometric RS route in this package, so there is exactly one implementation of
"find the closest enrolled face."
"""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from provider.biometric import engine_client
from provider.core.config import settings
from provider.shared.models import FaceEnrollment


@dataclass
class SearchResult:
    face_found: bool
    matched: bool
    user_id: UUID | None
    liveness_passed: bool
    confidence: float | None


async def identify(session: AsyncSession, image: bytes) -> SearchResult:
    result = await engine_client.process([image], mode="search")
    if not result.face_found or result.embedding is None:
        return SearchResult(
            face_found=False,
            matched=False,
            user_id=None,
            liveness_passed=False,
            confidence=None,
        )

    distance_expr = FaceEnrollment.embedding.cosine_distance(result.embedding)
    row = (
        await session.execute(
            select(FaceEnrollment.user_id, distance_expr.label("distance"))
            .order_by(distance_expr)
            .limit(1)
        )
    ).first()

    if row is None or row.distance > settings.iden_biometric_match_threshold:
        return SearchResult(
            face_found=True,
            matched=False,
            user_id=None,
            liveness_passed=result.liveness_passed,
            confidence=None,
        )

    return SearchResult(
        face_found=True,
        matched=True,
        user_id=row.user_id,
        liveness_passed=result.liveness_passed,
        confidence=1 - row.distance,
    )
