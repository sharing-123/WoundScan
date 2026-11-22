import { animate, inView, stagger } from 'motion';
import { lang, onLang } from '../i18n';

interface Row {
  photo: string;
  adapted: number;
  zero_shot: number;
}
interface Data {
  medetec_cv: Row[];
  summary: { medetec_dice_img: number; medetec_ci95: [number, number]; photos_ge_085: number; n_photos: number };
}

const NS = 'http://www.w3.org/2000/svg';
const el = (n: string, a: Record<string, string | number> = {}) => {
  const e = document.createElementNS(NS, n);
  for (const k in a) e.setAttribute(k, String(a[k]));
  return e;
};
const fmt = (v: number, d = 3) => (lang() === 'id' ? v.toFixed(d).replace('.', ',') : v.toFixed(d));

/* One dot per photograph: the whole distribution, so the weak cases are as visible as the strong ones. */
export async function mountEvidence() {
  const svg = document.getElementById('evSvg') as unknown as SVGSVGElement | null;
  const cap = document.getElementById('evCap');
  if (!svg || !cap) return;
  let data: Data;
  try {
    data = await (await fetch('/data/evidence.json')).json();
  } catch {
    return;
  }
  const rows = [...data.medetec_cv].sort((a, b) => a.adapted - b.adapted);
  const W = 760;
  const H = 320;
  const pad = { l: 12, r: 12, t: 30, b: 40 };
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const lo = 0.6;
  const hi = 1.0;
  const X = (v: number) => pad.l + ((v - lo) / (hi - lo)) * (W - pad.l - pad.r);
  const axisY = H - pad.b;
  svg.append(el('line', { class: 'axis', x1: pad.l, x2: W - pad.r, y1: axisY, y2: axisY }));
  for (let v = 0.6; v <= 1.0001; v += 0.1) {
    svg.append(el('line', { class: 'axis', x1: X(v), x2: X(v), y1: axisY, y2: axisY + 5 }));
    const tx = el('text', { x: X(v), y: axisY + 20, 'text-anchor': 'middle' });
    tx.textContent = v.toFixed(1);
    svg.append(tx);
  }
  svg.append(el('line', { class: 'thr', x1: X(0.85), x2: X(0.85), y1: pad.t - 8, y2: axisY }));
  const tl = el('text', { class: 'thr-l', x: X(0.85) + 6, y: pad.t - 12 });
  tl.textContent = '0.85';
  svg.append(tl);

  // beeswarm: place each dot at its value, stack when neighbours overlap
  const r = 6.5;
  const placed: { x: number; y: number }[] = [];
  const dots: SVGCircleElement[] = [];
  rows.forEach((row) => {
    const x = X(row.adapted);
    let y = axisY - r - 4;
    for (let tries = 0; tries < 60; tries++) {
      const hit = placed.find((p) => Math.hypot(p.x - x, p.y - y) < r * 2 + 1.2);
      if (!hit) break;
      y -= r * 2 + 1.2;
    }
    placed.push({ x, y });
    const c = el('circle', { class: 'dot' + (row.adapted < 0.85 ? ' low' : ''), cx: x, cy: y, r, tabindex: 0, 'data-photo': row.photo, 'data-v': row.adapted }) as SVGCircleElement;
    c.style.opacity = '0';
    dots.push(c);
    svg.append(c);
  });
  const med = rows[Math.floor(rows.length / 2)].adapted;
  svg.append(el('line', { class: 'med', x1: X(med), x2: X(med), y1: axisY + 1, y2: axisY - 16 }));

  const ann = el('text', { class: 'ann', x: X(0.85) - 8, y: pad.t + 14, 'text-anchor': 'end' });
  const refreshAnn = () => {
    ann.textContent = lang() === 'id' ? `${data.summary.photos_ge_085} dari ${data.summary.n_photos} foto di kanan garis` : `${data.summary.photos_ge_085} of ${data.summary.n_photos} photographs right of the line`;
  };
  refreshAnn();
  svg.append(ann);

  const base = () => {
    cap.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = fmt(data.summary.medetec_dice_img);
    cap.append(b, document.createTextNode(lang() === 'id' ? ` Dice rata-rata, CI 95% ${fmt(data.summary.medetec_ci95[0])} sampai ${fmt(data.summary.medetec_ci95[1])}. Titik merah di bawah 0,85.` : ` mean Dice, 95% CI ${fmt(data.summary.medetec_ci95[0])} to ${fmt(data.summary.medetec_ci95[1])}. Red dots are below 0.85.`));
  };
  base();
  onLang(() => {
    refreshAnn();
    base();
  });
  const show = (c: Element) => {
    cap.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = `${c.getAttribute('data-photo')}  Dice ${fmt(Number(c.getAttribute('data-v')))}`;
    cap.append(b);
  };
  svg.addEventListener('pointerover', (e) => {
    const c = (e.target as Element).closest('.dot');
    if (c) show(c);
  });
  svg.addEventListener('focusin', (e) => {
    const c = (e.target as Element).closest('.dot');
    if (c) show(c);
  });
  svg.addEventListener('pointerleave', base);

  inView(svg, () => {
    animate(dots, { opacity: [0, 1], transform: ['translateY(-10px)', 'translateY(0px)'] }, { delay: stagger(0.018), duration: 0.5, ease: [0.16, 1, 0.3, 1] });
  }, { amount: 0.4 });
}
