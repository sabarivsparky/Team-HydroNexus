"""Synthetic wristband-face renderer + phone-photo simulator.

Renders the printed H2S dosimeter card using the canonical geometry in
``app.cv.layout``:

    * four ArUco fiducial markers (corner registration),
    * the reactive strip (colour from the simulated chemistry),
    * a 7-step printed neutral reference scale,
    * a VALID / EXPIRED shelf-life patch,
    * the optional sealed environmental reference cell,
    * a QR code encoding the band id,
    * band id + manufacture / expiry text.

``simulate_photograph`` then embeds the card on a desk background with random
rotation, scale, perspective, white-balance / exposure shift, vignetting,
noise and mild blur — standing in for a smartphone capture until real
photographs exist.
"""

from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np
import qrcode

# Make ``backend/`` importable when run from the ml/ scripts.
_BACKEND = Path(__file__).resolve().parents[2] / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from app.cv import layout as L  # noqa: E402
from app.ml import chemistry as chem  # noqa: E402


# ─── ArUco helpers (compatible across opencv 4.7–4.10) ───────

def _aruco_dict():
    return cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)


def draw_marker(marker_id: int, size: int) -> np.ndarray:
    d = _aruco_dict()
    if hasattr(d, "generateImageMarker"):
        img = d.generateImageMarker(marker_id, size, 1)
    else:  # pragma: no cover - older opencv
        img = cv2.aruco.drawMarker(d, marker_id, size)
    return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)


# ─── Small drawing utilities (work in RGB) ───────────────────

def _rounded_rect(img, box, color, radius=18, thickness=-1, border=None, border_w=2):
    x0, y0, x1, y1 = box
    if thickness == -1:
        cv2.rectangle(img, (x0 + radius, y0), (x1 - radius, y1), color, -1)
        cv2.rectangle(img, (x0, y0 + radius), (x1, y1 - radius), color, -1)
        cv2.circle(img, (x0 + radius, y0 + radius), radius, color, -1)
        cv2.circle(img, (x1 - radius, y0 + radius), radius, color, -1)
        cv2.circle(img, (x0 + radius, y1 - radius), radius, color, -1)
        cv2.circle(img, (x1 - radius, y1 - radius), radius, color, -1)
    if border is not None:
        cv2.rectangle(img, (x0 + radius, y0), (x1 - radius, y1), border, border_w)
        cv2.rectangle(img, (x0, y0 + radius), (x0, y1 - radius), border, border_w)
        cv2.rectangle(img, (x1, y0 + radius), (x1, y1 - radius), border, border_w)
        cv2.rectangle(img, (x0 + radius, y1), (x1 - radius, y1), border, border_w)
        cv2.circle(img, (x0 + radius, y0 + radius), radius, border, border_w)
        cv2.circle(img, (x1 - radius, y0 + radius), radius, border, border_w)
        cv2.circle(img, (x0 + radius, y1 - radius), radius, border, border_w)
        cv2.circle(img, (x1 - radius, y1 - radius), radius, border, border_w)


