"""Calibration, geometry and quality warnings for a wound mask. Uses the published woundscan package for area/TBSA."""
import math
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
from woundscan.measurement import body_surface_area, measure_mask  # noqa: E402

SENSOR_LONG_SIDE_MM_35 = 36.0  # full-frame long side; used with the 35 mm-equivalent focal length


class CalibrationError(ValueError):
    pass


def scale_from_reference(p1, p2, ref_mm, width, height):
    """Two normalised points (0-1) on a coplanar reference of known length -> mm per pixel."""
    if ref_mm is None or ref_mm <= 0:
        raise CalibrationError("reference length must be positive")
    dx, dy = (p1[0] - p2[0]) * width, (p1[1] - p2[1]) * height
    d = math.hypot(dx, dy)
    if d < 8:
        raise CalibrationError("the two reference points are too close together")
    return ref_mm / d, "reference"


def scale_from_distance(distance_cm, f35_mm, width, height):
    """Pinhole estimate from camera distance and 35 mm-equivalent focal length (EXIF)."""
    if not distance_cm or distance_cm <= 0 or not f35_mm or f35_mm <= 0:
        raise CalibrationError("distance and a 35 mm-equivalent focal length are required")
    long_px = max(width, height)
    return (distance_cm * 10.0) * SENSOR_LONG_SIDE_MM_35 / (f35_mm * long_px), "distance"


def contours_of(mask):
    cnts, hier = cv2.findContours(mask.astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    return cnts, (hier[0] if hier is not None else [])


def analyse(mask, prob, mm_per_px, height_cm=None, weight_kg=None):
    """Return the measurement dict. mm_per_px may be None (uncalibrated)."""
    h, w = mask.shape
    count = int(mask.sum())
    out = {"foreground_pixels": count, "image_fraction": count / float(h * w), "empty": count == 0}
    if count == 0:
        out["calibrated"] = bool(mm_per_px)
        if mm_per_px:
            out["mm_per_pixel"] = mm_per_px
        out["contours"] = []
        out["warnings"] = ["No wound found at this threshold."]
        if not mm_per_px:
            out["warnings"].append("No scale reference: only pixel and relative values are reported, not cm².")
        return out
    cnts, hier = contours_of(mask)
    outer = [c for c, hh in zip(cnts, hier) if hh[3] < 0]
    holes = [c for c, hh in zip(cnts, hier) if hh[3] >= 0]
    perim_px = sum(cv2.arcLength(c, True) for c in outer) + sum(cv2.arcLength(c, True) for c in holes)
    big = max(outer, key=cv2.contourArea)
    m = cv2.moments(mask.astype(np.uint8), binaryImage=True)
    cx, cy = m["m10"] / m["m00"], m["m01"] / m["m00"]
    (rx, ry), (rw, rh), ang = cv2.minAreaRect(big)
    length_px, width_px = max(rw, rh), max(min(rw, rh), 1e-6)
    hull = cv2.convexHull(big)
    solidity = float(cv2.contourArea(big) / max(cv2.contourArea(hull), 1e-6))
    # orientation of the long axis in image coordinates, degrees in [0,180)
    theta = ang if rw >= rh else ang + 90
    out.update({
        "centroid": [cx / w, cy / h],
        "bbox": [float(v) for v in (np.array(cv2.boundingRect(big)) / [w, h, w, h])],
        "long_axis_deg": float(theta % 180),
        "elongation": float(length_px / width_px),
        "solidity": solidity,
        "components": len(outer),
        "perimeter_px": float(perim_px),
        "mean_probability": float(prob[mask].mean()),
        "uncertain_fraction": float(((prob > 0.3) & (prob < 0.7))[cv2.dilate(mask.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0].mean()),
    })
    polys = []
    for c in outer:
        eps = max(0.0015 * cv2.arcLength(c, True), 0.6)
        a = cv2.approxPolyDP(c, eps, True)[:, 0, :].astype(np.float64)
        if len(a) >= 3:
            polys.append((a / [w, h]).round(5).tolist())
    out["contours"] = polys
    warns = []
    if mm_per_px:
        mm = measure_mask(mask.astype(np.uint8), mm_per_px, height_cm=height_cm, weight_kg=weight_kg)
        out.update({
            "calibrated": True, "mm_per_pixel": mm_per_px,
            "area_mm2": mm.area_mm2, "area_cm2": mm.area_mm2 / 100.0,
            "perimeter_mm": perim_px * mm_per_px,
            "length_mm": length_px * mm_per_px, "width_mm": width_px * mm_per_px,
            "tbsa_percent": mm.tbsa_percent,
            "bsa_m2": body_surface_area(height_cm, weight_kg) if height_cm and weight_kg else None,
            "area_uncertainty_percent": [4, 20],
        })
    else:
        out["calibrated"] = False
        warns.append("No scale reference: only pixel and relative values are reported, not cm².")
    ys, xs = np.nonzero(mask)
    if xs.min() <= 1 or ys.min() <= 1 or xs.max() >= w - 2 or ys.max() >= h - 2:
        warns.append("The wound touches the image edge, so the area may be truncated.")
    if out["image_fraction"] < 0.004:
        warns.append("Very small region (<0.4% of the frame): small wounds are the model's known weakness.")
    if out["mean_probability"] < 0.7:
        warns.append("Low model confidence inside the contour; check the outline by hand.")
    if len(outer) > 3:
        warns.append("Several separate regions found; confirm they are all wound.")
    out["warnings"] = warns
    return out
