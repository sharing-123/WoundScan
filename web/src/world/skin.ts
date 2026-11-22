import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { field, contour, WOUND } from './wound';
import { fbm, smoothstep, clamp } from './noise';
import { sectionTexture, poreBump, type Layer } from './textures';

export const H = 5; // half-width of the block, cm
const N = 168; // grid cells per side of each top surface
const LAYERS: { id: Layer; top: number; bot: number }[] = [
  { id: 'epi', top: 0, bot: -0.12 },
  { id: 'derm', top: -0.12, bot: -0.97 },
  { id: 'fat', top: -0.97, bot: -2.47 },
  { id: 'mus', top: -2.47, bot: -3.77 },
];

export const BLOCK_BOTTOM = LAYERS[3].bot;

const TONE = {
  skin: new THREE.Color('#8c5a3c'),
  skinDark: new THREE.Color('#6e4430'),
  peri: new THREE.Color('#9a4a3a'),
  macerated: new THREE.Color('#dcc3ad'),
  derm: new THREE.Color('#c98a74'),
  fat: new THREE.Color('#e3c283'),
  mus: new THREE.Color('#862f2e'),
  bed: new THREE.Color('#8f1f26'),
  slough: new THREE.Color('#c9a35a'),
};

export interface Shared {
  uScan: { value: number };
  uMask: { value: number };
  uScanOn: { value: number };
  uMaskCol: { value: THREE.Color };
  uScanCol: { value: THREE.Color };
}

function patch(mat: THREE.Material, s: Shared) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, s);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aShow;\nattribute float aWound;\nvarying float vShow;\nvarying float vWound;\nvarying vec3 vW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShow = aShow; vWound = aWound; vW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vShow;\nvarying float vWound;\nvarying vec3 vW;\nuniform float uScan;\nuniform float uMask;\nuniform float uScanOn;\nuniform vec3 uMaskCol;\nuniform vec3 uScanCol;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vShow < 0.0025) discard;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat scanned = 1.0 - smoothstep(uScan - 0.45, uScan, vW.x);\ndiffuseColor.rgb = mix(diffuseColor.rgb, uMaskCol, scanned * vWound * uMask);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat sl = exp(-pow((vW.x - uScan) / 0.06, 2.0));\ntotalEmissiveRadiance += uScanCol * sl * uScanOn;');
  };
}

function layerColor(i: number, x: number, z: number, f: ReturnType<typeof field>): THREE.Color {
  const n = fbm(x * 1.7 + 3, z * 1.7 - 5, 5, 3);
  const c = new THREE.Color();
  if (i === 0) {
    c.copy(TONE.skin).lerp(TONE.skinDark, clamp(n * 1.2 - 0.25));
    c.lerp(TONE.peri, (1 - smoothstep(1.0, 2.0, f.rho)) * 0.5);
    c.lerp(TONE.macerated, Math.exp(-Math.pow((f.rho - 1.0) / 0.1, 2)) * 0.55);
  } else {
    c.copy(i === 1 ? TONE.derm : i === 2 ? TONE.fat : TONE.mus);
    const wet = smoothstep(0.02, 0.3, f.depth);
    c.lerp(TONE.bed, wet * 0.82);
    c.lerp(TONE.slough, smoothstep(0.6, 0.78, fbm(x * 2.2, z * 2.2, 21, 3)) * wet * 0.55);
  }
  return c;
}

