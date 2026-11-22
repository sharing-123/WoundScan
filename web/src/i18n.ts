export type Lang = 'id' | 'en';

type Dict = Record<string, string>;

const id: Dict = {
  'nav.how': 'Cara kerja',
  'nav.evidence': 'Bukti',
  'nav.try': 'Coba',
  'nav.cta': 'Analisis foto',
  'rail.layers': 'Lapisan',
  'rail.scan': 'Segmentasi',
  'rail.measure': 'Ukuran',
  'rail.plan': 'Rencana',
  'rail.body': 'Tubuh',
  'rail.private': 'Privasi',
  'cue': 'Gulir',

  'hero.h1': 'Luka diukur dari <em>satu foto</em>. Di perangkat Anda.',
  'hero.lead':
    'WoundScan memisahkan luka dari kulit di sekitarnya, mengubah piksel menjadi sentimeter persegi, menghitung persen luas permukaan tubuh, lalu menyiapkan geometri rencana rekonstruksi. Foto tidak diunggah ke cloud.',
  'hero.cta1': 'Coba dengan foto sendiri',
  'hero.cta2': 'Lihat cara kerja',
  'hero.note': 'Alat riset. Belum divalidasi klinis secara prospektif.',

  'layers.h': 'Kamera melihat permukaan. Luka punya <em>kedalaman</em>.',
  'layers.p':
    'Dari foto dua dimensi, WoundScan mengukur luas dan keliling. Kedalaman, perfusi, dan kelaksitas kulit tidak terukur. Batas itu dinyatakan di awal, bukan di catatan kaki.',
  'layers.epi': 'Epidermis',
  'layers.derm': 'Dermis',
  'layers.fat': 'Subkutis',
  'layers.mus': 'Otot',
  'layers.wound': 'Luka, kedalaman tidak terukur',
  'layers.note': 'Ilustrasi, tidak berskala.',

  'scan.h': 'Satu foto, satu <em>kontur</em>.',
  'scan.p':
    'Jaringan U-Net membaca setiap piksel dan memberi probabilitas luka. Kontur diambil dari probabilitas itu, dan daerah yang ragu ditandai supaya Anda memeriksanya, bukan memercayainya begitu saja.',
  'scan.edge': 'Batas luka',
  'scan.doubt': 'Daerah ragu',

  'measure.h': 'Piksel menjadi <em>sentimeter</em>.',
  'measure.p':
    'Penggaris, kartu berukuran ID-1 (85,6 mm), atau jarak kamera memberi skala. Tanpa skala, WoundScan hanya melaporkan piksel, tidak pernah cm². Dengan skala, galat panjang 2 sampai 10 persen ikut dibawa ke luas.',
  'measure.len': 'Panjang',
  'measure.wid': 'Lebar',
  'measure.area': 'Luas',
  'measure.note': 'Angka pada ilustrasi dihitung dari bentuk 3D di layar.',

  'plan.h': 'Dari kontur ke <em>rencana sayatan</em>.',
  'plan.p':
    'Dari bentuk dan lokasi luka, WoundScan mengusulkan geometri: fusiform 4:1, flap advancement, V–Y, atau Z-plasti. Ini usulan dari foto dua dimensi. Laksitas kulit dan perfusi harus dinilai langsung pada pasien.',
  'plan.z': 'Z-plasti 60°',
  'plan.gain': 'pemanjangan teoretis ±75%',
  'plan.note': 'Skema, bukan skala.',
  'plan.before': 'Sebelum',
  'plan.after': 'Sesudah',

  'body.h': 'Persen luas tubuh, bukan <em>kira-kira</em>.',
  'body.p':
    'Luas luka dibagi luas permukaan tubuh (rumus Mosteller dari tinggi dan berat). Donor graft diperingkat memakai fraksi Lund dan Browder dewasa.',
  'body.head': 'Kepala 7%',
  'body.trunk': 'Badan depan 13%',
  'body.arm': 'Lengan 9,5%',
  'body.leg': 'Tungkai 20%',
  'body.wound': 'Ulkus ini',

  'priv.h': 'Foto tidak <em>ke mana-mana</em>.',
  'priv.p':
    'Model ONNX berjalan di peranti Anda. Server hanya melayani 127.0.0.1, dan kasus tersimpan di satu berkas SQLite lokal dengan kode pseudonim, tanpa nama pasien.',

  'ev.h': 'Bukti, termasuk yang <em>tidak berhasil</em>.',
  'ev.lead':
    'Angka di bawah dihitung pada data uji yang tidak dipakai untuk memilih model. Protokol ditulis di samping setiap angka, karena angka tanpa protokol tidak bisa dinilai.',
  'ev.t1': 'Validasi FUSeg, 200 foto kaki',
  'ev.t1.p': 'Ansambel tiga model U-Net. Dice 0,837, presisi 0,908, recall 0,904.',
  'ev.t2': 'Medetec, 38 foto, validasi silang per foto',
  'ev.t2.p':
    'Setiap foto diuji oleh model yang tidak pernah melihat foto itu. Dice 0,892 (CI 95%: 0,866 sampai 0,917), akurasi 0,981, presisi 0,914, recall 0,896, F1 0,905. 31 dari 38 foto mencapai Dice 0,85 atau lebih.',
  'ev.t3': 'Geometri',
  'ev.t3.p': 'Pada bentuk analitik, galat luas paling besar 0,07 persen. Ini menguji aritmetika, bukan model.',
  'ev.t4': 'Skala',
  'ev.t4.p': 'Ukuran absolut bergantung pada kalibrasi, yang menambah galat panjang 2 sampai 10 persen.',
  'ev.fail.h': 'Di mana ia gagal',
  'ev.fail.p':
    'Pada 31 foto publik, model andal untuk dehisensi, ulkus diabetik, luka tekan besar, dan luka bakar melepuh. Ia melewatkan luka tusuk kecil dan abrasi tipis, dan model ini dilatih pada ulkus kaki, bukan luka akut atau keganasan. Karsinoma ulseratif tidak boleh dinilai dari alat ini.',
  'ev.note':
    'Belum ada validasi prospektif terhadap pengukuran klinisi atau hasil pasien. Ini alat riset.',

  'try.h': 'Coba di <em>foto Anda</em>.',
  'try.lead':
    'Seluruh pemrosesan terjadi di komputer ini. Pilih foto, beri skala, dan lihat kontur serta ukurannya. Simpan sebagai kasus untuk melihat tren penyembuhan.',
  'try.drop': 'Letakkan foto di sini, atau pilih berkas',
  'try.samples': 'Atau pakai foto contoh',
  'try.model': 'Model',
  'try.threshold': 'Ambang',
  'try.calib': 'Skala',
  'try.calib.none': 'Tanpa skala (hanya piksel)',
  'try.calib.ref': 'Dua titik pada benda berukuran diketahui',
  'try.calib.dist': 'Jarak kamera',
  'try.refmm': 'Panjang acuan (mm)',
  'try.card': 'Kartu ID-1 = 85,6',
  'try.click2': 'Klik dua titik pada foto: ujung acuan.',
  'try.dist': 'Jarak kamera (cm)',
  'try.height': 'Tinggi (cm)',
  'try.weight': 'Berat (kg)',
  'try.run': 'Analisis',
  'try.running': 'Menganalisis…',
  'try.area': 'Luas',
  'try.perim': 'Keliling',
  'try.length': 'Panjang',
  'try.width': 'Lebar',
  'try.tbsa': 'Luas tubuh',
  'try.conf': 'Keyakinan',
  'try.time': 'Waktu',
  'try.uncal': 'Tanpa skala',
  'try.save': 'Simpan sebagai kasus',
  'try.patient': 'Kode pasien (pseudonim)',
  'try.label': 'Lokasi / catatan singkat',
  'try.saved': 'Tersimpan',
  'try.err.api': 'Server lokal tidak menjawab. Jalankan server/run.py.',
  'try.cases': 'Kasus tersimpan',
  'try.trend': 'Tren penyembuhan',
  'try.empty': 'Belum ada kasus. Simpan hasil analisis pertama.',
  'try.export': 'Ekspor CSV',
  'try.delete': 'Hapus',
  'try.overlay': 'Tampilan',
  'try.ov.contour': 'Kontur',
  'try.ov.prob': 'Peta probabilitas',
  'try.ov.photo': 'Foto asli',
  'try.disclaimer':
    'Hasil adalah usulan dari foto dua dimensi. Periksa kontur sebelum dipakai, dan jangan memutuskan keganasan dari alat ini.',

  'foot.by': 'Dibuat oleh Muhammad Allam Rafi dan Cindy Rizky Afrilia, Universitas Indonesia dan Universitas Kristen Krida Wacana.',
  'foot.lic':
    'Kode berlisensi MIT. Bobot model hanya untuk riset: data latih (WoundSeg, FUSeg) berlisensi non-komersial.',
  'foot.photos': 'Foto contoh dari Wikimedia Commons',
  'foot.links': 'Catatan riset',
};

