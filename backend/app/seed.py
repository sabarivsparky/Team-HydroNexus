"""Seed an idempotent demo dataset.

Creates an administrator, workers, wristbands (fresh + expired), historical
readings and calibration records, and registers the trained model version.

Seeded readings derive their feature vectors from the SAME simulated chemistry
that drives the renderer; they are stand-ins until real field data exists
(see KNOWN_LIMITATIONS.md).
"""

from __future__ import annotations

import datetime as dt
import json
import random

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.config import settings
from app.cv.colors import delta_e2000, rgb_to_lab
from app.database import Base, SessionLocal, engine
from app.ml import chemistry as chem
from app.models import (
    CalibrationRecord,
    ModelVersion,
    Reading,
    Shift,
    User,
    Wristband,
)
from app.security import hash_password
from app.services.reading_service import get_or_create_shift
from app.services.model_service import predict_dose, ModelNotReadyError

rng = np.random.default_rng(260915)
random.seed(260915)

BASELINE_LAB = rgb_to_lab(np.array([[chem.STRIP_BASE_SRGB]]))[0, 0]

DEPARTMENTS = [
    "Crude Distillation Unit", "Hydrocracker Unit", "Captive Power Plant",
    "Tank Farm & Dispatch", "Maintenance & Inspection",
    "Safety & Emergency Services", "Quality Control Lab",
]

WORKER_NAMES = [
    ("Santhosh Rao", "9845010101"), ("Arjun Kumar", "9845010202"),
    ("Priya Devi", "9845010303"), ("Mohammed Faisal", "9845010404"),
    ("Kavitha Subramani", "9845010505"), ("Rajesh Nair", "9845010606"),
    ("Deepa Menon", "9845010707"), ("Suresh Babu", "9845010808"),
    ("Anitha Verma", "9845010909"), ("Vijay Krishnan", "9845011010"),
    ("Lakshmi Pillai", "9845011111"), ("Ramesh D'Souza", "9845011212"),
]

DANGER_WORKERS = {2, 8}


def _shift_label(hour: int) -> str:
    if 8 <= hour < 16:
        return "Morning"
    if 16 <= hour < 24:
        return "Afternoon"
    return "Night"


def _features_for(dose: float, temp: float, rh: float) -> dict:
    params = chem.sample_strip_parameters(np.random.default_rng())
    strip = chem.strip_color(dose, temp, rh, theta=params["theta"],
                             base_jitter=params["base_jitter"],
                             noise_sd=2.5)
    # Residual capture/correction noise.
    strip = np.clip(strip + rng.normal(0, 1.2, 3), 0, 255)
    lab = rgb_to_lab(strip.reshape(1, 1, 3))[0, 0]
    env = chem.env_cell_color(temp, rh, noise_sd=1.2)
    lab_env = rgb_to_lab(env.reshape(1, 1, 3))[0, 0]
    return {
        "L": round(float(lab[0]), 4),
        "a": round(float(lab[1]), 4),
        "b": round(float(lab[2]), 4),
        "delta_e": round(delta_e2000(lab, BASELINE_LAB), 4),
        "delta_e_env": round(delta_e2000(lab_env, BASELINE_LAB), 4),
    }


def _register_model(db: Session) -> None:
    meta_path = settings.MODEL_DIR / "metadata.json"
    if not meta_path.exists():
        return
    meta = json.loads(meta_path.read_text())
    existing = db.query(ModelVersion).filter_by(version=meta["version"]).first()
    if existing is None:
        existing = ModelVersion(
            version=meta["version"],
            model_type=meta["model_type"],
            metrics_json=json.dumps(meta.get("metrics", {})),
            simulated_calibration=meta.get("simulated_calibration", True),
            is_active=True,
            notes=f"Trained on {meta.get('n_train', '?')} simulated points; "
                  "replace with real calibration before deployment.",
        )
        db.add(existing)
    db.query(ModelVersion).update({ModelVersion.is_active: False})
    existing.is_active = True
    existing.trained_at = dt.datetime.utcnow()


def _load_calibration(db: Session) -> None:
    if not settings.CALIBRATION_CSV.exists():
        return
    if db.query(CalibrationRecord).count() > 0:
        return
    df = pd.read_csv(settings.CALIBRATION_CSV)
    records = []
    for _, row in df.iterrows():
        records.append(CalibrationRecord(
            dose_ppm_hr=float(row["dose_ppm_hr"]),
            concentration_ppm=float(row.get("concentration_ppm", 0) or 0),
            duration_hours=float(row.get("duration_hours", 0) or 0),
            temp_c=float(row.get("temp_c", 25)),
            rh_pct=float(row.get("rh_pct", 60)),
            features_json=json.dumps({
                "L": float(row["L"]), "a": float(row["a"]),
                "b": float(row["b_lab"]),
                "delta_e": float(row["delta_e"]),
                "delta_e_env": float(row["delta_e_env"]),
            }),
            source="simulated",
        ))
    db.bulk_save_objects(records)