export class SkinBlock {
  group = new THREE.Group();
  private layerGroups: THREE.Group[] = [];
  shared: Shared = {
    uScan: { value: -9 },
    uMask: { value: 0 },
    uScanOn: { value: 0 },
    uMaskCol: { value: new THREE.Color('#f2b632') },
    uScanCol: { value: new THREE.Color('#ffcf66') },
  };
  plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), H + 0.01);
  private cutFaces: { geo: THREE.BufferGeometry; layer: number }[] = [];
  private zc = H;
  private lines = new Map<string, LineSegments2>();
  private iso: THREE.LineSegments;
  private isoU = { uReveal: { value: 0 }, uAlpha: { value: 0 } };

  constructor() {
    const bump = poreBump();
    const half = H;
    const step = (2 * half) / N;
    const mats: THREE.MeshPhysicalMaterial[] = [];

    LAYERS.forEach((L, i) => {
      const lg = new THREE.Group();
      this.layerGroups.push(lg);
      this.group.add(lg);
      const tex = sectionTexture(L.id, 11 + i * 7);
      // --- top surface (exposed only where it is the actual surface) ---
      const pos = new Float32Array((N + 1) * (N + 1) * 3);
      const col = new Float32Array((N + 1) * (N + 1) * 3);
      const show = new Float32Array((N + 1) * (N + 1));
      const wound = new Float32Array((N + 1) * (N + 1));
      const uv = new Float32Array((N + 1) * (N + 1) * 2);
      for (let j = 0; j <= N; j++) {
        for (let k = 0; k <= N; k++) {
          const x = -half + k * step;
          const z = -half + j * step;
          const f = field(x, z);
          const top = i === 0 ? Math.max(L.bot, Math.min(L.top + 0.09, f.surface)) : clamp(f.surface, L.bot, L.top);
          const idx = j * (N + 1) + k;
          pos.set([x, top, z], idx * 3);
          const c = layerColor(i, x, z, f);
          col.set([c.r, c.g, c.b], idx * 3);
          const thick = top - L.bot;
          show[idx] = i === 0 ? thick : Math.min(thick, L.top - f.surface);
          wound[idx] = 1 - smoothstep(0.9, 1.04, f.rho);
          uv.set([k / N, j / N], idx * 2);
        }
      }
      const idxs: number[] = [];
      for (let j = 0; j < N; j++)
        for (let k = 0; k < N; k++) {
          const a = j * (N + 1) + k;
          const b = a + 1;
          const c = a + N + 1;
          const d = c + 1;
          // lower layers only exist as a visible surface inside the crater: skip every cell that is fully hidden
          if (i > 0 && show[a] < 0.0025 && show[b] < 0.0025 && show[c] < 0.0025 && show[d] < 0.0025) continue;
          idxs.push(a, c, b, b, c, d);
        }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('aShow', new THREE.BufferAttribute(show, 1));
      geo.setAttribute('aWound', new THREE.BufferAttribute(wound, 1));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(idxs);
      geo.computeVertexNormals();
      const mat = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: i === 0 ? 0.66 : 0.34,
        clearcoat: i === 0 ? 0.1 : 0.85,
        clearcoatRoughness: i === 0 ? 0.5 : 0.22,
        sheen: i === 0 ? 0.12 : 0,
        sheenColor: new THREE.Color('#ffd9c4'),
        sheenRoughness: 0.6,
        clippingPlanes: [this.plane],
        bumpMap: i === 0 ? bump : null,
        bumpScale: i === 0 ? 0.5 : 0,
      });
      patch(mat, this.shared);
      mats.push(mat);
      const mesh = new THREE.Mesh(geo, mat);
      lg.add(mesh);

      // --- static walls: left, right, back (wound is far from these, so they are flat slabs) ---
      const th = L.top - L.bot;
      const wallMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0, clippingPlanes: [this.plane] });
      const mk = (w: number, x: number, z: number, ry: number) => {
        const g = new THREE.PlaneGeometry(w, th);
        const m = new THREE.Mesh(g, wallMat);
        m.position.set(x, (L.top + L.bot) / 2, z);
        m.rotation.y = ry;
        lg.add(m);
      };
      mk(2 * half, -half, 0, -Math.PI / 2);
      mk(2 * half, half, 0, Math.PI / 2);
      mk(2 * half, 0, -half, Math.PI);

      // --- movable cut face at z = zc ---
      const cg = new THREE.BufferGeometry();
      const cpos = new Float32Array((N + 1) * 2 * 3);
      const cuv = new Float32Array((N + 1) * 2 * 2);
      const cidx: number[] = [];
      for (let k = 0; k < N; k++) {
        const a = k * 2;
        cidx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
      }
      cg.setAttribute('position', new THREE.BufferAttribute(cpos, 3));
      cg.setAttribute('uv', new THREE.BufferAttribute(cuv, 2));
      cg.setIndex(cidx);
      cg.computeBoundingSphere();
      cg.boundingSphere!.radius = 20;
      const cm = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, side: THREE.DoubleSide }));
      cm.frustumCulled = false;
      lg.add(cm);
      this.cutFaces.push({ geo: cg, layer: i });
    });
    this.setCut(H);

    // --- contour lines (all derived from the same wound field) ---
    const cHalf = 4.6;
    const cN = 300;
    const yOn = (x: number, z: number) => field(x, z).surface + 0.022;

    const outline = contour((x, z) => field(x, z).rho, 1.0, cHalf, cN);
    this.lines.set('outline', this.fat(outline, yOn, '#f2b632', 3.2, false));
    const doubtIn = contour((x, z) => field(x, z).rho, 0.9, cHalf, cN);
    const doubtOut = contour((x, z) => field(x, z).rho, 1.12, cHalf, cN);
    this.lines.set('doubt', this.fat([...doubtIn, ...doubtOut], yOn, '#ffe9b0', 1.6, true));

    // thin topographic isolines inside the crater
    const isoPos: number[] = [];
    const isoR: number[] = [];
    for (const lv of [-0.2, -0.42, -0.64, -0.86, -1.04]) {
      const seg = contour((x, z) => field(x, z).surface, lv, cHalf, cN);
      for (let q = 0; q < seg.length; q += 2) {
        const x = seg[q];
        const z = seg[q + 1];
        isoPos.push(x, yOn(x, z) + 0.004, z);
        isoR.push(field(x, z).rho);
      }
    }
    const ig = new THREE.BufferGeometry();
    ig.setAttribute('position', new THREE.Float32BufferAttribute(isoPos, 3));
    ig.setAttribute('aR', new THREE.Float32BufferAttribute(isoR, 1));
    this.iso = new THREE.LineSegments(
      ig,
      new THREE.ShaderMaterial({
        uniforms: this.isoU,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        clipping: true,
        clippingPlanes: [this.plane],
        vertexShader: [
          'attribute float aR;',
          'varying float vR;',
          '#include <clipping_planes_pars_vertex>',
          'void main() {',
          '  vR = aR;',
          '  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
          '  gl_Position = projectionMatrix * mvPosition;',
          '#include <clipping_planes_vertex>',
          '}',
        ].join('\n'),
        fragmentShader: [
          'uniform float uReveal;',
          'uniform float uAlpha;',
          'varying float vR;',
          '#include <clipping_planes_pars_fragment>',
          'void main() {',
          '#include <clipping_planes_fragment>',
          '  float a = (1.0 - smoothstep(uReveal - 0.18, uReveal, vR)) * uAlpha;',
          '  gl_FragColor = vec4(vec3(1.0, 0.86, 0.55), a * 0.9);',
          '}',
        ].join('\n'),
      }),
    );
    this.group.add(this.iso);
    void mats;
  }

  private fat(seg: number[], yOn: (x: number, z: number) => number, color: string, width: number, dashed: boolean) {
    const pos: number[] = [];
    for (let q = 0; q < seg.length; q += 2) pos.push(seg[q], yOn(seg[q], seg[q + 1]), seg[q + 1]);
    const g = new LineSegmentsGeometry();
    g.setPositions(pos);
    const m = new LineMaterial({ color: new THREE.Color(color).getHex(), linewidth: width, transparent: true, opacity: 0, depthWrite: false, dashed, dashSize: 0.14, gapSize: 0.1, alphaToCoverage: false });
    m.clippingPlanes = [this.plane];
    const l = new LineSegments2(g, m);
    if (dashed) l.computeLineDistances();
    l.renderOrder = 5;
    this.group.add(l);
    return l;
  }

  resize(w: number, h: number) {
    this.lines.forEach((l) => (l.material as LineMaterial).resolution.set(w, h));
  }

  /* Move the section plane (z = H means intact) and rebuild the five cut-face strips. */
  setCut(zc: number) {
    this.zc = zc;
    this.plane.constant = zc + 0.005;
    const half = H;
    const step = (2 * half) / N;
    for (const { geo, layer } of this.cutFaces) {
      const L = LAYERS[layer];
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
      const th = L.top - L.bot;
      for (let k = 0; k <= N; k++) {
        const x = -half + k * step;
        const f = field(x, zc);
        const top = layer === 0 ? Math.max(L.bot, Math.min(L.top + 0.09, f.surface)) : clamp(f.surface, L.bot, L.top);
        pos.setXYZ(k * 2, x, top, zc);
        pos.setXYZ(k * 2 + 1, x, L.bot, zc);
        uv.setXY(k * 2, (x + half) / 5, (top - L.bot) / th);
        uv.setXY(k * 2 + 1, (x + half) / 5, 0);
      }
      pos.needsUpdate = true;
      uv.needsUpdate = true;
    }
  }
  /* exploded view: each layer drops by `v` cm times its depth index */
  setExplode(v: number) {
    this.layerGroups.forEach((g, i) => (g.position.y = -i * v));
  }
  get cut() {
    return this.zc;
  }

  setOutline(o: number, doubt: number) {
    (this.lines.get('outline')!.material as LineMaterial).opacity = o;
    (this.lines.get('doubt')!.material as LineMaterial).opacity = doubt;
    this.lines.get('outline')!.visible = o > 0.003;
    this.lines.get('doubt')!.visible = doubt > 0.003;
  }
  setIso(reveal: number, alpha: number) {
    this.isoU.uReveal.value = reveal;
    this.isoU.uAlpha.value = alpha;
    this.iso.visible = alpha > 0.003;
  }
}

export { WOUND };
