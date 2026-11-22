import * as THREE from 'three';
import { clamp } from './noise';

/* The signature object: a thick glass scan lens ringed by two thin metal bands and a lit inner edge. */
export class Lens {
  group = new THREE.Group();
  private bands: THREE.Mesh[] = [];

  constructor() {
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      metalness: 0,
      roughness: 0.04,
      transmission: 1,
      thickness: 0.7,
      ior: 1.5,
      iridescence: 0.55,
      iridescenceIOR: 1.3,
      iridescenceThicknessMinimum: 120,
      iridescenceThicknessMaximum: 520,
      attenuationColor: new THREE.Color('#ffe2b0'),
      attenuationDistance: 3.5,
      envMapIntensity: 1.5,
      clearcoat: 1,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.17, 56, 200), glass);
    ring.rotation.x = Math.PI / 2;
    this.group.add(ring);

    const lit = new THREE.Mesh(new THREE.TorusGeometry(1.77, 0.017, 12, 200), new THREE.MeshBasicMaterial({ color: '#ffc43d', toneMapped: false }));
    lit.rotation.x = Math.PI / 2;
    this.group.add(lit);

    const metal = new THREE.MeshStandardMaterial({ color: '#e5ddcd', metalness: 1, roughness: 0.16, envMapIntensity: 1.6 });
    for (const [r, tilt, tw] of [[2.5, 0.55, 0.034], [2.95, -0.8, 0.028]] as [number, number, number][]) {
      const b = new THREE.Mesh(new THREE.TorusGeometry(r, tw, 16, 220), metal);
      b.rotation.set(Math.PI / 2 + tilt, 0.4, 0);
      this.bands.push(b);
      this.group.add(b);
    }
    this.group.visible = false;
  }

  /* presence 0..1, time in seconds */
  set(presence: number, x: number, y: number, z: number, t: number, spin = 1) {
    const e = 1 - Math.pow(1 - clamp(presence), 3);
    this.group.visible = e > 0.002;
    this.group.position.set(x, y + (1 - e) * 3.5, z);
    this.group.scale.setScalar(0.3 + 0.7 * e);
    this.group.rotation.y = t * 0.12 * spin;
    this.bands[0].rotation.z = t * 0.35 * spin;
    this.bands[1].rotation.z = -t * 0.27 * spin;
    this.group.rotation.x = Math.sin(t * 0.5) * 0.05 * spin;
  }
}
