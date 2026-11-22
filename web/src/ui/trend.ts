import type { Trend } from './api';
import { lang } from '../i18n';

const NS = 'http://www.w3.org/2000/svg';
const el = (n: string, a: Record<string, string | number> = {}) => {
  const e = document.createElementNS(NS, n);
  for (const k in a) e.setAttribute(k, String(a[k]));
  return e;
};
const num = (v: number, d = 1) => (lang() === 'id' ? v.toFixed(d).replace('.', ',') : v.toFixed(d));

/* Area over days for one pseudonymous patient. Plain SVG, themed by CSS. */
export function renderTrend(host: HTMLElement, t: Trend | null) {
  host.innerHTML = '';
  if (!t) return;
  const title = document.createElement('h4');
  title.textContent = `${t.patient_code}`;
  title.style.cssText = 'font-size:1.05rem;margin:0';
  host.append(title);
  if (t.n < 2) {
    const p = document.createElement('p');
    p.textContent = t.note ?? '';
    host.append(p);
    return;
  }
  const W = 560;
  const H = 240;
  const m = { l: 44, r: 14, t: 14, b: 34 };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'trend' });
  const maxD = Math.max(...t.series.map((s) => s.day), 1);
  const maxA = Math.max(...t.series.map((s) => s.area_cm2)) * 1.1;
  const X = (d: number) => m.l + (d / maxD) * (W - m.l - m.r);
  const Y = (a: number) => H - m.b - (a / maxA) * (H - m.t - m.b);
  for (let i = 0; i <= 4; i++) {
    const a = (maxA / 4) * i;
    svg.append(el('line', { class: 'gr', x1: m.l, x2: W - m.r, y1: Y(a), y2: Y(a) }));
    const tx = el('text', { x: m.l - 6, y: Y(a) + 4, 'text-anchor': 'end' });
    tx.textContent = a.toFixed(a < 10 ? 1 : 0);
    svg.append(tx);
  }
  const xl = el('text', { x: W - m.r, y: H - 8, 'text-anchor': 'end' });
  xl.textContent = lang() === 'id' ? 'hari' : 'days';
  svg.append(xl);
  const yl = el('text', { x: m.l, y: 10 });
  yl.textContent = 'cm²';
  svg.append(yl);
  svg.append(el('polyline', { class: 'ln', points: t.series.map((s) => `${X(s.day)},${Y(s.area_cm2)}`).join(' ') }));
  t.series.forEach((s) => {
    svg.append(el('circle', { class: 'pt', cx: X(s.day), cy: Y(s.area_cm2), r: 4 }));
  });
  host.append(svg as unknown as Node);
  const p = document.createElement('p');
  const parts: string[] = [];
  if (t.percent_reduction_from_first !== null) parts.push(`${lang() === 'id' ? 'Perubahan luas dari pengukuran pertama' : 'Area change from first measurement'}: ${num(-t.percent_reduction_from_first)}%`);
  if (t.rate_cm2_per_week !== null) parts.push(`${lang() === 'id' ? 'Laju' : 'Rate'}: ${num(t.rate_cm2_per_week, 2)} cm²/${lang() === 'id' ? 'minggu' : 'week'}`);
  p.textContent = parts.join('. ') + (t.note ? `. ${t.note}` : '');
  host.append(p);
}
