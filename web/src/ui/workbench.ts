/* The automatic workbench: one photo in, a full case out. Nothing here asks the clinician to type a finding. */
import { api, ApiError, type Analysis, type CaseRow } from './api';
import { renderTrend } from './trend';
import { lang, onLang } from '../i18n';
import { TYPES, REGIONS, pick, dec, type TypeId, type RegionId } from '../clinic/kb';
import { buildCase, type Case, type Overrides } from '../clinic/engine';
import { makeStage, type Stage } from '../plan/raster';
import { TECH_NAME, type Tech } from '../plan/planner';
import { buildGeo, polyLen } from '../plan/geom';
import { paintAnnotated, paintMarking, paintResult, makeCanvas, tween, exportPlate, defaultAnno } from '../plan/plate';
import type { AnnoOpts } from '../plan/draw';
import { mountViewer, type Viewer } from '../plan/viewer3d';
import { donorMap } from './donormap';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const T = (en: string, id: string) => (lang() === 'id' ? id : en);
const num = (v: number, d = 1) => (lang() === 'id' ? v.toFixed(d).replace('.', ',') : v.toFixed(d));
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
const SAMPLES = ['dfu_1', 'pressure_1', 'dehisc_1', 'venous_1', 'dfu_2'];
const TECHS: Tech[] = ['linear', 'fusiform', 'adv', 'vy', 'z', 'stsg', 'ftsg', 'debridemen', 'sekunder', 'flapbesar'];
const TISSUE_COL: Record<string, string> = { granulation: '#d8574b', slough: '#e7cf6b', necrosis: '#2a2420', epithelium: '#f1c9bf' };

type Tab = 'annot' | 'plan' | 'three' | 'recs';

