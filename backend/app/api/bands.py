"""Wristband registration, lookup and assignment."""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin, require_worker
from app.config import settings
from app.database import get_db
from app.models import User, Wristband
from app.schemas import BandAssign, WristbandBatch, WristbandRegister
from app.serializers import wristband_out

router = APIRouter(prefix="/bands", tags=["wristbands"])


@router.get("")
def list_bands(db: Session = Depends(get_db),
               _admin: User = Depends(require_admin),
               status: str | None = None):
    q = db.query(Wristband)
    if status:
        q = q.filter_by(status=status)
    bands = q.order_by(Wristband.qr_id).all()
    return [wristband_out(b) for b in bands]


@router.post("", status_code=201)
def register_band(payload: WristbandRegister,
                  db: Session = Depends(get_db),
                  _admin: User = Depends(require_admin)):
    qr = payload.qr_id.strip().upper()
    if db.query(Wristband).filter_by(qr_id=qr).first():
        raise HTTPException(409, f"{qr} is already registered.")
    today = dt.date.today()
    mfg = payload.manufacture_date or today
    exp = payload.expiry_date or (
        mfg + dt.timedelta(days=payload.shelf_life_days))
    band = Wristband(qr_id=qr, manufacture_date=mfg, expiry_date=exp,
                     status="unassigned")
    db.add(band)
    db.commit()
    db.refresh(band)
    return wristband_out(band)


@router.post("/batch", status_code=201)
def register_batch(payload: WristbandBatch,
                   db: Session = Depends(get_db),
                   _admin: User = Depends(require_admin)):
    existing = {b.qr_id for b in db.query(Wristband).all()}
    created = []
    today = dt.date.today()
    # Continue numbering after the highest existing numeric suffix.
    start = 1 + len(existing)
    for i in range(payload.count):
        qr = f"{payload.prefix}{start + i:06d}"
        if qr in existing:
            continue
        band = Wristband(
            qr_id=qr, manufacture_date=today,
            expiry_date=today + dt.timedelta(days=payload.shelf_life_days),
            status="unassigned",
        )
        db.add(band)
        created.append(band)
    db.commit()
    for b in created:
        db.refresh(b)
    return {"created": len(created),
            "bands": [wristband_out(b) for b in created]}


@router.get("/lookup/{qr_id}")
def lookup_band(qr_id: str,
                db: Session = Depends(get_db),
                _user: User = Depends(require_worker)):
    band = db.query(Wristband).filter_by(qr_id=qr_id.strip().upper()).first()
    if band is None:
        raise HTTPException(404, f"Wristband {qr_id} is not registered.")
    out = wristband_out(band)
    out["can_use"] = band.assigned_worker_id in (None, _user.id) and band.status != "invalid"
    return out


@router.post("/{band_id}/assign")
def assign_band(band_id: int, payload: BandAssign,
                db: Session = Depends(get_db),
                _admin: User = Depends(require_admin)):
    band = db.get(Wristband, band_id)
    if band is None:
        raise HTTPException(404, "Wristband not found.")
    worker = db.get(User, payload.worker_id)
    if worker is None or worker.role != "worker":
        raise HTTPException(404, "Worker not found.")
    band.assigned_worker_id = worker.id
    band.status = "assigned"
    db.commit()
    db.refresh(band)
    return wristband_out(band)
