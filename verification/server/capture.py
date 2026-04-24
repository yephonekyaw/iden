from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from face import ImageDecodeError, NoFaceFound, detect_largest
from models import Identity
from responses import error, success
from schemas import CaptureRequest, CapturedIdentity
from storage import save_capture

router = APIRouter()


@router.post("/capture")
async def capture(
    request: Request,
    body: CaptureRequest,
    session: AsyncSession = Depends(get_session),
):
    try:
        face = detect_largest(body.image_base64)
    except NoFaceFound:
        return error(request, code="NO_FACE_DETECTED",
                     message="No face detected in the image", status=400)
    except ImageDecodeError:
        return error(request, code="INVALID_IMAGE",
                     message="Image could not be decoded", status=400)

    taken = await session.scalar(
        select(Identity).where(Identity.identity_code == body.identity_code)
    )
    if taken is not None:
        return error(request, code="DUPLICATE_IDENTITY",
                     message=f"identity_code '{body.identity_code}' already exists",
                     status=409)

    identity = Identity(
        display_name=body.display_name,
        identity_code=body.identity_code,
        email=body.email,
        department=body.department,
        embedding=face.embedding,
    )
    session.add(identity)
    await session.commit()
    await session.refresh(identity)

    save_capture(identity, face.aligned)

    data = CapturedIdentity(
        identity_id=identity.identity_id,
        identity_code=identity.identity_code,
        display_name=identity.display_name,
    )
    return success(request, data.model_dump(), "Capture stored")
