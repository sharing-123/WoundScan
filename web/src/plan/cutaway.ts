/* Layered cross-section of the operation, built from this case: how deep the wound is (estimate), which technique was
   chosen, and the order in which the layers are closed: deep (subcutaneous), dermal (subdermal), skin (outermost). */
import * as THREE from 'three';
import type { Case } from '../clinic/engine';
import type { L2 } from '../clinic/kb';
import { lang } from '../i18n';

const L = (en: string, id: string): L2 => ({ en, id });
const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export type Kind = 'closure' | 'flap' | 'graft' | 'debride' | 'secondary';
export interface Stage { id: string; t0: number; t1: number; title: L2; body: L2; layer?: 'deep' | 'dermal' | 'skin' }
export interface Timeline { kind: Kind; stages: Stage[]; win: Record<string, [number, number]> }

export function kindOf(cs: Case): Kind {
  const t = cs.plan.tech;
  return t === 'stsg' || t === 'ftsg' ? 'graft' : ['adv', 'vy', 'z', 'flapbesar'].includes(t) ? 'flap' : t === 'debridemen' ? 'debride' : t === 'sekunder' ? 'secondary' : 'closure';
}

export function timeline(cs: Case): Timeline {
  const kind = kindOf(cs), d = (cs.depthEst.mm / 10).toFixed(1);
  const layerEn = cs.depthEst.layer === 'dermis' ? 'the dermis' : cs.depthEst.layer === 'subcutis' ? 'the fat layer' : 'the fascia or deeper';
  const layerId = cs.depthEst.layer === 'dermis' ? 'dermis' : cs.depthEst.layer === 'subcutis' ? 'lapisan lemak' : 'fasia atau lebih dalam';
  const mk = (id: string, a: number, b: number, title: L2, body: L2, layer?: Stage['layer']): Stage => ({ id, t0: a, t1: b, title, body, layer });
  const deep = L('3-0 absorbable (for example Vicryl or Monocryl), interrupted, knots buried. These close the dead space and carry the tension so the skin does not have to.', '3-0 absorbable (misalnya Vicryl atau Monocryl), interrupted, simpul terkubur. Jahitan ini menutup ruang mati dan menanggung tegangan agar kulit tidak menanggungnya.');
  const dermal = L('4-0 absorbable, interrupted, placed in the deep dermis (subdermal). They bring the dermal edges together and turn the edge slightly outward so the scar sits flat.', '4-0 absorbable, interrupted, di dermis dalam (subdermal). Jahitan ini mempertemukan tepi dermis dan mengeversikan tepi sedikit agar bekas luka rata.');
  const skin = L('The outermost layer: 4-0 or 5-0 nylon or polypropylene, simple interrupted or vertical mattress, spaced by site. Removal after 5 to 14 days depending on the site.', 'Lapisan paling luar: nilon atau polipropilen 4-0 atau 5-0, simple interrupted atau vertical mattress, jarak sesuai lokasi. Dilepas 5 sampai 14 hari tergantung lokasi.');
  const mark = mk('mark', 0, 0.14, L('Marking', 'Marking'), L('Lines are drawn on the skin with a sterile marker before the first cut: the wound edge, the margin and the closing line. They are drawn from this photo.', 'Garis digambar di kulit dengan spidol steril sebelum sayatan pertama: tepi luka, margin, dan garis penutupan. Garis ini digambar dari foto ini.'));
  let stages: Stage[] = [], win: Timeline['win'] = {};
  if (kind === 'closure') {
    win = { cut: [0.14, 0.36], under: [0.36, 0.5], deep: [0.5, 0.62], dermal: [0.62, 0.74], skin: [0.74, 1] };
    stages = [mark,
      mk('cut', 0.14, 0.36, L('Excision', 'Eksisi'), L(`The wound edge is cut out to bleeding tissue. Here the defect reaches ${layerEn} (estimated depth about ${d} cm).`, `Tepi luka dieksisi hingga jaringan berdarah. Di sini defek mencapai ${layerId} (perkiraan kedalaman sekitar ${d} cm).`)),
      mk('under', 0.36, 0.5, L('Undermining', 'Undermining'), L('Skin and fat are released from the fascia below so the two edges meet without tension.', 'Kulit dan lemak dibebaskan dari fasia di bawahnya agar kedua tepi bertemu tanpa tegangan.')),
      mk('deep', 0.5, 0.62, L('Layer 1: deep (subcutaneous) sutures', 'Lapis 1: jahitan dalam (subkutan)'), deep, 'deep'),
      mk('dermal', 0.62, 0.74, L('Layer 2: dermal (subdermal) sutures', 'Lapis 2: jahitan dermal (subdermal)'), dermal, 'dermal'),
      mk('skin', 0.74, 1, L('Layer 3: skin sutures', 'Lapis 3: jahitan kulit'), skin, 'skin')];
  } else if (kind === 'flap') {
    win = { cut: [0.12, 0.3], lift: [0.3, 0.44], move: [0.44, 0.62], deep: [0.62, 0.72], dermal: [0.72, 0.8], skin: [0.8, 1] };
    stages = [mark,
      mk('cut', 0.12, 0.3, L('Incision of the flap and the defect', 'Sayatan flap dan defek'), L('The defect is excised and the flap is cut along the marked lines, keeping the base (pedicle) attached.', 'Defek dieksisi dan flap disayat sepanjang garis marking, dasar (pedikel) tetap menempel.')),
      mk('lift', 0.3, 0.44, L('Elevation', 'Elevasi'), L('The flap is lifted off the fascia with its fat and blood supply. Perforators at the base are protected.', 'Flap diangkat dari fasia bersama lemak dan pasokan darahnya. Perforator di dasar dilindungi.')),
      mk('move', 0.44, 0.62, L('Transposition', 'Transposisi'), L('The flap slides into the defect without twisting its base. The gap it leaves behind is closed in the next steps.', 'Flap digeser ke defek tanpa memutar dasarnya. Celah yang ditinggalkan ditutup pada langkah berikutnya.')),
      mk('deep', 0.62, 0.72, L('Layer 1: deep (subcutaneous) sutures', 'Lapis 1: jahitan dalam (subkutan)'), deep, 'deep'),
      mk('dermal', 0.72, 0.8, L('Layer 2: dermal (subdermal) sutures', 'Lapis 2: jahitan dermal (subdermal)'), dermal, 'dermal'),
      mk('skin', 0.8, 1, L('Layer 3: skin sutures', 'Lapis 3: jahitan kulit'), skin, 'skin')];
  } else if (kind === 'graft') {
    win = { harvest: [0.12, 0.3], mesh: [0.3, 0.4], place: [0.4, 0.62], fix: [0.62, 0.76], bolster: [0.76, 1] };
    stages = [mk('prep', 0, 0.12, L('Bed preparation', 'Persiapan dasar'), L('Dead tissue and slough are removed until the bed bleeds and is red and granular. A graft only takes on a bed with its own blood supply.', 'Jaringan mati dan slough dibuang hingga dasar berdarah, merah, dan granuler. Cangkok hanya hidup pada dasar yang berpembuluh.')),
      mk('harvest', 0.12, 0.3, L('Harvest from the donor site', 'Pengambilan dari area donor'), L('A dermatome shaves a thin sheet (0.2 to 0.3 mm) of skin, usually from the thigh. The donor site heals on its own like a graze.', 'Dermatom menyayat selembar kulit tipis (0,2 sampai 0,3 mm), biasanya dari paha. Area donor sembuh sendiri seperti lecet.')),
      mk('mesh', 0.3, 0.4, L('Meshing', 'Meshing'), L('The sheet is passed through a mesher (about 1 to 1.5) so it stretches to cover more area and lets fluid out.', 'Lembaran dilewatkan mesher (sekitar 1 banding 1,5) agar meregang menutup area lebih luas dan cairan bisa keluar.')),
      mk('place', 0.4, 0.62, L('Placement on the bed', 'Penempatan di dasar'), L('The graft is laid on the bed with the dermal side down and trimmed to the shape of the defect.', 'Cangkok diletakkan di dasar dengan sisi dermis di bawah dan dipangkas sesuai bentuk defek.')),
      mk('fix', 0.62, 0.76, L('Fixation at the edge', 'Fiksasi di tepi'), L('Staples or 4-0 absorbable sutures hold the edge. These are the only stitches: a graft has no deep layers to close.', 'Staples atau jahitan absorbable 4-0 memegang tepi. Hanya ini jahitannya: cangkok tidak punya lapisan dalam untuk dijahit.'), 'skin'),
      mk('bolster', 0.76, 1, L('Bolster or negative pressure', 'Bolster atau tekanan negatif'), L('A foam bolster or negative pressure dressing presses the graft onto the bed for 5 to 7 days so it cannot slide or collect fluid beneath.', 'Bolster busa atau dressing tekanan negatif menekan cangkok ke dasar selama 5 sampai 7 hari agar tidak bergeser atau menampung cairan.'))];
  } else if (kind === 'debride') {
    win = { cut: [0.15, 0.5], bed: [0.5, 0.65], npwt: [0.65, 1] };
    stages = [mark,
      mk('cut', 0.15, 0.5, L('Sharp debridement', 'Debridemen tajam'), L('Necrotic tissue and slough are cut away down to bleeding tissue, layer by layer. Perfusion is checked before cutting.', 'Jaringan nekrotik dan slough dipotong hingga jaringan berdarah, lapis demi lapis. Perfusi diperiksa sebelum memotong.')),
      mk('bed', 0.5, 0.65, L('Irrigation and a fresh bed', 'Irigasi dan dasar yang segar'), L('The bed is washed out and a deep tissue sample is taken for culture. Reconstruction waits until the bed is clean.', 'Dasar dibilas dan sampel jaringan dalam diambil untuk kultur. Rekonstruksi menunggu dasar bersih.')),
      mk('npwt', 0.65, 1, L('Negative pressure dressing', 'Dressing tekanan negatif'), L('A foam dressing under suction keeps the bed clean and builds granulation until a graft or flap can be done.', 'Dressing busa dengan hisapan menjaga dasar bersih dan membangun granulasi sampai cangkok atau flap bisa dikerjakan.'))];
  } else {
    win = { dress: [0, 1] };
    stages = [mk('dress', 0, 1, L('Moist dressing and follow-up', 'Dressing lembap dan kontrol'), L('The wound heals from the base up under a moist non-stick dressing. Measure it at every visit and compare.', 'Luka sembuh dari dasar ke atas di bawah dressing lembap non-lengket. Ukur setiap kunjungan dan bandingkan.'))];
  }
  return { kind, stages, win };
}

