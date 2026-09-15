"""Wrapper around the trained joblib regression model + metadata."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np

from app.config import settings
from app.models import ModelVersion


class ModelNotReadyError(RuntimeError):
    pass


@lru_cache(maxsize=2)
def _load_from_disk(model_dir_str: str):
    model_dir = Path(model_dir_str)
    model_path = model_dir / "model.joblib"
    meta_path = model_dir / "metadata.json"
    if not model_path.exists():
        return None, None
    pipe = joblib.load(model_dir / "model.joblib")
    meta = json.loads(meta_path.read_text())
    return pipe, meta


def get_active_model(db):
    """Return ``(pipeline, metadata, db_row)`` for the active model version."""
    row = db.query(ModelVersion).filter_by(is_active=True).first()
    pipe, meta = _load_from_disk(str(settings.MODEL_DIR))
    if pipe is None or row is None:
        return None, meta, row
    return pipe, meta, row


def model_info(db) -> dict:
    _pipe, meta, row = get_active_model(db)
    return {
        "version": row.version if row else (meta or {}).get("version", "not-trained"),
        "simulated_calibration": bool(
            (meta or {}).get("simulated_calibration", True)),
        "metrics": (meta or {}).get("metrics", {}),
        "features": (meta or {}).get("features", []),
        "ready": _pipe is not None and row is not None,
    }


def predict_dose(features: dict[str, float], db) -> tuple[float, str]:
    """Estimate cumulative dose (ppm·hr) from CV feature vector."""
    pipe, meta, row = get_active_model(db)
    if pipe is None:
        raise ModelNotReadyError(
            "The dose model is not trained yet. Run the training pipeline first.")
    feats = meta["features"]
    vector = np.array([[float(features.get(name, 0.0)) for name in feats]],
                      dtype=np.float64)
    raw = float(pipe.predict(vector)[0])
    return max(0.0, round(raw, 3)), row.version
