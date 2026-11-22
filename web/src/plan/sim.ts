/* Illustrative "after" picture: surrounding skin is pushed into the defect (push-pull inpainting) and the scar, sutures or
   graft are drawn on top. An illustration of the plan, not a prediction of the clinical result. */
import { edt, gauss, type P2 } from './geom';
import type { Plan } from './planner';
import type { Stage } from './raster';

function rasterize(polys: P2[][], W: number, H: number, grow = 0): Uint8Array {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.fillStyle = '#fff';
  x.beginPath();
  polys.forEach((p) => { p.forEach((q, i) => (i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]))); x.closePath(); });
  x.fill('evenodd');
  if (grow) { x.lineWidth = grow * 2; x.strokeStyle = '#fff'; x.lineJoin = 'round'; x.stroke(); }
  const d = x.getImageData(0, 0, W, H).data;
  const m = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) m[i] = d[i * 4] > 127 ? 1 : 0;
  return m;
}

function inpaint(rgba: Uint8ClampedArray, W: number, H: number, hole: Uint8Array): Uint8ClampedArray {
  interface Lv { w: number; h: number; col: Float32Array; wt: Float32Array }
  const lv: Lv[] = [];
  let w = W, h = H;
  const col0 = new Float32Array(w * h * 3), wt0 = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { const k = hole[i] ? 0 : 1; wt0[i] = k; col0[i * 3] = rgba[i * 4] * k; col0[i * 3 + 1] = rgba[i * 4 + 1] * k; col0[i * 3 + 2] = rgba[i * 4 + 2] * k; }
  lv.push({ w, h, col: col0, wt: wt0 });
  while (w > 1 || h > 1) {
    const nw = Math.max(1, w >> 1), nh = Math.max(1, h >> 1);
    const c2 = new Float32Array(nw * nh * 3), w2 = new Float32Array(nw * nh);
    const p = lv[lv.length - 1];
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      let sr = 0, sg = 0, sb = 0, sw = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const xx = Math.min(w - 1, 2 * x + dx), yy = Math.min(h - 1, 2 * y + dy), i = yy * w + xx;
        sr += p.col[i * 3]; sg += p.col[i * 3 + 1]; sb += p.col[i * 3 + 2]; sw += p.wt[i];
      }
      const o = y * nw + x;
      c2[o * 3] = sr / 4; c2[o * 3 + 1] = sg / 4; c2[o * 3 + 2] = sb / 4; w2[o] = sw / 4;
    }
    lv.push({ w: nw, h: nh, col: c2, wt: w2 });
    w = nw; h = nh;
  }
  let up: { w: number; h: number; col: Float32Array } | null = null;
  for (let l = lv.length - 1; l >= 0; l--) {
    const Lv = lv[l];
    const out = new Float32Array(Lv.w * Lv.h * 3);
    for (let y = 0; y < Lv.h; y++) for (let x = 0; x < Lv.w; x++) {
      const i = y * Lv.w + x;
      const k = Math.min(1, Lv.wt[i]);
      let r = Lv.col[i * 3], g = Lv.col[i * 3 + 1], b = Lv.col[i * 3 + 2];
      if (k < 0.999) {
        let ur: number, ug: number, ub: number;
        if (up) {
          const fx = Math.max(0, (x + 0.5) / 2 - 0.5), fy = Math.max(0, (y + 0.5) / 2 - 0.5);
          const x0 = Math.min(up.w - 1, Math.floor(fx)), y0 = Math.min(up.h - 1, Math.floor(fy)), x1 = Math.min(up.w - 1, x0 + 1), y1 = Math.min(up.h - 1, y0 + 1);
          const ax = fx - x0, ay = fy - y0;
          const g3 = (xx: number, yy: number, c: number) => up!.col[(yy * up!.w + xx) * 3 + c];
          const bl = (c: number) => (g3(x0, y0, c) * (1 - ax) + g3(x1, y0, c) * ax) * (1 - ay) + (g3(x0, y1, c) * (1 - ax) + g3(x1, y1, c) * ax) * ay;
          ur = bl(0); ug = bl(1); ub = bl(2);
        } else { const nn = Math.max(Lv.wt[i], 1e-6); ur = r / nn; ug = g / nn; ub = b / nn; }
        r += (1 - k) * ur; g += (1 - k) * ug; b += (1 - k) * ub;
      }
      out[i * 3] = r; out[i * 3 + 1] = g; out[i * 3 + 2] = b;
    }
    up = { w: Lv.w, h: Lv.h, col: out };
  }
  const res = new Uint8ClampedArray(rgba);
  const f = up!.col;
  for (let i = 0; i < W * H; i++) if (hole[i]) { res[i * 4] = f[i * 3]; res[i * 4 + 1] = f[i * 3 + 1]; res[i * 4 + 2] = f[i * 3 + 2]; }
  return res;
}

