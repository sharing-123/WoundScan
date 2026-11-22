/* Canvas drawing of the annotated photo and the surgical marking. Units are working pixels; k scales line widths so
   exports stay crisp. Palette: surgical marker ink, measuring-tape yellow, bone and ink. */
import type { P2 } from './geom';
import type { Plan } from './planner';
import type { Stage } from './raster';
import { lang } from '../i18n';

export const TAPE = '#f2b632';
export const INK = 'rgba(21,17,14,.88)';
const BONE = '#f1ebdd';
const MARK = '#6f5bff';
const MARK2 = '#3d2fd0';
const MONO = '"IBM Plex Mono", ui-monospace, Consolas, monospace';
const SANS = '"Bricolage Grotesque Variable", "Bricolage Grotesque", system-ui, sans-serif';

export function pill(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, k: number, o: { rot?: number; color?: string; bg?: string; txt?: string; size?: number; mono?: boolean } = {}) {
  const fs = (o.size || 12) * k;
  ctx.save();
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.font = `600 ${fs}px ${o.mono === false ? SANS : MONO}`;
  const tw = ctx.measureText(text).width, ph = 6 * k, pv = 4 * k;
  const w = tw + 2 * ph, h = fs + 2 * pv;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 3 * k);
  ctx.fillStyle = o.bg || INK; ctx.fill();
  ctx.lineWidth = 1.1 * k; ctx.strokeStyle = o.color || TAPE; ctx.stroke();
  ctx.fillStyle = o.txt || BONE; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0.5 * k);
  ctx.restore();
}

function arrowHead(ctx: CanvasRenderingContext2D, tip: P2, ux: number, uy: number, k: number, size: number) {
  const s = size * k;
  ctx.beginPath();
  ctx.moveTo(tip[0], tip[1]);
  ctx.lineTo(tip[0] - ux * s - uy * s * 0.38, tip[1] - uy * s + ux * s * 0.38);
  ctx.lineTo(tip[0] - ux * s + uy * s * 0.38, tip[1] - uy * s - ux * s * 0.38);
  ctx.closePath();
  ctx.fill();
}

function dim(ctx: CanvasRenderingContext2D, a: P2, b: P2, off: number, text: string, k: number, color: string, centroid: P2, p: number) {
  const dx = b[0] - a[0], dy = b[1] - a[1], Ln = Math.hypot(dx, dy) || 1;
  const ux = dx / Ln, uy = dy / Ln;
  let nx = -uy, ny = ux;
  const mid: P2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if ((mid[0] + nx * off - centroid[0]) * nx + (mid[1] + ny * off - centroid[1]) * ny < 0) { nx = -nx; ny = -ny; }
  const o = Math.max(off * k, off * k + (74 * k - Ln) / 2);
  const A: P2 = [a[0] + nx * o, a[1] + ny * o], B: P2 = [b[0] + nx * o, b[1] + ny * o];
  const cx = (A[0] + B[0]) / 2, cy = (A[1] + B[1]) / 2;
  const A2: P2 = [cx + (A[0] - cx) * p, cy + (A[1] - cy) * p], B2: P2 = [cx + (B[0] - cx) * p, cy + (B[1] - cy) * p];
  ctx.save();
  ctx.globalAlpha = Math.min(1, p * 1.4);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.1 * k;
  ctx.setLineDash([2.5 * k, 3 * k]);
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(A[0] + nx * 5 * k, A[1] + ny * 5 * k); ctx.moveTo(b[0], b[1]); ctx.lineTo(B[0] + nx * 5 * k, B[1] + ny * 5 * k); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = INK; ctx.lineWidth = 3.4 * k; ctx.beginPath(); ctx.moveTo(A2[0], A2[1]); ctx.lineTo(B2[0], B2[1]); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = 1.7 * k; ctx.beginPath(); ctx.moveTo(A2[0], A2[1]); ctx.lineTo(B2[0], B2[1]); ctx.stroke();
  arrowHead(ctx, A2, -ux, -uy, k, 8); arrowHead(ctx, B2, ux, uy, k, 8);
  ctx.restore();
  if (p > 0.6) {
    let ang = Math.atan2(dy, dx);
    if (ang > Math.PI / 2) ang -= Math.PI;
    if (ang < -Math.PI / 2) ang += Math.PI;
    ctx.save(); ctx.globalAlpha = Math.min(1, (p - 0.6) / 0.4);
    pill(ctx, cx, cy, text, k, { rot: ang, color });
    ctx.restore();
  }
}

const niceLen = (cm: number) => { const v = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50]; let best = v[0]; for (const x of v) if (x <= cm) best = x; return best; };

