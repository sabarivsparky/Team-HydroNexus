"""Draw the detected regions over the rectified card for the result screen."""

from __future__ import annotations

import cv2
import numpy as np

from app.cv import layout as L


def annotate(rectified_rgb: np.ndarray,
             ref_centers: list[tuple[int, int]] | None = None,
             expiry_status: str = "VALID") -> np.ndarray:
    vis = rectified_rgb.copy()
    ok_color = (46, 160, 90)
    bad_color = (200, 60, 60)

    # Reactive strip
    x0, y0, x1, y1 = L.STRIP_BOX
    cv2.rectangle(vis, (x0, y0), (x1, y1), (30, 110, 220), 3)
    cv2.putText(vis, "STRIP", (x0, y0 - 10), cv2.FONT_HERSHEY_SIMPLEX,
                0.7, (30, 110, 220), 2, cv2.LINE_AA)

    # Reference patches
    centers = ref_centers or list(L.REF_PATCH_CENTERS)
    for cx, cy in centers:
        cv2.circle(vis, (cx, cy), L.REF_PATCH_RADIUS + 5, (200, 130, 20), 2)
    cv2.putText(vis, "REFERENCE", (L.REF_SCALE_BOX[0], L.REF_SCALE_BOX[1] - 12),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 130, 20), 2, cv2.LINE_AA)

    # Expiry
    col = ok_color if expiry_status == "VALID" else bad_color
    x0, y0, x1, y1 = L.EXPIRY_BOX
    cv2.rectangle(vis, (x0, y0), (x1, y1), col, 3)

    # Env cell + QR
    cv2.rectangle(vis, (L.ENV_BOX[0], L.ENV_BOX[1]),
                  (L.ENV_BOX[2], L.ENV_BOX[3]), (120, 90, 200), 3)
    cv2.rectangle(vis, (L.QR_BOX[0], L.QR_BOX[1]),
                  (L.QR_BOX[2], L.QR_BOX[3]), (60, 60, 60), 3)
    return vis
