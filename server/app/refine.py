"""Edge refinement: seeded GrabCut inside a band around the network mask, then peeling edge pixels that are the same colour
as the surrounding skin. Works on a <=512 px copy and returns a mask at the original size. Returns the input mask when the
refinement disagrees too much with it (then the network edge is kept)."""
import cv2
import numpy as np

WORK = 512


def _peel(rgb, m, steps=14):
    m = m.astype(np.uint8)
    lab = cv2.cvtColor(cv2.GaussianBlur(rgb, (0, 0), 1.2), cv2.COLOR_RGB2LAB).astype(np.float32)
    k5 = np.ones((5, 5), np.uint8)
    ring = (cv2.dilate(m, np.ones((41, 41), np.uint8)) > 0) & (cv2.dilate(m, np.ones((9, 9), np.uint8)) == 0)
    if ring.sum() < 200 or m.sum() < 80:
        return m
    sk = np.median(lab[ring], 0)
    mad = float(np.median(np.abs(lab[ring] - sk), 0).mean()) + 1e-3
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
    n, lbl, st, _ = cv2.connectedComponentsWithStats(m)
    if n <= 1:
        return m
    big = st[1:, cv2.CC_STAT_AREA].max()
    out = np.zeros_like(m)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= 0.15 * big:
            out[lbl == i] = 1
    return cv2.morphologyEx(out, cv2.MORPH_CLOSE, k5)


def refine(rgb: np.ndarray, mask: np.ndarray, prob: np.ndarray) -> np.ndarray:
    h, w = mask.shape
    s = min(1.0, WORK / max(h, w))
    if s < 1.0:
        sm = (int(round(w * s)), int(round(h * s)))
        x = cv2.resize(rgb, sm, interpolation=cv2.INTER_AREA)
        c = cv2.resize(mask.astype(np.uint8), sm, interpolation=cv2.INTER_NEAREST)
        p = cv2.resize(prob.astype(np.float32), sm, interpolation=cv2.INTER_LINEAR)
    else:
        x, c, p = rgb, mask.astype(np.uint8), prob.astype(np.float32)
    H, W = c.shape
    area = int(c.sum())
    if area < 0.002 * H * W or area > 0.7 * H * W:
        return mask
    k = max(3, int(0.05 * np.sqrt(area)) | 1)
    core = cv2.erode(c, np.ones((k, k), np.uint8)) > 0
    core |= (p > 0.85) & (cv2.dilate(c, np.ones((9, 9), np.uint8)) > 0)
    near = cv2.dilate(c, np.ones((2 * k + 9, 2 * k + 9), np.uint8)) > 0
    gm = np.full((H, W), cv2.GC_BGD, np.uint8)
    gm[near] = cv2.GC_PR_BGD
    gm[c > 0] = cv2.GC_PR_FGD
    gm[core] = cv2.GC_FGD
    if not core.any() or (gm == cv2.GC_BGD).sum() < 50:
        return mask
    try:
        cv2.grabCut(cv2.cvtColor(x, cv2.COLOR_RGB2BGR), gm, None, np.zeros((1, 65)), np.zeros((1, 65)), 4, cv2.GC_INIT_WITH_MASK)
    except cv2.error:
        return mask
    r = ((gm == cv2.GC_FGD) | (gm == cv2.GC_PR_FGD)).astype(np.uint8)
    r = cv2.morphologyEx(r, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    r = cv2.morphologyEx(r, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, lbl, st, _ = cv2.connectedComponentsWithStats(r)
    if n <= 1:
        return mask
    keep = np.zeros_like(r)
    biggest = st[1:, cv2.CC_STAT_AREA].max()
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= 0.1 * biggest and (core & (lbl == i)).any():
            keep[lbl == i] = 1
    keep = _peel(x, keep)
    ra = int(keep.sum())
    iou = (keep & c).sum() / max((keep | c).sum(), 1)
    if ra < 0.002 * H * W or iou < 0.4 or ra > 2.2 * area:
        return mask
    if s < 1.0:
        keep = cv2.resize(keep, (w, h), interpolation=cv2.INTER_LINEAR)
        keep = (cv2.GaussianBlur(keep.astype(np.float32), (0, 0), 1.0) > 0.5).astype(np.uint8)
    return keep.astype(bool)
