import { clamp, easeInOut, smoothstep, lerp } from './noise';

export interface Key {
  cam: [number, number, number];
  tgt: [number, number, number];
  fov: number;
  shiftX: number; // fraction of width the subject is pushed to the right
  cut: number;
  outline: number;
  doubt: number;
  iso: number;
  mask: number;
  ruler: number;
  block: number;
  tile: number;
  body: number;
  lens: number;
  lensX: number;
  lensY: number;
  pulse: number;
  pulseR: number;
  explode: number;
  beam: number;
  span: number; // width of the subject as a fraction of the screen at aspect 1.78
}

/* One key per chapter, in DOM order: hero, layers, scan, measure, plan, body, private. */
export const KEYS: Key[] = [
  { cam: [13.5, 8.2, 17.2], tgt: [0, -1.6, 0], fov: 30, shiftX: 0.27, cut: 5, outline: 0, doubt: 0, iso: 0, mask: 0, ruler: 0, block: 1, tile: 0, body: 0, lens: 1, lensX: 0, lensY: 2.6, pulse: 0, pulseR: 8, explode: 0, beam: 1.0, span: 0.6 },
  { cam: [1.2, -0.2, 25.5], tgt: [0, -3.0, 0], fov: 30, shiftX: -0.2, cut: 0.15, outline: 0, doubt: 0, iso: 0, mask: 0, ruler: 0, block: 1, tile: 0, body: 0, lens: 0, lensX: -5, lensY: 3.4, pulse: 0, pulseR: 8, explode: 1.15, beam: 0.55, span: 0.5 },
  { cam: [10.5, 17.8, 14.6], tgt: [0, -0.7, 0], fov: 28, shiftX: 0.22, cut: 5, outline: 1, doubt: 0.85, iso: 1, mask: 0.5, ruler: 0, block: 1, tile: 0, body: 0, lens: 1, lensX: 0, lensY: 1.5, pulse: 0, pulseR: 8, explode: 0, beam: 0.25, span: 0.55 },
  { cam: [-7.8, 20.0, 13.8], tgt: [0, -0.2, 0.6], fov: 27, shiftX: -0.24, cut: 5, outline: 1, doubt: 0.35, iso: 1, mask: 0.28, ruler: 1, block: 1, tile: 0, body: 0, lens: 0, lensX: 5, lensY: 3, pulse: 0, pulseR: 8, explode: 0, beam: 0.0, span: 0.56 },
  { cam: [3.0, 18.5, 9.5], tgt: [0, 0, 0.2], fov: 28, shiftX: 0.2, cut: 5, outline: 0, doubt: 0, iso: 0, mask: 0, ruler: 0, block: 0, tile: 1, body: 0, lens: 0, lensX: 0, lensY: 3.2, pulse: 0, pulseR: 8, explode: 0, beam: 0.0, span: 0.5 },
  { cam: [0, 1.6, 31], tgt: [0, 1.6, 0], fov: 28, shiftX: -0.22, cut: 5, outline: 0, doubt: 0, iso: 0, mask: 0, ruler: 0, block: 0, tile: 0, body: 1, lens: 0, lensX: 0, lensY: 3, pulse: 0, pulseR: 8, explode: 0, beam: 0.0, span: 0.3 },
  { cam: [0.1, 25, 12], tgt: [0, -3.4, 0], fov: 32, shiftX: 0.2, cut: 5, outline: 0.55, doubt: 0, iso: 0.4, mask: 0, ruler: 0, block: 1, tile: 0, body: 0, lens: 1, lensX: 0, lensY: 1.8, pulse: 1, pulseR: 4.5, explode: 0, beam: 0.45, span: 0.5 },
];

export interface Chapter {
  top: number;
  height: number;
}

export interface State {
  key: Key;
  scanX: number;
  scanProg: number;
  scanOn: number;
  zp: number;
  bp: number;
  rulerP: number;
  localT: number[];
  index: number; // continuous chapter index, e.g. 2.4
}

const lerpKey = (a: Key, b: Key, f: number): Key => {
  const o = {} as Record<string, unknown>;
  (Object.keys(a) as (keyof Key)[]).forEach((k) => {
    const va = a[k];
    const vb = b[k];
    o[k] = Array.isArray(va) ? (va as number[]).map((x, i) => lerp(x, (vb as number[])[i], f)) : lerp(va as number, vb as number, f);
  });
  return o as unknown as Key;
};

/* s: scrollY, vh: viewport height. Pure function of scroll, so the world is fully reversible. */
export function evaluate(chapters: Chapter[], s: number, vh: number): State {
  const n = chapters.length;
  const mid = s + vh * 0.5;
  const centers = chapters.map((c) => c.top + c.height * 0.5);
  const localT = chapters.map((c) => clamp((mid - c.top) / c.height));
  let i = 0;
  while (i < n - 2 && mid > centers[i + 1]) i++;
  const span = centers[i + 1] - centers[i];
  const u = clamp((mid - centers[i]) / span, 0, 1);
  const f = easeInOut(clamp((u - 0.2) / 0.6));
  const key = lerpKey(KEYS[Math.min(i, KEYS.length - 1)], KEYS[Math.min(i + 1, KEYS.length - 1)], f);
  // arc the camera a little during a flight, so it travels instead of sliding
  key.cam[1] += Math.sin(Math.PI * f) * 1.4;

  const scanT = clamp((localT[2] - 0.12) / 0.7);
  const scanProg = mid < centers[2] - chapters[2].height * 0.5 ? 0 : mid > chapters[2].top + chapters[2].height ? 1 : scanT;
  const scanX = lerp(-6.4, 6.8, easeInOut(scanProg));
  const scanOn = scanProg > 0.002 && scanProg < 0.998 ? 1 : 0;
  key.outline *= smoothstep(0.42, 0.78, scanProg);
  key.doubt *= smoothstep(0.5, 0.85, scanProg);
  key.mask *= smoothstep(0.0, 0.1, scanProg);
  if (i === 1 || i === 2) key.lensX = scanX;
  const zp = clamp((localT[4] - 0.1) / 0.8);
  const bp = clamp((localT[5] - 0.08) / 0.84);
  const rulerP = key.ruler;
  return { key, scanX, scanProg, scanOn, zp, bp, rulerP, localT, index: i + f };
}
