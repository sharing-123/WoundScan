/* Turns the server's automatic analysis into a complete case: type, site, graft or flap decision, surgical plan,
   donor ranking and written recommendations in both languages. Nothing here needs the clinician to fill a form. */
import { TYPES, REGIONS, TIME_RULES, tetanus, type TypeId, type RegionId, type L2 } from './kb';
import { buildGeo, type Geo } from '../plan/geom';
import { build, recommend, L, type Plan, type Tech } from '../plan/planner';
import { decide, rankStsg, rankFtsg, REGION_MAP, type Decision } from '../plan/donor';
import type { Analysis } from '../ui/api';

export interface Overrides { type?: TypeId; region?: RegionId; tech?: Tech; heightCm?: number; weightKg?: number; age?: number | null }
export interface Section { id: string; title: L2; tone?: 'alert' | 'plan'; items: L2[] }
export interface Setting { level: 'ed' | 'clinic' | 'refer'; label: L2; why: L2[] }

export interface Case {
  type: TypeId; typeConfidence: number; typeAuto: boolean; typeAlternatives: { id: TypeId; p: number }[];
  region: RegionId; regionAuto: boolean;
  geo: Geo; zone: string; areaCm2: number; tissue: Analysis['tissue']; depthClass: string;
  decision: Decision; plan: Plan; techAuto: boolean; autoWhy: L2[];
  later: { decision: Decision; plan: Plan; donors: Case['donors']; autoWhy: L2[] } | null;
  donors: ReturnType<typeof rankStsg> | ReturnType<typeof rankFtsg> | null;
  setting: Setting; malignancy: { flagged: boolean; reasons: L2[] };
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

  // type: the user's choice wins, otherwise the model's best guess
  const probs = a.type?.probs || {};
  const alts = Object.entries(probs).map(([id, p]) => ({ id: id as TypeId, p: p as number })).sort((x, y) => y.p - x.p);
  const typeAuto = !o.type;
  const type: TypeId = o.type || (alts[0]?.id as TypeId) || 'other';
  const P = TYPES[type];
  const region: RegionId = o.region || P.region;
  const zone = REGIONS[region].zone;

  // wound bed readiness and infection from the photo itself
  const erythemaCm = typeof sg.erythema_extent_cm === 'number' ? sg.erythema_extent_cm : null;
  const infected = !!(sg.possible_purulent || (sg.erythema && (erythemaCm == null ? true : erythemaCm > 2)));
  const bedReady = !infected && t.necrosis < 20 && t.slough < 40;
  const solidity = typeof a.solidity === 'number' ? a.solidity : 1;
  const malReasons: L2[] = [];
  if (type === 'other') malReasons.push(L('The picture does not fit a typical diabetic, pressure, venous, surgical or traumatic wound.', 'Gambaran tidak sesuai luka diabetik, tekan, vena, bedah, atau traumatik yang khas.'));
  if (solidity < 0.72) malReasons.push(L('The edge is very irregular.', 'Tepi sangat tidak teratur.'));
  if (t.necrosis >= 15 && t.granulation < 15 && type === 'other') malReasons.push(L('Dark tissue without a granulating bed.', 'Jaringan gelap tanpa dasar granulasi.'));
  const malignancy = { flagged: malReasons.length > 0, reasons: malReasons };

  const wMm = geo.shape.rectShort * cmPerPx * 10;
  const aspect = geo.shape.rectLong / Math.max(geo.shape.rectShort, 1e-6);
  const depth = a.depth_class === 'partial' ? 'partial' : 'full';
  const dctx = { areaCm2, region: REGION_MAP[region], zone, depth, exposed: [] as string[], bedReady, infected, dm: type === 'diabetic', pad: false, bsa: o.heightCm && o.weightKg ? bsaMosteller(o.heightCm, o.weightKg) : 1.8, age: o.age ?? null };
  const onk = malignancy.flagged && type === 'other';
  /** the full plan for a given wound-bed state; used for the plan now and for the plan once the bed is clean */
  const planFor = (ready: boolean, inf: boolean, forced?: Tech) => {
    const dc = { ...dctx, bedReady: ready, infected: inf };
    const decision = decide(dc);
    const rec = recommend({ zone, areaCm2, wMm, aspect, bedReady: ready, infected: inf, onkologi: onk, depth, exposed: [] });
    let tech: Tech = rec.tech;
    if (decision.mode === 'flap' && !['vy', 'adv', 'flapbesar'].includes(tech)) tech = areaCm2 <= 12 ? (aspect < 2 ? 'vy' : 'adv') : 'flapbesar';
    if (decision.mode === 'graft' && !['stsg', 'ftsg'].includes(tech)) tech = decision.kind || 'stsg';
    if (decision.mode === 'debridement') tech = 'debridemen';
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
  const later = decision.mode === 'debridement' && plan.tech === 'debridemen' ? planFor(true, false) : null;

  const bsa = o.heightCm && o.weightKg ? bsaMosteller(o.heightCm, o.weightKg) : null;
  const tbsa = bsa ? (areaCm2 / (bsa * 10000)) * 100 : null;

  // where this should be handled
  const why: L2[] = [];
  let level: Setting['level'] = 'clinic';
  if (infected && (sg.possible_purulent || (erythemaCm != null && erythemaCm > 2))) { level = 'ed'; why.push(L('Signs of infection around the wound.', 'Tanda infeksi di sekitar luka.')); }
  if (t.necrosis >= 30 && (type === 'diabetic' || type === 'pressure')) { level = 'ed'; why.push(L('A lot of dead tissue in a wound that can threaten the limb or deepen quickly.', 'Banyak jaringan mati pada luka yang bisa mengancam tungkai atau cepat memburuk.')); }
  if (type === 'trauma' && areaCm2 > 4) { level = 'ed'; why.push(L('A fresh traumatic wound this size should be seen the same day for irrigation, closure and tetanus.', 'Luka trauma segar seukuran ini sebaiknya dilihat hari yang sama untuk irigasi, penutupan, dan tetanus.')); }
  if (level === 'clinic' && (decision.mode === 'flap' || areaCm2 > 36 || malignancy.flagged)) { level = 'refer'; why.push(decision.mode === 'flap' ? L('The wound needs a flap, which belongs to plastic surgery.', 'Luka memerlukan flap, yang merupakan ranah bedah plastik.') : malignancy.flagged ? L('Possible malignancy: biopsy and referral.', 'Kemungkinan keganasan: biopsi dan rujuk.') : L('A large defect.', 'Defek luas.')); }
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
  return { type, typeConfidence: probs[type] ?? 0, typeAuto, typeAlternatives: alts.slice(0, 4), region, regionAuto: !o.region, geo, zone, areaCm2, tissue: t, depthClass: a.depth_class, decision, plan, techAuto, autoWhy, later: later && { decision: later.decision, plan: later.plan, donors: later.donors, autoWhy: later.autoWhy }, donors, setting, malignancy, sections, scaleNote, tbsaPct: tbsa, bsaM2: bsa };
}
