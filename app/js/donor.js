/* Keputusan graft vs flap dan pemilihan donor dengan angka.
   Luas donor tersedia dihitung dari BSA pasien x fraksi regio (Lund-Browder dewasa) x fraksi dapat-dipakai.
   Dimensi flap/donor adalah kisaran literatur umum (ringkasan teks bedah plastik); angka bersifat panduan dan
   WAJIB dikonfirmasi pada pasien (laksitas, perforator via Doppler/CTA, riwayat bedah/radiasi). */
window.DONOR = (() => {
  const LB = { thigh: 9.5, leg: 7, foot: 3.5, arm: 4, forearm: 3, hand: 2.5, trunkA: 13, trunkP: 13, buttock: 2.5, scalp: 3.5 };
  const area = (bsa, pct, usable) => bsa * 1e4 * pct / 100 * usable;           // cm²

  /* ---------- donor STSG ---------- */
  const STSG = [
    { id: 'thigh_al',   label: 'Paha anterolateral', pct: LB.thigh, use: 0.45, rank: 10, maxW: 10, limb: 'tungkai', hidden: true,  note: 'donor standar; permukaan rata, tersembunyi pakaian' },
    { id: 'thigh_post', label: 'Paha posterior',     pct: LB.thigh, use: 0.25, rank: 6,  maxW: 10, limb: 'tungkai', hidden: true,  note: 'sulit dirawat (duduk), nyeri saat duduk' },
    { id: 'buttock',    label: 'Glutea',             pct: LB.buttock, use: 0.8, rank: 8, maxW: 10, limb: null,      hidden: true,  note: 'bekas tersembunyi; hindari pada pasien dekubitus' },
    { id: 'back',       label: 'Punggung',           pct: LB.trunkP, use: 0.5, rank: 7, maxW: 10, limb: null,      hidden: true,  note: 'luas besar; posisi pasien telungkup/miring' },
    { id: 'abdomen',    label: 'Abdomen',            pct: LB.trunkA, use: 0.35, rank: 6, maxW: 10, limb: null,     hidden: true,  note: 'dapat dipakai bila donor lain terbatas' },
    { id: 'scalp',      label: 'Kulit kepala',       pct: LB.scalp, use: 0.7, rank: 5,  maxW: 6,  limb: null,      hidden: true,  note: 'sembuh cepat, dapat dipanen ulang; rambut tumbuh di graft; pilihan pada anak dan luas besar' },
    { id: 'upper_arm',  label: 'Lengan atas',        pct: LB.arm,   use: 0.4, rank: 4,  maxW: 7,  limb: 'lengan',  hidden: false, note: 'bekas terlihat; hanya bila donor lain tidak ada' },
    { id: 'calf',       label: 'Betis',              pct: LB.leg,   use: 0.4, rank: 2,  maxW: 8,  limb: 'tungkai', hidden: false, note: 'penyembuhan donor lambat; hindari pada DM/PAD' },
  ];

  /* ---------- donor FTSG (tutup primer): lebar/panjang maksimum donor dalam cm ---------- */
  const FTSG = [
    { id: 'supraclav',    label: 'Supraklavikula',       maxW: 4,  maxL: 12, hair: false, match: ['wajah', 'leher', 'kulit-kepala'], note: 'kecocokan warna terbaik untuk wajah/leher' },
    { id: 'postaur',      label: 'Pascaaurikular',       maxW: 3,  maxL: 6,  hair: false, match: ['wajah'],            note: 'tipis; cocok hidung, kelopak, telinga' },
    { id: 'preaur',       label: 'Preaurikular',         maxW: 1.5, maxL: 5, hair: false, match: ['wajah'],            note: 'defek kecil wajah' },
    { id: 'upper_eyelid', label: 'Kelopak atas',         maxW: 1.5, maxL: 3.5, hair: false, match: ['wajah'],          note: 'untuk kelopak mata saja' },
    { id: 'groin',        label: 'Lipat paha',           maxW: 7,  maxL: 20, hair: true,  match: ['badan', 'tangan', 'sendi', 'tungkai', 'pretibia', 'lengan', 'genital', 'leher', 'tumit'], note: 'donor FTSG paling luas; berambut' },
    { id: 'medarm',       label: 'Lengan atas medial',   maxW: 5,  maxL: 15, hair: false, match: ['tangan', 'sendi', 'lengan', 'wajah'], note: 'tipis; bekas tersembunyi' },
    { id: 'hypothenar',   label: 'Hipotenar',            maxW: 2,  maxL: 5,  hair: false, match: ['tangan'],            note: 'kulit glabrous untuk telapak/jari' },
    { id: 'instep',       label: 'Instep (plantar)',     maxW: 3,  maxL: 8,  hair: false, match: ['tangan', 'tumit'],   note: 'kulit glabrous tebal untuk plantar/telapak' },
    { id: 'abdomen_f',    label: 'Abdomen bawah',       maxW: 10, maxL: 25, hair: false, match: ['badan', 'sendi', 'tungkai'], note: 'luas; bila ada abdominoplasti' },
  ];

  /* ---------- flap ---------- */
  const R = ['wajah', 'kulit-kepala', 'leher', 'badan', 'sakrum', 'tangan', 'lengan', 'sendi', 'tungkai', 'pretibia', 'tumit', 'genital'];
  const FLAPS = [
    // lokal
    { id: 'vy',        cls: 'lokal',    label: 'Flap V–Y advancement',        regions: R, maxDef: 12, note: 'basis pada tepi defek; pasokan perforator dipertahankan' },
    { id: 'adv',       cls: 'lokal',    label: 'Flap advancement',            regions: ['wajah', 'kulit-kepala', 'badan', 'lengan', 'tungkai', 'pretibia'], maxDef: 12, note: 'panjang flap 2–4× lebar' },
    { id: 'rotation',  cls: 'lokal',    label: 'Flap rotasi',                 regions: ['kulit-kepala', 'wajah', 'sakrum', 'badan'], maxDef: 40, note: 'busur 4× lebar defek; skin graft donor pada kulit kepala bila perlu' },
    { id: 'rhomboid',  cls: 'lokal',    label: 'Flap rhomboid (Limberg)',     regions: ['wajah', 'badan', 'lengan', 'tungkai'], maxDef: 9, note: 'defek rhomboid 60°/120°; 4 kemungkinan flap' },
    { id: 'bilobed',   cls: 'lokal',    label: 'Flap bilobed',                regions: ['wajah'], maxDef: 2.5, note: 'hidung distal/ujung; defek ≤ 1,5 cm' },
    { id: 'keystone',  cls: 'lokal',    label: 'Flap keystone',               regions: ['badan', 'lengan', 'tungkai', 'pretibia', 'sendi'], maxDef: 60, note: 'defek lebar ≤ sekitar 8 cm; donor tutup V–Y' },
    { id: 'propeller', cls: 'lokal',    label: 'Flap propeller perforator',   regions: ['tungkai', 'pretibia', 'tumit', 'lengan', 'badan'], maxDef: 50, needs: 'Doppler perforator', note: 'rotasi hingga 180° pada perforator; cek jalur vena' },
    // regional
    { id: 'rev_sural', thirds: ['dist'], cls: 'regional', label: 'Flap sural reverse',          regions: ['pretibia', 'tumit', 'sendi'], maxDef: 50, needs: 'nadi tibialis; hindari PAD/insufisiensi vena berat', note: 'sepertiga distal tungkai, tumit; paddle ≤ sekitar 15 × 8 cm; kongesti vena risiko' },
    { id: 'mpap',      cls: 'regional', label: 'Flap arteri plantar medial',  regions: ['tumit'], maxDef: 20, needs: 'arteri plantar medial utuh', note: 'kulit glabrous untuk tumit penahan beban' },
    { id: 'gastroc', thirds: ['prox'], cls: 'regional', label: 'Flap otot gastroknemius',     regions: ['pretibia', 'sendi'], maxDef: 100, note: 'sepertiga proksimal tungkai/lutut; ditutup STSG' },
    { id: 'soleus', thirds: ['mid'], cls: 'regional', label: 'Flap otot soleus (hemi)',     regions: ['pretibia'], maxDef: 60, note: 'sepertiga tengah tungkai' },
    { id: 'pectoralis',cls: 'regional', label: 'Flap pektoralis mayor',       regions: ['wajah', 'leher', 'badan'], maxDef: 150, note: 'kepala-leher, dada; bawa kulit atau otot' },
    { id: 'ld_ped',    cls: 'regional', label: 'Flap latissimus dorsi (pedikel)', regions: ['badan', 'lengan', 'leher'], maxDef: 300, note: 'dinding dada, aksila, punggung, bahu; paddle hingga 20 × 30 cm' },
    { id: 'tfl',       cls: 'regional', label: 'Flap TFL',                    regions: ['sakrum', 'tungkai', 'badan', 'genital'], maxDef: 150, note: 'trokanter, abdomen bawah; paddle ≤ sekitar 15 × 10 cm' },
    { id: 'gluteal',   cls: 'regional', label: 'Flap gluteal (V–Y / perforator rotasi)', regions: ['sakrum'], maxDef: 100, note: 'sakrum; perforator arteri gluteal superior/inferior' },
    { id: 'rfa_rev',   cls: 'regional', label: 'Flap radial forearm reverse', regions: ['tangan', 'lengan'], maxDef: 60, needs: 'tes Allen normal', note: 'dorsum tangan; mengorbankan arteri radialis' },
    // bebas
    { id: 'alt',       cls: 'bebas',    label: 'Flap ALT (anterolateral thigh)', regions: R, maxDef: 300, needs: 'CTA/Doppler perforator, mikrovaskular', note: 'paddle hingga 25 × 15 cm; tutup donor primer bila lebar ≤ sekitar 8 cm; pedikel 8–16 cm' },
    { id: 'gracilis',  cls: 'bebas',    label: 'Flap otot gracilis (+STSG)',  regions: ['pretibia', 'tumit', 'sendi', 'tungkai', 'genital', 'tangan'], maxDef: 100, needs: 'mikrovaskular', note: 'ruang mati/osteomielitis; otot sekitar 6 × 20 cm' },
    { id: 'ld_free',   cls: 'bebas',    label: 'Flap latissimus dorsi bebas', regions: R, maxDef: 600, needs: 'mikrovaskular', note: 'defek sangat luas, kulit kepala, tungkai' },
    { id: 'rfff',      cls: 'bebas',    label: 'Flap radial forearm bebas',   regions: ['wajah', 'tangan', 'leher', 'lengan'], maxDef: 60, needs: 'tes Allen normal, mikrovaskular', note: 'tipis dan lentur; pedikel panjang' },
    { id: 'scip',      cls: 'bebas',    label: 'Flap SCIP',                   regions: ['tangan', 'lengan', 'wajah', 'pretibia', 'tumit'], maxDef: 80, needs: 'mikrovaskular', note: 'sangat tipis; donor tersembunyi di lipat paha' },
  ];

  /* ---------- keputusan graft vs flap ---------- */
  function decide(c) {
    const why = []; const A = c.areaCm2; const dm = c.dm || c.pad;
    const fn = ['sendi', 'tangan', 'tumit'].includes(c.region) || c.zone === 'fungsional' || c.zone === 'estetik';
    if (c.infected || !c.bedReady) return { mode: 'debridemen', why: ['Dasar belum siap: debridemen, kendali infeksi, NPWT; putuskan graft/flap setelah dasar bersih dan berpembuluh.'] };
    const needFlap = (c.exposed && c.exposed.length > 0) || c.osteo || c.irradiated;
    if (needFlap) {
      if (c.exposed && c.exposed.length) why.push('Struktur penting terpapar tanpa jaringan penutup (' + c.exposed.join(', ') + '): graft tidak akan hidup, perlu flap.');
      if (c.osteo) why.push('Osteomielitis/ruang mati: flap otot (gracilis, gastroknemius, latissimus) memberi pasokan darah dan antibiotik.');
      if (c.irradiated) why.push('Dasar teriradiasi: flap lebih andal daripada graft.');
      return { mode: 'flap', why, ladder: rankFlaps(c) };
    }
    if (c.zone === 'tekanan' && c.depth === 'full' && c.region === 'sakrum') { why.push('Luka tekan sakral ketebalan penuh: flap (gluteal) setelah optimasi nutrisi dan penurunan tekanan.'); return { mode: 'flap', why, ladder: rankFlaps(c) }; }
    if (c.region === 'tumit' && A <= 20) { why.push('Tumit (penahan beban): kulit glabrous/flap plantar medial lebih tahan geser daripada graft.'); return { mode: 'flap', why, ladder: rankFlaps(c) }; }
    // dasar berpembuluh tanpa struktur terpapar
    if (A > 40 || !fn) { why.push(`Dasar granulasi berpembuluh tanpa struktur terpapar${A > 40 ? ` dan luas ${A.toFixed(0)} cm²` : ''}: STSG (meshed) adalah anak tangga paling sederhana dan andal.`); return { mode: 'graft', kind: 'stsg', why }; }
    why.push('Zona fungsional/estetik berukuran sedang: FTSG (kontraksi kecil, warna dan tekstur lebih baik) atau flap lokal bila kontur penting.');
    return { mode: 'graft', kind: (A <= 20 ? 'ftsg' : 'stsg'), why, alt: 'flap lokal' };
  }

  /* ---------- peringkat flap ---------- */
  function rankFlaps(c) {
    const A = c.areaCm2; const out = [];
    FLAPS.forEach(f => {
      if (!f.regions.includes(c.region)) return;
      if (c.region === 'pretibia' && c.third && f.thirds && !f.thirds.includes(c.third)) return;
      let s = 0; const r = [];
      s += { lokal: 30, regional: 20, bebas: 10 }[f.cls];                     // anak tangga: sederhana dulu
      const fit = A / f.maxDef; if (fit > 1) return; s += fit <= 0.6 ? 12 : 4; if (fit <= 0.6) r.push(`ukuran sesuai (defek ${A.toFixed(1)} dari maks ${f.maxDef} cm²)`); else r.push('di tepi batas ukuran');
      if (c.osteo && /otot/.test(f.label)) { s += 25; r.push('flap otot untuk osteomielitis'); }
      if (c.exposed && c.exposed.length && f.cls !== 'lokal') s += 3;
      if (c.region === 'tumit' && f.id === 'mpap') { s += 20; r.push('kulit plantar glabrous'); }
      if (c.region === 'sakrum' && f.id === 'gluteal') { s += 18; r.push('standar luka tekan sakral'); }
      if (c.pad && ['rev_sural', 'propeller', 'mpap'].includes(f.id)) { s -= 40; r.push('PAD: pasokan distal dipertanyakan'); }
      if (c.dm && f.id === 'rev_sural') { s -= 10; r.push('DM: risiko kongesti/nekrosis ujung'); }
      if (c.smoker && f.cls === 'bebas') { s -= 4; r.push('perokok: tingkat gagal flap bebas lebih tinggi'); }
      if (A > 150 && f.cls !== 'bebas' && f.maxDef < 150) { s -= 15; }
      if (f.needs) r.push('butuh: ' + f.needs);
      out.push({ ...f, score: s, reasons: r });
    });
    out.sort((a, b) => b.score - a.score); return out;
  }

  /* ---------- peringkat donor STSG ---------- */
  function rankStsg(c, needCm2) {
    const bsa = c.bsa || 1.8; const out = [];
    STSG.forEach(d => {
      const avail = area(bsa, d.pct, d.use); let s = d.rank; const r = [];
      const ratio = avail / needCm2; if (ratio < 1) s -= 12; else if (ratio >= 3) s += 4; else if (ratio >= 1.5) s += 1; else s -= 2;
      if (d.limb && c.limb && d.limb === c.limb) { s -= 1; r.push('ekstremitas yang sama dengan resipien: gunakan sisi kontralateral'); }
      if ((c.dm || c.pad) && d.limb === 'tungkai' && ['calf'].includes(d.id)) { s -= 6; r.push('DM/PAD: penyembuhan donor tungkai bawah buruk'); }
      if (c.age != null && c.age < 15 && d.id === 'scalp') { s += 4; r.push('anak: kulit kepala dianjurkan'); }
      if (c.region === 'sakrum' && ['buttock', 'thigh_post'].includes(d.id)) { s -= 4; r.push('dekat/pada zona tekanan'); }
      const width = Math.min(d.maxW, Math.max(4, Math.sqrt(needCm2 * 1.2)));        // lebar strip praktis
      const len = needCm2 / width;
      out.push({ ...d, avail, ratio, score: s, stripW: width, stripL: len, passes: Math.ceil(len / 20), reasons: r });
    });
    out.sort((a, b) => b.score - a.score); return out;
  }

  /* ---------- peringkat donor FTSG: ellips donor LxW (cm) dari perencana ---------- */
  function rankFtsg(c, donorL, donorW) {
    const out = [];
    FTSG.forEach(d => {
      if (!d.match.includes(c.region)) return;
      let s = 5; const r = []; const fitsW = donorW <= d.maxW, fitsL = donorL <= d.maxL;
      if (fitsW && fitsL) { s += 8; r.push('tutup donor primer'); } else { s -= 10; r.push(`melebihi batas donor (maks ${d.maxW} × ${d.maxL} cm)`); }
      if (c.region === 'wajah' && d.id === 'supraclav') s += 6;
      if (c.region === 'tangan' && d.id === 'hypothenar') s += 3;
      if (d.hair && ['wajah', 'tangan'].includes(c.region)) { s -= 6; r.push('berambut: tidak cocok'); }
      out.push({ ...d, score: s, donorL, donorW, fits: fitsW && fitsL, reasons: r });
    });
    out.sort((a, b) => b.score - a.score); return out;
  }

  /* kebutuhan paddle flap bebas/regional: defek + margin 5 mm tiap sisi, +10% */
  const paddle = (lMm, wMm) => ({ L: ((lMm + 10) / 10) * 1.1, W: ((wMm + 10) / 10) * 1.1 });

  return { LB, STSG, FTSG, FLAPS, area, decide, rankFlaps, rankStsg, rankFtsg, paddle };
})();
