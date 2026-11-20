"""Uji model ONNX pada foto web variatif: montase overlay + statistik. Jalankan: python eval_web.py"""
import os, glob, sys, numpy as np, cv2, onnxruntime as ort
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'webtest_out')
os.makedirs(OUT, exist_ok=True)
sess = ort.InferenceSession(os.path.join(ROOT, 'models', 'wound_seg.onnx'), providers=['CPUExecutionProvider'])
S = 256


def predict(img):
    x = cv2.cvtColor(cv2.resize(img, (S, S), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2RGB).astype(np.float32) / 255
    x = x.transpose(2, 0, 1)[None]
    run = lambda a: sess.run(None, {'x': np.ascontiguousarray(a)})[0][0, 0]
    p = (run(x) + run(x[..., ::-1])[:, ::-1] + run(x[:, :, ::-1])[::-1]) / 3
    return cv2.resize(p, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_LINEAR)


def overlay(img, p, thr=0.5):
    m = (p > thr).astype(np.uint8)
    o = img.copy(); o[m > 0] = (0.55 * o[m > 0] + 0.45 * np.array([255, 211, 34])).astype(np.uint8)  # BGR cyan-ish
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cv2.drawContours(o, cs, -1, (255, 255, 255), 2); cv2.drawContours(o, cs, -1, (238, 211, 34), 1)
    return o, m.mean()


files = sorted(glob.glob(os.path.join(ROOT, 'webtest', '*.jpg')))
tiles = []
for f in files:
    img = cv2.imread(f)
    if img is None: continue
    p = predict(img); o, frac = overlay(img, p)
    h = 260; r = h / img.shape[0]; w = int(img.shape[1] * r)
    a = cv2.resize(img, (w, h)); b = cv2.resize(o, (w, h))
    t = np.concatenate([a, b], 1)
    cv2.putText(t, f'{os.path.basename(f)[:-4]}  {frac * 100:.1f}%', (6, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
    cv2.putText(t, f'{os.path.basename(f)[:-4]}  {frac * 100:.1f}%', (6, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 1)
    tiles.append(t)
    print(os.path.basename(f), f'wound fraction {frac * 100:.1f}%  maxprob {p.max():.2f}')
# montase 2 kolom
per = 3
for k in range(0, len(tiles), per * 2):
    chunk = tiles[k:k + per * 2]; rows = []
    for i in range(0, len(chunk), 2):
        pair = chunk[i:i + 2]
        W = max(x.shape[1] for x in pair)
        pair = [cv2.copyMakeBorder(x, 0, 0, 0, W - x.shape[1], cv2.BORDER_CONSTANT) for x in pair]
        rows.append(np.concatenate(pair, 1))
    Wm = max(r.shape[1] for r in rows)
    rows = [cv2.copyMakeBorder(r, 0, 0, 0, Wm - r.shape[1], cv2.BORDER_CONSTANT) for r in rows]
    cv2.imwrite(os.path.join(OUT, f'montage_{k // (per * 2) + 1}.jpg'), np.concatenate(rows, 0))
print('montase ->', OUT)
