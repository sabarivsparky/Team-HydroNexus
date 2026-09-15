"""Colour-science helpers: sRGB <-> Lab conversion and delta-E metrics.

Conversions follow standard sRGB (D65 reference white) and CIE Lab, matching
the behaviour of common colour libraries closely enough for photographic
colour-difference work.
"""

from __future__ import annotations

import numpy as np


# ─── sRGB / XYZ / Lab ────────────────────────────────────────

def _srgb_to_linear(c: np.ndarray) -> np.ndarray:
    c = c.astype(np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def rgb_to_lab(rgb: np.ndarray) -> np.ndarray:
    """Convert an sRGB array (..., 3) in [0,255] to CIE L*a*b* (D65)."""
    rgb = np.asarray(rgb, dtype=np.float64)
    lin = _srgb_to_linear(rgb)

    # sRGB D65 -> XYZ
    m = np.array(
        [
            [0.4124564, 0.3575761, 0.1804375],
            [0.2126729, 0.7151522, 0.0721750],
            [0.0193339, 0.1191920, 0.9503041],
        ]
    )
    xyz = lin @ m.T

    # Reference white D65
    xyz_n = np.array([0.95047, 1.0, 1.08883])
    xyz = xyz / xyz_n

    eps = 216 / 24389
    kappa = 24389 / 27
    f = np.where(xyz > eps, np.cbrt(xyz), (kappa * xyz + 16) / 116)

    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], axis=-1)


def lab_to_rgb(lab: np.ndarray) -> np.ndarray:
    """Convert CIE L*a*b* (D65) back to sRGB uint8."""
    lab = np.asarray(lab, dtype=np.float64)
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    fy = (L + 16) / 116
    fx = a / 500 + fy
    fz = fy - b / 200
    f = np.stack([fx, fy, fz], axis=-1)

    eps = 216 / 24389
    xyz_n = np.array([0.95047, 1.0, 1.08883])
    xyz = np.where(f[..., :] ** 3 > eps, f**3, (3 * (6 / 29) ** 2) * (f - 4 / 29))
    xyz = xyz * xyz_n

    m_inv = np.array(
        [
            [3.2404542, -1.5371385, -0.4985314],
            [-0.9692660, 1.8760108, 0.0415560],
            [0.0556434, -0.2040259, 1.0572252],
        ]
    )
    lin = xyz @ m_inv.T
    lin = np.clip(lin, 0, 1)
    srgb = np.where(lin <= 0.0031308, 12.92 * lin, 1.055 * lin ** (1 / 2.4) - 0.055)
    return np.round(srgb * 255).astype(np.uint8)


# ─── Delta E metrics ─────────────────────────────────────────

def delta_e76(lab1: np.ndarray, lab2: np.ndarray) -> float | np.ndarray:
    """CIE76 Euclidean colour distance in Lab."""
    lab1 = np.asarray(lab1, dtype=np.float64)
    lab2 = np.asarray(lab2, dtype=np.float64)
    diff = lab1 - lab2
    dist = np.sqrt(np.sum(diff**2, axis=-1))
    return float(dist) if dist.ndim == 0 else dist


def delta_e2000(lab1: np.ndarray, lab2: np.ndarray) -> float:
    """CIEDE2000 colour difference between two Lab colours (scalar pair)."""
    L1, a1, b1 = [float(v) for v in np.asarray(lab1).ravel()[:3]]
    L2, a2, b2 = [float(v) for v in np.asarray(lab2).ravel()[:3]]

    avg_L = (L1 + L2) / 2.0
    C1 = np.hypot(a1, b1)
    C2 = np.hypot(a2, b2)
    avg_C = (C1 + C2) / 2.0
    G = 0.5 * (1 - np.sqrt(avg_C**7 / (avg_C**7 + 25**7)))
    a1p = (1 + G) * a1
    a2p = (1 + G) * a2
    C1p = np.hypot(a1p, b1)
    C2p = np.hypot(a2p, b2)

    def hue_angle(a, b):
        h = np.degrees(np.arctan2(b, a))
        return h + 360 if h < 0 else h

    h1p = hue_angle(a1p, b1)
    h2p = hue_angle(a2p, b2)

    dLp = L2 - L1
    dCp = C2p - C1p
    if C1p * C2p == 0:
        dhp = 0.0
    else:
        dhp = h2p - h1p
        if dhp > 180:
            dhp -= 360
        elif dhp < -180:
            dhp += 360
    dHp = 2 * np.sqrt(C1p * C2p) * np.sin(np.radians(dhp / 2.0))

    avg_Lp = (L1 + L2) / 2.0
    avg_Cp = (C1p + C2p) / 2.0
    if C1p * C2p == 0:
        avg_hp = h1p + h2p
    else:
        avg_hp = (h1p + h2p) / 2.0
        if np.abs(h1p - h2p) > 180:
            if h1p + h2p < 360:
                avg_hp += 180
            else:
                avg_hp -= 180

    T = (
        1
        - 0.17 * np.cos(np.radians(avg_hp - 30))
        + 0.24 * np.cos(np.radians(2 * avg_hp))
        + 0.32 * np.cos(np.radians(3 * avg_hp + 6))
        - 0.20 * np.cos(np.radians(4 * avg_hp - 63))
    )
    d_theta = 30 * np.exp(-(((avg_hp - 275) / 25) ** 2))
    Rc = 2 * np.sqrt(avg_Cp**7 / (avg_Cp**7 + 25**7))
    Sl = 1 + (0.015 * (avg_Lp - 50) ** 2) / np.sqrt(20 + (avg_Lp - 50) ** 2)
    Sc = 1 + 0.045 * avg_Cp
    Sh = 1 + 0.015 * avg_Cp * T
    Rt = -np.sin(np.radians(2 * d_theta)) * Rc

    kL = kC = kH = 1.0
    de = np.sqrt(
        (dLp / (kL * Sl)) ** 2
        + (dCp / (kC * Sc)) ** 2
        + (dHp / (kH * Sh)) ** 2
        + Rt * (dCp / (kC * Sc)) * (dHp / (kH * Sh))
    )
    return float(de)


# ─── Lighting correction ─────────────────────────────────────

def fit_channel_affine(measured: np.ndarray, expected: np.ndarray) -> np.ndarray:
    """Fit per-channel affine ``out = gain * in + offset``.

    Returns a (3, 2) matrix [gain, offset] per RGB channel by least squares
    over the captured reference patches vs. their known printed colours.
    A per-channel diagonal+offset model captures white-balance and exposure
    shifts (warm/cool LEDs, brightness) robustly from a neutral grey ramp.
    """
    measured = np.asarray(measured, dtype=np.float64)
    expected = np.asarray(expected, dtype=np.float64)
    n = measured.shape[0]
    coeffs = np.empty((3, 2))
    ones = np.ones(n)
    for c in range(3):
        # Per-channel design [measured_channel, 1] -> expected channel.
        A = np.column_stack([measured[:, c], ones])           # (N, 2)
        sol, *_ = np.linalg.lstsq(A, expected[:, c], rcond=None)
        coeffs[c] = sol
    return coeffs  # (3, 2) -> [gain, offset] per channel


def apply_channel_affine(rgb: np.ndarray, coeffs: np.ndarray) -> np.ndarray:
    rgb = np.asarray(rgb, dtype=np.float64)
    gain = coeffs[:, 0]
    offset = coeffs[:, 1]
    out = rgb * gain + offset
    return np.clip(out, 0, 255)
