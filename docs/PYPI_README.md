# WoundScan for Python

Calibrated binary-mask measurements and local ONNX segmentation for research pipelines.

Install with `pip install woundscan`. Requires Python 3.10 or later.

[Source](https://github.com/sharing-123/WoundScan) | [Issues](https://github.com/sharing-123/WoundScan/issues) | [OSF](https://doi.org/10.17605/OSF.IO/KV3SP) | [Zenodo](https://doi.org/10.5281/zenodo.24412818)

## Measure any binary mask

```python
import json
import numpy as np
from woundscan import measure_mask, reference_scale

mask = np.zeros((100, 100), dtype=bool)
mask[20:40, 30:60] = True
scale = reference_scale(reference_pixels=100, reference_mm=10)
result = measure_mask(mask, scale, height_cm=170, weight_kg=70)
print(result.area_mm2)       # 6.0
print(result.perimeter_mm)  # 10.0
print(json.dumps(result.to_dict(), indent=2))
```

The API accepts masks from any segmentation model or manual annotation pipeline.
Measurements use millimetres and square millimetres. Mosteller body surface area
uses height in centimetres and weight in kilograms. Supply both to calculate
`tbsa_percent`, otherwise it is `None`. A reference must lie in the wound plane.
Curved surfaces, perspective and calibration uncertainty affect accuracy.

## Optional segmentation

Install with `pip install "woundscan[inference]"`.

```python
import cv2
from woundscan import Segmenter, measure_mask

model = Segmenter("/path/to/wound_seg.onnx")
bgr = cv2.imread("/path/to/image.png")
if bgr is None:
    raise ValueError("Image could not be loaded")
rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
probability = model.predict(rgb)
mask = model.segment(rgb, threshold=0.5)
result = measure_mask(mask, mm_per_pixel=0.1)
```

Supply a model you have permission to use. No weights or network downloads are
included. Inference uses ONNX Runtime CPU, with float32 RGB input [1,3,256,256]
in [0,1] and probability output [1,1,256,256]. The recipe follows the repository
Python evaluation script, averaging original, horizontal and vertical flips.
Set `tta=False` for a single pass. Invalid probabilities and logits are rejected.

## API

| Function | Result |
| --- | --- |
| reference_scale(reference_pixels, reference_mm) | Millimetres per pixel |
| body_surface_area(height_cm, weight_kg) | Mosteller BSA in square metres |
| measure_mask(mask, mm_per_pixel, height_cm=None, weight_kg=None) | Immutable Measurement; height and weight are keyword-only |
| Measurement.to_dict() | JSON-compatible dictionary |
| Segmenter(model_path).predict(rgb, tta=True) | Original-resolution probability array; tta is keyword-only |
| Segmenter(model_path).segment(rgb, threshold=0.5, tta=True) | Boolean mask; threshold and tta are keyword-only |

Functions compose with notebooks, batch processing and APIs. Import starts no
server, downloads no models and performs no inference. Model loading occurs only
when a Segmenter is constructed.

## Scope and evidence

Version 0.1 provides measurement and optional inference. Browser reconstructive
planning, tissue analysis, donor mapping and interactive editing remain in the
GitHub application and are not exported by this Python API.

Area counts foreground pixel cells across all components. Perimeter counts
exposed pixel edges, including holes. This lattice perimeter is orientation
dependent and differs from the browser's smoothed subpixel contour algorithm.
Inference does not apply browser smoothing, component removal or hole filling.
Final masks can therefore differ from browser masks.

The repository model evaluation reported Dice 0.827 on 200 validation images and
0.793 on 160 external images. These describe that evaluation, not a guarantee
for this package or new photographs. Small punctures and thin abrasions were
important failure modes. The software is a research prototype without clinical
validation and must not replace clinical judgement.

## Licensing and model rights

The Python package, tests and package documentation use MIT. Wheels and source
archives exclude model weights, photographs, datasets and browser libraries.
Repository weights were trained on restricted noncommercial datasets and data
without a documented redistribution license. Obtain appropriate permissions or
train with suitably licensed data. MIT does not relicense these assets. PyPI
hosting does not certify scientific accuracy or clinical suitability.

## Development

Clone the repository and create a virtual environment, then run:

```bash
pip install -e ".[test,inference]" build twine
pytest
python -m build
python -m twine check dist/*
```

Tests cover known geometry, units, input validation and inference transforms.
Default measurement tests require no model weights. Bug reports should include
package versions and a minimal example without identifying patient information.

Authors: Muhammad Allam Rafi and Cindy Rizky Afrilia.