function addTexture(res: Uint8ClampedArray, rgba: Uint8ClampedArray, W: number, H: number, hole: Uint8Array) {
  const d = edt(hole, W, H);
  const lum = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) lum[i] = rgba[i * 4] * 0.3 + rgba[i * 4 + 1] * 0.59 + rgba[i * 4 + 2] * 0.11;
  const bl = gauss(lum, W, H, 2);
  let s = 0, n = 0;
  for (let i = 0; i < W * H; i += 3) if (!hole[i] && d[i] > 3 && d[i] < 40) { const r = lum[i] - bl[i]; s += r * r; n++; }
  const sd = Math.sqrt(s / Math.max(1, n)) * 0.9;
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) || 1e-9;
  let nz: Float32Array = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) nz[i] = Math.sqrt(-2 * Math.log(rnd())) * Math.cos(6.2832 * rnd());
  nz = gauss(nz, W, H, 1);
  let lo: Float32Array = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) lo[i] = rnd() - 0.5;
  lo = gauss(lo, W, H, Math.max(6, Math.round(Math.max(W, H) / 120)));
  let lmax = 1e-6;
  for (let i = 0; i < W * H; i++) lmax = Math.max(lmax, Math.abs(lo[i]));
  for (let i = 0; i < W * H; i++) if (hole[i]) {
    const t = (nz[i] + (lo[i] / lmax) * 1.4) * sd * 1.6;
    for (let c = 0; c < 3; c++) res[i * 4 + c] = Math.max(0, Math.min(255, res[i * 4 + c] + t));
  }
}

function skinTone(rgba: Uint8ClampedArray, W: number, H: number, hole: Uint8Array): [number, number, number] {
  const d = edt(hole, W, H);
  const r: number[] = [], g: number[] = [], b: number[] = [];
  for (let i = 0; i < W * H; i += 4) if (!hole[i] && d[i] > 4 && d[i] < 30) { r.push(rgba[i * 4]); g.push(rgba[i * 4 + 1]); b.push(rgba[i * 4 + 2]); }
  const med = (a: number[]) => { if (!a.length) return 200; a.sort((x, y) => x - y); return a[a.length >> 1]; };
  return [med(r), med(g), med(b)];
}

const polyPerimeter = (p: P2[]) => { let L = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); } return L; };

