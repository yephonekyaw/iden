from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import cv2
import numpy as np

from config import settings
from models import Identity

BASE_DIR = Path(__file__).resolve().parent / settings.local_storage_dir


def save_capture(identity: Identity, aligned: np.ndarray) -> None:
    folder = BASE_DIR / identity.identity_id
    folder.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(folder / "face.jpg"), aligned)
    record = {
        "identity_id": identity.identity_id,
        "identity_code": identity.identity_code,
        "display_name": identity.display_name,
        "email": identity.email,
        "department": identity.department,
        "embedding": np.asarray(identity.embedding, dtype=np.float32).tolist(),
        "created_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    (folder / "record.json").write_text(json.dumps(record))
