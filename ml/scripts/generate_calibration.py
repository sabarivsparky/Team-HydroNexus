"""Generate the SIMULATED calibration dataset.

For each calibration point we:

1. choose a known cumulative dose (ppm·hr) plus temperature / humidity;
2. render a wristband card (reactive strip colour from the simulated chemistry)
   and "photograph" it with random perspective + lighting;
3. run the *same deterministic CV pipeline* used in production to extract
   reference-corrected Lab / Delta-E features.

This mirrors the real workflow (controlled exposure -> photograph -> CV
features) but every colour is simulated.  It must NOT be presented as
physical validation (see KNOWN_LIMITATIONS.md).

Usage:
    python ml/scripts/generate_calibration.py --n 420
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND = REPO_ROOT / "backend"
for p in (str(BACKEND), str(REPO_ROOT)):
    if p not in sys.path:
        sys.path.insert(0, p)

from app.cv.pipeline import process_image, CVError  # noqa: E402
from app.ml import chemistry as chem  # noqa: E402
from ml.simulator.band_simulator import render_card, simulate_photograph  # noqa: E402

CALIBRATION_BAND_ID = "H2S-CAL01"


def _dose_sample(rng: np.random.Generator) -> float:
    """Mix uniform points with extra low-dose density (nonlinear region)."""
    if rng.random() < 0.45:
        return float(rng.uniform(0.0, 12.0))
    return float(rng.uniform(0.0, chem.DOSE_MAX))


def generate(n: int = 420, seed: int = 20260915) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows: list[dict] = []
    attempts = 0
    while len(rows) < n and attempts < n * 3:
        attempts += 1
        dose = round(_dose_sample(rng), 3)
        # Decompose dose into concentration x duration (both plausible).
        duration = float(rng.uniform(1.0, 8.0))
        concentration = max(0.0, dose / duration)
        temp = float(rng.uniform(18.0, 38.0))
        rh = float(rng.uniform(35.0, 85.0))

        card = render_card(
            CALIBRATION_BAND_ID, dose,
            temp_c=temp, rh_pct=rh, expired=False,
            manufactured_on="2026-08-01", expires_on="2026-11-01",
            rng=rng,
        )
        photo_rgb = simulate_photograph(card, rng)
        photo_bgr = cv2.cvtColor(photo_rgb, cv2.COLOR_RGB2BGR)

        try:
            result = process_image(photo_bgr)
        except CVError as exc:
            print(f"  ! calibration image rejected ({exc.code}); regenerating")
            continue

        f = result.features
        rows.append({
            "dose_ppm_hr": dose,
            "concentration_ppm": round(concentration, 3),
            "duration_hours": round(duration, 2),
            "temp_c": round(temp, 1),
            "rh_pct": round(rh, 1),
            "r_rgb": result.strip_rgb[0],
            "g_rgb": result.strip_rgb[1],
            "b_rgb": result.strip_rgb[2],
            "L": f["L"], "a": f["a"], "b_lab": f["b"],
            "delta_e": f["delta_e"],
            "delta_e_env": f["delta_e_env"],
            "correction_residual": result.correction_residual,
            "brightness": result.brightness,
            "blur_score": result.blur_score,
        })

    df = pd.DataFrame(rows)
    return df


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=420)
    ap.add_argument("--seed", type=int, default=20260915)
    ap.add_argument(
        "--out", type=Path,
        default=REPO_ROOT / "ml" / "data" / "calibration_simulated.csv",
    )
    args = ap.parse_args()

    t0 = time.time()
    df = generate(args.n, args.seed)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(args.out, index=False)
    print(f"Wrote {len(df)} calibration rows -> {args.out} "
          f"in {time.time() - t0:.1f}s")
    print(df.describe().round(2).loc[["min", "mean", "max"]].to_string())


if __name__ == "__main__":
    main()
