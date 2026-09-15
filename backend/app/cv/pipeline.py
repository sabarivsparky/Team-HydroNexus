"""Deterministic computer-vision pipeline for the H2S dosimeter wristband.

Stages (no trained/Deep-Learning models):

    bytes/array
      -> ArUco fiducial registration (contour fallback)
      -> perspective rectification to the canonical card face
      -> photographic quality checks (too dark / too bright / blurred)
      -> reference-scale sampling + per-channel colour correction
      -> reactive strip / expiry / sealed-cell colour extraction
      -> sRGB -> CIE Lab, Delta-E features
      -> QR band-id decode
      -> feature vector for the ML regressor
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any

import cv2
import numpy as np

from app.cv import layout as L
from app.cv.colors import (
    apply_channel_affine,
    delta_e76,
    delta_e2000,
    fit_channel_affine,
    rgb_to_lab,
)
from app.ml import chemistry as chem


class CVError(Exception):
    """Raised when a photograph cannot produce a trustworthy reading."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


# ─── Result container ────────────────────────────────────────

@dataclass
class PipelineResult:
    ok: bool
    band_id_qr: str | None
    expiry_status: str                      # "VALID" | "EXPIRED"
    expiry_confidence: float
    strip_rgb: list[float]                  # corrected mean sRGB
    strip_lab: list[float]
    env_rgb: list[float]
    env_lab: list[float]
    delta_e: float                          # strip vs unexposed baseline
    delta_e_env: float                      # sealed cell drift
    reference_measured: list[list[float]]
    reference_expected: list[list[float]]
    correction_residual: float
    brightness: float
    blur_score: float
    features: dict[str, float] = field(default_factory=dict)
    # Non-serializable diagnostics (excluded from to_dict / API payloads).
    rectified_rgb: Any = field(default=None, repr=False)
    detected_centers: list[tuple[int, int]] = field(default_factory=list)

    def to_dict(self) -> dict:
        data = asdict(self)
        data.pop("rectified_rgb", None)
        data.pop("detected_centers", None)
        return data


# ─── Small geometry utilities ────────────────────────────────

def _order_quad(pts: np.ndarray) -> np.ndarray:
    """Order four points TL, TR, BR, BL."""
    pts = np.asarray(pts, dtype=np.float32)
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).ravel()
    return np.array([
        pts[np.argmin(s)],      # TL: smallest x+y
        pts[np.argmin(d)],      # TR: smallest y-x
        pts[np.argmax(s)],      # BR: largest x+y
        pts[np.argmax(d)],      # BL: largest y-x
    ], dtype=np.float32)


def _aruco_detector():
    aruco_dict = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
    params = cv2.aruco.DetectorParameters()
    # AprilTag-style corner refinement is markedly more robust to perspective
    # and uneven phone-camera illumination.
    try:
        params.cornerRefinementMethod = cv2.aruco.CORNER_REFINE_APRILTAG
    except AttributeError:  # pragma: no cover
        params.cornerRefinementMethod = cv2.aruco.CORNER_REFINE_CONTOUR
    params.adaptiveThreshWinSizeMin = 3
    params.adaptiveThreshWinSizeMax = 63
    params.adaptiveThreshWinSizeStep = 6
    params.minMarkerPerimeterRate = 0.04
    params.polygonalApproxAccuracyRate = 0.06
    return cv2.aruco.ArucoDetector(aruco_dict, params)


def _detect_aruco(bgr: np.ndarray):
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    detector = _aruco_detector()

    id_to_center: dict[int, np.ndarray] = {}

    def _merge(corners, ids):
        if ids is None:
            return
        for corner_arr, mid in zip(corners, ids.ravel()):
            mid = int(mid)
            if mid in L.MARKER_ORDER and mid not in id_to_center:
                id_to_center[mid] = corner_arr[0].mean(axis=0)

    # Raw grayscale first.
    corners, ids, _ = detector.detectMarkers(gray)
    _merge(corners, ids)

    # Retry on contrast-enhanced variants (warm/cool LEDs, vignetting).
    if not all(m in id_to_center for m in L.MARKER_ORDER):
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        corners, ids, _ = detector.detectMarkers(clahe.apply(gray))
        _merge(corners, ids)
    if not all(m in id_to_center for m in L.MARKER_ORDER) and max(gray.shape) < 2600:
        up = cv2.resize(gray, None, fx=1.6, fy=1.6,
                        interpolation=cv2.INTER_CUBIC)
        corners, ids, _ = detector.detectMarkers(up)
        if ids is not None:
            for corner_arr, mid in zip(corners, ids.ravel()):
                mid = int(mid)
                if mid in L.MARKER_ORDER and mid not in id_to_center:
                    id_to_center[mid] = corner_arr[0].mean(axis=0) / 1.6

    if not all(m in id_to_center for m in L.MARKER_ORDER):
        return None
    src = np.array([id_to_center[m] for m in L.MARKER_ORDER], dtype=np.float32)
    dst = np.array([L.ARUCO_CENTERS[i] for i in range(4)], dtype=np.float32)
    return src, dst


