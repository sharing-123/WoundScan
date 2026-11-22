import * as THREE from 'three';
import { clamp, smoothstep } from './noise';

const H = 11.2;
const Y0 = -3.6; // feet level

interface Region {
  id: string;
  meshes: THREE.Mesh[];
  overlay: THREE.Mesh[];
}

/* A scan-style mannequin: dark clay body with contour rings, Lund and Browder regions lit one after another. */
export class Body {
  group = new THREE.Group();
  regions: Region[] = [];
  private u = { uRings: { value: 1 }, uSweep: { value: -1 } };
  private woundRing: THREE.Mesh;
  private woundDot: THREE.Mesh;
  anchors: Record<string, THREE.Vector3> = {};

  constructor() {
    const mat = new THREE.MeshStandardMaterial({ color: '#33271f', roughness: 0.62, metalness: 0.0 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uRings = this.u.uRings;
      sh.uniforms.uSweep = this.u.uSweep;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vW;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vW;\nuniform float uRings;\nuniform float uSweep;')
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          float yy = vW.y * 2.6;
          float d = abs(fract(yy + 0.5) - 0.5);
          float aa = max(fwidth(yy), 1e-4);
          float ring = 1.0 - smoothstep(0.6 * aa, 1.8 * aa, d);
          float band = exp(-pow((vW.y - uSweep) / 0.7, 2.0));
          totalEmissiveRadiance += vec3(0.95, 0.78, 0.45) * (ring * 0.26 * uRings + band * 0.5);`,
        );
    };
    const hl = new THREE.MeshBasicMaterial({ color: '#f2b632', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });

    const Y = (f: number) => Y0 + f * H;
    const X = (f: number) => f * H;
    const add = (id: string, m: THREE.Mesh) => {
      m.material = mat;
      this.group.add(m);
      const o = new THREE.Mesh(m.geometry, hl.clone());
      o.position.copy(m.position);
      o.rotation.copy(m.rotation);
      o.scale.copy(m.scale).multiplyScalar(1.025);
      this.group.add(o);
      let r = this.regions.find((q) => q.id === id);
      if (!r) this.regions.push((r = { id, meshes: [], overlay: [] }));
      r.meshes.push(m);
      r.overlay.push(o);
    };
    const ellipsoid = (id: string, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32));
      m.scale.set(rx, ry, rz);
      m.position.set(cx, cy, cz);
      add(id, m);
    };
    const limb = (id: string, a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number) => {
      const len = a.distanceTo(b);
      const g = new THREE.CylinderGeometry(r1, r0, len, 36, 1, false);
      const m = new THREE.Mesh(g);
      m.position.copy(a).lerp(b, 0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      add(id, m);
      ellipsoid(id, a.x, a.y, a.z, r0, r0, r0);
      ellipsoid(id, b.x, b.y, b.z, r1, r1, r1);
    };

    ellipsoid('head', 0, Y(0.935), 0, X(0.05), X(0.068), X(0.058));
    limb('neck', new THREE.Vector3(0, Y(0.875), 0), new THREE.Vector3(0, Y(0.915), 0), X(0.028), X(0.026));

    // torso as a lathe, flattened front to back
    const prof: THREE.Vector2[] = [
      [0.0, 0.842], [0.05, 0.84], [0.1, 0.832], [0.133, 0.814], [0.146, 0.788], [0.139, 0.75], [0.126, 0.7], [0.113, 0.65], [0.106, 0.6], [0.109, 0.56], [0.122, 0.535], [0.116, 0.5], [0.0, 0.49],
    ].map(([r, y]) => new THREE.Vector2(X(r), Y(y) - Y0));
    const tg = new THREE.LatheGeometry(prof, 56);
    const torso = new THREE.Mesh(tg);
    torso.position.set(0, Y0, 0);
    torso.scale.set(1, 1, 0.56);
    add('trunk', torso);

    for (const sg of [-1, 1]) {
      const v = (x: number, y: number, z = 0) => new THREE.Vector3(X(sg * x), Y(y), X(z));
      limb('arm', v(0.15, 0.8), v(0.186, 0.62), X(0.038), X(0.029));
      limb('arm', v(0.186, 0.62), v(0.214, 0.462), X(0.029), X(0.022));
      ellipsoid('arm', X(sg * 0.223), Y(0.42), 0, X(0.017), X(0.034), X(0.012));
      limb('leg', v(0.056, 0.52), v(0.07, 0.285), X(0.06), X(0.039));
      limb('leg', v(0.07, 0.285), v(0.062, 0.05), X(0.039), X(0.025));
      ellipsoid('leg', X(sg * 0.062), Y(0.022), X(0.03), X(0.026), X(0.014), X(0.05));
    }

    // wound marker on the right shin (patient's right = viewer's left)
    this.woundDot = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), new THREE.MeshBasicMaterial({ color: '#f2b632', transparent: true, opacity: 0 }));
    this.woundDot.position.set(X(-0.0605), Y(0.16), X(0.0365));
    this.woundRing = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.34, 48), new THREE.MeshBasicMaterial({ color: '#f2b632', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.woundRing.position.copy(this.woundDot.position);
    this.group.add(this.woundDot, this.woundRing);

    this.anchors = {
      head: new THREE.Vector3(X(0.05), Y(0.955), 0),
      trunk: new THREE.Vector3(X(0.13), Y(0.7), X(0.05)),
      arm: new THREE.Vector3(X(0.19), Y(0.6), 0),
      leg: new THREE.Vector3(X(0.068), Y(0.34), 0),
      wound: this.woundDot.position.clone(),
    };
    this.set(0, 0);
  }

  /* presence: 0..1 rise from below. p: 0..1 sweep and region highlights */
  set(presence: number, p: number) {
    this.group.visible = presence > 0.002;
    const e = 1 - Math.pow(1 - clamp(presence), 3);
    this.group.position.y = -9 * (1 - e);
    this.group.scale.setScalar(0.6 + 0.4 * e);
    this.u.uSweep.value = Y0 + (1 - clamp(p / 0.5)) * H * 1.1 - 0.5;
    this.u.uRings.value = 1;
    const order = ['head', 'neck', 'trunk', 'arm', 'leg'];
    this.regions.forEach((r) => {
      const k = order.indexOf(r.id);
      const start = 0.3 + k * 0.1;
      const on = smoothstep(start, start + 0.08, p) * (1 - smoothstep(start + 0.16, start + 0.26, p)) * 0.26;
      const hold = r.id === 'leg' ? smoothstep(start, start + 0.08, p) * 0.16 : 0;
      r.overlay.forEach((o) => ((o.material as THREE.MeshBasicMaterial).opacity = Math.max(on, hold)));
    });
    const w = smoothstep(0.78, 0.9, p);
    (this.woundDot.material as THREE.MeshBasicMaterial).opacity = w;
    (this.woundRing.material as THREE.MeshBasicMaterial).opacity = w * (0.35 + 0.35 * Math.sin(p * 40));
    this.woundRing.scale.setScalar(1 + 0.25 * Math.sin(p * 40));
  }
}
