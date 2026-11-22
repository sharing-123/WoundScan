"""Extract wound-type features with the wound-adapted ResNet34 encoder (runs on the Intel Arc XPU in WoundScan/xpuenv).
Writes models/type/features.npy (N x 512, mean of original + horizontal flip) and labels.json, then exports the encoder
to ONNX (320 px input, 512 output) so the server computes the same features.  Run:  xpuenv\\Scripts\\python train\\type_features.py"""
import csv, json, os
import numpy as np, cv2, torch
import segmentation_models_pytorch as smp

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 320
OUT = os.path.join(ROOT, 'models', 'type'); os.makedirs(OUT, exist_ok=True)
dev = 'xpu' if torch.xpu.is_available() else 'cpu'

model = smp.Unet('resnet34', encoder_weights=None, classes=1)
model.load_state_dict(torch.load(os.path.join(ROOT, 'models', 'smp', 'r34_320w.pt'), map_location='cpu'))
enc = model.encoder.eval().to(dev)
mean = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1).to(dev); std = torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1).to(dev)


def feats(x):  # x: B,3,S,S in 0..1
    f = enc((x - mean) / std)[-1]
    return f.mean((2, 3))


rows = list(csv.DictReader(open(os.path.join(ROOT, 'data', 'woundids_types.csv'))))
base = os.path.join(ROOT, 'data', 'wseg', 'wseg_dataset', 'sample')
X, y, ids = [], [], []
batch, names = [], []


def flush():
    global batch, names
    if not batch:
        return
    x = torch.from_numpy(np.stack(batch)).permute(0, 3, 1, 2).float().to(dev) / 255
    with torch.no_grad():
        f = (feats(x) + feats(x.flip(3))) / 2
    X.append(f.float().cpu().numpy())
    batch, names = [], []


for i, r in enumerate(rows):
    p = os.path.join(base, r['imageid'])
    im = cv2.imread(p)
    if im is None:
        continue
    batch.append(cv2.resize(cv2.cvtColor(im, cv2.COLOR_BGR2RGB), (S, S), interpolation=cv2.INTER_AREA))
    y.append(r['woundtype']); ids.append(r['imageid'])
    if len(batch) == 32:
        flush()
        print(i, flush=True)
flush()
np.save(os.path.join(OUT, 'features.npy'), np.concatenate(X))
json.dump({'labels': y, 'ids': ids}, open(os.path.join(OUT, 'labels.json'), 'w'))

class Pool(torch.nn.Module):
    def __init__(self, e):
        super().__init__(); self.e = e; self.register_buffer('m', torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)); self.register_buffer('s', torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1))
    def forward(self, x):
        return self.e((x - self.m) / self.s)[-1].mean((2, 3))

pool = Pool(model.encoder.cpu().eval()).eval()
torch.onnx.export(pool, torch.rand(1, 3, S, S), os.path.join(OUT, 'encoder_r34.onnx'), input_names=['x'], output_names=['f'], opset_version=17, dynamo=False)
print('done', len(y))
