from pydantic import BaseModel, EmailStr, Field

from config import settings


class CaptureRequest(BaseModel):
    display_name: str = Field(
        min_length=1,
        max_length=255,
        description="Human-readable name for the identity.",
    )
    identity_code: str = Field(
        min_length=1,
        max_length=64,
        description="Stable external identifier (e.g. student ID). Must be unique.",
    )
    email: EmailStr = Field(description="Email address. Must be unique.")
    department: str = Field(min_length=1, max_length=255)
    image_base64: str = Field(
        min_length=1,
        description="Single base64-encoded image (data URI prefix accepted) containing exactly one face.",
    )


class CapturedIdentity(BaseModel):
    identity_id: str = Field(description="UUID assigned to the new identity.")
    identity_code: str
    display_name: str
    email: str
    department: str


class VerifyRequest(BaseModel):
    images: list[str] = Field(
        min_length=1,
        max_length=settings.max_images_per_request,
        description=(
            "List of base64-encoded images (data URI prefix accepted). "
            f"Max {settings.max_images_per_request} per request, "
            f"each ≤ {settings.max_image_bytes // (1024 * 1024)} MiB after decoding."
        ),
    )


class MatchedIdentity(BaseModel):
    identity_id: str
    identity_code: str
    display_name: str
    email: str
    department: str


class FaceResult(BaseModel):
    image_index: int = Field(description="Index of the source image in the request.")
    face_index: int = Field(description="Index of the face within that image.")
    bbox: list[float] = Field(
        description="[x1, y1, x2, y2] in resized-image pixel coordinates."
    )
    match_found: bool
    identity: MatchedIdentity | None = None
    confidence: float = Field(description="Cosine similarity in [0, 1].")
    det_score: float = Field(description="Detector confidence in [0, 1].")


class ImageError(BaseModel):
    image_index: int
    code: str = Field(
        description="One of: NO_FACE_DETECTED, INVALID_IMAGE, IMAGE_TOO_LARGE."
    )
    message: str


class VerifyData(BaseModel):
    total_images: int
    total_faces: int
    matched: int
    unmatched: int
    results: list[FaceResult]
    image_errors: list[ImageError] = Field(
        default_factory=list,
        description="Per-image decode/detection errors. Successful images are omitted.",
    )
