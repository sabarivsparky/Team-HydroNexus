"""Reading submission: real photo prediction + synthetic demo capture."""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin, require_worker
from app.database import get_db
from app.models import Reading, User
from app.schemas import PredictionDiagnostics, PredictionResponse, ReadingOut, SimulateReadingRequest
from app.serializers import reading_out
from app.services.reading_service import ReadingError, analyze_bytes, simulate_reading

router = APIRouter(prefix="/readings", tags=["readings"])


def _diagnostics(result) -> PredictionDiagnostics:
    return PredictionDiagnostics(
        band_id_qr=result.band_id_qr,
        expiry_status=result.expiry_status,
        strip_rgb=result.strip_rgb,
        strip_lab=result.strip_lab,
        delta_e=result.delta_e,
        delta_e_env=result.delta_e_env,
        correction_residual=result.correction_residual,
        brightness=result.brightness,
        blur_score=result.blur_score,
        reference_measured=result.reference_measured,
        reference_expected=result.reference_expected,
    )


def _response(reading, result, simulated: bool) -> PredictionResponse:
    if reading.reading_status == "rejected_expired":
        message = ("This wristband has EXPIRED and cannot produce a valid "
                   "reading. Discard it and use a new wristband.")
    else:
        message = "Estimated cumulative H2S exposure calculated."
    return PredictionResponse(
        reading=ReadingOut(**reading_out(reading)),
        estimated_dose=reading.estimated_dose,
        model_version=reading.model_version,
        simulated=simulated,
        message=message,
        diagnostics=_diagnostics(result),
    )


@router.post("/predict", response_model=PredictionResponse)
async def predict_from_photo(
    file: UploadFile = File(...),
    band_qr_id: str | None = Form(None),
    shift_label: str = Form("Morning"),
    temp_c: float | None = Form(None),
    rh_pct: float | None = Form(None),
    db: Session = Depends(get_db),
    worker: User = Depends(require_worker),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(415, "Please upload a JPEG or PNG photograph.")
    image_bytes = await file.read()
    if len(image_bytes) > 12 * 1024 * 1024:
        raise HTTPException(413, "Image is larger than 12 MB.")
    try:
        reading, result = analyze_bytes(
            db, worker, image_bytes,
            band_qr_hint=band_qr_id, shift_label=shift_label,
            temp_c=temp_c, rh_pct=rh_pct, source="photo",
        )
    except ReadingError as exc:
        raise HTTPException(exc.status,
                            {"code": exc.code, "message": exc.message}) from exc
    return _response(reading, result, simulated=False)


@router.post("/simulate", response_model=PredictionResponse)
def simulate_capture(payload: SimulateReadingRequest,
                     db: Session = Depends(get_db),
                     worker: User = Depends(require_worker)):
    """DEMO ONLY: render a synthetic band photo, then run the real CV + ML."""
    try:
        reading, result = simulate_reading(
            db, worker,
            band_qr_id=payload.band_qr_id,
            dose_ppm_hr=payload.dose_ppm_hr,
            temp_c=payload.temp_c,
            rh_pct=payload.rh_pct,
            shift_label=payload.shift_label,
            force_expired=payload.force_expired,
            lighting_strength=payload.lighting_strength,
        )
    except ReadingError as exc:
        raise HTTPException(exc.status,
                            {"code": exc.code, "message": exc.message}) from exc
    return _response(reading, result, simulated=True)


@router.get("", response_model=list[ReadingOut])
def list_readings(
    db: Session = Depends(get_db),
    viewer: User = Depends(get_current_user),
    limit: int = 100,
    worker_id: int | None = None,
    days: int | None = None,
):
    q = db.query(Reading)
    if viewer.role != "admin":
        q = q.filter_by(worker_id=viewer.id)
    elif worker_id:
        q = q.filter_by(worker_id=worker_id)
    if days:
        since = dt.datetime.utcnow() - dt.timedelta(days=days)
        q = q.filter(Reading.timestamp >= since)
    rows = q.order_by(Reading.timestamp.desc()).limit(limit).all()
    return [reading_out(r) for r in rows]


@router.get("/{reading_id}", response_model=ReadingOut)
def get_reading(reading_id: int,
                db: Session = Depends(get_db),
                viewer: User = Depends(get_current_user)):
    r = db.get(Reading, reading_id)
    if r is None:
        raise HTTPException(404, "Reading not found.")
    if viewer.role != "admin" and r.worker_id != viewer.id:
        raise HTTPException(403, "Not permitted.")
    return reading_out(r)


@router.delete("/{reading_id}", status_code=204)
def delete_reading(reading_id: int,
                   db: Session = Depends(get_db),
                   _admin: User = Depends(require_admin)):
    r = db.get(Reading, reading_id)
    if r is None:
        raise HTTPException(404, "Reading not found.")
    db.delete(r)
    db.commit()