export function mountWorkbench() {
  const root = $('wb');
  root.innerHTML = `
    <div class="wb-start" id="wbStart">
      <div class="dropzone" id="drop" tabindex="0" role="button">
        <input type="file" id="file" accept="image/jpeg,image/png,image/webp" hidden />
        <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M12 16V5m-4 4 4-4 4 4M5 19h14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
        <span class="dz-t" data-k="drop"></span>
        <span class="dz-s" data-k="dropsub"></span>
      </div>
      <div class="wb-side">
        <div class="samples"><span data-k="samples"></span><div class="sample-row" id="samples"></div></div>
        <details class="wb-opt"><summary data-k="optional"></summary>
          <div class="field two"><div><label for="hgt" data-k="height"></label><input type="number" id="hgt" min="30" max="250" inputmode="decimal" /></div>
          <div><label for="wgt" data-k="weight"></label><input type="number" id="wgt" min="2" max="300" inputmode="decimal" /></div></div>
          <p class="help" data-k="optionalHelp"></p>
        </details>
      </div>
    </div>
    <div class="wb-run" id="wbRun" hidden>
      <figure class="scan"><img id="scanImg" alt="" /><i class="scanline"></i><figcaption id="scanCap"></figcaption></figure>
      <ol class="scan-steps" id="scanSteps"></ol>
    </div>
    <div class="wb-res" id="wbRes" hidden></div>
    <p class="err" id="err" role="alert" hidden></p>`;

  const drop = $('drop'), fileIn = $<HTMLInputElement>('file'), start = $('wbStart'), run = $('wbRun'), res = $('wbRes'), err = $('err');
  const scanImg = $<HTMLImageElement>('scanImg'), scanCap = $('scanCap'), scanSteps = $('scanSteps');
  const hgt = $<HTMLInputElement>('hgt'), wgt = $<HTMLInputElement>('wgt');
  const caseList = $('caseList'), trendHost = $('trend'), samplesHost = $('samples');

  const S: Record<string, [string, string]> = {
    drop: ['Drop a wound photo here, or choose a file', 'Letakkan foto luka di sini, atau pilih berkas'],
    dropsub: ['One photo is enough. Everything below is filled in for you.', 'Satu foto sudah cukup. Semua isian di bawah terisi otomatis.'],
    samples: ['Or try a sample photo', 'Atau coba foto contoh'],
    optional: ['Optional: height and weight (for body-surface percentage and donor area)', 'Opsional: tinggi dan berat badan (untuk persen luas tubuh dan luas donor)'],
    height: ['Height (cm)', 'Tinggi (cm)'], weight: ['Weight (kg)', 'Berat (kg)'],
    optionalHelp: ['Leave blank if unknown. A photo that includes a ruler or an ID-1 card beside the wound gives a true scale.', 'Kosongkan bila tidak tahu. Foto dengan penggaris atau kartu ID-1 di samping luka memberi skala sebenarnya.'],
  };
  const fillStatic = () => root.querySelectorAll<HTMLElement>('[data-k]').forEach((e) => (e.textContent = T(...S[e.dataset.k as string])));
  fillStatic();

  let file: File | null = null, a: Analysis | null = null, st: Stage | null = null, cs: Case | null = null;
  let ov: Overrides = {};
  let tab: Tab = 'annot';
  let stage: 'now' | 'later' = 'now';
  let edited = false;
  let editing = false;
  const view = (): Case => (cs && stage === 'later' && cs.later ? ({ ...cs, ...cs.later } as Case) : (cs as Case));
  let anno: AnnoOpts | null = null;
  let viewer: Viewer | null = null;
  let activePatient = '';
  let ctl: AbortController | null = null;
  let runToken = 0;

  const showErr = (m: string) => { err.hidden = !m; err.textContent = m; };

  /* ---------- samples ---------- */
  SAMPLES.forEach((id) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('aria-label', id);
    const im = document.createElement('img'); im.src = `/samples/${id}.jpg`; im.alt = ''; im.loading = 'lazy';
    b.append(im);
    b.addEventListener('click', async () => {
      try { const r = await fetch(`/samples/${id}.jpg`); const bl = await r.blob(); analyse(new File([bl], `${id}.jpg`, { type: 'image/jpeg' })); } catch { showErr(T('Could not load the sample.', 'Gagal memuat contoh.')); }
    });
    samplesHost.append(b);
  });
  drop.addEventListener('click', () => fileIn.click());
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } });
  fileIn.addEventListener('change', () => { const f = fileIn.files?.[0]; if (f) analyse(f); });
  ['dragenter', 'dragover'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => { const f = (e as DragEvent).dataTransfer?.files?.[0]; if (f) analyse(f); });

  /* ---------- the run ---------- */
  const STEP_TXT: [string, string][] = [
    ['Finding the wound edge', 'Mencari tepi luka'], ['Measuring and setting the scale', 'Mengukur dan menetapkan skala'], ['Reading the wound bed', 'Membaca dasar luka'],
    ['Naming the wound type', 'Menentukan jenis luka'], ['Choosing closure, graft or flap', 'Memilih tutup primer, graft, atau flap'], ['Drawing the plan', 'Menggambar rencana'],
  ];

  async function analyse(f: File) {
    ctl?.abort(); viewer?.destroy(); viewer = null;
    file = f; ov = {}; a = null; st = null; cs = null; stage = 'now'; edited = false; editing = false; orig = null; showErr('');
    const my = ++runToken;
    start.hidden = true; res.hidden = true; run.hidden = false;
    scanImg.src = URL.createObjectURL(f);
    scanSteps.innerHTML = STEP_TXT.map((s, i) => `<li data-i="${i}"><span class="dot"></span><span>${esc(T(...s))}</span></li>`).join('');
    run.scrollIntoView({ behavior: 'smooth', block: 'center' });
    let n = 0;
    const tick = setInterval(() => {
      const items = scanSteps.querySelectorAll('li');
      items.forEach((li, i) => li.classList.toggle('on', i <= n));
      scanCap.textContent = T(...STEP_TXT[Math.min(n, STEP_TXT.length - 1)]);
      if (n < 2) n++; else if (Math.random() > 0.55 && n < STEP_TXT.length - 2) n++;
    }, 650);
    const fd = new FormData();
    fd.set('image', f);
    if (hgt.value && wgt.value) { fd.set('height_cm', hgt.value); fd.set('weight_kg', wgt.value); ov.heightCm = Number(hgt.value); ov.weightKg = Number(wgt.value); }
    ctl = new AbortController();
    try {
      const r = await api.auto(fd, ctl.signal);
      if (my !== runToken) return;
      if (r.empty || !r.mask_png) { clearInterval(tick); back(); showErr(T('No wound could be found in this photo. Try a closer, evenly lit picture.', 'Luka tidak ditemukan pada foto ini. Coba foto lebih dekat dengan cahaya merata.')); return; }
      a = r;
      st = await makeStage(f, r.mask_png, r.tissue_png || null, r.width, r.scale.mm_per_pixel);
      if (!st.geo) { clearInterval(tick); back(); showErr(T('The wound outline was too small to measure.', 'Garis luka terlalu kecil untuk diukur.')); return; }
      scanSteps.querySelectorAll('li').forEach((li) => li.classList.add('on'));
      clearInterval(tick);
      await new Promise((r2) => setTimeout(r2, 380));
      if (my !== runToken) return;
      rebuild(true);
      run.hidden = true; res.hidden = false;
      res.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (ex) {
      clearInterval(tick);
      if ((ex as Error).name === 'AbortError') return;
      back();
      showErr(ex instanceof ApiError && ex.status === 0 ? T('The local server is not answering. Run server/run.py.', 'Server lokal tidak menjawab. Jalankan server/run.py.') : ex instanceof ApiError ? ex.message : String(ex));
    }
  }
  function back() { run.hidden = true; start.hidden = false; }

  function rebuild(first = false) {
    if (!a || !st) return;
    cs = buildCase(a, st.mask, st.W, st.H, ov);
    if (!cs) return;
    anno = anno || defaultAnno(cs, a.scale.source === 'assumed_distance');
    anno.approxScale = a.scale.source === 'assumed_distance';
    viewer?.destroy(); viewer = null;
    render(first);
  }

  /* ---------- result ---------- */
  const settingCls = { ed: 'bad', clinic: 'ok', refer: 'mid' } as const;

  function typeName(id: TypeId) { return pick(TYPES[id].name); }

  function headerHtml(c: Case) {
    const A = a as Analysis;
    const conf = Math.round(c.typeConfidence * 100);
    const acc = A.type?.accuracy != null ? Math.round(A.type.accuracy * 100) : null;
    const alt = (['diabetic', 'pressure', 'venous', 'surgical', 'trauma', 'other'] as TypeId[]).map((id) => {
      const p = A.type?.probs?.[id] ?? 0;
      return `<button type="button" class="chip ${id === c.type ? 'on' : ''}" data-type="${id}">${esc(typeName(id))}<small>${Math.round(p * 100)}%</small></button>`;
    }).join('');
    const reg = (Object.keys(REGIONS) as RegionId[]).map((id) => `<button type="button" class="chip ${id === c.region ? 'on' : ''}" data-region="${id}">${esc(pick(REGIONS[id].name))}</button>`).join('');
    return `
      <header class="res-head">
        <div class="rh-main">
          <p class="eyebrow">${T('Wound type read from the photo', 'Jenis luka terbaca dari foto')}${c.typeAuto ? '' : ` · ${T('set by you', 'dipilih Anda')}`}</p>
          <h3>${esc(typeName(c.type))}</h3>
          <p class="rh-sub">${!A.type ? T('No wound-type model is installed on this machine, so choose the type below. Everything else still runs.', 'Model jenis luka tidak terpasang di komputer ini, jadi pilih jenis di bawah. Bagian lain tetap berjalan.') : ''}${A.type && c.typeAuto ? T(`The model leans this way at ${conf}%. `, `Model condong ke arah ini sebesar ${conf}%. `) : ''}${A.type && acc != null ? T(`On held-out photos it names the right type about ${acc}% of the time across six types, so treat it as a first guess and change it below if you know better.`, `Pada foto uji ia menebak jenis yang tepat sekitar ${acc}% dari enam jenis, jadi anggap ini tebakan awal dan ubah di bawah bila Anda lebih tahu.`) : ''}</p>
          <div class="chips" role="group" aria-label="${T('Wound type', 'Jenis luka')}">${alt}</div>
          <details class="rh-reg"><summary>${T('Site', 'Lokasi')}: ${esc(pick(REGIONS[c.region].name))}${c.regionAuto ? T(' (typical for this type, change if different)', ' (umum untuk jenis ini, ubah bila berbeda)') : ''}</summary><div class="chips">${reg}</div></details>
        </div>
        <div class="rh-flags">
          <div class="flag ${settingCls[c.setting.level]}"><span class="fl-k">${T('Where to treat', 'Ditangani di')}</span><strong>${esc(pick(c.setting.label))}</strong><ul>${c.setting.why.map((w) => `<li>${esc(pick(w))}</li>`).join('')}</ul></div>
          <div class="flag ${c.malignancy.flagged ? 'bad' : 'plain'}"><span class="fl-k">${T('Malignancy screen', 'Skrining keganasan')}</span>
            <strong>${c.malignancy.flagged ? T('Needs a biopsy', 'Perlu biopsi') : T('Nothing suspicious in the picture', 'Tidak ada yang mencurigakan pada gambar')}</strong>
            <ul>${(c.malignancy.flagged ? c.malignancy.reasons.map((r) => pick(r)) : []).concat([T('A photo cannot rule cancer out. Biopsy a wound that has not improved in 4 to 6 weeks, or has rolled raised edges, friable bleeding tissue or a growth.', 'Foto tidak dapat menyingkirkan kanker. Biopsi luka yang tidak membaik dalam 4 sampai 6 minggu, atau bertepi menggulung dan menonjol, jaringan rapuh mudah berdarah, atau tumbuh massa.')]).map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>
        </div>
      </header>`;
  }

  function measureHtml(c: Case) {
    const A = a as Analysis, g = c.geo, cm = g.cmPerPx;
    const sh = g.shape, L1 = sh.rectLong * cm, W1 = sh.rectShort * cm;
    const per = polyLen(g.poly) * cm;
    const tb = c.tissue;
    const dm: Record<string, [string, string]> = {
      full_devitalised: ['Looks full thickness with mostly dead tissue', 'Tampak ketebalan penuh dengan jaringan mati dominan'],
      full_granulating: ['Looks full thickness with a granulating bed', 'Tampak ketebalan penuh dengan dasar granulasi'],
      partial: ['Looks partial thickness', 'Tampak ketebalan parsial'],
      indeterminate: ['Depth cannot be judged from the colour', 'Kedalaman tidak dapat dinilai dari warna'],
    };
    const sg = A.signs as Record<string, number | boolean | null>;
    const signs: string[] = [];
    if (typeof sg.erythema_extent_cm === 'number' && sg.erythema_extent_cm > 0.3) signs.push(T(`Redness spreads about ${num(sg.erythema_extent_cm)} cm beyond the edge`, `Kemerahan meluas sekitar ${num(sg.erythema_extent_cm)} cm dari tepi`));
    if (sg.maceration) signs.push(T('White, soggy skin at the edge (maceration)', 'Kulit putih basah di tepi (maserasi)'));
    if (sg.possible_purulent) signs.push(T('Yellow-green material that may be pus', 'Material kuning kehijauan yang mungkin nanah'));
    if (!signs.length) signs.push(T('No clear redness, maceration or pus seen', 'Tidak tampak kemerahan, maserasi, atau nanah yang jelas'));
    const bar = (['granulation', 'slough', 'necrosis', 'epithelium'] as const).map((k) => `<i style="flex:${Math.max(0.4, tb[k])};background:${TISSUE_COL[k]}" title="${k}"></i>`).join('');
    const leg = ([['granulation', 'Granulation', 'Granulasi'], ['slough', 'Slough', 'Slough'], ['necrosis', 'Necrosis', 'Nekrosis'], ['epithelium', 'Epithelium', 'Epitel']] as const).map(([k, e, i]) => `<span><b style="background:${TISSUE_COL[k]}"></b>${T(e, i)} ${Math.round(tb[k])}%</span>`).join('');
    const sc = A.scale;
    return `
      <div class="mgrid">
        <div class="m big"><span>${T('Length', 'Panjang')}</span><b>${num(L1, 1)}<small>cm</small></b></div>
        <div class="m big"><span>${T('Width', 'Lebar')}</span><b>${num(W1, 1)}<small>cm</small></b></div>
        <div class="m"><span>${T('Area', 'Luas')}</span><b>${num(c.areaCm2, c.areaCm2 < 10 ? 2 : 1)}<small>cm²</small></b></div>
        <div class="m"><span>${T('Perimeter', 'Keliling')}</span><b>${num(per, 1)}<small>cm</small></b></div>
        ${c.tbsaPct != null ? `<div class="m"><span>${T('Body surface', 'Luas tubuh')}</span><b>${num(c.tbsaPct, 2)}<small>%</small></b></div>` : ''}
        <div class="m"><span>${T('Depth', 'Kedalaman')}</span><b class="txt">${esc(T(...dm[c.depthClass] || dm.indeterminate))}</b></div>
      </div>
      ${edited ? `<p class="mnote">${T('Outline corrected by you. The tissue colours still follow the original outline.', 'Garis tepi dikoreksi oleh Anda. Warna jaringan masih mengikuti garis semula.')}</p>` : ''}
      <p class="mnote">${T('Depth in centimetres cannot be measured from a flat photo. The category above comes from the colour of the bed.', 'Kedalaman dalam sentimeter tidak dapat diukur dari foto datar. Kategori di atas berasal dari warna dasar luka.')}</p>
      <div class="tissue"><div class="tbar">${bar}</div><div class="tleg">${leg}</div></div>
      <ul class="signs">${signs.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      <div class="scalebox ${sc.source === 'assumed_distance' ? 'warn' : ''}">
        <p><strong>${T('Scale', 'Skala')}</strong> ${esc(pick(c.scaleNote))} ${sc.source === 'assumed_distance' ? T(`Lengths may be off by about ${sc.uncertainty_percent}%.`, `Panjang bisa meleset sekitar ${sc.uncertainty_percent}%.`) : ''}</p>
        <form id="scaleForm" class="inline"><label for="knownLen">${T('Know the real length of the longest side? Enter it (cm)', 'Tahu panjang sebenarnya sisi terpanjang? Masukkan (cm)')}</label>
          <div class="inline"><input id="knownLen" type="number" min="0.2" step="0.1" inputmode="decimal" /><button class="chip" type="submit">${T('Apply', 'Terapkan')}</button></div></form>
      </div>`;
  }

  function planNums(c: Case) {
    return c.plan.nums.map((n) => `<div class="m ${n.warn ? 'warn' : ''}"><span>${esc(pick(n.k))}</span><b class="txt">${esc(typeof n.v === 'string' ? dec(n.v) : pick(n.v))}${n.u ? `<small>${esc(typeof n.u === 'string' ? dec(n.u) : pick(n.u))}</small>` : ''}</b></div>`).join('');
  }

  function donorHtml(c: Case) {
    const d = c.donors as unknown as { id: string; label: { en: string; id: string }; note: { en: string; id: string }; avail?: number; fits?: boolean; stripW?: number; stripL?: number; reasons: { en: string; id: string }[] }[] | null;
    let out = '';
    if (d?.length) {
      out += `<h4>${c.plan.tech === 'stsg' ? T('Donor site ranking (split thickness)', 'Peringkat area donor (tebal-terbelah)') : T('Donor site ranking (full thickness)', 'Peringkat area donor (tebal-penuh)')}</h4><ol class="donors">${d.slice(0, 4).map((x, i) => `<li class="${i === 0 ? 'top' : ''}"><b>${esc(pick(x.label))}</b><span>${esc(pick(x.note))}</span>${x.stripW ? `<em>${T('strip', 'strip')} ${num(x.stripW, 0)} × ${num(x.stripL || 0, 0)} cm</em>` : ''}${x.reasons.map((r) => `<small>${esc(pick(r))}</small>`).join('')}</li>`).join('')}</ol>`;
      out += `<div class="dmap">${donorMap(d[0]?.id || '', T('front', 'depan'), T('back', 'belakang'))}</div>`;
    }
    const lad = c.decision.ladder;
    if (lad?.length) out += `<h4>${T('Flap ladder for this site', 'Tangga flap untuk lokasi ini')}</h4><ol class="donors">${lad.slice(0, 4).map((x, i) => `<li class="${i === 0 ? 'top' : ''}"><b>${esc(pick(x.label))}</b><span>${esc(pick(x.note))}</span>${x.reasons.map((r) => `<small>${esc(pick(r))}</small>`).join('')}</li>`).join('')}</ol>`;
    return out;
  }

  function render(first = false) {
    if (!cs || !a || !st) return;
    const c = cs;
    if (!c.later) stage = 'now';
    const P = view();
    const modeTxt = P.decision.mode === 'graft' ? T('Skin graft', 'Cangkok kulit') : P.decision.mode === 'flap' ? T('Flap', 'Flap') : T('Debride first', 'Debridemen dulu');
    const techChips = TECHS.map((t) => `<button type="button" class="chip ${t === P.plan.tech ? 'on' : ''}" data-tech="${t}">${esc(pick(TECH_NAME[t]))}</button>`).join('');
    res.innerHTML = `
      <div class="res-top"><button type="button" class="chip" id="again">${T('New photo', 'Foto baru')}</button></div>
      ${headerHtml(c)}
      <div class="tabs" role="tablist">
        ${(['annot', 'plan', 'three', 'recs'] as Tab[]).map((k) => `<button role="tab" type="button" class="tab ${tab === k ? 'on' : ''}" data-tab="${k}" aria-selected="${tab === k}">${{ annot: T('Annotation', 'Anotasi'), plan: T('Surgical plan', 'Rencana operasi'), three: T('3D surgery', 'Operasi 3D'), recs: T('Recommendations', 'Rekomendasi') }[k]}</button>`).join('')}
      </div>
      <section class="pane" data-pane="annot" ${tab === 'annot' ? '' : 'hidden'}>
        <div class="annot-grid">
          <div class="annot-view"><canvas id="cvA"></canvas>
            <div class="seg tg" role="group">
              ${([['tissue', T('Tissue', 'Jaringan')], ['contour', T('Outline', 'Kontur')], ['dims', T('Measurements', 'Ukuran')], ['feret', T('Longest axis', 'Sumbu terpanjang')], ['margin', T('2 mm margin', 'Margin 2 mm')]] as const).map(([k, l]) => `<button type="button" data-tg="${k}" aria-pressed="${k === 'margin' ? !!anno?.margin : (anno as unknown as Record<string, boolean>)[k]}">${l}</button>`).join('')}
              <button type="button" data-tg="replay">${T('Replay', 'Putar ulang')}</button>
              <button type="button" data-tg="edit" aria-pressed="${editing}">${T('Fix the outline', 'Perbaiki garis tepi')}</button>
            </div>
            <div class="edit-bar" id="editBar" ${editing ? '' : 'hidden'}>
              <p>${T('Paint over wound the model missed, or erase what it got wrong. Then press Done: every number and plan updates.', 'Warnai bagian luka yang terlewat, atau hapus yang keliru. Lalu tekan Selesai: semua angka dan rencana ikut diperbarui.')}</p>
              <div class="seg" role="group"><button type="button" data-etool="add" aria-pressed="true">${T('Add', 'Tambah')}</button><button type="button" data-etool="erase" aria-pressed="false">${T('Erase', 'Hapus')}</button></div>
              <label class="eb-size">${T('Brush', 'Kuas')}<input type="range" id="ebSize" min="6" max="90" value="28" /></label>
              <button type="button" class="chip" id="ebReset">${T('Reset', 'Reset')}</button>
              <button type="button" class="chip on" id="ebDone">${T('Done', 'Selesai')}</button>
            </div>
          </div>
          <div class="annot-nums">${measureHtml(c)}</div>
        </div>
      </section>
      <section class="pane" data-pane="plan" ${tab === 'plan' ? '' : 'hidden'}>
        ${c.later ? `<div class="seg stg" role="group"><button type="button" data-stage="now" aria-pressed="${stage === 'now'}">${T('Now: debridement', 'Sekarang: debridemen')}</button><button type="button" data-stage="later" aria-pressed="${stage === 'later'}">${T('Once the bed is clean: ', 'Setelah dasar bersih: ')}${esc(pick(c.later.plan.title))}</button></div>` : ''}
        <div class="decision"><span class="dc-k">${stage === 'later' ? T('Decision for the second stage', 'Keputusan tahap kedua') : T('Decision', 'Keputusan')}</span><strong>${esc(modeTxt)}: ${esc(pick(P.plan.title))}</strong>
          <ul>${P.autoWhy.map((w) => `<li>${esc(pick(w))}</li>`).join('')}</ul>
          <details class="alt"><summary>${T('Prefer another technique?', 'Ingin teknik lain?')}</summary><div class="chips">${techChips}</div></details></div>
        <div class="plate">
          <figure><canvas id="cvB1"></canvas></figure>
          <figure><canvas id="cvB2"></canvas></figure>
          <figure><canvas id="cvB3"></canvas></figure>
        </div>
        <div class="plan-cols">
          <div><h4>${T('Numbers', 'Angka')}</h4><div class="mgrid sm">${planNums(P)}</div></div>
          <div><h4>${T('Steps', 'Langkah')}</h4><ol class="steps">${P.plan.steps.map((s) => `<li>${esc(pick(s))}</li>`).join('')}</ol>
            ${P.plan.notes.length ? `<h4>${T('Why this way', 'Alasannya')}</h4><ul class="notes">${P.plan.notes.map((s) => `<li>${esc(pick(s))}</li>`).join('')}</ul>` : ''}</div>
        </div>
        ${donorHtml(P)}
        <div class="plan-act"><button type="button" class="btn btn-ink btn-sm" id="dlPlate">${T('Download the plate (PNG)', 'Unduh lembar rencana (PNG)')}</button><p class="fine">${T('Illustrative plan for discussion with the surgeon. Not an operative order.', 'Rencana ilustratif untuk diskusi dengan operator. Bukan perintah operasi.')}</p></div>
      </section>
      <section class="pane" data-pane="three" ${tab === 'three' ? '' : 'hidden'}><div class="v3" id="v3host"></div>
        <p class="fine">${T('Built from your photo: the skin, the wound dent and every piece of the plan come from this picture. The depth of the dent is illustrative.', 'Dibangun dari foto Anda: kulit, cekungan luka, dan setiap bagian rencana berasal dari gambar ini. Kedalaman cekungan bersifat ilustratif.')}</p></section>
      <section class="pane" data-pane="recs" ${tab === 'recs' ? '' : 'hidden'}>
        <div class="recs">${c.sections.map((sx, i) => `<details class="rec ${sx.tone || ''}" ${i < 2 || sx.tone === 'alert' ? 'open' : ''}><summary>${esc(pick(sx.title))}</summary><ul>${sx.items.map((it) => `<li>${esc(pick(it))}</li>`).join('')}</ul></details>`).join('')}</div>
        <p class="fine">${T('Source basis: ', 'Dasar: ')}${esc(TYPES[c.type].source)}</p>
      </section>
      <form class="save" id="saveForm">
        <div class="field two"><div><label for="pcode">${T('Patient code (pseudonym)', 'Kode pasien (pseudonim)')}</label><input id="pcode" maxlength="40" value="P-001" /></div>
        <div><label for="plabel">${T('Site / short note', 'Lokasi / catatan singkat')}</label><input id="plabel" maxlength="80" /></div></div>
        <button class="btn btn-ink btn-block" type="submit">${T('Save as a case', 'Simpan sebagai kasus')}</button><p class="ok" id="okMsg" role="status" hidden></p>
      </form>`;
    wire(first);
  }

  async function paintAll(first: boolean) {
    if (!cs || !st || !anno) return;
    const A = $<HTMLCanvasElement>('cvA');
    const { c, ctx } = makeCanvas(st);
    A.width = c.width; A.height = c.height;
    const ax = A.getContext('2d')!; ax.scale(c.width / st.W, c.height / st.H);
    if (first || !A.dataset.done) {
      A.dataset.done = '1';
      await tween(1700, (p) => paintAnnotated(ax, st as Stage, anno as AnnoOpts, p));
    } else paintAnnotated(ax, st, anno, 1);
    void ctx;
  }

  function wire(first: boolean) {
    if (!cs || !a || !st) return;
    const c = cs;
    $('again').onclick = () => { viewer?.destroy(); viewer = null; res.hidden = true; start.hidden = false; anno = null; ctl?.abort(); window.scrollTo({ top: root.getBoundingClientRect().top + scrollY - 90, behavior: 'smooth' }); };
    res.querySelectorAll<HTMLButtonElement>('[data-type]').forEach((b) => (b.onclick = () => { ov.type = b.dataset.type as TypeId; delete ov.region; rebuild(); }));
    res.querySelectorAll<HTMLButtonElement>('[data-region]').forEach((b) => (b.onclick = () => { ov.region = b.dataset.region as RegionId; rebuild(); }));
    res.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach((b) => (b.onclick = () => { stage = b.dataset.stage as 'now' | 'later'; viewer?.destroy(); viewer = null; render(false); }));
    res.querySelectorAll<HTMLButtonElement>('[data-tech]').forEach((b) => (b.onclick = () => { ov.tech = b.dataset.tech as Tech; rebuild(); }));
    res.querySelectorAll<HTMLButtonElement>('.tab').forEach((b) => (b.onclick = () => setTab(b.dataset.tab as Tab)));
    res.querySelectorAll<HTMLButtonElement>('[data-tg]').forEach((b) => (b.onclick = () => {
      const k = b.dataset.tg as string; if (!anno || !st) return;
      if (k === 'edit') { editing = !editing; (res.querySelector('#editBar') as HTMLElement).hidden = !editing; b.setAttribute('aria-pressed', String(editing)); if (editing) startEdit(); else paintAll(false); return; }
      if (k === 'replay') { const A = $<HTMLCanvasElement>('cvA'); delete A.dataset.done; paintAll(true); return; }
      if (k === 'margin') anno.margin = anno.margin ? undefined : 2; else (anno as unknown as Record<string, boolean>)[k] = !(anno as unknown as Record<string, boolean>)[k];
      b.setAttribute('aria-pressed', String(k === 'margin' ? !!anno.margin : (anno as unknown as Record<string, boolean>)[k]));
      paintAll(false);
    }));
    const sf = res.querySelector<HTMLFormElement>('#scaleForm');
    if (sf) sf.onsubmit = (e) => {
      e.preventDefault();
      const v = Number((res.querySelector('#knownLen') as HTMLInputElement).value);
      if (!(v > 0) || !st?.geo || !a) return;
      const f = v / (st.geo.shape.rectLong * st.cmPerPx);
      a.scale = { ...a.scale, source: 'user_reference', mm_per_pixel: a.scale.mm_per_pixel * f, uncertainty_percent: 5 };
      st.cmPerPx *= f; st.geo = buildGeo(st.mask, st.W, st.H, st.cmPerPx);
      rebuild();
    };
    const form = res.querySelector<HTMLFormElement>('#saveForm') as HTMLFormElement;
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!a || !file) return;
      const fd = new FormData();
      fd.set('patient_code', (res.querySelector('#pcode') as HTMLInputElement).value.trim());
      fd.set('label', (res.querySelector('#plabel') as HTMLInputElement).value);
      fd.set('captured_at', new Date().toISOString());
      const slim: Partial<Analysis> & Record<string, unknown> = { ...a };
      delete slim.mask_png; delete slim.probability_png; delete slim.tissue_png;
      slim.calibrated = true; slim.area_cm2 = c.areaCm2; slim.perimeter_mm = polyLen(c.geo.poly) * c.geo.cmPerPx * 10; slim.length_mm = c.geo.shape.rectLong * c.geo.cmPerPx * 10; slim.width_mm = c.geo.shape.rectShort * c.geo.cmPerPx * 10;
      fd.set('analysis_json', JSON.stringify(slim));
      fd.set('image', file);
      const ok = res.querySelector('#okMsg') as HTMLElement;
      try {
        await api.saveCase(fd);
        ok.hidden = false; ok.textContent = T('Saved', 'Tersimpan'); setTimeout(() => (ok.hidden = true), 2600);
        activePatient = fd.get('patient_code') as string; refreshCases();
      } catch (ex) { showErr(ex instanceof ApiError ? ex.message : String(ex)); }
    };
    const dl = res.querySelector<HTMLButtonElement>('#dlPlate');
    if (dl) dl.onclick = async () => {
      if (!st || !anno) return;
      const bl = await exportPlate(st, view(), { ...anno, margin: undefined }, typeName(c.type));
      if (!bl) return;
      const u = URL.createObjectURL(bl), l = document.createElement('a'); l.href = u; l.download = `woundscan-plan-${view().plan.tech}.png`; l.click(); setTimeout(() => URL.revokeObjectURL(u), 2000);
    };
    if (editing) startEdit(); else paintAll(first);
    paintPlate();
    if (tab === 'three') openViewer();
  }

  function paintPlate() {
    if (!cs || !st || !anno) return;
    const cc = view();
    const pairs: [string, (x: CanvasRenderingContext2D) => void][] = [
      ['cvB1', (x) => paintAnnotated(x, st as Stage, { ...(anno as AnnoOpts), margin: undefined }, 1)],
      ['cvB2', (x) => paintMarking(x, st as Stage, cc, 1)],
      ['cvB3', (x) => paintResult(x, st as Stage, cc, 'day0')],
    ];
    pairs.forEach(([id, fn]) => {
      const el = $<HTMLCanvasElement>(id); if (!el) return;
      const sf = Math.min(2, window.devicePixelRatio || 1);
      el.width = Math.round((st as Stage).W * sf); el.height = Math.round((st as Stage).H * sf);
      const x = el.getContext('2d')!; x.scale(sf, sf); fn(x);
    });
  }

  function setTab(k: Tab) {
    tab = k;
    res.querySelectorAll<HTMLButtonElement>('.tab').forEach((b) => { const on = b.dataset.tab === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    res.querySelectorAll<HTMLElement>('.pane').forEach((p) => (p.hidden = p.dataset.pane !== k));
    if (k === 'three') openViewer();
    if (k === 'plan') paintPlate();
  }

  function openViewer() {
    if (viewer || !cs || !st) return;
    const host = $('v3host');
    viewer = mountViewer(host, st, view());
  }


  /** background that cannot reach the photo border is inside the wound: fill it */
  function fillHoles(m: Uint8Array, W: number, H: number) {
    const out = new Uint8Array(W * H), stack: number[] = [];
    const push = (i: number) => { if (!m[i] && !out[i]) { out[i] = 1; stack.push(i); } };
    for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
    while (stack.length) {
      const i = stack.pop() as number, x = i % W, y = (i / W) | 0;
      if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (y > 0) push(i - W); if (y < H - 1) push(i + W);
    }
    for (let i = 0; i < m.length; i++) if (!out[i]) m[i] = 1;
  }

  /* ---------- outline editing ---------- */
  let mc: HTMLCanvasElement | null = null;
  let orig: Uint8Array | null = null;
  function repaintEdit() {
    const A = $<HTMLCanvasElement>('cvA'); if (!A || !st || !mc) return;
    const ax = A.getContext('2d')!;
    const sf = A.width / st.W;
    ax.setTransform(sf, 0, 0, sf, 0, 0);
    ax.clearRect(0, 0, st.W, st.H); ax.drawImage(st.img, 0, 0, st.W, st.H); ax.drawImage(mc, 0, 0);
  }
  function startEdit() {
    if (!st) return;
    const A = $<HTMLCanvasElement>('cvA');
    if (!orig) orig = st.mask.slice();
    mc = document.createElement('canvas'); mc.width = st.W; mc.height = st.H;
    const g = mc.getContext('2d', { willReadFrequently: true })!;
    const id = g.createImageData(st.W, st.H);
    for (let i = 0; i < st.W * st.H; i++) { id.data[i * 4] = 242; id.data[i * 4 + 1] = 182; id.data[i * 4 + 2] = 50; id.data[i * 4 + 3] = st.mask[i] ? 150 : 0; }
    g.putImageData(id, 0, 0);
    repaintEdit();
    let tool: 'add' | 'erase' = 'add', down = false, last: [number, number] | null = null;
    const size = $<HTMLInputElement>('ebSize');
    res.querySelectorAll<HTMLButtonElement>('[data-etool]').forEach((b) => (b.onclick = () => { tool = b.dataset.etool as 'add' | 'erase'; res.querySelectorAll<HTMLButtonElement>('[data-etool]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
    const pt = (e: PointerEvent): [number, number] => { const r = A.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * (st as Stage).W, ((e.clientY - r.top) / r.height) * (st as Stage).H]; };
    const stroke = (a: [number, number], b: [number, number]) => {
      const g2 = (mc as HTMLCanvasElement).getContext('2d')!;
      g2.globalCompositeOperation = tool === 'add' ? 'source-over' : 'destination-out';
      g2.strokeStyle = 'rgba(242,182,50,0.6)'; g2.fillStyle = 'rgba(242,182,50,0.6)';
      g2.lineCap = 'round'; g2.lineWidth = Number(size.value) * ((st as Stage).W / 900);
      g2.beginPath(); g2.moveTo(a[0], a[1]); g2.lineTo(b[0] + 0.01, b[1]); g2.stroke();
      repaintEdit();
    };
    A.style.cursor = 'crosshair'; A.style.touchAction = 'none';
    A.onpointerdown = (e) => { down = true; A.setPointerCapture(e.pointerId); last = pt(e); stroke(last, last); };
    A.onpointermove = (e) => { if (!down || !last) return; const p2 = pt(e); stroke(last, p2); last = p2; };
    A.onpointerup = () => { down = false; last = null; };
    $('ebReset').onclick = () => { if (orig && st) { st.mask.set(orig); } startEdit(); };
    $('ebDone').onclick = () => {
      if (!st || !mc) return;
      const d = mc.getContext('2d')!.getImageData(0, 0, st.W, st.H).data;
      const m = new Uint8Array(st.W * st.H);
      for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 60 ? 1 : 0;
      fillHoles(m, st.W, st.H);
      const g3 = buildGeo(m, st.W, st.H, st.cmPerPx);
      if (!g3) { showErr(T('The outline became too small to measure.', 'Garis tepi terlalu kecil untuk diukur.')); return; }
      st.mask = m; st.geo = g3; st.tissue = null; if (anno) anno.tissue = false;
      edited = true; editing = false; A.onpointerdown = A.onpointermove = A.onpointerup = null; A.style.cursor = '';
      showErr(''); rebuild();
    };
  }

  /* ---------- cases ---------- */
  async function refreshCases() {
    let rows: CaseRow[] = [];
    try { rows = await api.cases(activePatient || undefined); } catch { return; }
    caseList.innerHTML = '';
    if (!rows.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = T('No cases yet. Save your first analysis.', 'Belum ada kasus. Simpan hasil analisis pertama.'); caseList.append(li); }
    rows.forEach((c) => {
      const li = document.createElement('li');
      const thumb = c.has_thumb ? Object.assign(document.createElement('img'), { src: `/api/cases/${c.id}/thumb`, alt: '', loading: 'lazy' }) : Object.assign(document.createElement('div'), { className: 'ph' });
      const mid = document.createElement('div');
      const title = document.createElement('div'); title.className = 't'; title.textContent = `${c.patient_code}${c.label ? ` · ${c.label}` : ''}`;
      const meta = document.createElement('div'); meta.className = 'm';
      meta.textContent = `${c.calibrated && c.area_cm2 != null ? `${num(c.area_cm2, 1)} cm²` : '—'} · ${c.captured_at.slice(0, 10)}`;
      mid.append(title, meta);
      const del = document.createElement('button'); del.type = 'button'; del.textContent = T('Delete', 'Hapus');
      del.addEventListener('click', async (ev) => { ev.stopPropagation(); await api.remove(c.id); refreshCases(); });
      li.append(thumb, mid, del); li.style.cursor = 'pointer';
      li.addEventListener('click', () => { activePatient = c.patient_code; showTrend(c.patient_code); });
      caseList.append(li);
    });
    if (activePatient) showTrend(activePatient); else if (rows[0]) showTrend(rows[0].patient_code); else renderTrend(trendHost, null);
  }
  async function showTrend(code: string) { try { renderTrend(trendHost, await api.trend(code)); } catch { renderTrend(trendHost, null); } }

  onLang(() => {
    fillStatic();
    scanSteps.querySelectorAll('li span:last-child').forEach((e, i) => (e.textContent = T(...STEP_TXT[i])));
    if (cs && !res.hidden) { const v = viewer; v?.destroy(); viewer = null; render(false); }
    refreshCases();
  });
  refreshCases();
}
