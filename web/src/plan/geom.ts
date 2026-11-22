/* Geometry on a working-size mask: sub-pixel contours, hull, Feret, minimum box, distance transform, margins.
   All units are working pixels; cmPerPx converts to centimetres. */
export type P2 = [number, number];

export function edt(mask: Uint8Array, W: number, H: number): Float32Array {
  const INF = 1e12;
  const N = Math.max(W, H);
  const f = new Float64Array(N);
  const d = new Float64Array(N);
  const z = new Float64Array(N + 1);
  const v = new Int32Array(N);
  const pass = (n: number) => {
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      const p = v[k];
      d[q] = (q - p) * (q - p) + f[p];
    }
  };
  const g = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) g[i] = mask[i] ? 0 : INF;
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) f[y] = g[y * W + x];
    pass(H);
    for (let y = 0; y < H; y++) g[y * W + x] = d[y];
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) f[x] = g[y * W + x];
    pass(W);
    for (let x = 0; x < W; x++) g[y * W + x] = d[x];
  }
  const out = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = Math.sqrt(g[i]);
  return out;
}

export function boxBlur(src: Float32Array, W: number, H: number, r: number): Float32Array {
  if (r < 1) return Float32Array.from(src);
  const tmp = new Float32Array(W * H);
  const out = new Float32Array(W * H);
  const k = 1 / (2 * r + 1);
  for (let y = 0; y < H; y++) {
    let s = 0;
    const o = y * W;
    for (let x = -r; x <= r; x++) s += src[o + Math.min(W - 1, Math.max(0, x))];
    for (let x = 0; x < W; x++) {
      tmp[o + x] = s * k;
      s += src[o + Math.min(W - 1, x + r + 1)] - src[o + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < H; y++) {
      out[y * W + x] = s * k;
      s += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x];
    }
  }
  return out;
}
export const gauss = (f: Float32Array, W: number, H: number, r: number) => boxBlur(boxBlur(boxBlur(f, W, H, r), W, H, r), W, H, r);

/** marching squares at an iso level, returning closed polylines */
export function contours(f: Float32Array, W: number, H: number, iso: number): P2[][] {
  const hid = (x: number, y: number) => (y * W + x) * 2;
  const vid = (x: number, y: number) => (y * W + x) * 2 + 1;
  const adj = new Map<number, number[]>();
  const link = (a: number, b: number) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push(b);
    adj.get(b)!.push(a);
  };
  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const a = f[y * W + x] > iso, b = f[y * W + x + 1] > iso, c = f[(y + 1) * W + x + 1] > iso, d = f[(y + 1) * W + x] > iso;
      const idx = (a ? 1 : 0) | (b ? 2 : 0) | (c ? 4 : 0) | (d ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      const T = hid(x, y), B = hid(x, y + 1), L = vid(x, y), R = vid(x + 1, y);
      switch (idx) {
        case 1: case 14: link(L, T); break;
        case 2: case 13: link(T, R); break;
        case 3: case 12: link(L, R); break;
        case 4: case 11: link(R, B); break;
        case 6: case 9: link(T, B); break;
        case 7: case 8: link(L, B); break;
        case 5: case 10: {
          const m = (f[y * W + x] + f[y * W + x + 1] + f[(y + 1) * W + x + 1] + f[(y + 1) * W + x]) / 4 > iso;
          if ((idx === 5) === m) { link(L, B); link(T, R); } else { link(L, T); link(R, B); }
          break;
        }
      }
    }
  }
  const pt = (id: number): P2 => {
    const vert = id & 1, cell = id >> 1, x = cell % W, y = (cell / W) | 0;
    if (!vert) { const p = f[y * W + x], q = f[y * W + x + 1]; return [x + (iso - p) / (q - p || 1e-9), y]; }
    const p = f[y * W + x], q = f[(y + 1) * W + x];
    return [x, y + (iso - p) / (q - p || 1e-9)];
  };
  const seen = new Set<number>();
  const out: P2[][] = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const poly: P2[] = [];
    let prev = -1;
    let cur: number | undefined = start;
    while (cur !== undefined && !seen.has(cur)) {
      seen.add(cur);
      poly.push(pt(cur));
      let nxt: number | undefined;
      for (const n of adj.get(cur)!) if (n !== prev && !seen.has(n)) { nxt = n; break; }
      prev = cur;
      cur = nxt;
    }
    if (poly.length > 3) out.push(poly);
  }
  return out;
}