const en: Dict = {
  'nav.how': 'How it works',
  'nav.evidence': 'Evidence',
  'nav.try': 'Try it',
  'nav.cta': 'Analyse a photo',
  'rail.layers': 'Layers',
  'rail.scan': 'Segmentation',
  'rail.measure': 'Measure',
  'rail.plan': 'Plan',
  'rail.body': 'Body',
  'rail.private': 'Privacy',
  'cue': 'Scroll',

  'hero.h1': 'Measure a wound from <em>one photo</em>. On your own device.',
  'hero.lead':
    'WoundScan separates the wound from surrounding skin, turns pixels into square centimetres, computes percent body surface area, and prepares the geometry of a reconstruction plan. Photos are never uploaded to a cloud.',
  'hero.cta1': 'Try it with your own photo',
  'hero.cta2': 'See how it works',
  'hero.note': 'Research tool. Not prospectively validated in the clinic.',

  'layers.h': 'The camera sees the surface. The wound has <em>depth</em>.',
  'layers.p':
    'From a two dimensional photo, WoundScan measures area and perimeter. Depth, perfusion and skin laxity are not measurable. That limit is stated up front, not in a footnote.',
  'layers.epi': 'Epidermis',
  'layers.derm': 'Dermis',
  'layers.fat': 'Subcutis',
  'layers.mus': 'Muscle',
  'layers.wound': 'Wound, depth not measurable',
  'layers.note': 'Illustration, not to scale.',

  'scan.h': 'One photo, one <em>contour</em>.',
  'scan.p':
    'A U-Net reads every pixel and gives it a wound probability. The contour is taken from that probability, and uncertain regions are flagged so you check them instead of trusting them blindly.',
  'scan.edge': 'Wound edge',
  'scan.doubt': 'Uncertain zone',

  'measure.h': 'Pixels become <em>centimetres</em>.',
  'measure.p':
    'A ruler, an ID-1 card (85.6 mm) or the camera distance sets the scale. Without a scale WoundScan reports pixels only, never cm². With a scale, a 2 to 10 percent length error is carried into the area.',
  'measure.len': 'Length',
  'measure.wid': 'Width',
  'measure.area': 'Area',
  'measure.note': 'Figures on the illustration are computed from the 3D shape on screen.',

  'plan.h': 'From contour to <em>incision plan</em>.',
  'plan.p':
    'From the wound shape and site, WoundScan proposes geometry: 4:1 fusiform, advancement flap, V–Y, or Z-plasty. This is a suggestion from a two dimensional photo. Skin laxity and perfusion must be judged on the patient.',
  'plan.z': '60° Z-plasty',
  'plan.gain': 'theoretical lengthening ±75%',
  'plan.note': 'Schematic, not to scale.',
  'plan.before': 'Before',
  'plan.after': 'After',

  'body.h': 'Percent body surface, not a <em>guess</em>.',
  'body.p':
    'Wound area divided by body surface area (Mosteller from height and weight). Graft donors are ranked using adult Lund and Browder fractions.',
  'body.head': 'Head 7%',
  'body.trunk': 'Anterior trunk 13%',
  'body.arm': 'Arm 9.5%',
  'body.leg': 'Leg 20%',
  'body.wound': 'This ulcer',

  'priv.h': 'The photo <em>goes nowhere</em>.',
  'priv.p':
    'The ONNX model runs on your device. The server only listens on 127.0.0.1, and cases are stored in one local SQLite file under a pseudonymous code, with no patient name.',

  'ev.h': 'Evidence, including what <em>does not work</em>.',
  'ev.lead':
    'The figures below were computed on test data not used to choose the model. The protocol sits beside every number, because a number without its protocol cannot be judged.',
  'ev.t1': 'FUSeg validation, 200 foot photos',
  'ev.t1.p': 'Ensemble of three U-Nets. Dice 0.837, precision 0.908, recall 0.904.',
  'ev.t2': 'Medetec, 38 photographs, cross-validation by photograph',
  'ev.t2.p':
    'Each photograph was tested by a model that never saw it. Dice 0.892 (95% CI 0.866 to 0.917), accuracy 0.981, precision 0.914, recall 0.896, F1 0.905. 31 of 38 photographs reached Dice 0.85 or higher.',
  'ev.t3': 'Geometry',
  'ev.t3.p': 'On analytic shapes the area error is at most 0.07 percent. This tests the arithmetic, not the model.',
  'ev.t4': 'Scale',
  'ev.t4.p': 'Absolute size depends on calibration, which adds a 2 to 10 percent length error.',
  'ev.fail.h': 'Where it fails',
  'ev.fail.p':
    'On 31 public photographs the model is reliable for dehiscence, diabetic ulcers, large pressure injuries and blistered burns. It misses small punctures and thin abrasions, and it was trained on foot ulcers, not acute wounds or malignancy. Ulcerating carcinoma must not be judged with this tool.',
  'ev.note':
    'There is no prospective validation against clinician measurements or patient outcomes yet. This is a research tool.',

  'try.h': 'Try it on <em>your photo</em>.',
  'try.lead':
    'All processing happens on this computer. Pick a photo, give it a scale, and see the contour and size. Save it as a case to see the healing trend.',
  'try.drop': 'Drop a photo here, or choose a file',
  'try.samples': 'Or use a sample photo',
  'try.model': 'Model',
  'try.threshold': 'Threshold',
  'try.calib': 'Scale',
  'try.calib.none': 'No scale (pixels only)',
  'try.calib.ref': 'Two points on an object of known size',
  'try.calib.dist': 'Camera distance',
  'try.refmm': 'Reference length (mm)',
  'try.card': 'ID-1 card = 85.6',
  'try.click2': 'Click two points on the photo: the ends of the reference.',
  'try.dist': 'Camera distance (cm)',
  'try.height': 'Height (cm)',
  'try.weight': 'Weight (kg)',
  'try.run': 'Analyse',
  'try.running': 'Analysing…',
  'try.area': 'Area',
  'try.perim': 'Perimeter',
  'try.length': 'Length',
  'try.width': 'Width',
  'try.tbsa': 'Body surface',
  'try.conf': 'Confidence',
  'try.time': 'Time',
  'try.uncal': 'No scale',
  'try.save': 'Save as a case',
  'try.patient': 'Patient code (pseudonym)',
  'try.label': 'Site / short note',
  'try.saved': 'Saved',
  'try.err.api': 'The local server is not answering. Run server/run.py.',
  'try.cases': 'Saved cases',
  'try.trend': 'Healing trend',
  'try.empty': 'No cases yet. Save your first analysis.',
  'try.export': 'Export CSV',
  'try.delete': 'Delete',
  'try.overlay': 'View',
  'try.ov.contour': 'Contour',
  'try.ov.prob': 'Probability map',
  'try.ov.photo': 'Original',
  'try.disclaimer':
    'Results are suggestions from a two dimensional photo. Check the contour before using it, and do not decide malignancy with this tool.',

  'foot.by': 'Made by Muhammad Allam Rafi and Cindy Rizky Afrilia, Universitas Indonesia and Universitas Kristen Krida Wacana.',
  'foot.lic':
    'Code is MIT licensed. Model weights are for research only: the training data (WoundSeg, FUSeg) is non-commercial.',
  'foot.photos': 'Sample photos from Wikimedia Commons',
  'foot.links': 'Research record',
};

