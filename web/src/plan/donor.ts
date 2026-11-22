/* Graft versus flap, donor ranking and flap ladder with numbers. Donor area comes from the patient's BSA x the
   Lund and Browder fraction of the region x a usable fraction. Sizes are textbook ranges: confirm on the patient
   (laxity, perforators by Doppler or CTA, previous surgery or radiotherapy). */
import { L } from './planner';
import type { L2 } from '../clinic/kb';

export const LB = { thigh: 9.5, leg: 7, arm: 4, trunkA: 13, trunkP: 13, buttock: 2.5, scalp: 3.5 };
const area = (bsa: number, pct: number, usable: number) => (bsa * 1e4 * pct) / 100 * usable;

interface Stsg { id: string; label: L2; pct: number; use: number; rank: number; maxW: number; limb: string | null; note: L2 }
export const STSG: Stsg[] = [
  { id: 'thigh_al', label: L('Anterolateral thigh', 'Paha anterolateral'), pct: LB.thigh, use: 0.45, rank: 10, maxW: 10, limb: 'leg', note: L('standard donor: flat, hidden by clothes', 'donor standar: permukaan rata, tersembunyi pakaian') },
  { id: 'thigh_post', label: L('Posterior thigh', 'Paha posterior'), pct: LB.thigh, use: 0.25, rank: 6, maxW: 10, limb: 'leg', note: L('hard to nurse (sitting)', 'sulit dirawat (duduk)') },
  { id: 'buttock', label: L('Buttock', 'Glutea'), pct: LB.buttock, use: 0.8, rank: 8, maxW: 10, limb: null, note: L('hidden scar; avoid in pressure injury', 'bekas tersembunyi; hindari pada luka tekan') },
  { id: 'back', label: L('Back', 'Punggung'), pct: LB.trunkP, use: 0.5, rank: 7, maxW: 10, limb: null, note: L('large area; prone or lateral positioning', 'luas besar; posisi telungkup atau miring') },
  { id: 'abdomen', label: L('Abdomen', 'Abdomen'), pct: LB.trunkA, use: 0.35, rank: 6, maxW: 10, limb: null, note: L('when other donors are limited', 'bila donor lain terbatas') },
  { id: 'scalp', label: L('Scalp', 'Kulit kepala'), pct: LB.scalp, use: 0.7, rank: 5, maxW: 6, limb: null, note: L('heals fast and can be reharvested; hair grows on the graft; good in children', 'sembuh cepat, dapat dipanen ulang; rambut tumbuh di graft; pilihan pada anak') },
  { id: 'upper_arm', label: L('Upper arm', 'Lengan atas'), pct: LB.arm, use: 0.4, rank: 4, maxW: 7, limb: 'arm', note: L('visible scar; only if nothing else', 'bekas terlihat; hanya bila donor lain tidak ada') },
  { id: 'calf', label: L('Calf', 'Betis'), pct: LB.leg, use: 0.4, rank: 2, maxW: 8, limb: 'leg', note: L('slow donor healing; avoid in diabetes or PAD', 'penyembuhan donor lambat; hindari pada DM atau PAD') },
];

