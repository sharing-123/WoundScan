import * as THREE from 'three';
import { rulerTexture } from './textures';
import { fatLines } from './stage';
import { axisExtent } from './wound';
import type { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import type { LineMaterial } from 'three/addons/lines/LineMaterial.js';

export interface Anchors {
  length: THREE.Vector3;
  width: THREE.Vector3;
  ruler: THREE.Vector3;
}

/* A 6 cm paper ruler lying beside the wound, and dimension lines along the wound's own axes. */
export class Measure {
  group = new THREE.Group();
  ruler: THREE.Mesh;
  dims: LineSegments2[] = [];
  anchors: Anchors;

  constructor(plane: THREE.Plane) {
    const tex = rulerTexture(6);
    const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, clippingPlanes: [plane] });
    const side = new THREE.MeshStandardMaterial({ color: '#e7dfce', roughness: 0.85, clippingPlanes: [plane] });
    this.ruler = new THREE.Mesh(new THREE.BoxGeometry(6, 0.045, 0.62), [side, side, top, side, side, side]);
    this.ruler.position.set(-0.2, 0.05, 3.7);
    this.ruler.rotation.y = 0.0;
    this.group.add(this.ruler);

    const e = axisExtent();
    const y = 0.07;
    const off = 0.55;
    const pt = (u: number, v: number) => {
      const [x, z] = e.toXZ(u, v);
      return new THREE.Vector3(x, y, z);
    };
    // length: along u, offset beyond the wound on +v side
    const l0 = pt(e.umin, e.vmax + off);
    const l1 = pt(e.umax, e.vmax + off);
    const seg = (a: THREE.Vector3, b: THREE.Vector3) => [a.x, a.y, a.z, b.x, b.y, b.z];
    const cap = (c: THREE.Vector3, du: number, dv: number) => {
      const p = new THREE.Vector3().copy(c);
      const [dx, dz] = e.toXZ(du, dv);
      return seg(new THREE.Vector3(p.x - dx, p.y, p.z - dz), new THREE.Vector3(p.x + dx, p.y, p.z + dz));
    };
    const lenLine = fatLines([...seg(l0, l1), ...cap(l0, 0, 0.22), ...cap(l1, 0, 0.22)], '#f2b632', 2.4);
    const w0 = pt(e.umax + off, e.vmin);
    const w1 = pt(e.umax + off, e.vmax);
    const widLine = fatLines([...seg(w0, w1), ...cap(w0, 0.22, 0), ...cap(w1, 0.22, 0)], '#f2b632', 2.4);
    this.dims = [lenLine, widLine];
    this.dims.forEach((d) => this.group.add(d));
    this.anchors = {
      length: l0.clone().lerp(l1, 0.5),
      width: w0.clone().lerp(w1, 0.5),
      ruler: new THREE.Vector3(2.6, 0.08, 3.7),
    };
    this.set(0);
  }

  /* p: 0 hidden, 1 fully shown */
  set(p: number) {
    this.group.visible = p > 0.002;
    const e = 1 - Math.pow(1 - Math.min(1, p), 3);
    this.ruler.position.x = -0.2 - (1 - e) * 9;
    this.ruler.rotation.y = (1 - e) * 0.5;
    this.dims.forEach((d) => {
      const m = d.material as LineMaterial;
      m.opacity = Math.max(0, Math.min(1, (p - 0.25) / 0.5));
      d.visible = m.opacity > 0.003;
    });
  }
}
