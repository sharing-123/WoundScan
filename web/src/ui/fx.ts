/* A few quiet touches on top of the 3D story: ghost chapter numerals, a thin sweep line between chapters, a small HUD
   that scrambles to the new chapter name, a reticle cursor, magnetic buttons and a hair of skew from scroll speed.
   Everything is off for prefers-reduced-motion, and the pointer effects are off on touch screens. */
import { gsap } from 'gsap';
import type Lenis from 'lenis';

const GLYPHS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';

function scramble(el: HTMLElement, to: string, ms = 520) {
  const t0 = performance.now();
  const len = to.length;
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / ms);
    const lock = Math.floor(k * len);
    let s = to.slice(0, lock);
    for (let i = lock; i < len; i++) s += to[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    el.textContent = s;
    if (k < 1) requestAnimationFrame(step); else el.textContent = to;
  };
  requestAnimationFrame(step);
}

export function mountFx(o: { lenis: Lenis; story: HTMLElement; reduce: boolean }) {
  const { lenis, story, reduce } = o;
  const fine = matchMedia('(pointer: fine)').matches;
  const chapters = [...story.querySelectorAll<HTMLElement>('.chapter[data-ch]')].filter((c) => c.dataset.ch !== 'hero');

  /* ghost numerals: huge, faint, drifting against the scroll */
  chapters.forEach((ch, i) => {
    const g = document.createElement('span');
    g.className = 'ghost'; g.setAttribute('aria-hidden', 'true');
    g.textContent = String(i + 1).padStart(2, '0');
    ch.append(g);
    if (!reduce) gsap.fromTo(g, { yPercent: 18 }, { yPercent: -22, ease: 'none', scrollTrigger: { trigger: ch, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  /* HUD: chapter counter and name, scrambled in when the chapter changes */
  const hud = document.createElement('div');
  hud.className = 'hud'; hud.setAttribute('aria-hidden', 'true');
  hud.innerHTML = '<span class="hud-n">00</span><i></i><span class="hud-t"></span>';
  document.body.append(hud);
  const hn = hud.querySelector<HTMLElement>('.hud-n')!, ht = hud.querySelector<HTMLElement>('.hud-t')!;
  const label = (id: string) => (document.querySelector(`#rail a[data-ch="${id}"] span`)?.textContent || id).toUpperCase();

  /* sweep line: one thin pass across the screen per chapter change, in the direction you are scrolling */
  const sweepEl = document.createElement('div');
  sweepEl.className = 'sweep'; sweepEl.setAttribute('aria-hidden', 'true');
  document.body.append(sweepEl);
  let dir = 1, lastY = 0;
  lenis.on('scroll', ({ scroll }: { scroll: number }) => { dir = scroll >= lastY ? 1 : -1; lastY = scroll; });

  let current = '';
  const enter = (ch: HTMLElement, idx: number) => {
    if (current === ch.dataset.ch) return;
    current = ch.dataset.ch || '';
    hud.classList.add('on');
    hn.textContent = String(idx + 1).padStart(2, '0');
    const name = label(current);
    if (reduce) ht.textContent = name; else scramble(ht, name);
    if (!reduce) gsap.fromTo(sweepEl, { yPercent: dir > 0 ? 100 : -100, opacity: 0.5 }, { yPercent: dir > 0 ? -100 : 100, opacity: 0, duration: 1.1, ease: 'power2.inOut' });
  };
  chapters.forEach((ch, i) => {
    const st = (window as unknown as { ScrollTrigger?: unknown });
    void st;
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) enter(ch, i); }), { rootMargin: '-45% 0px -45% 0px' });
    io.observe(ch);
  });
  const hero = story.querySelector<HTMLElement>('.chapter[data-ch="hero"]');
  if (hero) new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { current = ''; hud.classList.remove('on'); } }), { rootMargin: '-45% 0px -45% 0px' }).observe(hero);

  if (reduce) return;

  /* skew from scroll speed, tiny */
  const copies = [...story.querySelectorAll<HTMLElement>('.chapter .copy')];
  let sk = 0;
  gsap.ticker.add(() => {
    const target = Math.max(-1.2, Math.min(1.2, (lenis.velocity || 0) / 1400));
    sk += (target - sk) * 0.12;
    if (Math.abs(sk) < 0.002 && Math.abs(target) < 0.002) { if (sk !== 0) { sk = 0; copies.forEach((c) => (c.style.transform = '')); } return; }
    copies.forEach((c) => (c.style.transform = `skewY(${sk.toFixed(3)}deg)`));
  });

  if (!fine) return;

  /* reticle cursor that grows over things you can press */
  const ret = document.createElement('div');
  ret.className = 'reticle'; ret.setAttribute('aria-hidden', 'true');
  document.body.append(ret);
  let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
  addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; ret.classList.add('seen'); }, { passive: true });
  document.addEventListener('pointerleave', () => ret.classList.remove('seen'));
  gsap.ticker.add(() => { rx += (mx - rx) * 0.22; ry += (my - ry) * 0.22; ret.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`; });
  const hot = 'a, button, .chip, [role="button"], input[type="range"], label.cq, summary';
  document.addEventListener('pointerover', (e) => { if ((e.target as Element).closest?.(hot)) ret.classList.add('hot'); });
  document.addEventListener('pointerout', (e) => { if ((e.target as Element).closest?.(hot)) ret.classList.remove('hot'); });

  /* magnetic call-to-action buttons */
  document.querySelectorAll<HTMLElement>('.btn-solid, .cta .btn').forEach((b) => {
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width, dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      gsap.to(b, { x: dx * 8, y: dy * 6, duration: 0.3, ease: 'power3.out' });
    });
    b.addEventListener('pointerleave', () => gsap.to(b, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1,0.5)' }));
  });
}
