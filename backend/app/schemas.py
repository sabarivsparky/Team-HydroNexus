"""Pydantic request/response schemas."""

from __future__ import annotations

import datetime as dt
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, EmailStr


# ─── Auth ────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    employee_id: str
    role: str
    department: Optional[str] = None
    mobile: Optional[str] = None


class WorkerCreate(BaseModel):
    name: str
    email: EmailStr
    employee_id: str
    password: str = "worker@1234"
    department: Optional[str] = None
    mobile: Optional[str] = None


# ─── Wristbands ──────────────────────────────────────────────

class WristbandOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    qr_id: str
    manufacture_date: dt.date
    expiry_date: dt.date
    status: str
    assigned_worker_id: Optional[int] = None
    worker_name: Optional[str] = None
    is_expired: bool = False


class WristbandRegister(BaseModel):
    qr_id: str
    manufacture_date: Optional[dt.date] = None
    expiry_date: Optional[dt.date] = None
    shelf_life_days: int = 90


class WristbandBatch(BaseModel):
    count: int = 10
    prefix: str = "H2S-"
    shelf_life_days: int = 90


class BandAssign(BaseModel):
    worker_id: int


# ─── Readings ────────────────────────────────────────────────

class ReadingOut(BaseModel):
    id: int
    ref: str
    worker_id: int
    worker_name: Optional[str] = None
    employee_id: Optional[str] = None
    department: Optional[str] = None
    band_qr: Optional[str] = None
    shift_label: Optional[str] = None
    timestamp: dt.datetime
    estimated_dose: Optional[float]
    expiry_status: str
    reading_status: str
    temperature_c: Optional[float] = None
    humidity_pct: Optional[float] = None
    model_version: Optional[str] = None
    source: str
    features: dict[str, Any] = {}
    high_exposure: bool = False
    image_original: Optional[str] = None
    image_rectified: Optional[str] = None


class SimulateReadingRequest(BaseModel):
    """Render a synthetic wristband photo server-side and run the real pipeline.

    DEMO/DEVELOPMENT ONLY — exercises the genuine CV + ML chain end to end
    without a physical band.
    """

    band_qr_id: str
    dose_ppm_hr: Optional[float] = None   # random if omitted
    temp_c: float = 25.0
    rh_pct: float = 60.0
    shift_label: str = "Morning"
    force_expired: bool = False
    lighting_strength: float = 1.0


# ─── Dashboard / reports ─────────────────────────────────────

class DashboardSummary(BaseModel):
    total_workers: int
    active_bands: int
    assigned_bands: int
    expired_bands: int
    readings_today: int
    total_readings: int
    high_exposure_today: int
    cumulative_dose_today: float
    average_dose_today: float
    max_dose_today: float
    action_level: float
    active_model: Optional[str] = None
    simulated_calibration: bool = True


class TrendPoint(BaseModel):
    date: str
    readings: int
    average_dose: float
    max_dose: float
    high_exposure: int


class WorkerReportRow(BaseModel):
    worker_id: int
    employee_id: str
    name: str
    department: Optional[str]
    shift_label: Optional[str]
    readings: int
    cumulative_dose: float
    max_dose: float
    average_dose: float
    latest_status: str


class ModelVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    version: str
    model_type: str
    is_active: bool
    simulated_calibration: bool
    trained_at: dt.datetime
    metrics: Any = None


class CalibrationPointOut(BaseModel):
    id: int
    dose_ppm_hr: float
    temp_c: Optional[float]
    rh_pct: Optional[float]
    source: str
    features: dict[str, Any] = {}


class PredictionDiagnostics(BaseModel):
    band_id_qr: Optional[str]
    expiry_status: str
    strip_rgb: list[float]
    strip_lab: list[float]
    delta_e: float
    delta_e_env: float
    correction_residual: float
    brightness: float
    blur_score: float
    reference_measured: list[list[float]]
    reference_expected: list[list[float]]


class PredictionResponse(BaseModel):
    reading: ReadingOut
    estimated_dose: Optional[float]
    model_version: Optional[str]
    is_estimate: bool = True
    simulated: bool
    message: str
    diagnostics: PredictionDiagnostics


TokenResponse.model_rebuild()
