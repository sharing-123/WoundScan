/* Formulir klinis + mesin rekomendasi. Membaca KB (knowledge.js) dan ukuran dari foto. */
window.CLIN = (() => {
  const $ = (id) => document.getElementById(id);
  const fmt = (n, d = 2) => (isFinite(n) ? n.toFixed(d) : '–').replace('.', ',');
  const fmtT = (n) => fmt(n, n < 1 ? 3 : 2);
  const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  const FLAGS = [
    ['eri', 'Eritema > 2 cm / selulitis'], ['pus', 'Pus / eksudat berbau'], ['sirs', 'Demam / SIRS / toksik'],
    ['nsti', 'Nyeri tak sebanding, bula hemoragik, krepitasi'], ['dm', 'Diabetes melitus'], ['imun', 'Imunokompromais / steroid'],
    ['pad', 'Nadi pedis lemah/hilang, kaki dingin'], ['stasis', 'Edema, varises, hemosiderin'], ['kotor', 'Kontaminasi tanah/kotoran'],
    ['telat', 'Lebih dari 12 jam sejak cedera'], ['defisit', 'Defisit neurovaskular distal'], ['benda', 'Benda asing / tertancap'],
    ['perdarahan', 'Perdarahan aktif'], ['curiga', 'Tidak sembuh > 4 minggu / tepi menggulung / rapuh'], ['marjolin', 'Di atas parut lama / luka kronik puluhan tahun'],
    ['tulangp', 'Probe-to-bone positif / tulang teraba'], ['radiasi', 'Riwayat radiasi di area luka'], ['perokok', 'Perokok aktif'],
  ];

  function init(onChange) {
    $('f-type').innerHTML = ['Akut', 'Subakut', 'Kronik'].map(g => `<optgroup label="${g}">${KB.TYPES.filter(t => t.group === g).map(t => `<option value="${t.id}">${t.label}</option>`).join('')}</optgroup>`).join('');
    $('f-region').innerHTML = KB.REGIONS.map(r => `<option value="${r.id}">${r.label}</option>`).join('');
    $('f-exposed').innerHTML = KB.STRUCT.map(s => `<label><input type="checkbox" data-ex="${s.id}"> ${s.label}</label>`).join('');
    $('f-flags').innerHTML = FLAGS.map(f => `<label><input type="checkbox" data-fl="${f[0]}"> ${f[1]}</label>`).join('');
    const upd = () => {
      const h = +$('f-h').value, w = +$('f-w').value;
      $('f-bsa').textContent = h > 0 && w > 0 ? fmt(KB.bsaMosteller(h, w), 3) : '–';
      const cd = +$('f-curve').value;
      $('f-curvev').textContent = cd ? `${cd}° (×${fmt(curveFactor(cd), 3)})` : '0° (datar)';
      $('fs-burn').hidden = $('f-type').value !== 'bakar';
      onChange();
    };
    $('clinForm').addEventListener('input', upd); $('clinForm').addEventListener('change', upd);
    upd();
  }

  /* faktor koreksi proyeksi untuk permukaan silindris: (θ/2)/sin(θ/2) */
  const curveFactor = (deg) => { if (!deg) return 1; const t = deg * Math.PI / 180; return (t / 2) / Math.sin(t / 2); };

  function read() {
    const g = (id) => $(id).value; const n = (id) => { const v = parseFloat($(id).value); return isFinite(v) ? v : null; };
    const exposed = [...document.querySelectorAll('[data-ex]')].filter(e => e.checked).map(e => e.dataset.ex);
    const flags = {}; document.querySelectorAll('[data-fl]').forEach(e => flags[e.dataset.fl] = e.checked);
    const h = n('f-h'), w = n('f-w');
    return { age: n('f-age'), h, w, bsa: h && w ? KB.bsaMosteller(h, w) : null, type: g('f-type'), region: g('f-region'), depth: g('f-depth'),
      ageD: n('f-age-d'), curveDeg: +g('f-curve'), exposed, flags, mech: g('f-mech'), hours: n('f-hours') || 0,
      inhal: $('f-inhal').checked, circ: $('f-circ').checked, special: $('f-special').checked,
      tetDose: +g('f-tet'), tetYears: n('f-tety') || 0 };
  }

  const li = (a) => a && a.length ? `<ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  const card = (cls, h, body) => `<div class="card ${cls || ''}"><h4>${h}</h4>${body}</div>`;

  /* ctx: { areaCm2, areaLo, areaHi, perimCm, lenCm, widCm, htLen, htWid, cal, tissue, tbsaBasket }  */
  function recommend(ctx, f) {
    const P = KB.P[f.type]; if (!P) return '';
    const out = []; const T = KB.TYPES.find(t => t.id === f.type);
    const area = ctx.areaCm2 ? ctx.areaCm2 * curveFactor(f.curveDeg) : null;
    const tb = area && f.bsa ? KB.tbsa(area, f.bsa) : null;

    /* ---- peringatan merah ---- */
    const alerts = [];
    if (f.flags.nsti) alerts.push('Curiga infeksi jaringan lunak nekrotikans: debridemen darurat, antibiotik spektrum luas (piperasilin-tazobaktam/karbapenem + vankomisin/linezolid + klindamisin). Jangan menunda untuk pencitraan.');
    if (f.flags.sirs && (f.flags.eri || f.flags.pus)) alerts.push('Infeksi dengan tanda sistemik: ambil kultur darah dan jaringan, mulai antibiotik IV, kontrol sumber infeksi.');
    if (f.flags.defisit) alerts.push('Defisit neurovaskular distal: eksplorasi dan konsultasi bedah segera.');
    if (f.flags.perdarahan) alerts.push('Perdarahan aktif: tekanan langsung, torniket bila ekstremitas dan tidak terkontrol, akses IV.');
    if (f.type === 'bakar') {
      if (f.inhal) alerts.push('Kecurigaan cedera inhalasi: amankan jalan napas dini (intubasi bila stridor, suara serak progresif, edema orofaring), oksigen 100 persen, evaluasi COHb.');
      if (f.circ) alerts.push('Luka bakar sirkumferensial: pantau perfusi distal/ventilasi, siap eskarotomi.');
      if (f.mech === 'listrik') alerts.push('Listrik: EKG, CK/mioglobin, cairan 4 mL/kg/%TBSA bila ada rabdomiolisis, evaluasi kompartemen.');
      if (f.mech === 'kimia') alerts.push('Kimia: lepas pakaian, irigasi air mengalir ≥ 30 menit, identifikasi zat.');
    }
    if (f.type === 'arteri' || f.flags.pad) alerts.push('Tanda iskemia: jangan kompresi; rujukan vaskular segera (tekanan jari < 30 mmHg atau TcPO2 < 25 mmHg = urgensi tinggi).');
    if (f.type === 'dfu' && (f.flags.tulangp || f.flags.sirs)) alerts.push('Ulkus kaki diabetik dengan kecurigaan osteomielitis atau infeksi berat: rawat, rontgen, MRI bila perlu, debridemen/ drainase, antibiotik IV.');
    if (f.flags.marjolin || f.flags.curiga) alerts.push('Kecurigaan keganasan: biopsi sebelum rekonstruksi definitif; jangan menunda pada luka tidak sembuh atau di atas parut lama.');
    if (ctx.tissue && ctx.tissue.pct.nekro >= 30) alerts.push(`Nekrotik ${fmt(ctx.tissue.pct.nekro, 0)} persen dasar luka (estimasi warna): evaluasi perfusi dan debridemen.`);
    if (alerts.length) out.push(card('alert', 'Peringatan', li(alerts)));

    /* ---- ringkasan terukur ---- */
    const sum = [];
    if (area) {
      sum.push(`Luas <span class="num"><b>${fmt(area, 2)} cm²</b></span>${ctx.areaLo ? ` (rentang ${fmt(ctx.areaLo * curveFactor(f.curveDeg), 2)} sampai ${fmt(ctx.areaHi * curveFactor(f.curveDeg), 2)})` : ''}${tb != null ? `, <b class="num">${fmtT(tb)} persen TBSA</b> (BSA ${fmt(f.bsa, 3)} m²)` : ''}`);
      if (ctx.lenCm) sum.push(`Kotak minimum <span class="num">${fmt(ctx.lenCm, 2)} × ${fmt(ctx.widCm, 2)} cm</span>; kepala–kaki <span class="num">${fmt(ctx.htLen, 2)} × ${fmt(ctx.htWid, 2)} cm</span>; keliling ${fmt(ctx.perimCm, 2)} cm`);
    } else sum.push('Belum terkalibrasi: ukuran absolut belum tersedia. Atur skala di tab Ukur.');
    if (ctx.tissue) { const p = ctx.tissue.pct; sum.push(`Dasar (estimasi warna): granulasi ${fmt(p.gran, 0)} persen, slough ${fmt(p.slough, 0)} persen, nekrotik ${fmt(p.nekro, 0)} persen, epitel/pucat ${fmt(p.epi, 0)} persen`); }
    out.push(card('', `Ringkasan terukur: ${esc(T.label)}`, `<ul>${sum.map(x => `<li>${x}</li>`).join('')}</ul>`));

    /* ---- luka bakar: TBSA total dan cairan ---- */
    if (f.type === 'bakar') {
      const total = ctx.tbsaBasket != null ? ctx.tbsaBasket : tb;
      const lines = [];
      if (total != null) lines.push(`%TBSA terukur (parsial + tebal penuh): <b class="num">${fmtT(total)} persen</b>${ctx.tbsaBasket != null ? ' (jumlah keranjang)' : ' (foto ini)'}`);
      const anak = f.age != null && f.age <= 14;
      const thr = anak ? 10 : 20;
      if (total != null && f.w) {
        if (total >= thr) {
          const r = KB.fluidParkland(f.w, total, anak, f.mech === 'listrik');
          lines.push(`Resusitasi diindikasikan (≥ ${thr} persen). Ringer Laktat ${fmt(r.faktor, 0)} mL × ${fmt(f.w, 1)} kg × ${fmt(total, 2)} = <b class="num">${fmt(r.total24, 0)} mL per 24 jam</b>`);
          lines.push(`8 jam pertama sejak kejadian: ${fmt(r.jam8, 0)} mL (<b class="num">${fmt(r.perJam8, 0)} mL/jam</b>); 16 jam berikutnya: ${fmt(r.jam8, 0)} mL (${fmt(r.perJam16, 0)} mL/jam). Hitung dari waktu kejadian, bukan dari waktu tiba.`);
          lines.push(`Pembanding Parkland klasik 4 mL: ${fmt(r.parkland4, 0)} mL per 24 jam. Titrasi ke diuresis ${anak && f.w <= 30 ? '1 mL/kg/jam' : '0,5 mL/kg/jam'} (≈ ${fmt((anak && f.w <= 30 ? 1 : 0.5) * f.w, 0)} mL/jam).`);
          if (f.hours > 0) lines.push(`Sudah ${fmt(f.hours, 1)} jam sejak kejadian: kejar sisa volume dalam sisa jendela 8 jam pertama.`);
        } else lines.push(`Di bawah ambang resusitasi cairan (${thr} persen). Hidrasi oral/IV pemeliharaan sesuai kebutuhan, pantau diuresis.`);
      } else if (!f.w) lines.push('Isi berat badan untuk menghitung cairan.');
      const refer = [];
      if (total != null && total > 10) refer.push('parsial > 10 persen TBSA');
      if (f.depth === 'full') refer.push('ada tebal penuh');
      if (f.special) refer.push('wajah/tangan/kaki/genital/sendi besar'); if (f.inhal) refer.push('inhalasi'); if (f.mech !== 'termal') refer.push(f.mech);
      if (f.circ) refer.push('sirkumferensial');
      if (refer.length) lines.push(`<b>Kriteria rujuk ke pusat luka bakar (ABA) terpenuhi:</b> ${refer.join(', ')}`);
      out.push(card('warn', 'Luka bakar: luas dan cairan', `<ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul><div class="src">ATLS 10 (2 mL dewasa, 3 mL anak, 4 mL listrik); ABA. %TBSA = luas cm² / (BSA × 10.000) × 100, hanya parsial dan tebal penuh.</div>`));
    }

    /* ---- IGD segera ---- */
    out.push(card('', 'Segera di IGD', li(P.segera)));
    if (P.resusitasi && f.type !== 'bakar') out.push(card('', 'Cairan', `<p>${esc(P.resusitasi)}</p>`));
    out.push(card('', 'Penilaian yang perlu', li(P.nilai)));

    /* ---- dressing dari jaringan ---- */
    if (ctx.tissue && !['laserasi', 'tusuk'].includes(f.type)) {
      const d = KB.dressing({ gran: ctx.tissue.pct.gran, slough: ctx.tissue.pct.slough, nekro: ctx.tissue.pct.nekro, epi: ctx.tissue.pct.epi });
      out.push(card('', 'Dressing sesuai dasar luka (TIME)', li(d) + `<p class="src">${esc(Object.values(KB.TIME).join(' | '))}</p>`));
    }
    out.push(card('', 'Tata laksana definitif', li(P.definitif)));

    /* ---- antibiotik dan tetanus ---- */
    const abx = [P.antibiotik];
    if (['laserasi', 'abrasi', 'tusuk', 'gigitan', 'avulsi', 'bakar'].includes(f.type)) {
      const bersih = ['laserasi', 'abrasi'].includes(f.type) && !f.flags.kotor && !f.flags.telat && !f.flags.benda;
      abx.push('Tetanus: ' + KB.tetanus(f.tetDose, f.tetYears, bersih) + (bersih ? ' (luka bersih minor)' : ' (luka berisiko tinggi)'));
    } else abx.push('Pastikan status tetanus pasien terdokumentasi.');
    out.push(card('', 'Antibiotik dan tetanus', li(abx)));

    /* ---- rekonstruksi ---- */
    const rk = KB.rekonstruksi({ areaCm2: area || 0, region: f.region, depth: f.type === 'bakar' ? f.depth : (f.depth), exposed: f.exposed,
      bedReady: !(f.flags.pus || f.flags.eri) && !(ctx.tissue && (ctx.tissue.pct.nekro >= 20 || ctx.tissue.pct.slough >= 40)),
      infected: !!(f.flags.pus || f.flags.eri || f.flags.sirs), onkologi: f.type === 'curiga' || f.flags.marjolin });
    const rb = [`${esc(P.rekonstruksi)}`];
    out.push(card('plastic', 'Rekonstruksi bedah plastik', `<p>${rb[0]}</p>` + (rk.lines.length ? li(rk.lines) : '') + (rk.rungs.length ? `<p class="sm muted">Pilihan menurut luas ${area ? fmt(area, 1) + ' cm²' : '–'}, regio dan struktur terpapar:</p>` + li(rk.rungs) : '')));

    /* ---- margin untuk keganasan ---- */
    if (f.type === 'curiga' || f.flags.marjolin || f.flags.curiga) out.push(card('warn', 'Margin dan biopsi', li(KB.P.curiga.definitif)));

    /* ---- rujukan, bendera, sumber ---- */
    out.push(card('', 'Kapan rujuk', li(P.rujuk)));
    out.push(card('', 'Tanda bahaya', li(P.bendera)));
    out.push(`<div class="src">Sumber: ${esc(P.sumber)}. Ringkasan untuk keputusan cepat; sesuaikan dengan protokol rumah sakit dan pertimbangan klinis.</div>`);
    return out.join('');
  }

  /* teks dokumentasi singkat untuk rekam medis */
  function note(ctx, f) {
    const T = KB.TYPES.find(t => t.id === f.type); const R = KB.REGIONS.find(r => r.id === f.region);
    const area = ctx.areaCm2 ? ctx.areaCm2 * curveFactor(f.curveDeg) : null;
    const tb = area && f.bsa ? KB.tbsa(area, f.bsa) : null;
    const L = [];
    L.push(`Luka: ${T.label}, regio ${R ? R.label.toLowerCase() : '-'}.`);
    if (area) L.push(`Ukuran (foto terkalibrasi, ${ctx.cal}): ${fmt(ctx.lenCm, 1)} × ${fmt(ctx.widCm, 1)} cm, luas ${fmt(area, 2)} cm²${tb != null ? ` (${fmtT(tb)}% TBSA)` : ''}, keliling ${fmt(ctx.perimCm, 1)} cm.`);
    else L.push('Ukuran absolut belum terkalibrasi.');
    if (ctx.tissue) { const p = ctx.tissue.pct; L.push(`Dasar luka (estimasi warna): granulasi ${fmt(p.gran, 0)}%, slough ${fmt(p.slough, 0)}%, nekrotik ${fmt(p.nekro, 0)}%, epitel ${fmt(p.epi, 0)}%.`); }
    const fl = FLAGS.filter(x => f.flags[x[0]]).map(x => x[1].toLowerCase()); if (fl.length) L.push('Temuan: ' + fl.join('; ') + '.');
    if (f.exposed.length) L.push('Struktur terpapar: ' + f.exposed.map(e => KB.STRUCT.find(s => s.id === e).label.toLowerCase()).join('; ') + '.');
    return L.join('\n');
  }

  return { init, read, recommend, note, curveFactor, fmt, FLAGS };
})();
