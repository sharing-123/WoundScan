"""ONNX segmentation: flip test-time augmentation, optional light post-processing."""
import threading
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort


class OnnxSegmenter:
    def __init__(self, path: Path):
        path = Path(path)
        if not path.is_file():
            raise FileNotFoundError(path)
        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 4
        self.session = ort.InferenceSession(str(path), opts, providers=["CPUExecutionProvider"])
        inp = self.session.get_inputs()[0]
        if len(inp.shape) != 4 or inp.shape[1] != 3 or inp.shape[2] != inp.shape[3]:
            raise ValueError(f"unsupported model input {inp.shape}")
        self.size = int(inp.shape[2])
        self.name = inp.name
        self._lock = threading.Lock()  # one inference at a time keeps latency predictable on a laptop

    def _run(self, x):
        out = self.session.run(None, {self.name: np.ascontiguousarray(x)})[0]
        p = out[0, 0]
        if not np.isfinite(p).all():
            raise ValueError("model produced non-finite values")
        return np.clip(p, 0.0, 1.0)

    def predict(self, rgb: np.ndarray, tta: bool = True) -> np.ndarray:
        """rgb uint8 HxWx3 -> float32 probabilities HxW."""
        h, w = rgb.shape[:2]
        x = cv2.resize(rgb, (self.size, self.size), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
        x = x.transpose(2, 0, 1)[None]
        with self._lock:
            p = self._run(x)
            if tta:
                p = (p + self._run(x[..., ::-1])[:, ::-1] + self._run(x[:, :, ::-1, :])[::-1]) / 3
        return cv2.resize(p.astype(np.float32), (w, h), interpolation=cv2.INTER_LINEAR)


def postprocess(prob: np.ndarray, threshold: float = 0.5, clean: bool = True) -> np.ndarray:
    """Binary mask. clean = closing 3 px at 256-scale and drop components under 5% of the largest."""
    mask = (prob > threshold).astype(np.uint8)
    if not clean or not mask.any():
        return mask.astype(bool)
    k = max(3, int(round(3 * max(mask.shape) / 256))) | 1
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((k, k), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask)
    if n > 2:
        big = stats[1:, cv2.CC_STAT_AREA].max()
        keep = np.zeros_like(mask)
        for i in range(1, n):
            if stats[i, cv2.CC_STAT_AREA] >= 0.05 * big:
                keep[lab == i] = 1
        mask = keep
    return mask.astype(bool)
