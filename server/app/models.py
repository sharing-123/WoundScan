"""Model registry. Weights live in ../models and are never bundled in the repository (non-commercial training data)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "models"


def _json(name):
    p = MODEL_DIR / name
    return json.loads(p.read_text(encoding="utf-8")) if p.is_file() else {}


def registry():
    cv = _json("medetec_cv_metrics.json").get("adapted", {})
    meta = _json("meta.json")
    return {
        "resnet34-adapted-320": {
            "label": "ResNet34 U-Net, adapted",
            "file": MODEL_DIR / "wound_seg_medetec_adapted_320.onnx",
            "input": 320,
            "summary": "Higher accuracy, 95 MB. Adapted to Medetec annotation style.",
            "metrics": {
                "protocol": "5-fold cross-validation grouped by photograph, 38 Medetec photographs",
                "dice": cv.get("dice_img"), "precision": cv.get("prec"), "recall": cv.get("rec"),
                "f1": cv.get("f1_pooled"), "accuracy": cv.get("acc"),
            },
        },
        "mobilenetv2-256": {
            "label": "MobileNetV2 U-Net",
            "file": MODEL_DIR / "wound_seg.onnx",
            "input": 256,
            "summary": "Fast and small (10 MB). The model that runs offline in the browser app.",
            "metrics": {
                "protocol": "FUSeg validation (200 images) and Medetec external (160 images, 38 photographs)",
                "dice": meta.get("val_dice"), "dice_external": meta.get("ext_dice"),
            },
        },
    }
DEFAULT_MODEL = "resnet34-adapted-320"
