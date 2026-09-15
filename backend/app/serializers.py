"""ORM -> API response mappers."""

from __future__ import annotations

import datetime as dt

from app.config import settings


def _date(v):
    if isinstance(v, dt.datetime):
        return v.date()
    return v


def wristband_out(band) -> dict:
    exp = _date(band.expiry_date)
    return {
        "id": band.id,
        "qr_id": band.qr_id,
        "manufacture_date": _date(band.manufacture_date),
        "expiry_date": exp,
        "status": band.status,
        "assigned_worker_id": band.assigned_worker_id,
        "worker_name": band.worker.name if band.worker else None,
        "is_expired": exp < dt.date.today(),
    }


def reading_out(r) -> dict:
    shift_label = r.shift.label if r.shift else None
    return {
        "id": r.id,
        "ref": r.ref,
        "worker_id": r.worker_id,
        "worker_name": r.worker.name if r.worker else None,
        "employee_id": r.worker.employee_id if r.worker else None,
        "department": r.worker.department if r.worker else None,
        "band_qr": r.band.qr_id if r.band else None,
        "shift_label": shift_label,
        "timestamp": r.timestamp,
        "estimated_dose": r.estimated_dose,
        "expiry_status": r.expiry_status,
        "reading_status": r.reading_status,
        "temperature_c": r.temperature_c,
        "humidity_pct": r.humidity_pct,
        "model_version": r.model_version,
        "source": r.source,
        "features": r.features,
        "image_original": r.image_original,
        "image_rectified": r.image_rectified,
        "high_exposure": (
            r.estimated_dose is not None
            and r.estimated_dose >= settings.ACTION_LEVEL_PPM_HR
        ),
    }


def worker_summary(w, today: dt.date) -> dict:
    valid_today = [
        r for r in w.readings
        if r.reading_status == "valid"
        and r.timestamp.date() == today
    ]
    doses = [r.estimated_dose or 0.0 for r in valid_today]
    latest = max(w.readings, key=lambda r: r.timestamp, default=None)
    band = next((b for b in w.wristbands
                 if b.status in ("assigned", "used")), None)
    cumulative = round(sum(doses), 2)
    return {
        "id": w.id,
        "name": w.name,
        "email": w.email,
        "employee_id": w.employee_id,
        "department": w.department,
        "mobile": w.mobile,
        "role": w.role,
        "band_qr": band.qr_id if band else None,
        "band_status": band.status if band else None,
        "band_expiry": _date(band.expiry_date).isoformat() if band else None,
        "today_readings": len(valid_today),
        "today_cumulative_dose": cumulative,
        "latest_dose": latest.estimated_dose if latest else None,
        "latest_status": latest.reading_status if latest else None,
        "latest_timestamp": latest.timestamp if latest else None,
        "status": "DANGER" if cumulative >= settings.ACTION_LEVEL_PPM_HR else "SAFE",
        "action_level": settings.ACTION_LEVEL_PPM_HR,
    }