def seed_if_empty(db: Session, force: bool = False) -> bool:
    Base.metadata.create_all(bind=engine)
    if db.query(User).count() > 0 and not force:
        _register_model(db)
        db.commit()
        return False

    if force:
        for model in (Reading, Shift, Wristband, CalibrationRecord,
                      ModelVersion, User):
            db.query(model).delete()
        db.commit()

    # ── Admin ──
    admin = User(
        name="Safety Administrator", email="admin@hydronexus.io",
        employee_id="ADMIN01", hashed_password=hash_password("admin@1234"),
        role="admin", department="HSE",
    )
    db.add(admin)

    # ── Workers ──
    workers = []
    for i, (name, mobile) in enumerate(WORKER_NAMES):
        emp = f"W{1024 + i}"
        workers.append(User(
            name=name, email=f"{emp.lower()}@hydronexus.io", employee_id=emp,
            hashed_password=hash_password("worker@1234"), role="worker",
            department=DEPARTMENTS[i % len(DEPARTMENTS)], mobile=mobile,
        ))
    db.add_all(workers)
    db.flush()

    today = dt.date.today()

    # ── Bands 1..36: used/assigned, cycling three per worker ──
    bands: list[Wristband] = []
    for i in range(1, 37):
        mfg = today - dt.timedelta(days=int(rng.integers(2, 25)))
        bands.append(Wristband(
            qr_id=f"H2S-{i:06d}",
            manufacture_date=dt.datetime.combine(mfg, dt.time.min),
            expiry_date=dt.datetime.combine(
                mfg + dt.timedelta(days=settings.SHELF_LIFE_DAYS), dt.time.min),
            status="used", assigned_worker_id=workers[(i - 1) % 12].id,
        ))

    # ── Expired bands (aging test / rejection demo) ──
    expired_specs = [
        (37, workers[0].id, "invalid"),
        (38, workers[5].id, "assigned"),
        (39, None, "unassigned"),
        (40, None, "unassigned"),
    ]
    for n, wid, status in expired_specs:
        mfg = today - dt.timedelta(days=130)
        bands.append(Wristband(
            qr_id=f"H2S-{n:06d}",
            manufacture_date=dt.datetime.combine(mfg, dt.time.min),
            expiry_date=dt.datetime.combine(mfg + dt.timedelta(days=90),
                                            dt.time.min),
            status=status, assigned_worker_id=wid,
        ))

    # ── Fresh unassigned stock ──
    for n in range(41, 47):
        mfg = today - dt.timedelta(days=2)
        bands.append(Wristband(
            qr_id=f"H2S-{n:06d}",
            manufacture_date=dt.datetime.combine(mfg, dt.time.min),
            expiry_date=dt.datetime.combine(
                mfg + dt.timedelta(days=settings.SHELF_LIFE_DAYS), dt.time.min),
            status="unassigned",
        ))
    db.add_all(bands)
    db.flush()

    # Activate the trained model BEFORE generating readings so history is
    # scored by the real model and tagged with its version.
    _register_model(db)
    db.flush()

    # ── Historical readings (last 7 days) ──
    readings = []
    for wi, worker in enumerate(workers):
        n_readings = int(rng.integers(4, 10))
        worker_bands = [b for b in bands if b.assigned_worker_id == worker.id
                        and b.status == "used"]
        for _ in range(n_readings):
            days_ago = int(rng.integers(0, 7))
            hour = int(rng.choice([7, 9, 11, 13, 17, 19, 22, 2, 5]))
            ts = dt.datetime.combine(today, dt.time(hour=hour % 24)) \
                - dt.timedelta(days=days_ago)
            label = _shift_label(hour % 24)

            if wi in DANGER_WORKERS:
                dose = float(np.clip(rng.gamma(2.2, 7.0), 0.5, 95))
            else:
                dose = float(np.clip(rng.gamma(1.6, 2.4), 0.0, 14))
            temp = float(rng.uniform(22, 36))
            rh = float(rng.uniform(45, 82))
            feats = _features_for(dose, temp, rh)
            try:
                est_dose, version = predict_dose(feats, db)
            except ModelNotReadyError:
                est_dose, version = round(dose, 2), "unseeded-sim"

            shift = get_or_create_shift(db, worker, label, ts.date())
            db.flush()
            readings.append(Reading(
                ref=f"RDG-SEED{len(readings)+1:05d}",
                worker_id=worker.id,
                band_id=random.choice(worker_bands).id,
                shift_id=shift.id,
                timestamp=ts,
                estimated_dose=est_dose,
                expiry_status="VALID",
                reading_status="valid",
                temperature_c=round(temp, 1),
                humidity_pct=round(rh, 1),
                model_version=version,
                source="seed",
                features=feats,
            ))
    db.add_all(readings)

    _load_calibration(db)
    db.commit()
    print(f"Seed complete: {len(workers)} workers, {len(bands)} bands, "
          f"{len(readings)} readings.")
    return True


def main() -> None:
    db = SessionLocal()
    try:
        seed_if_empty(db, force="--force" in __import__("sys").argv)
    finally:
        db.close()


if __name__ == "__main__":
    main()
