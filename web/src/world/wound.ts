import { fbm, smoothstep } from './noise';

/* One chronic-looking wound, defined analytically so the 3D crater, the contour lines and the on-screen
   measurements all come from the same numbers (1 world unit = 1 cm). */
export const WOUND = { a: 2.7, b: 1.75, rot: 0.42, depth: 1.18 };

export interface Field {
  rho: number; // normalised radius, 1 at the wound edge
  depth: number; // crater depth below the surface (cm), >= 0
  rim: number; // raised edge, >= 0
  surface: number; // y of the exposed surface
}

export function field(x: number, z: number): Field {
  const c = Math.cos(WOUND.rot);
  const s = Math.sin(WOUND.rot);
  const u = x * c + z * s;
  const v = -x * s + z * c;
  const th = Math.atan2(v / WOUND.b, u / WOUND.a);
  const wob = 1 + 0.15 * Math.sin(2 * th + 1.1) + 0.09 * Math.sin(3 * th + 0.3) + 0.05 * Math.sin(5 * th + 2.0) + 0.1 * (fbm(x * 0.9 + 4, z * 0.9 + 9, 3, 3) - 0.5);
  const rho = Math.hypot(u / WOUND.a, v / WOUND.b) / wob;
  const floorN = 1 + 0.09 * (fbm(x * 2.4, z * 2.4, 11, 3) - 0.5) * 2;
  const depth = WOUND.depth * floorN * (1 - smoothstep(0.66, 1.0, rho));
  const rim = 0.075 * Math.exp(-Math.pow((rho - 1.05) / 0.11, 2));
  return { rho, depth, rim, surface: -depth + rim };
}

/* Marching squares over any scalar function. Returns flat [x0,z0,x1,z1,...] segment endpoints. */
export function contour(f: (x: number, z: number) => number, level: number, half: number, n: number): number[] {
  const out: number[] = [];
  const step = (2 * half) / n;
  const val: number[] = new Array((n + 1) * (n + 1));
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) val[j * (n + 1) + i] = f(-half + i * step, -half + j * step) - level;
  const lerpPt = (x0: number, z0: number, v0: number, x1: number, z1: number, v1: number) => {
    const t = v0 / (v0 - v1);
    return [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t];
  };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x0 = -half + i * step;
      const z0 = -half + j * step;
      const x1 = x0 + step;
      const z1 = z0 + step;
      const a = val[j * (n + 1) + i];
      const b = val[j * (n + 1) + i + 1];
      const c = val[(j + 1) * (n + 1) + i + 1];
      const d = val[(j + 1) * (n + 1) + i];
      const idx = (a > 0 ? 1 : 0) | (b > 0 ? 2 : 0) | (c > 0 ? 4 : 0) | (d > 0 ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      const pts: Record<string, number[]> = {
        t: lerpPt(x0, z0, a, x1, z0, b),
        r: lerpPt(x1, z0, b, x1, z1, c),
        bt: lerpPt(x0, z1, d, x1, z1, c),
        l: lerpPt(x0, z0, a, x0, z1, d),
      };
      const segs: [string, string][] = [];
      switch (idx) {
        case 1: case 14: segs.push(['l', 't']); break;
        case 2: case 13: segs.push(['t', 'r']); break;
        case 3: case 12: segs.push(['l', 'r']); break;
        case 4: case 11: segs.push(['r', 'bt']); break;
        case 5: segs.push(['l', 'bt'], ['t', 'r']); break;
        case 6: case 9: segs.push(['t', 'bt']); break;
        case 7: case 8: segs.push(['l', 'bt']); break;
        case 10: segs.push(['l', 't'], ['r', 'bt']); break;
      }
      for (const [p, q] of segs) out.push(pts[p][0], pts[p][1], pts[q][0], pts[q][1]);
    }
  }
  return out;
}

export interface WoundStats {
  lengthCm: number;
  widthCm: number;
  areaCm2: number;
  perimeterCm: number;
}

/* Length/width along the wound's own axes, area by cell counting, perimeter by contour length. */
export function stats(): WoundStats {
  const half = 4.5;
  const n = 360;
  const step = (2 * half) / n;
  let cells = 0;
  let umin = 1e9, umax = -1e9, vmin = 1e9, vmax = -1e9;
  const c = Math.cos(WOUND.rot);
  const s = Math.sin(WOUND.rot);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -half + (i + 0.5) * step;
      const z = -half + (j + 0.5) * step;
      if (field(x, z).rho <= 1) {
        cells++;
        const u = x * c + z * s;
        const v = -x * s + z * c;
        umin = Math.min(umin, u); umax = Math.max(umax, u); vmin = Math.min(vmin, v); vmax = Math.max(vmax, v);
      }
    }
  }
  const seg = contour((x, z) => field(x, z).rho, 1, half, n);
  let per = 0;
  for (let k = 0; k < seg.length; k += 4) per += Math.hypot(seg[k + 2] - seg[k], seg[k + 3] - seg[k + 1]);
  return { lengthCm: umax - umin, widthCm: vmax - vmin, areaCm2: cells * step * step, perimeterCm: per };
}

export function axisExtent() {
  const half = 4.5;
  const n = 360;
  const step = (2 * half) / n;
  const c = Math.cos(WOUND.rot);
  const s = Math.sin(WOUND.rot);
  let umin = 1e9, umax = -1e9, vmin = 1e9, vmax = -1e9;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = -half + (i + 0.5) * step;
      const z = -half + (j + 0.5) * step;
      if (field(x, z).rho <= 1) {
        const u = x * c + z * s;
        const v = -x * s + z * c;
        umin = Math.min(umin, u); umax = Math.max(umax, u); vmin = Math.min(vmin, v); vmax = Math.max(vmax, v);
      }
    }
  const toXZ = (u: number, v: number): [number, number] => [u * c - v * s, u * s + v * c];
  return { umin, umax, vmin, vmax, toXZ, c, s };
}
