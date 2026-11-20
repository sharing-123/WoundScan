/* Geometri presisi: kontur subpiksel, Feret, kotak minimum, margin, morfologi. */
window.G = (() => {

  /* ---------- medan float ---------- */
  function boxBlur(src, W, H, r) {
    if (r < 1) return Float32Array.from(src);
    const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
    const k = 1 / (2 * r + 1);
    for (let y = 0; y < H; y++) {
      let s = 0; const o = y * W;
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
  const gauss = (f, W, H, r) => { let a = boxBlur(f, W, H, r); a = boxBlur(a, W, H, r); return boxBlur(a, W, H, r); };

  function resizeBilinear(src, sw, sh, dw, dh) {
    const out = new Float32Array(dw * dh);
    const sx = sw / dw, sy = sh / dh;
    for (let y = 0; y < dh; y++) {
      const fy = Math.max(0, Math.min(sh - 1, (y + 0.5) * sy - 0.5));
      const y0 = Math.floor(fy), y1 = Math.min(sh - 1, y0 + 1), wy = fy - y0;
      for (let x = 0; x < dw; x++) {
        const fx = Math.max(0, Math.min(sw - 1, (x + 0.5) * sx - 0.5));
        const x0 = Math.floor(fx), x1 = Math.min(sw - 1, x0 + 1), wx = fx - x0;
        const a = src[y0 * sw + x0], b = src[y0 * sw + x1], c = src[y1 * sw + x0], d = src[y1 * sw + x1];
        out[y * dw + x] = (a * (1 - wx) + b * wx) * (1 - wy) + (c * (1 - wx) + d * wx) * wy;
      }
    }
    return out;
  }

  /* ---------- komponen terhubung ---------- */
  function components(mask, W, H) {
    const lab = new Int32Array(W * H); const comps = []; let n = 0;
    const stack = new Int32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      if (!mask[i] || lab[i]) continue;
      n++; let sp = 0, cnt = 0; stack[sp++] = i; lab[i] = n;
      let minx = W, miny = H, maxx = 0, maxy = 0;
      while (sp) {
        const p = stack[--sp]; cnt++;
        const x = p % W, y = (p / W) | 0;
        if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
        if (x > 0 && mask[p - 1] && !lab[p - 1]) { lab[p - 1] = n; stack[sp++] = p - 1; }
        if (x < W - 1 && mask[p + 1] && !lab[p + 1]) { lab[p + 1] = n; stack[sp++] = p + 1; }
        if (y > 0 && mask[p - W] && !lab[p - W]) { lab[p - W] = n; stack[sp++] = p - W; }
        if (y < H - 1 && mask[p + W] && !lab[p + W]) { lab[p + W] = n; stack[sp++] = p + W; }
      }
      comps.push({ id: n, area: cnt, minx, miny, maxx, maxy });
    }
    return { lab, comps };
  }

  function keepComponents(mask, W, H, minFrac, maxKeep) {
    const { lab, comps } = components(mask, W, H);
    if (!comps.length) return mask;
    comps.sort((a, b) => b.area - a.area);
    const total = comps.reduce((s, c) => s + c.area, 0);
    const keep = new Set();
    comps.slice(0, maxKeep || 8).forEach(c => { if (c.area >= Math.max(30, minFrac * comps[0].area)) keep.add(c.id); });
    const out = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) if (lab[i] && keep.has(lab[i])) out[i] = 1;
    return out;
  }

  function fillHoles(mask, W, H, maxHoleFrac) {
    const inv = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) inv[i] = mask[i] ? 0 : 1;
    const { lab, comps } = components(inv, W, H);
    const out = Uint8Array.from(mask);
    const total = mask.reduce((s, v) => s + v, 0);
    comps.forEach(c => {
      const border = c.minx === 0 || c.miny === 0 || c.maxx === W - 1 || c.maxy === H - 1;
      if (!border && c.area <= Math.max(60, maxHoleFrac * total)) {
        for (let i = 0; i < W * H; i++) if (lab[i] === c.id) out[i] = 1;
      }
    });
    return out;
  }

  /* ---------- kontur subpiksel (marching squares) ---------- */
  function contours(f, W, H, iso) {
    const hid = (x, y) => (y * W + x) * 2, vid = (x, y) => (y * W + x) * 2 + 1;
    const adj = new Map();
    const link = (a, b) => {
      if (!adj.has(a)) adj.set(a, []); if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push(b); adj.get(b).push(a);
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
          case 5: { const m = (f[y * W + x] + f[y * W + x + 1] + f[(y + 1) * W + x + 1] + f[(y + 1) * W + x]) / 4 > iso;
            if (m) { link(L, B); link(T, R); } else { link(L, T); link(R, B); } break; }
          case 10: { const m = (f[y * W + x] + f[y * W + x + 1] + f[(y + 1) * W + x + 1] + f[(y + 1) * W + x]) / 4 > iso;
            if (m) { link(L, T); link(R, B); } else { link(L, B); link(T, R); } break; }
        }
      }
    }
    const pt = (id) => {
      const v = id & 1, cell = id >> 1, x = cell % W, y = (cell / W) | 0;
      if (!v) { const p = f[y * W + x], q = f[y * W + x + 1]; const t = (iso - p) / (q - p || 1e-9); return [x + t, y]; }
      const p = f[y * W + x], q = f[(y + 1) * W + x]; const t = (iso - p) / (q - p || 1e-9); return [x, y + t];
    };
    const seen = new Set(), out = [];
    for (const start of adj.keys()) {
      if (seen.has(start)) continue;
      const poly = []; let prev = -1, cur = start;
      while (cur !== undefined && !seen.has(cur)) {
        seen.add(cur); poly.push(pt(cur));
        const nb = adj.get(cur); let nxt;
        for (const n of nb) if (n !== prev && !seen.has(n)) { nxt = n; break; }
        prev = cur; cur = nxt;
      }
      if (poly.length > 3) out.push(poly);
    }
    return out;
  }

  const polyLen = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += Math.hypot(b[0] - a[0], b[1] - a[1]); } return s; };
  const polyArea = (p) => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };

  /* ---------- hull, Feret, kotak minimum ---------- */
  function hull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = []; for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    const up = []; for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    up.pop(); lo.pop(); return lo.concat(up);
  }

  function shapeMetrics(h) {
    // Feret maksimum
    let fmax = 0, fa = h[0], fb = h[0];
    for (let i = 0; i < h.length; i++) for (let j = i + 1; j < h.length; j++) {
      const d = Math.hypot(h[i][0] - h[j][0], h[i][1] - h[j][1]);
      if (d > fmax) { fmax = d; fa = h[i]; fb = h[j]; }
    }
    // kotak berluas minimum + lebar minimum (rotating calipers sederhana)
    let best = null, wmin = Infinity;
    for (let i = 0; i < h.length; i++) {
      const a = h[i], b = h[(i + 1) % h.length];
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); const c = Math.cos(-ang), s = Math.sin(-ang);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of h) { const x = (p[0] - a[0]) * c - (p[1] - a[1]) * s, y = (p[0] - a[0]) * s + (p[1] - a[1]) * c; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const w = x1 - x0, hh = y1 - y0; const area = w * hh;
      if (!best || area < best.area) best = { area, ang, a, x0, x1, y0, y1, w, h: hh };
      wmin = Math.min(wmin, Math.min(w, hh));
    }
    const ca = Math.cos(best.ang), sa = Math.sin(best.ang);
    const corner = (x, y) => [best.a[0] + x * ca - y * sa, best.a[1] + x * sa + y * ca];
    const rect = [corner(best.x0, best.y0), corner(best.x1, best.y0), corner(best.x1, best.y1), corner(best.x0, best.y1)];
    return { feretMax: fmax, feretA: fa, feretB: fb, feretMin: wmin, rect, rectLong: Math.max(best.w, best.h), rectShort: Math.min(best.w, best.h), rectAng: best.ang };
  }

  /* lebar maksimum tegak lurus terhadap sumbu (satuan piksel) */
  function extentAlong(pts, ang) {
    const c = Math.cos(ang), s = Math.sin(ang); let lo = Infinity, hi = -Infinity, a = null, b = null;
    for (const p of pts) { const t = p[0] * c + p[1] * s; if (t < lo) { lo = t; a = p; } if (t > hi) { hi = t; b = p; } }
    return { len: hi - lo, a, b };
  }

  /* ---------- transformasi jarak euklides (Felzenszwalb & Huttenlocher) ---------- */
  function edt(mask, W, H) { // jarak (piksel) ke piksel mask terdekat; 0 di dalam mask
    const INF = 1e12, N = Math.max(W, H);
    const f = new Float64Array(N), d = new Float64Array(N), z = new Float64Array(N + 1), v = new Int32Array(N);
    const pass = (n) => {
      let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
      for (let q = 1; q < n; q++) {
        let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
        k++; v[k] = q; z[k] = s; z[k + 1] = INF;
      }
      k = 0;
      for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const p = v[k]; d[q] = (q - p) * (q - p) + f[p]; }
    };
    const g = new Float64Array(W * H);
    for (let i = 0; i < W * H; i++) g[i] = mask[i] ? 0 : INF;
    for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) f[y] = g[y * W + x]; pass(H); for (let y = 0; y < H; y++) g[y * W + x] = d[y]; }
    for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) f[x] = g[y * W + x]; pass(W); for (let x = 0; x < W; x++) g[y * W + x] = d[x]; }
    const out = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) out[i] = Math.sqrt(g[i]);
    return out;
  }

  /* ---------- Lab ---------- */
  function rgb2lab(r, g, b) {
    const lin = (c) => { c /= 255; return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92; };
    const R = lin(r), Gc = lin(g), B = lin(b);
    let X = (R * 0.4124564 + Gc * 0.3575761 + B * 0.1804375) / 0.95047;
    let Y = (R * 0.2126729 + Gc * 0.7151522 + B * 0.0721750);
    let Z = (R * 0.0193339 + Gc * 0.1191920 + B * 0.9503041) / 1.08883;
    const f = (t) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    const fx = f(X), fy = f(Y), fz = f(Z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }

  return { boxBlur, gauss, resizeBilinear, components, keepComponents, fillHoles, contours, polyLen, polyArea, hull, shapeMetrics, extentAlong, edt, rgb2lab };
})();
