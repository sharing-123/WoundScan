/* Surgical planner: from the wound mask to marking geometry (working px), numbers (mm), steps, and the pieces that the 3D
   viewer animates. Deterministic and bilingual. An estimate from a 2D photo: laxity, perfusion and curvature are not measured. */
import { polyArea, type Geo, type P2 } from './geom';
import type { L2 } from '../clinic/kb';

export const L = (en: string, id: string): L2 => ({ en, id });
export type Tech = 'linear' | 'fusiform' | 'adv' | 'vy' | 'z' | 'stsg' | 'ftsg' | 'debridemen' | 'sekunder' | 'flapbesar' | 'biopsy';

export const TECH_NAME: Record<Tech, L2> = {
  linear: L('Direct linear closure', 'Penutupan linear langsung'),
  fusiform: L('Fusiform excision and primary closure', 'Eksisi fusiform dan tutup primer'),
  adv: L('Advancement flap', 'Flap advancement'),
  vy: L('V-Y advancement flap', 'Flap V-Y'),
  z: L('Z-plasty', 'Z-plasti'),
  stsg: L('Split thickness skin graft (STSG)', 'Cangkok kulit tebal-terbelah (STSG)'),
  ftsg: L('Full thickness skin graft (FTSG)', 'Cangkok kulit tebal-penuh (FTSG)'),
  debridemen: L('Debridement and bed preparation', 'Debridemen dan persiapan dasar'),
  sekunder: L('Healing by secondary intention', 'Penyembuhan sekunder'),
  flapbesar: L('Regional or free flap (further planning)', 'Flap regional atau bebas (perencanaan lanjut)'),
  biopsy: L('Biopsy and staging first (no reconstruction yet)', 'Biopsi dan staging dulu (belum rekonstruksi)'),
};

const ZONE: Record<string, { sp: number; bite: number; thread: L2; remove: L2; maxClose: number }> = {
  estetik: { sp: 4, bite: 2.5, thread: L('6-0 nylon or polypropylene', '6-0 nilon atau polipropilen'), remove: L('5 to 7 days', '5 sampai 7 hari'), maxClose: 15 },
  fungsional: { sp: 5, bite: 3, thread: L('5-0 nylon', '5-0 nilon'), remove: L('10 to 14 days', '10 sampai 14 hari'), maxClose: 15 },
  umum: { sp: 8, bite: 5, thread: L('4-0 nylon with 4-0 absorbable dermis', '4-0 nilon dengan dermis 4-0 absorbable'), remove: L('10 to 14 days', '10 sampai 14 hari'), maxClose: 30 },
  'tungkai-bawah': { sp: 8, bite: 5, thread: L('4-0 nylon', '4-0 nilon'), remove: L('10 to 21 days', '10 sampai 21 hari'), maxClose: 12 },
  tekanan: { sp: 10, bite: 8, thread: L('2-0 absorbable dermis with 3-0 nylon', '2-0 absorbable dermis dengan 3-0 nilon'), remove: L('14 to 21 days', '14 sampai 21 hari'), maxClose: 30 },
  khusus: { sp: 5, bite: 3, thread: L('4-0 or 5-0 absorbable', '4-0 atau 5-0 absorbable'), remove: L('by site', 'sesuai lokasi'), maxClose: 15 },
};

const rad = (d: number) => (d * Math.PI) / 180;
const frame = (th: number) => ({ u: [Math.cos(th), Math.sin(th)] as P2, v: [-Math.sin(th), Math.cos(th)] as P2 });
type Fr = ReturnType<typeof frame>;
const toUV = (p: P2, c: P2, f: Fr): P2 => [(p[0] - c[0]) * f.u[0] + (p[1] - c[1]) * f.u[1], (p[0] - c[0]) * f.v[0] + (p[1] - c[1]) * f.v[1]];
const fromUV = (q: P2, c: P2, f: Fr): P2 => [c[0] + q[0] * f.u[0] + q[1] * f.v[0], c[1] + q[0] * f.u[1] + q[1] * f.v[1]];

function profile(ratio: number, apexDeg: number) {
  const s = Math.min(1.6, Math.tan(rad(apexDeg / 2)) * ratio);
  const Pt = [[0, 0], [0.38, Math.min(0.9, 0.38 * s)], [0.62, 1], [1, 1]];
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i <= 80; i++) {
    const t = i / 80, m = 1 - t;
    xs.push(m * m * m * Pt[0][0] + 3 * m * m * t * Pt[1][0] + 3 * m * t * t * Pt[2][0] + t * t * t * Pt[3][0]);
    ys.push(m * m * m * Pt[0][1] + 3 * m * m * t * Pt[1][1] + 3 * m * t * t * Pt[2][1] + t * t * t * Pt[3][1]);
  }
  const g = (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = xs.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] <= x) lo = mid; else hi = mid; }
    const t = (x - xs[lo]) / (xs[hi] - xs[lo] || 1);
    return ys[lo] + t * (ys[hi] - ys[lo]);
  };
  let area = 0;
  for (let i = 1; i < xs.length; i++) area += ((xs[i] - xs[i - 1]) * (ys[i] + ys[i - 1])) / 2;
  return { g, areaNorm: area };
}
type Prof = ReturnType<typeof profile>;

