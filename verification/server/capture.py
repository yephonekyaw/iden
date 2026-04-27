from fastapi import APIRouter, Depends, Request
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from face import (
    ImageDecodeError,
    ImageTooLarge,
    NoFaceFound,
    decode_image,
    detect_largest_in_image,
)
from models import Identity
from responses import error, success
from schemas import CapturedIdentity, CaptureRequest
from storage import delete_capture, save_capture

router = APIRouter(tags=["verification"])


def _classify_integrity_error(exc: IntegrityError) -> tuple[str, str]:
    """Map an IntegrityError to a (code, message) without leaking SQL."""
    raw = str(getattr(exc, "orig", exc)).lower()
    if "identity_code" in raw:
        return "DUPLICATE_IDENTITY", "identity_code already exists"
    if "email" in raw:
        return "DUPLICATE_EMAIL", "email already exists"
    return "DUPLICATE_RESOURCE", "resource already exists"


def _detect(image_b64: str):
    img = decode_image(image_b64)
    return detect_largest_in_image(img)


@router.post(
    "/capture",
    response_model=CapturedIdentity,
    status_code=201,
    summary="Enroll a new identity from a face image",
    description=(
        "Decodes the supplied image, picks the largest qualifying face "
        "(detector confidence ≥ `IDEN_MIN_DET_SCORE`, min side ≥ "
        "`IDEN_MIN_FACE_PIXELS` px), embeds it with ArcFace, and stores the "
        "identity in pgvector plus a local mirror at "
        "`local_store/<identity_id>/`."
    ),
    responses={
        400: {
            "description": "Image could not be decoded, no face detected, or image too large."
        },
        409: {"description": "Identity code or email already exists."},
        500: {"description": "Unexpected server error."},
    },
)
async def capture(
    request: Request,
    body: CaptureRequest,
    session: AsyncSession = Depends(get_session),
):
    try:
        face = await run_in_threadpool(_detect, body.image_base64)
    except NoFaceFound:
        return error(
            request,
            code="NO_FACE_DETECTED",
            message="No face detected in the image",
            status=400,
        )
    except ImageTooLarge:
        return error(
            request,
            code="IMAGE_TOO_LARGE",
            message="Image exceeds maximum allowed size after decoding",
            status=400,
        )
    except ImageDecodeError:
        return error(
            request,
            code="INVALID_IMAGE",
            message="Image could not be decoded",
            status=400,
        )

    identity = Identity(
        display_name=body.display_name,
        identity_code=body.identity_code,
        email=str(body.email),
        department=body.department,
        embedding=face.embedding,
    )

    # await run_in_threadpool(save_capture, identity, face.aligned)

    session.add(identity)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        # await run_in_threadpool(delete_capture, identity.identity_id)
        code, message = _classify_integrity_error(exc)
        return error(request, code=code, message=message, status=409)

    data = CapturedIdentity(
        identity_id=identity.identity_id,
        identity_code=identity.identity_code,
        display_name=identity.display_name,
    )
    return success(request, data.model_dump(), "Capture stored", status=201)
