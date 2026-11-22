import json
import os
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np
import pytest

os.environ["WOUNDSCAN_DB"] = str(Path(tempfile.mkdtemp()) / "t.db")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)
ROOT = Path(__file__).resolve().parents[2]
PHOTOS = sorted((ROOT / "webtest").glob("*.jpg"))


def jpeg(arr):
    ok, b = cv2.imencode(".jpg", arr[:, :, ::-1])
    return b.tobytes()


def synth():
    img = np.full((360, 480, 3), (206, 170, 150), np.uint8)
    cv2.ellipse(img, (240, 180), (80, 45), 15, 0, 360, (90, 40, 60), -1)
    return jpeg(img)


def test_health_and_models():
    assert client.get("/api/health").json()["status"] == "ok"
    ms = client.get("/api/models").json()
    assert {m["id"] for m in ms} == {"resnet34-adapted-320", "mobilenetv2-256"}
    assert any(m["default"] for m in ms)


@pytest.mark.parametrize("model", ["mobilenetv2-256", "resnet34-adapted-320"])
def test_analyze_synthetic_with_reference(model):
    r = client.post("/api/analyze", files={"image": ("a.jpg", synth(), "image/jpeg")},
                    data={"model": model, "ref_mm": "85.6", "ref_x1": "0.1", "ref_y1": "0.9", "ref_x2": "0.5", "ref_y2": "0.9",
                          "height_cm": "170", "weight_kg": "70"})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["calibrated"] and j["calibration_method"] == "reference"
    assert j["mask_png"].startswith("data:image/png;base64,")
    assert abs(j["mm_per_pixel"] - 85.6 / 192) < 1e-6  # 0.4 * 480 px = 192 px over 85.6 mm
    if not j["empty"]:  # a flat synthetic ellipse is not a real wound; calibration maths is checked either way
        assert j["tbsa_percent"] is not None and j["bsa_m2"] == pytest.approx((170 * 70 / 3600) ** 0.5, rel=1e-6)


def test_uncalibrated_has_no_cm2():
    j = client.post("/api/analyze", files={"image": ("a.jpg", synth(), "image/jpeg")}, data={"model": "mobilenetv2-256"}).json()
    assert j["calibrated"] is False and "area_cm2" not in j
    assert any("scale" in w.lower() for w in j["warnings"])


def test_rejects_bad_inputs():
    assert client.post("/api/analyze", files={"image": ("a.txt", b"not an image", "text/plain")}).status_code == 400
    assert client.post("/api/analyze", files={"image": ("a.jpg", synth(), "image/jpeg")}, data={"threshold": "0.99"}).status_code == 422
    assert client.post("/api/analyze", files={"image": ("a.jpg", synth(), "image/jpeg")}, data={"height_cm": "170"}).status_code == 422
    assert client.post("/api/analyze", files={"image": ("a.jpg", synth(), "image/jpeg")},
                       data={"ref_mm": "50", "ref_x1": "0.2", "ref_y1": "0.2", "ref_x2": "0.2", "ref_y2": "0.2"}).status_code == 422
    assert client.post("/api/analyze", files={"image": ("a.jpg", synth(), "image/jpeg")}, data={"model": "nope"}).status_code == 404


@pytest.mark.skipif(not PHOTOS, reason="webtest photos missing")
def test_real_photo_finds_wound():
    p = next((x for x in PHOTOS if "ulcer" in x.name or "dehis" in x.name), PHOTOS[0])
    j = client.post("/api/analyze", files={"image": (p.name, p.read_bytes(), "image/jpeg")}, data={"include_images": "false"}).json()
    assert j["foreground_pixels"] > 0 and j["contours"]


def test_case_crud_and_trend():
    ids = []
    for day, area in (("2026-01-01T09:00:00+00:00", 20.0), ("2026-01-08T09:00:00+00:00", 15.0), ("2026-01-15T09:00:00+00:00", 10.0)):
        an = {"calibrated": True, "area_cm2": area, "perimeter_mm": 80.0, "mm_per_pixel": 0.3, "model": "mobilenetv2-256"}
        r = client.post("/api/cases", data={"patient_code": "P-001", "label": "heel", "captured_at": day, "analysis_json": json.dumps(an)},
                        files={"image": ("a.jpg", synth(), "image/jpeg")})
        assert r.status_code == 200, r.text
        ids.append(r.json()["id"])
    assert len(client.get("/api/cases", params={"patient_code": "P-001"}).json()) == 3
    t = client.get("/api/patients/P-001/trend").json()
    assert t["n"] == 3 and t["percent_reduction_from_first"] == 50.0
    assert t["rate_cm2_per_week"] == pytest.approx(-5.0, abs=0.01)
    assert client.get(f"/api/cases/{ids[0]}/thumb").headers["content-type"] == "image/jpeg"
    assert "P-001" in client.get("/api/cases/export.csv").text
    assert client.delete(f"/api/cases/{ids[0]}").status_code == 200
    assert client.get(f"/api/cases/{ids[0]}").status_code == 404
    assert client.post("/api/cases", data={"patient_code": "Budi Santoso", "analysis_json": "{}"}).status_code == 422