function enclose(pts: P2[], ratio: number, apexDeg: number) {
  const pr = profile(ratio, apexDeg);
  let umax = 0, vmax = 0;
  for (const q of pts) { umax = Math.max(umax, Math.abs(q[0])); vmax = Math.max(vmax, Math.abs(q[1])); }
  const ok = (b: number) => {
    const a = ratio * b;
    for (const q of pts) { const x = (a - Math.abs(q[0])) / a; if (x < 0) return false; if (Math.abs(q[1]) > b * pr.g(x) + 1e-9) return false; }
    return true;
  };
  const lo0 = Math.max(vmax, umax / ratio) * 0.999;
  let hi = lo0 * 6 + 1;
  if (!ok(hi)) hi *= 4;
  let lo = lo0;
  for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; }
  return { a: ratio * hi, b: hi, pr };
}

function outlineFusiform(a: number, b: number, pr: Prof, c: P2, f: Fr, n = 40): P2[] {
  const up: P2[] = [], dn: P2[] = [];
  for (let i = 0; i <= 2 * n; i++) {
    const u = -a + (2 * a * i) / (2 * n);
    const x = (a - Math.abs(u)) / a;
    const v = b * pr.g(x);
    up.push([u, v]);
    dn.push([u, -v]);
  }
  return up.concat(dn.reverse()).map((q) => fromUV(q, c, f));
}

function sutureLayout(lenMm: number, spMm: number) {
  const tip = spMm / 2;
  const usable = Math.max(lenMm - 2 * tip, spMm);
  let n = Math.max(3, Math.round(usable / spMm) + 1);
  if (n % 2 === 0) n += 1;
  const step = usable / (n - 1);
  const pos: number[] = [];
  for (let i = 0; i < n; i++) pos.push(-usable / 2 + i * step);
  const order: number[] = [];
  const q: [number, number][] = [[0, n - 1]];
  while (q.length) { const [lo, hi] = q.shift()!; if (lo > hi) continue; const mid = (lo + hi) >> 1; order.push(mid); q.push([lo, mid - 1], [mid + 1, hi]); }
  const rank = new Array<number>(n);
  order.forEach((idx, k) => (rank[idx] = k + 1));
  return { n, step, pos, rank };
}

function halfExtents(g: Geo, c: P2, f: Fr, uVal: number, vmax: number): [number, number] | null {
  let lo: number | null = null, hi: number | null = null;
  for (let v = -vmax; v <= vmax; v += 0.5) {
    const p = fromUV([uVal, v], c, f);
    const x = Math.round(p[0]), y = Math.round(p[1]);
    if (x < 0 || y < 0 || x >= g.W || y >= g.H) continue;
    if (g.mask[y * g.W + x]) { if (lo === null) lo = v; hi = v; }
  }
  return lo === null ? null : [lo, hi as number];
}

export interface Item { t: 'line' | 'poly' | 'label' | 'dot' | 'arrow'; a?: P2; b?: P2; p?: P2[] | P2; s: string; w?: number; fill?: string; text?: string }
export interface Num { k: L2; v: string | L2; u?: string | L2; warn?: boolean }
export interface Piece { id: string; role: 'excise' | 'flap' | 'graft' | 'slough'; poly: P2[]; move?: { dx: number; dy: number; rot?: number; pivot?: P2 }; from?: P2 }
export interface Plan {
  tech: Tech; title: L2; items: Item[]; nums: Num[]; steps: L2[]; notes: L2[]; pieces: Piece[]; zone: string; spacing: number;
  after: { kind: string; region?: P2[]; lines?: P2[][]; edge?: P2[]; a?: P2; b?: P2; n?: number; mesh?: number };
  dims: { lMm: number; wMm: number }; meta: { templateA?: number; donorA?: number; donorL?: number; donorW?: number }; frameTh: number;
}

export interface Ctx { zone: string; areaCm2: number; wMm: number; aspect: number; ratio?: number; bedReady: boolean; infected: boolean; onkologi: boolean; depth: string; exposed: string[]; laxMm?: number }

