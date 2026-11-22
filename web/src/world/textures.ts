import * as THREE from 'three';
import { mulberry32 } from './noise';

export type Layer = 'epi' | 'derm' | 'fat' | 'mus';

/* Procedural cross-section textures: collagen strands, adipocytes, muscle fibres. Drawn once on canvases. */
export function sectionTexture(kind: Layer, seed: number): THREE.CanvasTexture {
  const W = 1024;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const rnd = mulberry32(seed);

  if (kind === 'epi') {
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#8a5a3d');
    grd.addColorStop(0.55, '#c08a66');
    grd.addColorStop(1, '#d9b295');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
  } else if (kind === 'derm') {
    g.fillStyle = '#d49b84';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 520; i++) {
      const y = rnd() * H;
      const x0 = rnd() * W;
      const len = 60 + rnd() * 220;
      g.strokeStyle = rnd() > 0.5 ? 'rgba(255,225,205,0.16)' : 'rgba(120,52,40,0.10)';
      g.lineWidth = 1 + rnd() * 2.2;
      g.beginPath();
      g.moveTo(x0, y);
      g.bezierCurveTo(x0 + len * 0.3, y + (rnd() - 0.5) * 16, x0 + len * 0.7, y + (rnd() - 0.5) * 16, x0 + len, y + (rnd() - 0.5) * 8);
      g.stroke();
    }
    for (let i = 0; i < 38; i++) {
      g.fillStyle = `rgba(140,30,34,${0.25 + rnd() * 0.3})`;
      g.beginPath();
      g.arc(rnd() * W, rnd() * H, 2 + rnd() * 3.4, 0, Math.PI * 2);
      g.fill();
    }
  } else if (kind === 'fat') {
    g.fillStyle = '#e6c88f';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 420; i++) {
      const r = 14 + rnd() * 26;
      const x = rnd() * W;
      const y = rnd() * H;
      const grd = g.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r);
      grd.addColorStop(0, 'rgba(255,244,214,0.75)');
      grd.addColorStop(1, 'rgba(236,205,140,0.35)');
      g.fillStyle = grd;
      g.strokeStyle = 'rgba(170,120,60,0.55)';
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    for (let i = 0; i < 14; i++) {
      g.fillStyle = 'rgba(150,34,38,0.55)';
      g.beginPath();
      g.arc(rnd() * W, rnd() * H, 3 + rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    g.fillStyle = '#7b2a2a';
    g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 3 + rnd() * 5) {
      g.fillStyle = `rgba(${rnd() > 0.5 ? '170,70,60' : '70,18,20'},${0.12 + rnd() * 0.22})`;
      g.fillRect(x, 0, 2 + rnd() * 4, H);
    }
    for (let i = 0; i < 160; i++) {
      g.strokeStyle = 'rgba(210,130,110,0.10)';
      g.lineWidth = 1;
      const x = rnd() * W;
      g.beginPath();
      g.moveTo(x, rnd() * H);
      g.lineTo(x + (rnd() - 0.5) * 12, rnd() * H);
      g.stroke();
    }
    g.fillStyle = 'rgba(236,210,196,0.55)';
    g.fillRect(0, 0, W, 5);
  }

  // thin dark boundary lines, like an atlas plate
  g.fillStyle = 'rgba(40,18,12,0.55)';
  g.fillRect(0, 0, W, 2);
  g.fillRect(0, H - 2, W, 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

export function poreBump(): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#808080';
  g.fillRect(0, 0, S, S);
  const rnd = mulberry32(77);
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const r = 1.2 + rnd() * 2.4;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(40,40,40,0.55)');
    grd.addColorStop(1, 'rgba(128,128,128,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = 'rgba(70,70,70,0.22)';
    g.lineWidth = 1;
    g.beginPath();
    const x = rnd() * S;
    const y = rnd() * S;
    g.moveTo(x, y);
    g.lineTo(x + (rnd() - 0.5) * 70, y + (rnd() - 0.5) * 70);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  tex.anisotropy = 8;
  return tex;
}

/* Paper wound ruler: millimetre ticks, centimetre numerals. Texture spans `cm` centimetres on U. */
export function rulerTexture(cm: number): THREE.CanvasTexture {
  const pxPerMm = 12;
  const W = cm * 10 * pxPerMm;
  const H = 150;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f1ebdd';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#15110e';
  for (let mm = 0; mm <= cm * 10; mm++) {
    const x = mm * pxPerMm + 1;
    const len = mm % 10 === 0 ? 66 : mm % 5 === 0 ? 46 : 28;
    g.fillRect(x - 1, 0, mm % 10 === 0 ? 3 : 2, len);
  }
  g.font = '600 40px "IBM Plex Mono", monospace';
  g.textAlign = 'center';
  for (let k = 1; k < cm; k++) g.fillText(String(k), k * 10 * pxPerMm, 118);
  g.fillStyle = '#f2b632';
  g.fillRect(0, H - 14, W, 14);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
