/* Orkestrator: muat foto -> segmentasi -> kalibrasi -> ukur -> anotasi -> rekomendasi. Semua lokal. */
(() => {
  const $ = (id) => document.getElementById(id);
  const fmt = CLIN.fmt;
  const WMAX = 1400;
  const S = { W: 0, H: 0, rgba: null, img: null, prob: null, mask: null, undo: [], src: { t: 'none' }, exif: {},
    cal: null, calPts: [], palm: [], tool: 'pan', view: { s: 1, ox: 0, oy: 0 }, m: null, tissue: null, tissueCanvas: null,
    layers: { contour: true, tissue: true, dims: true, axes: false, feret: false, margins: false, grid: false, scale: true, centroid: false },
    thr: 0.5, brush: 16, head: 'atas', ptr: null, modelInfo: null, basket: [] };
  const cv = $('cv'), ctx = cv.getContext('2d');
  try { S.basket = JSON.parse(localStorage.getItem('ws.basket') || '[]'); } catch (e) { }

  /* ===================== status & util ===================== */
  const status = (msg, cls) => { const el = $('status'); el.className = 'status ' + (cls || ''); el.querySelector('span').textContent = msg; };
  const busy = (on, msg) => { $('busy').hidden = !on; if (msg) $('busyMsg').textContent = msg; };
  const tick = () => new Promise(r => setTimeout(r, 30));
  function ask(title, html, onOk) {
    $('dlgT').textContent = title; $('dlgB').innerHTML = html; const d = $('dlg');
    d.onclose = () => { if (d.returnValue === 'ok') onOk(d); }; d.showModal();
  }

  /* ===================== EXIF ===================== */
  function readExif(buf) {
    try {
      const v = new DataView(buf); if (v.getUint16(0) !== 0xFFD8) return {};
      let off = 2;
      while (off < v.byteLength - 4) {
        const mk = v.getUint16(off); off += 2;
        if (mk === 0xFFE1) {
          if (v.getUint32(off + 2) === 0x45786966) {
            const t = off + 8, le = v.getUint16(t) === 0x4949, g16 = (o) => v.getUint16(o, le), g32 = (o) => v.getUint32(o, le);
            const out = {}; let exifOff = 0; const first = t + g32(t + 4);
            const ifd = (o, cb) => { const n = g16(o); for (let i = 0; i < n; i++) { const e = o + 2 + i * 12; cb(g16(e), g16(e + 2), e + 8); } };
            ifd(first, (tag, type, vo) => { if (tag === 0x8769) exifOff = t + g32(vo); });
            if (exifOff) ifd(exifOff, (tag, type, vo) => {
              if (tag === 0xA405) out.f35 = g16(vo);
              if (tag === 0x920A) { const p = t + g32(vo); out.f = g32(p) / (g32(p + 4) || 1); }
            });
            return out;
          }
          off += v.getUint16(off);
        } else if ((mk & 0xFF00) === 0xFF00 && mk !== 0xFFD8) off += v.getUint16(off); else break;
      }
    } catch (e) { }
    return {};
  }

  /* ===================== muat foto ===================== */
  async function loadFile(file) {
    busy(true, 'Memuat foto…'); await tick();
    try {
      const buf = await file.arrayBuffer(); S.exif = readExif(buf);
      const bmp = await createImageBitmap(new Blob([buf]), { imageOrientation: 'from-image' });
      const k = Math.min(1, WMAX / Math.max(bmp.width, bmp.height));
      S.W = Math.round(bmp.width * k); S.H = Math.round(bmp.height * k);
      const c = document.createElement('canvas'); c.width = S.W; c.height = S.H;
      const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(bmp, 0, 0, S.W, S.H);
      S.img = c; S.rgba = x.getImageData(0, 0, S.W, S.H).data;
      S.cal = null; S.calPts = []; S.palm = []; S.mask = null; S.prob = null; S.undo = []; S.m = null; S.tissue = null; S.tissueCanvas = null; S.src = { t: 'none' };
      $('empty').hidden = true; $('btnExport').disabled = false; fitView(); renderCalib(); renderPanels(); draw();
      if (S.exif.f35) { /* tersedia untuk mode jarak */ }
      if (SEG.ready()) await autoSeg(); else { status('Model tidak tersedia: gunakan "Ketuk luka"', 'err'); setTool('tap'); }
    } catch (e) { console.error(e); status('Gagal memuat foto', 'err'); }
    busy(false);
  }

  async function autoSeg() {
    busy(true, 'Segmentasi…'); await tick();
    S.prob = await SEG.predict(S.rgba, S.W, S.H);
    S.src = { t: 'model' };
    setMask(SEG.fromProb(S.prob, S.W, S.H, S.thr), true);
    busy(false);
    if (!S.m) status('Luka tidak terdeteksi otomatis: gunakan "Ketuk luka" atau kuas Tambah', 'err');
    else if (S.m.areaPx > 0.5 * S.W * S.H) status('Area terdeteksi sangat luas: periksa dan koreksi bila perlu', 'err');
    else status(S.modelInfo ? `Model siap · Dice validasi ${fmt(S.modelInfo.val_dice, 2)}` : 'Model siap', 'ok');
  }

  function setMask(m, push) {
    if (push && S.mask) { S.undo.push(S.mask); if (S.undo.length > 15) S.undo.shift(); }
    S.mask = m; analyze(); draw();
  }

  /* ===================== kalibrasi ===================== */
  function setCal(cmPerPx, mode, relLen, label) { S.cal = { cmPerPx, mode, relLen, label }; analyze(); renderCalib(); draw(); }
  const pxDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  function calibFromPoints() {
    const [a, b] = S.calPts; const Lpx = pxDist(a, b);
    ask('Panjang referensi', `<p class="muted sm">Jarak dua titik yang ditandai (penggaris, kartu, koin).</p>
      <select id="presets"><option value="">Pilih acuan umum…</option><option value="8.56">Kartu ID-1 (KTP-el, ATM): lebar 85,6 mm</option><option value="5.398">Kartu ID-1: tinggi 53,98 mm</option><option value="2.1">Koin (isi diameter manual)</option></select>
      <input id="refv" type="number" step="0.01" min="0.01" placeholder="panjang">
      <select id="refu"><option value="1">cm</option><option value="0.1">mm</option></select>`, () => {
        const v = parseFloat($('refv').value) * parseFloat($('refu').value); if (!(v > 0)) return;
        const rel = Math.sqrt((2.1 / Lpx) ** 2 + 0.02 ** 2);
        setCal(v / Lpx, 'ref', rel, `Referensi ${fmt(v, 2)} cm`);
        S.calPts = []; setTool('pan');
      });
    $('presets').onchange = (e) => { if (e.target.value) { $('refv').value = e.target.value; $('refu').value = '1'; } };
  }

  function calibFromPalm() {
    const poly = S.palm; if (poly.length < 3) return;
    const A = Math.abs(G.polyArea(poly));
    ask('Telapak tangan sebagai acuan', `<p class="muted sm">Telapak dengan jari pasien ≈ 0,8 persen BSA; telapak tanpa jari ≈ 0,5 persen. Butuh BSA di tab Klinis.</p>
      <select id="palmk"><option value="0.8">Telapak + jari (0,8%)</option><option value="0.5">Telapak saja (0,5%)</option></select>`, () => {
        const bsa = CLIN.read().bsa; if (!bsa) { alert('Isi TB dan BB di tab Klinis dahulu.'); return; }
        const cm2 = parseFloat($('palmk').value) / 100 * bsa * 10000;
        setCal(Math.sqrt(cm2 / A), 'palm', 0.10, 'Telapak tangan (±10% panjang)'); S.palm = []; setTool('pan');
      });
  }

  function calibFromDistance() {
    const d = parseFloat($('c-dist').value), f = parseFloat($('c-f35').value);
    if (!(d > 0 && f > 0)) return;
    const diag = 43.27, long = Math.max(S.W, S.H), short = Math.min(S.W, S.H);
    const eqLong = diag * long / Math.hypot(long, short);               // panjang sisi panjang sensor setara (mm)
    const fovCm = d * eqLong / f;                                        // lebar pandang sisi panjang pada jarak d (cm)
    setCal(fovCm / long, 'jarak', 0.08, `Jarak ${fmt(d, 0)} cm, f35=${fmt(f, 0)} mm (±8%)`);
  }

  function renderCalib() {
    const c = S.cal; const f35 = S.exif.f35 || 26;
    const badge = c ? `<span class="badge ${c.mode === 'ref' ? 'ok' : 'warn'}">Terkalibrasi · ${c.label}</span>` : `<span class="badge bad">Belum terkalibrasi</span>`;
    $('calibCard').innerHTML = `<div>${badge}</div>
      ${c ? `<div class="sm muted num" style="margin-top:6px">1 piksel = ${fmt(c.cmPerPx * 10, 4)} mm</div>` : '<div class="sm muted" style="margin-top:6px">Satu foto tidak membawa informasi skala. Pilih salah satu cara di bawah.</div>'}
      <div class="row"><button class="btn sm" id="c-ref">Dua titik (penggaris/kartu)</button><button class="btn sm" id="c-palm">Telapak tangan</button></div>
      <div class="row sm" style="align-items:end"><label style="display:flex;flex-direction:column;gap:2px">Jarak kamera (cm)<input id="c-dist" type="number" min="5" value="30" style="width:84px;background:var(--bg2);border:1px solid var(--line);border-radius:8px;padding:5px;color:var(--txt)"></label>
        <label style="display:flex;flex-direction:column;gap:2px">f35 (mm)<input id="c-f35" type="number" min="10" value="${f35}" style="width:72px;background:var(--bg2);border:1px solid var(--line);border-radius:8px;padding:5px;color:var(--txt)"></label>
        <button class="btn sm" id="c-dbtn">Terapkan jarak</button></div>
      <div class="row sm"><span class="muted">Kepala pasien di foto:</span>${['atas', 'kanan', 'bawah', 'kiri'].map(h => `<button class="btn sm ${S.head === h ? 'primary' : ''}" data-head="${h}">${h}</button>`).join('')}</div>`;
    $('c-ref').onclick = () => { setTool('calib'); status('Ketuk dua titik pada benda berukuran diketahui', ''); };
    $('c-palm').onclick = () => { setTool('palm'); status('Ketuk sudut-sudut telapak tangan, lalu ketuk dua kali untuk selesai', ''); };
    $('c-dbtn').onclick = calibFromDistance;
    document.querySelectorAll('[data-head]').forEach(b => b.onclick = () => { S.head = b.dataset.head; analyze(); renderCalib(); draw(); });
  }

  /* ===================== analisis ===================== */
  function analyze() {
    const { W, H, mask } = S; let area = 0; for (let i = 0; i < W * H; i++) area += mask ? mask[i] : 0;
    if (!mask || area < 20) { S.m = null; S.tissue = null; S.tissueCanvas = null; renderPanels(); return; }
    const f = new Float32Array(W * H); for (let i = 0; i < W * H; i++) f[i] = mask[i];
    const sm = G.gauss(f, W, H, 1);
    const polys = G.contours(sm, W, H, 0.5).filter(p => p.length > 8);
    let cx = 0, cy = 0; for (let i = 0; i < W * H; i++) if (mask[i]) { cx += i % W; cy += (i / W) | 0; } cx /= area; cy /= area;
    const all = [].concat(...polys); const hull = G.hull(all); const shape = G.shapeMetrics(hull);
    const perimPx = polys.reduce((s, p) => s + G.polyLen(p), 0);
    const outerPerim = Math.max(...polys.map(G.polyLen));
    const vert = S.head === 'atas' || S.head === 'bawah'; const au = vert ? [0, 1] : [1, 0], av = [-au[1], au[0]];
    const ext = (u) => { let lo = 1e9, hi = -1e9; for (const p of hull) { const t = p[0] * u[0] + p[1] * u[1]; lo = Math.min(lo, t); hi = Math.max(hi, t); } return [lo, hi]; };
    const [pl, ph] = ext(au), [ql, qh] = ext(av); const ct = cx * au[0] + cy * au[1], cq = cx * av[0] + cy * av[1];
    const ht = { len: ph - pl, wid: qh - ql, p0: [cx + au[0] * (pl - ct), cy + au[1] * (pl - ct)], p1: [cx + au[0] * (ph - ct), cy + au[1] * (ph - ct)],
      q0: [cx + av[0] * (ql - cq), cy + av[1] * (ql - cq)], q1: [cx + av[0] * (qh - cq), cy + av[1] * (qh - cq)] };
    let margins = null;
    if (S.cal) {
      const d = G.edt(mask, W, H); const neg = new Float32Array(W * H); for (let i = 0; i < W * H; i++) neg[i] = -d[i];
      margins = [4, 6, 10].map(mm => ({ mm, polys: G.contours(neg, W, H, -(mm / 10) / S.cal.cmPerPx) }));
    }
    S.m = { areaPx: area, perimPx, outerPerim, polys, centroid: [cx, cy], shape, ht, margins, circ: 4 * Math.PI * area / (outerPerim * outerPerim) };
    S.tissue = TIS.classify(S.rgba, W, H, mask); S.tissueCanvas = TIS.overlay(S.tissue.labels, W, H);
    renderPanels();
  }

  /* ===================== tampilan ===================== */
  function fitView() {
    const r = cv.getBoundingClientRect(); const s = Math.min(r.width / S.W, r.height / S.H) * 0.98;
    S.view = { s, ox: (r.width - S.W * s) / 2, oy: (r.height - S.H * s) / 2 };
  }
  function resizeCv() {
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    return dpr;
  }
  let raf = 0; const draw = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };
  function render() {
    const dpr = resizeCv(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#05080e'; ctx.fillRect(0, 0, cv.width, cv.height);
    if (!S.img) return;
    const { s, ox, oy } = S.view; ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
    const vm = window.SURG ? SURG.getMode() : 'anot'; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(vm === 'sim' && S.after ? S.after : S.img, 0, 0);
    const k = 1 / s; const st = { W: S.W, H: S.H, m: S.m, tissueCanvas: S.layers.tissue ? S.tissueCanvas : null, cmPerPx: S.cal ? S.cal.cmPerPx : null };
    if (S.m) {
      if (vm === 'mark') { R.overlay(ctx, { ...st, tissueCanvas: null }, k, { contour: true, scale: true }); R.plan(ctx, S.plan, k); }
      else if (vm === 'sim') R.overlay(ctx, st, k, { bare: true, scale: true });
      else R.overlay(ctx, st, k, { ...S.layers, contour: true });
    }
    if (S.calPts.length) R.calibMarks(ctx, S.calPts, k);
    if (S.palm.length) { ctx.save(); ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.6 * k; ctx.setLineDash([6 * k, 4 * k]); ctx.beginPath(); S.palm.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); S.palm.forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 3 * k, 0, 6.28); ctx.fillStyle = '#fbbf24'; ctx.fill(); }); ctx.restore(); }
    if ((S.tool === 'add' || S.tool === 'erase') && S.ptr) { ctx.save(); ctx.strokeStyle = S.tool === 'add' ? '#34d399' : '#f87171'; ctx.lineWidth = 1.6 * k; ctx.beginPath(); ctx.arc(S.ptr[0], S.ptr[1], S.brush * k, 0, 6.28); ctx.stroke(); ctx.restore(); }
  }

  /* ===================== interaksi kanvas ===================== */
  const toImg = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left - S.view.ox) / S.view.s, (e.clientY - r.top - S.view.oy) / S.view.s]; };
  const ptrs = new Map(); let drag = null, painting = false, lastTap = 0;
  function paint(p, add) {
    const r = Math.round(S.brush), x0 = Math.max(0, Math.floor(p[0] - r)), x1 = Math.min(S.W - 1, Math.ceil(p[0] + r)), y0 = Math.max(0, Math.floor(p[1] - r)), y1 = Math.min(S.H - 1, Math.ceil(p[1] + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if ((x - p[0]) ** 2 + (y - p[1]) ** 2 <= r * r) S.mask[y * S.W + x] = add ? 1 : 0;
  }
  cv.addEventListener('pointerdown', (e) => {
    if (!S.img) return; cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    const p = toImg(e);
    if (ptrs.size === 2) { drag = null; painting = false; return; }
    if (S.tool === 'add' || S.tool === 'erase') { if (!S.mask) S.mask = new Uint8Array(S.W * S.H); S.undo.push(Uint8Array.from(S.mask)); painting = true; S.src = { t: 'manual' }; paint(p, S.tool === 'add'); S.ptr = p; draw(); return; }
    if (S.tool === 'tap') { runTap(p); return; }
    if (S.tool === 'calib') { S.calPts.push(p); if (S.calPts.length === 2) calibFromPoints(); draw(); return; }
    if (S.tool === 'palm') { const now = Date.now(); if (now - lastTap < 350 && S.palm.length >= 3) { calibFromPalm(); } else S.palm.push(p); lastTap = now; draw(); return; }
    drag = { x: e.clientX, y: e.clientY, ox: S.view.ox, oy: S.view.oy };
  });
  cv.addEventListener('pointermove', (e) => {
    const p = toImg(e); S.ptr = p;
    if (ptrs.has(e.pointerId)) {
      const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 2) { // cubit
        const [a, b] = [...ptrs.values()]; const nd = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const pa = [prev[0], prev[1]]; const other = [...ptrs.entries()].find(([id]) => id !== e.pointerId)[1];
        const od = Math.hypot(pa[0] - other[0], pa[1] - other[1]) || 1; zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, nd / od); return;
      }
    }
    if (painting) { paint(p, S.tool === 'add'); draw(); return; }
    if (drag && S.tool === 'pan') { S.view.ox = drag.ox + e.clientX - drag.x; S.view.oy = drag.oy + e.clientY - drag.y; draw(); return; }
    if (S.tool === 'add' || S.tool === 'erase') draw();
  });
  const up = (e) => { ptrs.delete(e.pointerId); drag = null; if (painting) { painting = false; S.mask = G.fillHoles(S.mask, S.W, S.H, 0.02); analyze(); draw(); } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.pow(1.0016, -e.deltaY)); }, { passive: false });
  function zoomAt(cx, cy, f) { const r = cv.getBoundingClientRect(), x = cx - r.left, y = cy - r.top; const s2 = Math.max(0.1, Math.min(40, S.view.s * f)); const k = s2 / S.view.s; S.view.ox = x - (x - S.view.ox) * k; S.view.oy = y - (y - S.view.oy) * k; S.view.s = s2; draw(); }
  window.addEventListener('resize', () => { if (S.img) { fitView(); } draw(); });

  async function runTap(p) {
    busy(true, 'Segmentasi dari titik…'); await tick();
    let m = null;
    if (S.prob) { // pilih komponen model yang berisi titik ketukan (ambang lebih longgar)
      const lo = Math.max(0.12, S.thr * 0.55), bin = new Uint8Array(S.W * S.H);
      for (let i = 0; i < bin.length; i++) bin[i] = S.prob[i] > lo ? 1 : 0;
      const { lab, comps } = G.components(bin, S.W, S.H); let id = 0, bd = 1e9;
      const r = Math.round(0.03 * Math.max(S.W, S.H));
      for (let y = Math.max(0, Math.round(p[1]) - r); y < Math.min(S.H, Math.round(p[1]) + r); y++) for (let x = Math.max(0, Math.round(p[0]) - r); x < Math.min(S.W, Math.round(p[0]) + r); x++) {
        const l = lab[y * S.W + x]; if (l) { const d = (x - p[0]) ** 2 + (y - p[1]) ** 2; if (d < bd) { bd = d; id = l; } }
      }
      if (id) { m = new Uint8Array(S.W * S.H); for (let i = 0; i < m.length; i++) if (lab[i] === id) m[i] = 1; m = G.fillHoles(m, S.W, S.H, 0.05); }
    }
    if (!m) { const sens = 1 + (0.5 - S.thr) * 1.2; m = SEG.grow(S.rgba, S.W, S.H, p[0], p[1], sens); }
    S.src = { t: 'tap', seed: p }; setMask(m, true); busy(false);
  }

  function setTool(t) {
    S.tool = t; document.querySelectorAll('.tool').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
    cv.className = 'tool-' + t; if (t !== 'calib') S.calPts = S.calPts.length === 2 ? [] : S.calPts; if (t !== 'palm') S.palm = []; draw();
  }

  /* ===================== panel ===================== */
  function metrics() {
    const m = S.m, c = S.cal; if (!m) return null;
    const cm = c ? c.cmPerPx : null; const f = CLIN.read(); const cf = CLIN.curveFactor(f.curveDeg);
    const A = cm ? m.areaPx * cm * cm : null;
    // ketidakpastian: kalibrasi (kuadrat panjang) + batas (sapuan ambang bila ada peta probabilitas, kalau tidak ±1,5 px)
    let bLo = m.areaPx, bHi = m.areaPx;
    if (S.prob && S.src.t === 'model') {
      const cnt = (t) => { let n = 0; for (let i = 0; i < S.prob.length; i++) if (S.prob[i] > t) n++; return n; };
      bLo = Math.min(m.areaPx, cnt(S.thr + 0.15)); bHi = Math.max(m.areaPx, cnt(S.thr - 0.15));
    } else { const d = 1.5 * m.outerPerim; bLo = Math.max(0, m.areaPx - d); bHi = m.areaPx + d; }
    const relB = Math.max((m.areaPx - bLo), (bHi - m.areaPx)) / m.areaPx;
    const relC = c ? 2 * c.relLen : 0; const rel = Math.sqrt(relB * relB + relC * relC);
    const sh = m.shape; const r = sh.rect; const l1 = pxDist(r[0], r[1]), l2 = pxDist(r[1], r[2]);
    return { cm, A: A && A * cf, rel, relB, relC, cf, perim: cm && m.outerPerim * cm, len: cm && Math.max(l1, l2) * cm, wid: cm && Math.min(l1, l2) * cm,
      htLen: cm && m.ht.len * cm, htWid: cm && m.ht.wid * cm, feret: cm && sh.feretMax * cm, feretMin: cm && sh.feretMin * cm, circ: m.circ, bsa: f.bsa };
  }

  function renderPanels() {
    const M = metrics();
    if (!M) { $('hud').hidden = true; $('kpis').innerHTML = '<div class="muted sm">Belum ada segmentasi. Pakai "Ketuk luka" atau kuas Tambah.</div>'; $('uncert').textContent = ''; $('tissuePane').textContent = 'Belum ada segmentasi.'; renderRec(); return; }
    const unit = M.cm ? 'cm' : 'px'; const f1 = (v, d = 2) => M.cm ? fmt(v, d) : '–';
    const tb = M.A && M.bsa ? KB.tbsa(M.A, M.bsa) : null;
    const k = (l, v, u, s) => `<div class="kpi"><div class="l">${l}</div><div class="v${String(v).length > 8 ? ' sm' : ''}">${v}<span class="u">${u || ''}</span></div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
    $('kpis').innerHTML =
      `<div class="kpi big"><div class="l">Luas luka</div><div class="v">${M.A ? fmt(M.A, 2) : fmt(S.m.areaPx, 0)}<span class="u">${M.A ? 'cm²' : 'px² (tanpa skala)'}</span></div>` +
      (M.A ? `<div class="s">± ${fmt(M.A * M.rel, 2)} cm² (${fmt(M.rel * 100, 1)}%) · rentang ${fmt(M.A * (1 - M.rel), 2)} – ${fmt(M.A * (1 + M.rel), 2)}</div>` : '') + `</div>` +
      (tb != null ? `<div class="kpi big"><div class="l">%TBSA (BSA ${fmt(M.bsa, 3)} m²)</div><div class="v">${fmt(tb, tb < 1 ? 3 : 2)}<span class="u">%</span></div><div class="s">${fmt(M.A, 2)} cm² / ${fmt(M.bsa * 10000, 0)} cm² · ± ${fmt(tb * M.rel, tb < 1 ? 3 : 2)}</div></div>` : (M.A ? `<div class="kpi big"><div class="l">%TBSA</div><div class="v">–</div><div class="s">isi TB dan BB di tab Klinis</div></div>` : '')) +
      k('Kotak minimum (P × L)', M.cm ? `${f1(M.len)} × ${f1(M.wid)}` : '–', unit) + k('Kepala–kaki (P × L)', M.cm ? `${f1(M.htLen)} × ${f1(M.htWid)}` : '–', unit) +
      k('Keliling', f1(M.perim), unit) + k('Feret maks / min', M.cm ? `${f1(M.feret)} / ${f1(M.feretMin)}` : '–', unit) +
      k('Sirkularitas', fmt(M.circ, 3), '', '1,000 = lingkaran sempurna') + k('Bagian terpisah', String(S.m.polys.length), '');
    $('uncert').innerHTML = M.A ? `Ketidakpastian gabungan: batas ${fmt(M.relB * 100, 1)}% dan kalibrasi ${fmt(M.relC * 100, 1)}% (akar jumlah kuadrat). ${M.cf > 1 ? `Koreksi kelengkungan ×${fmt(M.cf, 3)} diterapkan.` : 'Tanpa koreksi kelengkungan: permukaan melengkung menurunkan luas yang terukur dari foto.'} Foto harus tegak lurus dan skala sebidang dengan luka.` : 'Atur skala agar angka absolut tersedia.';
    const T = S.tissue; if (T) {
      const p = T.pct, col = TIS.COLORS;
      $('tissuePane').innerHTML = `<div class="bar">${[[1, p.gran], [2, p.slough], [3, p.nekro], [4, p.epi]].map(([t, v]) => `<i style="width:${v}%;background:${col[t]}"></i>`).join('')}</div>
        <div class="legend">${[[1, p.gran], [2, p.slough], [3, p.nekro], [4, p.epi]].map(([t, v]) => `<div><span class="sw" style="background:${col[t]}"></span>${TIS.NAMES[t]}<b>${fmt(v, 1)}%</b></div>`).join('')}</div>
        ${M.A ? `<div class="legend" style="margin-top:8px">${[[1, p.gran], [2, p.slough], [3, p.nekro], [4, p.epi]].map(([t, v]) => `<div class="muted sm">${TIS.NAMES[t]}<b>${fmt(M.A * v / 100, 2)} cm²</b></div>`).join('')}</div>` : ''}
        <div class="note">Estimasi dari warna relatif terhadap kulit peri-luka (L*a*b*). Bukan penilaian histologis; pencahayaan tidak merata, kulit gelap, darah, atau gel memengaruhi hasil.</div>`;
    }
    const hud = $('hud'); hud.hidden = !M.A && !S.tissue;
    const pc = S.tissue ? S.tissue.pct : null, col = TIS.COLORS;
    hud.innerHTML = (M.A ? `<div class="chip a"><small>Luas</small><b>${fmt(M.A, 2)} cm²</b></div>` : `<div class="chip"><small>Skala</small><b>belum dikalibrasi</b></div>`) +
      (tb != null ? `<div class="chip t"><small>%TBSA</small><b>${fmt(tb, tb < 1 ? 3 : 2)}</b></div>` : '') +
      (M.cm ? `<div class="chip"><small>P × L (cm)</small><b>${fmt(M.len, 2)} × ${fmt(M.wid, 2)}</b></div>` : '') +
      (pc ? `<div class="chip"><small>Dasar luka</small><div class="tb">${[[1, pc.gran], [2, pc.slough], [3, pc.nekro], [4, pc.epi]].map(([t, v]) => `<i style="width:${v}%;background:${col[t]}"></i>`).join('')}</div></div>` : '');
    $('btnExport').disabled = false; renderRec(); renderBasketUI(); if (window.SURG) SURG.update();
  }

  function recCtx() {
    const M = metrics(); if (!M) return null; const tot = basketTotal();
    return { areaCm2: M.A && M.A / M.cf, areaLo: M.A && (M.A / M.cf) * (1 - M.rel), areaHi: M.A && (M.A / M.cf) * (1 + M.rel), perimCm: M.perim, lenCm: M.len, widCm: M.wid, htLen: M.htLen, htWid: M.htWid,
      cal: S.cal ? S.cal.label : 'tanpa skala', tissue: S.tissue, tbsaBasket: tot.n ? tot.tbsa : null };
  }
  function renderRec() {
    const f = CLIN.read(); const ctx = recCtx();
    $('recPane').innerHTML = ctx ? CLIN.recommend(ctx, f) + `<div class="card"><h4>Dokumentasi (salin ke rekam medis)</h4><pre id="noteTxt" class="num sm" style="white-space:pre-wrap">${CLIN.note(ctx, f)}</pre><button class="btn sm" id="btnCopy">Salin teks</button></div>` : '<div class="muted">Segmentasikan luka untuk melihat rekomendasi.</div>';
    const b = $('btnCopy'); if (b) b.onclick = () => navigator.clipboard.writeText($('noteTxt').textContent).then(() => { b.textContent = 'Tersalin'; });
  }

  /* ===================== keranjang TBSA (luka bakar) & riwayat ===================== */
  function basketTotal() {
    const f = CLIN.read(); const bsa = f.bsa; let cm2 = 0; S.basket.forEach(b => cm2 += b.areaCm2);
    return { n: S.basket.length, cm2, tbsa: bsa ? KB.tbsa(cm2, bsa) : null };
  }
  function saveBasket() { try { localStorage.setItem('ws.basket', JSON.stringify(S.basket)); } catch (e) { } }
  function renderBasketUI() {
    const f = CLIN.read(); const M = metrics(); const tot = basketTotal();
    let h = '';
    if (f.type === 'bakar' && M && M.A) h += `<button class="btn primary" id="btnAddB">Tambah foto ini ke keranjang TBSA</button>`;
    if (S.basket.length) {
      h += `<div class="card" style="margin-top:10px"><h4>Keranjang TBSA</h4>` + S.basket.map((b, i) => `<div class="vis"><div class="m">${b.region} · ${b.depth === 'partial' ? 'parsial' : 'tebal penuh'}<br><span class="num">${fmt(b.areaCm2, 2)} cm²${f.bsa ? ` · ${fmt(KB.tbsa(b.areaCm2, f.bsa), 2)}%` : ''}</span></div><button data-bdel="${i}" aria-label="hapus">✕</button></div>`).join('') +
        `<p class="num" style="margin-top:6px"><b>Total ${fmt(tot.cm2, 2)} cm²${tot.tbsa != null ? ` = ${fmt(tot.tbsa, 2)}% TBSA` : ''}</b></p></div>`;
    }
    $('basket').innerHTML = h;
    const a = $('btnAddB'); if (a) a.onclick = () => { S.basket.push({ region: KB.REGIONS.find(r => r.id === f.region).label, depth: f.depth, areaCm2: M.A }); saveBasket(); renderBasketUI(); renderRec(); };
    document.querySelectorAll('[data-bdel]').forEach(b => b.onclick = () => { S.basket.splice(+b.dataset.bdel, 1); saveBasket(); renderBasketUI(); renderRec(); });
  }

  const visits = () => { try { return JSON.parse(localStorage.getItem('ws.visits') || '[]'); } catch (e) { return []; } };
  const putVisits = (v) => { try { localStorage.setItem('ws.visits', JSON.stringify(v)); } catch (e) { alert('Penyimpanan penuh. Hapus kunjungan lama.'); } };
  function saveVisit() {
    const id = $('h-id').value.trim(); const M = metrics(); if (!id || !M || !M.A) { alert('Isi ID pasien dan pastikan luka terkalibrasi.'); return; }
    const t = document.createElement('canvas'); const r = 200 / Math.max(S.W, S.H); t.width = S.W * r; t.height = S.H * r; t.getContext('2d').drawImage(S.img, 0, 0, t.width, t.height);
    const f = CLIN.read(); const v = visits(); v.push({ id, ts: Date.now(), A: M.A, P: M.perim, len: M.len, wid: M.wid, tb: f.bsa ? KB.tbsa(M.A, f.bsa) : null, type: f.type, tis: S.tissue && S.tissue.pct, thumb: t.toDataURL('image/jpeg', 0.7) });
    putVisits(v); renderHist();
  }
  function renderHist() {
    const id = $('h-id').value.trim(); const v = visits().filter(x => id ? x.id === id : true).sort((a, b) => a.ts - b.ts);
    $('histList').innerHTML = v.slice().reverse().map(x => `<div class="vis"><img src="${x.thumb}" alt=""><div class="m"><b>${x.id}</b> · ${new Date(x.ts).toLocaleDateString('id-ID')}<br><span class="num">${fmt(x.A, 2)} cm²${x.tb != null ? ` · ${fmt(x.tb, 2)}% TBSA` : ''}</span></div><button data-vdel="${x.ts}" aria-label="hapus">✕</button></div>`).join('') || '<div class="muted sm">Belum ada kunjungan tersimpan.</div>';
    document.querySelectorAll('[data-vdel]').forEach(b => b.onclick = () => { putVisits(visits().filter(x => String(x.ts) !== b.dataset.vdel)); renderHist(); });
    let ch = ''; if (v.length >= 2) {
      const w = 320, h = 120, pad = 22; const t0 = v[0].ts, t1 = v[v.length - 1].ts || t0 + 1, amax = Math.max(...v.map(x => x.A)) * 1.1;
      const X = (t) => pad + (w - 2 * pad) * (t - t0) / (t1 - t0 || 1), Y = (a) => h - pad - (h - 2 * pad) * a / amax;
      ch = `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Tren luas luka"><polyline fill="none" stroke="#22d3ee" stroke-width="2" points="${v.map(x => `${X(x.ts)},${Y(x.A)}`).join(' ')}"/>${v.map(x => `<circle cx="${X(x.ts)}" cy="${Y(x.A)}" r="3.5" fill="#22d3ee"/>`).join('')}<text x="${pad}" y="12" fill="#8a98b3" font-size="10">cm²</text></svg>`;
      const a0 = v[0], a1 = v[v.length - 1], wk = (a1.ts - a0.ts) / 6048e5, red = 100 * (a0.A - a1.A) / a0.A;
      const vel = wk > 0 && a0.P && a1.P ? 10 * 2 * (a0.A - a1.A) / (a0.P + a1.P) / wk : null;
      ch += `<div class="card"><h4>Lintasan penyembuhan</h4><ul><li>Perubahan luas sejak kunjungan pertama: <b class="num">${fmt(red, 1)}%</b> dalam ${fmt(wk, 1)} minggu</li>${vel != null ? `<li>Kecepatan maju tepi: <b class="num">${fmt(vel, 2)} mm/minggu</b></li>` : ''}<li class="sm muted">Pengurangan luas ≥ 40% dalam 4 minggu memprediksi penyembuhan pada ulkus kaki diabetik dan vena (Sheehan, Margolis). Bila kurang: evaluasi ulang infeksi, perfusi, offloading/kompresi, nutrisi, dan pertimbangkan biopsi.</li></ul></div>`;
    }
    $('histChart').innerHTML = ch;
  }

  /* ===================== ekspor ===================== */
  function exportPng() {
    if (!S.img) return; const M = metrics(); const f = CLIN.read(); const k = Math.max(1, S.W / 800); const pw = Math.round(S.W * 0.46);
    const c = document.createElement('canvas'); c.width = S.W + pw; c.height = S.H; const x = c.getContext('2d');
    x.fillStyle = '#0a0e16'; x.fillRect(0, 0, c.width, c.height); x.drawImage(S.img, 0, 0);
    if (S.m) R.overlay(x, { W: S.W, H: S.H, m: S.m, tissueCanvas: S.layers.tissue ? S.tissueCanvas : null, cmPerPx: S.cal && S.cal.cmPerPx }, k, { ...S.layers });
    const X0 = S.W + 22 * k; let y = 36 * k; const mono = 'ui-monospace,Consolas,monospace';
    const line = (t, size, col, bold) => { x.font = `${bold ? 700 : 400} ${size * k}px ${bold ? mono : 'system-ui,sans-serif'}`; x.fillStyle = col || '#e6edf7'; x.fillText(t, X0, y); y += (size + 8) * k; };
    line('WoundScan', 20, '#22d3ee', true); line(new Date().toLocaleString('id-ID'), 11, '#8a98b3'); y += 6 * k;
    const T = KB.TYPES.find(t => t.id === f.type); line(T.label, 14, '#e6edf7', true);
    if (M) {
      const cm = !!M.cm; y += 4 * k;
      if (M.A) { line(`${fmt(M.A, 2)} cm²`, 30, '#22d3ee', true); line(`± ${fmt(M.A * M.rel, 2)} cm² (${fmt(M.rel * 100, 1)}%)`, 12, '#8a98b3'); }
      if (M.A && M.bsa) line(`${fmt(KB.tbsa(M.A, M.bsa), 2)} % TBSA`, 22, '#a78bfa', true);
      y += 4 * k; if (cm) { line(`P × L   ${fmt(M.len, 2)} × ${fmt(M.wid, 2)} cm`, 13, '#e6edf7', true); line(`Kepala–kaki ${fmt(M.htLen, 2)} × ${fmt(M.htWid, 2)} cm`, 13); line(`Keliling ${fmt(M.perim, 2)} cm · Feret ${fmt(M.feret, 2)} cm`, 13); }
      line(`Sirkularitas ${fmt(M.circ, 3)}`, 13);
      if (S.tissue) { y += 8 * k; const p = S.tissue.pct, col = TIS.COLORS; let bx = X0; const bw = pw - 44 * k; [[1, p.gran], [2, p.slough], [3, p.nekro], [4, p.epi]].forEach(([t, v]) => { x.fillStyle = col[t]; x.fillRect(bx, y, bw * v / 100, 14 * k); bx += bw * v / 100; }); y += 30 * k;
        line(`Granulasi ${fmt(p.gran, 0)}% · Slough ${fmt(p.slough, 0)}%`, 12); line(`Nekrotik ${fmt(p.nekro, 0)}% · Epitel ${fmt(p.epi, 0)}%`, 12); }
      y += 8 * k; line(S.cal ? 'Skala: ' + S.cal.label : 'TANPA SKALA', 11, S.cal ? '#8a98b3' : '#f87171');
    }
    const a = document.createElement('a'); a.download = `woundscan-${Date.now()}.png`; a.href = c.toDataURL('image/png'); a.click();
  }

  /* ===================== pengikatan UI ===================== */
  $('file').addEventListener('change', (e) => { if (e.target.files[0]) loadFile(e.target.files[0]); e.target.value = ''; });
  document.querySelectorAll('.tool').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
  $('layers').addEventListener('change', (e) => { S.layers[e.target.dataset.l] = e.target.checked; if (e.target.dataset.l === 'margins' && e.target.checked && !S.cal) alert('Margin butuh skala terkalibrasi.'); draw(); });
  $('thr').addEventListener('input', (e) => { S.thr = e.target.value / 100; $('thrv').textContent = fmt(S.thr, 2); });
  $('thr').addEventListener('change', () => { if (S.src.t === 'model' && S.prob) setMask(SEG.fromProb(S.prob, S.W, S.H, S.thr), false); else if (S.src.t === 'tap') runTap(S.src.seed); });
  $('brush').addEventListener('input', (e) => { S.brush = +e.target.value; });
  $('btnUndo').addEventListener('click', () => { if (S.undo.length) { S.mask = S.undo.pop(); analyze(); draw(); } });
  $('btnAuto').addEventListener('click', () => { if (S.img && SEG.ready()) autoSeg(); });
  $('btnExport').addEventListener('click', exportPng);
  $('btnSave').addEventListener('click', saveVisit); $('btnClear').addEventListener('click', () => { S.basket = []; saveBasket(); renderBasketUI(); renderRec(); });
  $('h-id').addEventListener('input', renderHist);
  $('tabs').addEventListener('click', (e) => { const t = e.target.dataset.tab; if (!t) return; document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b === e.target)); document.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.id === 'p-' + t)); if (t === 'riwayat') renderHist(); });
  ['dragover', 'drop'].forEach(ev => $('stage').addEventListener(ev, (e) => { e.preventDefault(); if (ev === 'drop' && e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { S.calPts = []; S.palm = []; setTool('pan'); } if ((e.ctrlKey || e.metaKey) && e.key === 'z') $('btnUndo').click(); });

  window.__draw = draw; if (window.SURG) SURG.bind();
  CLIN.init(() => { renderPanels(); });
  renderCalib(); renderHist(); draw();

  /* model */
  (async () => {
    try {
      try { S.modelInfo = await (await fetch('models/meta.json')).json(); } catch (e) { }
      await SEG.load('models/wound_seg.onnx');
      status(S.modelInfo ? `Model siap · Dice validasi ${fmt(S.modelInfo.val_dice, 2)}` : 'Model siap', 'ok');
    } catch (e) { console.warn(e); status('Model belum tersedia: mode ketuk-luka aktif', 'err'); }
  })();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
  window.__S = S; window.__load = loadFile; window.__setCal = setCal; window.__setMask = setMask; // untuk uji
})();