interface Ftsg { id: string; label: L2; maxW: number; maxL: number; hair: boolean; match: string[]; note: L2 }
export const FTSG: Ftsg[] = [
  { id: 'supraclav', label: L('Supraclavicular', 'Supraklavikula'), maxW: 4, maxL: 12, hair: false, match: ['wajah', 'leher', 'kulit-kepala'], note: L('best colour match for face and neck', 'kecocokan warna terbaik untuk wajah dan leher') },
  { id: 'postaur', label: L('Post-auricular', 'Pascaaurikular'), maxW: 3, maxL: 6, hair: false, match: ['wajah'], note: L('thin; nose, eyelid, ear', 'tipis; hidung, kelopak, telinga') },
  { id: 'groin', label: L('Groin crease', 'Lipat paha'), maxW: 7, maxL: 20, hair: true, match: ['badan', 'tangan', 'sendi', 'tungkai', 'pretibia', 'lengan', 'tumit'], note: L('the largest FTSG donor; hair bearing', 'donor FTSG paling luas; berambut') },
  { id: 'medarm', label: L('Medial upper arm', 'Lengan atas medial'), maxW: 5, maxL: 15, hair: false, match: ['tangan', 'sendi', 'lengan', 'wajah'], note: L('thin; hidden scar', 'tipis; bekas tersembunyi') },
  { id: 'hypothenar', label: L('Hypothenar', 'Hipotenar'), maxW: 2, maxL: 5, hair: false, match: ['tangan'], note: L('glabrous skin for palm and fingers', 'kulit glabrous untuk telapak dan jari') },
  { id: 'instep', label: L('Instep (plantar)', 'Instep (plantar)'), maxW: 3, maxL: 8, hair: false, match: ['tangan', 'tumit'], note: L('thick glabrous skin for the sole and palm', 'kulit glabrous tebal untuk plantar dan telapak') },
  { id: 'abdomen_f', label: L('Lower abdomen', 'Abdomen bawah'), maxW: 10, maxL: 25, hair: false, match: ['badan', 'sendi', 'tungkai'], note: L('large; if an abdominoplasty is happening', 'luas; bila ada abdominoplasti') },
];

