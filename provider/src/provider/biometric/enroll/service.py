"""Enrolling a face: 5 poses -> engine (one call per pose, in parallel) ->
a single weighted template embedding -> pgvector; the frontal pose's image
goes to object storage as the representative photo. One embedding per user —
re-enrolling overwrites it, the same way changing a password replaces the old
hash rather than keeping every one a person ever had.

Multiple poses exist to build a template that still recognizes someone at a
slight angle, not to run a liveness challenge — the pose-following itself is
a side benefit (a static photo or replay can't naturally produce correct
angle changes on request), not a verified one, since nothing here checks
that the pose kiosk labeled "left" actually looks left. That would need
pose estimation on this end; it isn't done today.
"""

import asyncio
from uuid import UUID

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from provider.biometric import engine_client
from provider.biometric.enroll.errors import (
    EnrollmentUserNotFound,
    FaceAlreadyEnrolled,
    LivenessCheckFailed,
    NoFaceDetected,
)
from provider.core import storage
from provider.core.config import settings
from provider.shared.models import FaceEnrollment, User

# Pose name -> its weight in the combined template. Frontal dominates because
# it's what day-to-day verification actually looks like; the angled poses
# are individually less reliable (partial self-occlusion) so they stay
# minority contributors. Read from settings at call time, not module import,
# so these stay tunable via env vars without code changes.
_POSES = ("frontal", "left", "right", "up", "down")


def _weights() -> dict[str, float]:
    return {
        "frontal": settings.iden_biometric_pose_weight_frontal,
        "left": settings.iden_biometric_pose_weight_left,
        "right": settings.iden_biometric_pose_weight_right,
        "up": settings.iden_biometric_pose_weight_up,
        "down": settings.iden_biometric_pose_weight_down,
    }


async def enroll(
    session: AsyncSession, user_id: UUID, poses: dict[str, list[bytes]]
) -> FaceEnrollment:
    user = await session.get(User, user_id)
    if user is None:
        raise EnrollmentUserNotFound

    results = dict(
        zip(
            _POSES,
            await asyncio.gather(
                *(engine_client.process(poses[pose], mode="enroll") for pose in _POSES)
            ),
            strict=True,
        )
    )

    # Any one pose missing a face or failing liveness short-circuits the
    # whole enrollment — a template built from 4 good poses and one guess is
    # worse than asking the person to retry that one pose.
    for pose, result in results.items():
        if not result.face_found or result.embedding is None:
            raise NoFaceDetected(f"No acceptable frame found for the '{pose}' pose.")
        if not result.liveness_passed:
            raise LivenessCheckFailed(
                f"The '{pose}' pose did not pass the liveness check."
            )

    weights = _weights()
    combined = np.zeros(512)
    for pose, result in results.items():
        assert result.embedding is not None  # narrowed by the loop above
        combined += weights[pose] * np.asarray(result.embedding)

    norm = float(np.linalg.norm(combined))
    if norm == 0.0:
        # All 5 weights were zero, or the embeddings exactly canceled out —
        # either way there is nothing to normalize into a unit vector.
        raise NoFaceDetected("Could not build a template from the enrolled poses.")
    template = (combined / norm).tolist()

    # The worst of the 5, not the average: one bad pose shouldn't be hidden
    # by four good ones for something access-control-relevant. Guaranteed
    # non-None here — every result that reached this point has `face_found`.
    quality = min(
        result.quality_score
        for result in results.values()
        if result.quality_score is not None
    )

    # Nothing else here checks that a face isn't already someone else's —
    # without this, the same physical face could be enrolled under two
    # different accounts and neither `verify` nor `search` would ever notice.
    # Excludes `user_id`'s own row: re-enrolling yourself with a new photo is
    # expected to look like a near-perfect match against your old one.
    distance_expr = FaceEnrollment.embedding.cosine_distance(template)
    existing = (
        await session.execute(
            select(FaceEnrollment.user_id, distance_expr.label("distance"))
            .where(FaceEnrollment.user_id != user_id)
            .order_by(distance_expr)
            .limit(1)
        )
    ).first()
    duplicate_distance = 1 - settings.iden_biometric_duplicate_threshold
    if existing is not None and existing.distance <= duplicate_distance:
        raise FaceAlreadyEnrolled

    # The representative photo is informational only (shown in an admin UI,
    # say) — it is never compared against anything, so it doesn't need to be
    # the exact frame the engine's quality filter picked for the template.
    object_key = f"enrollments/{user_id}.jpg"
    storage.put_image(object_key, poses["frontal"][0])

    enrollment = await session.scalar(
        select(FaceEnrollment).where(FaceEnrollment.user_id == user_id)
    )
    if enrollment is None:
        enrollment = FaceEnrollment(user_id=user_id)
        session.add(enrollment)

    enrollment.embedding = template
    enrollment.quality = quality
    enrollment.image_object_key = object_key
    await session.commit()
    return enrollment
