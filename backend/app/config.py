"""Application configuration (environment-driven).

Secrets are NEVER hardcoded: copy ``.env.example`` to ``.env`` for local work.
A random development secret is generated if none is provided so the app still
boots, but production deployments must set JWT_SECRET explicitly.
"""

from __future__ import annotations

import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BASE_DIR.parent
load_dotenv(BASE_DIR / ".env")


class Settings:
    APP_NAME = "HydroNexus H2S Dosimeter API"
    API_PREFIX = "/api"

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{BASE_DIR / 'data' / 'hydronexus.db'}",
    )
    JWT_SECRET: str = os.getenv("JWT_SECRET") or secrets.token_urlsafe(48)
    JWT_ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "720"))

    MODEL_DIR = REPO_ROOT / "ml" / "models"
    CALIBRATION_CSV = REPO_ROOT / "ml" / "data" / "calibration_simulated.csv"
    UPLOAD_DIR = BASE_DIR / "data" / "uploads"

    # Exposure action level (ppm·hr) — configurable by the admin; mirrors the
    # dashboard's safety threshold and is NOT a claimed regulatory limit.
    ACTION_LEVEL_PPM_HR: float = float(os.getenv("ACTION_LEVEL_PPM_HR", "10.0"))

    SHELF_LIFE_DAYS: int = int(os.getenv("SHELF_LIFE_DAYS", "90"))

    CORS_ORIGINS = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*",  # dev/demo convenience; tighten for production
    ]


settings = Settings()
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
(BASE_DIR / "data").mkdir(exist_ok=True)
