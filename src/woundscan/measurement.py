"""Calibrated pixel-cell geometry with explicit units."""
from dataclasses import asdict, dataclass
import math
import numpy as np


def _positive(value, name):
    try:
        value = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{name} must be a positive finite number") from None
    if not math.isfinite(value) or value <= 0:
        raise ValueError(f"{name} must be a positive finite number")
    return value


def reference_scale(reference_pixels: float, reference_mm: float) -> float:
    """Return millimetres per pixel from a coplanar reference length."""
    return _positive(reference_mm, "reference_mm") / _positive(reference_pixels, "reference_pixels")


def body_surface_area(height_cm: float, weight_kg: float) -> float:
    """Mosteller body surface area, in square metres."""
    return math.sqrt(_positive(height_cm, "height_cm") * _positive(weight_kg, "weight_kg") / 3600)


@dataclass(frozen=True)
class Measurement:
    """Pixel-cell area/perimeter, including holes and disconnected components."""
    area_mm2: float
    perimeter_mm: float
    foreground_pixels: int
    mm_per_pixel: float
    tbsa_percent: float | None = None

    def to_dict(self) -> dict:
        """Return JSON-serializable scalar values."""
        return asdict(self)


def measure_mask(mask, mm_per_pixel: float, *, height_cm=None, weight_kg=None) -> Measurement:
    """Measure a nonempty 2D boolean or binary 0/1 mask.

    Perimeter counts exposed pixel edges, NOT a smooth subpixel contour.
    This lattice perimeter is orientation dependent and differs from the browser
    contour method. Empty foreground is allowed and measures zero.
    """
    scale = _positive(mm_per_pixel, "mm_per_pixel")
    a = np.asarray(mask)
    if a.ndim != 2 or not a.size or a.dtype.kind not in "buif" or not np.isin(a, [0, 1]).all():
        raise ValueError("mask must be a nonempty 2D array containing only 0 and 1")
    a = np.pad(a.astype(np.int8), 1)
    count = int(a.sum())
    edges = int(np.abs(np.diff(a, axis=0)).sum() + np.abs(np.diff(a, axis=1)).sum())
    if (height_cm is None) != (weight_kg is None):
        raise ValueError("height_cm and weight_kg must be supplied together")
    area = count * scale**2
    tbsa = None if height_cm is None else 100 * area / (body_surface_area(height_cm, weight_kg) * 1_000_000)
    return Measurement(area, edges * scale, count, scale, tbsa)
