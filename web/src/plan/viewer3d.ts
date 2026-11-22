/* Interactive 3D surgery table, generated from the uploaded photo.
   - the skin sheet carries the photo as texture and is dented where the mask is
   - the pieces of the plan (excised tissue, flap, graft, slough) are extruded from their own polygons and wear the
     photo's pixels, so a flap really carries the skin it was cut from
   - drag to orbit, scrub the timeline, peel the skin back like a page, pull the layers apart */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';
import type { Stage } from './raster';
import type { Case } from '../clinic/engine';
import { edt, gauss, type P2 } from './geom';
import { marking } from './draw';
import { kFor } from './plate';
import { lang } from '../i18n';
import { pick } from '../clinic/kb';

const T = (en: string, id: string) => (lang() === 'id' ? id : en);
const WU = 4; // sheet width in world units
const BED_Z = -0.075;

function canvasTex(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function fatTexture(st: Stage, W: number, H: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round((1024 * H) / W);
  const g = c.getContext('2d')!;
  g.fillStyle = '#e8c27a'; g.fillRect(0, 0, c.width, c.height);
  const r = rng(7);
  for (let i = 0; i < 2600; i++) {
    const x = r() * c.width, y = r() * c.height, rad = 4 + r() * 16;
    const gr = g.createRadialGradient(x, y, 1, x, y, rad);
    gr.addColorStop(0, 'rgba(255,230,160,.55)'); gr.addColorStop(1, 'rgba(190,140,70,.0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 6.3); g.fill();
  }
  g.strokeStyle = 'rgba(255,245,230,.22)'; g.lineWidth = 1.4;
  for (let i = 0; i < 160; i++) { g.beginPath(); const x = r() * c.width, y = r() * c.height; g.moveTo(x, y); g.bezierCurveTo(x + 30, y + 10, x + 50, y - 20, x + 90 * r(), y + 30 * (r() - 0.5)); g.stroke(); }
  // the wound bed keeps its own pixels
  const m = document.createElement('canvas'); m.width = c.width; m.height = c.height;
  const mg = m.getContext('2d')!;
  mg.drawImage(st.img, 0, 0, c.width, c.height);
  mg.globalCompositeOperation = 'destination-in';
  const mk = document.createElement('canvas'); mk.width = st.W; mk.height = st.H;
  const kg = mk.getContext('2d')!; const id = kg.createImageData(st.W, st.H);
  for (let i = 0; i < st.W * st.H; i++) { id.data[i * 4] = 255; id.data[i * 4 + 1] = 255; id.data[i * 4 + 2] = 255; id.data[i * 4 + 3] = st.mask[i] ? 255 : 0; }
  kg.putImageData(id, 0, 0);
  mg.filter = 'blur(2px)'; mg.drawImage(mk, 0, 0, c.width, c.height); mg.filter = 'none';
  g.drawImage(m, 0, 0);
  return c;
}

function muscleTexture(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8c2f2f'; g.fillRect(0, 0, 512, 512);
  const r = rng(3);
  for (let i = 0; i < 700; i++) {
    const y = r() * 512, x = r() * 512;
    g.strokeStyle = `rgba(${150 + r() * 70},${50 + r() * 40},${50 + r() * 30},${0.2 + r() * 0.3})`; g.lineWidth = 1 + r() * 3;
    g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 40, y + 8, x + 90, y - 8, x + 150 + r() * 80, y + 4); g.stroke();
  }
  return c;
}

function wallTexture(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 8; c.height = 256;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#b98a6e'); gr.addColorStop(0.035, '#d9a58b'); gr.addColorStop(0.16, '#e9bfa4');
  gr.addColorStop(0.2, '#efd08a'); gr.addColorStop(0.62, '#e8c27a'); gr.addColorStop(0.68, '#f4efe4');
  gr.addColorStop(0.72, '#a43a3a'); gr.addColorStop(1, '#7c2a2a');
  g.fillStyle = gr; g.fillRect(0, 0, 8, 256);
  return c;
}

function skinSample(st: Stage): [number, number, number] {
  const d = edt(st.mask, st.W, st.H);
  const r: number[] = [], g: number[] = [], b: number[] = [];
  for (let i = 0; i < st.W * st.H; i += 3) if (!st.mask[i] && d[i] > 8 && d[i] < 40) { r.push(st.rgba[i * 4]); g.push(st.rgba[i * 4 + 1]); b.push(st.rgba[i * 4 + 2]); }
  const med = (a: number[]) => { if (!a.length) return 200; a.sort((x, y) => x - y); return a[a.length >> 1]; };
  return [med(r), med(g), med(b)];
}

function graftTexture(tone: [number, number, number], meshed: boolean) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 256, 256);
  gr.addColorStop(0, `rgb(${Math.min(255, tone[0] + 26)},${Math.min(255, tone[1] + 14)},${Math.min(255, tone[2] + 8)})`);
  gr.addColorStop(1, `rgb(${Math.max(0, tone[0] - 6)},${Math.max(0, tone[1] - 10)},${Math.max(0, tone[2] - 8)})`);
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const r = rng(11);
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${r() > 0.5 ? 255 : 110},${r() > 0.5 ? 205 : 90},${r() > 0.5 ? 190 : 80},.07)`; g.fillRect(r() * 256, r() * 256, 2 + r() * 3, 2 + r() * 3); }
  if (meshed) {
    // diamond slits that open up and show the pink bed
    for (let row = 0; row < 14; row++) for (let col = 0; col < 8; col++) {
      const x = col * 34 + (row % 2) * 17 + 8, y = row * 19 + 10;
      g.beginPath(); g.moveTo(x - 12, y); g.quadraticCurveTo(x, y - 3.2, x + 12, y); g.quadraticCurveTo(x, y + 3.2, x - 12, y);
      g.fillStyle = 'rgba(168,52,62,.9)'; g.fill();
    }
  }
  return c;
}

const pxToWorld = (p: P2, W: number, H: number, Hu: number): THREE.Vector2 => new THREE.Vector2((p[0] / W - 0.5) * WU, -(p[1] / H - 0.5) * Hu);
const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a));

export interface Viewer { destroy(): void; refresh(): void; }

export function mountViewer(host: HTMLElement, st: Stage, cs: Case): Viewer {
  const W = st.W, H = st.H, Hu = (WU * H) / W;
  const ucm = WU / (W * st.cmPerPx); // world units per cm
  host.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.className = 'v3-canvas';
  host.append(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#15110e');
  scene.fog = new THREE.Fog('#15110e', 9, 18);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.07;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.HemisphereLight('#fff1e0', '#2a1f1a', 0.75));
  const key = new THREE.DirectionalLight('#fff0dc', 2.4);
  key.position.set(-2.2, 5, 3.2); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 4; key.shadow.camera.bottom = -4;
  key.shadow.bias = -0.0004; key.shadow.radius = 5; key.shadow.normalBias = 0.01;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#8fb4ff', 0.9); rim.position.set(3, 2, -3); scene.add(rim);

  // surgical table with a sterile drape under the block
  const table = new THREE.Mesh(new THREE.CircleGeometry(16, 96), new THREE.MeshStandardMaterial({ color: '#1b1612', roughness: 0.9, metalness: 0.05 }));
  table.rotation.x = -Math.PI / 2; table.position.y = -0.62; table.receiveShadow = true; scene.add(table);
  const drape = new THREE.Mesh(new THREE.PlaneGeometry(WU + 2.6, (WU * H) / W + 2.6, 1, 1), new THREE.MeshStandardMaterial({ color: '#2d6b70', roughness: 0.92 }));
  drape.rotation.x = -Math.PI / 2; drape.position.y = -0.31; drape.receiveShadow = true; scene.add(drape);
  const ring = drape; // lifted together with the layers when they are pulled apart

  const sheet = new THREE.Group(); // image XY plane, +z toward the viewer; rotated flat below
  const world = new THREE.Group(); world.rotation.x = -Math.PI / 2; world.add(sheet); scene.add(world);

  /* ---- height field: the wound is dented, the rim is soft ---- */
  const dist = edt(st.mask.map((v) => (v ? 0 : 1)) as Uint8Array, W, H); // distance from wound for outside pixels
  const inner = edt(st.mask, W, H); // distance inside the wound, from its edge
  let imax = 1; for (let i = 0; i < inner.length; i++) imax = Math.max(imax, inner[i]);
  const depthCm = cs.depthClass === 'partial' ? 0.18 : cs.depthClass === 'indeterminate' ? 0.28 : 0.5;
  const D = Math.min(0.2, Math.max(0.035, depthCm * ucm));
  const hf = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (st.mask[i]) { const t = Math.min(1, inner[i] / Math.max(4, imax * 0.45)); hf[i] = -D * (0.35 + 0.65 * ease(t)); }
    else { const t = Math.max(0, 1 - dist[i] / 7); hf[i] = -D * 0.35 * t * t; }
  }
  const hs = gauss(hf, W, H, 2);
  const T_SLAB = 0.3;
  const SX = 200, SY = Math.max(40, Math.round((SX * H) / W));
  const skinGeo = new THREE.PlaneGeometry(WU, Hu, SX, SY);
  const pos = skinGeo.attributes.position as THREE.BufferAttribute;
  const base = new Float32Array(pos.array.length);
  for (let j = 0; j <= SY; j++) for (let i = 0; i <= SX; i++) {
    const k = j * (SX + 1) + i;
    const px = Math.min(W - 1, Math.round((i / SX) * (W - 1))), py = Math.min(H - 1, Math.round((j / SY) * (H - 1)));
    pos.setZ(k, hs[py * W + px]);
  }
  base.set(pos.array as Float32Array);

  // maps in image orientation
  const holeC = document.createElement('canvas'); holeC.width = 1024; holeC.height = Math.round((1024 * H) / W);
  const hg = holeC.getContext('2d')!; hg.fillStyle = '#000'; hg.fillRect(0, 0, holeC.width, holeC.height); hg.fillStyle = '#fff';
  const sx = holeC.width / W, sy = holeC.height / H;
  cs.plan.pieces.forEach((p) => { hg.beginPath(); p.poly.forEach((q, i) => (i ? hg.lineTo(q[0] * sx, q[1] * sy) : hg.moveTo(q[0] * sx, q[1] * sy))); hg.closePath(); hg.fill(); });
  const holeTex = canvasTex(holeC, false); holeTex.minFilter = THREE.LinearFilter; holeTex.generateMipmaps = false;
  const markC = document.createElement('canvas'); markC.width = W; markC.height = H;
  marking(markC.getContext('2d')!, cs.plan, kFor(W), 1);
  const markTex = canvasTex(markC);
  const skinTex = canvasTex(st.img);
  skinTex.wrapS = skinTex.wrapT = THREE.MirroredRepeatWrapping; // flaps that reach past the photo borrow mirrored skin instead of smeared pixels
  const uMarkAmt = { value: 0 };
  const skinMat = new THREE.MeshStandardMaterial({ map: skinTex, roughness: 0.62, metalness: 0, side: THREE.DoubleSide });
  skinMat.onBeforeCompile = (sh) => {
    sh.uniforms.uHole = { value: holeTex }; sh.uniforms.uMark = { value: markTex }; sh.uniforms.uMarkAmt = uMarkAmt;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vUv2;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvUv2 = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vUv2; uniform sampler2D uHole; uniform sampler2D uMark; uniform float uMarkAmt;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        if (texture2D(uHole, vUv2).r > 0.5) discard;
        vec4 mk = texture2D(uMark, vUv2);
        diffuseColor.rgb = mix(diffuseColor.rgb, mk.rgb, mk.a * uMarkAmt);
        if (!gl_FrontFacing) diffuseColor.rgb = vec3(0.80, 0.50, 0.44);`);
  };
  const skin = new THREE.Mesh(skinGeo, skinMat);
  skin.castShadow = true; skin.receiveShadow = true;
  const skinGrp = new THREE.Group(); skinGrp.add(skin); sheet.add(skinGrp);

  // fat and fascia bed, muscle base
  const bedTex = canvasTex(fatTexture(st, W, H));
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(WU, Hu), new THREE.MeshStandardMaterial({ map: bedTex, roughness: 0.5 }));
  bed.position.z = BED_Z; bed.receiveShadow = true;
  const bedGrp = new THREE.Group(); bedGrp.add(bed); sheet.add(bedGrp);
  const muscleTex = canvasTex(muscleTexture()); muscleTex.wrapS = muscleTex.wrapT = THREE.RepeatWrapping; muscleTex.repeat.set(3, (3 * H) / W);
  const muscle = new THREE.Mesh(new THREE.PlaneGeometry(WU, Hu), new THREE.MeshStandardMaterial({ map: muscleTex, roughness: 0.45 }));
  muscle.position.z = -T_SLAB; muscle.receiveShadow = true;
  const musGrp = new THREE.Group(); musGrp.add(muscle); sheet.add(musGrp);

  // cut faces of the block (layers visible from the side)
  const wallTex = canvasTex(wallTexture());
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.55, side: THREE.DoubleSide, transparent: true });
  const wallGeo = new THREE.BufferGeometry();
  {
    const vp: number[] = [], uv: number[] = [], idx: number[] = [];
    const edges: [number, number][][] = [[], [], [], []];
    for (let i = 0; i <= SX; i++) { edges[0].push([i, 0]); edges[1].push([i, SY]); }
    for (let j = 0; j <= SY; j++) { edges[2].push([0, j]); edges[3].push([SX, j]); }
    edges.forEach((e) => {
      const b0 = vp.length / 3;
      e.forEach(([i, j], n) => {
        const k = j * (SX + 1) + i; const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k);
        vp.push(x, y, z, x, y, -T_SLAB); uv.push(n / e.length, 0, n / e.length, 1);
        if (n < e.length - 1) { const a = b0 + n * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      });
    });
    wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(vp, 3));
    wallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    wallGeo.setIndex(idx); wallGeo.computeVertexNormals();
  }
  const walls = new THREE.Mesh(wallGeo, wallMat); walls.receiveShadow = true; sheet.add(walls);

  /* ---- plan pieces ---- */
  interface PieceRt { p: Case['plan']['pieces'][number]; g: THREE.Group; mesh: THREE.Mesh; th: number; pivot: THREE.Vector2; mv: THREE.Vector2; startOff: THREE.Vector2; matTop: THREE.MeshStandardMaterial }
  const tone = skinSample(st);
  const pieces: PieceRt[] = [];
  const meshed = (cs.plan.after.mesh || 0) > 0 || cs.plan.tech === 'stsg';
  const sideMat = new THREE.MeshStandardMaterial({ color: '#d99a84', roughness: 0.6 });
  cs.plan.pieces.forEach((p) => {
    const pts = p.poly.map((q) => pxToWorld(q, W, H, Hu));
    if (pts.length < 3) return;
    let shape: THREE.Shape;
    try { shape = new THREE.Shape(pts); } catch { return; }
    const th = p.role === 'graft' ? 0.018 : Math.min(0.1, Math.max(0.045, 0.3 * ucm));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: th, bevelEnabled: false, curveSegments: 6 });
    const posA = geo.attributes.position as THREE.BufferAttribute, uvA = geo.attributes.uv as THREE.BufferAttribute;
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    pts.forEach((q) => { minx = Math.min(minx, q.x); maxx = Math.max(maxx, q.x); miny = Math.min(miny, q.y); maxy = Math.max(maxy, q.y); });
    for (let i = 0; i < posA.count; i++) {
      const x = posA.getX(i), y = posA.getY(i);
      if (p.role === 'graft') uvA.setXY(i, (x - minx) / Math.max(1e-6, maxx - minx), (y - miny) / Math.max(1e-6, maxy - miny));
      else uvA.setXY(i, x / WU + 0.5, y / Hu + 0.5);
    }
    const tex = p.role === 'graft' ? canvasTex(graftTexture(tone, meshed)) : skinTex;
    const matTop = new THREE.MeshStandardMaterial({ map: tex, roughness: p.role === 'graft' ? 0.42 : 0.6, bumpMap: p.role === 'graft' ? tex : null, bumpScale: 0.6 });
    const mesh = new THREE.Mesh(geo, [matTop, sideMat]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const pivot = p.move?.pivot ? pxToWorld(p.move.pivot, W, H, Hu) : new THREE.Vector2(0, 0);
    const g = new THREE.Group(); g.add(mesh); mesh.position.set(-pivot.x, -pivot.y, -th + 0.002);
    sheet.add(g);
    const mv = p.move ? new THREE.Vector2((p.move.dx / W) * WU, -(p.move.dy / H) * Hu) : new THREE.Vector2();
    const startOff = p.from ? new THREE.Vector2((p.from[0] / W) * WU, -(p.from[1] / H) * Hu) : new THREE.Vector2();
    pieces.push({ p, g, mesh, th, pivot, mv, startOff, matTop });
  });

  // suture line from the plan's after-lines
  const sutureG = new THREE.Group(); sheet.add(sutureG);
  const stitchMat = new THREE.MeshStandardMaterial({ color: '#1a1412', roughness: 0.4 });
  const stitches: THREE.Mesh[] = [];
  const addStitch = (a: P2, b: P2) => {
    const A = pxToWorld(a, W, H, Hu), B = pxToWorld(b, W, H, Hu);
    const len = A.distanceTo(B); if (len < 0.01) return;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, len, 6), stitchMat);
    m.position.set((A.x + B.x) / 2, (A.y + B.y) / 2, 0.014);
    m.rotation.z = Math.atan2(B.y - A.y, B.x - A.x) + Math.PI / 2; m.rotation.x = 0; m.castShadow = true;
    m.scale.y = 0.001; sutureG.add(m); stitches.push(m);
  };
  const stitchesAlong = (a: P2, b: P2, n: number) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, w = 9;
    for (let s = 0; s <= n; s++) { const t = s / n, cx = a[0] + dx * t, cy = a[1] + dy * t; addStitch([cx - nx * w, cy - ny * w], [cx + nx * w, cy + ny * w]); }
  };
  (cs.plan.after.lines || []).forEach((l) => { if (l.length >= 2) stitchesAlong(l[0], l[l.length - 1], Math.max(4, Math.round(Math.hypot(l[l.length - 1][0] - l[0][0], l[l.length - 1][1] - l[0][1]) / 14))); });
  if (cs.plan.after.a && cs.plan.after.b) stitchesAlong(cs.plan.after.a, cs.plan.after.b, cs.plan.after.n || 6);
  const gp = cs.plan.pieces.find((q) => q.role === 'graft');
  if (gp) for (let i = 0; i < gp.poly.length; i += Math.max(1, Math.floor(gp.poly.length / 16))) { const a = gp.poly[i]; const c = cs.geo.centroid; const dx = c[0] - a[0], dy = c[1] - a[1], L = Math.hypot(dx, dy) || 1; addStitch(a, [a[0] + (dx / L) * 5, a[1] + (dy / L) * 5]); }

  /* ---- measurement lines ---- */
  const s = cs.geo.shape, rect = s.rect;
  const meas: { a: THREE.Vector3; b: THREE.Vector3; label: HTMLElement; line: THREE.Line }[] = [];
  const mkMeas = (a: P2, b: P2, text: string) => {
    const A = pxToWorld(a, W, H, Hu), B = pxToWorld(b, W, H, Hu);
    const va = new THREE.Vector3(A.x, A.y, 0.03), vb = new THREE.Vector3(B.x, B.y, 0.03);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([va, vb]), new THREE.LineBasicMaterial({ color: '#f2b632', transparent: true, opacity: 0.95, depthTest: false }));
    line.renderOrder = 10; sheet.add(line);
    const el = document.createElement('div'); el.className = 'v3-tag'; el.textContent = text; host.append(el);
    meas.push({ a: va, b: vb, label: el, line });
  };
  const l1 = Math.hypot(rect[1][0] - rect[0][0], rect[1][1] - rect[0][1]) * st.cmPerPx, l2 = Math.hypot(rect[2][0] - rect[1][0], rect[2][1] - rect[1][1]) * st.cmPerPx;
  mkMeas(rect[0], rect[1], `${l1.toFixed(1)} cm`);
  mkMeas(rect[1], rect[2], `${l2.toFixed(1)} cm`);

  /* ---- controls overlay ---- */
  const ui = document.createElement('div'); ui.className = 'v3-ui';
  const steps = cs.plan.steps;
  ui.innerHTML = `
    <div class="v3-cap"><span class="v3-n"></span><span class="v3-t"></span></div>
    <div class="v3-bar">
      <button type="button" class="v3-play" aria-label="${T('Play', 'Putar')}"></button>
      <input class="v3-scrub" type="range" min="0" max="1000" value="0" aria-label="${T('Operation progress', 'Kemajuan operasi')}" />
      <button type="button" class="v3-b" data-a="reset">${T('Reset', 'Ulang')}</button>
    </div>
    <div class="v3-side">
      <label><span>${T('Peel the skin', 'Kupas kulit')}</span><input class="v3-peel" type="range" min="0" max="1000" value="0" /></label>
      <label><span>${T('Pull the layers apart', 'Pisahkan lapisan')}</span><input class="v3-ex" type="range" min="0" max="1000" value="0" /></label>
      <label class="v3-chk"><input class="v3-mk" type="checkbox" checked /><span>${T('Marking', 'Marking')}</span></label>
      <label class="v3-chk"><input class="v3-ms" type="checkbox" checked /><span>${T('Measurements', 'Ukuran')}</span></label>
    </div>
    <p class="v3-hint">${T('Drag to turn. Scroll to zoom. Drag the skin to peel it back.', 'Seret untuk memutar. Gulir untuk zoom. Seret kulit untuk mengupasnya.')}</p>`;
  host.append(ui);
  const q = <E extends HTMLElement>(sel: string) => ui.querySelector(sel) as E;
  const scrub = q<HTMLInputElement>('.v3-scrub'), peel = q<HTMLInputElement>('.v3-peel'), ex = q<HTMLInputElement>('.v3-ex');
  const playBtn = q<HTMLButtonElement>('.v3-play'), capN = q('.v3-n'), capT = q('.v3-t');
  const mkChk = q<HTMLInputElement>('.v3-mk'), msChk = q<HTMLInputElement>('.v3-ms');

  /* ---- state ---- */
  let tl = 0, peelV = 0, exV = 0, playing = false, dirty = true, alive = true;
  const apply = () => {
    const t = tl;
    pieces.forEach((pc) => {
      const r = pc.p.role, g = pc.g;
      if (r === 'excise' || r === 'slough') {
        const e = seg(t, 0.22, 0.52);
        g.position.set(pc.pivot.x + 0.9 * e * (r === 'slough' ? 1 : 0.8), pc.pivot.y + 0.25 * e, 0.9 * Math.sin(Math.min(1, e * 1.4) * Math.PI * 0.5));
        g.rotation.set(0, 0, -0.35 * e); g.scale.setScalar(1 - 0.12 * e);
        pc.mesh.visible = e < 0.999;
      } else if (r === 'flap') {
        const lf = seg(t, 0.4, 0.55), mvT = seg(t, 0.52, 0.8), drop = seg(t, 0.8, 0.92);
        g.position.set(pc.pivot.x + pc.mv.x * mvT, pc.pivot.y + pc.mv.y * mvT, 0.55 * lf * (1 - drop));
        g.rotation.set(0, 0, pc.p.move?.rot ? -pc.p.move.rot * mvT : 0);
      } else if (r === 'graft') {
        const appear = seg(t, 0.3, 0.42), flyT = seg(t, 0.5, 0.82), lay = seg(t, 0.82, 0.93);
        const peelUp = 1 - seg(t, 0.42, 0.55);
        g.visible = appear > 0.001;
        const rest = BED_Z + pc.th;
        g.position.set(pc.pivot.x + pc.startOff.x * (1 - flyT), pc.pivot.y + pc.startOff.y * (1 - flyT), rest + (0.5 * Math.sin(Math.PI * flyT) + 0.14 * peelUp) * (1 - lay) + 0.06 * (1 - lay) * (1 - flyT));
        g.rotation.set(0.7 * peelUp * (1 - flyT), 0, 0);
        g.scale.setScalar(0.35 + 0.65 * appear);
      }
    });
    // stitches grow in at the end
    const st2 = seg(t, 0.9, 1);
    stitches.forEach((m, i) => { const k = ease((st2 * 1.6 - i / Math.max(1, stitches.length) * 0.6)); m.scale.y = Math.max(0.001, k); });
    // peel: page curl of the skin sheet, from the +x edge toward -x
    const R = 0.42;
    const front = WU / 2 - peelV * (WU * 1.02);
    const p = pos.array as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2];
      let x = bx, z = bz;
      const d = bx - front;
      if (peelV > 0.001 && d > 0) {
        if (d <= R * Math.PI) { const a = d / R; x = front + R * Math.sin(a); z = bz + R * (1 - Math.cos(a)); }
        else { x = front - (d - R * Math.PI); z = bz + 2 * R; }
      }
      p[i * 3] = x; p[i * 3 + 1] = by; p[i * 3 + 2] = z;
    }
    pos.needsUpdate = true; skinGeo.computeVertexNormals();
    // explode
    skinGrp.position.z = 0.95 * exV; bedGrp.position.z = 0.38 * exV; musGrp.position.z = -0.25 * exV;
    pieces.forEach((pc) => { /* pieces ride with the skin layer when it lifts */ pc.g.position.z += 0.95 * exV; });
    sutureG.position.z = 0.95 * exV;
    wallMat.opacity = 1 - Math.min(1, exV * 4); walls.visible = wallMat.opacity > 0.02;
    table.position.y = -0.62 - 0.3 * exV; ring.position.y = -0.31 - 0.3 * exV;
    uMarkAmt.value = mkChk.checked ? 1 - seg(t, 0.2, 0.4) * (cs.plan.pieces.length ? 0.85 : 0) : 0;
    meas.forEach((m) => { m.label.style.display = msChk.checked ? '' : 'none'; m.line.visible = msChk.checked && t < 0.5; });
    // caption
    const n = Math.max(1, steps.length), si = Math.min(n - 1, Math.floor(t * n * 0.999));
    capN.textContent = String(si + 1).padStart(2, '0');
    capT.textContent = steps[si] ? pick(steps[si]) : '';
    scrub.value = String(Math.round(t * 1000));
    dirty = true;
  };

  scrub.addEventListener('input', () => { playing = false; playBtn.classList.remove('on'); tl = Number(scrub.value) / 1000; apply(); });
  peel.addEventListener('input', () => { peelV = Number(peel.value) / 1000; apply(); });
  ex.addEventListener('input', () => { exV = Number(ex.value) / 1000; apply(); });
  mkChk.addEventListener('change', apply); msChk.addEventListener('change', apply);
  playBtn.addEventListener('click', () => { playing = !playing; playBtn.classList.toggle('on', playing); if (playing && tl >= 0.999) tl = 0; });
  q('[data-a="reset"]').addEventListener('click', () => { playing = false; playBtn.classList.remove('on'); tl = 0; peelV = 0; exV = 0; peel.value = '0'; ex.value = '0'; apply(); gsap.to(camera.position, { x: home.x, y: home.y, z: home.z, duration: 0.9, ease: 'power3.inOut', onUpdate: () => (dirty = true) }); });

  // drag the skin to peel: horizontal drag over the sheet when the pointer starts on it
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let peeling = false, startX = 0, startPeel = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (!e.shiftKey && !e.altKey) return;
    peeling = true; controls.enabled = false; startX = e.clientX; startPeel = peelV; canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => { if (!peeling) return; peelV = Math.max(0, Math.min(1, startPeel - (e.clientX - startX) / canvas.clientWidth * 1.6)); peel.value = String(Math.round(peelV * 1000)); apply(); });
  canvas.addEventListener('pointerup', () => { peeling = false; controls.enabled = true; });
  void ray; void ndc;

  /* ---- loop ---- */
  const home = new THREE.Vector3(0, 3, 4);
  const fitHome = () => {
    const th = Math.tan((camera.fov * Math.PI) / 360), el = 0.95;
    const dW = (WU / 2) / (th * camera.aspect), dH = (Hu / 2) / th;
    const d = Math.max(dW, dH * 0.8) * 1.12;
    home.set(0, d * Math.sin(el), d * Math.cos(el));
    controls.minDistance = d * 0.3; controls.maxDistance = d * 2;
  };
  const size = () => {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 1 ? 44 : 34; camera.updateProjectionMatrix(); dirty = true; fitHome();
  };
  const ro = new ResizeObserver(size); ro.observe(host); size(); camera.position.copy(home).multiplyScalar(1.7);
  controls.addEventListener('change', () => (dirty = true));
  controls.autoRotate = false;
  let last = performance.now();
  const v = new THREE.Vector3();
  const place = (m: (typeof meas)[number]) => {
    v.copy(m.a).add(m.b).multiplyScalar(0.5); sheet.localToWorld(v); v.project(camera);
    const x = (v.x * 0.5 + 0.5) * host.clientWidth, y = (-v.y * 0.5 + 0.5) * host.clientHeight;
    m.label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  };
  const frame = (now: number) => {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (host.offsetParent !== null) {
      if (playing) { tl = Math.min(1, tl + dt / 11); if (tl >= 1) { playing = false; playBtn.classList.remove('on'); } apply(); }
      controls.update();
      if (dirty || playing) { meas.forEach(place); renderer.render(scene, camera); dirty = false; }
    }
    requestAnimationFrame(frame);
  };
  apply();
  requestAnimationFrame(frame);
  // intro: the camera glides in, then the operation plays once
  gsap.to(camera.position, { x: home.x, y: home.y, z: home.z, duration: 2.2, ease: 'power3.out', onUpdate: () => (dirty = true), onComplete: () => { playing = true; playBtn.classList.add('on'); } });

  return {
    refresh: () => apply(),
    destroy: () => {
      alive = false; ro.disconnect(); controls.dispose(); gsap.killTweensOf(camera.position);
      scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); const mt = m.material as THREE.Material | THREE.Material[] | undefined; (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach((x) => x.dispose()); });
      renderer.dispose(); host.innerHTML = '';
    },
  };
}
