"""Model artifact and chemistry/feature sanity checks."""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np

from app.config import settings
from app.ml import chemistry as chem


def test_model_artifact_exists_and_matches_metadata():
    model_path = settings.MODEL_DIR / "model.joblib"
    meta_path = settings.MODEL_DIR / "metadata.json"
    if not model_path.exists():
        import pytest
        pytest.skip("Train the model with ml/scripts/train_model.py")
    pipe = joblib.load(model_path)
    meta = json.loads(meta_path.read_text())
    assert len(meta["features"]) == 5
    x = np.zeros((1, 5))
    assert np.ndim(pipe.predict(x)) == 1
    for model_name, metrics in meta["metrics"].items():
        assert metrics["test_r2"] > 0.85, model_name
        assert metrics["test_mae"] < 8, model_name


def test_chemistry_monotonic_and_bounded():
    doses = [0, 10, 25, 50, 100, 200]
    lightness = []
    for d in doses:
        rgb = chem.strip_color(d)
        lightness.append(float(rgb.mean()))
    assert lightness == sorted(lightness, reverse=True)
    assert float(chem.strip_color(0).mean()) > float(chem.strip_color(200).mean())


def test_reacted_fraction_envelope():
    assert chem.reacted_fraction(0) == 0.0
    assert 0.0 < chem.reacted_fraction(24) < 0.7
    assert chem.reacted_fraction(500) > 0.99


def test_calibration_dataset_present():
    csv = settings.CALIBRATION_CSV
    if not csv.exists():
        import pytest
        pytest.skip("Generate calibration data first")
    import pandas as pd
    df = pd.read_csv(csv)
    assert len(df) >= 200
    for col in ("dose_ppm_hr", "L", "a", "b_lab", "delta_e", "delta_e_env",
                "temp_c", "rh_pct"):
        assert col in df.columns
