from __future__ import annotations

import base64
import ctypes
import os
import sys
import sysconfig
import threading
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from config import settings


def _register_cuda_dll_dirs() -> None:
    if sys.platform != "win32":
        return
    nvidia = Path(sysconfig.get_paths()["purelib"]) / "nvidia"
    if not nvidia.is_dir():
        return
    # add_dll_directory helps ctypes-style loaders; ONNX Runtime's internal
    # loader ignores it, so also preload every CUDA DLL so LoadLibrary finds
    # them by module name once they're resident in the process.
    for pkg in nvidia.iterdir():
        bin_dir = pkg / "bin"
        if not bin_dir.is_dir():
            continue
        os.add_dll_directory(str(bin_dir))
        for dll in bin_dir.glob("*.dll"):
            try:
                ctypes.WinDLL(str(dll))
            except OSError:
                pass


_register_cuda_dll_dirs()


class NoFaceFound(Exception):
    pass


class ImageDecodeError(Exception):
    pass


@dataclass
class DetectedFace:
    embedding: list[float]
    aligned: np.ndarray
    bbox: tuple[float, float, float, float]


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
    app.prepare(ctx_id=ctx_id, det_size=(settings.detector_size, settings.detector_size))
    return app


def _get_app():
    global _face_app
    if _face_app is not None:
        return _face_app
    with _lock:
        if _face_app is None:
            _face_app = _load_app()
    return _face_app


def _decode(image_base64: str) -> np.ndarray:
    payload = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
    raw = base64.b64decode(payload, validate=False)
    arr = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ImageDecodeError()
    return img


def _resize(img: np.ndarray, max_side: int = 1280) -> np.ndarray:
    h, w = img.shape[:2]
    longest = max(h, w)
    if longest <= max_side:
        return img
    scale = max_side / longest
    return cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)


def _bbox_area(face) -> float:
    return (face.bbox[2] - face.bbox[0]) * (face.bbox[3] - face.bbox[1])


def _build(face, img: np.ndarray) -> DetectedFace:
    from insightface.utils.face_align import norm_crop

    return DetectedFace(
        embedding=face.normed_embedding.astype(float).tolist(),
        aligned=norm_crop(img, landmark=face.kps),
        bbox=tuple(float(x) for x in face.bbox),
    )


def _detect(image_base64: str) -> tuple[list, np.ndarray]:
    img = _resize(_decode(image_base64))
    faces = _get_app().get(img)
    if not faces:
        raise NoFaceFound()
    return faces, img


def detect_largest(image_base64: str) -> DetectedFace:
    faces, img = _detect(image_base64)
    return _build(max(faces, key=_bbox_area), img)


def detect_all(image_base64: str) -> list[DetectedFace]:
    faces, img = _detect(image_base64)
    return [_build(f, img) for f in faces]
