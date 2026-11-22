import './styles/base.css';
import './styles/story.css';
import './styles/sheet.css';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { initLang, onLang } from './i18n';
import { mountEvidence } from './ui/evidence';

gsap.registerPlugin(ScrollTrigger, SplitText);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

initLang();

// ---------- smooth scroll, one clock for scroll, GSAP and WebGL ----------
const lenis = new Lenis({ lerp: reduce ? 1 : 0.1, smoothWheel: !reduce, wheelMultiplier: 0.9 });
lenis.on('scroll', ScrollTrigger.update);
if (import.meta.env.DEV) {
  const dev = window as unknown as { __lenis: Lenis; __go: (id: string, t?: number) => void };
  dev.__lenis = lenis;
  dev.__go = (id, t = 0.5) => {
    const r = document.querySelector(id)!.getBoundingClientRect();
    lenis.scrollTo(window.scrollY + r.top + r.height * t - innerHeight / 2, { immediate: true });
  };
}

document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href')!;
    if (id.length < 2) return;
    const target = document.querySelector<HTMLElement>(id);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: id === '#layers' ? -20 : 0, duration: reduce ? 0 : 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
  });
});

// ---------- world (three.js and postprocessing load in their own chunk, so text paints first) ----------
const canvas = document.getElementById('world') as HTMLCanvasElement;
const tagsRoot = document.getElementById('tags') as HTMLElement;
const story = document.getElementById('story') as HTMLElement;
const sheet = document.getElementById('sheet') as HTMLElement;
let world: import('./world').World | null = null;

function measure() {
  if (!world) return;
  const base = window.scrollY;
  const chapters = [...story.querySelectorAll<HTMLElement>('.chapter')].map((c) => {
    const r = c.getBoundingClientRect();
    return { top: r.top + base, height: r.height };
  });
  world.setChapters(chapters);
  const copy = story.querySelector<HTMLElement>('.ch-right .copy');
  const chapter = copy?.closest<HTMLElement>('.chapter');
  if (copy && chapter) world.setLayout(copy.getBoundingClientRect().width, parseFloat(getComputedStyle(chapter).paddingLeft) || 64);
}

gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

import('./world')
  .then(({ World }) => {
    const w = new World(canvas, tagsRoot);
    world = w;
    if (import.meta.env.DEV) (window as unknown as { __world: unknown }).__world = w;
    measure();
    w.resize();
    addEventListener('resize', () => {
      w.resize();
      measure();
      ScrollTrigger.refresh();
    });
    document.fonts?.ready.then(() => {
      measure();
      w.refreshLabels();
    });
    onLang(() => requestAnimationFrame(() => w.refreshLabels()));
    gsap.ticker.add(() => w.frame(lenis.scroll));
    w.onFirstFrame = () => document.body.classList.add('ready');
    new IntersectionObserver(([e]) => w.setActive(e.isIntersecting), { threshold: 0 }).observe(story);
  })
  .catch((err) => {
    console.warn('WebGL unavailable, showing the static page', err);
    canvas.style.display = 'none';
    document.body.classList.add('no-webgl', 'ready');
  });

// the paper sheet takes over: switch the header tone when its top reaches the header (a scroll check, not an
// IntersectionObserver, so jumps and anchor links can never leave the header in the wrong tone)
let sheetTop = 0;
let tone = '';
function setTone(scroll: number) {
  const next = scroll >= sheetTop - 68 ? 'bone' : 'night';
  if (next === tone) return;
  tone = next;
  document.body.dataset.tone = next;
  document.documentElement.style.setProperty('scrollbar-color', next === 'bone' ? '#51463d #ece6da' : '#6b5f54 #0d0b0a');
}
function measureSheet() {
  sheetTop = sheet.getBoundingClientRect().top + window.scrollY;
  setTone(window.scrollY);
}
measureSheet();
addEventListener('resize', measureSheet);
addEventListener('load', measureSheet);
document.fonts?.ready.then(measureSheet);
lenis.on('scroll', ({ scroll }: { scroll: number }) => setTone(scroll));

// ---------- text choreography: one authored motion, lines rise from a mask ----------
function reveal() {
  if (reduce) return;
  document.querySelectorAll<HTMLElement>('.chapter .copy').forEach((copy) => {
    const chapter = copy.closest<HTMLElement>('.chapter')!;
    const head = copy.querySelector<HTMLElement>('h1, h2');
    const rest = [...copy.children].filter((c) => c !== head) as HTMLElement[];
    const tl = gsap.timeline({
      scrollTrigger: { trigger: chapter, start: 'top 55%', end: 'bottom 45%', toggleActions: 'play reverse play reverse' },
      defaults: { ease: 'expo.out' },
    });
    if (head) {
      const split = SplitText.create(head, { type: 'lines', mask: 'lines', autoSplit: true, linesClass: 'ln' });
      tl.from(split.lines, { yPercent: 108, filter: 'blur(8px)', duration: 1.2, stagger: 0.09 }, 0);
    }
    tl.from(rest, { y: 26, opacity: 0, duration: 0.9, stagger: 0.08 }, 0.18);
  });
  // paper sheet sections
  gsap.utils.toArray<HTMLElement>('.sheet h2, .ev-item, .fail, .bench, .cases').forEach((n) => {
    gsap.from(n, { y: 30, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: n, start: 'top 88%', toggleActions: 'play none none none' } });
  });
}

document.fonts?.ready.then(reveal) ?? reveal();

// hero entrance
if (!reduce) {
  gsap.from('.bar', { yPercent: -100, opacity: 0, duration: 1.1, ease: 'expo.out', delay: 0.2 });
}

mountEvidence();
import('./ui/bench').then((m) => m.mountBench()).catch(() => {
  /* workbench module is optional while building */
});

// ---------- chapter rail: the active chapter lights up ----------
const railLinks = [...document.querySelectorAll<HTMLAnchorElement>('#rail a')];
story.querySelectorAll<HTMLElement>('.chapter').forEach((ch) => {
  const link = railLinks.find((a) => a.dataset.ch === ch.dataset.ch);
  if (!link) return;
  ScrollTrigger.create({
    trigger: ch,
    start: 'top 50%',
    end: 'bottom 50%',
    onToggle: (self) => link.classList.toggle('on', self.isActive),
  });
});

// scroll cue disappears once you move
const cue = document.getElementById('cue');
lenis.on('scroll', ({ scroll }: { scroll: number }) => cue?.classList.toggle('gone', scroll > 60));

// curtain: the 3D world dims as the paper sheet rises over it
if (!reduce) {
  gsap.fromTo(
    canvas,
    { opacity: 1 },
    { opacity: 0.12, ease: 'none', immediateRender: false, scrollTrigger: { trigger: sheet, start: 'top bottom', end: 'top 15%', scrub: true } },
  );
}
