/* Turns the server's automatic analysis into a complete case: type, site, graft or flap decision, surgical plan,
   donor ranking and written recommendations in both languages. Nothing here needs the clinician to fill a form. */
import { TYPES, REGIONS, TIME_RULES, tetanus, type TypeId, type RegionId, type L2 } from './kb';
import { buildGeo, type Geo } from '../plan/geom';
import { build, recommend, L, type Plan, type Tech } from '../plan/planner';
import { decide, rankStsg, rankFtsg, REGION_MAP, type Decision } from '../plan/donor';
import type { Analysis } from '../ui/api';

export type ClinKey = 'chronic' | 'scarHistory' | 'pearly' | 'friable' | 'pigmented' | 'sunSite' | 'diabetes' | 'noPulse' | 'burnCause' | 'biteCause';
export type Clin = Partial<Record<ClinKey, boolean>>;
export interface Overrides { type?: TypeId; region?: RegionId; tech?: Tech; heightCm?: number; weightKg?: number; age?: number | null; clin?: Clin }
export interface DiffRow { id: TypeId; share: number; why: L2[] }
export interface Neoplasm { name: L2; why: L2 }
export interface Malignancy { flagged: boolean; tier: 'low' | 'intermediate' | 'high'; points: number; reasons: L2[]; neoplasm: Neoplasm[] }
export interface Section { id: string; title: L2; tone?: 'alert' | 'plan'; items: L2[] }
export interface Setting { level: 'ed' | 'clinic' | 'refer'; label: L2; why: L2[] }

export interface DepthEst { mm: number; loMm: number; hiMm: number; layer: 'dermis' | 'subcutis' | 'deep'; skinMm: number; fatMm: number }
export interface Dx { name: L2; grade: L2; one: L2 }

export interface Case {
  depthEst: DepthEst; dx: Dx;
  type: TypeId; typeConfidence: number; typeAuto: boolean; typeAlternatives: { id: TypeId; p: number }[];
  region: RegionId; regionAuto: boolean;
  geo: Geo; zone: string; areaCm2: number; tissue: Analysis['tissue']; depthClass: string;
  decision: Decision; plan: Plan; techAuto: boolean; autoWhy: L2[];
  later: { decision: Decision; plan: Plan; donors: Case['donors']; autoWhy: L2[] } | null;
  donors: ReturnType<typeof rankStsg> | ReturnType<typeof rankFtsg> | null;
  setting: Setting; malignancy: Malignancy; differential: DiffRow[]; clinNow: Clin; laterLabel: L2 | null; hold: 'bed' | 'revasc' | 'histology' | null;
  sections: Section[]; scaleNote: L2; tbsaPct: number | null; bsaM2: number | null;
}

const bsaMosteller = (h: number, w: number) => Math.sqrt((h * w) / 3600);

