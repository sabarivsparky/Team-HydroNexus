"""Canonical wristband-face geometry.

This module is the *single source of truth* for where every feature lives on
the printed wristband card.  Both the synthetic image generator
(``ml/simulator/band_simulator.py``) and the deterministic computer-vision
pipeline (``app/cv/pipeline.py``) import these constants, so the detector
always samples exactly the regions the printer rendered.

Coordinate system: canonical (rectified) card image, CANONICAL_W x CANONICAL_H
pixels, origin top-left.
"""

from __future__ import annotations

# ─── Rectified card dimensions ───────────────────────────────
CANONICAL_W = 1200
CANONICAL_H = 800
CARD_MARGIN = 28  # white margin kept inside the rectified image

# ─── ArUco fiducial markers (DICT_4X4_50, ids 1..4) ──────────
# Four markers sit just inside the card corners and give the CV pipeline
# robust corner correspondences for the perspective transform.
ARUCO_DICT = "DICT_4X4_50"
ARUCO_IDS = (1, 2, 3, 4)  # top-left, top-right, bottom-right, bottom-left
ARUCO_SIZE = 110
ARUCO_INSET = 24
ARUCO_CENTERS = (
    (ARUCO_INSET + ARUCO_SIZE // 2, ARUCO_INSET + ARUCO_SIZE // 2),            # TL id 1
    (CANONICAL_W - ARUCO_INSET - ARUCO_SIZE // 2, ARUCO_INSET + ARUCO_SIZE // 2),  # TR id 2
    (CANONICAL_W - ARUCO_INSET - ARUCO_SIZE // 2,
     CANONICAL_H - ARUCO_INSET - ARUCO_SIZE // 2),                            # BR id 3
    (ARUCO_INSET + ARUCO_SIZE // 2,
     CANONICAL_H - ARUCO_INSET - ARUCO_SIZE // 2),                            # BL id 4
)
# Ordered TL, TR, BR, BL (used to build the homography).
MARKER_ORDER = (1, 2, 3, 4)

# ─── Reactive H2S strip (left half of the card) ──────────────
STRIP_BOX = (150, 165, 560, 520)            # x0, y0, x1, y1
STRIP_SAMPLE_INSET = 36                      # ignore the printed border
STRIP_LABEL_BOX = (150, 120, 560, 155)

# ─── Printed reference color scale (7 neutral patches) ───────
REF_SCALE_BOX = (630, 200, 1146, 290)        # container strip
REF_PATCH_COUNT = 7
REF_PATCH_RADIUS = 31
_REF_X0, _REF_Y0, _REF_X1, _REF_Y1 = REF_SCALE_BOX
_REF_STEP = (_REF_X1 - _REF_X0) / REF_PATCH_COUNT
REF_PATCH_CENTERS = tuple(
    (
        int(_REF_X0 + _REF_STEP * (i + 0.5)),
        int((_REF_Y0 + _REF_Y1) / 2),
    )
    for i in range(REF_PATCH_COUNT)
)
REF_PATCH_SAMPLE_RADIUS = 15
# Known *printed* sRGB values (light -> dark neutral gray ramp).
# These are the calibration references used for lighting correction.
REFERENCE_SRGB: tuple[tuple[int, int, int], ...] = (
    (238, 238, 238),
    (214, 214, 214),
    (188, 188, 188),
    (160, 160, 160),
    (132, 132, 132),
    (102, 102, 102),
    (66, 66, 66),
)
REF_LABEL_BOX = (630, 158, 1146, 190)

# ─── Expiry / shelf-life patch ───────────────────────────────
EXPIRY_BOX = (630, 360, 850, 520)
EXPIRY_SAMPLE_RADIUS = 42
EXPIRY_LABEL_BOX = (630, 322, 850, 352)
# Template patch colours (sRGB) printed for the two states.
EXPIRY_VALID_SRGB = (47, 158, 91)
EXPIRY_EXPIRED_SRGB = (184, 63, 63)

# ─── Optional sealed environmental reference cell ────────────
# Shielded from H2S but exposed to temperature/humidity; it lets the
# pipeline estimate environmental drift optically.
ENV_BOX = (900, 360, 1146, 520)
ENV_SAMPLE_RADIUS = 42
ENV_LABEL_BOX = (900, 322, 1146, 352)
ENV_BASE_SRGB = (226, 214, 178)  # matches the unexposed reactive strip

# ─── QR code + band identifier (bottom band) ─────────────────
# Kept clear of the bottom-left fiducial marker (which spans x 24–134).
QR_BOX = (170, 560, 370, 770)
BAND_ID_TEXT_POS = (410, 610)
BAND_META_TEXT_POS = (410, 660)
BAND_META2_TEXT_POS = (410, 704)
ENV_NOTE_TEXT_POS = (410, 748)

# ─── Quality-control thresholds ──────────────────────────────
MIN_BRIGHTNESS = 45      # mean luma below this -> image too dark
MAX_BRIGHTNESS = 235     # mean luma above this -> image too bright / washed out
MIN_BLUR_VARIANCE = 40.0  # Laplacian variance below this -> blurred

# Expiry decision margins (CIE76 distance in Lab).
EXPIRY_DECISION_MARGIN = 8.0
