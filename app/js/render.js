/* Anotasi: kontur subpiksel, garis dimensi, Feret, margin, grid cm, skala. Satuan = piksel gambar.
   k = piksel gambar per piksel layar (agar garis tetap tajam saat zoom/ekspor). */
window.R = (() => {
  const ACC = '#22d3ee', ACC2 = '#a78bfa', WARM = '#fbbf24', INK = 'rgba(8,12,20,.82)';
  const FONT = 'ui-monospace, "SF Mono", Consolas, Menlo, monospace';

  function pill(ctx, x, y, text, k, o = {}) {
    const fs = (o.size || 12) * k; ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot);
    ctx.font = `600 ${fs}px ${FONT}`; const tw = ctx.measureText(text).width, ph = 5 * k, pv = 3.5 * k;
    const w = tw + 2 * ph, h = fs + 2 * pv, r = h / 2;
    ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, r);
    ctx.fillStyle = o.bg || INK; ctx.fill(); ctx.lineWidth = 1.1 * k; ctx.strokeStyle = o.color || ACC; ctx.stroke();
    ctx.fillStyle = o.txt || '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, 0.5 * k);
    ctx.restore();
  }

  function arrowHead(ctx, tip, ux, uy, k, size) {
    const s = size * k; ctx.beginPath(); ctx.moveTo(tip[0], tip[1]);
    ctx.lineTo(tip[0] - ux * s - uy * s * 0.38, tip[1] - uy * s + ux * s * 0.38);
    ctx.lineTo(tip[0] - ux * s + uy * s * 0.38, tip[1] - uy * s - ux * s * 0.38); ctx.closePath(); ctx.fill();
  }

  /* garis dimensi dengan garis bantu, panah dua arah, dan label miring */
  function dim(ctx, a, b, off, text, k, color, centroid) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; const ux = dx / L, uy = dy / L;
    let nx = -uy, ny = ux; const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (centroid && (mid[0] + nx * off - centroid[0]) * nx + (mid[1] + ny * off - centroid[1]) * ny < 0) { nx = -nx; ny = -ny; }
    const o = off * k, A = [a[0] + nx * o, a[1] + ny * o], B = [b[0] + nx * o, b[1] + ny * o];
    ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.1 * k; ctx.globalAlpha = 0.95;
    ctx.setLineDash([2.5 * k, 3 * k]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(A[0] + nx * 5 * k, A[1] + ny * 5 * k); ctx.moveTo(b[0], b[1]); ctx.lineTo(B[0] + nx * 5 * k, B[1] + ny * 5 * k); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 1.5 * k; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
    arrowHead(ctx, A, -ux, -uy, k, 8); arrowHead(ctx, B, ux, uy, k, 8); ctx.restore();
    let ang = Math.atan2(dy, dx); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
    pill(ctx, (A[0] + B[0]) / 2, (A[1] + B[1]) / 2, text, k, { rot: ang, color });
  }

  const niceLen = (cm) => { const v = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50]; let best = v[0]; for (const x of v) if (x <= cm) best = x; return best; };

  function scaleBar(ctx, W, H, k, cmPerPx) {
    const targetCm = (W * 0.2) * cmPerPx, cm = niceLen(targetCm), len = cm / cmPerPx;
    const x0 = 18 * k, y0 = H - 26 * k, th = 5 * k;
    ctx.save(); ctx.lineCap = 'butt';
    ctx.fillStyle = 'rgba(8,12,20,.75)'; ctx.beginPath(); ctx.roundRect(x0 - 8 * k, y0 - 22 * k, len + 16 * k, 38 * k, 8 * k); ctx.fill();
    const n = cm >= 1 ? 4 : 2;
    for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? '#fff' : ACC; ctx.fillRect(x0 + len * i / n, y0, len / n, th); }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1 * k; ctx.strokeRect(x0, y0, len, th);
    ctx.fillStyle = '#fff'; ctx.font = `700 ${11 * k}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(cm >= 1 ? `${cm} cm` : `${cm * 10} mm`, x0, y0 - 6 * k);
    ctx.restore();
  }

  function grid(ctx, W, H, k, cmPerPx) {
    const step = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50].find(v => v / cmPerPx >= 24 * k) || 50;
    const px = step / cmPerPx; ctx.save(); ctx.lineWidth = 0.8 * k; ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `${9 * k}px ${FONT}`;
    let i = 0; for (let x = 0; x < W; x += px, i++) { ctx.globalAlpha = i % 5 === 0 ? 0.9 : 0.45; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    i = 0; for (let y = 0; y < H; y += px, i++) { ctx.globalAlpha = i % 5 === 0 ? 0.9 : 0.45; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.fillText(`grid ${step} cm`, 6 * k, 12 * k); ctx.restore();
  }

  function strokePolys(ctx, polys, k, glow, color, lw, dash) {
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (dash) ctx.setLineDash(dash.map(v => v * k));
    for (const p of polys) {
      ctx.beginPath(); p.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath();
      if (glow) { ctx.shadowColor = color; ctx.shadowBlur = 10 * k; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = (lw + 2) * k; ctx.stroke(); ctx.shadowBlur = 0; }
      ctx.strokeStyle = color; ctx.lineWidth = lw * k; ctx.stroke();
    }
    ctx.restore();
  }

  /* gambar semua anotasi. st: {W,H,m,tissueCanvas,cm}, o: opsi tampilan */
  function overlay(ctx, st, k, o) {
    const { W, H, m } = st; const cm = st.cmPerPx;
    if (o.grid && cm) grid(ctx, W, H, k, cm);
    if (!m) return;
    const sbar = () => { if (o.scale && cm) { ctx.save(); if (o.origin) ctx.translate(o.origin[0], o.origin[1]); scaleBar(ctx, o.cw || W, o.ch || H, k, cm); ctx.restore(); } };
    if (o.bare) { sbar(); return; }
    if (o.tissue && st.tissueCanvas) { ctx.save(); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(st.tissueCanvas, 0, 0, W, H); ctx.restore(); }
    else { // isian tipis
      ctx.save(); ctx.fillStyle = 'rgba(34,211,238,.16)'; ctx.beginPath();
      m.polys.forEach(p => { p.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); }); ctx.fill('evenodd'); ctx.restore();
    }
    if (o.margins && cm && m.margins) {
      const cols = { 4: '#f59e0b', 6: '#fb7185', 10: '#c084fc', 2: '#34d399' };
      m.margins.forEach(mg => { strokePolys(ctx, mg.polys, k, false, cols[mg.mm] || WARM, 1.6, [6, 4]);
        const p = mg.polys[0]; if (p) { const q = p[Math.floor(p.length * 0.12)]; pill(ctx, q[0], q[1], `${mg.mm} mm`, k, { size: 10, color: cols[mg.mm] || WARM }); } });
    }
    strokePolys(ctx, m.polys, k, true, ACC, 2.1);
    const unit = cm ? 'cm' : 'px', f = (px) => cm ? (px * cm).toFixed(2) : Math.round(px).toString();
    const cen = m.centroid;
    if (o.dims && m.shape) {
      const s = m.shape;
      ctx.save(); ctx.setLineDash([5 * k, 4 * k]); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1 * k; ctx.beginPath();
      s.rect.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.stroke(); ctx.restore();
      const r = s.rect, l1 = Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]), l2 = Math.hypot(r[2][0] - r[1][0], r[2][1] - r[1][1]);
      dim(ctx, r[0], r[1], 22, `${f(l1)} ${unit}`, k, ACC, cen);
      dim(ctx, r[1], r[2], 22, `${f(l2)} ${unit}`, k, ACC2, cen);
    }
    if (o.axes && m.ht) {
      const h = m.ht; ctx.save(); ctx.strokeStyle = WARM; ctx.fillStyle = WARM; ctx.lineWidth = 1.6 * k;
      ctx.beginPath(); ctx.moveTo(h.p0[0], h.p0[1]); ctx.lineTo(h.p1[0], h.p1[1]); ctx.moveTo(h.q0[0], h.q0[1]); ctx.lineTo(h.q1[0], h.q1[1]); ctx.stroke(); ctx.restore();
      pill(ctx, (h.p0[0] + h.p1[0]) / 2 + 18 * k, (h.p0[1] + h.p1[1]) / 2, `P ${f(h.len)}`, k, { color: WARM, size: 11 });
      pill(ctx, (h.q0[0] + h.q1[0]) / 2, (h.q0[1] + h.q1[1]) / 2 + 18 * k, `L ${f(h.wid)}`, k, { color: WARM, size: 11 });
    }
    if (o.feret && m.shape) {
      const s = m.shape; ctx.save(); ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 1.2 * k; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(s.feretA[0], s.feretA[1]); ctx.lineTo(s.feretB[0], s.feretB[1]); ctx.stroke();
      [s.feretA, s.feretB].forEach(q => { ctx.beginPath(); ctx.arc(q[0], q[1], 3.2 * k, 0, 6.2832); ctx.fill(); }); ctx.restore();
    }
    if (o.centroid && cen) {
      ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2 * k; const r = 7 * k; ctx.beginPath();
      ctx.moveTo(cen[0] - r, cen[1]); ctx.lineTo(cen[0] + r, cen[1]); ctx.moveTo(cen[0], cen[1] - r); ctx.lineTo(cen[0], cen[1] + r); ctx.stroke();
      ctx.beginPath(); ctx.arc(cen[0], cen[1], 3.5 * k, 0, 6.2832); ctx.stroke(); ctx.restore();
    }
    sbar();
    if (!cm) { ctx.save(); pill(ctx, W / 2, 22 * k, 'TANPA SKALA: satuan piksel', k, { color: '#f87171', size: 11 }); ctx.restore(); }
  }

  /* titik kalibrasi dan pegangan */
  function calibMarks(ctx, pts, k) {
    ctx.save(); ctx.strokeStyle = WARM; ctx.fillStyle = WARM; ctx.lineWidth = 1.6 * k;
    pts.forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 6 * k, 0, 6.2832); ctx.stroke(); ctx.beginPath(); ctx.arc(p[0], p[1], 1.6 * k, 0, 6.2832); ctx.fill(); });
    if (pts.length === 2) { ctx.setLineDash([6 * k, 4 * k]); ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]); ctx.stroke(); }
    ctx.restore();
  }


  /* ---------- marking bedah (gaya spidol steril) ---------- */
  const PEN = '#b45cff', PEN2 = '#7c3aed', YEL = '#fde047', MAG = '#f472b6', GRN = '#34d399';
  function polyPath(ctx, p) { ctx.beginPath(); p.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); }
  function hatch(ctx, p, k, color, gap, ang) {
    ctx.save(); polyPath(ctx, p); ctx.clip(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; p.forEach(q => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0); ctx.translate(cx, cy); ctx.rotate(ang); ctx.strokeStyle = color; ctx.lineWidth = 1.3 * k;
    for (let t = -R; t <= R; t += gap * k) { ctx.beginPath(); ctx.moveTo(-R, t); ctx.lineTo(R, t); ctx.stroke(); } ctx.restore();
  }
  function plan(ctx, pl, k) {
    if (!pl) return;
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    pl.items.forEach(it => {
      if (it.t === 'poly') {
        if (it.fill === 'excise') { ctx.save(); polyPath(ctx, it.p); ctx.fillStyle = 'rgba(244,114,182,.16)'; ctx.fill(); ctx.restore(); hatch(ctx, it.p, k, 'rgba(244,114,182,.85)', 5.5, Math.PI / 4); }
        if (it.fill === 'graft') { ctx.save(); polyPath(ctx, it.p); ctx.fillStyle = 'rgba(52,211,153,.14)'; ctx.fill(); ctx.restore(); hatch(ctx, it.p, k, 'rgba(52,211,153,.6)', 7, -Math.PI / 4); hatch(ctx, it.p, k, 'rgba(52,211,153,.35)', 7, Math.PI / 4); }
        if (it.s === 'incise') { polyPath(ctx, it.p); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 4.2 * k; ctx.stroke(); ctx.strokeStyle = PEN; ctx.lineWidth = 2.4 * k; ctx.stroke(); }
        else if (it.s === 'graft') { polyPath(ctx, it.p); ctx.setLineDash([6 * k, 4 * k]); ctx.strokeStyle = GRN; ctx.lineWidth = 2 * k; ctx.stroke(); ctx.setLineDash([]); }
        else if (it.s === 'margin') { polyPath(ctx, it.p); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.2 * k; ctx.setLineDash([4 * k, 3 * k]); ctx.stroke(); ctx.setLineDash([]); }
      } else if (it.t === 'line') {
        const st = it.s; ctx.beginPath(); ctx.moveTo(it.a[0], it.a[1]); ctx.lineTo(it.b[0], it.b[1]);
        if (st === 'incise') { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = (it.w + 2.2) * k; ctx.stroke(); ctx.strokeStyle = PEN; ctx.lineWidth = it.w * k * 1.2; ctx.stroke(); }
        else if (st === 'flaptip') { ctx.setLineDash([5 * k, 4 * k]); ctx.strokeStyle = PEN2; ctx.lineWidth = it.w * k; ctx.stroke(); ctx.setLineDash([]); }
        else if (st === 'closure') { ctx.setLineDash([8 * k, 5 * k]); ctx.strokeStyle = YEL; ctx.lineWidth = it.w * k; ctx.stroke(); ctx.setLineDash([]); }
        else if (st === 'stitch') { ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = it.w * k; ctx.setLineDash([3 * k, 3 * k]); ctx.stroke(); ctx.setLineDash([]); }
      } else if (it.t === 'dot') { ctx.beginPath(); ctx.arc(it.p[0], it.p[1], 2.8 * k, 0, 6.2832); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.2 * k; ctx.strokeStyle = PEN2; ctx.stroke(); }
      else if (it.t === 'arrow') {
        const dx = it.b[0] - it.a[0], dy = it.b[1] - it.a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
        ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 6 * k; ctx.beginPath(); ctx.moveTo(it.a[0], it.a[1]); ctx.lineTo(it.b[0], it.b[1]); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.moveTo(it.a[0], it.a[1]); ctx.lineTo(it.b[0], it.b[1]); ctx.stroke(); arrowHead(ctx, it.b, ux, uy, k, 13);
      }
    });
    pl.items.filter(i => i.t === 'label').forEach(it => pill(ctx, it.p[0], it.p[1], it.text, k, { size: 11, color: PEN2, bg: 'rgba(255,255,255,.95)', txt: '#3b0764' }));
    ctx.restore();
  }

  return { overlay, calibMarks, pill, plan };
})();