def _detect_card_contour(bgr: np.ndarray):
    """Fallback: find the bright card as the largest quadrilateral contour."""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, th = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    card = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(card)
    if area < 0.12 * bgr.shape[0] * bgr.shape[1]:
        return None
    peri = cv2.arcLength(card, True)
    approx = cv2.approxPolyDP(card, 0.02 * peri, True)
    if len(approx) != 4:
        rect = cv2.boxPoints(cv2.minAreaRect(card))
        quad = rect
    else:
        quad = approx.reshape(4, 2)
    src = _order_quad(quad)
    margin = L.CARD_MARGIN
    dst = np.array([
        [margin, margin],
        [L.CANONICAL_W - margin, margin],
        [L.CANONICAL_W - margin, L.CANONICAL_H - margin],
        [margin, L.CANONICAL_H - margin],
    ], dtype=np.float32)
    return src, dst


def rectify(bgr: np.ndarray) -> tuple[np.ndarray, str]:
    """Return the canonical RGB card image and the detector used."""
    found = _detect_aruco(bgr)
    method = "aruco"
    if found is None:
        found = _detect_card_contour(bgr)
        method = "contour"
    if found is None:
        raise CVError(
            "BAND_NOT_DETECTED",
            "Wristband not detected. Please place the full wristband inside "
            "the capture guide and try again.",
        )
    src, dst = found
    H = cv2.getPerspectiveTransform(src, dst)
    warped = cv2.warpPerspective(
        bgr, H, (L.CANONICAL_W, L.CANONICAL_H),
        flags=cv2.INTER_LINEAR, borderValue=(255, 255, 255),
    )
    return cv2.cvtColor(warped, cv2.COLOR_BGR2RGB), method


# ─── Region sampling ─────────────────────────────────────────

def _disc_mean(rgb: np.ndarray, cy: int, cx: int, radius: int) -> np.ndarray:
    """Median colour of a solid disc (robust to printed text/edges)."""
    h, w = rgb.shape[:2]
    y0, y1 = max(0, cy - radius), min(h, cy + radius + 1)
    x0, x1 = max(0, cx - radius), min(w, cx + radius + 1)
    yy, xx = np.mgrid[y0:y1, x0:x1]
    m = (yy - cy) ** 2 + (xx - cx) ** 2 <= radius ** 2
    pixels = rgb[y0:y1, x0:x1][m].reshape(-1, 3)
    return np.median(pixels, axis=0)


def _grid_median(rgb: np.ndarray, box, fx=0.24, fy=0.26,
                 nx=4, ny=4, radius=14, drop_near_white: bool = False) -> np.ndarray:
    """Median colour of an n x n point grid inside the central region of box.

    The fractional margin (fx/fy) keeps samples inside the coloured fill even
    with modest rectification error.  Per-point medians tolerate printed text;
    optionally near-white points (text / backing) are dropped.
    """
    x0, y0, x1, y1 = box
    xa, xb = x0 + (x1 - x0) * fx, x1 - (x1 - x0) * fx
    ya, yb = y0 + (y1 - y0) * fy, y1 - (y1 - y0) * fy
    samples = []
    for i in range(nx):
        for j in range(ny):
            cx = int(xa + (xb - xa) * i / max(nx - 1, 1))
            cy = int(ya + (yb - ya) * j / max(ny - 1, 1))
            col = _disc_mean(rgb, cy, cx, radius)
            if drop_near_white and col.min() > 235:
                continue
            samples.append(col)
    return np.median(np.stack(samples), axis=0)


def sample_strip(rgb: np.ndarray) -> np.ndarray:
    return _grid_median(rgb, L.STRIP_BOX, fx=0.16, fy=0.18,
                        nx=5, ny=5, radius=16)