export const polyArea = (p: P2[]) => {
  let s = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return s / 2;
};
export const polyLen = (p: P2[]) => {
  let s = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  return s;
};

export function hull(pts: P2[]): P2[] {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: P2[] = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const up: P2[] = [];
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  up.pop(); lo.pop();
  return lo.concat(up);
}

export interface Shape { feretMax: number; feretA: P2; feretB: P2; rect: P2[]; rectLong: number; rectShort: number; rectAng: number }
export function shapeMetrics(h: P2[]): Shape {
  let fmax = 0, fa = h[0], fb = h[0];
  for (let i = 0; i < h.length; i++) for (let j = i + 1; j < h.length; j++) {
    const d = Math.hypot(h[i][0] - h[j][0], h[i][1] - h[j][1]);
    if (d > fmax) { fmax = d; fa = h[i]; fb = h[j]; }
  }
  let best: { area: number; ang: number; a: P2; x0: number; x1: number; y0: number; y1: number; w: number; h: number } | null = null;
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const c = Math.cos(-ang), s = Math.sin(-ang);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of h) {
      const x = (p[0] - a[0]) * c - (p[1] - a[1]) * s, y = (p[0] - a[0]) * s + (p[1] - a[1]) * c;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const w = x1 - x0, hh = y1 - y0, area = w * hh;
    if (!best || area < best.area) best = { area, ang, a, x0, x1, y0, y1, w, h: hh };
  }
  const bb = best!;
  const ca = Math.cos(bb.ang), sa = Math.sin(bb.ang);
  const corner = (x: number, y: number): P2 => [bb.a[0] + x * ca - y * sa, bb.a[1] + x * sa + y * ca];
  const rect = [corner(bb.x0, bb.y0), corner(bb.x1, bb.y0), corner(bb.x1, bb.y1), corner(bb.x0, bb.y1)];
  return { feretMax: fmax, feretA: fa, feretB: fb, rect, rectLong: Math.max(bb.w, bb.h), rectShort: Math.min(bb.w, bb.h), rectAng: bb.ang };
}

/** Everything the planner and the drawings need, at a working resolution. */
export interface Geo {
  W: number; H: number; mask: Uint8Array; polys: P2[][]; poly: P2[]; centroid: P2; areaPx: number;
  cmPerPx: number; shape: Shape; theta0: number; dist: Float32Array; marginPoly: (mm: number) => P2[] | null;
}

export function buildGeo(mask: Uint8Array, W: number, H: number, cmPerPx: number): Geo | null {
  let n = 0, sx = 0, sy = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y * W + x]) { n++; sx += x; sy += y; }
  if (n < 30) return null;
  const f = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) f[i] = mask[i];
  const sm = gauss(f, W, H, 1);
  let polys = contours(sm, W, H, 0.5).filter((p) => Math.abs(polyArea(p)) > 12);
  polys.sort((a, b) => Math.abs(polyArea(b)) - Math.abs(polyArea(a)));
  const poly = polys[0];
  if (!poly) return null;
  const sh = shapeMetrics(hull(poly));
  const outside = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) outside[i] = mask[i] ? 0 : 1;
  const dOut = edt(mask, W, H); // distance to the wound for outside pixels
  const marginPoly = (mm: number): P2[] | null => {
    const px = mm / (cmPerPx * 10);
    const field = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) field[i] = px - dOut[i];
    const c = contours(field, W, H, 0).filter((p) => Math.abs(polyArea(p)) > 12).sort((a, b) => Math.abs(polyArea(b)) - Math.abs(polyArea(a)));
    return c[0] || null;
  };
  return { W, H, mask, polys, poly, centroid: [sx / n, sy / n], areaPx: n, cmPerPx, shape: sh, theta0: sh.rectAng, dist: dOut, marginPoly };
}