def _text(img, text, org, scale=0.7, color=(60, 70, 90), thickness=1,
          font=cv2.FONT_HERSHEY_SIMPLEX, align="left", center=False):
    if center:
        (tw, th), _ = cv2.getTextSize(text, font, scale, thickness)
        org = (org[0] - tw // 2, org[1] + th // 2)
    cv2.putText(img, text, org, font, scale, color, thickness, cv2.LINE_AA)
    return org


from functools import lru_cache


@lru_cache(maxsize=64)
def _qr_image(text: str, pixels: int) -> np.ndarray:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(text)
    qr.make(fit=True)
    pil = qr.make_image(fill_color="black", back_color="white").convert("L")
    arr = np.array(pil)
    return cv2.resize(arr, (pixels, pixels), interpolation=cv2.INTER_NEAREST)


# ─── Canonical card rendering ────────────────────────────────

def render_card(
    band_id: str,
    dose_ppm_hr: float,
    *,
    temp_c: float = chem.DEFAULT_TEMP_C,
    rh_pct: float = chem.DEFAULT_RH_PCT,
    expired: bool = False,
    manufactured_on: str = "",
    expires_on: str = "",
    rng: np.random.Generator | None = None,
) -> np.ndarray:
    """Render the rectified wristband face; returns an RGB uint8 image."""
    rng = rng or np.random.default_rng()
    card = np.full((L.CANONICAL_H, L.CANONICAL_W, 3), 255, np.uint8)

    # Outer card border.
    cv2.rectangle(card, (10, 10), (L.CANONICAL_W - 11, L.CANONICAL_H - 11),
                  (150, 160, 175), 3)

    # Header.
    _text(card, "H2S DOSimeter", (60, 70), scale=1.35, color=(20, 32, 55),
          thickness=2, font=cv2.FONT_HERSHEY_DUPLEX)
    _text(card, "PASSIVE CUMULATIVE EXPOSURE BADGE", (60, 102), scale=0.55,
          color=(110, 120, 135))

    # ── Fiducials ──
    for mid, (cx, cy) in zip(L.ARUCO_IDS, L.ARUCO_CENTERS):
        m = draw_marker(mid, L.ARUCO_SIZE)
        x0, y0 = cx - L.ARUCO_SIZE // 2, cy - L.ARUCO_SIZE // 2
        card[y0:y0 + L.ARUCO_SIZE, x0:x0 + L.ARUCO_SIZE] = cv2.cvtColor(m, cv2.COLOR_BGR2RGB)
        cv2.rectangle(card, (x0 - 6, y0 - 6), (x0 + L.ARUCO_SIZE + 6, y0 + L.ARUCO_SIZE + 6),
                      (0, 0, 0), 2)

    # ── Reactive strip ──
    _text(card, "REACTIVE STRIP", ((L.STRIP_BOX[0] + L.STRIP_BOX[2]) // 2, 148),
          scale=0.62, color=(70, 80, 95), thickness=1, center=True)
    params = chem.sample_strip_parameters(rng)
    strip_rgb = chem.strip_color(
        dose_ppm_hr, temp_c, rh_pct,
        theta=params["theta"], base_jitter=params["base_jitter"],
        noise_sd=1.2, rng=rng,
    )
    _rounded_rect(card, L.STRIP_BOX, (245, 245, 245), radius=22,
                  border=(120, 130, 145), border_w=3)
    sx0, sy0, sx1, sy1 = L.STRIP_BOX
    inset = L.STRIP_SAMPLE_INSET
    _rounded_rect(card, (sx0 + inset, sy0 + inset, sx1 - inset, sy1 - inset),
                   tuple(int(v) for v in strip_rgb), radius=12)
    _text(card, "H2S SENSOR", ((sx0 + sx1) // 2, (sy0 + sy1) // 2 + 120),
          scale=0.6, color=(20, 25, 30), center=True)

    # ── Reference scale ──
    _text(card, "REFERENCE SCALE (PRINTED)",
          ((L.REF_LABEL_BOX[0] + L.REF_LABEL_BOX[2]) // 2, L.REF_LABEL_BOX[3] - 4),
          scale=0.58, color=(70, 80, 95), center=True)
    _rounded_rect(card, (L.REF_SCALE_BOX[0] - 18, L.REF_SCALE_BOX[1] - 14,
                         L.REF_SCALE_BOX[2] + 18, L.REF_SCALE_BOX[3] + 14),
                  (248, 248, 248), radius=14, border=(120, 130, 145), border_w=2)
    for center, ref in zip(L.REF_PATCH_CENTERS, L.REFERENCE_SRGB):
        cv2.circle(card, center, L.REF_PATCH_RADIUS, (0, 0, 0), -1)
        cv2.circle(card, center, L.REF_PATCH_RADIUS - 3, tuple(int(v) for v in ref), -1)

    # ── Expiry patch ──
    _text(card, "EXPIRY STATUS",
          ((L.EXPIRY_LABEL_BOX[0] + L.EXPIRY_LABEL_BOX[2]) // 2, L.EXPIRY_LABEL_BOX[3] - 2),
          scale=0.58, color=(70, 80, 95), center=True)
    exp_col = L.EXPIRY_EXPIRED_SRGB if expired else L.EXPIRY_VALID_SRGB
    _rounded_rect(card, L.EXPIRY_BOX, tuple(int(v) for v in exp_col), radius=18,
                  border=(40, 40, 40), border_w=2)
    _text(card, "EXPIRED" if expired else "VALID",
          ((L.EXPIRY_BOX[0] + L.EXPIRY_BOX[2]) // 2,
           (L.EXPIRY_BOX[1] + L.EXPIRY_BOX[3]) // 2 + 12),
          scale=1.05, color=(255, 255, 255), thickness=2, center=True)

    # ── Sealed environmental reference cell ──
    _text(card, "ENV REF (SEALED)",
          ((L.ENV_LABEL_BOX[0] + L.ENV_LABEL_BOX[2]) // 2, L.ENV_LABEL_BOX[3] - 2),
          scale=0.55, color=(70, 80, 95), center=True)
    env_rgb = chem.env_cell_color(temp_c, rh_pct, noise_sd=1.0, rng=rng)
    _rounded_rect(card, L.ENV_BOX, (245, 245, 245), radius=18,
                  border=(120, 130, 145), border_w=2)
    ex0, ey0, ex1, ey1 = L.ENV_BOX
    _rounded_rect(card, (ex0 + 26, ey0 + 26, ex1 - 26, ey1 - 26),
                  tuple(int(v) for v in env_rgb), radius=12)

    # ── QR + identifiers ──
    qr_px = L.QR_BOX[2] - L.QR_BOX[0]
    qr = _qr_image(band_id, qr_px)
    x0, y0 = L.QR_BOX[0], L.QR_BOX[1]
    card[y0:y0 + qr_px, x0:x0 + qr_px] = cv2.cvtColor(qr, cv2.COLOR_GRAY2RGB)
    cv2.rectangle(card, (x0 - 4, y0 - 4), (x0 + qr_px + 4, y0 + qr_px + 4),
                  (0, 0, 0), 2)
    _text(card, f"ID: {band_id}", L.BAND_ID_TEXT_POS, scale=1.05,
          color=(20, 32, 55), thickness=2, font=cv2.FONT_HERSHEY_DUPLEX)
    if manufactured_on:
        _text(card, f"MFG: {manufactured_on}", L.BAND_META_TEXT_POS, scale=0.62,
              color=(80, 90, 105))
    if expires_on:
        _text(card, f"USE BY: {expires_on}", L.BAND_META2_TEXT_POS, scale=0.62,
              color=(80, 90, 105))
    _text(card, "Dose output is an estimate - ppm-hr", L.ENV_NOTE_TEXT_POS,
          scale=0.55, color=(120, 130, 145))

    return card


# ─── Phone-photo simulation ──────────────────────────────────

_DESK_COLORS = [
    (139, 105, 78),    # wood
    (120, 113, 108),   # grey desk
    (96, 110, 128),    # blue steel
    (158, 134, 108),   # beige
    (84, 92, 88),      # dark green-grey
    (146, 122, 128),   # muted maroon
]


def simulate_photograph(
    card_rgb: np.ndarray,
    rng: np.random.Generator | None = None,
    *,
    scene_size=(1500, 1100),
    lighting_strength: float = 1.0,
) -> np.ndarray:
    """Embed the card in a scene, applying perspective + camera effects.

    Returns an **RGB** image (callers convert with cv2.cvtColor as needed).
    """
    rng = rng or np.random.default_rng()
    scene_w, scene_h = scene_size

    # Background: flat colour + soft gradient + light texture.
    bg_col = np.array(_DESK_COLORS[int(rng.integers(0, len(_DESK_COLORS)))], dtype=np.float32)
    bg = np.zeros((scene_h, scene_w, 3), np.float32)
    grad = np.linspace(0.85, 1.12, scene_w, dtype=np.float32)[None, :, None]
    bg[:] = bg_col[None, None, :]
    bg *= grad
    bg += rng.normal(0, 3.0, bg.shape).astype(np.float32)
    bg = np.clip(bg, 0, 255)

    # Random similarity transform + perspective jitter.
    angle = rng.uniform(-0.32, 0.32)
    scale = rng.uniform(0.82, 1.06)
    w, h = L.CANONICAL_W * scale, L.CANONICAL_H * scale
    cx, cy = scene_w / 2 + rng.uniform(-40, 40), scene_h / 2 + rng.uniform(-30, 30)
    ca, sa = np.cos(angle), np.sin(angle)
    local = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
    dst = []
    for x, y in local:
        dst.append([
            x * ca - y * sa + cx + rng.normal(0, 16),
            x * sa + y * ca + cy + rng.normal(0, 16),
        ])
    dst = np.array(dst, dtype=np.float32)
    src = np.array([[0, 0], [L.CANONICAL_W, 0],
                    [L.CANONICAL_W, L.CANONICAL_H], [0, L.CANONICAL_H]], np.float32)
    H = cv2.getPerspectiveTransform(src, dst)

    warped = cv2.warpPerspective(
        card_rgb, H, (scene_w, scene_h),
        flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0),
    )
    mask = cv2.warpPerspective(
        np.full((L.CANONICAL_H, L.CANONICAL_W), 255, np.uint8), H, (scene_w, scene_h),
        flags=cv2.INTER_NEAREST, borderValue=0,
    )
    m3 = mask[..., None] > 0
    scene = np.where(m3, warped.astype(np.float32), bg)

    # ── Lighting / white-balance transform (whole photo) ──
    warm = rng.uniform(-1, 1)
    gain = rng.uniform(0.78, 1.22, size=3) * lighting_strength
    gain[0] *= 1 + 0.06 * warm     # R up when warm
    gain[2] *= 1 - 0.08 * warm     # B down when warm
    offset = rng.uniform(-14, 14, size=3)
    scene = scene * gain[None, None, :] + offset[None, None, :]

    # Vignette.
    yy, xx = np.mgrid[0:scene_h, 0:scene_w]
    r = np.sqrt(((xx - cx) / (scene_w * 0.72)) ** 2 + ((yy - cy) / (scene_h * 0.72)) ** 2)
    vignette = np.clip(1.08 - 0.32 * r**2, 0.7, 1.08)
    scene *= vignette[..., None]

    # Sensor noise + optional mild defocus.
    scene += rng.normal(0, rng.uniform(1.5, 4.5), scene.shape)
    scene = np.clip(scene, 0, 255).astype(np.uint8)
    if rng.random() < 0.35:
        k = int(rng.choice([3, 5]))
        scene = cv2.GaussianBlur(scene, (k, k), 0)

    return scene