def _detect_scale_circles(rgb: np.ndarray) -> list[tuple[int, int]] | None:
    """Locate the 7 reference patches with Hough circles (deterministic)."""
    x0, y0, x1, y1 = L.REF_SCALE_BOX
    pad = 26
    crop = rgb[max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad]
    gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)
    gray = cv2.medianBlur(gray, 5)
    h = crop.shape[0]
    circles = cv2.HoughCircles(
        gray, cv2.HOUGH_GRADIENT, dp=1.2,
        minDist=int((x1 - x0) / L.REF_PATCH_COUNT * 0.7),
        param1=120, param2=18,
        minRadius=int(h * 0.16), maxRadius=int(h * 0.42),
    )
    if circles is None:
        return None
    circs = np.round(circles[0]).astype(int).tolist()
    expected_y = (y0 + y1) // 2 - (y0 - pad)
    # Keep circles on the scale's horizontal centreline.
    circs = [c for c in circs if abs(c[1] - expected_y) < h * 0.32]
    circs.sort(key=lambda c: c[0])
    # Prune extras (duplicate detections) by removing the circle with the
    # smallest gap to a neighbour until exactly the expected count remains.
    while len(circs) > L.REF_PATCH_COUNT:
        gaps = [circs[i + 1][0] - circs[i][0] for i in range(len(circs) - 1)]
        idx = int(np.argmin(gaps))
        circs.pop(idx if gaps[idx] < (gaps[idx - 1] if idx else 10**9) else idx + 1)
    if len(circs) != L.REF_PATCH_COUNT:
        return None
    ox, oy = max(0, x0 - pad), max(0, y0 - pad)
    return [(int(c[0] + ox), int(c[1] + oy)) for c in circs]


def sample_expiry(rgb: np.ndarray) -> np.ndarray:
    return _grid_median(rgb, L.EXPIRY_BOX, drop_near_white=True)


def sample_env(rgb: np.ndarray) -> np.ndarray:
    return _grid_median(rgb, L.ENV_BOX)


# ─── QR ──────────────────────────────────────────────────────

def decode_qr(rgb: np.ndarray) -> str | None:
    x0, y0, x1, y1 = L.QR_BOX
    pad = 12
    crop = rgb[max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad]
    bgr = cv2.cvtColor(crop, cv2.COLOR_RGB2BGR)
    detector = cv2.QRCodeDetector()
    try:
        text, _, _ = detector.detectAndDecode(bgr)
    except cv2.error:
        return None
    return text.strip() or None


# ─── Quality checks ──────────────────────────────────────────

def _quality_checks(rgb: np.ndarray) -> tuple[float, float]:
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    # Restrict to the interior of the card to avoid border effects.
    interior = gray[60:-60, 60:-60]
    brightness = float(interior.mean())
    blur_score = float(cv2.Laplacian(interior, cv2.CV_64F).var())
    if brightness < L.MIN_BRIGHTNESS:
        raise CVError("TOO_DARK",
                      "Image is too dark. Move to better lighting and try again.")
    if brightness > L.MAX_BRIGHTNESS:
        raise CVError("TOO_BRIGHT",
                      "Image is over-exposed. Avoid strong glare on the wristband.")
    if blur_score < L.MIN_BLUR_VARIANCE:
        raise CVError("BLURRY",
                      "Image is blurred. Hold steady and focus on the wristband.")
    return brightness, blur_score


# ─── Main entry point ────────────────────────────────────────

BASELINE_LAB = rgb_to_lab(np.array([[chem.STRIP_BASE_SRGB]]))[0, 0]
ENV_BASE_LAB = rgb_to_lab(np.array([[L.ENV_BASE_SRGB]]))[0, 0]
VALID_LAB = rgb_to_lab(np.array([[L.EXPIRY_VALID_SRGB]]))[0, 0]
EXPIRED_LAB = rgb_to_lab(np.array([[L.EXPIRY_EXPIRED_SRGB]]))[0, 0]


