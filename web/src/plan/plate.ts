/* The three-panel plate of the old planning sheet: measured photo, surgical marking, illustrative result.
   Everything is drawn from the uploaded photo's own mask, so no two plates look alike. */
import type { Stage } from './raster';
import type { Case } from '../clinic/engine';
import { annotate, marking, pill, TAPE, INK, type AnnoOpts } from './draw';
import { renderAfter } from './sim';
import { lang } from '../i18n';
import { pick, dec } from '../clinic/kb';

const T = (en: string, id: string) => (lang() === 'id' ? id : en);
export const kFor = (W: number) => Math.max(0.85, Math.min(1.7, W / 760));

export function makeCanvas(st: Stage, sf = Math.min(2, window.devicePixelRatio || 1)) {
  const c = document.createElement('canvas');
  c.width = Math.round(st.W * sf); c.height = Math.round(st.H * sf);
  const ctx = c.getContext('2d')!;
  ctx.scale(sf, sf);
  return { c, ctx };
}

function chip(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, k: number, color = TAPE) {
  ctx.save();
  ctx.font = `600 ${10.5 * k}px "IBM Plex Mono", ui-monospace, monospace`;
  const w = ctx.measureText(text).width + 14 * k;
  ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(x, y, w, 20 * k, 3 * k); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 1 * k; ctx.stroke();
  ctx.fillStyle = '#f1ebdd'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + 7 * k, y + 10.5 * k);
  ctx.restore();
}

export const defaultAnno = (c: Case, approx: boolean): AnnoOpts => ({ tissue: true, contour: true, dims: true, feret: false, scale: true, margin: undefined, approxScale: approx, unit: 'cm' });

export function paintAnnotated(ctx: CanvasRenderingContext2D, st: Stage, o: AnnoOpts, p = 1, title = true) {
  const { W, H } = st, k = kFor(W);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(st.img, 0, 0, W, H);
  // calm the photo around the wound so the ink reads
  ctx.save(); ctx.globalAlpha = 0.18 * Math.min(1, p * 2); ctx.fillStyle = '#0b0907'; ctx.fillRect(0, 0, W, H); ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  // keep the wound itself bright: redraw the photo inside the contour
  if (st.geo) {
    ctx.beginPath();
    st.geo.polys.forEach((q) => { q.forEach((v, i) => (i ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1]))); ctx.closePath(); });
    ctx.clip('evenodd'); ctx.drawImage(st.img, 0, 0, W, H);
  }
  ctx.restore();
  annotate(ctx, st, k, o, p);
  if (title) chip(ctx, 12 * k, 12 * k, T('1  MEASURED ON THE PHOTO', '1  DIUKUR PADA FOTO'), k);
}

export function paintMarking(ctx: CanvasRenderingContext2D, st: Stage, c: Case, p = 1, title = true) {
  const { W, H } = st, k = kFor(W);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(st.img, 0, 0, W, H);
  ctx.save(); ctx.globalAlpha = 0.1; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.restore();
  marking(ctx, c.plan, k, p);
  if (title) chip(ctx, 12 * k, 12 * k, `2  ${pick(c.plan.title).toUpperCase()}`, k, '#8b7cff');
}

export function paintResult(ctx: CanvasRenderingContext2D, st: Stage, c: Case, mode: 'day0' | 'mature' = 'day0', title = true) {
  const { W, H } = st, k = kFor(W);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(renderAfter(st, c.plan, mode), 0, 0, W, H);
  if (title) chip(ctx, 12 * k, 12 * k, mode === 'day0' ? T('3  ILLUSTRATIVE RESULT, DAY 0', '3  ILUSTRASI HASIL, HARI 0') : T('3  ILLUSTRATIVE RESULT, MATURE', '3  ILUSTRASI HASIL, MATANG'), k, '#34d399');
}

