from pydantic import BaseModel, Field


class CaptureRequest(BaseModel):
    display_name: str = Field(min_length=1)
    identity_code: str = Field(min_length=1)
    email: str = Field(min_length=1)
    department: str = Field(min_length=1)
    image_base64: str = Field(min_length=1)


class CapturedIdentity(BaseModel):
    identity_id: str
    identity_code: str
    display_name: str


class VerifyRequest(BaseModel):
    image_base64: str = Field(min_length=1)


class MatchedIdentity(BaseModel):
    identity_id: str
    identity_code: str
    display_name: str
    confidence: float


class FaceResult(BaseModel):
    face_index: int
    bbox: list[float]
    match_found: bool
    identity: MatchedIdentity | None = None
    confidence: float


class VerifyData(BaseModel):
    total_faces: int
    matched: int
    unmatched: int
    results: list[FaceResult]
