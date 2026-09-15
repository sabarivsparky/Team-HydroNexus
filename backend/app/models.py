"""SQLAlchemy ORM models — the wristband/reading data model.

Tables
------
users            : workers AND administrators (role discriminator)
wristbands       : disposable badges identified by QR id
shifts           : a worker's work interval (label + start/end)
readings         : one analysed photograph -> estimated cumulative dose
model_versions   : trained regressor bookkeeping
calibration_records : simulated or real calibration points
"""

from __future__ import annotations

import datetime as dt
import json
from typing import Optional

from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _now() -> dt.datetime:
    return dt.datetime.utcnow()


# ─── Users (workers & admins) ────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    employee_id: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(16), default="worker")  # admin|worker
    department: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    mobile: Mapped[Optional[str]] = mapped_column(String(24), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=_now)

    wristbands: Mapped[list["Wristband"]] = relationship(back_populates="worker")
    readings: Mapped[list["Reading"]] = relationship(back_populates="worker")
    shifts: Mapped[list["Shift"]] = relationship(back_populates="worker")


# ─── Wristbands ──────────────────────────────────────────────

class Wristband(Base):
    __tablename__ = "wristbands"

    id: Mapped[int] = mapped_column(primary_key=True)
    qr_id: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    manufacture_date: Mapped[dt.date] = mapped_column(DateTime)
    expiry_date: Mapped[dt.date] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(20), default="unassigned")
    # unassigned | assigned | used | invalid
    assigned_worker_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=_now)

    worker: Mapped[Optional["User"]] = relationship(back_populates="wristbands")
    readings: Mapped[list["Reading"]] = relationship(back_populates="band")


# ─── Shifts ──────────────────────────────────────────────────

class Shift(Base):
    __tablename__ = "shifts"

    id: Mapped[int] = mapped_column(primary_key=True)
    worker_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    label: Mapped[str] = mapped_column(String(16))  # Morning|Afternoon|Night
    shift_date: Mapped[dt.date] = mapped_column(DateTime, index=True)
    start_time: Mapped[Optional[dt.datetime]] = mapped_column(DateTime, nullable=True)
    end_time: Mapped[Optional[dt.datetime]] = mapped_column(DateTime, nullable=True)

    worker: Mapped["User"] = relationship(back_populates="shifts")
    readings: Mapped[list["Reading"]] = relationship(back_populates="shift")


# ─── Readings ────────────────────────────────────────────────

class Reading(Base):
    __tablename__ = "readings"

    id: Mapped[int] = mapped_column(primary_key=True)
    ref: Mapped[str] = mapped_column(String(24), unique=True, index=True)  # RDG-xxxx
    worker_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    band_id: Mapped[int] = mapped_column(ForeignKey("wristbands.id"), index=True)
    shift_id: Mapped[Optional[int]] = mapped_column(ForeignKey("shifts.id"),
                                                    nullable=True)
    timestamp: Mapped[dt.datetime] = mapped_column(DateTime, default=_now, index=True)

    estimated_dose: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    expiry_status: Mapped[str] = mapped_column(String(12))       # VALID|EXPIRED
    reading_status: Mapped[str] = mapped_column(String(20))      # valid|rejected_expired|rejected_quality
    temperature_c: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    humidity_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    model_version: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    source: Mapped[str] = mapped_column(String(16), default="photo")  # photo|simulated|seed
    features_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cv_quality_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image_original: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    image_rectified: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    worker: Mapped["User"] = relationship(back_populates="readings")
    band: Mapped["Wristband"] = relationship(back_populates="readings")
    shift: Mapped[Optional["Shift"]] = relationship(back_populates="readings")

    @property
    def features(self) -> dict:
        return json.loads(self.features_json) if self.features_json else {}

    @features.setter
    def features(self, value: dict) -> None:
        self.features_json = json.dumps(value)


# ─── Model registry ──────────────────────────────────────────

class ModelVersion(Base):
    __tablename__ = "model_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    version: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    model_type: Mapped[str] = mapped_column(String(40))
    metrics_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    simulated_calibration: Mapped[bool] = mapped_column(Boolean, default=True)
    trained_at: Mapped[dt.datetime] = mapped_column(DateTime, default=_now)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


# ─── Calibration records ─────────────────────────────────────

class CalibrationRecord(Base):
    __tablename__ = "calibration_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    dose_ppm_hr: Mapped[float] = mapped_column(Float)
    concentration_ppm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    duration_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    temp_c: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rh_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    features_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(12), default="simulated")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=_now)
