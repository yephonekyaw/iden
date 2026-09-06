"""Cheap, no-GPU frame quality scoring.

Used to pick the best of several candidate frames for one enrollment pose
before spending a detection/embedding pass on it. Sharpness and exposure are
the two failure modes a kiosk webcam actually produces — motion blur from a
frame caught mid-movement, and blow-out or underexposure from a badly lit
kiosk corner. Anything sharp and reasonably lit passes; this is not a
liveness or identity signal.
"""

from dataclasses import dataclass

import cv2
import numpy as np

from engine.core.config import settings


@dataclass
class QualityResult:
    score: float
    passed: bool


def score(image: np.ndarray) -> QualityResult:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Laplacian variance: a sharp image has strong edges in every direction,
    # which show up as high variance in the second derivative. A blurred one
    # doesn't. There's no universal unit here — the threshold is tuned
    # against real kiosk frames, not derived from anything.
    sharpness = cv2.Laplacian(gray, cv2.CV_64F).var()
    brightness = float(gray.mean())

    passed = bool(
        sharpness >= settings.engine_min_sharpness
        and settings.engine_min_brightness
        <= brightness
        <= settings.engine_max_brightness
    )
    return QualityResult(score=float(sharpness), passed=passed)
