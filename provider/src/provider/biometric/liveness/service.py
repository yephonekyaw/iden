"""Liveness only — no identity is looked up or compared."""

from dataclasses import dataclass

from provider.biometric import engine_client


@dataclass
class LivenessResult:
    face_found: bool
    liveness_passed: bool
    confidence: float


async def check(image: bytes) -> LivenessResult:
    result = await engine_client.process([image], mode="liveness")
    return LivenessResult(
        face_found=result.face_found,
        liveness_passed=result.liveness_passed,
        confidence=result.liveness_confidence,
    )
