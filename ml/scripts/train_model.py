"""Train and select the cumulative-dose regression model.

Pipeline (mirrors spec section 21):

    calibration CSV
      -> Linear Regression baseline (MAE / R2)
      -> Random Forest and RBF-SVR comparison (5-fold CV)
      -> select the simplest model within 10 % of the best holdout MAE
      -> persist a joblib pipeline + metadata.json

Usage:
    python ml/scripts/train_model.py
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import KFold, cross_validate
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVR

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT / "backend") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "backend"))

FEATURES = ["L", "a", "b", "delta_e", "delta_e_env"]
TARGET = "dose_ppm_hr"

MODEL_LABELS = {
    "LinearRegression": "LR",
    "RandomForestRegressor": "RF",
    "SVR": "SVR",
}


def load_dataset(path: Path) -> tuple[pd.DataFrame, pd.Series]:
    df = pd.read_csv(path)
    # Avoid colliding raw RGB channel names (r/g/b) with Lab's b* column.
    df = df.rename(columns={"r": "r_rgb", "g": "g_rgb", "b": "blue_rgb",
                            "b_lab": "b"})
    missing = {*FEATURES, TARGET} - set(df.columns)
    if missing:
        raise SystemExit(f"Calibration dataset missing columns: {sorted(missing)}")
    return df[FEATURES].copy(), df[TARGET].copy()


def candidate_models() -> dict:
    return {
        "LinearRegression": Pipeline([("model", LinearRegression())]),
        "RandomForestRegressor": Pipeline([
            ("model", RandomForestRegressor(
                n_estimators=300, min_samples_leaf=2,
                max_depth=14, random_state=42, n_jobs=-1)),
        ]),
        "SVR": Pipeline([
            ("scale", StandardScaler()),
            ("model", SVR(kernel="rbf", C=120.0, gamma="scale", epsilon=1.0)),
        ]),
    }


def mae(y_true, y_pred) -> float:
    return float(np.mean(np.abs(np.asarray(y_true) - np.asarray(y_pred))))


def r2(y_true, y_pred) -> float:
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    ss_res = float(np.sum((y_true - y_pred) ** 2))
    ss_tot = float(np.sum((y_true - y_true.mean()) ** 2)) or 1e-9
    return 1.0 - ss_res / ss_tot


def train(data_path: Path, out_dir: Path, bump: str = "1.0") -> dict:
    X, y = load_dataset(data_path)
    rng = np.random.default_rng(42)
    indices = np.arange(len(X))
    rng.shuffle(indices)
    cut = int(0.8 * len(indices))
    tr, te = indices[:cut], indices[cut:]
    # numpy arrays keep the pickled pipeline free of dataframe feature names.
    Xtr, Xte = X.to_numpy()[tr], X.to_numpy()[te]
    ytr, yte = y.to_numpy()[tr], y.to_numpy()[te]

    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    report = {}
    for name, pipe in candidate_models().items():
        cv = cross_validate(
            pipe, Xtr, ytr, cv=kf,
            scoring=("neg_mean_absolute_error", "r2"), n_jobs=-1,
        )
        pipe.fit(Xtr, ytr)
        pred = np.clip(pipe.predict(Xte), 0, None)
        report[name] = {
            "cv_mae": float(-cv["test_neg_mean_absolute_error"].mean()),
            "cv_r2": float(cv["test_r2"].mean()),
            "test_mae": mae(yte, pred),
            "test_r2": r2(yte, pred),
            "pipeline": pipe,
        }
        print(f"{name:24s}  CV MAE={report[name]['cv_mae']:6.3f}  "
              f"CV R2={report[name]['cv_r2']:5.3f}   holdout MAE="
              f"{report[name]['test_mae']:6.3f}  holdout R2="
              f"{report[name]['test_r2']:5.3f}")

    best_name = min(report, key=lambda k: report[k]["test_mae"])
    best_mae = report[best_name]["test_mae"]
    # Simplicity preference: order LR -> SVR -> RF.
    preference = ["LinearRegression", "SVR", "RandomForestRegressor"]
    chosen = best_name
    for name in preference:
        if name in report and report[name]["test_mae"] <= best_mae * 1.10:
            chosen = name
            break

    pipe = report[chosen]["pipeline"]
    metrics = {k_: {k2: round(v, 4) for k2, v in val.items() if k2 != "pipeline"}
               for k_, val in report.items()}
    label = MODEL_LABELS[chosen]
    version = f"{label}-v{bump}"
    out_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, out_dir / "model.joblib")
    metadata = {
        "model_type": chosen,
        "version": version,
        "features": FEATURES,
        "target": TARGET,
        "target_units": "ppm·hr",
        "metrics": metrics,
        "selected": chosen,
        "n_train": int(len(tr)),
        "n_test": int(len(te)),
        "trained_at": dt.datetime.utcnow().isoformat() + "Z",
        "calibration_source": str(data_path.name),
        "simulated_calibration": True,
    }
    (out_dir / "metadata.json").write_text(json.dumps(metadata, indent=2))
    print(f"\nSelected {chosen} -> {version} (holdout MAE "
          f"{report[chosen]['test_mae']:.3f} ppm·hr, R2 "
          f"{report[chosen]['test_r2']:.3f})")
    print(f"Saved to {out_dir}")
    return metadata


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path,
                    default=REPO_ROOT / "ml" / "data" / "calibration_simulated.csv")
    ap.add_argument("--out", type=Path, default=REPO_ROOT / "ml" / "models")
    ap.add_argument("--bump", default="1.0")
    args = ap.parse_args()
    train(args.data, args.out, args.bump)


if __name__ == "__main__":
    main()
