/* Working-size rasters for drawing: the photo, the wound mask and the tissue overlay, all at the same size. */
import { buildGeo, type Geo } from './geom';

export interface Stage {
  W: number; H: number; img: HTMLCanvasElement; rgba: Uint8ClampedArray; mask: Uint8Array; tissue: HTMLCanvasElement | null;
  geo: Geo | null; cmPerPx: number; scale: number;
}

const WORK = 900;

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });

export async function makeStage(file: Blob, maskPng: string, tissuePng: string | null, fullW: number, mmPerPx: number): Promise<Stage> {
  const url = URL.createObjectURL(file);
  const photo = await loadImg(url);
  URL.revokeObjectURL(url);
  const scale = Math.min(1, WORK / Math.max(photo.naturalWidth, photo.naturalHeight));
  const W = Math.round(photo.naturalWidth * scale), H = Math.round(photo.naturalHeight * scale);
  const img = document.createElement('canvas');
  img.width = W; img.height = H;
  const g = img.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(photo, 0, 0, W, H);
  const rgba = g.getImageData(0, 0, W, H).data;

  const m = await loadImg(maskPng);
  const mc = document.createElement('canvas');
  mc.width = W; mc.height = H;
  const mg = mc.getContext('2d', { willReadFrequently: true })!;
  mg.drawImage(m, 0, 0, W, H);
  const md = mg.getImageData(0, 0, W, H).data;
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) mask[i] = md[i * 4] > 127 ? 1 : 0;

  let tissue: HTMLCanvasElement | null = null;
  if (tissuePng) {
    const t = await loadImg(tissuePng);
    tissue = document.createElement('canvas');
    tissue.width = W; tissue.height = H;
    tissue.getContext('2d')!.drawImage(t, 0, 0, W, H);
  }
  const cmPerPx = (mmPerPx * (fullW / W)) / 10;
  return { W, H, img, rgba, mask, tissue, geo: buildGeo(mask, W, H, cmPerPx), cmPerPx, scale };
}
