from fastapi import APIRouter, File, Form, UploadFile

from engine.api.schemas import ProcessMode, ProcessResponse
from engine.core.logging import logger
from engine.models import quality
from engine.models.face_engine import face_engine
from engine.models.image import decode
from engine.models.liveness import liveness_checker

router = APIRouter()

_NO_FACE = ProcessResponse(
    face_found=False, liveness_passed=False, liveness_confidence=0.0
)


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post(
    "/v1/process",
    response_model=ProcessResponse,
    summary="Detect a face, embed it, and check liveness",
)
async def process(
    mode: ProcessMode = Form(...), images: list[UploadFile] = File(...)
) -> ProcessResponse:
    """The only place raw image bytes are decoded.

    Callers with more than one candidate frame for the same shot — e.g. a
    kiosk pose gate that buffers a few frames and lets the engine pick the
    sharpest — send them all here; everyone else sends a list of one. Frames
    are tried best-quality-first until one actually detects a face.

    A missing face or a failed liveness check are ordinary `200` responses,
    not errors — the caller decides what that means for the identity flow it
    is running. This endpoint never looks up or stores an identity; it only
    reports what it saw in one image.
    """
    candidates = []
    for upload in images:
        decoded = decode(await upload.read())
        if decoded is None:
            continue
        candidate_quality = quality.score(decoded)
        if candidate_quality.passed:
            candidates.append((candidate_quality, decoded))
    candidates.sort(key=lambda c: c[0].score, reverse=True)

    for candidate_quality, decoded in candidates:
        detected = face_engine.analyze(decoded)
        if detected is None:
            continue

        passed, confidence = liveness_checker.check(decoded, detected.bbox)
        logger.info(
            "Face processed",
            mode=mode,
            liveness_passed=passed,
            detection_score=detected.detection_score,
            quality_score=candidate_quality.score,
            candidates=len(candidates),
        )
        return ProcessResponse(
            face_found=True,
            liveness_passed=passed,
            liveness_confidence=confidence,
            embedding=detected.embedding,
            detection_score=detected.detection_score,
            quality_score=candidate_quality.score,
        )

    logger.info(
        "No face detected in any candidate", mode=mode, candidates=len(candidates)
    )
    return _NO_FACE
