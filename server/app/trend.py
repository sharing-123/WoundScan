"""Healing trend for one pseudonymous patient: area over time, percent reduction, linear rate."""
from datetime import datetime

import numpy as np


def _t(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def healing_trend(cases):
    pts = sorted([c for c in cases if c.get("calibrated") and c.get("area_cm2") is not None], key=lambda c: c["captured_at"])
    series = []
    if pts:
        t0 = _t(pts[0]["captured_at"])
        for c in pts:
            days = (_t(c["captured_at"]) - t0).total_seconds() / 86400.0
            series.append({"id": c["id"], "captured_at": c["captured_at"], "day": round(days, 2), "area_cm2": c["area_cm2"]})
    out = {"n": len(series), "series": series, "percent_reduction_from_first": None, "rate_cm2_per_week": None, "rate_percent_per_week": None, "note": None}
    if len(series) < 2:
        out["note"] = "At least two calibrated measurements on different days are needed for a trend."
        return out
    a0, a1 = series[0]["area_cm2"], series[-1]["area_cm2"]
    days = np.array([s["day"] for s in series]); area = np.array([s["area_cm2"] for s in series])
    out["percent_reduction_from_first"] = round(100.0 * (a0 - a1) / a0, 1) if a0 > 0 else None
    if days.max() - days.min() >= 1:
        slope = float(np.polyfit(days, area, 1)[0]) * 7.0
        out["rate_cm2_per_week"] = round(slope, 3)
        out["rate_percent_per_week"] = round(100.0 * slope / a0, 1) if a0 > 0 else None
    else:
        out["note"] = "Measurements are on the same day; a rate needs a time span."
    out["note"] = out["note"] or "Descriptive trend from photo measurements; not a clinical prognosis."
    return out
