import * as THREE from 'three';

export interface TagDef {
  id: string;
  /** returns the current label text (called again when the language changes) */
  text: () => string;
  /** optional value shown in tape yellow after the text */
  value?: () => string;
  anchor: () => THREE.Vector3;
  side: 'left' | 'right';
  len?: number;
}

interface Live {
  def: TagDef;
  el: HTMLElement;
  txt: HTMLElement;
  val: HTMLElement | null;
  w: number;
  h: number;
  vis: number;
  v: THREE.Vector3;
}

/* DOM labels pinned to 3D points: crisp type, themed by CSS, no canvas text. */
export class Tags {
  private live: Live[] = [];
  constructor(private root: HTMLElement) {}

  add(def: TagDef) {
    const el = document.createElement('div');
    el.className = 'tag';
    el.dataset.side = def.side;
    const rule = document.createElement('span');
    rule.className = 'rule';
    if (def.len) rule.style.setProperty('--len', `${def.len}px`);
    const txt = document.createElement('span');
    txt.className = 'txt';
    el.append(rule, txt);
    let val: HTMLElement | null = null;
    if (def.value) {
      val = document.createElement('span');
      val.className = 'v';
      txt.append(document.createTextNode(''), val);
    }
    this.root.append(el);
    const t: Live = { def, el, txt, val, w: 0, h: 0, vis: 0, v: new THREE.Vector3() };
    this.live.push(t);
    this.refresh(t);
  }

  private refresh(t: Live) {
    if (t.val) {
      (t.txt.firstChild as Text).data = t.def.text();
      t.val.textContent = t.def.value!();
    } else {
      t.txt.textContent = t.def.text();
    }
    t.w = t.el.offsetWidth;
    t.h = t.el.offsetHeight;
  }

  refreshAll() {
    this.live.forEach((t) => this.refresh(t));
  }

  /** vis: id -> 0..1 visibility from the chapter choreography */
  update(camera: THREE.Camera, w: number, h: number, vis: Record<string, number>, offsetX: number, offsetY: number, snap = false) {
    for (const t of this.live) {
      const k = vis[t.def.id] ?? 0;
      t.vis = snap ? k : t.vis + (k - t.vis) * 0.2;
      if (t.vis < 0.01) {
        if (t.el.style.opacity !== '0') t.el.style.opacity = '0';
        continue;
      }
      t.v.copy(t.def.anchor()).project(camera);
      if (t.v.z > 1 || t.v.z < -1) {
        t.el.style.opacity = '0';
        continue;
      }
      const x = (t.v.x * 0.5 + 0.5) * w + offsetX;
      const y = (-t.v.y * 0.5 + 0.5) * h + offsetY;
      // flip to whichever side has room, so a label never runs off the screen edge
      let side = t.def.side;
      if (side === 'right' && x + t.w > w - 8) side = 'left';
      else if (side === 'left' && x - t.w < 8) side = 'right';
      if (t.el.dataset.side !== side) t.el.dataset.side = side;
      const tx = side === 'right' ? x - 3.5 : x - t.w + 3.5;
      t.el.style.transform = `translate3d(${tx.toFixed(1)}px, ${(y - t.h / 2).toFixed(1)}px, 0)`;
      t.el.style.opacity = String(Math.min(1, t.vis));
    }
  }
}
