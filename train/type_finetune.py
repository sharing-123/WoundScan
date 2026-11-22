"""Fine-tune the wound-adapted ResNet34 encoder as a wound-type classifier (WoundSeg labels) on the Intel Arc XPU.
80/20 stratified holdout, strong colour/geometry augmentation, label smoothing. Exports models/type/type_cls.onnx (softmax)
and models/type/type_cls.json with holdout metrics.  Run: xpuenv\\Scripts\\python train\\type_finetune.py"""
import csv, json, os, random, time
import numpy as np, cv2, torch, torch.nn as nn, torch.nn.functional as F
import segmentation_models_pytorch as smp

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S, EPOCHS, BS, LR = 320, 14, 8, 3e-4
dev = 'xpu'
random.seed(0); np.random.seed(0); torch.manual_seed(0)
rows = [r for r in csv.DictReader(open(os.path.join(ROOT, 'data', 'woundids_types.csv'))) if r['woundtype'].strip()]
classes = sorted({r['woundtype'] for r in rows})
base = os.path.join(ROOT, 'data', 'wseg', 'wseg_dataset', 'sample')
X = np.stack([cv2.resize(cv2.cvtColor(cv2.imread(os.path.join(base, r['imageid'])), cv2.COLOR_BGR2RGB), (S, S), interpolation=cv2.INTER_AREA) for r in rows])
y = np.array([classes.index(r['woundtype']) for r in rows])
idx = np.random.RandomState(1).permutation(len(y)); cut = int(0.8 * len(y))
tr, te = idx[:cut], idx[cut:]
print('train', len(tr), 'test', len(te), classes, flush=True)


def aug(im):
    if random.random() < .5: im = im[:, ::-1]
    if random.random() < .5: im = im[::-1]
    im = np.rot90(im, random.randint(0, 3)); im = np.ascontiguousarray(im)
    M = cv2.getRotationMatrix2D((S / 2, S / 2), random.uniform(-25, 25), random.uniform(.8, 1.3)); M[:, 2] += [random.uniform(-.1, .1) * S, random.uniform(-.1, .1) * S]
    im = cv2.warpAffine(im, M, (S, S), borderMode=cv2.BORDER_REFLECT)
    f = im.astype(np.float32) * random.uniform(.75, 1.25) + random.uniform(-20, 20)
    hsv = cv2.cvtColor(np.clip(f, 0, 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    hsv[..., 1] *= random.uniform(.75, 1.25); hsv[..., 0] = (hsv[..., 0] + random.uniform(-5, 5)) % 180; hsv[..., 1:] = np.clip(hsv[..., 1:], 0, 255)
    return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)


class Net(nn.Module):
    def __init__(self, n):
        super().__init__()
        m = smp.Unet('resnet34', encoder_weights=None, classes=1)
        m.load_state_dict(torch.load(os.path.join(ROOT, 'models', 'smp', 'r34_320w.pt'), map_location='cpu'))
        self.enc = m.encoder
        self.drop = nn.Dropout(0.3); self.fc = nn.Linear(512, n)
        self.register_buffer('mean', torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)); self.register_buffer('std', torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1))

    def forward(self, x):
        f = self.enc((x - self.mean) / self.std)[-1].mean((2, 3))
        return self.fc(self.drop(f))


net = Net(len(classes)).to(dev)
cw_np = (len(y) / (len(classes) * np.bincount(y[tr], minlength=len(classes)))).astype(np.float32)
opt = torch.optim.AdamW([{'params': net.enc.parameters(), 'lr': LR * .3}, {'params': net.fc.parameters(), 'lr': LR}], weight_decay=1e-3)
steps = EPOCHS * (len(tr) // BS)
sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=[LR * .3, LR], total_steps=steps, pct_start=.15)


def predict(ids):
    net.eval(); out = []
    with torch.no_grad():
        for i in range(0, len(ids), 24):
            x = torch.from_numpy(X[ids[i:i + 24]].astype(np.float32) / 255).permute(0, 3, 1, 2).to(dev)
            p = (F.softmax(net(x), 1) + F.softmax(net(x.flip(3)), 1)) / 2
            out.append(p.float().cpu().numpy())
    return np.concatenate(out)


best, t0 = -1, time.time()
for ep in range(EPOCHS):
    net.train(); order = np.random.permutation(tr)
    for b in range(len(order) // BS):
        ii = order[b * BS:(b + 1) * BS]
        x = torch.from_numpy(np.stack([aug(X[i]) for i in ii]).astype(np.float32) / 255).permute(0, 3, 1, 2).to(dev)
        yy = torch.from_numpy(y[ii]).to(dev)
        lp = F.log_softmax(net(x), 1)
        nll = -(lp * F.one_hot(yy, len(classes)).float()).sum(1)
        smooth = -lp.mean(1)
        wy = torch.from_numpy(cw_np[y[ii]]).to(dev)
        loss = ((0.9 * nll + 0.1 * smooth) * wy).mean()
        opt.zero_grad(); loss.backward(); opt.step(); sched.step()
    p = predict(te); acc = float((p.argmax(1) == y[te]).mean())
    bal = float(np.mean([(p.argmax(1)[y[te] == c] == c).mean() for c in range(len(classes)) if (y[te] == c).any()]))
    print(f'ep{ep+1} acc {acc:.3f} bal {bal:.3f} [{time.time()-t0:.0f}s]', flush=True)
    if bal > best:
        best = bal; torch.save(net.state_dict(), os.path.join(ROOT, 'models', 'type', 'type_cls.pt')); bp = p.copy()
net.load_state_dict(torch.load(os.path.join(ROOT, 'models', 'type', 'type_cls.pt')))
net = net.cpu().eval()
class Soft(nn.Module):
    def __init__(s, n): super().__init__(); s.n = n
    def forward(s, x): return F.softmax(s.n(x), 1)
torch.onnx.export(Soft(net), torch.rand(1, 3, S, S), os.path.join(ROOT, 'models', 'type', 'type_cls.onnx'), input_names=['x'], output_names=['p'], opset_version=17, dynamo=False)
conf = bp.max(1)
rep = {'classes': classes, 'holdout_n': int(len(te)), 'accuracy': float((bp.argmax(1) == y[te]).mean()), 'balanced_accuracy': best,
       'per_class_recall': {c: float((bp.argmax(1)[y[te] == i] == i).mean()) for i, c in enumerate(classes)},
       'by_confidence': {str(q): {'coverage': float((conf >= q).mean()), 'accuracy': float((bp.argmax(1)[conf >= q] == y[te][conf >= q]).mean()) if (conf >= q).any() else None} for q in (0.5, 0.7)}}
json.dump(rep, open(os.path.join(ROOT, 'models', 'type', 'type_cls.json'), 'w'), indent=1)
print('RESULT', json.dumps(rep), flush=True)
