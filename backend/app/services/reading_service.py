"""Orchestrates CV -> ML -> persistence for one wristband photograph."""

from __future__ import annotations

import datetime as dt
import uuid

import cv2
import numpy as np
from sqlalchemy.orm import Session

from app.config import settings
from app.cv.pipeline import CVError, process_file_bytes
from app.cv.visualize import annotate
from app.ml import chemistry as chem
from app.models import Reading, Shift, User, Wristband
from app.services.model_service import ModelNotReadyError, predict_dose

import sys
from pathlib import Path
_REPO = Path(__file__).resolve().parents[3]
if str(_REPO) not in sys.path:
    sys.path.insert(0, str(_REPO))
from ml.simulator.band_simulator import render_card, simulate_photograph  # noqa: E402


class ReadingError(Exception):
    def __init__(self, code: str, message: str, status: int = 422):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


# ─── Helpers ─────────────────────────────────────────────────

def _today() -> dt.date:
    return dt.datetime.utcnow().date()


def band_is_expired(band: Wristband) -> bool:
    exp = band.expiry_date
    if isinstance(exp, dt.datetime):
        exp = exp.date()
    return exp < _today()


def _as_date(value) -> dt.date:
    return value.date() if isinstance(value, dt.datetime) else value


def get_or_create_shift(db: Session, worker: User, label: str,
                        day: dt.date) -> Shift:
    start = dt.datetime.combine(day, dt.time.min)
    shift = (
        db.query(Shift)
        .filter_by(worker_id=worker.id, label=label, shift_date=start)
        .first()
    )
    if shift is None:
        shift = Shift(worker_id=worker.id, label=label, shift_date=start,
                      start_time=dt.datetime.utcnow())
        db.add(shift)
        db.flush()
    return shift


def _new_ref() -> str:
    return f"RDG-{dt.datetime.utcnow():%y%m%d}-{uuid.uuid4().hex[:6].upper()}"


def _save_images(ref: str, original_bytes: bytes, result) -> tuple[str, str]:
    orig_name = f"{ref}_orig.jpg"
    rect_name = f"{ref}_rect.jpg"
    (settings.UPLOAD_DIR / orig_name).write_bytes(original_bytes)
    annotated = annotate(result.rectified_rgb, result.detected_centers,
                         result.expiry_status)
    cv2.imwrite(
        str(settings.UPLOAD_DIR / rect_name),
        cv2.cvtColor(annotated, cv2.COLOR_RGB2BGR),
    )
    return f"/api/uploads/{orig_name}", f"/api/uploads/{rect_name}"


def _resolve_band(db: Session, qr_hint: str | None,
                  qr_detected: str | None) -> Wristband:
    qr = (qr_detected or qr_hint or "").strip().upper()
    if not qr:
        raise ReadingError(
            "QR_NOT_DETECTED",
            "No QR identifier was found. Rescan the wristband or enter the band ID.",
            status=400,
        )
    if qr_detected and qr_hint and qr_detected.strip().upper() != qr_hint.strip().upper():
        raise ReadingError(
            "QR_MISMATCH",
            "The photographed band does not match the scanned QR code. Re-scan and retry.",
        )
    band = db.query(Wristband).filter_by(qr_id=qr).first()
    if band is None:
        raise ReadingError(
            "BAND_NOT_RECOGNIZED",
            f"Wristband {qr} is not registered in the system.", status=404,
        )
    return band


# ─── Core analysis ───────────────────────────────────────────

