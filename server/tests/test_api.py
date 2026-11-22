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


HAS_MODEL = any(m["installed"] for m in client.get("/api/models").json())
needs_model = pytest.mark.skipif(not HAS_MODEL, reason="model weights are not in the repository (non-commercial data); put them in models/")


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


@needs_model
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


@needs_model
def test_uncalibrated_has_no_cm2():
    j = client.post("/api/analyze", files={"image": ("a.jpg", synth(), "image/jpeg")}, data={"model": "mobilenetv2-256"}).json()
    assert j["calibrated"] is False and "area_cm2" not in j
    assert any("scale" in w.lower() for w in j["warnings"])


@needs_model
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


SAMPLE = ROOT / "web" / "public" / "samples" / "dfu_1.jpg"


@needs_model
def test_auto_returns_the_whole_case_from_one_photo():
    r = client.post("/api/auto", files={"image": ("w.jpg", SAMPLE.read_bytes(), "image/jpeg")})
    assert r.status_code == 200, r.text
    d = r.json()
    assert not d.get("empty")
    assert d["scale"]["source"] in {"card", "assumed_distance"}
    assert d["scale"]["uncertainty_percent"] > 0
    assert set(d["tissue"]) == {"granulation", "slough", "necrosis", "epithelium"}
    assert abs(sum(d["tissue"].values()) - 100) < 1.5
    assert d["depth_class"] in {"full_devitalised", "full_granulating", "partial", "indeterminate"}
    assert d["mask_png"] and d["tissue_png"]
    if d["type"]:
        assert abs(sum(d["type"]["probs"].values()) - 1) < 1e-3


@needs_model
def test_auto_scale_override_wins_over_assumed_distance():
    r = client.post("/api/auto", files={"image": ("w.jpg", SAMPLE.read_bytes(), "image/jpeg")}, data={"distance_cm": "20", "f35_mm": "26"})
    d = r.json()
    assert not d.get("empty")
    assert d["scale"]["source"] == "user_distance"


def test_auto_rejects_height_without_weight():
    r = client.post("/api/auto", files={"image": ("w.jpg", SAMPLE.read_bytes(), "image/jpeg")}, data={"height_cm": "170"})
    assert r.status_code == 422


def test_workspaces_keep_cases_private():
    an = {"calibrated": True, "area_cm2": 5.0, "perimeter_mm": 40.0, "mm_per_pixel": 0.3, "model": "mobilenetv2-256"}
    a, b = {"X-Workspace": "ws-aaaa"}, {"X-Workspace": "ws-bbbb"}
    r = client.post("/api/cases", data={"patient_code": "W-1", "analysis_json": json.dumps(an)}, headers=a)
    assert r.status_code == 200, r.text
    cid = r.json()["id"]
    assert [c["id"] for c in client.get("/api/cases", headers=a).json()] == [cid]
    assert client.get("/api/cases", headers=b).json() == []
    assert client.get(f"/api/cases/{cid}", headers=b).status_code == 404
    assert client.delete(f"/api/cases/{cid}", headers=b).status_code == 404
    assert "W-1" not in client.get("/api/cases/export.csv", headers=b).text
    assert "W-1" in client.get("/api/cases/export.csv", params={"ws": "ws-aaaa"}).text
    assert client.delete(f"/api/cases/{cid}", headers=a).status_code == 200


@pytest.mark.skipif(not os.environ.get("TEST_DATABASE_URL"), reason="set TEST_DATABASE_URL to run the PostgreSQL round trip")
def test_postgres_round_trip(monkeypatch):
    from app import db
    monkeypatch.setattr(db, "DATABASE_URL", os.environ["TEST_DATABASE_URL"])
    monkeypatch.setattr(db, "PG", True)
    monkeypatch.setattr(db, "SCHEMA", db.SCHEMA.replace("BLOB", "BYTEA"))
    cid = db.add_case("pg-ws", "PG-1", "lab", "2026-01-01T00:00:00+00:00", "m", {"calibrated": True, "area_cm2": 3.0}, "", b"\xff\xd8thumb")
    assert db.get_case("pg-ws", cid)["patient_code"] == "PG-1"
    assert db.get_thumb("pg-ws", cid) == b"\xff\xd8thumb"
    assert db.get_case("other", cid) is None
    assert db.delete_case("pg-ws", cid)