export function stageAt(tl: Timeline, t: number): Stage {
  return tl.stages.find((s) => t >= s.t0 && t < s.t1) || tl.stages[tl.stages.length - 1];
}

/* ---------------- textures ---------------- */
function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function tex(draw: (g: CanvasRenderingContext2D, r: () => number) => void, w = 256, h = 128) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!; draw(g, rng(5));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const fatTex = () => tex((g, r) => { g.fillStyle = '#efcb74'; g.fillRect(0, 0, 256, 128); for (let i = 0; i < 90; i++) { const x = r() * 256, y = r() * 128, q = 6 + r() * 14; const gr = g.createRadialGradient(x, y, 1, x, y, q); gr.addColorStop(0, 'rgba(255,236,170,.7)'); gr.addColorStop(1, 'rgba(200,150,60,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, q, 0, 6.3); g.fill(); } });
const dermTex = () => tex((g, r) => { g.fillStyle = '#e2b39b'; g.fillRect(0, 0, 256, 128); g.strokeStyle = 'rgba(255,235,220,.35)'; for (let i = 0; i < 70; i++) { g.lineWidth = 1 + r(); g.beginPath(); const y = r() * 128; g.moveTo(0, y); g.bezierCurveTo(70, y + 10 * r(), 150, y - 10 * r(), 256, y + 6 * r()); g.stroke(); } });
const musTex = () => tex((g, r) => { g.fillStyle = '#933636'; g.fillRect(0, 0, 256, 128); for (let i = 0; i < 80; i++) { g.strokeStyle = `rgba(${170 + r() * 60},${60 + r() * 40},${60 + r() * 30},${0.25 + r() * 0.3})`; g.lineWidth = 1 + r() * 3; const y = r() * 128; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y + 8, 160, y - 8, 256, y + 3); g.stroke(); } });
const mesh = (color: string, map?: THREE.Texture, rough = 0.55, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: map ? '#ffffff' : color, map, roughness: rough, ...extra });

export interface Cut { group: THREE.Group; update(t: number): void; dispose(): void; tl: Timeline }

export function buildCutaway(cs: Case): Cut {
  const tl = timeline(cs), kind = tl.kind, W = tl.win;
  const g = new THREE.Group();
  const BW = 5.4, BD = 1.6, epiU = 0.035, skinU = 0.26, fatU = 0.74, fasU = 0.05, musU = 0.65;
  const yEpi = -epiU, yDerm = -skinU, yFat = -(skinU + fatU), yFas = yFat - fasU, yMus = yFas - musU;
  const mm = cs.depthEst.mm, dermMm = cs.depthEst.skinMm, fatMm = cs.depthEst.fatMm;
  let dU = mm <= dermMm ? Math.max(0.06, (mm / dermMm) * skinU) : Math.min(skinU + fatU - 0.04, skinU + ((mm - dermMm) / fatMm) * fatU);
  if (kind === 'closure') dU = Math.max(dU, skinU + 0.16);
  if (kind === 'flap') dU = skinU + fatU; // flap defects are taken to the fascia
  const gw = kind === 'closure' ? 1.15 : kind === 'flap' ? 1.3 : 1.7;
  const disposables: { dispose(): void }[] = [];
  const fT = fatTex(), dT = dermTex(), mT = musTex();
  disposables.push(fT, dT, mT);
  const epiM = mesh('#c3866e', undefined, 0.5), dermM = mesh('#e2b39b', dT, 0.55), fatM = mesh('#efcb74', fT, 0.5), fasM = mesh('#f4efe3', undefined, 0.35), musM = mesh('#933636', mT, 0.45);
  const rawM = mesh('#d9847f', undefined, 0.35), bedM = mesh('#c3434e', undefined, 0.3, { emissive: new THREE.Color('#3a0508'), emissiveIntensity: 0.35 });
  disposables.push(epiM, dermM, fatM, fasM, musM, rawM, bedM);
  const edge = new THREE.LineBasicMaterial({ color: '#3a2a22', transparent: true, opacity: 0.45 }); disposables.push(edge);

  const box = (x0: number, x1: number, y0: number, y1: number, m: THREE.Material, parent: THREE.Object3D, z = BD) => {
    const geo = new THREE.BoxGeometry(Math.max(0.001, x1 - x0), Math.max(0.001, y0 - y1), z);
    const me = new THREE.Mesh(geo, m); me.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); me.castShadow = true; me.receiveShadow = true;
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edge); me.add(e); parent.add(me); disposables.push(geo);
    return me;
  };
  /** every skin layer between x0 and x1 down to the fascia, optionally with a thinner top (donor harvest zone) */
  const column = (x0: number, x1: number, parent: THREE.Object3D, topCut = 0) => {
    if (topCut > 0) { box(x0, x1, -topCut, yDerm, rawM === null ? dermM : dermM, parent); }
    else { box(x0, x1, 0, yEpi, epiM, parent); box(x0, x1, yEpi, yDerm, dermM, parent); }
    box(x0, x1, yDerm, yFat, fatM, parent);
  };

  // static base: fascia and muscle
  const base = new THREE.Group(); g.add(base);
  box(-BW / 2, BW / 2, yFat, yFas, fasM, base); box(-BW / 2, BW / 2, yFas, yMus, musM, base);

  const left = new THREE.Group(), right = new THREE.Group(), floor = new THREE.Group(), flapG = new THREE.Group(), remG = new THREE.Group();
  g.add(left, right, floor, flapG, remG);
  column(-BW / 2, -gw / 2, left);
  // floor of the notch
  if (dU < skinU + fatU - 0.001) {
    if (dU < skinU) box(-gw / 2, gw / 2, -dU, yDerm, dermM, floor);
    box(-gw / 2, gw / 2, Math.min(yDerm, -dU), yFat, fatM, floor);
  }
  const bedTop = -dU;

  const fw = 1.3, incW = 0.07;
  let graftSheet: THREE.Mesh | null = null, graftMat: THREE.MeshStandardMaterial | null = null, graftPlainTex: THREE.Texture | null = null, graftMeshTex: THREE.Texture | null = null;
  const harvestX0 = gw / 2 + 0.5, harvestW = gw + 0.15;
  if (kind === 'flap') {
    column(gw / 2, gw / 2 + fw, flapG);
    column(gw / 2 + fw + incW, BW / 2, remG);
  } else if (kind === 'graft') {
    column(gw / 2, harvestX0, right);
    column(harvestX0, harvestX0 + harvestW, right, 0.07);
    column(harvestX0 + harvestW, BW / 2, right);
    graftPlainTex = tex((q, r) => { q.fillStyle = '#d7a487'; q.fillRect(0, 0, 256, 128); for (let i = 0; i < 400; i++) { q.fillStyle = `rgba(255,${200 + r() * 40 | 0},190,.06)`; q.fillRect(r() * 256, r() * 128, 3, 3); } });
    graftMeshTex = tex((q, r) => { q.fillStyle = '#d7a487'; q.fillRect(0, 0, 256, 128); for (let row = 0; row < 8; row++) for (let col = 0; col < 14; col++) { const x = col * 19 + (row % 2) * 9 + 4, y = row * 16 + 8; q.fillStyle = 'rgba(170,52,62,.95)'; q.beginPath(); q.ellipse(x, y, 8, 2.2, 0, 0, 6.3); q.fill(); } void r; });
    disposables.push(graftPlainTex, graftMeshTex);
    graftMat = new THREE.MeshStandardMaterial({ map: graftPlainTex, roughness: 0.4 }); disposables.push(graftMat);
    const sg = new THREE.BoxGeometry(harvestW, 0.07, BD); disposables.push(sg);
    graftSheet = new THREE.Mesh(sg, graftMat); graftSheet.castShadow = true; g.add(graftSheet);
  } else {
    column(gw / 2, BW / 2, right);
  }

  // lesion that sits in the notch before the operation
  const tis = cs.tissue;
  const lesColor = tis.necrosis >= tis.slough && tis.necrosis >= tis.granulation ? '#2b2420' : tis.slough >= tis.granulation ? '#d9c26a' : '#c3434e';
  const lesM = mesh(lesColor, undefined, 0.6); disposables.push(lesM);
  const lesion = new THREE.Group(); g.add(lesion);
  if (kind !== 'graft') { box(-gw / 2, gw / 2, 0, -dU * 0.55, lesM, lesion); box(-gw / 2, gw / 2, -dU * 0.55, -dU, mesh('#d9c26a', undefined, 0.6), lesion); }
  const bedFill = box(-gw / 2, gw / 2, bedTop + 0.001, bedTop - 0.012, bedM, g); // bleeding bed surface
  // graft: the bed in the notch is the wound itself
  void bedFill;

  // negative pressure foam and film for the debridement / graft finish
  const foamM = new THREE.MeshStandardMaterial({ color: kind === 'graft' ? '#9bb7c9' : '#2d2f34', roughness: 0.95 }); disposables.push(foamM);
  const foam = box(-gw / 2 - 0.15, gw / 2 + 0.15, 0.28, 0.0, foamM, g, BD - 0.1); foam.visible = false;
  const filmM = new THREE.MeshPhysicalMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.28, roughness: 0.05, transmission: 0.6 }); disposables.push(filmM);
  const film = new THREE.Mesh(new THREE.BoxGeometry(gw + 1.2, 0.012, BD), filmM); film.position.y = 0.3; film.visible = false; g.add(film); disposables.push(film.geometry);
  const tubeM = new THREE.MeshStandardMaterial({ color: '#e8eef2', roughness: 0.4 }); disposables.push(tubeM);

  // skin marker lines on the top surface
  const penM = new THREE.MeshBasicMaterial({ color: '#7a66ff' }); disposables.push(penM);
  const pens: THREE.Mesh[] = [];
  [-gw / 2 - 0.05, gw / 2 + 0.05].forEach((x) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, BD + 0.02), penM); m.position.set(x, 0.008, 0); g.add(m); pens.push(m); disposables.push(m.geometry); });

  /* ---- suture threads ---- */
  const threadM = new THREE.MeshStandardMaterial({ color: '#2a3fa0', roughness: 0.4 }), threadDeep = new THREE.MeshStandardMaterial({ color: '#7c4dff', roughness: 0.4 }), threadDerm = new THREE.MeshStandardMaterial({ color: '#17a2b8', roughness: 0.4 }), nylon = new THREE.MeshStandardMaterial({ color: '#15110e', roughness: 0.35 });
  disposables.push(threadM, threadDeep, threadDerm, nylon);
  interface Th { mesh: THREE.Mesh; knot: THREE.Mesh; layer: 'deep' | 'dermal' | 'skin'; ifc: number; z: number; idx: number; n: number }
  const ths: Th[] = [];
  const nIfc = kind === 'flap' ? 2 : kind === 'closure' ? 1 : 0;
  const zFront = BD / 2 + 0.012;
  const addThread = (layer: Th['layer'], ifc: number, z: number, idx: number, n: number) => {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), layer === 'deep' ? threadDeep : layer === 'dermal' ? threadDerm : nylon);
    m.castShadow = true; m.visible = false; g.add(m);
    const k = new THREE.Mesh(new THREE.SphereGeometry(layer === 'skin' ? 0.03 : 0.05, 10, 8), m.material); k.visible = false; g.add(k); disposables.push(k.geometry);
    ths.push({ mesh: m, knot: k, layer, ifc, z, idx, n });
  };
  for (let i = 0; i < nIfc; i++) {
    addThread('deep', i, zFront, 0, 1); addThread('dermal', i, zFront, 0, 1);
    for (let j = 0; j < 5; j++) addThread('skin', i, -BD / 2 + 0.2 + (j * (BD - 0.4)) / 4, j, 5);
  }
  void threadM;
  const stapleM = new THREE.MeshStandardMaterial({ color: '#c9ced4', metalness: 0.8, roughness: 0.25 }); disposables.push(stapleM);
  const staples: THREE.Mesh[] = [];
  if (kind === 'graft') for (let side = 0; side < 2; side++) for (let j = 0; j < 4; j++) {
    const s = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 6, 12, Math.PI), stapleM); s.rotation.z = Math.PI; s.visible = false; g.add(s); staples.push(s); disposables.push(s.geometry);
    s.userData = { side, z: -BD / 2 + 0.25 + (j * (BD - 0.5)) / 3 };
  }
  const setTube = (th: Th, pts: THREE.Vector3[] | null) => {
    th.mesh.visible = !!pts; th.knot.visible = !!pts;
    if (!pts) return;
    th.mesh.geometry.dispose();
    th.mesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 26, th.layer === 'skin' ? 0.017 : 0.024, 6, false);
    th.knot.position.copy(pts[Math.floor(pts.length / 2)]);
  };

  const gapF = (t: number) => {
    const [a, b] = W.deep || [1, 1], [c, d] = W.dermal || [1, 1];
    return t < a ? 1 : t < b ? lerp(1, 0.42, seg(t, a, b)) : t < c ? 0.42 : lerp(0.42, 0, seg(t, c, d));
  };

  const update = (t: number) => {
    const gf = gapF(t);
    // marker lines
    const markA = 1 - seg(t, 0.12, 0.2);
    pens.forEach((p) => { p.visible = markA > 0.02 && kind !== 'secondary'; p.scale.y = 1; });
    // lesion: lifted out in the cutting phase
    const [c0, c1] = W.cut || [0.14, 0.36];
    const cutE = kind === 'secondary' ? 0 : seg(t, c0, c1);
    lesion.visible = kind !== 'graft' && cutE < 0.999;
    lesion.position.set(1.5 * cutE, 1.1 * Math.sin(Math.min(1, cutE * 1.3) * Math.PI * 0.5), 0.3 * cutE);
    lesion.rotation.z = -0.5 * cutE;
    lesion.children.forEach((c, i) => { const m = c as THREE.Mesh; m.visible = !(kind === 'debride' && i === 0 && cutE > 0.5 && false); });
    // sides
    left.position.x = 0; right.position.x = 0; flapG.position.set(0, 0, 0); remG.position.set(0, 0, 0); floor.scale.x = 1; floor.visible = true;
    let ifcX: [number, number][] = [];
    if (kind === 'closure') {
      const under = seg(t, W.under[0], W.under[1]);
      const lift = Math.sin(Math.PI * under) * 0.07;
      left.position.y = lift; right.position.y = lift;
      const sh = (gw / 2) * (1 - gf);
      left.position.x = sh; right.position.x = -sh;
      floor.scale.x = Math.max(0.001, gf); floor.visible = gf > 0.02;
      const bite = 0.28;
      ifcX = [[-gw / 2 + left.position.x - bite * 0, gw / 2 + right.position.x]];
    } else if (kind === 'flap') {
      const lf = seg(t, W.lift[0], W.lift[1]), mv = seg(t, W.move[0], W.move[1]);
      const fx = -(gw - 0.14) * mv - 0.14 * (1 - gf);
      const rx = (fx - incW) * (1 - gf);
      const h = 0.45 * lf * (1 - mv) + 0.18 * Math.sin(Math.PI * mv) * lf;
      flapG.position.set(fx, h, 0); flapG.rotation.z = -0.12 * Math.sin(Math.PI * mv);
      remG.position.set(rx * 1, 0, 0);
      floor.visible = false;
      ifcX = [[-gw / 2, gw / 2 + fx], [gw / 2 + fw + fx, gw / 2 + fw + incW + rx]];
      lesion.visible = lesion.visible && t < W.lift[0];
    } else if (kind === 'graft') {
      floor.visible = true;
    }
    // graft sheet
    if (graftSheet && graftMat) {
      const h = seg(t, W.harvest[0], W.harvest[1]), ms = seg(t, W.mesh[0], W.mesh[1]), pl = seg(t, W.place[0], W.place[1]);
      graftMat.map = ms > 0.5 ? graftMeshTex : graftPlainTex; graftMat.needsUpdate = true;
      const x0 = harvestX0 + harvestW / 2, y0 = -0.035, x1 = 0, y1 = bedTop + 0.045;
      const lift = Math.sin(Math.PI * Math.min(1, h)) * 0.9 * (1 - pl);
      graftSheet.position.set(lerp(x0, x1, pl) + 0.15 * Math.sin(Math.PI * h) * (1 - pl), lerp(y0, y1, pl) + lift + 0.5 * h * (1 - pl), 0);
      graftSheet.rotation.z = (-0.5 * Math.sin(Math.PI * h) + 0.0) * (1 - pl);
      const stretch = lerp(1, (gw + 0.1) / harvestW, ms); graftSheet.scale.x = stretch * (1 + 0.0);
      ifcX = [];
    }
    // threads
    ths.forEach((th) => {
      const [xl, xr] = ifcX[th.ifc] || [0, 0];
      const [wa, wb] = W[th.layer === 'skin' ? 'skin' : th.layer];
      const prog = (t - wa) / (wb - wa);
      if (th.layer === 'skin') {
        const k = prog * 1.1 - (th.idx / th.n) * 0.7;
        if (k <= 0) return setTube(th, null);
        const xm = (xl + xr) / 2, z = th.z, lift = 0.05 + 0.1 * gf, dx = (xr - xl) / 2;
        setTube(th, [new THREE.Vector3(xl - 0.2, -0.09, z), new THREE.Vector3(xl - 0.2, 0.012, z), new THREE.Vector3(xm - dx * 0.5, lift, z), new THREE.Vector3(xm, lift * 1.15, z), new THREE.Vector3(xm + dx * 0.5, lift, z), new THREE.Vector3(xr + 0.2, 0.012, z), new THREE.Vector3(xr + 0.2, -0.09, z)]);
        th.mesh.scale.setScalar(Math.min(1, k * 1.5));
      } else {
        if (prog <= -0.0001 && t < wa) return setTube(th, null);
        const y = th.layer === 'deep' ? yDerm - fatU * 0.72 : -skinU * 0.55;
        const xm = (xl + xr) / 2, z = zFront, slack = 0.03 + 0.12 * Math.min(1, (xr - xl) / gw), bite = 0.3, sag = th.layer === 'deep' ? 0.09 : 0.05;
        setTube(th, [new THREE.Vector3(xl - bite, y + 0.09, z), new THREE.Vector3(xl - bite - 0.06, y - 0.01, z), new THREE.Vector3(xl - 0.04, y - sag, z), new THREE.Vector3(xm, y - sag - slack, z), new THREE.Vector3(xr + 0.04, y - sag, z), new THREE.Vector3(xr + bite + 0.06, y - 0.01, z), new THREE.Vector3(xr + bite, y + 0.09, z)]);
        th.mesh.scale.setScalar(1);
      }
    });
    // graft staples, bolster and dressings
    const fix = W.fix ? seg(t, W.fix[0], W.fix[1]) : 0;
    staples.forEach((s, i) => { const side = s.userData.side as number; s.visible = fix * 4 > (i % 4) * 0.9 + 0.05; s.position.set(side ? gw / 2 : -gw / 2, bedTop + 0.04, s.userData.z as number); s.scale.setScalar(Math.min(1, fix * 3)); });
    const bolster = kind === 'graft' ? seg(t, W.bolster[0], W.bolster[1]) : kind === 'debride' ? seg(t, W.npwt[0], W.npwt[1]) : kind === 'secondary' ? seg(t, 0.2, 0.9) : 0;
    foam.visible = bolster > 0.001; foam.position.y = lerp(0.9, kind === 'graft' ? bedTop + 0.14 : -dU * 0.5 + 0.12, ease(bolster)); foam.scale.y = kind === 'graft' ? 0.55 : 1;
    film.visible = bolster > 0.7; film.position.y = 0.02 + 0.02 * (1 - bolster);
    bedFill.visible = kind === 'closure' ? cutE > 0.3 && gf > 0.5 : kind === 'graft' ? t < (W.place?.[0] ?? 1) + 0.1 : (kind === 'debride' ? cutE > 0.3 : cutE > 0.3 && !(kind === 'flap' && t > W.move[0]));
    void tubeM;
  };
  update(0);
  return { group: g, update, tl, dispose: () => { disposables.forEach((d) => d.dispose()); g.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); }); } };
}

export const layerLegend = () => [
  { c: '#c3866e', t: lang() === 'id' ? 'Epidermis' : 'Epidermis' },
  { c: '#e2b39b', t: lang() === 'id' ? 'Dermis' : 'Dermis' },
  { c: '#efcb74', t: lang() === 'id' ? 'Lemak subkutan' : 'Subcutaneous fat' },
  { c: '#f4efe3', t: lang() === 'id' ? 'Fasia' : 'Fascia' },
  { c: '#933636', t: lang() === 'id' ? 'Otot' : 'Muscle' },
  { c: '#7c4dff', t: lang() === 'id' ? 'Jahitan dalam' : 'Deep sutures' },
  { c: '#17a2b8', t: lang() === 'id' ? 'Jahitan dermal' : 'Dermal sutures' },
  { c: '#15110e', t: lang() === 'id' ? 'Jahitan kulit' : 'Skin sutures' },
];
