"""Wraps InsightFace's detector + recognizer.

Loaded once at process startup (`core/app.py`'s lifespan) and reused for every
request — the model pack is large enough that loading it per request would
dominate latency.
"""

from dataclasses import dataclass

import numpy as np
from insightface.app import FaceAnalysis

from engine.core.config import settings
from engine.core.logging import logger


@dataclass
class DetectedFace:
    embedding: list[float]
    detection_score: float
    bbox: list[float]


class FaceEngine:
    def __init__(self) -> None:
        self._app: FaceAnalysis | None = None

    def load(self) -> None:
        self._app = FaceAnalysis(
            name=settings.engine_model_pack,
            root=str(settings.engine_model_root),
            providers=settings.engine_providers,
        )
        # ctx_id selects the GPU device for InsightFace's legacy mxnet-style
        # API; -1 means CPU. It does not itself pick the onnxruntime provider
        # — `providers` above does — but it must agree with it or InsightFace
        # tries to talk to a GPU onnxruntime was never given.
        ctx_id = 0 if "CUDAExecutionProvider" in settings.engine_providers else -1
        self._app.prepare(
            ctx_id=ctx_id, det_size=(settings.engine_det_size, settings.engine_det_size)
        )
        logger.info(
            "Face model loaded",
            model_pack=settings.engine_model_pack,
            providers=settings.engine_providers,
        )

    def analyze(self, image: np.ndarray) -> DetectedFace | None:
        """Detect the most prominent face and return its embedding.

        Returns `None` when no face clears `engine_min_detection_score`. Only
        the largest face is used — a kiosk frame is expected to show one
        person, and picking the largest is a simple way to ignore anyone in
        the background.
        """
        if self._app is None:
            raise RuntimeError("FaceEngine.load() was not called")

        faces = self._app.get(image)
        faces = [f for f in faces if f.det_score >= settings.engine_min_detection_score]
        if not faces:
            return None

        face = max(
            faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1])
        )
        return DetectedFace(
            embedding=face.normed_embedding.tolist(),
            detection_score=float(face.det_score),
            bbox=[float(v) for v in face.bbox],
        )


face_engine = FaceEngine()
