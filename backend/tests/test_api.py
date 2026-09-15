"""End-to-end API tests: auth -> bands -> CV/ML prediction -> reporting."""

from __future__ import annotations

import io

import cv2
import numpy as np

from ml.simulator.band_simulator import render_card, simulate_photograph
from tests.conftest import auth


def _jpg_bytes(rng, band_id, dose, **kw):
    card = render_card(band_id, dose,
                       manufactured_on="2026-09-01",
                       expires_on="2026-11-30", rng=rng, **kw)
    photo = simulate_photograph(card, rng)
    ok, buf = cv2.imencode(".jpg", cv2.cvtColor(photo, cv2.COLOR_RGB2BGR))
    assert ok
    return io.BytesIO(buf.tobytes())


# ─── Auth ────────────────────────────────────────────────────

def test_login_rejects_bad_password(client):
    r = client.post("/api/auth/login",
                    json={"email": "w1024@hydronexus.io", "password": "nope"})
    assert r.status_code == 401


def test_me_requires_token(client):
    assert client.get("/api/auth/me").status_code == 401


def test_worker_cannot_access_admin_summary(client, tokens):
    r = client.get("/api/admin/summary", headers=auth(tokens["worker"]))
    assert r.status_code == 403


# ─── Bands ───────────────────────────────────────────────────

def test_band_lifecycle_and_lookup(client, tokens):
    ha, hw = auth(tokens["admin"]), auth(tokens["worker"])
    r = client.post("/api/bands/batch", headers=ha,
                    json={"count": 3, "prefix": "H2S-", "shelf_life_days": 90})
    assert r.status_code == 201 and r.json()["created"] == 3
    r = client.get("/api/bands/lookup/H2S-000001", headers=hw)
    assert r.status_code == 200 and r.json()["qr_id"] == "H2S-000001"
    r = client.get("/api/bands/lookup/H2S-999999", headers=hw)
    assert r.status_code == 404


# ─── Prediction (synthetic photo through the real CV + ML) ───

def test_simulate_prediction_and_persistence(client, tokens, rng):
    hw = auth(tokens["worker"])
    r = client.post("/api/readings/simulate", headers=hw,
                    json={"band_qr_id": "H2S-000013", "dose_ppm_hr": 50,
                          "temp_c": 27, "rh_pct": 60,
                          "shift_label": "Morning"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["simulated"] is True
    assert body["estimated_dose"] is not None
    assert 30 < body["estimated_dose"] < 70
    assert body["diagnostics"]["expiry_status"] == "VALID"
    assert body["reading"]["model_version"].startswith(("SVR", "RF", "LR"))

    history = client.get("/api/workers/me/readings", headers=hw).json()
    assert any(x["ref"] == body["reading"]["ref"] for x in history)


def test_multipart_photo_prediction(client, tokens, rng):
    hw = auth(tokens["worker"])
    files = {"file": ("shot.jpg",
                      _jpg_bytes(rng, "H2S-000025", 45.0, temp_c=28, rh_pct=65),
                      "image/jpeg")}
    r = client.post(
        "/api/readings/predict", headers=hw, files=files,
        data={"band_qr_id": "H2S-000025", "shift_label": "Afternoon"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["simulated"] is False
    assert body["reading"]["source"] == "photo"
    assert 25 < body["estimated_dose"] < 65


def test_expired_band_is_rejected(client, tokens, rng):
    # Band H2S-000038 is seeded expired and assigned to w1029.
    hw = auth(tokens["worker6"])
    r = client.post("/api/readings/simulate", headers=hw,
                    json={"band_qr_id": "H2S-000038", "dose_ppm_hr": 20})
    assert r.status_code == 200
    body = r.json()
    assert body["estimated_dose"] is None
    assert body["reading"]["reading_status"] == "rejected_expired"


def test_unknown_band_errors(client, tokens):
    hw = auth(tokens["worker"])
    r = client.post("/api/readings/simulate", headers=hw,
                    json={"band_qr_id": "H2S-000000"})
    assert r.status_code == 404


def test_worker_only_sees_own_readings(client, tokens):
    hw = auth(tokens["worker"])
    rows = client.get("/api/readings", headers=hw).json()
    worker_ids = {row["worker_id"] for row in rows}
    me = client.get("/api/auth/me", headers=hw).json()
    assert worker_ids <= {me["id"]}


# ─── Admin analytics ─────────────────────────────────────────

def test_admin_summary_trends_reports(client, tokens):
    ha = auth(tokens["admin"])
    summary = client.get("/api/admin/summary", headers=ha).json()
    assert summary["total_workers"] == 12
    assert summary["active_model"].startswith(("SVR", "RF", "LR"))
    assert summary["expired_bands"] >= 4

    trends = client.get("/api/admin/trends?days=7", headers=ha).json()
    assert len(trends) == 7

    reports = client.get("/api/admin/reports?days=7", headers=ha).json()
    assert len(reports) == 12

    models = client.get("/api/models", headers=ha).json()
    assert any(m["is_active"] for m in models)

    cal = client.get("/api/calibration?limit=1000", headers=ha).json()
    assert len(cal) >= 200
