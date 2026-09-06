"""Decoding raw image bytes into the array both models operate on.

Split out so the same decode is not repeated for detection and for liveness —
each request is decoded exactly once in `api/routes.py`.
"""

import cv2
import numpy as np


def decode(data: bytes) -> np.ndarray | None:
    array = np.frombuffer(data, dtype=np.uint8)
    return cv2.imdecode(array, cv2.IMREAD_COLOR)
