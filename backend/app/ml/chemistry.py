"""Simulated colour-response chemistry for the passive H2S strip.

THIS IS A SIMULATION, NOT MEASURED CHEMISTRY.  It models the qualitative
behaviour the real lead-acetate / metal-salt impregnated strip is expected to
show:

* unexposed strip is pale cream;
* reaction with H2S forms a dark brown/black metal-sulfide layer;
* darkening is progressive and monotonic in cumulative dose (ppm·hr);
* the response saturates exponentially;
* temperature and humidity modestly accelerate the reaction;
* strip-to-strip manufacturing variation shifts sensitivity slightly.

The sealed environmental reference cell uses the same base colour but
darkens only with temperature/humidity drift (it is shielded from H2S).

The same functions drive (a) rendered wristband images, (b) calibration-data
generation and (c) demo-data seeding, so the whole software chain is
self-consistent.  They must be replaced by real calibration curves once
controlled H2S exposure data exists (see KNOWN_LIMITATIONS.md).
"""

from __future__ import annotations

import numpy as np

# ─── Physical colour anchors (sRGB) ──────────────────────────
STRIP_BASE_SRGB = np.array([226.0, 214.0, 178.0])   # unexposed cream paper
STRIP_SAT_SRGB = np.array([42.0, 34.0, 28.0])       # saturated sulfide layer

# Dose at which ~63% of the saturation change is reached (ppm·hr).
NOMINAL_THETA = 24.0

# Dose range used across the simulated calibration / demos.
DOSE_MIN = 0.0
DOSE_MAX = 100.0

# Default assumed ambient conditions.
DEFAULT_TEMP_C = 25.0
DEFAULT_RH_PCT = 60.0


def env_rate_multiplier(temp_c: float, rh_pct: float) -> float:
    """Multiplicative reaction-rate factor from temperature & humidity.

    Mild Arrhenius-style temperature term and a small humidity term, anchored
    to 1.0 at 25 °C / 60 %RH.
    """
    temp_factor = float(np.exp(0.020 * (temp_c - 25.0)))
    hum_factor = 0.82 + 0.003 * rh_pct          # 1.0 at 60 %RH
    return float(np.clip(temp_factor * hum_factor, 0.55, 1.9))


def reacted_fraction(
    dose_ppm_hr: float,
    temp_c: float = DEFAULT_TEMP_C,
    rh_pct: float = DEFAULT_RH_PCT,
    theta: float = NOMINAL_THETA,
) -> float:
    """Fraction of the colour change completed for a given cumulative dose."""
    effective = max(dose_ppm_hr, 0.0) * env_rate_multiplier(temp_c, rh_pct)
    return float(1.0 - np.exp(-effective / theta))


def strip_color(
    dose_ppm_hr: float,
    temp_c: float = DEFAULT_TEMP_C,
    rh_pct: float = DEFAULT_RH_PCT,
    theta: float = NOMINAL_THETA,
    base_jitter: np.ndarray | None = None,
    noise_sd: float = 0.0,
    rng: np.random.Generator | None = None,
) -> np.ndarray:
    """Rendered strip colour (sRGB uint8) under the given conditions."""
    f = reacted_fraction(dose_ppm_hr, temp_c, rh_pct, theta)
    base = STRIP_BASE_SRGB if base_jitter is None else STRIP_BASE_SRGB + base_jitter
    rgb = base + f * (STRIP_SAT_SRGB - base)
    if noise_sd > 0.0:
        r = rng or np.random.default_rng()
        rgb = rgb + r.normal(0, noise_sd, size=3)
    return np.round(np.clip(rgb, 0, 255)).astype(np.uint8)


def env_drift_fraction(temp_c: float, rh_pct: float) -> float:
    """Small darkening fraction of the sealed cell from ambient conditions."""
    val = 0.04 + 0.006 * (temp_c - 25.0) + 0.0008 * (rh_pct - 60.0)
    return float(np.clip(val, 0.0, 0.22))


def env_cell_color(
    temp_c: float = DEFAULT_TEMP_C,
    rh_pct: float = DEFAULT_RH_PCT,
    noise_sd: float = 0.0,
    rng: np.random.Generator | None = None,
) -> np.ndarray:
    """Sealed reference-cell colour (darkens with env drift only)."""
    f = env_drift_fraction(temp_c, rh_pct)
    rgb = STRIP_BASE_SRGB + f * (STRIP_SAT_SRGB - STRIP_BASE_SRGB)
    if noise_sd > 0.0:
        r = rng or np.random.default_rng()
        rgb = rgb + r.normal(0, noise_sd, size=3)
    return np.round(np.clip(rgb, 0, 255)).astype(np.uint8)


def sample_strip_parameters(rng: np.random.Generator) -> dict:
    """Manufacturing variation for one strip: sensitivity + base-colour jitter."""
    return {
        "theta": float(np.clip(rng.normal(NOMINAL_THETA, 2.5), 17.0, 33.0)),
        "base_jitter": rng.normal(0, 2.0, size=3) * np.array([1.0, 1.0, 1.4]),
    }
