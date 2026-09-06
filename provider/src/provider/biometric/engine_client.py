"""Async HTTP client for the internal biometric engine.

The only place in the provider that sends raw image bytes onward — nothing
else here decodes pixels, per the root README's architecture. See
`engine/README.md` for what runs on the other end and
`claude_code_prompt/API_CONTRACT.md` for the wire shape this assumes.
"""

from typing import Literal

import httpx
from pydantic import BaseModel

from provider.core.config import settings

Mode = Literal["enroll", "verify", "search", "liveness"]


class EngineResult(BaseModel):
    face_found: bool
    liveness_passed: bool
    liveness_confidence: float
    embedding: list[float] | None = None
    detection_score: float | None = None
    quality_score: float | None = None


class EngineUnavailable(Exception):
    """The engine could not be reached or answered with something unusable.

    Handled the same way as an unreachable Postgres or Redis — see
    `core/app.py`'s `UNAVAILABLE` handler — because from the provider's
    perspective that is exactly what this is: a dependency it cannot serve a
    request without.
    """


async def process(images: list[bytes], *, mode: Mode) -> EngineResult:
    """`images` are candidate frames of the *same* shot — the engine picks
    whichever is sharpest and still detects a face. Everything but enrollment
    sends a single-item list."""
    files = [
        ("images", (f"frame-{i}.jpg", image, "image/jpeg"))
        for i, image in enumerate(images)
    ]
    try:
        async with httpx.AsyncClient(
            base_url=settings.iden_engine_base_url, timeout=10.0
        ) as client:
            response = await client.post(
                "/v1/process", data={"mode": mode}, files=files
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise EngineUnavailable(str(exc)) from exc

    return EngineResult.model_validate(response.json())
