"""Automatic scale: a detected ID-1 card if one is in the photo, otherwise camera optics plus a typical shooting distance."""
import math

import cv2
import numpy as np

CARD_LONG_MM = 85.6
CARD_SHORT_MM = 53.98
CARD_RATIO = CARD_LONG_MM / CARD_SHORT_MM
ASSUMED_DISTANCE_CM = 30.0
DEFAULT_F35 = 26.0  # main camera of most phones, 35 mm equivalent
SENSOR_LONG_MM_35 = 36.0


def detect_card(rgb: np.ndarray, mask: np.ndarray):
    """Find a credit-card shaped, flat-coloured rectangle outside the wound. Returns None when unsure."""
    h, w = mask.shape
    g = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    g = cv2.GaussianBlur(g, (5, 5), 0)
    edges = cv2.Canny(g, 40, 120)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8))
    cnts, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    best = None
    wound_area = float(mask.sum())
    for c in cnts:
        a = cv2.contourArea(c)
        if a < 0.012 * w * h or a > 0.45 * w * h:
            continue
        peri = cv2.arcLength(c, True)
        poly = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(poly) != 4 or not cv2.isContourConvex(poly):
            continue
        (cx, cy), (rw, rh), ang = cv2.minAreaRect(poly)
        long_, short_ = max(rw, rh), max(min(rw, rh), 1e-6)
        ratio = long_ / short_
        if not 1.50 <= ratio <= 1.66:
            continue
        fill = cv2.contourArea(poly) / (long_ * short_)
        if fill < 0.93:
            continue
        box = np.zeros(mask.shape, np.uint8)
        cv2.fillConvexPoly(box, poly.reshape(-1, 2).astype(np.int32), 1)
        if (box.astype(bool) & mask).sum() > 0.02 * max(wound_area, 1):
            continue
        # a printed card is mostly flat colour, a dressing or sheet is not necessarily: soft check only
        inner = g[box.astype(bool)]
        flat = float(np.std(inner)) / 255.0
        score = fill * (1.0 - min(abs(ratio - CARD_RATIO) / 0.1, 1.0)) * (1.0 - min(flat * 2.0, 0.6)) * min(a / (0.05 * w * h), 1.0)
        if best is None or score > best[0]:
            best = (score, long_, short_, ratio, poly.reshape(-1, 2).tolist())
    if best is None or best[0] < 0.30:
        return None
    return {"score": best[0], "long_px": best[1], "short_px": best[2], "ratio": best[3], "corners": best[4]}


def auto_scale(rgb: np.ndarray, mask: np.ndarray, f35_mm):
    h, w = mask.shape
    card = detect_card(rgb, mask)
    if card:
        mm = CARD_LONG_MM / card["long_px"]
        return {"source": "card", "mm_per_pixel": mm, "uncertainty_percent": 6, "detail": {"score": round(card["score"], 2), "corners": card["corners"]}}
    f = f35_mm or DEFAULT_F35
    mm = (ASSUMED_DISTANCE_CM * 10.0) * SENSOR_LONG_MM_35 / (f * max(w, h))
    return {"source": "assumed_distance", "mm_per_pixel": mm, "uncertainty_percent": 30,
            "detail": {"distance_cm": ASSUMED_DISTANCE_CM, "f35_mm": f, "from_exif": bool(f35_mm)}}