export const dictionaries: Record<Lang, Dict> = { id, en };

let current: Lang = 'id';
const listeners = new Set<(l: Lang) => void>();

export function t(key: string): string {
  return dictionaries[current][key] ?? dictionaries.id[key] ?? key;
}
export function lang(): Lang {
  return current;
}
export function onLang(fn: (l: Lang) => void) {
  listeners.add(fn);
}

export function applyLang(l: Lang) {
  current = l;
  document.documentElement.lang = l;
  document.querySelectorAll<HTMLElement>('[data-i]').forEach((el) => {
    const v = t(el.dataset.i!);
    if (v.includes('<em>')) el.innerHTML = v;
    else el.textContent = v;
  });
  document.querySelectorAll<HTMLElement>('[data-i-ph]').forEach((el) => {
    (el as HTMLInputElement).placeholder = t(el.dataset.iPh!);
  });
  document.querySelectorAll<HTMLElement>('[data-i-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.iAria!));
  });
  document.querySelectorAll<HTMLButtonElement>('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
  try {
    localStorage.setItem('ws-lang', l);
  } catch {
    /* private mode */
  }
  listeners.forEach((fn) => fn(l));
}

export function initLang() {
  let l: Lang = 'id';
  try {
    const s = localStorage.getItem('ws-lang');
    if (s === 'en' || s === 'id') l = s;
    else if (navigator.language && !navigator.language.toLowerCase().startsWith('id')) l = 'en';
  } catch {
    /* ignore */
  }
  applyLang(l);
  document.querySelectorAll<HTMLButtonElement>('.lang button').forEach((b) => b.addEventListener('click', () => applyLang(b.dataset.lang as Lang)));
}