export function scaleBar(ctx: CanvasRenderingContext2D, W: number, H: number, k: number, cmPerPx: number, approx: boolean) {
  const cm = niceLen(W * 0.2 * cmPerPx), len = cm / cmPerPx;
  const x0 = 18 * k, y0 = H - 26 * k, th = 5 * k;
  ctx.save();
  ctx.fillStyle = 'rgba(21,17,14,.78)'; ctx.beginPath(); ctx.roundRect(x0 - 8 * k, y0 - 22 * k, len + 16 * k, 38 * k, 4 * k); ctx.fill();
  const n = cm >= 1 ? 4 : 2;
  for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? BONE : TAPE; ctx.fillRect(x0 + (len * i) / n, y0, len / n, th); }
  ctx.strokeStyle = BONE; ctx.lineWidth = 1 * k; ctx.strokeRect(x0, y0, len, th);
  ctx.fillStyle = BONE; ctx.font = `600 ${11 * k}px ${MONO}`; ctx.textAlign = 'left';
  ctx.fillText(`${approx ? '≈ ' : ''}${cm >= 1 ? `${cm} cm` : `${cm * 10} mm`}`, x0, y0 - 6 * k);
  ctx.restore();
}

function strokePolys(ctx: CanvasRenderingContext2D, polys: P2[][], k: number, color: string, lw: number, p = 1, dash?: number[]) {
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const poly of polys) {
    ctx.beginPath();
    poly.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.closePath();
    let len = 0;
    for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; len += Math.hypot(b[0] - a[0], b[1] - a[1]); }
    if (p < 1) ctx.setLineDash([len * p, len]); else if (dash) ctx.setLineDash(dash.map((v) => v * k));
    ctx.strokeStyle = INK; ctx.lineWidth = (lw + 2.4) * k; ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = lw * k; ctx.stroke();
  }
  ctx.restore();
}

export interface AnnoOpts { tissue: boolean; contour: boolean; dims: boolean; feret: boolean; scale: boolean; margin?: number; approxScale: boolean; unit: string }

/** p: reveal progress 0..1 (the contour draws on, the dimension lines open, then the labels appear) */
export function annotate(ctx: CanvasRenderingContext2D, st: Stage, k: number, o: AnnoOpts, p = 1) {
  const { W, H, geo } = st;
  if (!geo) return;
  const cm = st.cmPerPx;
  if (o.tissue && st.tissue) { ctx.save(); ctx.globalAlpha = Math.min(1, p * 1.5) * 0.6; ctx.drawImage(st.tissue, 0, 0, W, H); ctx.restore(); }
  else if (o.contour) {
    ctx.save(); ctx.globalAlpha = Math.min(1, p) * 0.9; ctx.fillStyle = 'rgba(242,182,50,.2)'; ctx.beginPath();
    geo.polys.forEach((q) => { q.forEach((v, i) => (i ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1]))); ctx.closePath(); });
    ctx.fill('evenodd'); ctx.restore();
  }
  if (o.margin && geo.marginPoly(o.margin)) strokePolys(ctx, [geo.marginPoly(o.margin)!], k, '#fb7185', 1.6, 1, [6, 4]);
  if (o.contour) strokePolys(ctx, geo.polys.slice(0, 3), k, TAPE, 2.2, Math.min(1, p / 0.55));
  const f = (px: number) => (px * cm).toFixed(2);
  const cen = geo.centroid;
  if (o.dims) {
    const s = geo.shape, r = s.rect;
    ctx.save(); ctx.globalAlpha = Math.min(1, p * 1.2); ctx.setLineDash([5 * k, 4 * k]); ctx.strokeStyle = 'rgba(241,235,221,.6)'; ctx.lineWidth = 1 * k; ctx.beginPath();
    r.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); ctx.stroke(); ctx.restore();
    const l1 = Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]), l2 = Math.hypot(r[2][0] - r[1][0], r[2][1] - r[1][1]);
    const dp = Math.max(0, Math.min(1, (p - 0.35) / 0.65));
    dim(ctx, r[0], r[1], 24, `${f(l1)} ${o.unit}`, k, TAPE, cen, dp);
    dim(ctx, r[1], r[2], 24, `${f(l2)} ${o.unit}`, k, BONE, cen, dp);
  }
  if (o.feret) {
    const s = geo.shape;
    ctx.save(); ctx.globalAlpha = Math.min(1, p); ctx.strokeStyle = BONE; ctx.fillStyle = BONE; ctx.lineWidth = 1.2 * k;
    ctx.beginPath(); ctx.moveTo(s.feretA[0], s.feretA[1]); ctx.lineTo(s.feretB[0], s.feretB[1]); ctx.stroke();
    [s.feretA, s.feretB].forEach((q) => { ctx.beginPath(); ctx.arc(q[0], q[1], 3.2 * k, 0, 6.2832); ctx.fill(); });
    ctx.restore();
  }
  if (o.scale) scaleBar(ctx, W, H, k, cm, o.approxScale);
}

