"""Administrator analytics, model registry and calibration endpoints."""

from __future__ import annotations

import datetime as dt
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.config import settings
from app.database import get_db
from app.models import CalibrationRecord, ModelVersion, Reading, Shift, User, Wristband
from app.services import model_service

router = APIRouter(tags=["admin"])


def _valid_today(db: Session):
    today = dt.datetime.combine(dt.datetime.utcnow().date(), dt.time.min)
    q = db.query(Reading).filter(
        Reading.reading_status == "valid",
        Reading.timestamp >= today,
    )
    return q.all(), today


@router.get("/admin/summary")
def summary(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    readings_today, _ = _valid_today(db)
    doses = [r.estimated_dose or 0.0 for r in readings_today]
    bands = db.query(Wristband).all()
    info = model_service.model_info(db)
    return {
        "total_workers": db.query(User).filter(User.role == "worker").count(),
        "active_bands": sum(1 for b in bands if b.status in ("assigned", "used")),
        "assigned_bands": sum(1 for b in bands if b.status == "assigned"),
        "used_bands": sum(1 for b in bands if b.status == "used"),
        "unassigned_bands": sum(1 for b in bands if b.status == "unassigned"),
        "expired_bands": sum(
            1 for b in bands
            if (b.expiry_date.date() if isinstance(b.expiry_date, dt.datetime)
                else b.expiry_date) < dt.date.today()
        ),
        "invalid_bands": sum(1 for b in bands if b.status == "invalid"),
        "readings_today": len(readings_today),
        "total_readings": db.query(Reading).count(),
        "high_exposure_today": sum(
            1 for d in doses if d >= settings.ACTION_LEVEL_PPM_HR),
        "cumulative_dose_today": round(sum(doses), 2),
        "average_dose_today": round(sum(doses) / len(doses), 2) if doses else 0.0,
        "max_dose_today": round(max(doses), 2) if doses else 0.0,
        "action_level": settings.ACTION_LEVEL_PPM_HR,
        "active_model": info["version"],
        "model_ready": info["ready"],
        "simulated_calibration": info["simulated_calibration"],
    }


@router.get("/admin/trends")
def trends(days: int = 14,
           db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    since = dt.datetime.combine(dt.date.today() - dt.timedelta(days=days - 1),
                                dt.time.min)
    rows = db.query(Reading).filter(
        Reading.reading_status == "valid",
        Reading.timestamp >= since,
    ).all()
    by_day: dict[str, list[float]] = {}
    for r in rows:
        key = r.timestamp.date().isoformat()
        by_day.setdefault(key, []).append(r.estimated_dose or 0.0)
    out = []
    for i in range(days):
        day = (dt.date.today() - dt.timedelta(days=days - 1 - i)).isoformat()
        vals = by_day.get(day, [])
        out.append({
            "date": day,
            "readings": len(vals),
            "average_dose": round(sum(vals) / len(vals), 2) if vals else 0.0,
            "max_dose": round(max(vals), 2) if vals else 0.0,
            "high_exposure": sum(
                1 for v in vals if v >= settings.ACTION_LEVEL_PPM_HR),
        })
    return out


@router.get("/admin/reports")
def reports(days: int = 7,
            db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    since = dt.datetime.combine(dt.date.today() - dt.timedelta(days=days - 1),
                                dt.time.min)
    workers = db.query(User).filter(User.role == "worker").order_by(
        User.employee_id).all()
    out = []
    for w in workers:
        rs = [r for r in w.readings
              if r.reading_status == "valid" and r.timestamp >= since]
        doses = [r.estimated_dose or 0.0 for r in rs]
        latest = max(w.readings, key=lambda r: r.timestamp, default=None)
        band = next((b for b in w.wristbands
                     if b.status in ("assigned", "used")), None)
        out.append({
            "worker_id": w.id,
            "employee_id": w.employee_id,
            "name": w.name,
            "department": w.department,
            "band_qr": band.qr_id if band else None,
            "shift_label": latest.shift.label if latest and latest.shift else None,
            "readings": len(rs),
            "cumulative_dose": round(sum(doses), 2),
            "max_dose": round(max(doses), 2) if doses else 0.0,
            "average_dose": round(sum(doses) / len(doses), 2) if doses else 0.0,
            "latest_status": (
                "HIGH" if latest and latest.estimated_dose
                and latest.estimated_dose >= settings.ACTION_LEVEL_PPM_HR
                else (latest.reading_status if latest else "none")
            ),
        })
    return out


@router.get("/admin/shifts/today")
def shifts_today(db: Session = Depends(get_db),
                 _admin: User = Depends(require_admin)):
    today = dt.datetime.combine(dt.date.today(), dt.time.min)
    rows = db.query(Reading).filter(Reading.timestamp >= today).all()
    labels = ["Morning", "Afternoon", "Night"]
    out = []
    for label in labels:
        rs = [r for r in rows if r.shift and r.shift.label == label
              and r.reading_status == "valid"]
        doses = [r.estimated_dose or 0.0 for r in rs]
        out.append({
            "shift": label,
            "readings": len(rs),
            "cumulative_dose": round(sum(doses), 2),
            "average_dose": round(sum(doses) / len(doses), 2) if doses else 0.0,
            "max_dose": round(max(doses), 2) if doses else 0.0,
            "high_exposure": sum(
                1 for d in doses if d >= settings.ACTION_LEVEL_PPM_HR),
        })
    return out


# ─── Model registry ──────────────────────────────────────────

@router.get("/models")
def list_models(db: Session = Depends(get_db),
                _admin: User = Depends(require_admin)):
    rows = db.query(ModelVersion).order_by(ModelVersion.trained_at.desc()).all()
    disk = model_service.model_info(db)
    return [{
        "id": m.id,
        "version": m.version,
        "model_type": m.model_type,
        "is_active": m.is_active,
        "simulated_calibration": m.simulated_calibration,
        "trained_at": m.trained_at,
        "metrics": json.loads(m.metrics_json) if m.metrics_json else None,
        "on_disk": m.version == disk["version"],
    } for m in rows]


@router.post("/models/{version}/activate")
def activate_model(version: str,
                   db: Session = Depends(get_db),
                   _admin: User = Depends(require_admin)):
    m = db.query(ModelVersion).filter_by(version=version).first()
    if m is None:
        raise HTTPException(404, "Unknown model version.")
    db.query(ModelVersion).update({ModelVersion.is_active: False})
    m.is_active = True
    db.commit()
    return {"active": m.version}


# ─── Calibration data ────────────────────────────────────────

@router.get("/calibration")
def calibration_points(limit: int = 500,
                       db: Session = Depends(get_db),
                       _admin: User = Depends(require_admin)):
    rows = (db.query(CalibrationRecord)
            .order_by(CalibrationRecord.dose_ppm_hr)
            .limit(limit).all())
    return [{
        "id": r.id,
        "dose_ppm_hr": r.dose_ppm_hr,
        "concentration_ppm": r.concentration_ppm,
        "duration_hours": r.duration_hours,
        "temp_c": r.temp_c,
        "rh_pct": r.rh_pct,
        "source": r.source,
        "features": json.loads(r.features_json) if r.features_json else {},
    } for r in rows]