/** stage 'day0' shows sutures and fresh scars, 'mature' shows pale scars */
export function renderAfter(st: Stage, plan: Plan, mode: 'day0' | 'mature' = 'day0'): HTMLCanvasElement {
  const { W, H } = st;
  const base = document.createElement('canvas');
  base.width = W; base.height = H;
  const bx = base.getContext('2d')!;
  bx.drawImage(st.img, 0, 0);
  const A = plan.after;
  if (!A || A.kind === 'none' || !st.geo) return base;
  const k = Math.max(1, W / 900), cm = st.cmPerPx;
  const polys = A.region ? [A.region] : [];
  let tone: [number, number, number] | null = null;
  if (polys.length && A.kind !== 'bed') {
    const hole = rasterize(polys, W, H, 1.5);
    const res = inpaint(st.rgba, W, H, hole);
    addTexture(res, st.rgba, W, H, hole);
    tone = skinTone(st.rgba, W, H, hole);
    bx.putImageData(new ImageData(res as Uint8ClampedArray<ArrayBuffer>, W, H), 0, 0);
  }
  bx.save();
  bx.lineCap = 'round'; bx.lineJoin = 'round';
  const scarW = Math.max(1.2 * k, (0.9 / (cm * 10)) * (mode === 'mature' ? 0.6 : 1.1));
  const scar = (a: P2, b: P2) => { bx.beginPath(); bx.moveTo(a[0], a[1]); bx.lineTo(b[0], b[1]); bx.lineWidth = scarW; bx.strokeStyle = mode === 'mature' ? 'rgba(255,240,235,.55)' : 'rgba(185,70,80,.85)'; bx.stroke(); };
  const path = (p: P2[]) => { bx.beginPath(); p.forEach((q, i) => (i ? bx.lineTo(q[0], q[1]) : bx.moveTo(q[0], q[1]))); bx.closePath(); };
  if (A.kind === 'closure' && A.a && A.b) {
    scar(A.a, A.b);
    if (mode !== 'mature') {
      const dx = A.b[0] - A.a[0], dy = A.b[1] - A.a[1], Ln = Math.hypot(dx, dy) || 1, ux = dx / Ln, uy = dy / Ln, nx = -uy, ny = ux, half = 4 / (cm * 10);
      const n = A.n || 5;
      for (let i = 0; i < n; i++) {
        const t = 0.08 + 0.84 * (i / Math.max(1, n - 1)), px = A.a[0] + dx * t, py = A.a[1] + dy * t;
        bx.beginPath(); bx.moveTo(px - nx * half, py - ny * half); bx.lineTo(px + nx * half, py + ny * half); bx.lineWidth = 1.3 * k; bx.strokeStyle = 'rgba(30,45,110,.95)'; bx.stroke();
      }
    }
  } else if (A.kind === 'adv' || A.kind === 'vy' || A.kind === 'z') {
    (A.lines || []).forEach((l) => scar(l[0], l[1]));
    if (A.edge) scar(A.edge[0], A.edge[1]);
  } else if ((A.kind === 'stsg' || A.kind === 'ftsg') && polys[0]) {
    const t = tone || [210, 170, 150];
    const tint = A.kind === 'stsg' ? [t[0] * 0.98 + 8, t[1] * 0.9 + 4, t[2] * 0.9 + 6] : [t[0] * 0.99, t[1] * 0.97, t[2] * 0.97];
    const day0 = mode !== 'mature';
    bx.save(); path(polys[0]); bx.clip();
    bx.fillStyle = `rgba(${tint.map(Math.round).join(',')},${day0 ? 0.78 : 0.45})`; bx.fillRect(0, 0, W, H);
    // pinkish bed showing through the mesh slits
    if (A.kind === 'stsg') {
      const sp = 7 * k, len = 5.2 * k;
      bx.lineCap = 'round';
      for (let row = -2; row * sp < H + sp * 2; row++) for (let col = -2; col * sp * 1.6 < W + sp * 3; col++) {
        const x = col * sp * 1.6 + (row % 2 ? sp * 0.8 : 0), y = row * sp * 0.9;
        bx.beginPath(); bx.moveTo(x - len / 2, y); bx.lineTo(x + len / 2, y);
        bx.lineWidth = 1.5 * k; bx.strokeStyle = day0 ? 'rgba(176,58,66,.72)' : 'rgba(205,150,140,.35)'; bx.stroke();
      }
    }
    // sheen and the soft inner edge where the graft meets the bed
    path(polys[0]); bx.shadowColor = 'rgba(40,10,10,.55)'; bx.shadowBlur = 9 * k; bx.lineWidth = 3 * k; bx.strokeStyle = 'rgba(0,0,0,0.001)'; bx.stroke();
    bx.restore();
    // staples or sutures around the margin
    if (day0) {
      const poly = polys[0], n = Math.max(10, Math.min(46, Math.round(polyPerimeter(poly) / (9 * k))));
      let acc = 0; const per = polyPerimeter(poly); let seg2 = 0, run = 0; const step = per / n;
      for (let i = 0; i < n; i++) {
        const target = i * step;
        while (seg2 < poly.length - 1 && run + Math.hypot(poly[seg2 + 1][0] - poly[seg2][0], poly[seg2 + 1][1] - poly[seg2][1]) < target) { run += Math.hypot(poly[seg2 + 1][0] - poly[seg2][0], poly[seg2 + 1][1] - poly[seg2][1]); seg2++; }
        const a2 = poly[seg2], b2 = poly[(seg2 + 1) % poly.length], d = Math.hypot(b2[0] - a2[0], b2[1] - a2[1]) || 1, f = (target - run) / d;
        const px = a2[0] + (b2[0] - a2[0]) * f, py = a2[1] + (b2[1] - a2[1]) * f, nx = -(b2[1] - a2[1]) / d, ny = (b2[0] - a2[0]) / d;
        bx.beginPath(); bx.moveTo(px - nx * 3 * k, py - ny * 3 * k); bx.lineTo(px + nx * 3 * k, py + ny * 3 * k); bx.lineWidth = 1.6 * k; bx.strokeStyle = 'rgba(25,30,60,.95)'; bx.stroke();
        acc += step;
      }
      void acc;
    }
    path(polys[0]); bx.lineWidth = 1.2 * k; bx.strokeStyle = day0 ? 'rgba(120,45,50,.7)' : 'rgba(255,240,235,.4)'; bx.stroke();
  } else if (A.kind === 'bed' && polys[0]) {
    bx.save(); path(polys[0]); bx.clip();
    bx.fillStyle = 'rgba(196,62,72,.86)'; bx.fillRect(0, 0, W, H);
    let sd = 99;
    const r2 = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    polys[0].forEach((q) => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
    const cnt = Math.round(((x1 - x0) * (y1 - y0)) / (9 * k * k));
    for (let i = 0; i < cnt; i++) {
      const x = x0 + r2() * (x1 - x0), y = y0 + r2() * (y1 - y0), rr = (1 + r2() * 2.6) * k, c = r2();
      bx.beginPath(); bx.arc(x, y, rr, 0, 6.3);
      bx.fillStyle = c < 0.4 ? 'rgba(232,112,118,.55)' : c < 0.8 ? 'rgba(150,38,50,.5)' : 'rgba(255,230,225,.28)'; bx.fill();
    }
    for (let i = 0; i < cnt / 6; i++) { const x = x0 + r2() * (x1 - x0), y = y0 + r2() * (y1 - y0); bx.beginPath(); bx.arc(x, y, (0.6 + r2()) * k, 0, 6.3); bx.fillStyle = 'rgba(255,255,255,.55)'; bx.fill(); }
    bx.restore();
    path(polys[0]); bx.lineWidth = 1.5 * k; bx.strokeStyle = 'rgba(255,255,255,.8)'; bx.stroke();
  }
  bx.restore();
  return base;
}
