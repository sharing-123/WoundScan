/* Segmentasi: model ONNX (U-Net MobileNetV2) + segmentasi semi-otomatis ketuk-luka. Semua berjalan lokal di browser. */
window.SEG = (() => {
  const S = 256;
  let session = null;

  async function load(url) {
    ort.env.wasm.wasmPaths = new URL('lib/', document.baseURI).href;
    ort.env.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 2);
    session = await ort.InferenceSession.create(url, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    return true;
  }
  const ready = () => !!session;

  /* gambar RGBA (W,H) -> peta probabilitas W*H, TTA: asli + flip H + flip V */
  async function predict(rgba, W, H) {
    const c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d', { willReadFrequently: true });
    const src = document.createElement('canvas'); src.width = W; src.height = H;
    src.getContext('2d').putImageData(new ImageData(rgba, W, H), 0, 0);
    x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, S, S);
    const d = x.getImageData(0, 0, S, S).data;
    const n = S * S, base = new Float32Array(3 * n);
    for (let i = 0; i < n; i++) { base[i] = d[i * 4] / 255; base[n + i] = d[i * 4 + 1] / 255; base[2 * n + i] = d[i * 4 + 2] / 255; }
    const flipH = (a) => { const o = new Float32Array(a.length); for (let ch = 0; ch < 3; ch++) for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) o[ch * n + y * S + xx] = a[ch * n + y * S + (S - 1 - xx)]; return o; };
    const flipV = (a) => { const o = new Float32Array(a.length); for (let ch = 0; ch < 3; ch++) for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) o[ch * n + y * S + xx] = a[ch * n + (S - 1 - y) * S + xx]; return o; };
    const run = async (arr) => (await session.run({ x: new ort.Tensor('float32', arr, [1, 3, S, S]) })).p.data;
    const p0 = await run(base);
    const p1 = await run(flipH(base));
    const p2 = await run(flipV(base));
    const acc = new Float32Array(n);
    for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
      acc[y * S + xx] = (p0[y * S + xx] + p1[y * S + (S - 1 - xx)] + p2[(S - 1 - y) * S + xx]) / 3;
    }
    return G.resizeBilinear(acc, S, S, W, H);
  }

  /* peta probabilitas -> masker bersih */
  function fromProb(prob, W, H, thr) {
    const sm = G.gauss(prob, W, H, Math.max(1, Math.round(Math.max(W, H) / 400)));
    let m = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) m[i] = sm[i] > thr ? 1 : 0;
    m = G.keepComponents(m, W, H, 0.08, 6);
    m = G.fillHoles(m, W, H, 0.05);
    return m;
  }

  /* ---------- ketuk-luka: region growing di ruang Lab ---------- */
  function lab(rgba, W, H) {
    const L = new Float32Array(W * H), A = new Float32Array(W * H), B = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) { const v = G.rgb2lab(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]); L[i] = v[0]; A[i] = v[1]; B[i] = v[2]; }
    return { L, A, B };
  }
  function otsu(vals, lo, hi, bins) {
    const h = new Float64Array(bins); let n = 0;
    for (const v of vals) { const b = Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / (hi - lo) * bins))); h[b]++; n++; }
    let sum = 0; for (let i = 0; i < bins; i++) sum += i * h[i];
    let wb = 0, sb = 0, best = 0, th = 0;
    for (let i = 0; i < bins; i++) {
      wb += h[i]; if (!wb) continue; const wf = n - wb; if (!wf) break;
      sb += i * h[i]; const mb = sb / wb, mf = (sum - sb) / wf; const v = wb * wf * (mb - mf) * (mb - mf);
      if (v > best) { best = v; th = i; }
    }
    return lo + (th + 0.5) / bins * (hi - lo);
  }

  function grow(rgba, W, H, sx, sy, sens) {
    const k = Math.max(1, Math.ceil(Math.max(W, H) / 520));
    const w = Math.floor(W / k), h = Math.floor(H / k);
    const small = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, c = 0;
      for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) { const p = ((y * k + dy) * W + (x * k + dx)) * 4; r += rgba[p]; g += rgba[p + 1]; b += rgba[p + 2]; c++; }
      const q = (y * w + x) * 4; small[q] = r / c; small[q + 1] = g / c; small[q + 2] = b / c; small[q + 3] = 255;
    }
    const { L, A, B } = lab(small, w, h);
    const cx = Math.min(w - 1, Math.max(0, Math.round(sx / k))), cy = Math.min(h - 1, Math.max(0, Math.round(sy / k)));
    const r0 = Math.max(2, Math.round(0.012 * Math.max(w, h)));
    let mL = 0, mA = 0, mB = 0, c0 = 0;
    for (let y = cy - r0; y <= cy + r0; y++) for (let x = cx - r0; x <= cx + r0; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h || (x - cx) ** 2 + (y - cy) ** 2 > r0 * r0) continue;
      const i = y * w + x; mL += L[i]; mA += A[i]; mB += B[i]; c0++;
    }
    mL /= c0; mA /= c0; mB /= c0;
    const dist = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) dist[i] = Math.sqrt(0.35 * (L[i] - mL) ** 2 + (A[i] - mA) ** 2 + (B[i] - mB) ** 2);
    const win = Math.round(0.42 * Math.min(w, h)) + 20;
    const inWin = (x, y) => Math.abs(x - cx) <= win && Math.abs(y - cy) <= win;
    // wilayah stabil: pilih ambang saat luas komponen berbenih paling sedikit berubah (tepi warna sebenarnya)
    const seen = new Int32Array(w * h), stack = new Int32Array(w * h); let stamp = 0;
    const flood = (T, keep) => {
      stamp++; let sp = 0, area = 0; const s0 = cy * w + cx; seen[s0] = stamp; stack[sp++] = s0;
      const out = keep ? new Uint8Array(w * h) : null;
      while (sp) {
        const p = stack[--sp]; area++; if (out) out[p] = 1; const x = p % w, y = (p / w) | 0;
        if (x > 0 && seen[p - 1] !== stamp && dist[p - 1] < T && inWin(x - 1, y)) { seen[p - 1] = stamp; stack[sp++] = p - 1; }
        if (x < w - 1 && seen[p + 1] !== stamp && dist[p + 1] < T && inWin(x + 1, y)) { seen[p + 1] = stamp; stack[sp++] = p + 1; }
        if (y > 0 && seen[p - w] !== stamp && dist[p - w] < T && inWin(x, y - 1)) { seen[p - w] = stamp; stack[sp++] = p - w; }
        if (y < h - 1 && seen[p + w] !== stamp && dist[p + w] < T && inWin(x, y + 1)) { seen[p + w] = stamp; stack[sp++] = p + w; }
      }
      return keep ? { area, out } : area;
    };
    const winArea = (2 * win + 1) ** 2, minArea = Math.max(30, 0.0012 * w * h), step = 1.5;
    const Ts = []; for (let t = 4; t <= 46; t += step) Ts.push(t);
    const AR = Ts.map(t => flood(t, false));
    let bestT = null, bestScore = Infinity;
    for (let i = 1; i < Ts.length - 1; i++) {
      if (AR[i] < minArea || AR[i] > 0.5 * winArea) continue;
      const score = (AR[i + 1] - AR[i - 1]) / (AR[i] + 1) * (1 + 0.012 * Ts[i]);
      if (score < bestScore) { bestScore = score; bestT = Ts[i]; }
    }
    if (bestT === null) bestT = Ts[Math.max(1, Math.min(Ts.length - 2, AR.findIndex(v => v >= minArea)))] || 12;
    bestT *= (sens || 1);
    let mask = flood(bestT, true).out;
    let f0 = new Float32Array(w * h); for (let i = 0; i < w * h; i++) f0[i] = mask[i];
    f0 = G.gauss(f0, w, h, 1); const m2 = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) m2[i] = f0[i] > 0.5 ? 1 : 0;
    mask = G.fillHoles(G.keepComponents(m2, w, h, 0.2, 2), w, h, 0.08);
    // naikkan ke resolusi kerja
    const f = new Float32Array(w * h); for (let i = 0; i < w * h; i++) f[i] = mask[i];
    const up = G.resizeBilinear(G.gauss(f, w, h, 1), w, h, W, H);
    const out = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) out[i] = up[i] > 0.5 ? 1 : 0;
    return out;
  }

  return { load, ready, predict, fromProb, grow, lab };
})();
