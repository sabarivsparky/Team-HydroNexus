#!/usr/bin/env bash
# Create the backend virtualenv (if needed), install dependencies and start
# the FastAPI server. Safe to re-run.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/backend"

if [ ! -x ./venv/bin/python ]; then
  echo "[setup] creating virtual environment…"
  python3 -m venv venv
  ./venv/bin/pip install --upgrade pip
  ./venv/bin/pip install -r requirements.txt
fi

# Generate the simulated calibration set + model only if missing.
if [ ! -f "$ROOT/ml/models/model.joblib" ]; then
  echo "[setup] generating simulated calibration data…"
  ./venv/bin/python "$ROOT/ml/scripts/generate_calibration.py" --n 360
  echo "[setup] training regression models…"
  ./venv/bin/python "$ROOT/ml/scripts/train_model.py"
fi

echo "[setup] starting API on http://0.0.0.0:8000 (docs at /docs)"
exec ./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
