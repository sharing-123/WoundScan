"""Does edge refinement help? Dice on the 200 FUSeg validation images at native resolution (not used to pick anything)."""
import glob, os, sys
import cv2, numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.inference import OnnxSegmenter, postprocess
from app.models import registry
from app.refine import refine

reg = registry()
A = OnnxSegmenter(reg['resnet34-adapted-320']['file']); B = OnnxSegmenter(reg['mobilenetv2-256']['file'])
base = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'data', 'fuseg', 'data', 'Foot Ulcer Segmentation Challenge', 'validation')
res = {k: [] for k in ('adapted', 'mobilenet', 'ensemble', 'ensemble+refine', 'adapted+refine')}
def dice(p, g):
    s = p.sum() + g.sum()
    return 1.0 if s == 0 else 2 * (p & g).sum() / s
files = sorted(glob.glob(os.path.join(base, 'images', '*')))[:int(sys.argv[1]) if len(sys.argv) > 1 else 200]
for i, ip in enumerate(files):
    stem = os.path.splitext(os.path.basename(ip))[0]
    lp = glob.glob(os.path.join(base, 'labels', stem + '.*'))
    if not lp: continue
    im = cv2.cvtColor(cv2.imread(ip), cv2.COLOR_BGR2RGB); g = cv2.imread(lp[0], 0) > 127
    if g.sum() == 0: continue
    pa, pb = A.predict(im), B.predict(im); pe = 0.6 * pa + 0.4 * pb
    ma, mb, me = postprocess(pa), postprocess(pb), postprocess(pe)
    res['adapted'].append(dice(ma, g)); res['mobilenet'].append(dice(mb, g)); res['ensemble'].append(dice(me, g))
    res['ensemble+refine'].append(dice(refine(im, me, pe), g)); res['adapted+refine'].append(dice(refine(im, ma, pa), g))
    if i % 40 == 0: print(i, {k: round(float(np.mean(v)), 3) for k, v in res.items() if v}, flush=True)
print('FINAL n=%d' % len(res['ensemble']), {k: round(float(np.mean(v)), 4) for k, v in res.items()})
