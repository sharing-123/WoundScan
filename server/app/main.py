"""WoundScan API. Everything runs on this machine: photos are processed in memory and only the small thumbnail and
numbers of a case you choose to save are written to the local SQLite file."""
import base64
import csv
import io
import json
import time
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageOps

from . import db
from .inference import OnnxSegmenter, postprocess
from .measure import CalibrationError, analyse, scale_from_distance, scale_from_reference
from .models import DEFAULT_MODEL, registry
from .trend import healing_trend
from . import tissue as tis
from .scale import auto_scale
from .woundtype import WoundTyper

MAX_BYTES = 15 * 1024 * 1024
MAX_SIDE = 1600
Image.MAX_IMAGE_PIXELS = 80_000_000
ROOT = Path(__file__).resolve().parents[2]
WEB_DIST = ROOT / "web" / "dist"

app = FastAPI(title="WoundScan API", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["*"], allow_headers=["*"])

_segmenters: dict = {}
_typer = None


def typer() -> WoundTyper:
    global _typer
    if _typer is None:
        _typer = WoundTyper()
    return _typer


def segmenter(name: str) -> OnnxSegmenter:
    reg = registry()
    if name not in reg:
        raise HTTPException(404, f"unknown model '{name}'")
    if name not in _segmenters:
        try:
            _segmenters[name] = OnnxSegmenter(reg[name]["file"])
        except FileNotFoundError:
            raise HTTPException(503, f"model file for '{name}' is not installed on this machine")
    return _segmenters[name]


def decode_image(data: bytes):
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "image larger than 15 MB")
    try:
        im = Image.open(io.BytesIO(data))
        f35 = None
        try:
            f35 = im.getexif().get_ifd(0x8769).get(0xA405)  # FocalLengthIn35mmFilm
        except Exception:
            pass
        im = ImageOps.exif_transpose(im).convert("RGB")
    except Exception:
        raise HTTPException(400, "could not read the image (use JPEG, PNG or WebP)")
    if max(im.size) > MAX_SIDE:
        s = MAX_SIDE / max(im.size)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    return np.asarray(im), (float(f35) if f35 else None)


def png_b64(arr: np.ndarray) -> str:
    ok, buf = cv2.imencode(".png", arr)
    return "data:image/png;base64," + base64.b64encode(buf.tobytes()).decode()