export function recommend(c: Ctx): { tech: Tech; why: L2[] } {
  const why: L2[] = [];
  const Z = ZONE[c.zone] || ZONE.umum;
  const maxC = c.laxMm || Z.maxClose;
  if (c.infected || !c.bedReady) {
    why.push(L('The wound bed is not ready (infection, necrosis or heavy slough): debride and control infection first, definitive reconstruction waits.', 'Dasar luka belum siap (infeksi, nekrosis, atau slough dominan): debridemen dan kendali infeksi dulu, rekonstruksi definitif ditunda.'));
    return { tech: 'debridemen', why };
  }
  if (c.onkologi) why.push(L('Suspicious lesion: excise with histology-based margins and reconstruct after clear margins are confirmed.', 'Lesi curiga keganasan: eksisi dengan margin sesuai histologi, rekonstruksi setelah margin bebas dikonfirmasi.'));
  if (c.depth === 'partial' && !c.onkologi) {
    if (c.areaCm2 <= 4) { why.push(L('Small partial thickness injury (4 cm² or less): heals by secondary intention under a moist dressing.', 'Cedera parsial kecil (≤ 4 cm²): sembuh sekunder dengan dressing lembap.')); return { tech: 'sekunder', why }; }
    why.push(L('Large partial thickness injury: thin STSG if it has not epithelialised in 2 to 3 weeks.', 'Cedera parsial luas: STSG tipis bila tidak epitelisasi dalam 2 sampai 3 minggu.'));
    return { tech: 'stsg', why };
  }
  if (c.exposed.length) {
    why.push(L('A vital structure is exposed: it needs tissue with its own blood supply, not a graft.', 'Struktur penting terpapar: perlu jaringan berpembuluh sendiri, bukan cangkok langsung.'));
    if (c.areaCm2 <= 12 && ['umum', 'estetik', 'tekanan', 'fungsional'].includes(c.zone)) { why.push(L('Defect of 12 cm² or less: local flap.', 'Defek ≤ 12 cm²: flap lokal.')); return { tech: c.aspect < 2 ? 'vy' : 'adv', why }; }
    why.push(L('Large defect or difficult zone: regional or free flap, planned with perforator imaging.', 'Defek luas atau zona sulit: flap regional atau bebas dengan pencitraan perforator.'));
    return { tech: 'flapbesar', why };
  }
  if (c.zone === 'tekanan' && c.depth === 'full') {
    why.push(L('Full thickness wound in a pressure zone: a muscle or fasciocutaneous (V-Y) flap after nutrition and pressure relief are optimised.', 'Zona tekanan, ketebalan penuh: flap otot atau fasiokutan (V-Y) setelah nutrisi dan penurunan tekanan dioptimalkan.'));
    return { tech: 'vy', why };
  }
  const w = c.wMm, ratio = c.ratio || 4;
  if (c.aspect >= ratio && w <= Math.min(maxC, 12)) { why.push(L(`Linear wound (length to width ${c.aspect.toFixed(1)}:1): direct layered closure along the long axis.`, `Luka linear (rasio P:L ${c.aspect.toFixed(1)}:1): tutup langsung berlapis sepanjang sumbu panjang.`)); return { tech: 'linear', why }; }
  if (w <= maxC) { why.push(L(`Width ${w.toFixed(1)} mm is within the primary closure limit for this zone (${maxC} mm, a rule of thumb): ${ratio}:1 fusiform excision and layered closure.`, `Lebar defek ${w.toFixed(1)} mm di bawah ambang tutup primer zona (${maxC} mm, heuristik): eksisi fusiform ${ratio}:1 lalu tutup berlapis.`)); return { tech: 'fusiform', why }; }
  if ((c.zone === 'estetik' || c.zone === 'fungsional') && c.areaCm2 <= 20) { why.push(L('Too wide for primary closure in an aesthetic or functional zone: FTSG (less contraction, better colour) or a local flap.', 'Terlalu lebar untuk tutup primer di zona estetik atau fungsional: FTSG (kontraksi kurang, warna lebih baik) atau flap lokal.')); return { tech: 'ftsg', why }; }
  why.push(L(`Width ${w.toFixed(1)} mm exceeds the primary closure limit (${maxC} mm): STSG on a granulating bed, or a local flap if function or appearance matters.`, `Lebar ${w.toFixed(1)} mm melebihi ambang tutup primer (${maxC} mm): STSG pada dasar granulasi atau flap lokal bila fungsi atau estetik penting.`));
  return { tech: 'stsg', why };
}

export interface Opts { theta?: number; spacing?: number; bite?: number; ratio?: number; marginMm?: number; flapK?: number; flipDir?: boolean; mesh?: number; zAngle?: number; laxMm?: number }

