"""Pelatihan model segmentasi luka (U-Net MobileNetV2) dalam dua putaran.
  round1 : FUSeg (masker akurat, ahli) -> best1.pt
  refine : model 1 memperhalus masker kasar WoundSeg -> data/refined.npz
  round2 : FUSeg + WoundSeg halus -> best2.pt + ekspor ONNX
Jalankan:  python train.py round1|refine|round2 [epochs]
"""
import os, sys, glob, json, random, time
import numpy as np, cv2, torch, torch.nn as nn, torch.nn.functional as F, torchvision
cv2.setNumThreads(1)

S = 256
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
MODELS = os.path.join(ROOT, 'models')
FU = os.path.join(DATA, 'fuseg', 'data', 'Foot Ulcer Segmentation Challenge')
MED = os.path.join(DATA, 'fuseg', 'data', 'Medetec_foot_ulcer_224')
WSEG = os.path.join(DATA, 'wseg', 'wseg_dataset')
torch.set_num_threads(int(os.environ.get('THREADS', 14)))


# ---------------------------------------------------------------- data
def read_pair(ip, mp):
    im = cv2.imread(ip, cv2.IMREAD_COLOR)
    mk = cv2.imread(mp, cv2.IMREAD_GRAYSCALE)
    if im is None or mk is None:
        return None
    if mk.max() <= 1:                      # label 0/1 (Medetec) -> 0/255
        mk = mk * 255
    im = cv2.cvtColor(cv2.resize(im, (S, S), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2RGB)
    mk = cv2.resize(mk, (S, S), interpolation=cv2.INTER_AREA)
    return im, (mk > 127).astype(np.uint8)


def pairs_from_dir(base):
    imgs = sorted(glob.glob(os.path.join(base, 'images', '*')))
    out = []
    for ip in imgs:
        stem = os.path.splitext(os.path.basename(ip))[0]
        c = glob.glob(os.path.join(base, 'labels', stem + '.*'))
        if c:
            out.append((ip, c[0]))
    return out


def load_set(pairs):
    X, Y = [], []
    for ip, mp in pairs:
        r = read_pair(ip, mp)
        if r is not None:
            X.append(r[0]); Y.append(r[1])
    return np.stack(X), np.stack(Y)


class Aug(torch.utils.data.Dataset):
    def __init__(self, X, Y, train=True):
        self.X, self.Y, self.train = X, Y, train

    def __len__(self):
        return len(self.X)

    def __getitem__(self, i):
        x, y = self.X[i].copy(), self.Y[i].copy()
        if self.train:
            if random.random() < 0.5: x, y = x[:, ::-1], y[:, ::-1]
            if random.random() < 0.5: x, y = x[::-1], y[::-1]
            k = random.randint(0, 3); x, y = np.rot90(x, k), np.rot90(y, k)
            x, y = np.ascontiguousarray(x), np.ascontiguousarray(y)
            ang = random.uniform(-25, 25); sc = random.uniform(0.75, 1.35)
            M = cv2.getRotationMatrix2D((S / 2, S / 2), ang, sc)
            M[:, 2] += [random.uniform(-0.12, 0.12) * S, random.uniform(-0.12, 0.12) * S]
            x = cv2.warpAffine(x, M, (S, S), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
            y = cv2.warpAffine(y, M, (S, S), flags=cv2.INTER_NEAREST, borderMode=cv2.BORDER_REFLECT)
            xf = x.astype(np.float32)
            xf = xf * random.uniform(0.7, 1.3) + random.uniform(-25, 25)         # kontras, kecerahan
            hsv = cv2.cvtColor(np.clip(xf, 0, 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
            hsv[..., 1] *= random.uniform(0.7, 1.3); hsv[..., 0] += random.uniform(-6, 6)
            hsv[..., 0] %= 180; hsv[..., 1:] = np.clip(hsv[..., 1:], 0, 255)
            x = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
            if random.random() < 0.3: x = cv2.GaussianBlur(x, (0, 0), random.uniform(0.3, 1.2))
        xt = torch.from_numpy(x.astype(np.float32) / 255.0).permute(2, 0, 1)
        yt = torch.from_numpy(y.astype(np.float32))[None]
        return xt, yt


# ---------------------------------------------------------------- model
def cbr(i, o):
    return nn.Sequential(nn.Conv2d(i, o, 3, padding=1, bias=False), nn.BatchNorm2d(o), nn.ReLU(inplace=True),
                         nn.Conv2d(o, o, 3, padding=1, bias=False), nn.BatchNorm2d(o), nn.ReLU(inplace=True))


class UNetMV2(nn.Module):
    """U-Net ringan: encoder MobileNetV2, decoder sempit, skip resolusi penuh dari gambar untuk tepi tajam."""
    def __init__(self, pretrained=True):
        super().__init__()
        w = torchvision.models.MobileNet_V2_Weights.IMAGENET1K_V1 if pretrained else None
        m = torchvision.models.mobilenet_v2(weights=w).features
        self.e0, self.e1, self.e2, self.e3, self.e4 = m[0:2], m[2:4], m[4:7], m[7:14], m[14:19]
        self.p4 = nn.Sequential(nn.Conv2d(1280, 96, 1, bias=False), nn.BatchNorm2d(96), nn.ReLU(inplace=True))
        self.d4 = cbr(96 + 96, 64)
        self.d3 = cbr(64 + 32, 48)
        self.d2 = cbr(48 + 24, 32)
        self.d1 = cbr(32 + 16, 24)
        self.stem = nn.Sequential(nn.Conv2d(3, 16, 3, padding=1, bias=False), nn.BatchNorm2d(16), nn.ReLU(inplace=True))
        self.d0 = nn.Sequential(nn.Conv2d(24 + 16, 16, 3, padding=1, bias=False), nn.BatchNorm2d(16), nn.ReLU(inplace=True))
        self.out = nn.Conv2d(16, 1, 1)
        self.register_buffer('mean', torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1))
        self.register_buffer('std', torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1))

    @staticmethod
    def up(x, ref):
        return F.interpolate(x, size=ref.shape[-2:], mode='bilinear', align_corners=False)

    def forward(self, x):                       # x: 0..1 RGB
        xn = (x - self.mean) / self.std
        f0 = self.e0(xn); f1 = self.e1(f0); f2 = self.e2(f1); f3 = self.e3(f2); f4 = self.p4(self.e4(f3))
        d = self.d4(torch.cat([self.up(f4, f3), f3], 1))
        d = self.d3(torch.cat([self.up(d, f2), f2], 1))
        d = self.d2(torch.cat([self.up(d, f1), f1], 1))
        d = self.d1(torch.cat([self.up(d, f0), f0], 1))
        d = self.d0(torch.cat([self.up(d, x), self.stem(xn)], 1))
        return self.out(d)                      # logit


class Probs(nn.Module):                          # untuk ONNX: keluarkan probabilitas
    def __init__(self, m):
        super().__init__(); self.m = m

    def forward(self, x):
        return torch.sigmoid(self.m(x))


# ---------------------------------------------------------------- loss & eval
def dice_loss(lg, y):
    p = torch.sigmoid(lg)
    num = 2 * (p * y).sum((1, 2, 3)) + 1
    den = p.sum((1, 2, 3)) + y.sum((1, 2, 3)) + 1
    return (1 - num / den).mean()


@torch.no_grad()
def predict(model, X, tta=True, bs=32):
    model.eval(); out = []
    for i in range(0, len(X), bs):
        x = torch.from_numpy(X[i:i + bs].astype(np.float32) / 255.0).permute(0, 3, 1, 2)
        p = torch.sigmoid(model(x))
        if tta:
            p = (p + torch.sigmoid(model(x.flip(3))).flip(3)) / 2
        out.append(p[:, 0].numpy())
    return np.concatenate(out)


def metrics(P, Y, thr=0.5):
    B = P > thr
    inter = (B & (Y > 0)).sum((1, 2)); uni = (B | (Y > 0)).sum((1, 2))
    dice = 2 * inter / (B.sum((1, 2)) + Y.sum((1, 2)) + 1e-6)
    iou = inter / (uni + 1e-6)
    areaerr = np.abs(B.sum((1, 2)) - Y.sum((1, 2))) / (Y.sum((1, 2)) + 1e-6)
    return dict(dice=float(dice.mean()), iou=float(iou.mean()), area_err_median=float(np.median(areaerr)),
                area_err_mean=float(areaerr.mean()))


def fit(Xtr, Ytr, Xva, Yva, epochs, tag, init=None):
    model = UNetMV2(pretrained=init is None)
    if init: model.load_state_dict(torch.load(init))
    model = model.to(memory_format=torch.channels_last)
    ds = Aug(Xtr, Ytr, True)
    dl = torch.utils.data.DataLoader(ds, batch_size=16, shuffle=True, num_workers=4, drop_last=True,
                                     persistent_workers=True)
    enc = list(model.e0.parameters()) + list(model.e1.parameters()) + list(model.e2.parameters()) + \
          list(model.e3.parameters()) + list(model.e4.parameters())
    ids = {id(p) for p in enc}
    dec = [p for p in model.parameters() if id(p) not in ids]
    lr = 6e-4 if init else 1e-3
    opt = torch.optim.AdamW([{'params': enc, 'lr': lr * 0.5}, {'params': dec, 'lr': lr}], weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=[lr * 0.5, lr], total_steps=epochs * len(dl), pct_start=0.15)
    best = -1; t0 = time.time()
    for ep in range(epochs):
        model.train(); tl = 0
        for x, y in dl:
            x = x.contiguous(memory_format=torch.channels_last)
            lg = model(x)
            loss = F.binary_cross_entropy_with_logits(lg, y) + dice_loss(lg, y)
            opt.zero_grad(); loss.backward(); opt.step(); sched.step(); tl += loss.item()
        P = predict(model, Xva, tta=False); m = metrics(P, Yva)
        flag = ''
        if m['dice'] > best:
            best = m['dice']; torch.save(model.state_dict(), os.path.join(MODELS, f'{tag}.pt')); flag = ' *'
        print(f'ep{ep + 1}/{epochs} loss {tl / len(dl):.3f} val dice {m["dice"]:.3f} iou {m["iou"]:.3f} '
              f'areaErrMed {m["area_err_median"]:.3f} [{time.time() - t0:.0f}s]{flag}', flush=True)
    model.load_state_dict(torch.load(os.path.join(MODELS, f'{tag}.pt')))
    return model


def export_onnx(model, path):
    model.eval()
    wrapper = Probs(model).eval()
    dummy = torch.rand(1, 3, S, S)
    torch.onnx.export(wrapper, dummy, path, input_names=['x'], output_names=['p'], opset_version=17,
                      dynamic_axes=None, dynamo=False)
    print('onnx ->', path, os.path.getsize(path) // 1024, 'KB')


def peel_skin(x, m, steps=14):
    """Kikis piksel tepi masker yang warnanya mirip kulit peri-luka (model warna Lab dari cincin luar)."""
    m = m.astype(np.uint8)
    lab = cv2.cvtColor(cv2.GaussianBlur(x, (0, 0), 1.2), cv2.COLOR_RGB2LAB).astype(np.float32)
    k5 = np.ones((5, 5), np.uint8)
    ring = (cv2.dilate(m, np.ones((41, 41), np.uint8)) > 0) & (cv2.dilate(m, np.ones((9, 9), np.uint8)) == 0)
    if ring.sum() < 200 or m.sum() < 80:
        return m
    sk = np.median(lab[ring], 0); mad = np.median(np.abs(lab[ring] - sk), 0).mean() + 1e-3
    thr = 7.0 + 2.2 * mad
    d = np.sqrt(((lab - sk) ** 2 * np.array([0.5, 1.0, 1.0], np.float32)).sum(2))
    k3 = np.ones((3, 3), np.uint8)
    for _ in range(steps):
        edge = (m > 0) & (cv2.erode(m, k3) == 0)
        rem = edge & (d < thr)
        if not rem.any():
            break
        m[rem] = 0
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, k3)
    n, lab_cc, st, _ = cv2.connectedComponentsWithStats(m)
    if n <= 1:
        return m
    big = st[1:, cv2.CC_STAT_AREA].max()
    out = np.zeros_like(m)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= 0.15 * big:
            out[lab_cc == i] = 1
    return cv2.morphologyEx(out, cv2.MORPH_CLOSE, k5)


def grabcut_refine(job):
    """x RGB 256, c masker kasar 0/1, p probabilitas model. Kembalikan masker 0/1 atau None bila tidak layak."""
    x, c, p = job
    cv2.setNumThreads(1)
    area = int(c.sum())
    if area < 0.004 * S * S or area > 0.7 * S * S:
        return None
    k = max(3, int(0.05 * np.sqrt(area)) | 1)
    core = cv2.erode(c.astype(np.uint8), np.ones((k, k), np.uint8)) > 0
    core |= (p > 0.85) & (cv2.dilate(c.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0)
    near = cv2.dilate(c.astype(np.uint8), np.ones((2 * k + 9, 2 * k + 9), np.uint8)) > 0
    gm = np.full((S, S), cv2.GC_BGD, np.uint8)
    gm[near] = cv2.GC_PR_BGD
    gm[c > 0] = cv2.GC_PR_FGD
    gm[core] = cv2.GC_FGD
    if not core.any() or (gm == cv2.GC_BGD).sum() < 50:
        return None
    try:
        bgr = cv2.cvtColor(x, cv2.COLOR_RGB2BGR)
        cv2.grabCut(bgr, gm, None, np.zeros((1, 65)), np.zeros((1, 65)), 4, cv2.GC_INIT_WITH_MASK)
    except cv2.error:
        return None
    r = ((gm == cv2.GC_FGD) | (gm == cv2.GC_PR_FGD)).astype(np.uint8)
    r = cv2.morphologyEx(r, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    r = cv2.morphologyEx(r, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(r)
    if n <= 1:
        return None
    keep = np.zeros_like(r)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= 0.1 * st[1:, cv2.CC_STAT_AREA].max() and (core & (lab == i)).any():
            keep[lab == i] = 1
    keep = peel_skin(x, keep)
    ra = int(keep.sum()); iou = (keep & (c > 0)).sum() / max((keep | (c > 0)).sum(), 1)
    if ra < 0.002 * S * S or iou < 0.4 or ra > 2.2 * area:
        return None
    return keep


# ---------------------------------------------------------------- jalur kerja
def fuseg_sets():
    # label set uji FUSeg disembunyikan panitia: validasi untuk seleksi, Medetec sebagai uji eksternal
    tr = pairs_from_dir(os.path.join(FU, 'train'))
    va = pairs_from_dir(os.path.join(FU, 'validation'))
    te = pairs_from_dir(os.path.join(MED, 'train')) + pairs_from_dir(os.path.join(MED, 'test'))
    print('FUSeg train/val + Medetec(ekstern) pairs:', len(tr), len(va), len(te))
    return tr, va, te


def wseg_pairs():
    d = os.path.join(WSEG)
    out = []
    for f in sorted(os.listdir(os.path.join(d, 'sample'))):
        out.append((os.path.join(d, 'sample', f), os.path.join(d, 'mask', f)))
    return out


def main():
    mode = sys.argv[1]; epochs = int(sys.argv[2]) if len(sys.argv) > 2 else 30
    os.makedirs(MODELS, exist_ok=True)
    tr, va, te = fuseg_sets()
    Xtr, Ytr = load_set(tr); Xva, Yva = load_set(va); Xte, Yte = load_set(te)
    print('loaded', Xtr.shape, Xva.shape, Xte.shape, flush=True)

    if mode == 'round1':
        model = fit(Xtr, Ytr, Xva, Yva, epochs, 'best1')
        P = predict(model, Xte); print('UJI EKSTERN Medetec round1:', metrics(P, Yte))

    elif mode == 'refine':
        # masker kasar WoundSeg (mencakup seluruh luka, tepi balok) + prediksi model -> GrabCut berbenih -> tepi tajam
        from concurrent.futures import ProcessPoolExecutor
        model = UNetMV2(pretrained=False); model.load_state_dict(torch.load(os.path.join(MODELS, 'best1.pt')))
        Xw, Yw = load_set(wseg_pairs())
        P = predict(model, Xw)
        jobs = [(Xw[i], Yw[i], P[i].astype(np.float32)) for i in range(len(Xw))]
        with ProcessPoolExecutor(max_workers=int(os.environ.get('WORKERS', 8))) as ex:
            res = list(ex.map(grabcut_refine, jobs, chunksize=16))
        keep = [i for i, r in enumerate(res) if r is not None]
        print(f'WoundSeg: {len(Xw)} gambar, {len(keep)} masker dipertajam dipertahankan')
        np.savez_compressed(os.path.join(DATA, 'refined.npz'), X=Xw[keep], Y=np.stack([res[i] for i in keep]), idx=np.array(keep))

    elif mode == 'round2':
        z = np.load(os.path.join(DATA, 'refined.npz'))
        # FUSeg dua kali (lebih dipercaya) + WoundSeg halus
        rng = np.random.RandomState(0); sel = rng.permutation(len(z['X']))[:800]
        epochs = min(epochs, 7)
        X = np.concatenate([Xtr, Xtr, z['X'][sel]]); Y = np.concatenate([Ytr, Ytr, z['Y'][sel]])
        print('train round2:', X.shape)
        model = fit(X, Y, Xva, Yva, epochs, 'best2', init=os.path.join(MODELS, 'best1.pt'))
        mv = metrics(predict(model, Xva), Yva); me = metrics(predict(model, Xte), Yte)
        print('VALIDASI FUSeg round2:', mv); print('UJI EKSTERN Medetec round2:', me)
        export_onnx(model, os.path.join(MODELS, 'wound_seg.onnx'))
        json.dump({'val_dice': mv['dice'], 'val_iou': mv['iou'], 'val_area_err_median': mv['area_err_median'],
                   'ext_dice': me['dice'], 'ext_iou': me['iou'], 'ext_area_err_median': me['area_err_median'],
                   'input': S, 'trained': time.strftime('%Y-%m-%d')}, open(os.path.join(MODELS, 'meta.json'), 'w'))


if __name__ == '__main__':
    main()
