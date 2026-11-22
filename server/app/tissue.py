"""Colour-based wound bed composition and peri-wound signs, relative to the patient's own surrounding skin.
These are appearance estimates from one photograph, not histology."""
import cv2
import numpy as np

NAMES = {1: "granulation", 2: "slough", 3: "necrosis", 4: "epithelium"}
OVERLAY = {1: (255, 61, 99, 150), 2: (255, 210, 63, 160), 3: (52, 30, 92, 190), 4: (255, 182, 200, 110)}


def to_lab(rgb: np.ndarray) -> np.ndarray:
    """Standard CIE Lab (L 0-100, a/b about -128..127) as float32 from an RGB uint8 image."""
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    lab[..., 0] *= 100.0 / 255.0
    lab[..., 1] -= 128.0
    lab[..., 2] -= 128.0
    return lab


def skin_reference(lab: np.ndarray, mask: np.ndarray):
    """Median Lab of the skin ring around the wound; falls back to a typical value."""
    area = int(mask.sum())
    d = cv2.distanceTransform((~mask).astype(np.uint8), cv2.DIST_L2, 3)
    dmax = max(18.0, 0.4 * np.sqrt(area))
    ring = (~mask) & (d >= 4) & (d <= dmax)
    if ring.sum() > 200:
        v = lab[ring]
        return np.median(v, axis=0), d
    return np.array([65.0, 14.0, 18.0], np.float32), d


def classify(rgb: np.ndarray, mask: np.ndarray):
    """Return (label map 0..4, percentages, skin Lab). Rules follow the earlier browser version."""
    lab = to_lab(rgb)
    skin, d = skin_reference(lab, mask)
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    C = np.hypot(a, b)
    hue = np.degrees(np.arctan2(b, a))
    da = a - skin[1]
    labels = np.zeros(mask.shape, np.uint8)
    nec = (L < 20) | ((L < 36) & (C < 24)) | ((L < skin[0] * 0.5) & (C < 26))
    slo1 = (hue > 52) & (C > 16) & (L > 38) & (a < 20)
    slo2 = (L > 68) & ((b - skin[2]) > 9) & (da < 6)
    gran = (da > 12) & (hue < 52)
    lab_map = np.where(nec, 3, np.where(slo1 | slo2, 2, np.where(gran, 1, 4))).astype(np.uint8)
    labels[mask] = lab_map[mask]
    cnt = np.array([(labels == k).sum() for k in (1, 2, 3, 4)], np.float64)
    tot = max(cnt.sum(), 1.0)
    pct = {"granulation": 100 * cnt[0] / tot, "slough": 100 * cnt[1] / tot, "necrosis": 100 * cnt[2] / tot, "epithelium": 100 * cnt[3] / tot}
    return labels, pct, skin


def overlay_rgba(labels: np.ndarray) -> np.ndarray:
    out = np.zeros(labels.shape + (4,), np.uint8)
    for k, c in OVERLAY.items():
        out[labels == k] = c
    return out


def signs(rgb: np.ndarray, mask: np.ndarray, pct: dict, skin: np.ndarray, mm_per_px):
    """Peri-wound erythema (extent), maceration and a possible purulent/green slough cue."""
    lab = to_lab(rgb)
    area = float(mask.sum())
    r = np.sqrt(area)
    d = cv2.distanceTransform((~mask).astype(np.uint8), cv2.DIST_L2, 3)
    a_s = cv2.GaussianBlur(lab[..., 1], (0, 0), max(1.5, r * 0.02))
    near = (~mask) & (d >= 3) & (d <= max(8.0, 0.35 * r))
    far = (~mask) & (d >= 0.8 * r + 12) & (d <= 1.8 * r + 30)
    ref_a = float(np.median(lab[far][:, 1])) if far.sum() > 300 else float(skin[1])
    ref_L = float(np.median(lab[far][:, 0])) if far.sum() > 300 else float(skin[0])
    out = {"erythema": False, "erythema_extent_px": 0.0, "erythema_extent_cm": None, "maceration": False, "possible_purulent": False}
    if near.sum() > 100:
        excess = float(np.median(a_s[near]) - ref_a)
        out["erythema_excess"] = excess
        if excess >= 7:
            out["erythema"] = True
            red = (a_s - ref_a > 6) & (~mask) & (d <= 2.2 * r + 40)
            if red.any():
                ext = float(d[red].max())
                out["erythema_extent_px"] = ext
                if mm_per_px:
                    out["erythema_extent_cm"] = ext * mm_per_px / 10.0
        Lm = float(np.median(lab[near][:, 0]))
        Cm = float(np.median(np.hypot(lab[near][:, 1], lab[near][:, 2])))
        Cf = float(np.median(np.hypot(lab[far][:, 1], lab[far][:, 2]))) if far.sum() > 300 else float(np.hypot(skin[1], skin[2]))
        out["maceration"] = bool(Lm - ref_L > 8 and Cm < Cf - 4)
    inside = lab[mask]
    if len(inside):
        hue = np.degrees(np.arctan2(inside[:, 2], inside[:, 1]))
        C = np.hypot(inside[:, 1], inside[:, 2])
        green = float(((hue > 70) & (hue < 115) & (C > 18) & (inside[:, 0] > 35)).mean())
        out["green_fraction"] = green
        out["possible_purulent"] = bool(green > 0.12 or (pct["slough"] > 45 and out["erythema"]))
    return out


def depth_class(pct: dict) -> str:
    """Appearance-based depth category. A photograph cannot give depth in centimetres."""
    if pct["necrosis"] >= 20 or pct["slough"] >= 55:
        return "full_devitalised"
    if pct["granulation"] >= 50:
        return "full_granulating"
    if pct["epithelium"] >= 55 and pct["granulation"] < 30:
        return "partial"
    return "indeterminate"
