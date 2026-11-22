import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, VignetteEffect, NoiseEffect, ToneMappingEffect, ToneMappingMode, ChromaticAberrationEffect, BlendFunction } from 'postprocessing';
import { SkinBlock, BLOCK_BOTTOM } from './skin';
import { Platter, Dust, Beams, setLineResolution } from './stage';
import { Measure } from './ruler';
import { ZPlasty } from './zplasty';
import { Body } from './body';
import { Lens } from './lens';
import { Tags } from './tags';
import { evaluate, type Chapter } from './choreography';
import { smoothstep, clamp, easeOutExpo } from './noise';
import { stats, axisExtent } from './wound';
import { t, lang } from '../i18n';

const NIGHT = new THREE.Color('#0d0b0a');

function fmt(n: number, d = 1) {
  const s = n.toFixed(d);
  return lang() === 'id' ? s.replace('.', ',') : s;
}

export class World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  composer: EffectComposer;
  block = new SkinBlock();
  platter = new Platter(BLOCK_BOTTOM - 0.035);
  dust = new Dust(900);
  beams = new Beams();
  mirror: THREE.Group;
  private ex = 0;
  measure: Measure;
  zplasty = new ZPlasty();
  body = new Body();
  lens = new Lens();
  tags: Tags;
  scanPlane: THREE.Mesh;
  private aberr: ChromaticAberrationEffect;
  private chapters: Chapter[] = [];
  private w = 1;
  private h = 1;
  private pointer = new THREE.Vector2();
  private pointerS = new THREE.Vector2();
  private sd = 0;
  private lastSd = 0;
  private lastCut = 99;
  private active = true;
  private reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private narrow = false;
  private timer = new THREE.Timer();
  private W = stats();
  private E = axisExtent();
  private lookAt = new THREE.Vector3();
  private t0 = -1;
  private introSkip = false;
  private settleFrames = 0;
  private layout = { col: 520, pad: 64 };
  private ema = 16;
  private level = 0;
  private frames = 0;
  onFirstFrame: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement, tagsRoot: HTMLElement) {
    const coarse = matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, alpha: false });
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.localClippingEnabled = true;
    this.renderer.transmissionResolutionScale = 0.5;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 1.75));
    this.scene.background = NIGHT.clone();
    this.scene.fog = new THREE.FogExp2(NIGHT.getHex(), 0.016);

    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.24;

    const hemi = new THREE.HemisphereLight('#ffe6cf', '#1a1210', 0.3);
    const key = new THREE.DirectionalLight('#fff0dc', 2.0);
    key.position.set(6, 10, 7);
    const rim = new THREE.DirectionalLight('#bfe0d8', 1.5);
    rim.position.set(-8, 5, -9);
    const warm = new THREE.PointLight('#ffb866', 22, 24, 1.6);
    warm.position.set(-3, 3.5, 3);
    this.scene.add(hemi, key, rim, warm);

    this.mirror = this.block.group.clone(true);
    this.scene.add(this.platter.mesh, this.dust.points, this.beams.group, this.block.group, this.mirror, this.zplasty.group, this.body.group, this.lens.group);
    this.measure = new Measure(this.block.plane);
    this.scene.add(this.measure.group);

    this.scanPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(10.6, 2.8),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uA: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `varying vec2 vUv; uniform float uA;
          void main(){
            float grid = smoothstep(0.04, 0.0, abs(fract(vUv.x * 53.0) - 0.5) - 0.46) * 0.35 + smoothstep(0.04, 0.0, abs(fract(vUv.y * 14.0) - 0.5) - 0.46) * 0.35;
            float fade = smoothstep(0.0, 0.5, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
            float edge = smoothstep(0.06, 0.0, vUv.y);
            vec3 c = vec3(1.0, 0.78, 0.28);
            gl_FragColor = vec4(c, (fade * (0.16 + grid * 0.5) + edge * 0.9) * uA);
          }`,
      }),
    );
    this.scanPlane.rotation.y = Math.PI / 2;
    this.scanPlane.position.y = 0.9;
    this.scanPlane.visible = false;
    this.scene.add(this.scanPlane);

    // post: bloom on the emissive tape-yellow lines and the lit lens edge, ACES tone mapping, grain, vignette,
    // and a chromatic aberration that opens with scroll speed
    this.composer = new EffectComposer(this.renderer, { multisampling: coarse ? 0 : 4, frameBufferType: THREE.HalfFloatType });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new BloomEffect({ intensity: 0.85, luminanceThreshold: 0.82, luminanceSmoothing: 0.18, mipmapBlur: true, radius: 0.7 });
    this.aberr = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0, 0), radialModulation: true, modulationOffset: 0.35 });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    const vig = new VignetteEffect({ offset: 0.28, darkness: 0.62 });
    const grain = new NoiseEffect({ premultiply: true, blendFunction: BlendFunction.SCREEN });
    grain.blendMode.opacity.value = coarse ? 0 : 0.05;
    this.composer.addPass(new EffectPass(this.camera, bloom, this.aberr, tone, vig, grain));

    this.tags = new Tags(tagsRoot);
    this.buildTags();

    addEventListener('pointermove', (e) => {
      this.pointer.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
    });
    this.resize();
  }

  /* ---------- labels ---------- */
  private buildTags() {
    const e = this.E;
    const surf = (x: number, z: number, y = 0.05) => new THREE.Vector3(x, y, z);
    const at = (u: number, v: number, y = 0.05) => {
      const [x, z] = e.toXZ(u, v);
      return surf(x, z, y);
    };
    const A = this.W.areaCm2;
    const L = this.W.lengthCm;
    const Wd = this.W.widthCm;
    const T = this.tags;
    T.add({ id: 'epi', side: 'right', len: 16, text: () => t('layers.epi'), anchor: () => new THREE.Vector3(-4.4, -0.06, 0.2) });
    T.add({ id: 'derm', side: 'right', len: 16, text: () => t('layers.derm'), anchor: () => new THREE.Vector3(-4.4, -0.55 - this.ex, 0.2) });
    T.add({ id: 'fat', side: 'right', len: 16, text: () => t('layers.fat'), anchor: () => new THREE.Vector3(-4.4, -1.72 - 2 * this.ex, 0.2) });
    T.add({ id: 'mus', side: 'right', len: 16, text: () => t('layers.mus'), anchor: () => new THREE.Vector3(-4.4, -3.1 - 3 * this.ex, 0.2) });
    T.add({ id: 'wl', side: 'left', len: 26, text: () => t('layers.wound'), anchor: () => new THREE.Vector3(-0.85, -1.05 - 1.4 * this.ex, 0.2) });
    T.add({ id: 'edge', side: 'right', len: 52, text: () => t('scan.edge'), anchor: () => at(e.umax * 0.98, 0, 0.1) });
    T.add({ id: 'doubt', side: 'left', len: 52, text: () => t('scan.doubt'), anchor: () => at(e.umin * 0.6, e.vmax * 1.12, 0.1) });
    T.add({ id: 'len', side: 'right', len: 40, text: () => t('measure.len'), value: () => `${fmt(L)} cm`, anchor: () => this.measure.anchors.length });
    T.add({ id: 'wid', side: 'right', len: 40, text: () => t('measure.wid'), value: () => `${fmt(Wd)} cm`, anchor: () => this.measure.anchors.width });
    T.add({ id: 'area', side: 'left', len: 56, text: () => t('measure.area'), value: () => `${fmt(A)} cm²`, anchor: () => surf(-0.6, 0.2, 0.05) });
    T.add({ id: 'zl', side: 'right', len: 44, text: () => t('plan.z'), anchor: () => this.zplasty.group.localToWorld(this.zplasty.anchors.z.clone()) });
    T.add({ id: 'before', side: 'right', len: 30, text: () => t('plan.before'), value: () => `${fmt(2.7)} cm`, anchor: () => this.zplasty.group.localToWorld(this.zplasty.anchors.before.clone()) });
    T.add({ id: 'after', side: 'right', len: 30, text: () => t('plan.after'), value: () => `${fmt(4.7)} cm`, anchor: () => this.zplasty.group.localToWorld(this.zplasty.anchors.after.clone()) });
    const bw = (k: string) => () => this.body.group.localToWorld(this.body.anchors[k].clone());
    T.add({ id: 'bhead', side: 'right', len: 34, text: () => t('body.head'), anchor: bw('head') });
    T.add({ id: 'btrunk', side: 'right', len: 40, text: () => t('body.trunk'), anchor: bw('trunk') });
    T.add({ id: 'barm', side: 'right', len: 52, text: () => t('body.arm'), anchor: bw('arm') });
    T.add({ id: 'bleg', side: 'right', len: 44, text: () => t('body.leg'), anchor: bw('leg') });
    T.add({ id: 'bwound', side: 'left', len: 60, text: () => t('body.wound'), value: () => `${fmt((A / 18200) * 100, 2)}%`, anchor: bw('wound') });
  }

  refreshLabels() {
    this.tags.refreshAll();
  }

  /* ---------- layout ---------- */
  setChapters(c: Chapter[]) {
    this.chapters = c;
  }
  /* measured from the DOM: width of the text column and the page padding */
  setLayout(col: number, pad: number) {
    this.layout = { col, pad };
  }
  setActive(a: boolean) {
    this.active = a;
    if (!a) this.tags.update(this.camera, this.w, this.h, {}, 0, 0);
  }

  resize() {
    this.w = innerWidth;
    this.h = innerHeight;
    this.narrow = this.w < 760;
    this.renderer.setSize(this.w, this.h, false);
    this.composer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    setLineResolution(this.w, this.h);
    this.camera.updateProjectionMatrix();
    this.tags.refreshAll();
  }

  skipIntro() {
    this.introSkip = true;
  }
  /* test hook: jump straight to the scroll position with labels fully settled */
  settle() {
    this.introSkip = true;
    this.settleFrames = 6;
  }

  /* A cheap planar reflection: the block drawn again upside down under the glossy platter. */
  private syncMirror(py: number) {
    const b = this.block.group;
    const m = this.mirror;
    m.visible = b.visible;
    const sc = b.scale.x;
    m.scale.set(sc, -sc, sc);
    m.position.set(0, 2 * py - b.position.y, 0);
    m.rotation.copy(b.rotation);
    for (let i = 0; i < 4; i++) m.children[i].position.copy(b.children[i].position);
  }

  /* If the machine cannot hold ~40 fps, quietly lower the render resolution (never raises it again, so no flapping). */
  private adapt(dt: number) {
    this.frames++;
    this.ema += (dt * 1000 - this.ema) * 0.05;
    if (this.frames > 150 && this.level < 2 && this.ema > 26) {
      this.level++;
      this.frames = 0;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.level === 1 ? 1.25 : 1));
      this.composer.setSize(this.w, this.h, false);
      this.setLineRes();
    }
  }
  private setLineRes() {
    setLineResolution(this.w, this.h);
  }

  /* ---------- frame ---------- */
  frame(scrollY: number) {
    if (!this.active) return;
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    const elapsed = this.timer.getElapsed();
    const time = this.reduce ? 0 : elapsed;
    if (this.t0 < 0) this.t0 = elapsed;
    const intro = this.reduce || this.introSkip ? 1 : easeOutExpo(clamp((elapsed - this.t0) / 3.0));
    const snap = this.settleFrames-- > 0;
    this.sd = snap ? scrollY : this.sd + (scrollY - this.sd) * (1 - Math.exp(-dt * 7.5));
    const vel = (this.sd - this.lastSd) / Math.max(dt, 1e-3);
    this.lastSd = this.sd;
    this.pointerS.lerp(this.pointer, 1 - Math.exp(-dt * 3));

    const st = evaluate(this.chapters, this.sd, this.h);
    const k = st.key;
    const heroW = 1 - smoothstep(0, 0.7, st.index);
    const asp = this.w / this.h;

    // camera
    const par = this.reduce ? 0 : 1;
    // compose from the real layout: the subject centres in the space the text column leaves free, and the camera
    // pulls back only as far as needed for the subject to fit that space
    const gap = 40;
    const colEff = this.layout.col * (1 - 0.28 * heroW);
    const side = Math.sign(k.shiftX) || 1;
    const shiftX = side * ((this.layout.pad + colEff + gap) / (2 * this.w));
    let mult: number;
    if (this.narrow) mult = 1 + clamp((1.2 - asp) * 1.9, 0, 1.5);
    else {
      const free = 1 - (this.layout.pad + colEff + gap) / this.w;
      const target = clamp(free * 0.9, 0.3, 0.85);
      mult = Math.max(1, ((k.span * 1.78) / asp) / target);
    }
    mult *= 1 + (1 - intro) * 0.7;
    this.lookAt.set(k.tgt[0], k.tgt[1], k.tgt[2]);
    // handheld breathing keeps the frame alive even when scrolling stops
    const bx = Math.sin(time * 0.31) * 0.11 * par;
    const by = Math.sin(time * 0.23 + 1.3) * 0.08 * par;
    this.camera.position.set(
      this.lookAt.x + (k.cam[0] - k.tgt[0]) * mult + this.pointerS.x * 0.45 * par + bx,
      this.lookAt.y + (k.cam[1] - k.tgt[1]) * mult + this.pointerS.y * 0.28 * par + by,
      this.lookAt.z + (k.cam[2] - k.tgt[2]) * mult,
    );
    this.camera.lookAt(this.lookAt);
    this.camera.fov = k.fov;
    this.camera.setViewOffset(this.w, this.h, this.narrow ? 0 : -shiftX * this.w, this.narrow ? this.h * 0.17 : 0, this.w, this.h);
    this.camera.updateProjectionMatrix();

    // block
    const pr = (v: number) => smoothstep(0.42, 1, clamp(v));
    const be = pr(k.block);
    this.block.group.visible = be > 0.003;
    this.block.group.scale.setScalar(0.45 + 0.55 * (1 - Math.pow(1 - be, 3)));
    this.block.group.position.y = -(1 - (1 - Math.pow(1 - be, 3))) * 6;
    this.block.group.rotation.y = Math.sin(time * 0.12) * 0.07 * heroW + this.pointerS.x * 0.1 * heroW + (1 - intro) * 0.9;
    if (Math.abs(k.cut - this.lastCut) > 0.002) {
      this.block.setCut(k.cut);
      this.lastCut = k.cut;
    }
    this.ex = k.explode + (1 - intro) * 2.4;
    this.block.setExplode(this.ex);
    const py = BLOCK_BOTTOM - 0.035 - 3.05 * this.ex; // the floor sinks as the layers separate
    this.platter.mesh.position.y = py;
    this.syncMirror(py);
    this.beams.set(k.beam * (0.4 + 0.6 * intro), time);
    this.block.setOutline(k.outline, k.doubt);
    this.block.setIso(clamp(st.scanProg * 1.45, 0, 1.45), k.iso);
    this.block.shared.uScan.value = st.scanX;
    this.block.shared.uScanOn.value = st.scanOn;
    this.block.shared.uMask.value = k.mask;
    const sp = this.scanPlane.material as THREE.ShaderMaterial;
    this.scanPlane.visible = st.scanOn > 0.5;
    this.scanPlane.position.x = st.scanX;
    sp.uniforms.uA.value = st.scanOn;

    this.measure.set(k.ruler);
    this.zplasty.set(pr(k.tile), st.zp);
    this.body.set(pr(k.body), st.bp);
    this.lens.set(pr(k.lens), k.lensX + this.pointerS.x * 1.1 * heroW, k.lensY + this.pointerS.y * 0.5 * heroW, 0, time, this.reduce ? 0 : 1);

    // platter and dust
    this.platter.uniforms.uPulse.value = k.pulse * (0.6 + 0.4 * Math.sin(time * 1.4));
    this.platter.uniforms.uPulseR.value = 8.6 - ((time * 0.32) % 1) * (8.6 - k.pulseR);
    this.dust.u.uTime.value = time;
    this.dust.u.uPx.value = this.renderer.getPixelRatio();

    // scroll-speed chromatic aberration
    const a = clamp(Math.abs(vel) / 5200, 0, 1) * 0.0022;
    this.aberr.offset.set(a, a * 0.6);

    // labels
    const win = (c: number, wdt = 0.34) => 1 - smoothstep(wdt * 0.55, wdt, Math.abs(st.index - c));
    const vis: Record<string, number> = {};
    const L = win(1);
    ['epi', 'derm', 'fat', 'mus', 'wl'].forEach((id) => (vis[id] = L));
    const S = win(2, 0.4);
    vis.edge = S * smoothstep(0.55, 0.8, st.scanProg);
    vis.doubt = S * smoothstep(0.7, 0.9, st.scanProg);
    const M = win(3, 0.36);
    ['len', 'wid', 'area'].forEach((id) => (vis[id] = M));
    const P = win(4, 0.4);
    vis.zl = P * smoothstep(0.02, 0.2, st.zp);
    vis.before = P * smoothstep(0.1, 0.25, st.zp);
    vis.after = P * smoothstep(0.88, 0.97, st.zp);
    const B = win(5, 0.4);
    vis.bhead = B * smoothstep(0.3, 0.4, st.bp) * (1 - smoothstep(0.42, 0.52, st.bp)) * 1.0 + 0;
    vis.btrunk = B * smoothstep(0.4, 0.5, st.bp) * (1 - smoothstep(0.52, 0.62, st.bp));
    vis.barm = B * smoothstep(0.5, 0.6, st.bp) * (1 - smoothstep(0.62, 0.72, st.bp));
    vis.bleg = B * smoothstep(0.6, 0.7, st.bp);
    vis.bwound = B * smoothstep(0.8, 0.9, st.bp);
    this.tags.update(this.camera, this.w, this.h, vis, 0, 0, snap);

    this.composer.render(dt);
    if (!document.hidden) this.adapt(dt);
    if (this.onFirstFrame) {
      const f = this.onFirstFrame;
      this.onFirstFrame = null;
      f();
    }
  }

}
