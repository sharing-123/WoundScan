/* Perencana bedah plastik: dari masker luka menghasilkan penanda geometri (px) + angka (mm) + langkah.
   Semua geometri deterministik dan dapat diuji. Ini usulan dari foto 2D: laksitas kulit, perfusi, dan kelengkungan
   tidak terukur, jadi hasil harus dikonfirmasi di pasien. */
window.PLAN = (() => {
  const rad = (d) => d * Math.PI / 180;
  const ZONE = {
    estetik:        { sp: 4,  bite: 2.5, thread: '6-0 nilon/polipropilen', remove: '5–7 hari',  maxClose: 15 },
    fungsional:     { sp: 5,  bite: 3,   thread: '5-0 nilon',              remove: '10–14 hari', maxClose: 15 },
    umum:           { sp: 8,  bite: 5,   thread: '4-0 nilon + dermis 4-0 absorbable', remove: '10–14 hari', maxClose: 30 },
    'tungkai-bawah':{ sp: 8,  bite: 5,   thread: '4-0 nilon',              remove: '10–21 hari', maxClose: 12 },
    tekanan:        { sp: 10, bite: 8,   thread: '2-0 absorbable dermis + 3-0 nilon', remove: '14–21 hari', maxClose: 30 },
    khusus:         { sp: 5,  bite: 3,   thread: '4-0/5-0 absorbable',     remove: 'sesuai lokasi', maxClose: 15 },
  };
  const TECHS = [
    { id: 'auto', label: 'Otomatis (rekomendasi)' },
    { id: 'linear', label: 'Penutupan linear langsung' },
    { id: 'fusiform', label: 'Eksisi fusiform + tutup primer' },
    { id: 'adv', label: 'Flap advancement' },
    { id: 'vy', label: 'Flap V–Y' },
    { id: 'z', label: 'Z-plasti (parut kontraktur)' },
    { id: 'stsg', label: 'Cangkok kulit tebal-terbelah (STSG)' },
    { id: 'ftsg', label: 'Cangkok kulit tebal-penuh (FTSG)' },
    { id: 'debridemen', label: 'Debridemen + persiapan dasar' },
    { id: 'sekunder', label: 'Penyembuhan sekunder' },
    { id: 'flapbesar', label: 'Flap regional/bebas (perencanaan lanjut)' },
  ];

  /* ---------- kerangka koordinat ---------- */
  const frame = (th) => ({ u: [Math.cos(th), Math.sin(th)], v: [-Math.sin(th), Math.cos(th)] });
  const toUV = (p, c, f) => [(p[0] - c[0]) * f.u[0] + (p[1] - c[1]) * f.u[1], (p[0] - c[0]) * f.v[0] + (p[1] - c[1]) * f.v[1]];
  const fromUV = (q, c, f) => [c[0] + q[0] * f.u[0] + q[1] * f.v[0], c[1] + q[0] * f.u[1] + q[1] * f.v[1]];

  /* profil fusiform: kurva Bezier dari ujung (sudut apeks dikontrol) ke lebar maksimum. g(0)=0 di ujung, g(1)=1 di tengah */
  function profile(ratio, apexDeg) {
    const s = Math.min(1.6, Math.tan(rad(apexDeg / 2)) * ratio);
    const P = [[0, 0], [0.38, Math.min(0.9, 0.38 * s)], [0.62, 1], [1, 1]];
    const xs = [], ys = [];
    for (let i = 0; i <= 80; i++) {
      const t = i / 80, m = 1 - t;
      xs.push(m * m * m * P[0][0] + 3 * m * m * t * P[1][0] + 3 * m * t * t * P[2][0] + t * t * t * P[3][0]);
      ys.push(m * m * m * P[0][1] + 3 * m * m * t * P[1][1] + 3 * m * t * t * P[2][1] + t * t * t * P[3][1]);
    }
    const g = (x) => { if (x <= 0) return 0; if (x >= 1) return 1; let lo = 0, hi = xs.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] <= x) lo = mid; else hi = mid; } const t = (x - xs[lo]) / (xs[hi] - xs[lo] || 1); return ys[lo] + t * (ys[hi] - ys[lo]); };
    let area = 0; for (let i = 1; i < xs.length; i++) area += (xs[i] - xs[i - 1]) * (ys[i] + ys[i - 1]) / 2;
    return { g, areaNorm: area, apex: apexDeg };           // luas fusiform = 4 * a * b * areaNorm
  }

  /* fusiform minimal yang melingkupi seluruh titik (koordinat uv relatif ke pusat) dengan rasio L:W */
  function enclose(pts, ratio, apexDeg) {
    const pr = profile(ratio, apexDeg);
    let bLo = 0, umax = 0, vmax = 0; for (const q of pts) { umax = Math.max(umax, Math.abs(q[0])); vmax = Math.max(vmax, Math.abs(q[1])); }
    bLo = Math.max(vmax, umax / ratio) * 0.999; let bHi = bLo * 6 + 1;
    const ok = (b) => { const a = ratio * b; for (const q of pts) { const x = (a - Math.abs(q[0])) / a; if (x < 0) return false; if (Math.abs(q[1]) > b * pr.g(x) + 1e-9) return false; } return true; };
    if (!ok(bHi)) bHi *= 4;
    let lo = bLo, hi = bHi; for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; }
    const b = hi, a = ratio * b; return { a, b, pr };
  }
  function outlineFusiform(a, b, pr, c, f, n = 40) {
    const up = [], dn = [];
    for (let i = 0; i <= 2 * n; i++) { const u = -a + (2 * a * i) / (2 * n); const x = (a - Math.abs(u)) / a; const v = b * pr.g(x); up.push([u, v]); dn.push([u, -v]); }
    return up.concat(dn.reverse()).map(q => fromUV(q, c, f));
  }

  /* posisi jahitan simetris, jumlah ganjil, jarak seragam, urutan "aturan separuh" */
  function sutureLayout(lenMm, spMm) {
    const tip = spMm / 2; const usable = Math.max(lenMm - 2 * tip, spMm);
    let n = Math.max(3, Math.round(usable / spMm) + 1); if (n % 2 === 0) n += 1;
    const step = usable / (n - 1); const pos = []; for (let i = 0; i < n; i++) pos.push(-usable / 2 + i * step);
    const order = []; const q = [[0, n - 1]];
    while (q.length) { const [lo, hi] = q.shift(); if (lo > hi) continue; const mid = (lo + hi) >> 1; order.push(mid); q.push([lo, mid - 1], [mid + 1, hi]); }
    const rank = new Array(n); order.forEach((idx, k) => rank[idx] = k + 1);
    return { n, step, pos, rank };
  }

  function halfExtents(mask, W, H, c, f, uVal, vmax, pxStep = 0.5) {
    let vlo = null, vhi = null;
    for (let v = -vmax; v <= vmax; v += pxStep) {
      const p = fromUV([uVal, v], c, f), x = Math.round(p[0]), y = Math.round(p[1]);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      if (mask[y * W + x]) { if (vlo === null) vlo = v; vhi = v; }
    }
    return vlo === null ? null : [vlo, vhi];
  }

  const poly2area = (p) => Math.abs(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2);

  /* ---------- rekomendasi teknik ---------- */
  function recommend(c) {
    const why = []; const Z = ZONE[c.zone] || ZONE.umum;
    const maxC = c.laxMm || Z.maxClose;
    if (c.infected || !c.bedReady) { why.push('Dasar luka belum siap (infeksi, nekrosis, atau slough dominan): debridemen dan kendali infeksi dulu; rekonstruksi definitif ditunda.'); return { tech: 'debridemen', why }; }
    if (c.onkologi) { why.push('Lesi curiga keganasan: eksisi dengan margin sesuai histologi; rekonstruksi setelah margin bebas dikonfirmasi.'); }
    if (c.depth === 'partial' && !c.onkologi) {
      if (c.areaCm2 <= 4) { why.push('Cedera parsial kecil (≤ 4 cm²): sembuh sekunder dengan dressing lembap.'); return { tech: 'sekunder', why }; }
      why.push('Cedera parsial luas: STSG tipis bila tidak epitelisasi dalam 2 sampai 3 minggu.'); return { tech: 'stsg', why };
    }
    if (c.exposed && c.exposed.length) {
      why.push('Struktur penting terpapar (' + c.exposed.join(', ') + '): perlu jaringan berpembuluh sendiri, bukan cangkok langsung.');
      if (c.areaCm2 <= 12 && ['umum', 'estetik', 'tekanan', 'fungsional'].includes(c.zone)) { why.push('Defek ≤ 12 cm²: flap lokal.'); return { tech: c.aspect < 2 ? 'vy' : 'adv', why }; }
      why.push('Defek luas atau zona sulit: flap regional atau bebas (perencanaan lanjut dengan pencitraan perforator).'); return { tech: 'flapbesar', why };
    }
    if (c.zone === 'tekanan') { why.push('Zona tekanan, ketebalan penuh: flap otot/fasiokutan (V–Y) setelah optimasi nutrisi dan penurunan tekanan.'); return { tech: 'vy', why }; }
    const w = c.wMm, ratio = c.ratio || 4;
    if (c.aspect >= ratio && w <= Math.min(maxC, 12)) { why.push(`Luka linear (rasio P:L ${c.aspect.toFixed(1)}:1): tutup langsung berlapis sepanjang sumbu panjang.`); return { tech: 'linear', why }; }
    if (w <= maxC) { why.push(`Lebar defek ${w.toFixed(1)} mm ≤ ambang tutup primer zona (${maxC} mm, heuristik): eksisi fusiform ${ratio}:1 lalu tutup berlapis.`); return { tech: 'fusiform', why }; }
    if ((c.zone === 'estetik' || c.zone === 'fungsional') && c.areaCm2 <= 20) { why.push('Terlalu lebar untuk tutup primer di zona estetik/fungsional: FTSG (kontraksi kurang, warna lebih baik) atau flap lokal.'); return { tech: 'ftsg', why }; }
    why.push(`Lebar ${w.toFixed(1)} mm melebihi ambang tutup primer (${maxC} mm): STSG pada dasar granulasi atau flap lokal bila fungsi/estetik penting.`); return { tech: 'stsg', why };
  }

  /* ---------- pembangun rencana ---------- */
  function build(tech, g, o) {
    // g: {poly, mask, W, H, cm (cm/px), centroid, theta0, zone, areaPx, hull, shape, marginPoly(fn mm)->poly[]}
    const cm = g.cm, mm = (px) => px * cm * 10, px = (m) => m / (cm * 10);
    const Z = ZONE[g.zone] || ZONE.umum; const th = o.theta != null ? o.theta : g.theta0; const fr = frame(th); const c = g.centroid;
    const items = [], nums = [], steps = [], notes = [];
    const sp = o.spacing || Z.sp, bite = o.bite || Z.bite, ratio = o.ratio || 4, apex = 30;
    const region = (o.marginMm > 0 ? g.marginPoly(o.marginMm) : g.poly) || g.poly;
    const pts = region.filter((_, i) => i % Math.max(1, Math.floor(region.length / 300)) === 0);
    const uv = pts.map(p => toUV(p, c, fr));
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity; uv.forEach(q => { u0 = Math.min(u0, q[0]); u1 = Math.max(u1, q[0]); v0 = Math.min(v0, q[1]); v1 = Math.max(v1, q[1]); });
    const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, c2 = fromUV([cu, cv], c, fr);
    const rel = uv.map(q => [q[0] - cu, q[1] - cv]);
    const lMm = mm(u1 - u0), wMm = mm(v1 - v0);
    const N = (k, v, u, tol) => nums.push({ k, v, u: u || '', tol: tol || '' });
    const line = (a, b, style, lw) => items.push({ t: 'line', a, b, s: style, w: lw });
    const poly = (p, style, fill) => items.push({ t: 'poly', p, s: style, fill });
    const label = (p, text, style) => items.push({ t: 'label', p, text, s: style });
    const dot = (p, style, text) => items.push({ t: 'dot', p, s: style, text });
    const arrow = (a, b, style) => items.push({ t: 'arrow', a, b, s: style });
    N('Defek (panjang × lebar)', `${lMm.toFixed(1)} × ${wMm.toFixed(1)}`, 'mm');
    if (o.marginMm > 0) N('Margin eksisi', o.marginMm.toFixed(1), 'mm');
    let after = { kind: 'none' }; let title = TECHS.find(t => t.id === tech).label; const meta = {};

    if (tech === 'linear' || tech === 'fusiform') {
      let aSemi, bSemi, pr, outline;
      if (tech === 'fusiform') {
        const e = enclose(rel, ratio, apex); aSemi = e.a; bSemi = e.b; pr = e.pr; outline = outlineFusiform(aSemi, bSemi, pr, c2, fr);
        poly(outline, 'incise', 'excise');
        N('Elips eksisi (panjang × lebar)', `${mm(2 * aSemi).toFixed(1)} × ${mm(2 * bSemi).toFixed(1)}`, 'mm');
        N('Rasio panjang : lebar', (aSemi / bSemi).toFixed(2) + ' : 1'); N('Sudut apeks', apex + '°');
        const exArea = 4 * aSemi * bSemi * pr.areaNorm; N('Luas kulit diangkat', (exArea * cm * cm).toFixed(2), 'cm²');
        N('Kulit sehat ikut terangkat', Math.max(0, (exArea - g.areaPx) * cm * cm).toFixed(2), 'cm²');
      } else { aSemi = (u1 - u0) / 2 + px(1.5); bSemi = (v1 - v0) / 2; outline = null; N('Panjang garis tutup', mm(2 * aSemi).toFixed(1), 'mm'); }
      const L = mm(2 * aSemi); const S = sutureLayout(L, sp);
      line(fromUV([-aSemi, 0], c2, fr), fromUV([aSemi, 0], c2, fr), 'closure', 1.6);
      S.pos.forEach((pm, i) => {
        const uPx = px(pm); const he = tech === 'fusiform' ? (() => { const x = (aSemi - Math.abs(uPx)) / aSemi; return [-bSemi * pr.g(x), bSemi * pr.g(x)]; })() : (halfExtents(g.mask, g.W, g.H, c2, fr, uPx, bSemi * 2 + 5) || [-bSemi, bSemi]);
        const pA = fromUV([uPx, he[0] - px(bite)], c2, fr), pB = fromUV([uPx, he[1] + px(bite)], c2, fr);
        line(pA, pB, 'stitch', 1.1); dot(pA, 'stitchdot'); dot(pB, 'stitchdot'); label(pB, String(S.rank[i]), 'num');
      });
      N('Jahitan simpul (jumlah)', String(S.n), 'buah'); N('Jarak antar jahitan', S.step.toFixed(1), 'mm'); N('Jarak tusuk dari tepi', bite.toFixed(1), 'mm');
      N('Benang', Z.thread); N('Lepas jahitan', Z.remove);
      const ok = (tech === 'fusiform' ? mm(2 * bSemi) : wMm) <= (o.laxMm || Z.maxClose);
      N('Tegangan penutupan (heuristik)', ok ? 'dapat tutup primer' : 'kemungkinan tegang: undermining luas atau flap', '', ok ? '' : 'perhatian');
      steps.push(tech === 'fusiform' ? 'Tandai elips (garis ungu) searah RSTL; hatch = kulit yang diangkat.' : 'Tandai garis tutup sepanjang sumbu luka.',
        'Anestesi infiltrasi; insisi tegak lurus kulit; eksisi hingga lemak atau fasia sesuai kedalaman.', 'Undermining sedalam bidang subdermal selebar kira-kira setengah sampai satu lebar defek pada tiap sisi.',
        `Jahit dermis dalam (${Z.thread.split('+')[1] ? Z.thread.split('+')[1].trim() : 'absorbable'}), lalu kulit ${S.n} simpul, urutan angka 1 sampai ${S.n} (aturan separuh).`, `Lepas jahitan ${Z.remove}.`);
      if (tech === 'fusiform') notes.push('Bila sudut apeks > 30° terbentuk standing cone (dog-ear): perpanjang ujung atau eksisi segitiga Burow.');
      after = { kind: 'closure', region: tech === 'fusiform' ? outline : g.poly, a: fromUV([-aSemi, 0], c2, fr), b: fromUV([aSemi, 0], c2, fr), n: S.n };
      g.__ellipseUsed = tech === 'fusiform';
    }
    else if (tech === 'adv' || tech === 'vy') {
      const dir = o.flipDir ? -1 : 1; const edge = dir > 0 ? u1 : u0; const wPx = v1 - v0; const k = o.flapK || 3;
      poly(region, 'excise', 'excise'); poly(region, 'incise');
      poly([fromUV([u0, v0], c, fr), fromUV([u1, v0], c, fr), fromUV([u1, v1], c, fr), fromUV([u0, v1], c, fr)], 'margin');
      line(fromUV([edge, v0], c, fr), fromUV([edge, v1], c, fr), 'flaptip', 1.6);
      if (tech === 'adv') {
        const Lf = k * wPx; const A1 = fromUV([edge, v0], c, fr), A2 = fromUV([edge + dir * Lf, v0], c, fr), B1 = fromUV([edge, v1], c, fr), B2 = fromUV([edge + dir * Lf, v1], c, fr);
        line(A1, A2, 'incise', 2); line(B1, B2, 'incise', 2); line(A2, B2, 'flaptip', 1.6);
        arrow(fromUV([edge + dir * Lf * 0.7, cv], c, fr), fromUV([edge - dir * (u1 - u0) * 0.35, cv], c, fr), 'arrow');
        N('Flap advancement (lebar × panjang)', `${mm(wPx).toFixed(1)} × ${mm(Lf).toFixed(1)}`, 'mm'); N('Rasio panjang : lebar flap', k.toFixed(1) + ' : 1');
        N('Jarak maju yang dibutuhkan', mm(u1 - u0).toFixed(1), 'mm'); N('Total garis insisi flap', mm(2 * Lf + wPx).toFixed(1), 'mm');
        const S = sutureLayout(mm(Lf), sp); N('Jahitan sisi flap (perkiraan)', String(2 * S.n), 'buah');
        steps.push('Tandai defek (hatch) dan dua garis sejajar sumbu flap dari sudut defek.', 'Insisi sisi flap hingga fasia; angkat flap dengan pedikel pada dasar berpembuluh.', 'Undermining dan maju flap ke defek tanpa tegangan; eksisi segitiga Burow bila ada standing cone di dasar.', 'Jahit dermis lalu kulit; drain bila ruang mati.');
        after = { kind: 'adv', region: region, lines: [[A1, A2], [B1, B2], [A2, B2]], edge: [fromUV([edge, v0], c, fr), fromUV([edge, v1], c, fr)] };
      } else {
        const Dv = 2.5 * wPx; const apexPt = fromUV([edge + dir * Dv, cv], c, fr); const B1 = fromUV([edge, v0], c, fr), B2 = fromUV([edge, v1], c, fr);
        line(B1, apexPt, 'incise', 2); line(B2, apexPt, 'incise', 2);
        arrow(fromUV([edge + dir * Dv * 0.55, cv], c, fr), fromUV([edge - dir * (u1 - u0) * 0.35, cv], c, fr), 'arrow');
        const ang = 2 * Math.atan((wPx / 2) / Dv) * 180 / Math.PI;
        N('Flap V–Y (basis × tinggi)', `${mm(wPx).toFixed(1)} × ${mm(Dv).toFixed(1)}`, 'mm'); N('Sudut apeks V', ang.toFixed(1) + '°'); N('Panjang garis Y setelah tutup', mm(Dv).toFixed(1), 'mm');
        const S = sutureLayout(mm(Dv), sp); N('Jahitan (perkiraan)', String(2 * S.n + 3), 'buah');
        steps.push('Tandai defek (hatch) dan segitiga V dengan basis pada tepi defek.', 'Insisi sisi V hingga fasia; pertahankan dasar subkutan/otot (pasokan perforator), jangan melepas dasar.', 'Majukan pulau ke defek; tutup donor sebagai garis Y (V menjadi Y).', 'Jahit dermis lalu kulit.');
        after = { kind: 'vy', region: region, lines: [[B1, apexPt], [B2, apexPt]], edge: [B1, B2], apex: apexPt };
      }
      notes.push('Perkiraan dari 2D: periksa laksitas jaringan donor dan arah perforator sebelum menandai di pasien.');
      if (mm(wPx) > 60 || g.areaPx * cm * cm > 36) { N('Peringatan', 'defek di luar kisaran flap lokal', '', 'perhatian'); notes.push('Peringatan: lebar > 60 mm atau luas > 36 cm². Pertimbangkan flap regional/bebas atau cangkok kulit; marking ini hanya ilustrasi geometri.'); }
    }
    else if (tech === 'z') {
      const A = g.shape.feretA, B = g.shape.feretB; const lenPx = Math.hypot(B[0] - A[0], B[1] - A[1]); const al = rad(o.zAngle || 60);
      const dx = (B[0] - A[0]) / lenPx, dy = (B[1] - A[1]) / lenPx; const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
      const r1 = rot(dx, dy, al), A2 = [A[0] + r1[0] * lenPx, A[1] + r1[1] * lenPx], B2 = [B[0] - r1[0] * lenPx, B[1] - r1[1] * lenPx];
      line(A, B, 'incise', 2); line(A, A2, 'incise', 2); line(B, B2, 'incise', 2);
      label(A2, 'A′', 'num'); label(B2, 'B′', 'num'); label(A, 'A', 'num'); label(B, 'B', 'num');
      const gain = { 30: 25, 45: 50, 60: 75, 75: 100, 90: 120 }[Math.round(o.zAngle || 60)] || 75;
      N('Tungkai pusat (AB)', mm(lenPx).toFixed(1), 'mm'); N('Tungkai lateral (AA′, BB′)', mm(lenPx).toFixed(1), 'mm'); N('Sudut Z', String(o.zAngle || 60), '°');
      N('Pemanjangan teoretis', gain + ' %', ''); N('Panjang baru sepanjang sumbu', (mm(lenPx) * (1 + gain / 100)).toFixed(1), 'mm');
      steps.push('Gambar tungkai pusat sepanjang parut/kontraktur (AB), lalu dua tungkai lateral sama panjang pada sudut yang sama.', 'Insisi ketiga tungkai; angkat dua flap segitiga dengan pedikel berpembuluh.', 'Transposisi kedua flap (A′ ke B-sisi, B′ ke A-sisi); jahit.');
      notes.push('Z-plasti untuk parut atau kontraktur yang sudah matang; bukan untuk luka akut terbuka.');
      after = { kind: 'z', lines: [[A, B], [A, A2], [B, B2]], A, B };
    }
    else if (tech === 'stsg' || tech === 'ftsg') {
      const gm = tech === 'stsg' ? 1.5 : 1; const tpl = g.marginPoly(tech === 'stsg' ? 1 : 0.5) || g.poly;
      poly(tpl, 'graft', 'graft'); poly(g.poly, 'incise');
      const A = poly2area(tpl) * cm * cm; meta.templateA = A; N('Luas defek (cangkok) termasuk tepi', A.toFixed(2), 'cm²');
      if (tech === 'stsg') {
        const mesh = o.mesh || 1.5; meta.donorA = A / mesh; N('Rasio mesh', '1 : ' + mesh); N('Luas donor dibutuhkan', (A / mesh).toFixed(2), 'cm²'); N('Ketebalan cangkok', '0,20–0,30', 'mm (8–12/1000 inci)');
        const side = Math.sqrt(A / mesh); N('Donor kasar (persegi setara)', side.toFixed(1) + ' × ' + side.toFixed(1), 'cm');
        steps.push('Persiapan dasar: granulasi sehat, tanpa slough/infeksi; hemostasis.', `Ambil STSG dengan dermatom (paha lateral), mesh 1:${mesh}; fiksasi dengan staples/jahitan; NPWT atau bolster 5 sampai 7 hari.`, 'Donor: dressing oklusif/alginat 10 sampai 14 hari.');
        after = { kind: 'stsg', region: tpl, mesh: mesh };
      } else {
        const donorA = A * 1.1; const pr = profile(3, 30); const b = Math.sqrt(donorA / (4 * 3 * pr.areaNorm)); const a = 3 * b; meta.donorA = donorA; meta.donorL = 2 * a; meta.donorW = 2 * b;
        N('Luas donor FTSG (+10%)', donorA.toFixed(2), 'cm²'); N('Donor elips (panjang × lebar)', (2 * a).toFixed(1) + ' × ' + (2 * b).toFixed(1), 'cm'); N('Lokasi donor', 'supraklavikula / pre-aurikular / lipat paha');
        steps.push('Buat templat defek; harvest elips FTSG dengan rasio 3:1 dan tutup donor primer.', 'Defatting, jahit tepi, bolster tie-over 5 sampai 7 hari.');
        after = { kind: 'ftsg', region: tpl };
      }
      notes.push('Cangkok hanya pada dasar berpembuluh; tidak di atas tulang tanpa periosteum atau tendon tanpa paratenon.');
    }
    else if (tech === 'debridemen') {
      const m2 = g.marginPoly(2) || g.poly; poly(m2, 'incise', 'excise'); poly(g.poly, 'margin');
      N('Area debridemen termasuk tepi 2 mm', (poly2area(m2) * cm * cm).toFixed(2), 'cm²');
      steps.push('Debridemen tajam jaringan nekrotik/slough hingga jaringan berdarah; irigasi.', 'Kultur jaringan; NPWT atau dressing sesuai eksudat; ulang debridemen serial bila perlu.', 'Rencanakan rekonstruksi setelah dasar bersih.');
      after = { kind: 'bed', region: m2 };
    }
    else if (tech === 'sekunder') {
      poly(g.poly, 'margin'); N('Luas', (g.areaPx * cm * cm).toFixed(2), 'cm²');
      steps.push('Dressing lembap non-adheren; kontrol berkala dan pantau area setiap kunjungan.'); after = { kind: 'secondary', region: g.poly };
    }
    else if (tech === 'flapbesar') {
      const m2 = g.marginPoly(2) || g.poly; poly(m2, 'incise', 'excise');
      N('Area defek termasuk tepi 2 mm', (poly2area(m2) * cm * cm).toFixed(2), 'cm²');
      steps.push('Debridemen hingga jaringan viabel; NPWT sebagai jembatan.', 'CT angiografi/Doppler perforator; pilih flap (perforator lokal, otot, atau bebas) sesuai regio dan ukuran.', 'Rencanakan bersama tim mikrovaskular bila flap bebas.');
      after = { kind: 'bed', region: m2 };
    }
    return { tech, title, items, nums, steps, notes, after, meta, frame: { th, c: c2 }, dims: { lMm, wMm }, zone: g.zone, spacing: sp };
  }

  return { TECHS, ZONE, recommend, build, sutureLayout, profile, enclose, frame, toUV, fromUV };
})();