const R = ['wajah', 'kulit-kepala', 'leher', 'badan', 'sakrum', 'tangan', 'lengan', 'sendi', 'tungkai', 'pretibia', 'tumit', 'genital'];
export interface Flap { id: string; cls: 'local' | 'regional' | 'free'; label: L2; regions: string[]; maxDef: number; needs?: L2; note: L2 }
export const FLAPS: Flap[] = [
  { id: 'vy', cls: 'local', label: L('V-Y advancement flap', 'Flap V-Y advancement'), regions: R, maxDef: 12, note: L('base on the defect edge; perforator supply kept', 'basis pada tepi defek; pasokan perforator dipertahankan') },
  { id: 'adv', cls: 'local', label: L('Advancement flap', 'Flap advancement'), regions: ['wajah', 'kulit-kepala', 'badan', 'lengan', 'tungkai', 'pretibia'], maxDef: 12, note: L('length 2 to 4 times the width', 'panjang 2 sampai 4 kali lebar') },
  { id: 'rotation', cls: 'local', label: L('Rotation flap', 'Flap rotasi'), regions: ['kulit-kepala', 'wajah', 'sakrum', 'badan'], maxDef: 40, note: L('arc 4 times the defect width; graft the donor on the scalp if needed', 'busur 4 kali lebar defek; graft donor pada kulit kepala bila perlu') },
  { id: 'rhomboid', cls: 'local', label: L('Rhomboid (Limberg) flap', 'Flap rhomboid (Limberg)'), regions: ['wajah', 'badan', 'lengan', 'tungkai'], maxDef: 9, note: L('60/120 degree rhomboid defect; four possible flaps', 'defek rhomboid 60/120°; 4 kemungkinan flap') },
  { id: 'keystone', cls: 'local', label: L('Keystone flap', 'Flap keystone'), regions: ['badan', 'lengan', 'tungkai', 'pretibia', 'sendi'], maxDef: 60, note: L('defect up to about 8 cm wide; donor closed V-Y', 'defek lebar hingga sekitar 8 cm; donor ditutup V-Y') },
  { id: 'propeller', cls: 'local', label: L('Perforator propeller flap', 'Flap propeller perforator'), regions: ['tungkai', 'pretibia', 'tumit', 'lengan', 'badan'], maxDef: 50, needs: L('Doppler for the perforator', 'Doppler perforator'), note: L('rotates up to 180 degrees on the perforator; check the venous route', 'rotasi hingga 180° pada perforator; cek jalur vena') },
  { id: 'rev_sural', cls: 'regional', label: L('Reverse sural flap', 'Flap sural reverse'), regions: ['pretibia', 'tumit', 'sendi'], maxDef: 50, needs: L('palpable tibial pulse; avoid PAD or severe venous insufficiency', 'nadi tibialis teraba; hindari PAD atau insufisiensi vena berat'), note: L('distal third of the leg and heel; paddle up to about 15 x 8 cm', 'sepertiga distal tungkai dan tumit; paddle hingga sekitar 15 × 8 cm') },
  { id: 'mpap', cls: 'regional', label: L('Medial plantar artery flap', 'Flap arteri plantar medial'), regions: ['tumit'], maxDef: 20, needs: L('intact medial plantar artery', 'arteri plantar medial utuh'), note: L('glabrous skin for a weight-bearing heel', 'kulit glabrous untuk tumit penahan beban') },
  { id: 'gastroc', cls: 'regional', label: L('Gastrocnemius muscle flap', 'Flap otot gastroknemius'), regions: ['pretibia', 'sendi'], maxDef: 100, note: L('proximal third of the leg and knee; covered with STSG', 'sepertiga proksimal tungkai dan lutut; ditutup STSG') },
  { id: 'pectoralis', cls: 'regional', label: L('Pectoralis major flap', 'Flap pektoralis mayor'), regions: ['wajah', 'leher', 'badan'], maxDef: 150, note: L('head and neck, chest', 'kepala-leher, dada') },
  { id: 'ld_ped', cls: 'regional', label: L('Latissimus dorsi (pedicled)', 'Flap latissimus dorsi (pedikel)'), regions: ['badan', 'lengan', 'leher'], maxDef: 300, note: L('chest wall, axilla, back, shoulder', 'dinding dada, aksila, punggung, bahu') },
  { id: 'tfl', cls: 'regional', label: L('TFL flap', 'Flap TFL'), regions: ['sakrum', 'tungkai', 'badan', 'genital'], maxDef: 150, note: L('trochanter, lower abdomen; paddle up to about 15 x 10 cm', 'trokanter, abdomen bawah; paddle hingga sekitar 15 × 10 cm') },
  { id: 'gluteal', cls: 'regional', label: L('Gluteal flap (V-Y or perforator rotation)', 'Flap gluteal (V-Y atau perforator rotasi)'), regions: ['sakrum'], maxDef: 100, note: L('sacrum; superior or inferior gluteal artery perforators', 'sakrum; perforator arteri gluteal superior atau inferior') },
  { id: 'alt', cls: 'free', label: L('ALT (anterolateral thigh) free flap', 'Flap ALT (anterolateral thigh)'), regions: R, maxDef: 300, needs: L('CTA or Doppler perforator mapping, microvascular team', 'CTA atau Doppler perforator, tim mikrovaskular'), note: L('paddle up to 25 x 15 cm; donor closes primarily up to about 8 cm wide', 'paddle hingga 25 × 15 cm; donor tertutup primer hingga lebar sekitar 8 cm') },
  { id: 'gracilis', cls: 'free', label: L('Gracilis muscle flap (+STSG)', 'Flap otot gracilis (+STSG)'), regions: ['pretibia', 'tumit', 'sendi', 'tungkai', 'genital', 'tangan'], maxDef: 100, needs: L('microvascular team', 'tim mikrovaskular'), note: L('dead space and osteomyelitis', 'ruang mati dan osteomielitis') },
  { id: 'ld_free', cls: 'free', label: L('Latissimus dorsi free flap', 'Flap latissimus dorsi bebas'), regions: R, maxDef: 600, needs: L('microvascular team', 'tim mikrovaskular'), note: L('very large defects, scalp, limbs', 'defek sangat luas, kulit kepala, tungkai') },
  { id: 'scip', cls: 'free', label: L('SCIP flap', 'Flap SCIP'), regions: ['tangan', 'lengan', 'wajah', 'pretibia', 'tumit'], maxDef: 80, needs: L('microvascular team', 'tim mikrovaskular'), note: L('very thin; hidden groin donor', 'sangat tipis; donor tersembunyi di lipat paha') },
];

export interface DCtx { areaCm2: number; region: string; zone: string; depth: string; exposed: string[]; bedReady: boolean; infected: boolean; dm?: boolean; pad?: boolean; osteo?: boolean; smoker?: boolean; bsa?: number; age?: number | null; limb?: string }
export interface Decision { mode: 'debridement' | 'flap' | 'graft'; kind?: 'stsg' | 'ftsg'; why: L2[]; ladder?: (Flap & { score: number; reasons: L2[] })[]; alt?: L2 }

