from __future__ import annotations

import base64
import ctypes
import io
import os
import sys
import sysconfig
import threading
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps

from config import settings


class NoFaceFound(Exception):
    pass


class ImageDecodeError(Exception):
    pass


class ImageTooLarge(Exception):
    pass


@dataclass
class DetectedFace:
    embedding: list[float]
    aligned: np.ndarray
    bbox: tuple[float, float, float, float]
    det_score: float


_lock = threading.Lock()
_face_app = None


def _load_app():
    from insightface.app import FaceAnalysis
    from onnxruntime import get_available_providers

    available = set(get_available_providers())
    providers = [
        p for p in ("CUDAExecutionProvider", "CPUExecutionProvider") if p in available
    ] or ["CPUExecutionProvider"]
    ctx_id = 0 if "CUDAExecutionProvider" in providers else -1
    app = FaceAnalysis(name=settings.insightface_model, providers=providers)
    app.prepare(
        ctx_id=ctx_id, det_size=(settings.detector_size, settings.detector_size)
    )
    return app


def _get_app():
    global _face_app
    if _face_app is not None:
        return _face_app
    with _lock:
        if _face_app is None:
            _face_app = _load_app()
    return _face_app


def warm_up() -> None:
    _get_app()


def decode_image(image_base64: str) -> np.ndarray:
    payload = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
    try:
        raw = base64.b64decode(payload, validate=False)
    except (ValueError, TypeError) as exc:
        raise ImageDecodeError() from exc
    if len(raw) > settings.max_image_bytes:
        raise ImageTooLarge()
    try:
        pil = Image.open(io.BytesIO(raw))
        pil = ImageOps.exif_transpose(pil).convert("RGB")
    except Exception as exc:
        raise ImageDecodeError() from exc
    rgb = np.array(pil)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


def _resize(img: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    longest = max(h, w)
    if longest <= settings.max_image_side:
        return img
    scale = settings.max_image_side / longest
    return cv2.resize(
        img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA
    )


def _bbox_area(face) -> float:
    return (face.bbox[2] - face.bbox[0]) * (face.bbox[3] - face.bbox[1])


def _passes_quality(face) -> bool:
    if float(face.det_score) < settings.min_det_score:
        return False
    w = face.bbox[2] - face.bbox[0]
    h = face.bbox[3] - face.bbox[1]
    return min(w, h) >= settings.min_face_pixels


def _build(face, img: np.ndarray) -> DetectedFace:
    from insightface.utils.face_align import norm_crop

    return DetectedFace(
        embedding=face.normed_embedding.astype(float).tolist(),
        aligned=norm_crop(img, landmark=face.kps),
        bbox=tuple(float(x) for x in face.bbox),
        det_score=float(face.det_score),
    )


def _detect(img: np.ndarray) -> list:
    return [f for f in _get_app().get(img) if _passes_quality(f)]


def detect_largest_in_image(img: np.ndarray) -> DetectedFace:
    """Return the largest qualifying face, or raise NoFaceFound."""
    resized = _resize(img)
    faces = _detect(resized)
    if not faces:
        raise NoFaceFound()
    return _build(max(faces, key=_bbox_area), resized)


def detect_all_in_images(images: list[np.ndarray]) -> list[list[DetectedFace]]:
    """Detect all qualifying faces in each image. Inner list is empty when none found."""
    results: list[list[DetectedFace]] = []
    for img in images:
        resized = _resize(img)
        faces = _detect(resized)
        results.append([_build(f, resized) for f in faces])
    return results
