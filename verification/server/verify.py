from fastapi import APIRouter, Depends, Request
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from db import get_session
from face import (
    DetectedFace,
    ImageDecodeError,
    ImageTooLarge,
    decode_image,
    detect_all_in_images,
)
from responses import error, success
from schemas import (
    FaceResult,
    ImageError,
    MatchedIdentity,
    VerifyData,
    VerifyRequest,
)

router = APIRouter(tags=["verification"])


def _vec_literal(v: list[float]) -> str:
    return "[" + ",".join(f"{x:.8f}" for x in v) + "]"


async def _best_matches(
    session: AsyncSession, embeddings: list[list[float]]
) -> list[tuple[str | None, str | None, str | None, str | None, str | None, float | None]]:
    """One round trip: HNSW probe per embedding via LATERAL join."""
    if not embeddings:
        return []
    values_clause = ", ".join(
        f"(CAST(:idx_{i} AS int), CAST(:vec_{i} AS vector))"
        for i in range(len(embeddings))
    )
    stmt = text(
        f"""
        WITH q(idx, vec) AS (VALUES {values_clause})
        SELECT q.idx,
               i.identity_id, i.identity_code, i.display_name, i.email, i.department,
               1 - (i.embedding <=> q.vec) AS score
        FROM q
        LEFT JOIN LATERAL (
            SELECT identity_id, identity_code, display_name, email, department, embedding
            FROM identities
            ORDER BY embedding <=> q.vec
            LIMIT 1
        ) AS i ON true
        ORDER BY q.idx
        """
    )
    params: dict[str, object] = {}
    for i, vec in enumerate(embeddings):
        params[f"idx_{i}"] = i
        params[f"vec_{i}"] = _vec_literal(vec)
    rows = (await session.execute(stmt, params)).all()
    return [
        (r.identity_id, r.identity_code, r.display_name, r.email, r.department, r.score)
        for r in rows
    ]


def _build_result(
    image_index: int,
    face_index: int,
    face: DetectedFace,
    match: tuple[str | None, str | None, str | None, str | None, str | None, float | None],
) -> FaceResult:
    identity_id, identity_code, display_name, email, department, score = match
    confidence = round(float(score), 4) if score is not None else 0.0
    bbox = list(face.bbox)
    if identity_id is None or confidence < settings.match_threshold:
        return FaceResult(
            image_index=image_index,
            face_index=face_index,
            bbox=bbox,
            match_found=False,
            identity=None,
            confidence=confidence,
            det_score=round(face.det_score, 4),
        )
    return FaceResult(
        image_index=image_index,
        face_index=face_index,
        bbox=bbox,
        match_found=True,
        identity=MatchedIdentity(
            identity_id=identity_id,
            identity_code=identity_code or "",
            display_name=display_name or "",
            email=email or "",
            department=department or "",
        ),
        confidence=confidence,
        det_score=round(face.det_score, 4),
    )


def _decode_all(images: list[str]) -> tuple[list, list[ImageError]]:
    """Decode each image; collect per-image errors instead of failing the request."""
    decoded = []
    errors: list[ImageError] = []
    for idx, img_b64 in enumerate(images):
        try:
            decoded.append((idx, decode_image(img_b64)))
        except ImageTooLarge:
            errors.append(
                ImageError(
                    image_index=idx,
                    code="IMAGE_TOO_LARGE",
                    message="Image exceeds maximum allowed size after decoding",
                )
            )
        except ImageDecodeError:
            errors.append(
                ImageError(
                    image_index=idx,
                    code="INVALID_IMAGE",
                    message="Image could not be decoded",
                )
            )
    return decoded, errors


@router.post(
    "/verify",
    response_model=VerifyData,
    status_code=200,
    summary="Match faces in one or more images against the identity database",
    description=(
        "Detects all faces in each provided image and returns the nearest pgvector "
        "match per face (cosine similarity, threshold `IDEN_MATCH_THRESHOLD`). "
        "All face matches are resolved in a single batched SQL round trip via a "
        "LATERAL join against the HNSW index.\n\n"
        "Per-image decode/detection failures are reported in `image_errors` and "
        "do not fail the request; the request only fails if the payload is invalid."
    ),
    responses={
        400: {"description": "Invalid request payload."},
        500: {"description": "Unexpected server error."},
    },
)
async def verify(
    request: Request,
    body: VerifyRequest,
    session: AsyncSession = Depends(get_session),
):
    decoded, image_errors = await run_in_threadpool(_decode_all, body.images)

    if not decoded:
        data = VerifyData(
            total_images=len(body.images),
            total_faces=0,
            matched=0,
            unmatched=0,
            results=[],
            image_errors=image_errors,
        )
        return success(request, data.model_dump(), "Verification completed")

    faces_per_image = await run_in_threadpool(
        detect_all_in_images, [img for _, img in decoded]
    )

    flat: list[tuple[int, int, DetectedFace]] = []
    for (image_index, _img), faces in zip(decoded, faces_per_image, strict=True):
        if not faces:
            image_errors.append(
                ImageError(
                    image_index=image_index,
                    code="NO_FACE_DETECTED",
                    message="No face detected in the image",
                )
            )
            continue
        for face_index, face in enumerate(faces):
            flat.append((image_index, face_index, face))

    matches = await _best_matches(session, [f.embedding for _, _, f in flat])

    results = [
        _build_result(img_idx, face_idx, face, match)
        for (img_idx, face_idx, face), match in zip(flat, matches, strict=True)
    ]

    matched = sum(1 for r in results if r.match_found)
    data = VerifyData(
        total_images=len(body.images),
        total_faces=len(results),
        matched=matched,
        unmatched=len(results) - matched,
        results=results,
        image_errors=image_errors,
    )
    return success(request, data.model_dump(), "Verification completed")