def jpeg_thumb(rgb: np.ndarray, side=480) -> bytes:
    h, w = rgb.shape[:2]
    s = side / max(h, w)
    small = cv2.resize(rgb, (max(1, round(w * s)), max(1, round(h * s))), interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", cv2.cvtColor(small, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 82])
    return buf.tobytes()


@app.get("/api/health")
def health():
    reg = registry()
    return {"status": "ok", "models": {k: Path(v["file"]).is_file() for k, v in reg.items()}, "database": db.DB_PATH.name}


@app.get("/api/models")
def models():
    out = []
    for k, v in registry().items():
        out.append({"id": k, "label": v["label"], "input": v["input"], "summary": v["summary"], "metrics": v["metrics"],
                    "installed": Path(v["file"]).is_file(), "default": k == DEFAULT_MODEL})
    return out


@app.post("/api/analyze")
async def analyze(
    image: UploadFile = File(...),
    model: str = Form(DEFAULT_MODEL),
    threshold: float = Form(0.5),
    clean: bool = Form(True),
    tta: bool = Form(True),
    ref_mm: Optional[float] = Form(None),
    ref_x1: Optional[float] = Form(None), ref_y1: Optional[float] = Form(None),
    ref_x2: Optional[float] = Form(None), ref_y2: Optional[float] = Form(None),
    distance_cm: Optional[float] = Form(None),
    f35_mm: Optional[float] = Form(None),
    height_cm: Optional[float] = Form(None),
    weight_kg: Optional[float] = Form(None),
    include_images: bool = Form(True),
):
    if not 0.05 <= threshold <= 0.95:
        raise HTTPException(422, "threshold must be between 0.05 and 0.95")
    if (height_cm is None) != (weight_kg is None):
        raise HTTPException(422, "height_cm and weight_kg must be supplied together")
    if height_cm is not None and not (30 <= height_cm <= 250 and 2 <= weight_kg <= 300):
        raise HTTPException(422, "height or weight outside a plausible range")
    rgb, exif_f35 = decode_image(await image.read())
    h, w = rgb.shape[:2]
    seg = segmenter(model)
    t0 = time.perf_counter()
    prob = seg.predict(rgb, tta=tta)
    mask = postprocess(prob, threshold, clean)
    infer_ms = (time.perf_counter() - t0) * 1000
    scale, method = None, None
    try:
        if None not in (ref_mm, ref_x1, ref_y1, ref_x2, ref_y2):
            scale, method = scale_from_reference((ref_x1, ref_y1), (ref_x2, ref_y2), ref_mm, w, h)
        elif distance_cm:
            scale, method = scale_from_distance(distance_cm, f35_mm or exif_f35, w, h)
    except CalibrationError as e:
        raise HTTPException(422, str(e))
    res = analyse(mask, prob, scale, height_cm, weight_kg)
    res.update({"width": w, "height": h, "model": model, "threshold": threshold, "calibration_method": method,
                "inference_ms": round(infer_ms, 1), "exif_f35_mm": exif_f35})
    if include_images:
        res["mask_png"] = png_b64((mask * 255).astype(np.uint8))
        res["probability_png"] = png_b64((prob * 255).astype(np.uint8))
    return res


def rgba_png(arr: np.ndarray) -> str:
    ok, buf = cv2.imencode(".png", cv2.cvtColor(arr, cv2.COLOR_RGBA2BGRA))
    return "data:image/png;base64," + base64.b64encode(buf.tobytes()).decode()


@app.post("/api/auto")
async def auto(
    image: UploadFile = File(...),
    threshold: float = Form(0.5),
    ref_mm: Optional[float] = Form(None),
    ref_x1: Optional[float] = Form(None), ref_y1: Optional[float] = Form(None),
    ref_x2: Optional[float] = Form(None), ref_y2: Optional[float] = Form(None),
    distance_cm: Optional[float] = Form(None),
    height_cm: Optional[float] = Form(None),
    f35_mm: Optional[float] = Form(None),
    weight_kg: Optional[float] = Form(None),
):
    """Everything from one photo: ensemble segmentation, scale (card, EXIF + assumed distance, or user override),
    measurements, tissue map, peri-wound signs, appearance-based depth class and the most likely wound type."""
    if not 0.05 <= threshold <= 0.95:
        raise HTTPException(422, "threshold must be between 0.05 and 0.95")
    if (height_cm is None) != (weight_kg is None):
        raise HTTPException(422, "height_cm and weight_kg must be supplied together")
    rgb, f35 = decode_image(await image.read())
    f35 = f35_mm or f35
    h, w = rgb.shape[:2]
    t0 = time.perf_counter()
    reg = registry()
    names = [n for n in ("resnet34-adapted-320", "mobilenetv2-256") if Path(reg[n]["file"]).is_file()]
    if not names:
        raise HTTPException(503, "no segmentation model is installed on this machine")
    weights = {"resnet34-adapted-320": 0.6, "mobilenetv2-256": 0.4}
    probs = [(weights[n], segmenter(n).predict(rgb)) for n in names]
    prob = sum(wt * p for wt, p in probs) / sum(wt for wt, _ in probs)
    mask = postprocess(prob, threshold, True)
    seg_ms = (time.perf_counter() - t0) * 1000
    if not mask.any():
        return {"width": w, "height": h, "empty": True, "calibrated": False, "contours": [], "warnings": ["No wound found in this photo."], "models": names,
                "inference_ms": round(seg_ms, 1)}
    # scale: the user's own reference wins, otherwise automatic
    sc = None
    try:
        if None not in (ref_mm, ref_x1, ref_y1, ref_x2, ref_y2):
            mm, _ = scale_from_reference((ref_x1, ref_y1), (ref_x2, ref_y2), ref_mm, w, h)
            sc = {"source": "user_reference", "mm_per_pixel": mm, "uncertainty_percent": 5, "detail": {}}
        elif distance_cm:
            mm, _ = scale_from_distance(distance_cm, f35, w, h)
            sc = {"source": "user_distance", "mm_per_pixel": mm, "uncertainty_percent": 15, "detail": {"distance_cm": distance_cm}}
    except CalibrationError as e:
        raise HTTPException(422, str(e))
    if sc is None:
        sc = auto_scale(rgb, mask, f35)
    res = analyse(mask, prob, sc["mm_per_pixel"], height_cm, weight_kg)
    labels, pct, skin = tis.classify(rgb, mask)
    res.update({
        "width": w, "height": h, "models": names, "threshold": threshold, "scale": sc,
        "calibrated": True, "calibration_method": sc["source"], "mm_per_pixel": sc["mm_per_pixel"],
        "tissue": pct, "signs": tis.signs(rgb, mask, pct, skin, sc["mm_per_pixel"]), "depth_class": tis.depth_class(pct),
        "exif_f35_mm": f35, "inference_ms": round((time.perf_counter() - t0) * 1000, 1),
    })
    t = typer()
    res["type"] = t.predict(rgb) if t.available else None
    res["mask_png"] = png_b64((mask * 255).astype(np.uint8))
    res["tissue_png"] = rgba_png(tis.overlay_rgba(labels))
    res["probability_png"] = png_b64((prob * 255).astype(np.uint8))
    return res


# ---------------------------------------------------------------- cases
@app.post("/api/cases")
async def create_case(
    patient_code: str = Form(...), label: str = Form(""), captured_at: Optional[str] = Form(None), notes: str = Form(""),
    analysis_json: str = Form(...), image: Optional[UploadFile] = File(None),
):
    patient_code = patient_code.strip()
    if not (1 <= len(patient_code) <= 40) or not all(ch.isalnum() or ch in "-_" for ch in patient_code):
        raise HTTPException(422, "patient_code: 1-40 letters, digits, '-' or '_' (a pseudonym, never a name)")
    try:
        analysis = json.loads(analysis_json)
    except Exception:
        raise HTTPException(422, "analysis_json is not valid JSON")
    for k in ("mask_png", "probability_png"):
        analysis.pop(k, None)  # keep the row small; the mask can be regenerated from the photo
    thumb = None
    if image is not None:
        rgb, _ = decode_image(await image.read())
        thumb = jpeg_thumb(rgb)
    cid = db.add_case(patient_code, label[:80], captured_at, analysis.get("model", DEFAULT_MODEL), analysis, notes[:2000], thumb)
    return {"id": cid}


@app.get("/api/cases")
def cases(patient_code: Optional[str] = None):
    return db.list_cases(patient_code)


@app.get("/api/cases/export.csv")
def export_csv():
    cols = ["id", "patient_code", "label", "captured_at", "model", "calibrated", "area_cm2", "perimeter_mm", "tbsa_percent", "mm_per_pixel", "notes"]
    buf = io.StringIO()
    wr = csv.writer(buf)
    wr.writerow(cols)
    for c in db.list_cases(limit=100000):
        wr.writerow([c[k] for k in cols])
    return Response(buf.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=woundscan_cases.csv"})


@app.get("/api/cases/{cid}")
def case(cid: str):
    c = db.get_case(cid)
    if c is None:
        raise HTTPException(404, "case not found")
    return c


@app.get("/api/cases/{cid}/thumb")
def case_thumb(cid: str):
    t = db.get_thumb(cid)
    if t is None:
        raise HTTPException(404, "no thumbnail")
    return Response(t, media_type="image/jpeg")


@app.delete("/api/cases/{cid}")
def delete_case(cid: str):
    if not db.delete_case(cid):
        raise HTTPException(404, "case not found")
    return {"deleted": cid}


@app.get("/api/patients")
def patients():
    return db.patients()


@app.get("/api/patients/{code}/trend")
def trend(code: str):
    return {"patient_code": code, **healing_trend(db.list_cases(code))}


# ---------------------------------------------------------------- built website
if WEB_DIST.is_dir():
    app.mount("/", StaticFiles(directory=WEB_DIST, html=True), name="web")