export function buildCase(a: Analysis,
  mask: Uint8Array, W: number, H: number, o: Overrides = {}): Case | null {
  const scaleFactor = a.width / W;
  const cmPerPx = (a.scale.mm_per_pixel * scaleFactor) / 10;
  const geo = buildGeo(mask, W, H, cmPerPx);
  if (!geo) return null;
  const areaCm2 = geo.areaPx * cmPerPx * cmPerPx;
  const t = a.tissue;
  const sg = a.signs;

  // type: the model's probabilities, adjusted by what the clinician adds (all optional), then the user's own choice wins
  const clin = o.clin || {};
  const probs = a.type?.probs || {};
  const solidity = typeof a.solidity === 'number' ? a.solidity : 1;
  const IDS: TypeId[] = ['pressure', 'diabetic', 'venous', 'surgical', 'trauma', 'other', 'burn', 'arterial', 'malignant'];
  const sc = {} as Record<TypeId, number>, why9 = {} as Record<TypeId, L2[]>;
  IDS.forEach((id) => { sc[id] = (probs[id] || 0) * 0.62; why9[id] = []; });
  sc.other += 0.01; // with no model and no answers the honest default is 'unclassified'
  const add = (id: TypeId, v: number, r: L2) => { sc[id] += v; why9[id].push(r); };
  if (a.type) IDS.slice(0, 6).forEach((id) => { if ((probs[id] || 0) >= 0.1) why9[id].push(L(`Photo model: ${Math.round((probs[id] || 0) * 100)}%`, `Model foto: ${Math.round((probs[id] || 0) * 100)}%`)); });
  if (clin.diabetes) add('diabetic', 0.2, L('Diabetes reported', 'Diabetes dilaporkan'));
  if (clin.burnCause) add('burn', 1.2, L('Caused by heat, chemical or electricity', 'Akibat panas, bahan kimia, atau listrik'));
  if (clin.biteCause) add('trauma', 0.5, L('Bite or other injury reported', 'Gigitan atau cedera lain dilaporkan'));
  if (clin.noPulse) add('arterial', 1.0, L('Absent pulses, rest pain or ABI below 0.5', 'Nadi tidak teraba, nyeri istirahat, atau ABI di bawah 0,5'));
  if (t.necrosis >= 40 && t.granulation < 20 && (o.region === 'foot' || o.region === 'heel')) add('arterial', 0.12, L('Dry dark tissue with no granulation on the foot', 'Jaringan gelap kering tanpa granulasi pada kaki'));
  if (o.region === 'lowerleg' && !clin.noPulse) add('venous', 0.18, L('Lower leg with palpable pulses', 'Tungkai bawah dengan nadi teraba'));
  let pts = 0; const malWhy: L2[] = [];
  const mp = (v: number, r: L2) => { pts += v; malWhy.push(r); };
  if (clin.pearly) mp(1.1, L('Pearly or rolled raised border', 'Tepi mutiara atau menggulung dan menonjol'));
  if (clin.pigmented) mp(1.0, L('Brown or black pigment, growing or changing', 'Pigmen cokelat atau hitam, membesar atau berubah'));
  if (clin.friable) mp(0.6, L('Bleeds easily or friable tissue', 'Mudah berdarah atau jaringan rapuh'));
  if (clin.sunSite) mp(0.5, L('Sun-exposed site', 'Lokasi terpapar matahari'));
  if (clin.chronic) mp(0.6, L('Not healed after 6 weeks of good care', 'Tidak sembuh setelah 6 minggu perawatan baik'));
  if (clin.scarHistory) mp(1.3, L('Arises on an old burn scar, radiotherapy field or decades-old ulcer', 'Muncul pada parut luka bakar lama, area radioterapi, atau ulkus puluhan tahun'));
  if (solidity < 0.72) mp(0.4, L('Very irregular edge in the photo', 'Tepi sangat tidak teratur pada foto'));
  if ((probs.other || 0) > 0.4) mp(0.3, L('The photo does not fit a typical benign wound', 'Foto tidak sesuai luka jinak yang khas'));
  if (t.necrosis >= 15 && t.granulation < 15 && (probs.other || 0) > 0.25) mp(0.3, L('Dark tissue without a granulating bed', 'Jaringan gelap tanpa dasar granulasi'));
  sc.malignant += pts * 0.34; if (pts) why9.malignant.push(...malWhy);
  const ranked = IDS.slice().sort((x, y) => sc[y] - sc[x]);
  const tot = IDS.reduce((q, id) => q + Math.max(0.001, sc[id]), 0);
  const differential: DiffRow[] = ranked.filter((id) => sc[id] / tot >= 0.04).slice(0, 5).map((id) => ({ id, share: sc[id] / tot, why: why9[id] }));
  const alts = ranked.map((id) => ({ id, p: probs[id] || 0 }));
  const typeAuto = !o.type;
  const type: TypeId = o.type || ranked[0] || 'other';
  const P = TYPES[type];
  const region: RegionId = o.region || P.region;
  const zone = REGIONS[region].zone;

  // wound bed readiness and infection from the photo itself
  const erythemaCm = typeof sg.erythema_extent_cm === 'number' ? sg.erythema_extent_cm : null;
  const infected = !!(sg.possible_purulent || (sg.erythema && (erythemaCm == null ? true : erythemaCm > 2)));
  let bedReady = !infected && t.necrosis < 20 && t.slough < 40;
  if (type === 'burn') bedReady = !infected; // burn eschar is excised and grafted early, it does not wait for a "clean" bed
  const hold: Case['hold'] = type === 'malignant' ? 'histology' : type === 'arterial' ? 'revasc' : (!bedReady ? 'bed' : null);
  if (hold === 'histology' || hold === 'revasc') bedReady = false;
  const tier: Malignancy['tier'] = type === 'malignant' || pts >= 2.2 ? 'high' : pts >= 1.0 ? 'intermediate' : 'low';
  const neo: { name: L2; v: number; why: L2 }[] = [
    { name: L('Melanoma (including amelanotic)', 'Melanoma (termasuk amelanotik)'), v: (clin.pigmented ? 2 : 0) + (solidity < 0.72 ? 0.6 : 0), why: L('Pigment that is growing or changing, an irregular edge; needs an excisional biopsy, not a shave.', 'Pigmen yang membesar atau berubah, tepi tidak teratur; perlu biopsi eksisional, bukan shave.') },
    { name: L('Basal cell carcinoma', 'Karsinoma sel basal'), v: (clin.pearly ? 2 : 0) + (clin.sunSite ? 0.8 : 0) + (clin.chronic ? 0.3 : 0), why: L('Pearly rolled border on sun-exposed skin that does not heal.', 'Tepi mutiara menggulung pada kulit terpapar matahari yang tidak sembuh.') },
    { name: L('Squamous cell carcinoma', 'Karsinoma sel skuamosa'), v: (clin.friable ? 1 : 0) + (clin.sunSite ? 0.7 : 0) + (clin.chronic ? 0.6 : 0) + (clin.scarHistory ? 0.5 : 0), why: L('Bleeding, crusted or tender growth, usually on sun-exposed skin or a chronic wound.', 'Pertumbuhan berdarah, berkrusta, atau nyeri, biasanya pada kulit terpapar matahari atau luka kronik.') },
    { name: L('Marjolin ulcer (carcinoma in a chronic wound or scar)', 'Ulkus Marjolin (karsinoma pada luka kronik atau parut)'), v: (clin.scarHistory ? 2.4 : 0) + (clin.chronic ? 0.6 : 0), why: L('A long-standing scar, burn or ulcer that has started to break down or grow.', 'Parut, luka bakar, atau ulkus lama yang mulai pecah atau tumbuh.') },
    { name: L('Merkel cell carcinoma or lymphoma', 'Karsinoma sel Merkel atau limfoma'), v: 0.15 + (pts >= 2.2 ? 0.25 : 0), why: L('Rapid, firm, painless nodule; only histology separates these.', 'Nodul cepat tumbuh, keras, tidak nyeri; hanya histologi yang membedakan.') },
  ];
  const neoplasm: Neoplasm[] = tier === 'low' ? [] : neo.sort((x, y) => y.v - x.v).slice(0, 3).map((q) => ({ name: q.name, why: q.why }));
  const malignancy: Malignancy = { flagged: tier !== 'low', tier, points: Math.round(pts * 10) / 10, reasons: malWhy, neoplasm };

  const wMm = geo.shape.rectShort * cmPerPx * 10;
  const aspect = geo.shape.rectLong / Math.max(geo.shape.rectShort, 1e-6);
  // depth: not measurable from a flat photo, so this is an estimate from appearance, size, type and site (shown with its range)
  const skinMm = ({ face: 1.5, scalp: 4, hand: 1.5, foot: 4, heel: 5, sacrum: 3, trunk: 3, lowerleg: 2.5, limb: 2.5, joint: 2 } as Record<string, number>)[region] ?? 3;
  const fatMm = ({ face: 4, scalp: 4, hand: 4, foot: 12, heel: 10, sacrum: 15, trunk: 18, lowerleg: 8, limb: 12, joint: 6 } as Record<string, number>)[region] ?? 10;
  const minorMm = Math.max(4, wMm);
  let dMid = a.depth_class === 'partial' ? Math.min(skinMm * 0.8, 0.8 + 0.05 * minorMm)
    : a.depth_class === 'full_granulating' ? Math.min(25, 2.5 + 0.1 * minorMm)
    : a.depth_class === 'full_devitalised' ? Math.min(30, 3.5 + 0.13 * minorMm) : Math.min(12, 2 + 0.07 * minorMm);
  dMid *= type === 'pressure' ? 1.3 : type === 'venous' ? 0.6 : type === 'trauma' ? 0.8 : type === 'burn' ? 0.5 : 1;
  const depthEst: DepthEst = { mm: Math.round(dMid * 10) / 10, loMm: Math.round(dMid * 0.55 * 10) / 10, hiMm: Math.round(dMid * 1.6 * 10) / 10, skinMm, fatMm,
    layer: dMid <= skinMm ? 'dermis' : dMid <= skinMm + fatMm ? 'subcutis' : 'deep' };
  const covered = t.slough + t.necrosis;
  const site = REGIONS[region].name;
  const grade: L2 = type === 'pressure'
    ? (depthEst.layer === 'dermis' ? L('Stage 2 (partial thickness)', 'Stadium 2 (ketebalan parsial)') : covered >= 60 ? L('Unstageable until debrided (base covered by slough or eschar)', 'Tidak dapat distadiumkan sebelum debridemen (dasar tertutup slough atau eskar)') : depthEst.layer === 'subcutis' ? L('Stage 3 (full thickness, fat visible)', 'Stadium 3 (ketebalan penuh, lemak terlihat)') : L('Stage 4 likely (muscle, tendon or bone may be exposed)', 'Kemungkinan stadium 4 (otot, tendon, atau tulang bisa terpapar)'))
    : type === 'diabetic'
    ? (depthEst.layer === 'dermis' ? L('Wagner grade 1 (superficial)', 'Wagner derajat 1 (superfisial)') : L('Wagner grade 2 or higher (deep; probe to bone and image to grade it)', 'Wagner derajat 2 atau lebih (dalam; probe-to-bone dan pencitraan untuk menentukan derajat)'))
    : type === 'venous' ? L('CEAP C6 (active ulcer)', 'CEAP C6 (ulkus aktif)')
    : type === 'surgical' ? (depthEst.layer === 'dermis' ? L('superficial incisional', 'insisional superfisial') : L('deep incisional (to fascia)', 'insisional dalam (hingga fasia)'))
    : type === 'trauma' ? (depthEst.layer === 'dermis' ? L('partial thickness', 'ketebalan parsial') : L('full thickness', 'ketebalan penuh'))
    : type === 'burn' ? (depthEst.layer === 'dermis' && covered < 30 ? L('superficial to superficial partial thickness (re-judge at 48 to 72 hours)', 'superfisial hingga parsial superfisial (nilai ulang pada 48 sampai 72 jam)') : covered >= 50 ? L('deep partial to full thickness (needs excision and grafting)', 'parsial dalam hingga ketebalan penuh (perlu eksisi dan cangkok)') : L('deep partial thickness likely', 'kemungkinan parsial dalam'))
    : type === 'arterial' ? (covered >= 50 ? L('WIfI wound grade 2 to 3 (deep or gangrenous); ischaemia grade needs ABI or toe pressure', 'WIfI luka derajat 2 sampai 3 (dalam atau gangren); derajat iskemia perlu ABI atau tekanan jari') : L('WIfI wound grade 1 to 2; ischaemia grade needs ABI or toe pressure', 'WIfI luka derajat 1 sampai 2; derajat iskemia perlu ABI atau tekanan jari'))
    : type === 'malignant' ? L(`${tier === 'high' ? 'High' : 'Intermediate'} suspicion: histology decides the diagnosis and the stage`, `Kecurigaan ${tier === 'high' ? 'tinggi' : 'sedang'}: histologi menentukan diagnosis dan stadium`)
    : L('grade cannot be assigned from the picture', 'derajat tidak dapat ditentukan dari gambar');
  const dxName: L2 = { en: `${TYPES[type].name.en}, ${site.en.toLowerCase()}`, id: `${TYPES[type].name.id}, ${site.id.toLowerCase()}` };
  const dx: Dx = { name: dxName, grade, one: L(`${(areaCm2 > 0 ? (geo.shape.rectLong * cmPerPx).toFixed(1) : '0')} × ${(wMm / 10).toFixed(1)} cm, about ${(depthEst.mm / 10).toFixed(1)} cm deep`, `${(geo.shape.rectLong * cmPerPx).toFixed(1)} × ${(wMm / 10).toFixed(1)} cm, kedalaman sekitar ${(depthEst.mm / 10).toFixed(1)} cm`) };
  const depth = a.depth_class === 'partial' ? 'partial' : 'full';
  const dctx = { areaCm2, region: REGION_MAP[region], zone, depth, exposed: [] as string[], bedReady, infected, dm: type === 'diabetic', pad: false, bsa: o.heightCm && o.weightKg ? bsaMosteller(o.heightCm, o.weightKg) : 1.8, age: o.age ?? null };
  dctx.pad = !!clin.noPulse || type === 'arterial';
  const onk = type === 'malignant' || (malignancy.tier === 'high' && type === 'other');
  /** the full plan for a given wound-bed state; used for the plan now and for the plan once the bed is clean */
  const planFor = (ready: boolean, inf: boolean, forced?: Tech) => {
    const dc = { ...dctx, bedReady: ready, infected: inf };
    const decision = decide(dc);
    const rec = recommend({ zone, areaCm2, wMm, aspect, bedReady: ready, infected: inf, onkologi: onk, depth, exposed: [] });
    let tech: Tech = rec.tech;
    if (decision.mode === 'flap' && !['vy', 'adv', 'flapbesar'].includes(tech)) tech = areaCm2 <= 12 ? (aspect < 2 ? 'vy' : 'adv') : 'flapbesar';
    if (decision.mode === 'graft' && !['stsg', 'ftsg'].includes(tech)) tech = decision.kind || 'stsg';
    if (decision.mode === 'debridement') tech = 'debridemen';
    if (!ready && hold === 'histology') tech = 'biopsy';
    if (forced) tech = forced;
    const plan = build(tech, geo, zone, {});
    let donors: Case['donors'] = null;
    if (tech === 'stsg') donors = rankStsg(dc, plan.meta.templateA || areaCm2);
    else if (tech === 'ftsg' && plan.meta.donorL) donors = rankFtsg(dc, plan.meta.donorL, plan.meta.donorW || 0);
    return { decision, plan, donors, autoWhy: [...rec.why, ...decision.why], tech };
  };
  const now = planFor(bedReady, infected, o.tech);
  const { decision, plan, donors, autoWhy } = now;
  const techAuto = !o.tech;
  const later = (decision.mode === 'debridement' && plan.tech === 'debridemen') || plan.tech === 'biopsy' ? planFor(true, false) : null;
  const laterLabel: L2 | null = !later ? null : hold === 'histology' ? L('After clear margins on histology: ', 'Setelah margin bebas pada histologi: ') : hold === 'revasc' ? L('After revascularisation: ', 'Setelah revaskularisasi: ') : L('Once the bed is clean: ', 'Setelah dasar bersih: ');

  const bsa = o.heightCm && o.weightKg ? bsaMosteller(o.heightCm, o.weightKg) : null;
  const tbsa = bsa ? (areaCm2 / (bsa * 10000)) * 100 : null;

  // where this should be handled
  const why: L2[] = [];
  let level: Setting['level'] = 'clinic';
  if (infected && (sg.possible_purulent || (erythemaCm != null && erythemaCm > 2))) { level = 'ed'; why.push(L('Signs of infection around the wound.', 'Tanda infeksi di sekitar luka.')); }
  if (t.necrosis >= 30 && (type === 'diabetic' || type === 'pressure')) { level = 'ed'; why.push(L('A lot of dead tissue in a wound that can threaten the limb or deepen quickly.', 'Banyak jaringan mati pada luka yang bisa mengancam tungkai atau cepat memburuk.')); }
  if (type === 'trauma' && areaCm2 > 4) { level = 'ed'; why.push(L('A fresh traumatic wound this size should be seen the same day for irrigation, closure and tetanus.', 'Luka trauma segar seukuran ini sebaiknya dilihat hari yang sama untuk irigasi, penutupan, dan tetanus.')); }
  if (level === 'clinic' && (decision.mode === 'flap' || areaCm2 > 36 || malignancy.flagged)) { level = 'refer'; why.push(decision.mode === 'flap' ? L('The wound needs a flap, which belongs to plastic surgery.', 'Luka memerlukan flap, yang merupakan ranah bedah plastik.') : malignancy.flagged ? L('Possible malignancy: biopsy and referral.', 'Kemungkinan keganasan: biopsi dan rujuk.') : L('A large defect.', 'Defek luas.')); }
  if (type === 'burn') { level = 'ed'; why.push(L('A burn needs same-day assessment of depth and TBSA, analgesia and tetanus.', 'Luka bakar perlu penilaian kedalaman dan luas (TBSA), analgesia, dan tetanus pada hari yang sama.')); if (depthEst.layer !== 'dermis' || covered >= 50 || (tbsa != null && tbsa > 10) || ['face', 'hand', 'joint'].includes(region)) why.push(L('Refer to a burn centre: deep burn, face, hands or joints, or a large area.', 'Rujuk ke pusat luka bakar: luka dalam, wajah, tangan atau sendi, atau area luas.')); }
  if (type === 'arterial') { level = 'ed'; why.push(L('Suspected critical limb ischaemia: perfusion must be measured and vascular surgery seen the same day.', 'Dugaan iskemia tungkai kritis: perfusi harus diukur dan bedah vaskular menilai pada hari yang sama.')); }
  if (type === 'malignant') { level = 'refer'; why.push(L('Suspected skin cancer: biopsy and a multidisciplinary review before any reconstruction.', 'Dugaan kanker kulit: biopsi dan tinjauan multidisiplin sebelum rekonstruksi apa pun.')); }
  if (!why.length) why.push(L('Stable looking wound with no infection signs: manageable in the clinic.', 'Luka tampak stabil tanpa tanda infeksi: dapat ditangani di poli.'));
  const setting: Setting = { level, label: level === 'ed' ? L('Emergency department now', 'IGD sekarang') : level === 'refer' ? L('Refer to plastic surgery or a wound team', 'Rujuk ke bedah plastik atau tim luka') : L('Outpatient clinic', 'Poli rawat jalan'), why };

  const sections: Section[] = [];
  const alerts: L2[] = [];
  if (infected) alerts.push(L('Possible infection: culture from deep tissue after debridement and start the antibiotic your protocol uses for this site.', 'Kemungkinan infeksi: kultur jaringan dalam setelah debridemen dan mulai antibiotik sesuai protokol untuk lokasi ini.'));
  if (t.necrosis >= 30) alerts.push(L(`About ${Math.round(t.necrosis)}% of the bed looks necrotic: check perfusion before debriding.`, `Sekitar ${Math.round(t.necrosis)}% dasar tampak nekrotik: periksa perfusi sebelum debridemen.`));
  if (a.scale.source === 'assumed_distance') alerts.push(L(`No reference object was found, so the size assumes a camera distance of 30 cm (about ±${a.scale.uncertainty_percent}% in length). Put a ruler or an ID card beside the wound for a true measurement.`, `Tidak ada benda acuan di foto, jadi ukuran memakai asumsi jarak kamera 30 cm (sekitar ±${a.scale.uncertainty_percent}% pada panjang). Letakkan penggaris atau kartu ID di sebelah luka untuk ukuran yang sebenarnya.`));
  if (alerts.length) sections.push({ id: 'alerts', title: L('Check first', 'Periksa dulu'), tone: 'alert', items: alerts });
  sections.push({ id: 'ed', title: L('In the emergency department now', 'Di IGD sekarang'), items: P.ed.en.map((_, i) => L(P.ed.en[i], P.ed.id[i])) });
  sections.push({ id: 'assess', title: L('What to assess', 'Yang perlu dinilai'), items: P.assess.en.map((_, i) => L(P.assess.en[i], P.assess.id[i])) });
  const dress: L2[] = [];
  if (t.necrosis >= 30) dress.push(TIME_RULES.necrosis30); else if (t.necrosis >= 10) dress.push(TIME_RULES.necrosis10);
  if (t.slough >= 30) dress.push(TIME_RULES.slough30); else if (t.slough >= 10) dress.push(TIME_RULES.slough10);
  if (t.granulation >= 50) dress.push(TIME_RULES.gran50);
  if (t.epithelium >= 30) dress.push(TIME_RULES.epi30);
  if (!dress.length) dress.push(TIME_RULES.unclear);
  sections.push({ id: 'dress', title: L('Dressing for this bed', 'Dressing untuk dasar luka ini'), items: dress });
  sections.push({ id: 'clinic', title: L('In the outpatient clinic', 'Di poli rawat jalan'), items: P.clinic.en.map((_, i) => L(P.clinic.en[i], P.clinic.id[i])) });
  sections.push({ id: 'definitive', title: L('Definitive treatment', 'Tata laksana definitif'), items: P.definitive.en.map((_, i) => L(P.definitive.en[i], P.definitive.id[i])) });
  sections.push({ id: 'abx', title: L('Antibiotics and tetanus', 'Antibiotik dan tetanus'), items: [P.abx, tetanus] });
  sections.push({ id: 'refer', title: L('When to refer', 'Kapan merujuk'), items: P.refer.en.map((_, i) => L(P.refer.en[i], P.refer.id[i])) });
  sections.push({ id: 'flags', title: L('Red flags', 'Tanda bahaya'), tone: 'alert', items: P.flags.en.map((_, i) => L(P.flags.en[i], P.flags.id[i])) });

  const scaleNote = a.scale.source === 'card' ? L('Scale from an ID card found in the photo.', 'Skala dari kartu ID yang ditemukan di foto.')
    : a.scale.source === 'user_reference' ? L('Scale from the reference you marked.', 'Skala dari acuan yang Anda tandai.')
    : a.scale.source === 'user_distance' ? L('Scale from the camera distance you entered.', 'Skala dari jarak kamera yang Anda masukkan.')
    : L('Scale estimated: camera optics and an assumed distance of 30 cm.', 'Skala diperkirakan: optik kamera dan asumsi jarak 30 cm.');
  return { differential, clinNow: clin, laterLabel, hold, depthEst, dx, type, typeConfidence: probs[type] ?? 0, typeAuto, typeAlternatives: alts.slice(0, 4), region, regionAuto: !o.region, geo, zone, areaCm2, tissue: t, depthClass: a.depth_class, decision, plan, techAuto, autoWhy, later: later && { decision: later.decision, plan: later.plan, donors: later.donors, autoWhy: later.autoWhy }, donors, setting, malignancy, sections, scaleNote, tbsaPct: tbsa, bsaM2: bsa };
}
