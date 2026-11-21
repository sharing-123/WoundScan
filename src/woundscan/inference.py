"""Optional ONNX inference matching the repository's Python evaluation recipe."""
from pathlib import Path
import numpy as np


class Segmenter:
    """Load a caller-supplied WoundScan-compatible ONNX probability model.

    Contract: float32 RGB [1,3,256,256] in [0,1], output [1,1,256,256]
    probabilities. No weights or network downloads are included in this package.
    """
    def __init__(self, model_path):
        path = Path(model_path)
        if not path.is_file():
            raise FileNotFoundError(path)
        try:
            import cv2
            import onnxruntime as ort
        except ImportError as exc:
            raise ImportError('Install optional inference support: pip install "woundscan[inference]"') from exc
        self._cv2 = cv2
        self._session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        inputs = self._session.get_inputs()
        if len(inputs) != 1 or inputs[0].shape != [1, 3, 256, 256] or inputs[0].type != "tensor(float)":
            raise ValueError("Model must accept one float32 tensor of shape [1,3,256,256]")
        self._input = inputs[0].name

    def predict(self, rgb, *, tta=True) -> np.ndarray:
        """Return H x W float32 probabilities from an H x W x 3 uint8 RGB image.

        TTA averages original, horizontal-flip and vertical-flip probabilities.
        No browser mask smoothing, component filtering or hole filling is applied.
        """
        image = np.asarray(rgb)
        if image.ndim != 3 or image.shape[2] != 3 or not image.size or image.dtype != np.uint8:
            raise ValueError("rgb must be a nonempty H x W x 3 uint8 array")
        cv2 = self._cv2
        x = cv2.resize(image, (256, 256), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
        x = x.transpose(2, 0, 1)[None]
        def run(a):
            result = self._session.run(None, {self._input: np.ascontiguousarray(a)})[0]
            if result.shape != (1, 1, 256, 256):
                raise ValueError("Model output must have shape [1,1,256,256]")
            p = result[0, 0]
            if not np.isfinite(p).all() or p.min() < 0 or p.max() > 1:
                raise ValueError("Model output must contain probabilities in [0,1]")
            return p
        p = run(x)
        if tta:
            p = (p + run(x[..., ::-1])[:, ::-1] + run(x[:, :, ::-1])[::-1]) / 3
        return cv2.resize(p, (image.shape[1], image.shape[0]), interpolation=cv2.INTER_LINEAR)

    def segment(self, rgb, *, threshold=0.5, tta=True) -> np.ndarray:
        """Return a boolean mask using strict probability > threshold."""
        if not np.isfinite(threshold) or not 0 <= threshold <= 1:
            raise ValueError("threshold must be finite and between 0 and 1")
        return self.predict(rgb, tta=tta) > threshold