/** run draw(p) for p 0..1 over ms with ease-out; resolves at the end */
export function tween(ms: number, draw: (p: number) => void): Promise<void> {
  return new Promise((res) => {
    const t0 = performance.now();
    const step = (t: number) => {
      const x = Math.min(1, (t - t0) / ms);
      draw(1 - Math.pow(1 - x, 3));
      if (x < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
}

/** One PNG sheet: the three panels, the numbers and the steps. For the clinical record. */
export function exportPlate(st: Stage, c: Case, anno: AnnoOpts, title: string): Promise<Blob | null> {
  const pw = 760, ph = Math.round((pw * st.H) / st.W), gap = 18, pad = 34;
  const nums = c.plan.nums, steps = c.plan.steps;
  const numRows = Math.ceil(nums.length / 3);
  const textH = 70 + numRows * 40 + 30 + steps.length * 40 + 60;
  const W = pad * 2 + pw * 3 + gap * 2, H = pad + 76 + ph + textH + pad;
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const g = out.getContext('2d')!;
  g.fillStyle = '#f1ebdd'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#15110e'; g.font = '700 30px "Bricolage Grotesque Variable", system-ui, sans-serif';
  g.fillText(`${title}  ·  ${pick(c.plan.title)}`, pad, pad + 26);
  g.font = '500 15px "IBM Plex Mono", monospace'; g.fillStyle = '#5a5047';
  g.fillText(`${(c.areaCm2).toFixed(1)} cm²   ·   ${pick(c.scaleNote)}   ·   ${T('Illustrative plan for discussion, not an operative order.', 'Rencana ilustratif untuk diskusi, bukan perintah operasi.')}`, pad, pad + 52);
  const panels: HTMLCanvasElement[] = [];
  const mk = (fn: (ctx: CanvasRenderingContext2D) => void) => { const q = document.createElement('canvas'); q.width = st.W; q.height = st.H; fn(q.getContext('2d')!); panels.push(q); };
  mk((x) => paintAnnotated(x, st, anno, 1));
  mk((x) => paintMarking(x, st, c, 1));
  mk((x) => paintResult(x, st, c, 'day0'));
  panels.forEach((q, i) => {
    const x = pad + i * (pw + gap), y = pad + 76;
    g.save(); g.beginPath(); g.roundRect(x, y, pw, ph, 8); g.clip(); g.drawImage(q, x, y, pw, ph); g.restore();
  });
  let y = pad + 76 + ph + 44;
  g.fillStyle = '#15110e'; g.font = '700 16px "IBM Plex Mono", monospace'; g.fillText(T('NUMBERS', 'ANGKA'), pad, y); y += 26;
  nums.forEach((n, i) => {
    const col = i % 3, row = Math.floor(i / 3), x = pad + col * ((W - pad * 2) / 3), yy = y + row * 40;
    g.font = '500 13px "IBM Plex Mono", monospace'; g.fillStyle = '#6b6055'; g.fillText(pick(n.k), x, yy);
    g.font = '700 18px "Bricolage Grotesque Variable", system-ui, sans-serif'; g.fillStyle = n.warn ? '#b4232f' : '#15110e';
    g.fillText(`${typeof n.v === 'string' ? dec(n.v) : pick(n.v)} ${n.u ? (typeof n.u === 'string' ? n.u : pick(n.u)) : ''}`, x, yy + 20);
  });
  y += numRows * 40 + 22;
  g.fillStyle = '#15110e'; g.font = '700 16px "IBM Plex Mono", monospace'; g.fillText(T('STEPS', 'LANGKAH'), pad, y); y += 26;
  g.font = '500 15px "Bricolage Grotesque Variable", system-ui, sans-serif';
  steps.forEach((s, i) => { g.fillStyle = '#15110e'; g.fillText(`${i + 1}.  ${pick(s)}`.slice(0, 170), pad, y); y += 26; });
  return new Promise((res) => out.toBlob((b) => res(b), 'image/png'));
}

export { pill };
