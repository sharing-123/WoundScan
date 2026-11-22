import { api, ApiError, type Analysis, type CaseRow, type ModelInfo } from './api';
import { renderTrend } from './trend';
import { t, lang, onLang } from '../i18n';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const SAMPLES = ['dfu_1', 'pressure_1', 'dehisc_1', 'venous_1', 'dfu_2'];

const fmt = (v: number, d = 1) => (lang() === 'id' ? v.toFixed(d).replace('.', ',') : v.toFixed(d));

type Overlay = 'contour' | 'prob' | 'photo';

export function mountBench() {
  const drop = $('drop');
  const fileIn = $<HTMLInputElement>('file');
  const stage = $('stage');
  const img = $<HTMLImageElement>('photo');
  const canvas = $<HTMLCanvasElement>('overlay');
  const hint = $('hint');
  const form = $<HTMLFormElement>('form');
  const modelSel = $<HTMLSelectElement>('model');
  const modelHelp = $('modelHelp');
  const thr = $<HTMLInputElement>('thr');
  const thrOut = $('thrOut');
  const run = $<HTMLButtonElement>('run');
  const err = $('err');
  const out = $('out');
  const metrics = $('metrics');
  const warn = $('warn');
  const calRef = $('calRef');
  const calDist = $('calDist');
  const refmm = $<HTMLInputElement>('refmm');
  const refState = $('refState');
  const dist = $<HTMLInputElement>('dist');
  const hgt = $<HTMLInputElement>('hgt');
  const wgt = $<HTMLInputElement>('wgt');
  const saveForm = $<HTMLFormElement>('saveForm');
  const pcode = $<HTMLInputElement>('pcode');
  const plabel = $<HTMLInputElement>('plabel');
  const okMsg = $('okMsg');
  const caseList = $('caseList');
  const trendHost = $('trend');
  const samplesHost = $('samples');

  let file: File | null = null;
  let analysis: Analysis | null = null;
  let overlay: Overlay = 'contour';
  let pts: { x: number; y: number }[] = [];
  let busy: AbortController | null = null;
  let models: ModelInfo[] = [];
  let probCanvas: HTMLCanvasElement | null = null;
  let activePatient = '';

  const calMode = () => (form.elements.namedItem('cal') as RadioNodeList).value as 'none' | 'ref' | 'dist';

  /* ---------- models ---------- */
  api
    .models()
    .then((ms) => {
      models = ms;
      modelSel.innerHTML = '';
      ms.forEach((m) => {
        const o = document.createElement('option');
        o.value = m.id;
        o.textContent = m.label + (m.installed ? '' : ' (n/a)');
        o.disabled = !m.installed;
        if (m.default) o.selected = true;
        modelSel.append(o);
      });
      showModelHelp();
    })
    .catch(() => showErr(t('try.err.api')));

  function showModelHelp() {
    const m = models.find((x) => x.id === modelSel.value);
    if (!m) return;
    const d = m.metrics.dice;
    modelHelp.textContent = `${m.summary}${typeof d === 'number' ? ` Dice ${fmt(d, 3)}.` : ''}`;
  }
  modelSel.addEventListener('change', showModelHelp);
  thr.addEventListener('input', () => (thrOut.textContent = fmt(Number(thr.value), 2)));

  /* ---------- file in ---------- */
  function setFile(f: File) {
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return showErr(lang() === 'id' ? 'Gunakan JPEG, PNG, atau WebP.' : 'Use JPEG, PNG or WebP.');
    if (f.size > 15 * 1024 * 1024) return showErr(lang() === 'id' ? 'Berkas lebih dari 15 MB.' : 'File is larger than 15 MB.');
    file = f;
    analysis = null;
    pts = [];
    out.hidden = true;
    showErr('');
    img.onload = () => {
      syncOverlay();
      draw();
    };
    if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
    img.src = URL.createObjectURL(f);
    drop.hidden = true;
    stage.hidden = false;
    run.disabled = false;
    updateHint();
  }
  drop.addEventListener('click', () => fileIn.click());
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileIn.click();
    }
  });
  fileIn.addEventListener('change', () => fileIn.files?.[0] && setFile(fileIn.files[0]));
  ['dragenter', 'dragover'].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add('over');
    }),
  );
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('over')));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = (e as DragEvent).dataTransfer?.files?.[0];
    if (f) setFile(f);
  });
  stage.addEventListener('dblclick', () => {
    // swap the photo
    fileIn.click();
  });

  SAMPLES.forEach((name) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', name);
    const i = document.createElement('img');
    i.src = `/samples/${name}.jpg`;
    i.alt = '';
    i.loading = 'lazy';
    b.append(i);
    b.addEventListener('click', async () => {
      const blob = await (await fetch(`/samples/${name}.jpg`)).blob();
      setFile(new File([blob], `${name}.jpg`, { type: 'image/jpeg' }));
    });
    samplesHost.append(b);
  });

  /* ---------- calibration ---------- */
  function updateCalUi() {
    const m = calMode();
    calRef.hidden = m !== 'ref';
    calDist.hidden = m !== 'dist';
    if (m !== 'ref') pts = [];
    updateHint();
    draw();
  }
  form.querySelectorAll('input[name="cal"]').forEach((r) => r.addEventListener('change', updateCalUi));
  $('cardBtn').addEventListener('click', () => (refmm.value = '85.6'));
  function updateHint() {
    const need = calMode() === 'ref' && !stage.hidden && pts.length < 2;
    hint.hidden = !need;
    refState.textContent = pts.length === 2 ? (lang() === 'id' ? 'Dua titik terpasang. Klik lagi untuk mengulang.' : 'Two points set. Click again to redo.') : '';
  }
  canvas.addEventListener('click', (e) => {
    if (calMode() !== 'ref') return;
    const r = canvas.getBoundingClientRect();
    const p = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    if (pts.length >= 2) pts = [];
    pts.push(p);
    updateHint();
    draw();
  });

  /* ---------- overlay canvas ---------- */
  function syncOverlay() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const sr = stage.getBoundingClientRect();
    const ir = img.getBoundingClientRect();
    canvas.style.left = `${ir.left - sr.left}px`;
    canvas.style.top = `${ir.top - sr.top}px`;
    canvas.style.width = `${ir.width}px`;
    canvas.style.height = `${ir.height}px`;
    canvas.width = Math.round(ir.width * dpr);
    canvas.height = Math.round(ir.height * dpr);
  }
  new ResizeObserver(() => {
    if (!stage.hidden) {
      syncOverlay();
      draw();
    }
  }).observe(stage);

  function draw() {
    const g = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;
    g.clearRect(0, 0, W, H);
    const lw = Math.max(2, W / 320);
    if (analysis && overlay === 'contour' && analysis.contours.length) {
      g.lineJoin = 'round';
      for (const poly of analysis.contours) {
        g.beginPath();
        poly.forEach(([x, y], i) => (i ? g.lineTo(x * W, y * H) : g.moveTo(x * W, y * H)));
        g.closePath();
        g.fillStyle = 'rgba(242,182,50,0.22)';
        g.fill();
        g.strokeStyle = '#15110e';
        g.lineWidth = lw * 2.2;
        g.stroke();
        g.strokeStyle = '#f2b632';
        g.lineWidth = lw;
        g.stroke();
      }
    }
    if (analysis && overlay === 'prob' && probCanvas) g.drawImage(probCanvas, 0, 0, W, H);
    if (pts.length) {
      g.strokeStyle = '#f2b632';
      g.fillStyle = '#15110e';
      g.lineWidth = lw;
      if (pts.length === 2) {
        g.beginPath();
        g.moveTo(pts[0].x * W, pts[0].y * H);
        g.lineTo(pts[1].x * W, pts[1].y * H);
        g.stroke();
      }
      pts.forEach((p) => {
        g.beginPath();
        g.arc(p.x * W, p.y * H, lw * 2.6, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      });
    }
  }

  async function buildProbCanvas(src: string, w: number, h: number) {
    const im = new Image();
    im.src = src;
    await im.decode();
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    g.drawImage(im, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h);
    for (let i = 0; i < d.data.length; i += 4) {
      const p = d.data[i] / 255;
      const a = Math.max(0, (p - 0.08) / 0.92);
      d.data[i] = 255;
      d.data[i + 1] = Math.round(120 + 100 * p);
      d.data[i + 2] = Math.round(40 + 130 * p * p);
      d.data[i + 3] = Math.round(a * 200);
    }
    g.putImageData(d, 0, 0);
    return c;
  }

  /* ---------- run ---------- */
  function showErr(msg: string) {
    err.hidden = !msg;
    err.textContent = msg;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!file) return;
    showErr('');
    const mode = calMode();
    const fd = new FormData();
    fd.set('image', file);
    fd.set('model', modelSel.value);
    fd.set('threshold', thr.value);
    if (mode === 'ref') {
      if (pts.length < 2) return showErr(t('try.click2'));
      fd.set('ref_mm', refmm.value);
      fd.set('ref_x1', String(pts[0].x));
      fd.set('ref_y1', String(pts[0].y));
      fd.set('ref_x2', String(pts[1].x));
      fd.set('ref_y2', String(pts[1].y));
    } else if (mode === 'dist') {
      fd.set('distance_cm', dist.value);
    }
    if (hgt.value && wgt.value) {
      fd.set('height_cm', hgt.value);
      fd.set('weight_kg', wgt.value);
    }
    busy?.abort();
    busy = new AbortController();
    run.disabled = true;
    run.textContent = t('try.running');
    try {
      analysis = await api.analyze(fd, busy.signal);
      probCanvas = analysis.probability_png ? await buildProbCanvas(analysis.probability_png, analysis.width, analysis.height) : null;
      overlay = 'contour';
      setOverlayButtons();
      renderResult();
      draw();
      out.hidden = false;
      out.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    } catch (ex) {
      if ((ex as Error).name === 'AbortError') return;
      showErr(ex instanceof ApiError ? (ex.status === 0 ? t('try.err.api') : ex.message) : String(ex));
    } finally {
      run.disabled = false;
      run.textContent = t('try.run');
      busy = null;
    }
  });

  function renderResult() {
    const a = analysis;
    if (!a) return;
    const rows: [string, string][] = [];
    if (a.empty) {
      rows.push([t('try.area'), '—']);
    } else if (a.calibrated && a.area_cm2 !== undefined) {
      rows.push([t('try.area'), `${fmt(a.area_cm2, a.area_cm2 < 10 ? 2 : 1)}<small>cm²</small>`]);
      rows.push([t('try.perim'), `${fmt((a.perimeter_mm ?? 0) / 10, 1)}<small>cm</small>`]);
      rows.push([t('try.length'), `${fmt((a.length_mm ?? 0) / 10, 1)}<small>cm</small>`]);
      rows.push([t('try.width'), `${fmt((a.width_mm ?? 0) / 10, 1)}<small>cm</small>`]);
      if (a.tbsa_percent != null) rows.push([t('try.tbsa'), `${fmt(a.tbsa_percent, 2)}<small>%</small>`]);
    } else {
      rows.push([t('try.area'), `${fmt(a.image_fraction * 100, 1)}<small>% ${lang() === 'id' ? 'dari foto' : 'of frame'}</small>`]);
      rows.push([t('try.perim'), t('try.uncal')]);
    }
    if (a.mean_probability !== undefined) rows.push([t('try.conf'), `${fmt(a.mean_probability * 100, 0)}<small>%</small>`]);
    rows.push([t('try.time'), `${Math.round(a.inference_ms)}<small>ms</small>`]);
    metrics.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    warn.innerHTML = '';
    a.warnings.forEach((w) => {
      const li = document.createElement('li');
      li.textContent = w;
      warn.append(li);
    });
  }
  onLang(() => {
    if (analysis) renderResult();
    updateHint();
    showModelHelp();
  });

  function setOverlayButtons() {
    out.querySelectorAll<HTMLButtonElement>('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ov === overlay)));
  }
  out.querySelectorAll<HTMLButtonElement>('.seg button').forEach((b) =>
    b.addEventListener('click', () => {
      overlay = b.dataset.ov as Overlay;
      setOverlayButtons();
      draw();
    }),
  );

  /* ---------- cases ---------- */
  async function refreshCases() {
    let rows: CaseRow[] = [];
    try {
      rows = await api.cases(activePatient || undefined);
    } catch {
      return;
    }
    caseList.innerHTML = '';
    if (!rows.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = t('try.empty');
      caseList.append(li);
    }
    rows.forEach((c) => {
      const li = document.createElement('li');
      const thumb = c.has_thumb ? Object.assign(document.createElement('img'), { src: `/api/cases/${c.id}/thumb`, alt: '', loading: 'lazy' }) : Object.assign(document.createElement('div'), { className: 'ph' });
      const mid = document.createElement('div');
      const title = document.createElement('div');
      title.className = 't';
      title.textContent = `${c.patient_code}${c.label ? ` · ${c.label}` : ''}`;
      const meta = document.createElement('div');
      meta.className = 'm';
      const area = c.calibrated && c.area_cm2 != null ? `${fmt(c.area_cm2, 1)} cm²` : t('try.uncal');
      meta.textContent = `${area} · ${c.captured_at.slice(0, 10)}`;
      mid.append(title, meta);
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = t('try.delete');
      del.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        await api.remove(c.id);
        refreshCases();
      });
      li.append(thumb, mid, del);
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => {
        activePatient = c.patient_code;
        showTrend(c.patient_code);
      });
      caseList.append(li);
    });
    if (activePatient) showTrend(activePatient);
    else if (rows[0]) showTrend(rows[0].patient_code);
    else renderTrend(trendHost, null);
  }
  async function showTrend(code: string) {
    try {
      renderTrend(trendHost, await api.trend(code));
    } catch {
      renderTrend(trendHost, null);
    }
  }

  saveForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!analysis || !file) return;
    const fd = new FormData();
    fd.set('patient_code', pcode.value.trim());
    fd.set('label', plabel.value);
    fd.set('captured_at', new Date().toISOString());
    const slim = { ...analysis };
    delete slim.mask_png;
    delete slim.probability_png;
    fd.set('analysis_json', JSON.stringify(slim));
    fd.set('image', file);
    try {
      await api.saveCase(fd);
      okMsg.hidden = false;
      okMsg.textContent = t('try.saved');
      setTimeout(() => (okMsg.hidden = true), 2600);
      activePatient = pcode.value.trim();
      refreshCases();
    } catch (ex) {
      showErr(ex instanceof ApiError ? ex.message : String(ex));
    }
  });
  onLang(() => refreshCases());
  refreshCases();
}
