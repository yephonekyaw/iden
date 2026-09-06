"""Passive liveness / anti-spoofing.

InsightFace has no liveness model of its own, so this wraps a separate
ONNX model (a MiniFASNet-style passive-liveness classifier is the common
choice — see claude_code_prompt/PERSON_B_ENGINE.md for where to get one).

Stubbed until a real model is configured: with `engine_liveness_enabled`
false (the default), every check passes with confidence 1.0. That is
deliberate — it lets the enroll/verify/search pipeline be exercised end to
end before a liveness model has been sourced, rather than blocking on it.
Never leave it this way for anything called an authentication.
"""

import numpy as np
import onnxruntime as ort

from engine.core.config import settings
from engine.core.logging import logger


class LivenessChecker:
    def __init__(self) -> None:
        self._session: ort.InferenceSession | None = None

    def load(self) -> None:
        if not settings.engine_liveness_enabled:
            logger.warning(
                "Liveness check disabled — every check will pass. Set "
                "ENGINE_LIVENESS_ENABLED=true with a real model before "
                "relying on this for authentication."
            )
            return

        if settings.engine_liveness_model_path is None:
            raise RuntimeError(
                "ENGINE_LIVENESS_ENABLED is true but "
                "ENGINE_LIVENESS_MODEL_PATH is not set."
            )
        self._session = ort.InferenceSession(
            str(settings.engine_liveness_model_path),
            providers=settings.engine_providers,
        )
        logger.info(
            "Liveness model loaded", path=str(settings.engine_liveness_model_path)
        )

    def check(self, image: np.ndarray, bbox: list[float]) -> tuple[bool, float]:
        """Whether the face at `bbox` in `image` looks live.

        `bbox` is reused from the detector rather than re-detected, since the
        same frame and the same face are already known.
        """
        if self._session is None:
            return True, 1.0

        crop = _crop(image, bbox)
        if crop.size == 0:
            return False, 0.0

        input_meta = self._session.get_inputs()[0]
        tensor = _preprocess(crop, input_meta.shape)
        outputs = self._session.run(None, {input_meta.name: tensor})
        # A classification model's output is always dense; onnxruntime's
        # return type is a broader union only because some models produce a
        # SparseTensor.
        output = np.asarray(outputs[0])

        # MiniFASNet-style models output [spoof_score, live_score]. Adjust
        # this line if the chosen model's output layout differs.
        live_score = float(output[0][1])
        return live_score >= settings.engine_liveness_threshold, live_score


def _crop(image: np.ndarray, bbox: list[float]) -> np.ndarray:
    x1, y1, x2, y2 = (max(0, int(v)) for v in bbox)
    return image[y1:y2, x1:x2]


def _preprocess(crop: np.ndarray, input_shape: list) -> np.ndarray:
    import cv2

    _, _, height, width = input_shape
    resized = cv2.resize(crop, (width, height))
    return resized.astype(np.float32).transpose(2, 0, 1)[None, ...]


liveness_checker = LivenessChecker()
