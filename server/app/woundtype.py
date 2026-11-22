"""Wound type from the photo: the wound-adapted ResNet34 fine-tuned on WoundSeg labels (diabetic, pressure, venous,
surgical, trauma, other). Falls back to a linear head on frozen encoder features when the fine-tuned model is missing.
Accuracy is modest, so callers must show the probability and the alternatives, never a bare verdict."""
import json
import threading
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

TYPE_DIR = Path(__file__).resolve().parents[2] / "models" / "type"
IDS = {"Diabetic Ulcer": "diabetic", "Pressure Ulcer": "pressure", "Venous Ulcer": "venous", "Surgical Wound": "surgical", "Trauma Wound": "trauma", "Other": "other"}
S = 320


class WoundTyper:
    def __init__(self):
        self.lock = threading.Lock()
        self.mode = None
        self.meta = {}
        cls = TYPE_DIR / "type_cls.onnx"
        head = TYPE_DIR / "head.json"
        enc = TYPE_DIR / "encoder_r34.onnx"
        if cls.is_file() and (TYPE_DIR / "type_cls.json").is_file():
            self.sess = ort.InferenceSession(str(cls), providers=["CPUExecutionProvider"])
            self.meta = json.loads((TYPE_DIR / "type_cls.json").read_text(encoding="utf-8"))
            self.classes = self.meta["classes"]
            self.mode = "finetuned"
        elif head.is_file() and enc.is_file():
            self.sess = ort.InferenceSession(str(enc), providers=["CPUExecutionProvider"])
            h = json.loads(head.read_text(encoding="utf-8"))
            self.classes = h["classes"]
            self.mu, self.sd = np.array(h["mean"], np.float32), np.array(h["std"], np.float32)
            self.W, self.b = np.array(h["coef"], np.float32), np.array(h["intercept"], np.float32)
            self.meta = {"accuracy": h["cv_accuracy"], "balanced_accuracy": h["cv_balanced_accuracy"], "holdout_n": h["n"], "protocol": "5-fold cross-validation, linear head"}
            self.mode = "linear_head"

    @property
    def available(self):
        return self.mode is not None

    def predict(self, rgb: np.ndarray):
        x = cv2.resize(rgb, (S, S), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
        x = x.transpose(2, 0, 1)[None]
        name = self.sess.get_inputs()[0].name
        with self.lock:
            outs = [self.sess.run(None, {name: np.ascontiguousarray(v)})[0] for v in (x, x[..., ::-1])]
        if self.mode == "finetuned":
            p = (outs[0] + outs[1])[0] / 2
        else:
            f = (outs[0] + outs[1])[0] / 2
            z = ((f - self.mu) / self.sd) @ self.W.T + self.b
            e = np.exp(z - z.max())
            p = e / e.sum()
        order = np.argsort(-p)
        return {
            "probs": {IDS[self.classes[i]]: float(p[i]) for i in order},
            "top": IDS[self.classes[int(order[0])]],
            "confidence": float(p[order[0]]),
            "model": self.mode,
            "accuracy": self.meta.get("accuracy"),
            "balanced_accuracy": self.meta.get("balanced_accuracy"),
            "validated_on": self.meta.get("holdout_n"),
        }