/* ---------- surgical marking (sterile marker pen look) ---------- */
function polyPath(ctx: CanvasRenderingContext2D, p: P2[]) { ctx.beginPath(); p.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); }
function hatch(ctx: CanvasRenderingContext2D, p: P2[], k: number, color: string, gap: number, ang: number) {
  ctx.save(); polyPath(ctx, p); ctx.clip();
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  p.forEach((q) => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0);
  ctx.translate(cx, cy); ctx.rotate(ang); ctx.strokeStyle = color; ctx.lineWidth = 1.3 * k;
  for (let t = -R; t <= R; t += gap * k) { ctx.beginPath(); ctx.moveTo(-R, t); ctx.lineTo(R, t); ctx.stroke(); }
  ctx.restore();
}

export function marking(ctx: CanvasRenderingContext2D, pl: Plan, k: number, p = 1) {
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.globalAlpha = Math.min(1, p * 1.3);
  for (const it of pl.items) {
    if (it.t === 'poly' && Array.isArray(it.p) && Array.isArray(it.p[0])) {
      const pp = it.p as P2[];
      if (it.fill === 'excise') { ctx.save(); polyPath(ctx, pp); ctx.fillStyle = 'rgba(244,114,182,.16)'; ctx.fill(); ctx.restore(); hatch(ctx, pp, k, 'rgba(244,114,182,.85)', 5.5, Math.PI / 4); }
      if (it.fill === 'graft') { ctx.save(); polyPath(ctx, pp); ctx.fillStyle = 'rgba(52,211,153,.14)'; ctx.fill(); ctx.restore(); hatch(ctx, pp, k, 'rgba(52,211,153,.6)', 7, -Math.PI / 4); hatch(ctx, pp, k, 'rgba(52,211,153,.35)', 7, Math.PI / 4); }
      if (it.s === 'incise') { polyPath(ctx, pp); ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = 4.4 * k; ctx.stroke(); ctx.strokeStyle = MARK; ctx.lineWidth = 2.4 * k; ctx.stroke(); }
      else if (it.s === 'graft') { polyPath(ctx, pp); ctx.setLineDash([6 * k, 4 * k]); ctx.strokeStyle = '#34d399'; ctx.lineWidth = 2 * k; ctx.stroke(); ctx.setLineDash([]); }
      else if (it.s === 'margin') { polyPath(ctx, pp); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.2 * k; ctx.setLineDash([4 * k, 3 * k]); ctx.stroke(); ctx.setLineDash([]); }
    } else if (it.t === 'line' && it.a && it.b) {
      ctx.beginPath(); ctx.moveTo(it.a[0], it.a[1]); ctx.lineTo(it.b[0], it.b[1]);
      const w = it.w || 1.5;
      if (it.s === 'incise') { ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = (w + 2.2) * k; ctx.stroke(); ctx.strokeStyle = MARK; ctx.lineWidth = w * k * 1.2; ctx.stroke(); }
      else if (it.s === 'flaptip') { ctx.setLineDash([5 * k, 4 * k]); ctx.strokeStyle = MARK2; ctx.lineWidth = w * k; ctx.stroke(); ctx.setLineDash([]); }
      else if (it.s === 'closure') { ctx.setLineDash([8 * k, 5 * k]); ctx.strokeStyle = '#fde047'; ctx.lineWidth = w * k; ctx.stroke(); ctx.setLineDash([]); }
      else if (it.s === 'stitch') { ctx.strokeStyle = 'rgba(255,255,255,.88)'; ctx.lineWidth = w * k; ctx.setLineDash([3 * k, 3 * k]); ctx.stroke(); ctx.setLineDash([]); }
    } else if (it.t === 'dot' && it.p && !Array.isArray((it.p as P2[])[0])) {
      const q = it.p as unknown as P2;
      ctx.beginPath(); ctx.arc(q[0], q[1], 2.8 * k, 0, 6.2832); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.2 * k; ctx.strokeStyle = MARK2; ctx.stroke();
    } else if (it.t === 'arrow' && it.a && it.b) {
      const dx = it.b[0] - it.a[0], dy = it.b[1] - it.a[1], Ln = Math.hypot(dx, dy) || 1, ux = dx / Ln, uy = dy / Ln;
      ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 6 * k; ctx.beginPath(); ctx.moveTo(it.a[0], it.a[1]); ctx.lineTo(it.b[0], it.b[1]); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.moveTo(it.a[0], it.a[1]); ctx.lineTo(it.b[0], it.b[1]); ctx.stroke();
      arrowHead(ctx, it.b, ux, uy, k, 13);
    }
  }
  ctx.restore();
  ctx.save();
  pl.items.filter((i) => i.t === 'label').forEach((it) => { const q = it.p as unknown as P2; pill(ctx, q[0], q[1], it.text || '', k, { size: 11, color: MARK2, bg: 'rgba(255,255,255,.95)', txt: '#1c1370' }); });
  ctx.restore();
}

export const unitLabel = () => (lang() === 'id' ? 'cm' : 'cm');
