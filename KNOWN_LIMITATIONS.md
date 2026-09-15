# Known Limitations & Prototype Status

This document is mandatory for the H₂S exposure-dosimeter project. Every
placeholder, simulated component and unvalidated claim is recorded here so the
prototype is never mistaken for a certified occupational safety device.

**Last updated:** 2026-09-15 · Prototype milestone (software vertical slice)

---

## 1. Simulated calibration data (most important limitation)

- The regression model (`ml/models/model.joblib`, **SVR-v1.0**) is trained on
  a **fully simulated** dataset (`ml/data/calibration_simulated.csv`, 360 points).
- Each point is produced by:
  1. a **simulated chemical colour-response model** (`backend/app/ml/chemistry.py`),
  2. a **synthetically rendered wristband photo** with random perspective,
     white balance, exposure, vignetting, noise and blur
     (`ml/simulator/band_simulator.py`),
  3. the **real deterministic CV pipeline** (`backend/app/cv/`) extracting
     reference-corrected Lab / ΔE features.
- This validates the **software/ML pipeline only**. It is **not** experimental
  validation of the lead-acetate (or other) H₂S strip. Reported metrics
  (holdout MAE ≈ 4.1 ppm·hr, R² ≈ 0.94) describe recovery on synthetic data and
  must not be presented as field accuracy.
- Seeded historical readings in the demo database come from the same simulated
  chemistry (`source = "seed"`) and are clearly marked as such.

## 2. Unvalidated physical chemistry

- No reactive strip has been manufactured or exposed to known H₂S
  concentrations. The colour anchors (cream → dark brown/black), saturation
  constant (θ = 24 ppm·hr), temperature/humidity rate multipliers and
  manufacturing variance are plausible placeholders, not measurements.
- A real calibration campaign must cover concentration × duration × lighting
  × temperature × humidity × strip-batch variation (spec §19–24, §40, §42).

## 3. Shelf-life / expiry patch is a simulated mechanism

- The expiry patch is rendered green "VALID" / red "EXPIRED" and classified in
  Lab colour space. The 90-day shelf-life value (`SHELF_LIFE_DAYS`) is a
  **claim requiring aging validation** (spec §41). No time-based chemical
  indicator chemistry exists yet.
- Database expiry dates are calendar-based; the optical patch is the
  worker-facing mechanism and is 100 % reliable only against rendered images.

## 4. Sealed environmental reference cell

- The optional sealed cell is rendered and its optical drift
  (`delta_e_env`) is used as a model feature, but its drift response is
  simulated. It has not been built, and its value as a T/RH compensator is
  unproven. Temperature/humidity supplied to the API are manual inputs.

## 5. Computer-vision scope

- Region registration assumes four ArUco (DICT_4X4_50) fiducial markers printed
  on the card, with a contour fallback that is less precise. Real print
  resolution, marker damage, occlusion, motion blur, strong shadows and
  non-uniform lighting will reduce detection rates.
- The lighting correction is a per-channel affine model fit to a 7-step
  **neutral grey** ramp. It handles gain/white-balance/offset shifts but not
  arbitrary spectral casts or non-linear camera response curves.
- JPEG compression, autofocus and HDR processing on real phones are not yet
  characterized. Synthetic-photo rejection rate during calibration generation
  (~a few %) indicates headroom but not field robustness.
- No deep-learned detectors are used (intentional, per spec).

## 6. Camera and platform

- Camera access uses the browser `getUserMedia()` API; it requires HTTPS
  (except localhost) and user permission. On unsupported/denied cameras the
  worker app offers a **Demo Simulator** that renders a synthetic photo
  server-side and still runs the genuine CV + ML chain.
- Browser QR decoding (jsQR) works on live video frames; very small/damaged QR
  codes may need manual band-ID entry (supported in the UI).

## 7. Model limitations

- A single deterministic model with no uncertainty/confidence interval is
  exposed. The UI always labels outputs as **estimates**.
- The model saturates near 100 ppm·hr (calibration range); values outside the
  training envelope are extrapolations.
- Model approval/activation is manual in the admin UI, but automatic retraining
  endpoints are not implemented (training is a script, spec §38).
- No per-strip-batch calibration or drift correction exists yet.

## 8. Backend / security placeholders

- Demo credentials are seeded (`admin@hydronexus.io / admin@1234`, workers
  `w10xx@hydronexus.io / worker@1234`). **Change before any deployment.**
- SQLite is used for development; models are PostgreSQL-compatible but
  migrations are handled by `create_all` (no Alembic versioning yet).
- CORS allows all origins in development for demo convenience; lock this down
  (`app/config.py`) for production.
- JWT secret auto-generates per process if `JWT_SECRET` is unset — fine for
  demos, invalidates tokens on restart; set a persistent secret in production.
- No rate limiting, refresh-token rotation, or audit log yet.

## 9. Reporting is not regulatory certification

- Reports and CSV exports follow a daily HSE exposure-register style inspired
  by DGMS/OISD conventions. They are **not** official statutory reports and
  the system makes no claim of regulatory approval (spec §33).

## 10. Deployment status

- Frontend (Vite/React) and FastAPI are configured for local development with a
  dev proxy. Production deployment to Vercel + Render/Railway still needs
  environment configuration, a managed PostgreSQL and HTTPS.

---

## Replacing the simulation (path to a validated device)

1. Controlled H₂S exposures: known `concentration × duration`, photograph
   with the real printed card and strip → replace CSV via the same column
   schema (`ml/scripts/generate_calibration.py` documents columns).
2. Retrain: `python ml/scripts/train_model.py`, compare MAE/R², register &
   activate the new version without auto-replacing production.
3. Aging study (day 0/15/30/…): validate the expiry patch and shelf-life claim.
4. Environmental matrix study: determine whether
   `Colour = f(Dose)` or `Colour = f(Dose, T, RH)` is required.
5. Lighting/camera inter-op study across ≥3 phones.
6. Re-run `pytest` and add regression fixtures from real photos.
