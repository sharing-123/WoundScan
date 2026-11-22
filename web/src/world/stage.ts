import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { mulberry32 } from './noise';

const registry = new Set<LineMaterial>();
export function setLineResolution(w: number, h: number) {
  registry.forEach((m) => m.resolution.set(w, h));
}

/* Fat lines from flat [x,y,z,x,y,z,...] segment pairs. */
export function fatLines(pos: number[], color: string, width: number, opts: { dashed?: boolean; opacity?: number } = {}) {
  const g = new LineSegmentsGeometry();
  g.setPositions(pos);
  const m = new LineMaterial({ color: new THREE.Color(color).getHex(), linewidth: width, transparent: true, opacity: opts.opacity ?? 1, depthWrite: false, dashed: !!opts.dashed, dashSize: 0.14, gapSize: 0.1 });
  registry.add(m);
  const l = new LineSegments2(g, m);
  if (opts.dashed) l.computeLineDistances();
  l.renderOrder = 6;
  return l;
}

/* A measuring platter: concentric centimetre rings, 5 cm rings, a degree scale on the rim, soft contact shadow. */
export class Platter {
  mesh: THREE.Mesh;
  uniforms = { uPulse: { value: 0 }, uPulseR: { value: 0 }, uShadow: { value: 1 }, uLines: { value: 1 } };
  constructor(y: number) {
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec2 vP; uniform float uPulse; uniform float uPulseR; uniform float uShadow; uniform float uLines;
        float ln(float v, float w){ float d = abs(fract(v + 0.5) - 0.5); float aa = max(fwidth(v), 1e-5); return 1.0 - smoothstep(w * aa, (w + 1.0) * aa, d); }
        void main(){
          float r = length(vP);
          float fade = 1.0 - smoothstep(9.0, 15.0, r);
          float g1 = ln(r, 0.7) * 0.07;
          float g5 = ln(r / 5.0, 1.2) * 0.17;
          float ang = atan(vP.y, vP.x) / 6.2831853 * 72.0;
          float rim = smoothstep(7.4, 7.9, r) * (1.0 - smoothstep(8.6, 9.0, r));
          float tick = ln(ang, 0.9) * rim * 0.32 + ln(ang / 6.0, 1.3) * smoothstep(7.4, 7.9, r) * (1.0 - smoothstep(9.0, 9.5, r)) * 0.34;
          float lines = (g1 + g5 + tick) * fade * uLines;
          vec2 q = abs(vP) - vec2(5.0);
          float box = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
          float sh = (1.0 - smoothstep(-0.6, 2.8, box)) * 0.78 * uShadow;
          float pulse = exp(-pow((r - uPulseR) / 0.09, 2.0)) * uPulse;
          vec3 base = vec3(0.075, 0.062, 0.055);
          vec3 col = base * (1.0 - sh) + vec3(0.95, 0.80, 0.50) * lines + vec3(1.0, 0.78, 0.25) * pulse;
          float a = fade * 0.84 + pulse;
          gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.CircleGeometry(16, 128), mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = y;
    this.mesh.renderOrder = -2;
  }
}

/* Slow dust, so the dark has depth. */
export class Dust {
  points: THREE.Points;
  u = { uTime: { value: 0 }, uAmt: { value: 1 }, uPx: { value: 1 } };
  constructor(count: number) {
    const r = mulberry32(5);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos.set([(r() - 0.5) * 34, -5 + r() * 16, (r() - 0.5) * 34], i * 3);
      seed[i] = r() * 100;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aS', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: this.u,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aS; uniform float uTime; uniform float uPx; varying float vA;
        void main(){
          vec3 p = position;
          p.x += sin(uTime * 0.07 + aS) * 0.9;
          p.z += cos(uTime * 0.06 + aS * 1.3) * 0.9;
          p.y = -5.0 + mod(position.y + 5.0 + uTime * 0.05 + aS * 0.37, 16.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float d = -mv.z;
          gl_PointSize = clamp((1.2 + fract(aS) * 2.2) * uPx * 14.0 / d, 1.0, 6.0);
          vA = (0.22 + 0.5 * fract(aS * 3.1)) * smoothstep(34.0, 8.0, d);
        }`,
      fragmentShader: `
        uniform float uAmt; varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d) * vA * uAmt; gl_FragColor = vec4(vec3(1.0, 0.92, 0.78), a * 0.55); }`,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
  }
}

/* Soft volumetric shafts from the key light: three stretched planes with a noisy, feathered gradient. */
export class Beams {
  group = new THREE.Group();
  private u = { uTime: { value: 0 }, uAmt: { value: 0 } };
  constructor() {
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec2 vUv; uniform float uTime; uniform float uAmt;
        float h(float n){ return fract(sin(n) * 43758.5453); }
        void main(){
          float across = 1.0 - smoothstep(0.0, 0.5, abs(vUv.x - 0.5));
          across = pow(across, 1.6);
          float along = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
          float shimmer = 0.78 + 0.22 * sin(vUv.y * 9.0 + uTime * 0.5) * sin(vUv.x * 5.0 - uTime * 0.3);
          float a = across * along * shimmer * uAmt * 0.16;
          gl_FragColor = vec4(vec3(1.0, 0.86, 0.62), a);
        }`,
    });
    const specs: [number, number, number, number][] = [
      [-3.5, 7.5, -1.2, 0.5],
      [1.5, 8.2, -3.2, 0.34],
      [6.0, 7.2, 0.2, 0.62],
    ];
    for (const [x, y, z, w] of specs) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w * 5, 19), mat);
      m.position.set(x, y, z);
      m.rotation.set(0.0, 0.55, 0.42);
      m.renderOrder = 4;
      this.group.add(m);
    }
  }
  set(amount: number, time: number) {
    this.u.uAmt.value = amount;
    this.u.uTime.value = time;
    this.group.visible = amount > 0.004;
  }
}