def process_image(image_bgr: np.ndarray) -> PipelineResult:
    """Run the full deterministic pipeline on a BGR image (cv2 convention)."""
    if image_bgr is None or image_bgr.size == 0:
        raise CVError("INVALID_IMAGE", "No image data was received.")

    rgb, _method = rectify(image_bgr)
    brightness, blur_score = _quality_checks(rgb)
    rectified_rgb = rgb.copy()

    # ── Reference scale -> lighting/colour correction ──
    hough_centers = _detect_scale_circles(rgb)
    expected_ref = np.array(L.REFERENCE_SRGB, dtype=np.float64)
    luma_w = np.array([0.299, 0.587, 0.114])

    def _evaluate(centers):
        measured = np.stack([
            _disc_mean(rgb, cy, cx, L.REF_PATCH_SAMPLE_RADIUS + 3)
            for cx, cy in centers
        ])
        luma = measured @ luma_w
        ordered = float(np.diff(luma).max()) <= 12
        coeffs = fit_channel_affine(measured, expected_ref)
        corrected = apply_channel_affine(measured, coeffs)
        res = float(np.sqrt(((corrected - expected_ref) ** 2).mean()))
        return measured, coeffs, res, ordered

    centers_fallback = list(L.REF_PATCH_CENTERS)
    candidates = [hough_centers, centers_fallback] if hough_centers else [centers_fallback]

    measured_ref = coeffs = None
    residual = 1e9
    chosen_centers = centers_fallback
    for centers in candidates:
        measured_ref, coeffs, res, ordered = _evaluate(centers)
        if ordered and res <= 14:
            residual = res
            chosen_centers = list(centers)
            break
    if residual > 14:
        raise CVError(
            "REFERENCE_NOT_DETECTED",
            "Reference scale not detected or unreadable. Please reposition the "
            "wristband inside the capture guide, improve the lighting and retry.",
        )

    # ── Strip ──
    raw_strip = sample_strip(rgb)
    strip_rgb = apply_channel_affine(raw_strip, coeffs)
    strip_lab = rgb_to_lab(strip_rgb.reshape(1, 1, 3))[0, 0]
    if float(strip_lab[0]) > 98 and delta_e76(strip_lab, BASELINE_LAB) < 3:
        raise CVError(
            "STRIP_NOT_DETECTED",
            "Reactive strip not detected. Please align the wristband with "
            "the capture guide and try again.",
        )
    dE = delta_e2000(strip_lab, BASELINE_LAB)

    # ── Sealed environmental reference cell ──
    raw_env = sample_env(rgb)
    env_rgb = apply_channel_affine(raw_env, coeffs)
    env_lab = rgb_to_lab(env_rgb.reshape(1, 1, 3))[0, 0]
    dE_env = delta_e2000(env_lab, ENV_BASE_LAB)

    # ── Expiry patch ──
    raw_exp = sample_expiry(rgb)
    exp_rgb = apply_channel_affine(raw_exp, coeffs)
    exp_lab = rgb_to_lab(exp_rgb.reshape(1, 1, 3))[0, 0]
    d_valid = delta_e76(exp_lab, VALID_LAB)
    d_expired = delta_e76(exp_lab, EXPIRED_LAB)
    if min(d_valid, d_expired) > 45:
        raise CVError(
            "EXPIRY_PATCH_NOT_DETECTED",
            "Expiry patch not detected. Please reposition the wristband and try again.",
        )
    if d_valid < d_expired:
        expiry_status, confidence = "VALID", float(d_expired - d_valid)
    else:
        expiry_status, confidence = "EXPIRED", float(d_valid - d_expired)
    if abs(d_valid - d_expired) < L.EXPIRY_DECISION_MARGIN:
        raise CVError(
            "EXPIRY_PATCH_UNREADABLE",
            "The expiry patch cannot be read reliably. Improve lighting and retry.",
        )

    band_id = decode_qr(rgb)

    features = {
        "L": float(strip_lab[0]),
        "a": float(strip_lab[1]),
        "b": float(strip_lab[2]),
        "delta_e": float(dE),
        "delta_e_env": float(dE_env),
    }

    return PipelineResult(
        ok=True,
        band_id_qr=band_id,
        expiry_status=expiry_status,
        expiry_confidence=round(confidence, 2),
        strip_rgb=[round(float(v), 2) for v in strip_rgb],
        strip_lab=[round(float(v), 2) for v in strip_lab],
        env_rgb=[round(float(v), 2) for v in env_rgb],
        env_lab=[round(float(v), 2) for v in env_lab],
        delta_e=round(float(dE), 3),
        delta_e_env=round(float(dE_env), 3),
        reference_measured=[[round(float(v), 1) for v in row] for row in measured_ref],
        reference_expected=[list(map(float, row)) for row in L.REFERENCE_SRGB],
        correction_residual=round(residual, 3),
        brightness=round(brightness, 2),
        blur_score=round(blur_score, 2),
        features={k: round(v, 4) for k, v in features.items()},
        rectified_rgb=rectified_rgb,
        detected_centers=chosen_centers,
    )


def process_file_bytes(data: bytes) -> PipelineResult:
    arr = np.frombuffer(data, np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise CVError("INVALID_IMAGE", "The uploaded file is not a readable image.")
    return process_image(bgr)
