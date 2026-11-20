/* Simulasi ilustratif hasil akhir: isi kulit sekitar (push-pull inpainting) + garis parut/jahitan/cangkok.
   Ini ilustrasi rencana, bukan prediksi hasil klinis. */
window.SIM = (() => {
  function rasterize(polys, W, H, grow) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.beginPath(); polys.forEach(p => { p.forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.closePath(); }); x.fill('evenodd');
    if (grow) { x.lineWidth = grow * 2; x.strokeStyle = '#fff'; x.lineJoin = 'round'; x.stroke(); }
    const d = x.getImageData(0, 0, W, H).data; const m = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) m[i] = d[i * 4] > 127 ? 1 : 0; return m;
  }

  /* push-pull: isi piksel tak dikenal dari piksel dikenal di sekitarnya */
  function inpaint(rgba, W, H, hole) {
    const lv = []; let w = W, h = H;
    let col = new Float32Array(w * h * 3), wt = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) { const k = hole[i] ? 0 : 1; wt[i] = k; col[i * 3] = rgba[i * 4] * k; col[i * 3 + 1] = rgba[i * 4 + 1] * k; col[i * 3 + 2] = rgba[i * 4 + 2] * k; }
    lv.push({ w, h, col, wt });
    while (w > 1 || h > 1) {
      const nw = Math.max(1, w >> 1), nh = Math.max(1, h >> 1), c2 = new Float32Array(nw * nh * 3), w2 = new Float32Array(nw * nh); const p = lv[lv.length - 1];
      for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
        let sr = 0, sg = 0, sb = 0, sw = 0;
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const xx = Math.min(w - 1, 2 * x + dx), yy = Math.min(h - 1, 2 * y + dy), i = yy * w + xx; sr += p.col[i * 3]; sg += p.col[i * 3 + 1]; sb += p.col[i * 3 + 2]; sw += p.wt[i]; }
        const o = y * nw + x; c2[o * 3] = sr / 4; c2[o * 3 + 1] = sg / 4; c2[o * 3 + 2] = sb / 4; w2[o] = sw / 4;
      }
      lv.push({ w: nw, h: nh, col: c2, wt: w2 }); w = nw; h = nh;
    }
    // dorong dari kasar ke halus
    let up = null;
    for (let l = lv.length - 1; l >= 0; l--) {
      const L = lv[l]; const out = new Float32Array(L.w * L.h * 3);
      for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
        const i = y * L.w + x; const k = Math.min(1, L.wt[i] * 1.0); let r = L.col[i * 3], g = L.col[i * 3 + 1], b = L.col[i * 3 + 2];
        if (k < 0.999) {
          let ur, ug, ub;
          if (up) { const fx = Math.max(0, (x + 0.5) / 2 - 0.5), fy = Math.max(0, (y + 0.5) / 2 - 0.5), x0 = Math.min(up.w - 1, Math.floor(fx)), y0 = Math.min(up.h - 1, Math.floor(fy)), x1 = Math.min(up.w - 1, x0 + 1), y1 = Math.min(up.h - 1, y0 + 1), ax = fx - x0, ay = fy - y0;
            const g3 = (xx, yy, c) => up.col[(yy * up.w + xx) * 3 + c]; const bl = (c) => (g3(x0, y0, c) * (1 - ax) + g3(x1, y0, c) * ax) * (1 - ay) + (g3(x0, y1, c) * (1 - ax) + g3(x1, y1, c) * ax) * ay; ur = bl(0); ug = bl(1); ub = bl(2); }
          else { const nn = Math.max(L.wt[i], 1e-6); ur = r / nn; ug = g / nn; ub = b / nn; }
          const nn = Math.max(L.wt[i], 1e-6); const base = L.wt[i] > 0 ? [r / nn, g / nn, b / nn] : [ur, ug, ub];
          // campuran: bagian dikenal (k) + sisa dari tingkat lebih kasar
          r = r + (1 - k) * ur; g = g + (1 - k) * ug; b = b + (1 - k) * ub; void base;
        }
        out[i * 3] = r; out[i * 3 + 1] = g; out[i * 3 + 2] = b;
      }
      up = { w: L.w, h: L.h, col: out };
    }
    const res = new Uint8ClampedArray(rgba); const f = up.col;
    for (let i = 0; i < W * H; i++) if (hole[i]) { res[i * 4] = f[i * 3]; res[i * 4 + 1] = f[i * 3 + 1]; res[i * 4 + 2] = f[i * 3 + 2]; }
    return res;
  }

  function addTexture(res, rgba, W, H, hole) {
    // simpangan baku tekstur dari cincin sekitar
    const d = G.edt(hole, W, H); const lum = new Float32Array(W * H); for (let i = 0; i < W * H; i++) lum[i] = (rgba[i * 4] * 0.3 + rgba[i * 4 + 1] * 0.59 + rgba[i * 4 + 2] * 0.11);
    const bl = G.gauss(lum, W, H, 2); let s = 0, n = 0; for (let i = 0; i < W * H; i += 3) if (!hole[i] && d[i] > 3 && d[i] < 40) { const r = lum[i] - bl[i]; s += r * r; n++; }
    const sd = Math.sqrt(s / Math.max(1, n)) * 0.9; let nz = new Float32Array(W * H); for (let i = 0; i < W * H; i++) { const u = Math.random() || 1e-9, v = Math.random(); nz[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v); }
    nz = G.boxBlur(nz, W, H, 1);
    // bayangan frekuensi rendah agar isian tidak datar
    let lo = new Float32Array(W * H); for (let i = 0; i < W * H; i++) lo[i] = Math.random() - 0.5; lo = G.gauss(lo, W, H, Math.max(6, Math.round(Math.max(W, H) / 120)));
    let lmax = 1e-6; for (let i = 0; i < W * H; i++) lmax = Math.max(lmax, Math.abs(lo[i]));
    for (let i = 0; i < W * H; i++) nz[i] += (lo[i] / lmax) * 1.4;
    for (let i = 0; i < W * H; i++) if (hole[i]) { const a = Math.min(1, d[i] / 4 + 0.001); void a; const t = nz[i] * sd * 1.6; res[i * 4] = Math.max(0, Math.min(255, res[i * 4] + t)); res[i * 4 + 1] = Math.max(0, Math.min(255, res[i * 4 + 1] + t)); res[i * 4 + 2] = Math.max(0, Math.min(255, res[i * 4 + 2] + t)); }
  }

  const skinTone = (rgba, W, H, hole) => { const d = G.edt(hole, W, H); const r = [], g = [], b = []; for (let i = 0; i < W * H; i += 4) if (!hole[i] && d[i] > 4 && d[i] < 30) { r.push(rgba[i * 4]); g.push(rgba[i * 4 + 1]); b.push(rgba[i * 4 + 2]); } const m = (a) => { a.sort((x, y) => x - y); return a[a.length >> 1] || 200; }; return [m(r), m(g), m(b)]; };

  /* kanvas "sesudah". stage: 'hari0' | 'matur' */
  function after(st, plan, stage) {
    const { W, H } = st, A = plan.after; const base = document.createElement('canvas'); base.width = W; base.height = H;
    const bx = base.getContext('2d'); bx.drawImage(st.img, 0, 0);
    if (!A || A.kind === 'none') return base;
    const k = Math.max(1, W / 900), cm = st.cmPerPx || 0.01;
    const polys = A.region ? [A.region] : [];
    let hole = polys.length ? rasterize(polys, W, H, 1.5) : null;
    const rgba = st.rgba;
    let tone = null;
    if (hole && !['bed'].includes(A.kind)) {
      const res = inpaint(rgba, W, H, hole); addTexture(res, rgba, W, H, hole); tone = skinTone(rgba, W, H, hole);
      bx.putImageData(new ImageData(res, W, H), 0, 0);
    }
    const x = bx; x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
    const scarW = Math.max(1.2 * k, 0.9 / (cm * 10) * (stage === 'matur' ? 0.6 : 1.1));
    const scar = (a, b) => { x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.lineWidth = scarW; x.strokeStyle = stage === 'matur' ? 'rgba(255,240,235,.55)' : 'rgba(185,70,80,.85)'; x.stroke(); };
    if (A.kind === 'closure') {
      scar(A.a, A.b);
      if (stage !== 'matur') { // jahitan simpul: n tanda tegak lurus
        const dx = A.b[0] - A.a[0], dy = A.b[1] - A.a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux, half = (plan.zone && PLAN.ZONE[plan.zone].bite || 4) / (cm * 10);
        const n = A.n || 5; for (let i = 0; i < n; i++) { const t = 0.08 + 0.84 * (i / Math.max(1, n - 1)), px = A.a[0] + dx * t, py = A.a[1] + dy * t;
          x.beginPath(); x.moveTo(px - nx * half, py - ny * half); x.lineTo(px + nx * half, py + ny * half); x.lineWidth = 1.3 * k; x.strokeStyle = 'rgba(30,45,110,.95)'; x.stroke(); }
      }
    } else if (A.kind === 'adv' || A.kind === 'vy') {
      (A.lines || []).forEach(l => scar(l[0], l[1])); if (A.edge) scar(A.edge[0], A.edge[1]);
    } else if (A.kind === 'z') {
      (A.lines || []).forEach(l => scar(l[0], l[1]));
    } else if (A.kind === 'stsg' || A.kind === 'ftsg') {
      const t = tone || [210, 170, 150]; const tint = A.kind === 'stsg' ? [t[0] * 0.97 + 6, t[1] * 0.92, t[2] * 0.94 + 4] : [t[0] * 0.99, t[1] * 0.97, t[2] * 0.97];
      x.save(); x.beginPath(); polys[0].forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.closePath(); x.clip();
      x.fillStyle = `rgba(${tint.map(Math.round).join(',')},${stage === 'matur' ? 0.35 : 0.6})`; x.fillRect(0, 0, W, H);
      if (A.kind === 'stsg' && A.mesh > 1) { x.strokeStyle = stage === 'matur' ? 'rgba(120,70,70,.12)' : 'rgba(110,40,50,.40)'; x.lineWidth = 0.8 * k; const sp = 5 * k; for (let i = -H; i < W + H; i += sp) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + H, H); x.stroke(); } }
      x.restore();
      x.setLineDash([2 * k, 4 * k]); x.beginPath(); polys[0].forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.closePath(); x.lineWidth = 1.4 * k; x.strokeStyle = stage === 'matur' ? 'rgba(255,240,235,.4)' : 'rgba(30,45,110,.9)'; x.stroke();
    } else if (A.kind === 'bed') {
      x.save(); x.beginPath(); polys[0].forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.closePath(); x.clip(); x.fillStyle = 'rgba(205,60,75,.78)'; x.fillRect(0, 0, W, H); x.restore();
      x.beginPath(); polys[0].forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.closePath(); x.lineWidth = 1.5 * k; x.strokeStyle = 'rgba(255,255,255,.8)'; x.stroke();
    }
    x.restore(); return base;
  }
  return { after, rasterize, inpaint };
})();