export function build(tech: Tech, g: Geo, zone: string, o: Opts = {}): Plan {
  const cm = g.cmPerPx;
  const mm = (px: number) => px * cm * 10;
  const pxOf = (m: number) => m / (cm * 10);
  const Z = ZONE[zone] || ZONE.umum;
  const th = o.theta ?? g.theta0;
  const fr = frame(th);
  const c = g.centroid;
  const items: Item[] = [], nums: Num[] = [], steps: L2[] = [], notes: L2[] = [], pieces: Piece[] = [];
  const sp = o.spacing || Z.sp, bite = o.bite || Z.bite, ratio = o.ratio || 4, apex = 30;
  const region = (o.marginMm && o.marginMm > 0 ? g.marginPoly(o.marginMm) : g.poly) || g.poly;
  const pts = region.filter((_, i) => i % Math.max(1, Math.floor(region.length / 300)) === 0);
  const uv = pts.map((p) => toUV(p, c, fr));
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  uv.forEach((q) => { u0 = Math.min(u0, q[0]); u1 = Math.max(u1, q[0]); v0 = Math.min(v0, q[1]); v1 = Math.max(v1, q[1]); });
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, c2 = fromUV([cu, cv], c, fr);
  const rel = uv.map((q): P2 => [q[0] - cu, q[1] - cv]);
  const lMm = mm(u1 - u0), wMm = mm(v1 - v0);
  const N = (k: L2, v: string | L2, u: string | L2 = '', warn = false) => nums.push({ k, v, u, warn });
  const line = (a: P2, b: P2, s: string, w: number) => items.push({ t: 'line', a, b, s, w });
  const poly = (p: P2[], s: string, fill?: string) => items.push({ t: 'poly', p, s, fill });
  const label = (p: P2, text: string, s: string) => items.push({ t: 'label', p, text, s });
  const dot = (p: P2, s: string) => items.push({ t: 'dot', p, s });
  const arrow = (a: P2, b: P2, s: string) => items.push({ t: 'arrow', a, b, s });
  N(L('Defect (length x width)', 'Defek (panjang × lebar)'), `${lMm.toFixed(1)} × ${wMm.toFixed(1)}`, 'mm');
  if (o.marginMm && o.marginMm > 0) N(L('Excision margin', 'Margin eksisi'), o.marginMm.toFixed(1), 'mm');
  let after: Plan['after'] = { kind: 'none' };
  const meta: Plan['meta'] = {};
  const sutThread = L(Z.thread.en, Z.thread.id);

  if (tech === 'linear' || tech === 'fusiform') {
    let aSemi: number, bSemi: number, pr: Prof | null = null, outline: P2[] | null = null;
    if (tech === 'fusiform') {
      const e = enclose(rel, ratio, apex);
      aSemi = e.a; bSemi = e.b; pr = e.pr;
      outline = outlineFusiform(aSemi, bSemi, pr, c2, fr);
      poly(outline, 'incise', 'excise');
      pieces.push({ id: 'excise', role: 'excise', poly: outline });
      N(L('Excision ellipse (length x width)', 'Elips eksisi (panjang × lebar)'), `${mm(2 * aSemi).toFixed(1)} × ${mm(2 * bSemi).toFixed(1)}`, 'mm');
      N(L('Length to width ratio', 'Rasio panjang : lebar'), `${(aSemi / bSemi).toFixed(2)} : 1`);
      N(L('Apex angle', 'Sudut apeks'), `${apex}°`);
      const exArea = 4 * aSemi * bSemi * pr.areaNorm;
      N(L('Skin removed', 'Luas kulit diangkat'), (exArea * cm * cm).toFixed(2), 'cm²');
      N(L('Healthy skin taken with it', 'Kulit sehat ikut terangkat'), Math.max(0, (exArea - g.areaPx) * cm * cm).toFixed(2), 'cm²');
    } else {
      aSemi = (u1 - u0) / 2 + pxOf(1.5); bSemi = (v1 - v0) / 2;
      N(L('Closure line length', 'Panjang garis tutup'), mm(2 * aSemi).toFixed(1), 'mm');
    }
    const Len = mm(2 * aSemi);
    const S = sutureLayout(Len, sp);
    line(fromUV([-aSemi, 0], c2, fr), fromUV([aSemi, 0], c2, fr), 'closure', 1.6);
    S.pos.forEach((pm, i) => {
      const uPx = pxOf(pm);
      const he: [number, number] = tech === 'fusiform' && pr
        ? (() => { const x = (aSemi - Math.abs(uPx)) / aSemi; return [-bSemi * pr!.g(x), bSemi * pr!.g(x)] as [number, number]; })()
        : halfExtents(g, c2, fr, uPx, bSemi * 2 + 5) || [-bSemi, bSemi];
      const pA = fromUV([uPx, he[0] - pxOf(bite)], c2, fr), pB = fromUV([uPx, he[1] + pxOf(bite)], c2, fr);
      line(pA, pB, 'stitch', 1.1); dot(pA, 'stitchdot'); dot(pB, 'stitchdot'); label(pB, String(S.rank[i]), 'num');
    });
    N(L('Interrupted sutures', 'Jahitan simpul'), String(S.n), L('pcs', 'buah'));
    N(L('Suture spacing', 'Jarak antar jahitan'), S.step.toFixed(1), 'mm');
    N(L('Bite from the edge', 'Jarak tusuk dari tepi'), bite.toFixed(1), 'mm');
    N(L('Suture material', 'Benang'), sutThread);
    N(L('Suture removal', 'Lepas jahitan'), Z.remove);
    const ok = (tech === 'fusiform' ? mm(2 * bSemi) : wMm) <= (o.laxMm || Z.maxClose);
    N(L('Closure tension (rule of thumb)', 'Tegangan penutupan (heuristik)'), ok ? L('primary closure possible', 'dapat tutup primer') : L('likely tight: wide undermining or a flap', 'kemungkinan tegang: undermining luas atau flap'), '', !ok);
    steps.push(
      tech === 'fusiform' ? L('Mark the ellipse (purple) along the relaxed skin tension line; the hatch is the skin that comes out.', 'Tandai elips (ungu) searah garis tegangan kulit; hatch adalah kulit yang diangkat.') : L('Mark the closure line along the long axis of the wound.', 'Tandai garis tutup sepanjang sumbu luka.'),
      L('Infiltrate local anaesthetic, incise perpendicular to the skin, excise down to fat or fascia as the depth requires.', 'Anestesi infiltrasi, insisi tegak lurus kulit, eksisi hingga lemak atau fasia sesuai kedalaman.'),
      L('Undermine in the subdermal plane for roughly half to one defect width on each side.', 'Undermining pada bidang subdermal selebar kira-kira setengah sampai satu lebar defek di tiap sisi.'),
      L(`Deep dermal sutures, then ${S.n} skin sutures in the numbered order (halving rule).`, `Jahit dermis dalam, lalu ${S.n} jahitan kulit dengan urutan angka (aturan separuh).`),
      L(`Remove sutures at ${Z.remove.en}.`, `Lepas jahitan ${Z.remove.id}.`),
    );
    if (tech === 'fusiform') notes.push(L('If the apex angle goes past 30 degrees a standing cone (dog ear) forms: lengthen the ends or excise a Burow triangle.', 'Bila sudut apeks lebih dari 30° terbentuk standing cone (dog-ear): perpanjang ujung atau eksisi segitiga Burow.'));
    after = { kind: 'closure', region: tech === 'fusiform' && outline ? outline : g.poly, a: fromUV([-aSemi, 0], c2, fr), b: fromUV([aSemi, 0], c2, fr), n: S.n };
  } else if (tech === 'adv' || tech === 'vy') {
    const dir = o.flipDir ? -1 : 1;
    const edge = dir > 0 ? u1 : u0;
    const wPx = v1 - v0;
    const k = o.flapK || 3;
    poly(region, 'excise', 'excise'); poly(region, 'incise');
    poly([fromUV([u0, v0], c, fr), fromUV([u1, v0], c, fr), fromUV([u1, v1], c, fr), fromUV([u0, v1], c, fr)], 'margin');
    line(fromUV([edge, v0], c, fr), fromUV([edge, v1], c, fr), 'flaptip', 1.6);
    const toward: P2 = [-dir * fr.u[0] * (u1 - u0), -dir * fr.u[1] * (u1 - u0)];
    if (tech === 'adv') {
      const Lf = k * wPx;
      const A1 = fromUV([edge, v0], c, fr), A2 = fromUV([edge + dir * Lf, v0], c, fr), B1 = fromUV([edge, v1], c, fr), B2 = fromUV([edge + dir * Lf, v1], c, fr);
      line(A1, A2, 'incise', 2); line(B1, B2, 'incise', 2); line(A2, B2, 'flaptip', 1.6);
      arrow(fromUV([edge + dir * Lf * 0.7, cv], c, fr), fromUV([edge - dir * (u1 - u0) * 0.35, cv], c, fr), 'arrow');
      N(L('Advancement flap (width x length)', 'Flap advancement (lebar × panjang)'), `${mm(wPx).toFixed(1)} × ${mm(Lf).toFixed(1)}`, 'mm');
      N(L('Flap length to width', 'Rasio panjang : lebar flap'), `${k.toFixed(1)} : 1`);
      N(L('Advance needed', 'Jarak maju yang dibutuhkan'), mm(u1 - u0).toFixed(1), 'mm');
      N(L('Total flap incision', 'Total garis insisi flap'), mm(2 * Lf + wPx).toFixed(1), 'mm');
      const S = sutureLayout(mm(Lf), sp);
      N(L('Flap edge sutures (estimate)', 'Jahitan sisi flap (perkiraan)'), String(2 * S.n));
      steps.push(
        L('Mark the defect (hatch) and two parallel flap limbs from its corners.', 'Tandai defek (hatch) dan dua garis sejajar sumbu flap dari sudut defek.'),
        L('Incise the flap limbs to fascia and raise the flap on a well-perfused base.', 'Insisi sisi flap hingga fasia, angkat flap dengan pedikel pada dasar berpembuluh.'),
        L('Undermine and advance the flap into the defect without tension; excise Burow triangles for any standing cone at the base.', 'Undermining dan majukan flap ke defek tanpa tegangan; eksisi segitiga Burow bila ada standing cone di dasar.'),
        L('Close dermis, then skin; drain if there is dead space.', 'Jahit dermis lalu kulit; drain bila ada ruang mati.'),
      );
      const flapPoly = [A1, A2, B2, B1];
      pieces.push({ id: 'excise', role: 'excise', poly: region });
      pieces.push({ id: 'flap', role: 'flap', poly: flapPoly, move: { dx: toward[0], dy: toward[1] } });
      after = { kind: 'adv', region, lines: [[A1, A2], [B1, B2], [A2, B2]], edge: [fromUV([edge, v0], c, fr), fromUV([edge, v1], c, fr)] };
    } else {
      const Dv = 2.5 * wPx;
      const apexPt = fromUV([edge + dir * Dv, cv], c, fr);
      const B1 = fromUV([edge, v0], c, fr), B2 = fromUV([edge, v1], c, fr);
      line(B1, apexPt, 'incise', 2); line(B2, apexPt, 'incise', 2);
      arrow(fromUV([edge + dir * Dv * 0.55, cv], c, fr), fromUV([edge - dir * (u1 - u0) * 0.35, cv], c, fr), 'arrow');
      const ang = (2 * Math.atan(wPx / 2 / Dv) * 180) / Math.PI;
      N(L('V-Y flap (base x height)', 'Flap V-Y (basis × tinggi)'), `${mm(wPx).toFixed(1)} × ${mm(Dv).toFixed(1)}`, 'mm');
      N(L('V apex angle', 'Sudut apeks V'), `${ang.toFixed(1)}°`);
      N(L('Y limb length after closure', 'Panjang garis Y setelah tutup'), mm(Dv).toFixed(1), 'mm');
      const S = sutureLayout(mm(Dv), sp);
      N(L('Sutures (estimate)', 'Jahitan (perkiraan)'), String(2 * S.n + 3));
      steps.push(
        L('Mark the defect (hatch) and the V triangle with its base on the defect edge.', 'Tandai defek (hatch) dan segitiga V dengan basis pada tepi defek.'),
        L('Incise the sides of the V to fascia; keep the subcutaneous or muscle base (the perforator supply) and do not free the base.', 'Insisi sisi V hingga fasia; pertahankan dasar subkutan atau otot (pasokan perforator), jangan melepas dasar.'),
        L('Advance the island into the defect and close the donor as a Y (the V becomes a Y).', 'Majukan pulau ke defek; tutup donor sebagai garis Y (V menjadi Y).'),
        L('Close dermis, then skin.', 'Jahit dermis lalu kulit.'),
      );
      pieces.push({ id: 'excise', role: 'excise', poly: region });
      pieces.push({ id: 'flap', role: 'flap', poly: [B1, apexPt, B2], move: { dx: toward[0], dy: toward[1] } });
      after = { kind: 'vy', region, lines: [[B1, apexPt], [B2, apexPt]], edge: [B1, B2] };
    }
    notes.push(L('Estimated from a 2D photo: check donor tissue laxity and the perforator direction before marking on the patient.', 'Perkiraan dari 2D: periksa laksitas jaringan donor dan arah perforator sebelum menandai di pasien.'));
    if (mm(wPx) > 60 || (g.areaPx * cm * cm) > 36) {
      N(L('Warning', 'Peringatan'), L('outside local flap range', 'di luar kisaran flap lokal'), '', true);
      notes.push(L('Width over 60 mm or area over 36 cm²: think about a regional or free flap or a graft. This marking only shows the geometry.', 'Lebar > 60 mm atau luas > 36 cm²: pertimbangkan flap regional atau bebas atau cangkok kulit. Marking ini hanya ilustrasi geometri.'));
    }
  } else if (tech === 'z') {
    const A = g.shape.feretA, B = g.shape.feretB;
    const lenPx = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const al = rad(o.zAngle || 60);
    const dx = (B[0] - A[0]) / lenPx, dy = (B[1] - A[1]) / lenPx;
    const rot = (x: number, y: number, a: number): P2 => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
    const r1 = rot(dx, dy, al);
    const A2: P2 = [A[0] + r1[0] * lenPx, A[1] + r1[1] * lenPx], B2: P2 = [B[0] - r1[0] * lenPx, B[1] - r1[1] * lenPx];
    line(A, B, 'incise', 2); line(A, A2, 'incise', 2); line(B, B2, 'incise', 2);
    label(A2, "A'", 'num'); label(B2, "B'", 'num'); label(A, 'A', 'num'); label(B, 'B', 'num');
    const gain = ({ 30: 25, 45: 50, 60: 75, 75: 100, 90: 120 } as Record<number, number>)[Math.round(o.zAngle || 60)] || 75;
    N(L('Central limb (AB)', 'Tungkai pusat (AB)'), mm(lenPx).toFixed(1), 'mm');
    N(L('Lateral limbs', 'Tungkai lateral'), mm(lenPx).toFixed(1), 'mm');
    N(L('Z angle', 'Sudut Z'), String(o.zAngle || 60), '°');
    N(L('Theoretical lengthening', 'Pemanjangan teoretis'), `${gain} %`);
    N(L('New length along the axis', 'Panjang baru sepanjang sumbu'), (mm(lenPx) * (1 + gain / 100)).toFixed(1), 'mm');
    steps.push(
      L('Draw the central limb along the scar or contracture (AB), then two lateral limbs of equal length at the same angle.', 'Gambar tungkai pusat sepanjang parut atau kontraktur (AB), lalu dua tungkai lateral sama panjang pada sudut yang sama.'),
      L('Incise all three limbs and raise the two triangular flaps on their pedicles.', 'Insisi ketiga tungkai; angkat dua flap segitiga dengan pedikel berpembuluh.'),
      L('Transpose the flaps and suture.', 'Transposisi kedua flap lalu jahit.'),
    );
    notes.push(L('For a mature scar or contracture, not an acute open wound.', 'Z-plasti untuk parut atau kontraktur yang sudah matang, bukan luka akut terbuka.'));
    pieces.push({ id: 'z1', role: 'flap', poly: [A, B, A2], move: { dx: 0, dy: 0, rot: Math.PI / 2, pivot: [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2] } });
    pieces.push({ id: 'z2', role: 'flap', poly: [A, B, B2], move: { dx: 0, dy: 0, rot: -Math.PI / 2, pivot: [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2] } });
    after = { kind: 'z', lines: [[A, B], [A, A2], [B, B2]] };
  } else if (tech === 'stsg' || tech === 'ftsg') {
    const tpl = g.marginPoly(tech === 'stsg' ? 1 : 0.5) || g.poly;
    poly(tpl, 'graft', 'graft'); poly(g.poly, 'incise');
    const Aarea = Math.abs(polyArea(tpl)) * cm * cm;
    meta.templateA = Aarea;
    N(L('Defect area to graft, with margin', 'Luas defek (cangkok) termasuk tepi'), Aarea.toFixed(2), 'cm²');
    if (tech === 'stsg') {
      const mesh = o.mesh || 1.5;
      meta.donorA = Aarea / mesh;
      N(L('Mesh ratio', 'Rasio mesh'), `1 : ${mesh}`);
      N(L('Donor area needed', 'Luas donor dibutuhkan'), (Aarea / mesh).toFixed(2), 'cm²');
      N(L('Graft thickness', 'Ketebalan cangkok'), L('0.20 to 0.30', '0,20 sampai 0,30'), 'mm');
      const side = Math.sqrt(Aarea / mesh);
      N(L('Rough donor (equivalent square)', 'Donor kasar (persegi setara)'), `${side.toFixed(1)} × ${side.toFixed(1)}`, 'cm');
      steps.push(
        L('Prepare the bed: healthy granulation, no slough or infection, haemostasis.', 'Persiapan dasar: granulasi sehat, tanpa slough atau infeksi, hemostasis.'),
        L(`Harvest the STSG with a dermatome (lateral thigh), mesh 1:${mesh}; fix with staples or sutures; negative pressure or a bolster for 5 to 7 days.`, `Ambil STSG dengan dermatom (paha lateral), mesh 1:${mesh}; fiksasi dengan staples atau jahitan; tekanan negatif atau bolster 5 sampai 7 hari.`),
        L('Donor site: occlusive or alginate dressing for 10 to 14 days.', 'Donor: dressing oklusif atau alginat 10 sampai 14 hari.'),
      );
      after = { kind: 'stsg', region: tpl, mesh };
    } else {
      const donorA = Aarea * 1.1;
      const pr = profile(3, 30);
      const b = Math.sqrt(donorA / (4 * 3 * pr.areaNorm));
      const a = 3 * b;
      meta.donorA = donorA; meta.donorL = 2 * a; meta.donorW = 2 * b;
      N(L('FTSG donor area (+10%)', 'Luas donor FTSG (+10%)'), donorA.toFixed(2), 'cm²');
      N(L('Donor ellipse (length x width)', 'Donor elips (panjang × lebar)'), `${(2 * a).toFixed(1)} × ${(2 * b).toFixed(1)}`, 'cm');
      steps.push(
        L('Make a template of the defect; harvest an FTSG ellipse at 3:1 and close the donor primarily.', 'Buat templat defek; harvest elips FTSG rasio 3:1 dan tutup donor primer.'),
        L('Defat, suture the edges, tie-over bolster for 5 to 7 days.', 'Defatting, jahit tepi, bolster tie-over 5 sampai 7 hari.'),
      );
      after = { kind: 'ftsg', region: tpl };
    }
    pieces.push({ id: 'graft', role: 'graft', poly: tpl, from: [-(g.W * 0.62), g.H * 0.05] });
    notes.push(L('A graft takes only on a vascular bed: not over bone without periosteum or tendon without paratenon.', 'Cangkok hanya pada dasar berpembuluh; tidak di atas tulang tanpa periosteum atau tendon tanpa paratenon.'));
  } else if (tech === 'biopsy') {
    poly(g.poly, 'margin');
    const nB = Math.max(2, Math.min(4, Math.round((g.shape.rectLong * cm) / 2)));
    for (let i = 0; i < nB; i++) { const q = g.poly[Math.floor(((i + 0.5) * g.poly.length) / nB)]; dot(q, 'biopsy'); label([q[0] + 10, q[1] - 10], `${i + 1}`, 'biopsy'); }
    N(L('Punch biopsies (4 mm, at the edge with normal skin)', 'Biopsi punch (4 mm, di tepi dengan kulit normal)'), String(nB));
    N(L('Lesion size', 'Ukuran lesi'), `${(g.shape.rectLong * cm).toFixed(1)} × ${(g.shape.rectShort * cm).toFixed(1)}`, 'cm');
    steps.push(
      L('Photograph with a scale and examine the lymph node basin.', 'Foto dengan skala dan periksa kelenjar regional.'),
      L(`Local anaesthetic, then ${nB} punch biopsies of 4 mm from the edge, each including normal skin; for a suspected melanoma take an excisional biopsy with a 2 mm margin instead.`, `Anestesi lokal, lalu ${nB} biopsi punch 4 mm dari tepi, masing-masing termasuk kulit normal; untuk dugaan melanoma lakukan biopsi eksisional dengan margin 2 mm.`),
      L('Send to pathology with the clinical question; review the result in 1 to 2 weeks and plan margins and reconstruction from it.', 'Kirim ke patologi dengan pertanyaan klinis; tinjau hasil dalam 1 sampai 2 minggu dan rencanakan margin serta rekonstruksi darinya.'),
    );
    notes.push(L('Nothing is cut out or grafted until the histology is back.', 'Tidak ada yang dieksisi atau dicangkok sebelum hasil histologi keluar.'));
    after = { kind: 'none' };
  } else if (tech === 'debridemen') {
    const m2 = g.marginPoly(2) || g.poly;
    poly(m2, 'incise', 'excise'); poly(g.poly, 'margin');
    N(L('Debridement area with 2 mm margin', 'Area debridemen termasuk tepi 2 mm'), (Math.abs(polyArea(m2)) * cm * cm).toFixed(2), 'cm²');
    steps.push(
      L('Sharp debridement of necrotic tissue and slough down to bleeding tissue; irrigate.', 'Debridemen tajam jaringan nekrotik dan slough hingga jaringan berdarah; irigasi.'),
      L('Tissue culture; negative pressure or a dressing matched to exudate; repeat debridement if needed.', 'Kultur jaringan; tekanan negatif atau dressing sesuai eksudat; ulang debridemen bila perlu.'),
      L('Plan the reconstruction once the bed is clean.', 'Rencanakan rekonstruksi setelah dasar bersih.'),
    );
    pieces.push({ id: 'slough', role: 'slough', poly: m2 });
    after = { kind: 'bed', region: m2 };
  } else if (tech === 'sekunder') {
    poly(g.poly, 'margin');
    N(L('Area', 'Luas'), (g.areaPx * cm * cm).toFixed(2), 'cm²');
    steps.push(L('Moist non-adherent dressing; measure and compare at every visit.', 'Dressing lembap non-lengket; ukur dan bandingkan tiap kunjungan.'));
    after = { kind: 'secondary', region: g.poly };
  } else {
    const m2 = g.marginPoly(2) || g.poly;
    poly(m2, 'incise', 'excise');
    N(L('Defect area with 2 mm margin', 'Area defek termasuk tepi 2 mm'), (Math.abs(polyArea(m2)) * cm * cm).toFixed(2), 'cm²');
    steps.push(
      L('Debride to viable tissue; negative pressure as a bridge.', 'Debridemen hingga jaringan viabel; tekanan negatif sebagai jembatan.'),
      L('CT angiography or Doppler for perforators; choose a perforator, muscle or free flap by region and size.', 'CT angiografi atau Doppler perforator; pilih flap perforator, otot, atau bebas sesuai regio dan ukuran.'),
      L('Plan with the microvascular team if a free flap is needed.', 'Rencanakan bersama tim mikrovaskular bila flap bebas.'),
    );
    pieces.push({ id: 'slough', role: 'slough', poly: m2 });
    after = { kind: 'bed', region: m2 };
  }
  return { tech, title: TECH_NAME[tech], items, nums, steps, notes, pieces, after, meta, dims: { lMm, wMm }, zone, spacing: sp, frameTh: th };
}

export { ZONE };
