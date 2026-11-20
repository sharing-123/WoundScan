/* Tab Bedah: rekomendasi teknik, marking otomatis, simulasi hasil, lembar rencana operasi (PNG). */
window.SURG = (() => {
  const $ = (id) => document.getElementById(id);
  const fmt = (n, d = 1) => (isFinite(n) ? n.toFixed(d) : '–').replace('.', ',');
  const O = { tech: 'auto', margin: 0, ratio: 4, theta: null, spacing: 0, flapK: 3, zAngle: 60, mesh: 1.5, flip: false, lax: 0, stage: 'hari0' };
  let mode = 'anot', cacheKey = '', edtCache = null, simTimer = 0;
  const S = () => window.__S; const dec = (v) => String(v).replace(/(\d)\.(\d)/g, '$1,$2');

  function largest(polys) { let best = null, ba = -1; polys.forEach(p => { const a = Math.abs(G.polyArea(p)); if (a > ba) { ba = a; best = p; } }); return best; }
  function longAxis(sh) {
    const r = sh.rect, l1 = Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]), l2 = Math.hypot(r[2][0] - r[1][0], r[2][1] - r[1][1]);
    return l1 >= l2 ? Math.atan2(r[1][1] - r[0][1], r[1][0] - r[0][0]) : Math.atan2(r[2][1] - r[1][1], r[2][0] - r[1][0]);
  }

  function geom() {
    const s = S(); const m = s.m; if (!m || !s.cal) return null;
    const cm = s.cal.cmPerPx;
    if (!m.edt) m.edt = G.edt(s.mask, s.W, s.H);
    const neg = new Float32Array(s.W * s.H); for (let i = 0; i < neg.length; i++) neg[i] = -m.edt[i];
    const mp = (mmv) => { const polys = G.contours(neg, s.W, s.H, -(mmv / 10) / cm); return largest(polys); };
    const poly = largest(m.polys); const hull = G.hull(poly);
    return { poly, mask: s.mask, W: s.W, H: s.H, cm, centroid: m.centroid, theta0: longAxis(m.shape), zone: null, areaPx: m.areaPx, hull, shape: m.shape, marginPoly: mp };
  }

  function context(g, f) {
    const s = S(); const reg = KB.REGIONS.find(r => r.id === f.region) || { zone: 'umum' }; const sh = g.shape; const cm = g.cm;
    const r = sh.rect, l1 = Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]) * cm * 10, l2 = Math.hypot(r[2][0] - r[1][0], r[2][1] - r[1][1]) * cm * 10;
    const lMm = Math.max(l1, l2), wMm = Math.min(l1, l2); const T = s.tissue ? s.tissue.pct : null; const acute = (KB.TYPES.find(x => x.id === f.type) || {}).group === 'Akut';
    return { zone: reg.zone, areaCm2: g.areaPx * cm * cm, wMm, lMm, aspect: lMm / Math.max(wMm, 0.1), depth: f.depth, exposed: f.exposed.map(e => KB.STRUCT.find(x => x.id === e).label.toLowerCase()),
      infected: !!(f.flags.pus || f.flags.eri || f.flags.sirs), bedReady: !(f.flags.pus || f.flags.eri) && !(T && acute === false && (T.nekro >= 20 || T.slough >= 40)),
      onkologi: f.type === 'curiga' || !!f.flags.marjolin, ratio: O.ratio, laxMm: O.lax || 0, typeId: f.type };
  }


  const LIMB = { tungkai: 'tungkai', pretibia: 'tungkai', tumit: 'tungkai', lengan: 'lengan', tangan: 'lengan' };
  const FLAP_LIMB = { alt: 'tungkai', gracilis: 'tungkai', tfl: 'tungkai', rev_sural: 'tungkai', gastroc: 'tungkai', soleus: 'tungkai', rfff: 'lengan', rfa_rev: 'lengan' };
  const SAME_SIDE = ['rev_sural', 'gastroc', 'soleus', 'tfl', 'gluteal', 'ld_ped', 'pectoralis', 'rfa_rev', 'mpap', 'propeller', 'vy', 'adv', 'keystone', 'rotation', 'rhomboid', 'bilobed'];
  function donorCtx(f, c) {
    return { areaCm2: c.areaCm2, region: f.region, zone: c.zone, depth: f.depth, exposed: c.exposed, bedReady: c.bedReady, infected: c.infected, dm: !!f.flags.dm, pad: !!f.flags.pad, osteo: !!f.flags.tulangp, irradiated: !!f.flags.radiasi, smoker: !!f.flags.perokok, age: f.age, bsa: f.bsa, limb: LIMB[f.region] || null, third: ($('s-third') && $('s-third').value) || '' };
  }
  const opp = (sd) => sd === 'kanan' ? 'kiri' : sd === 'kiri' ? 'kanan' : 'kanan';
  function donorBlock(f, c, dc, plan, tech, preview) {
    const box = $('surgDonor'); const S0 = S(); const side = $('s-side') ? $('s-side').value : 'kanan'; const rows = []; const md = []; let title = '', sub = '';
    const num = (v, d) => fmt(v, d == null ? 1 : d);
    if (tech === 'stsg') {
      title = 'Donor STSG'; const need = plan.meta.donorA || 0; sub = `Luas donor dibutuhkan ${num(need, 2)} cm² (template ${num(plan.meta.templateA, 2)} cm², mesh 1:${O.mesh}); BSA ${f.bsa ? num(f.bsa, 2) : 'asumsi 1,8'} m².`;
      DONOR.rankStsg(dc, need).slice(0, 4).forEach((d, i) => {
        const ds = d.limb && d.limb === dc.limb ? opp(side) : side;
        rows.push({ n: i + 1, name: d.label + (d.limb ? ` (${ds})` : ''), a: `tersedia ${num(d.avail, 0)} cm² (${num(d.ratio, 1)}x)`, b: `strip ${num(d.stripW, 1)} x ${num(d.stripL, 1)} cm, ${d.passes} lintasan`, c: [d.note].concat(d.reasons).join('; ') });
        md.push({ id: d.id, n: i + 1, dims: [Math.min(d.stripL, 38), d.stripW], side: ds });
      });
    } else if (tech === 'ftsg') {
      title = 'Donor FTSG'; const L = plan.meta.donorL, W = plan.meta.donorW; sub = `Donor elips ${num(L, 1)} x ${num(W, 1)} cm (luas ${num(plan.meta.donorA, 2)} cm², +10%), tutup primer.`;
      DONOR.rankFtsg(dc, L, W).slice(0, 4).forEach((d, i) => { rows.push({ n: i + 1, name: d.label, a: `maks ${d.maxW} x ${d.maxL} cm`, b: d.fits ? 'muat, tutup primer' : 'tidak muat', c: [d.note].concat(d.reasons).join('; ') }); md.push({ id: d.id, n: i + 1, dims: [L, W], side }); });
    } else if (['vy', 'adv', 'flapbesar'].includes(tech)) {
      title = 'Pilihan flap (anak tangga rekonstruksi)'; const pad = DONOR.paddle(plan.dims.lMm, plan.dims.wMm); sub = `Defek ${num(c.areaCm2, 1)} cm². Paddle yang dibutuhkan (defek + 5 mm tiap sisi, +10%): ${num(pad.L, 1)} x ${num(pad.W, 1)} cm.`;
      DONOR.rankFlaps(dc).slice(0, 5).forEach((d, i) => {
        const same = SAME_SIDE.includes(d.id); const fl = FLAP_LIMB[d.id]; const ds = same ? side : (fl && fl === dc.limb ? opp(side) : side);
        rows.push({ n: i + 1, name: `${d.label} [${d.cls}]`, a: `maks ${d.maxDef} cm²`, b: d.cls === 'lokal' ? 'dari jaringan sekitar' : (/otot/.test(d.label) ? `otot menutup ${num(pad.L, 1)} x ${num(pad.W, 1)} cm + STSG; sisi ${ds}` : `paddle kulit ${num(pad.L, 1)} x ${num(pad.W, 1)} cm; sisi ${ds}`), c: [d.note].concat(d.reasons).join('; ') });
        if (d.cls !== 'lokal') md.push({ id: d.id, n: i + 1, dims: [pad.L, pad.W], side: ds });
      });
    } else { box.innerHTML = ''; S0.donorPlan = null; return; }
    if (preview) title = title + ' (pratinjau: setelah dasar siap)';
    const svg = BMAP.svg(f.h || 170, md, { region: f.region, side });
    S0.donorPlan = { title, sub, rows, svg, md };
    box.innerHTML = `<div class="card plastic"><h4>${title}</h4><p class="sm">${dec(sub)}</p><div class="table-wrap"><table class="nums donor"><thead><tr><td>#</td><td>Donor</td><td>Ketersediaan</td><td>Dimensi</td></tr></thead>${rows.map(r => `<tr><td><b>${r.n}</b></td><td>${dec(r.name)}<div class="sm muted">${dec(r.c)}</div></td><td class="num">${dec(r.a)}</td><td class="num">${dec(r.b)}</td></tr>`).join('')}</table></div></div><div class="card"><h4>Peta donor (berskala tinggi badan ${f.h || 170} cm)</h4>${svg}<div class="src">Lokasi dan ukuran berskala dari proporsi antropometri; konfirmasi dengan palpasi, Doppler, dan pencitraan pada pasien.</div></div>`;
  }

  function update() {
    const s = S(); if (!s) return;
    const g = geom(); const pane = $('surgInfo');
    if (!g) { s.plan = null; s.after = null; pane.innerHTML = '<div class="muted">Segmentasi luka dan kalibrasi skala dahulu: marking dalam mm butuh skala terkalibrasi.</div>'; $('surgNums').innerHTML = ''; return; }
    const f = CLIN.read(); const c = context(g, f); g.zone = c.zone;
    let rec = PLAN.recommend(c); const dc = donorCtx(f, c); let decision = null;
    if (['stsg', 'ftsg', 'flapbesar', 'vy', 'adv'].includes(rec.tech)) {
      decision = DONOR.decide(dc);
      if (decision.mode === 'graft') rec = { tech: decision.kind, why: decision.why.concat(decision.alt ? ['Alternatif: ' + decision.alt + '.'] : []) };
      else if (decision.mode === 'flap') { const top = decision.ladder[0]; const t2 = top && top.cls === 'lokal' && (top.id === 'vy' || top.id === 'adv') ? top.id : 'flapbesar'; rec = { tech: t2, why: decision.why.concat(top ? [`Flap teratas: ${top.label} (${top.cls}).`] : []) }; }
    }
    const tech = O.tech === 'auto' ? rec.tech : O.tech;
    const marginMm = O.margin || (f.type === 'curiga' || f.flags.marjolin ? 4 : 0);
    const opt = { theta: O.theta == null ? null : O.theta * Math.PI / 180, marginMm, ratio: O.ratio, spacing: O.spacing || null, flapK: O.flapK, zAngle: O.zAngle, mesh: O.mesh, flipDir: O.flip, laxMm: O.lax || 0 };
    let plan; try { plan = PLAN.build(tech, g, opt); } catch (e) { console.error(e); pane.textContent = 'Gagal membuat rencana: ' + e.message; return; }
    plan.rec = rec; plan.ctx = c; plan.marginMm = marginMm; s.plan = plan; s.after = null;
    const tol = metricsTol(g, s);
    let h = `<div class="card plastic"><h4>Teknik ${O.tech === 'auto' ? 'rekomendasi' : 'dipilih'}</h4><p><b>${plan.title}</b></p>`;
    if (O.tech !== 'auto' && O.tech !== rec.tech) h += `<p class="sm muted">Rekomendasi otomatis: ${PLAN.TECHS.find(t => t.id === rec.tech).label}</p>`;
    h += `<ul>${rec.why.map(w => `<li>${w}</li>`).join('')}</ul></div>`;
    if (tol.warn) h += `<div class="card warn"><h4>Resolusi</h4><p>${tol.warn}</p></div>`;
    pane.innerHTML = h;
    let dTech = tech, dPlan = plan, preview = false;
    if (tech === 'debridemen') { const pv = DONOR.decide({ ...dc, bedReady: true, infected: false }); const pt = pv.mode === 'graft' ? pv.kind : (pv.mode === 'flap' ? 'flapbesar' : null); if (pt) { try { dPlan = PLAN.build(pt, g, opt); dTech = pt; preview = true; } catch (e) { /* abaikan */ } } }
    donorBlock(f, c, { ...dc, bedReady: preview ? true : dc.bedReady }, dPlan, dTech, preview);
    $('surgNums').innerHTML = `<div class="card"><h4>Ukuran kuantitatif</h4><table class="nums">${plan.nums.map(n => `<tr><td>${n.k}</td><td class="num"><b>${dec(n.v)}</b> ${n.u}</td></tr>`).join('')}</table><div class="src">Toleransi panjang ± ${fmt(tol.lenTolMm, 2)} mm (1 piksel = ${fmt(tol.pxMm, 3)} mm; kalibrasi ± ${fmt(tol.calPct, 1)}%).</div></div>
      <div class="card"><h4>Langkah operasi</h4><ol>${plan.steps.map(t => `<li>${t}</li>`).join('')}</ol>${plan.notes.map(n => `<p class="sm muted">${n}</p>`).join('')}</div>`;
    draw(); if (mode === 'sim') scheduleSim();
  }

  function metricsTol(g, s) {
    const pxMm = g.cm * 10; const smallPx = Math.min(g.shape.rectShort, g.shape.rectLong);
    const lenTolMm = Math.sqrt(pxMm * pxMm + (s.cal.relLen * Math.max(g.shape.rectLong, g.shape.rectShort) * pxMm) ** 2);
    return { pxMm, lenTolMm, calPct: s.cal.relLen * 100, warn: smallPx < 40 ? `Lebar luka hanya ${Math.round(smallPx)} piksel: resolusi membatasi ketelitian (± ${fmt(pxMm / 2, 2)} mm per tepi). Dekatkan kamera sampai lebar luka ≥ 40 piksel.` : '' };
  }

  function scheduleSim() { clearTimeout(simTimer); simTimer = setTimeout(() => { const s = S(); if (s.plan) { s.after = SIM.after({ W: s.W, H: s.H, img: s.img, rgba: s.rgba, cmPerPx: s.cal.cmPerPx }, s.plan, O.stage); } window.__draw && window.__draw(); }, 50); }
  const draw = () => window.__draw && window.__draw();
  function setMode(m) { mode = m; document.querySelectorAll('[data-vm]').forEach(b => b.classList.toggle('on', b.dataset.vm === m)); if (m === 'sim') { const s = S(); if (!s.after && s.plan) { $('surgBusy').textContent = 'Membuat simulasi…'; scheduleSim(); setTimeout(() => $('surgBusy').textContent = '', 600); } } draw(); }
  const getMode = () => mode;

  /* ---------- lembar rencana PNG ---------- */
  function wrap(x, text, maxW) { const words = String(text).split(' '); const lines = []; let cur = ''; words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }); if (cur) lines.push(cur); return lines; }
  function bboxOfPlan(s) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const add = (p) => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); };
    s.plan.items.forEach(it => { if (it.p && it.p[0] && it.p[0].length) it.p.forEach(add); else if (it.p) add(it.p); if (it.a) add(it.a); if (it.b) add(it.b); });
    s.m.polys.forEach(p => p.forEach(add)); const w = x1 - x0, h = y1 - y0, pad = Math.max(0.35 * Math.max(w, h), 60);
    return [Math.max(0, x0 - pad), Math.max(0, y0 - pad), Math.min(s.W, x1 + pad), Math.min(s.H, y1 + pad)];
  }
  async function exportSheet() {
    const s = S(); if (!s || !s.plan) { alert('Buat rencana dahulu (segmentasi + kalibrasi).'); return; }
    if (!s.after) s.after = SIM.after({ W: s.W, H: s.H, img: s.img, rgba: s.rgba, cmPerPx: s.cal.cmPerPx }, s.plan, O.stage);
    const [cx0, cy0, cx1, cy1] = bboxOfPlan(s); const cw = cx1 - cx0, ch = cy1 - cy0; const ph = 640, sc = ph / ch, pw = Math.round(cw * sc); const gap = 24, M = 36;
    const W = M * 2 + pw * 3 + gap * 2; const f = CLIN.read(); const pl = s.plan;
    const probe = document.createElement('canvas').getContext('2d'); probe.font = '17px system-ui,sans-serif'; const colW = (W - M * 2 - gap * 2) / 3;
    const colLines = (arr, prefix) => arr.flatMap((t, i) => wrap(probe, (prefix ? (i + 1) + '. ' : '• ') + t, colW - 10));
    const metr = []; const A = s.m.areaPx * s.cal.cmPerPx ** 2; metr.push(`Luas luka ${fmt(A, 2)} cm²` + (f.bsa ? `  (${fmt(KB.tbsa(A, f.bsa), A / (f.bsa * 1e4) * 100 < 1 ? 3 : 2)} % TBSA)` : ''));
    const left = pl.nums.map(n => `${n.k}: ${dec(n.v)} ${n.u}`).flatMap(t => wrap(probe, '• ' + t, colW - 10)); const mid = colLines(pl.steps, true); const mt = metricsTol(geom(), s); const sh = s.m.shape, cmv = s.cal.cmPerPx;
    const manual = O.tech !== 'auto' && O.tech !== pl.rec.tech ? ['Teknik dipilih manual oleh operator. Rekomendasi otomatis: ' + PLAN.TECHS.find(t => t.id === pl.rec.tech).label + '. ' + pl.rec.why[0]] : pl.rec.why;
    const right = colLines(manual.concat(pl.notes).concat([`Luas ${dec(fmt(A, 2))} cm², keliling ${dec(fmt(s.m.outerPerim * cmv, 2))} cm, kotak minimum ${dec(fmt(Math.max(sh.rectLong, sh.rectShort) * cmv, 2))} × ${dec(fmt(Math.min(sh.rectLong, sh.rectShort) * cmv, 2))} cm`, `Toleransi panjang ± ${dec(fmt(mt.lenTolMm, 2))} mm (1 piksel = ${dec(fmt(mt.pxMm, 3))} mm)`]), false);
    const textRows = Math.max(left.length, mid.length, right.length + 6) + 2; const dp = s.donorPlan; const bandH = dp ? 640 : 0; const H = 130 + ph + 60 + textRows * 24 + bandH + 70;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#0a0e16'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#e6edf7'; x.font = '700 34px system-ui,sans-serif'; x.fillText('RENCANA OPERASI', M, 58); x.font = '400 18px system-ui,sans-serif'; x.fillStyle = '#8a98b3';
    const pid = $('h-id').value.trim(); x.fillText(`${new Date().toLocaleString('id-ID')}${pid ? '   ·   ' + pid : ''}   ·   ${pl.title}   ·   ${metr[0]}`, M, 90);
    const panels = [['SEBELUM (ANOTASI)', 'anot'], ['MARKING BEDAH', 'mark'], ['SIMULASI HASIL (ILUSTRATIF)', 'sim']];
    panels.forEach(([title, m], i) => {
      const px0 = M + i * (pw + gap), py0 = 120; const k = 1.25 / sc; x.save(); x.beginPath(); x.roundRect(px0, py0, pw, ph, 14); x.clip(); x.translate(px0, py0); x.scale(sc, sc); x.translate(-cx0, -cy0);
      x.drawImage(m === 'sim' ? s.after : s.img, 0, 0); const st = { W: s.W, H: s.H, m: s.m, tissueCanvas: s.tissueCanvas, cmPerPx: s.cal.cmPerPx };
      const so = { origin: [cx0, cy0], cw, ch }; if (m === 'anot') R.overlay(x, st, k, { ...s.layers, contour: true, margins: false, grid: false, ...so });
      if (m === 'mark') { R.overlay(x, st, k, { contour: true, scale: true, tissue: false, ...so }); R.plan(x, pl, k); }
      if (m === 'sim') R.overlay(x, st, k, { bare: true, scale: true, ...so });
      x.restore(); x.strokeStyle = '#202a3e'; x.lineWidth = 2; x.beginPath(); x.roundRect(px0, py0, pw, ph, 14); x.stroke();
      x.fillStyle = 'rgba(8,12,20,.8)'; x.beginPath(); x.roundRect(px0 + 10, py0 + 10, x.measureText(title).width + 26, 30, 9); x.fill(); x.fillStyle = '#22d3ee'; x.font = '700 15px system-ui,sans-serif'; x.fillText(title, px0 + 22, py0 + 31);
    });
    const ty = 120 + ph + 46; const cols = [['UKURAN KUANTITATIF', left], ['LANGKAH OPERASI', mid], ['RASIONAL DAN CATATAN', right]];
    cols.forEach(([h, lines], i) => { const tx = M + i * (colW + gap); x.fillStyle = '#22d3ee'; x.font = '700 16px system-ui,sans-serif'; x.fillText(h, tx, ty); x.fillStyle = '#e6edf7'; x.font = '400 17px system-ui,sans-serif'; lines.forEach((l, j) => x.fillText(l, tx, ty + 30 + j * 24)); });
    x.fillStyle = '#8a98b3'; x.font = '400 14px system-ui,sans-serif';
    wrap(x, `Skala: ${s.cal.label}. Usulan geometri dari foto 2D: laksitas kulit, perfusi, kelengkungan, dan arah garis kulit tidak terukur. Konfirmasi dan sesuaikan pada pasien sebelum menandai. Simulasi adalah ilustrasi, bukan prediksi hasil.`, W - M * 2).forEach((l, j) => x.fillText(l, M, H - 40 + j * 18));
    if (dp) {
      const by = ty + 30 + textRows * 24 - 40; x.fillStyle = '#22d3ee'; x.font = '700 18px system-ui,sans-serif'; x.fillText(dp.title.toUpperCase() + ' DAN PETA DONOR', M, by);
      x.fillStyle = '#8a98b3'; x.font = '400 15px system-ui,sans-serif'; wrap(x, dec(dp.sub), W - M * 2).forEach((l, j) => x.fillText(l, M, by + 24 + j * 20));
      try { const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(dp.svg.replace('width="100%"', 'width="1200" height="' + Math.round(1200 * 0.62) + '"')); await new Promise((r, j) => { img.onload = r; img.onerror = j; }); const mh = 560; const mw = Math.round(mh * img.width / img.height); x.drawImage(img, M, by + 50, mw, mh); }
      catch (e) { x.fillStyle = '#f87171'; x.fillText('Peta donor gagal dirender', M, by + 80); }
      let yy = by + 60; const tx = M + 760; const tw = W - tx - M;
      dp.rows.forEach(r => {
        x.fillStyle = '#e6edf7'; x.font = '700 17px system-ui,sans-serif'; wrap(x, `${r.n}. ${dec(r.name)}`, tw).forEach(l => { x.fillText(l, tx, yy); yy += 22; });
        x.font = '400 15px system-ui,sans-serif'; x.fillStyle = '#c7d2e5'; [dec(r.a), dec(r.b)].forEach(t => wrap(x, t, tw).forEach(l => { x.fillText(l, tx + 14, yy); yy += 20; }));
        x.fillStyle = '#8a98b3'; wrap(x, dec(r.c), tw - 14).slice(0, 3).forEach(l => { x.fillText(l, tx + 14, yy); yy += 19; }); yy += 10;
      });
    }
    const a = document.createElement('a'); a.download = `rencana-operasi-${Date.now()}.png`; a.href = c.toDataURL('image/png'); a.click();
  }

  function bind() {
    const opts = $('surgOpts'); if (!opts) return;
    $('s-tech').innerHTML = PLAN.TECHS.map(t => `<option value="${t.id}">${t.label}</option>`).join('');
    const on = (id, key, conv) => $(id).addEventListener('input', (e) => { O[key] = conv ? conv(e.target.value) : e.target.value; if (id === 's-theta') $('s-thetav').textContent = O.theta == null ? 'otomatis' : O.theta + '°'; update(); });
    on('s-tech', 'tech'); on('s-margin', 'margin', Number); on('s-ratio', 'ratio', Number); on('s-sp', 'spacing', Number); on('s-k', 'flapK', Number); on('s-z', 'zAngle', Number); on('s-mesh', 'mesh', Number); on('s-lax', 'lax', Number);
    $('s-theta').addEventListener('input', (e) => { O.theta = +e.target.value; $('s-thetav').textContent = O.theta + '°'; update(); });
    $('s-theta-auto').addEventListener('click', () => { O.theta = null; $('s-thetav').textContent = 'otomatis'; update(); });
    $('s-flip').addEventListener('click', () => { O.flip = !O.flip; update(); });
    $('s-stage').addEventListener('input', (e) => { O.stage = e.target.value; S().after = null; if (mode === 'sim') scheduleSim(); });
    document.querySelectorAll('[data-vm]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.vm)));
    $('s-side').addEventListener('input', update); $('s-third').addEventListener('input', update);
    $('btnSheet').addEventListener('click', exportSheet);
  }
  return { update, bind, getMode, setMode, exportSheet };
})();
