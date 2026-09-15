"""Deterministic computer-vision pipeline tests on synthetic photographs."""

from __future__ import annotations

import cv2
import numpy as np

from app.cv.colors import apply_channel_affine, delta_e76, fit_channel_affine, rgb_to_lab
from app.cv.pipeline import CVError, process_image
from ml.simulator.band_simulator import render_card, simulate_photograph


def _photo(rng, dose, expired=False, temp=25.0, rh=60.0, band="H2S-000001"):
    card = render_card(band, dose, temp_c=temp, rh_pct=rh, expired=expired,
                       manufactured_on="2026-09-01", expires_on="2026-11-30",
                       rng=rng)
    photo = simulate_photograph(card, rng)
    return cv2.cvtColor(photo, cv2.COLOR_RGB2BGR)


def test_rgb_lab_known_values():
    # White -> high L*, near-neutral chromaticity; black -> L* ~0.
    lab_white = rgb_to_lab(np.array([[[255, 255, 255]]], dtype=np.uint8))[0, 0]
    lab_black = rgb_to_lab(np.array([[[0, 0, 0]]], dtype=np.uint8))[0, 0]
    assert lab_white[0] > 99
    assert lab_black[0] < 1


def test_channel_affine_recovers_known_transform():
    expected = np.array([[238, 238, 238], [160, 160, 160], [66, 66, 66]], float)
    # Warm LED: red gain, blue loss, small offset.
    measured = expected * np.array([1.08, 1.0, 0.9]) + np.array([3, -2, -6])
    coeffs = fit_channel_affine(measured, expected)
    corrected = apply_channel_affine(measured, coeffs)
    assert np.abs(corrected - expected).max() < 1.0


def test_pipeline_detects_band_qr_and_validity(rng):
    bgr = _photo(rng, dose=0.0, expired=False)
    result = process_image(bgr)
    assert result.ok
    assert result.band_id_qr == "H2S-000001"
    assert result.expiry_status == "VALID"
    assert 0.0 <= result.delta_e < 12.0


def test_expired_patch_detected(rng):
    bgr = _photo(rng, dose=15.0, expired=True, band="H2S-000002")
    result = process_image(bgr)
    assert result.expiry_status == "EXPIRED"
    assert result.expiry_confidence > 5


def test_dose_monotonic_color_change(rng):
    low = process_image(_photo(rng, 5.0)).delta_e
    high = process_image(_photo(rng, 80.0)).delta_e
    assert high > low + 15


def test_reference_correction_residual_small(rng):
    result = process_image(_photo(rng, dose=30.0, temp=33, rh=75))
    assert result.correction_residual < 14
    assert result.strip_lab[0] < 85  # a dosed strip darkens


def test_no_band_image_is_rejected():
    blank = np.full((900, 1200, 3), (90, 80, 70), np.uint8)
    try:
        process_image(blank)
    except CVError as exc:
        assert exc.code in (
            "BAND_NOT_DETECTED", "REFERENCE_NOT_DETECTED", "BLURRY",
            "STRIP_NOT_DETECTED", "EXPIRY_PATCH_NOT_DETECTED",
        )
    else:  # pragma: no cover - deterministic blank should never pass
        raise AssertionError("blank image unexpectedly produced a reading")


def test_feature_vector_shape(rng):
    result = process_image(_photo(rng, dose=20.0))
    assert set(result.features) == {"L", "a", "b", "delta_e", "delta_e_env"}


def test_env_cell_drift_increases_with_heat_humidity(rng):
    cool = process_image(_photo(rng, 20.0, temp=20.0, rh=40.0)).delta_e_env
    hot = process_image(_photo(rng, 20.0, temp=37.0, rh=84.0)).delta_e_env
    assert hot >= cool
