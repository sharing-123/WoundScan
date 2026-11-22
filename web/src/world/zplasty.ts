import * as THREE from 'three';
import { fatLines } from './stage';
import { poreBump } from './textures';
import { easeInOut, clamp } from './noise';
import type { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import type { LineMaterial } from 'three/addons/lines/LineMaterial.js';

const S = 1.35; // limb length, cm
const R3 = Math.sqrt(3);
const MARK = '#9fb0ff';

/* A 60 degree Z-plasty drawn on a skin tile: two equilateral triangular flaps are lifted and transposed, which
   turns the common limb through 90 degrees and lengthens the scar axis. Schematic, not a surgical simulation. */
export class ZPlasty {
  group = new THREE.Group();
  private flaps: THREE.Mesh[] = [];
  private zLine: LineSegments2;
  private ghost: LineSegments2;
  private sutures: LineSegments2;
  private beforeDim: LineSegments2;
  private afterDim: LineSegments2;
  anchors = {
    z: new THREE.Vector3(0.9, 0.3, -1.7),
    before: new THREE.Vector3(0, 0.1, 3.4),
    after: new THREE.Vector3(1.3, 0.1, 3.4),
  };

  constructor() {
    const bump = poreBump();
    const skin = new THREE.MeshPhysicalMaterial({ color: '#5c3524', roughness: 0.7, clearcoat: 0.15, bumpMap: bump, bumpScale: 0.45, sheen: 0.5, sheenColor: new THREE.Color('#ffd9c4') });
    const flapSkin = new THREE.MeshPhysicalMaterial({ color: '#c58a62', roughness: 0.42, clearcoat: 0.3, bumpMap: bump, bumpScale: 0.4, sheen: 0.6, sheenColor: new THREE.Color('#ffd9c4') });
    const derm = new THREE.MeshStandardMaterial({ color: '#cf917a', roughness: 0.7 });

    const slab = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.6, 7.4), [derm, derm, skin, derm, derm, derm]);
    slab.position.y = -0.3;
    const uvs = (slab.geometry.getAttribute('uv') as THREE.BufferAttribute);
    for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) * 2.2, uvs.getY(i) * 2.2);
    this.group.add(slab);

    const A: [number, number] = [-S, 0];
    const B: [number, number] = [S, 0];
    const C: [number, number] = [0, R3 * S];
    const D: [number, number] = [0, -R3 * S];
    const tri = (p: [number, number][]) => {
      const sh = new THREE.Shape();
      sh.moveTo(p[0][0], -p[0][1]);
      sh.lineTo(p[1][0], -p[1][1]);
      sh.lineTo(p[2][0], -p[2][1]);
      sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2 });
      g.rotateX(-Math.PI / 2);
      return g;
    };
    for (const pts of [[A, B, C], [A, B, D]] as [number, number][][]) {
      const g = tri(pts);
      const m = new THREE.Mesh(g, [flapSkin, derm]);
      m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), new THREE.LineBasicMaterial({ color: '#fff1dd', transparent: true, opacity: 0.85 })));
      this.flaps.push(m);
      this.group.add(m);
    }

    const P = (p: [number, number], y = 0.2) => [p[0], y, p[1]];
    const seg = (a: number[], b: number[]) => [...a, ...b];
    this.zLine = fatLines([...seg(P(C, 0.23), P(A, 0.23)), ...seg(P(A, 0.23), P(B, 0.23)), ...seg(P(B, 0.23), P(D, 0.23))], MARK, 4.2);
    this.ghost = fatLines([...seg(P(C, 0.03), P(A, 0.03)), ...seg(P(A, 0.03), P(B, 0.03)), ...seg(P(B, 0.03), P(D, 0.03))], MARK, 1.6, { dashed: true });
    this.group.add(this.zLine, this.ghost);

    // final suture line: C'->A'->B'->D'  = (1.73s,0)->(0,s)->(0,-s)->(-1.73s,0), ticks across the line
    const Ca: [number, number] = [R3 * S, 0];
    const Aa: [number, number] = [0, S];
    const Ba: [number, number] = [0, -S];
    const Da: [number, number] = [-R3 * S, 0];
    const ticks: number[] = [];
    const along = (p: [number, number], q: [number, number], n: number) => {
      const dx = q[0] - p[0];
      const dz = q[1] - p[1];
      const len = Math.hypot(dx, dz);
      const nx = -dz / len;
      const nz = dx / len;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = p[0] + dx * t;
        const z = p[1] + dz * t;
        ticks.push(x - nx * 0.14, 0.2, z - nz * 0.14, x + nx * 0.14, 0.2, z + nz * 0.14);
      }
    };
    along(Ca, Aa, 6);
    along(Aa, Ba, 5);
    along(Ba, Da, 6);
    this.sutures = fatLines([...ticks, ...seg(P(Ca, 0.2), P(Aa, 0.2)), ...seg(P(Aa, 0.2), P(Ba, 0.2)), ...seg(P(Ba, 0.2), P(Da, 0.2))], '#f4efe4', 2.0);
    this.group.add(this.sutures);

    // scar-axis lengths: before 2s (A-B), after 2*sqrt(3)*s (C'-D')
    const zz = 3.5;
    const q = (x0: number, x1: number, y: number) => [x0, y, zz, x1, y, zz, x0, y, zz - 0.16, x0, y, zz + 0.16, x1, y, zz - 0.16, x1, y, zz + 0.16];
    this.beforeDim = fatLines(q(-S, S, 0.12), '#f2b632', 2.2, { dashed: true });
    this.afterDim = fatLines(q(-R3 * S, R3 * S, 0.12), '#f2b632', 2.6);
    this.afterDim.position.z = 0.55;
    this.anchors.after.z = zz + 0.55;
    this.anchors.before.set(0, 0.12, zz);
    this.anchors.after.set(R3 * S * 0.62, 0.12, zz + 0.55);
    this.group.add(this.beforeDim, this.afterDim);
    this.set(1, 0);
  }

  /* presence: set visible and rise from below; p: animation progress 0..1 */
  set(presence: number, p: number) {
    this.group.visible = presence > 0.002;
    const e = 1 - Math.pow(1 - clamp(presence), 3);
    this.group.position.y = -7 * (1 - e);
    this.group.scale.setScalar(0.55 + 0.45 * e);
    const lineOp = (l: LineSegments2, v: number) => {
      const m = l.material as LineMaterial;
      m.opacity = clamp(v);
      l.visible = m.opacity > 0.004;
    };
    const draw = clamp(p / 0.16);
    lineOp(this.zLine, draw * (1 - clamp((p - 0.34) / 0.1)));
    lineOp(this.ghost, clamp((p - 0.36) / 0.1) * 0.9);
    lineOp(this.beforeDim, clamp((p - 0.04) / 0.14));
    lineOp(this.afterDim, clamp((p - 0.82) / 0.14));
    lineOp(this.sutures, clamp((p - 0.84) / 0.14));
    const q = easeInOut(clamp((p - 0.34) / 0.46));
    const lift = Math.sin(Math.PI * q) * 1.15;
    const flapVis = clamp((p - 0.14) / 0.1);
    this.flaps.forEach((f, i) => {
      f.visible = flapVis > 0.002;
      f.rotation.y = q * (Math.PI / 2);
      f.position.y = lift + (i === 1 ? 0.02 * Math.sin(Math.PI * q) : 0);
    });
  }
}
