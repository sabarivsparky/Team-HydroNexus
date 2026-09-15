# Team-HydroNexus — Passive Colorimetric H₂S Exposure-Dosimeter Wristband

**SIH26118 · Mangalore Refinery and Petrochemicals Limited (MRPL)**

A low-cost, disposable, battery-free **passive H₂S dosimeter** whose cumulative
colour change is read by an ordinary smartphone: deterministic computer vision
(ArUco registration → lighting correction → Lab/ΔE features) feeds an ML
regressor that estimates **cumulative exposure in ppm·hr**, stored against the
worker, wristband, shift and model version via FastAPI + SQL(Alchemy), and
viewed in both a mobile **worker app** and an **admin dashboard**.

> ⚠️ This repository currently contains a **software prototype trained on
> simulated data**. It is not physical validation — see
> [`KNOWN_LIMITATIONS.md`](./KNOWN_LIMITATIONS.md).

---

## What runs end-to-end

```
Synthetic wristband renderer (strip + 7-step reference scale + expiry patch
+ sealed env cell + ArUco markers + QR)
        │  random perspective / white balance / exposure / noise / blur
        ▼
Deterministic OpenCV pipeline  →  corrected sRGB → Lab → ΔE features
        ▼
Trained scikit-learn regressor (Linear / SVR / RandomForest compared)
        ▼
FastAPI (JWT auth, workers, wristbands, readings, reports, model registry)
        ▼
React 19 worker app (login → QR scan → camera capture → ppm·hr result → history)
React 19 admin dashboard (summary, workers, exposure, shifts, danger, reports,
model metrics, band stock)
```

The same synthetic path powers a **Demo Simulator** button in the worker app
when no physical band/camera is available — it renders a photo server-side and
runs the *real* CV + ML chain on it.

## Repository layout

```
Team-HydroNexus/
├── backend/
│   ├── app/
│   │   ├── api/          # auth, workers, bands, readings, admin routers
│   │   ├── cv/           # layout geometry, colour science, CV pipeline, viz
│   │   ├── ml/           # simulated chemistry, trained-model service
│   │   ├── services/     # reading orchestration (CV→ML→DB)
│   │   ├── models.py     # SQLAlchemy schema (SQLite/PostgreSQL)
│   │   ├── schemas.py    # Pydantic contracts
│   │   ├── seed.py       # demo workers / bands / readings / model registry
│   │   └── main.py
│   ├── tests/            # pytest: CV, ML, full API e2e
│   ├── requirements.txt
│   └── .env.example
├── ml/
│   ├── simulator/band_simulator.py   # wristband renderer + photo simulator
│   ├── scripts/generate_calibration.py
│   ├── scripts/train_model.py
│   ├── data/calibration_simulated.csv
│   └── models/{model.joblib, metadata.json}
├── src/
│   ├── worker/           # mobile worker app (scan, camera, result, history)
│   ├── pages/            # admin dashboard pages
│   ├── services/         # typed API client + hooks
│   ├── types/api.ts
│   └── ...
└── KNOWN_LIMITATIONS.md
```

## Quick start (two terminals)

```bash
# 1) Backend — Python 3.11+
cd backend
python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
# (optional) regenerate data + model:
./venv/bin/python ../ml/scripts/generate_calibration.py --n 360
./venv/bin/python ../ml/scripts/train_model.py
./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
#   API docs: http://localhost:8000/docs   (auto-seeds the demo DB)

# 2) Frontend — Node 20+
npm install
npm run dev
#   admin:  http://localhost:5173/login
#   worker: http://localhost:5173/worker/login
```

Vite proxies `/api/*` to `localhost:8000` (override with
`VITE_API_TARGET`). Set `DATABASE_URL` to PostgreSQL in production.

### Demo credentials

| Role  | Email / password |
| ----- | --- |
| Admin | `admin@hydronexus.io` / `admin@1234` |
| Worker (any) | `w1024@hydronexus.io` … `w1035@hydronexus.io` / `worker@1234` |

**Worker demo flow:** log in as `w1024` → *Scan wristband* → enter
`H2S-000013` manually (or scan a rendered QR) → on the capture screen either
take a photo or use the **Demo Simulator** (dose slider) → result with
ppm·hr, ΔE/Lab diagnostics, annotated rectified image → history.
Bands `H2S-000037/38` are seeded expired to show rejection.

## Tests

```bash
cd backend && ./venv/bin/python -m pytest -q
```

Covers colour science & correction, ArUco/region detection, expiry
classification, monotonic dose response, auth/RBAC, prediction persistence,
expired-band rejection and the admin reporting endpoints.

## ML results (simulated data — not field accuracy)

Linear Regression baseline vs SVR vs RandomForest (5-fold CV + 20 % holdout);
the simplest model within 10 % of the best holdout MAE is auto-selected.
Current artifact: **SVR-v1.0**, holdout MAE ≈ 4.1 ppm·hr, R² ≈ 0.94 on
simulated captures over 0–100 ppm·hr, 18–38 °C, 35–85 %RH.