export function decide(c: DCtx): Decision {
  const why: L2[] = [];
  const A = c.areaCm2;
  const fn = ['sendi', 'tangan', 'tumit'].includes(c.region) || c.zone === 'fungsional' || c.zone === 'estetik';
  if (c.infected || !c.bedReady) return { mode: 'debridement', why: [L('The bed is not ready: debridement, infection control and negative pressure. Graft or flap is decided once the bed is clean and vascular.', 'Dasar belum siap: debridemen, kendali infeksi, tekanan negatif. Graft atau flap diputuskan setelah dasar bersih dan berpembuluh.')] };
  const needFlap = c.exposed.length > 0 || c.osteo;
  if (needFlap) {
    if (c.exposed.length) why.push(L('Exposed structures with no soft tissue cover: a graft will not take, a flap is needed.', 'Struktur terpapar tanpa jaringan penutup: graft tidak akan hidup, perlu flap.'));
    if (c.osteo) why.push(L('Osteomyelitis or dead space: a muscle flap brings blood supply and antibiotic delivery.', 'Osteomielitis atau ruang mati: flap otot membawa pasokan darah dan antibiotik.'));
    return { mode: 'flap', why, ladder: rankFlaps(c) };
  }
  if (c.zone === 'tekanan' && c.depth === 'full' && c.region === 'sakrum') { why.push(L('Full thickness sacral pressure injury: a gluteal flap after nutrition and pressure relief are optimised.', 'Luka tekan sakral ketebalan penuh: flap gluteal setelah nutrisi dan penurunan tekanan dioptimalkan.')); return { mode: 'flap', why, ladder: rankFlaps(c) }; }
  if (c.region === 'tumit' && A <= 20) { why.push(L('Heel (weight bearing): glabrous skin or a medial plantar flap resists shear better than a graft.', 'Tumit (penahan beban): kulit glabrous atau flap plantar medial lebih tahan geser daripada graft.')); return { mode: 'flap', why, ladder: rankFlaps(c) }; }
  if (A > 40 || !fn) { why.push(L(`Vascular granulating bed with nothing exposed${A > 40 ? ` and an area of ${A.toFixed(0)} cm²` : ''}: a meshed STSG is the simplest and most reliable rung.`, `Dasar granulasi berpembuluh tanpa struktur terpapar${A > 40 ? ` dan luas ${A.toFixed(0)} cm²` : ''}: STSG meshed adalah anak tangga paling sederhana dan andal.`)); return { mode: 'graft', kind: 'stsg', why }; }
  why.push(L('Functional or aesthetic zone of moderate size: FTSG (little contraction, better colour and texture) or a local flap if contour matters.', 'Zona fungsional atau estetik berukuran sedang: FTSG (kontraksi kecil, warna dan tekstur lebih baik) atau flap lokal bila kontur penting.'));
  return { mode: 'graft', kind: A <= 20 ? 'ftsg' : 'stsg', why, alt: L('local flap', 'flap lokal') };
}