def analyze_bytes(
    db: Session,
    worker: User,
    image_bytes: bytes,
    *,
    band_qr_hint: str | None = None,
    shift_label: str = "Morning",
    temp_c: float | None = None,
    rh_pct: float | None = None,
    source: str = "photo",
) -> tuple[Reading, object]:
    try:
        result = process_file_bytes(image_bytes)
    except CVError as exc:
        raise ReadingError(exc.code, exc.message) from exc

    band = _resolve_band(db, band_qr_hint, result.band_id_qr)

    if band.assigned_worker_id not in (None, worker.id):
        raise ReadingError(
            "BAND_ASSIGNED_OTHER",
            f"{band.qr_id} is assigned to another worker and cannot be used here.",
            status=403,
        )
    if band.status == "invalid":
        raise ReadingError(
            "BAND_INVALID",
            f"{band.qr_id} has been invalidated and cannot produce a reading.",
            status=409,
        )

    ref = _new_ref()
    orig_path, rect_path = _save_images(ref, image_bytes, result)

    db_expired = band_is_expired(band)
    final_expiry = "EXPIRED" if (db_expired or result.expiry_status == "EXPIRED") else "VALID"

    reading = Reading(
        ref=ref,
        worker_id=worker.id,
        band_id=band.id,
        timestamp=dt.datetime.utcnow(),
        expiry_status=final_expiry,
        reading_status="valid",
        temperature_c=temp_c,
        humidity_pct=rh_pct,
        source=source,
        features=result.features,
        cv_quality_json=str({
            "brightness": result.brightness,
            "blur_score": result.blur_score,
            "correction_residual": result.correction_residual,
            "expiry_confidence": result.expiry_confidence,
            "strip_lab": result.strip_lab,
            "strip_rgb": result.strip_rgb,
        }),
        image_original=orig_path,
        image_rectified=rect_path,
    )

    if final_expiry == "EXPIRED":
        reading.estimated_dose = None
        reading.reading_status = "rejected_expired"
        reading.model_version = None
        band.status = "invalid"
    else:
        shift = get_or_create_shift(db, worker, shift_label, _today())
        reading.shift_id = shift.id
        try:
            dose, version = predict_dose(result.features, db)
        except ModelNotReadyError as exc:
            raise ReadingError("MODEL_NOT_READY", str(exc), status=503) from exc
        reading.estimated_dose = dose
        reading.model_version = version
        band.status = "used"

    if band.assigned_worker_id is None:
        band.assigned_worker_id = worker.id
        band.status = band.status if band.status == "invalid" else "assigned"

    db.add(reading)
    db.commit()
    db.refresh(reading)
    return reading, result


# ─── Synthetic demo capture ──────────────────────────────────

def simulate_reading(
    db: Session,
    worker: User,
    *,
    band_qr_id: str,
    dose_ppm_hr: float | None,
    temp_c: float,
    rh_pct: float,
    shift_label: str,
    force_expired: bool,
    lighting_strength: float = 1.0,
) -> tuple[Reading, object]:
    band = db.query(Wristband).filter_by(
        qr_id=band_qr_id.strip().upper()).first()
    if band is None:
        raise ReadingError(
            "BAND_NOT_RECOGNIZED",
            f"Wristband {band_qr_id} is not registered in the system.", 404,
        )

    rng = np.random.default_rng()
    expired = force_expired or band_is_expired(band)
    dose = float(rng.uniform(0, chem.DOSE_MAX)) if dose_ppm_hr is None else float(
        max(0.0, dose_ppm_hr))

    mfg = band.manufacture_date
    exp = band.expiry_date
    card = render_card(
        band.qr_id,
        dose,
        temp_c=temp_c,
        rh_pct=rh_pct,
        expired=expired,
        manufactured_on=_as_date(mfg).strftime("%Y-%m-%d"),
        expires_on=_as_date(exp).strftime("%Y-%m-%d"),
        rng=rng,
    )
    photo = simulate_photograph(card, rng, lighting_strength=lighting_strength)
    ok, buffer = cv2.imencode(".jpg", cv2.cvtColor(photo, cv2.COLOR_RGB2BGR),
                              [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    return analyze_bytes(
        db, worker, buffer.tobytes(),
        band_qr_hint=band.qr_id, shift_label=shift_label,
        temp_c=temp_c, rh_pct=rh_pct, source="simulated",
    )