export function rankFlaps(c: DCtx) {
  const A = c.areaCm2;
  const out: (Flap & { score: number; reasons: L2[] })[] = [];
  for (const f of FLAPS) {
    if (!f.regions.includes(c.region)) continue;
    let s = { local: 30, regional: 20, free: 10 }[f.cls];
    const r: L2[] = [];
    const fit = A / f.maxDef;
    if (fit > 1) continue;
    if (fit <= 0.6) { s += 12; r.push(L(`fits the size (defect ${A.toFixed(1)} of a maximum ${f.maxDef} cm²)`, `ukuran sesuai (defek ${A.toFixed(1)} dari maks ${f.maxDef} cm²)`)); } else { s += 4; r.push(L('close to the size limit', 'di tepi batas ukuran')); }
    if (c.osteo && /muscle|otot/i.test(f.label.en + f.label.id)) { s += 25; r.push(L('muscle flap for osteomyelitis', 'flap otot untuk osteomielitis')); }
    if (c.region === 'tumit' && f.id === 'mpap') { s += 20; r.push(L('glabrous plantar skin', 'kulit plantar glabrous')); }
    if (c.region === 'sakrum' && f.id === 'gluteal') { s += 18; r.push(L('the standard for a sacral pressure injury', 'standar luka tekan sakral')); }
    if (c.pad && ['rev_sural', 'propeller', 'mpap'].includes(f.id)) { s -= 40; r.push(L('PAD: distal supply in doubt', 'PAD: pasokan distal dipertanyakan')); }
    if (c.dm && f.id === 'rev_sural') { s -= 10; r.push(L('diabetes: risk of congestion or tip necrosis', 'DM: risiko kongesti atau nekrosis ujung')); }
    if (c.smoker && f.cls === 'free') { s -= 4; r.push(L('smoker: higher free flap failure', 'perokok: tingkat gagal flap bebas lebih tinggi')); }
    if (f.needs) r.push(L(`needs: ${f.needs.en}`, `butuh: ${f.needs.id}`));
    out.push({ ...f, score: s, reasons: r });
  }
  return out.sort((a, b) => b.score - a.score);
}

export function rankStsg(c: DCtx, needCm2: number) {
  const bsa = c.bsa || 1.8;
  return STSG.map((d) => {
    const avail = area(bsa, d.pct, d.use);
    let s = d.rank;
    const r: L2[] = [];
    const ratio = avail / needCm2;
    if (ratio < 1) s -= 12; else if (ratio >= 3) s += 4; else if (ratio >= 1.5) s += 1; else s -= 2;
    if (d.limb && c.limb && d.limb === c.limb) { s -= 1; r.push(L('same limb as the recipient: use the other side', 'ekstremitas yang sama dengan resipien: gunakan sisi kontralateral')); }
    if ((c.dm || c.pad) && d.id === 'calf') { s -= 6; r.push(L('diabetes or PAD: the lower leg donor heals badly', 'DM atau PAD: donor tungkai bawah sembuh buruk')); }
    if (c.age != null && c.age < 15 && d.id === 'scalp') { s += 4; r.push(L('child: the scalp is recommended', 'anak: kulit kepala dianjurkan')); }
    if (c.region === 'sakrum' && ['buttock', 'thigh_post'].includes(d.id)) { s -= 4; r.push(L('close to the pressure zone', 'dekat zona tekanan')); }
    const width = Math.min(d.maxW, Math.max(4, Math.sqrt(needCm2 * 1.2)));
    return { ...d, avail, ratio, score: s, stripW: width, stripL: needCm2 / width, reasons: r };
  }).sort((a, b) => b.score - a.score);
}

export function rankFtsg(c: DCtx, donorL: number, donorW: number) {
  const out: (Ftsg & { score: number; fits: boolean; reasons: L2[] })[] = [];
  for (const d of FTSG) {
    if (!d.match.includes(c.region)) continue;
    let s = 5;
    const r: L2[] = [];
    const fits = donorW <= d.maxW && donorL <= d.maxL;
    if (fits) { s += 8; r.push(L('donor closes primarily', 'tutup donor primer')); } else { s -= 10; r.push(L(`beyond the donor limit (max ${d.maxW} x ${d.maxL} cm)`, `melebihi batas donor (maks ${d.maxW} × ${d.maxL} cm)`)); }
    if (c.region === 'wajah' && d.id === 'supraclav') s += 6;
    if (c.region === 'tangan' && d.id === 'hypothenar') s += 3;
    if (d.hair && ['wajah', 'tangan'].includes(c.region)) { s -= 6; r.push(L('hair bearing: not suitable here', 'berambut: tidak cocok')); }
    out.push({ ...d, score: s, fits, reasons: r });
  }
  return out.sort((a, b) => b.score - a.score);
}

export const REGION_MAP: Record<string, string> = { sacrum: 'sakrum', heel: 'tumit', foot: 'tumit', lowerleg: 'pretibia', trunk: 'badan', limb: 'tungkai', face: 'wajah', hand: 'tangan', joint: 'sendi', scalp: 'kulit-kepala' };
