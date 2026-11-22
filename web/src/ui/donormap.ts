/* Front and back silhouettes with the donor zones marked; the top ranked donor is lit. */
type Z = { f: 'f' | 'b'; cx: number; cy: number; rx: number; ry: number };
const ZONES: Record<string, Z[]> = {
  thigh_al: [{ f: 'f', cx: 44, cy: 168, rx: 8, ry: 26 }, { f: 'f', cx: 66, cy: 168, rx: 8, ry: 26 }],
  thigh_post: [{ f: 'b', cx: 44, cy: 172, rx: 8, ry: 24 }, { f: 'b', cx: 66, cy: 172, rx: 8, ry: 24 }],
  buttock: [{ f: 'b', cx: 55, cy: 136, rx: 17, ry: 9 }],
  back: [{ f: 'b', cx: 55, cy: 84, rx: 19, ry: 26 }],
  abdomen: [{ f: 'f', cx: 55, cy: 100, rx: 17, ry: 18 }],
  abdomen_f: [{ f: 'f', cx: 55, cy: 118, rx: 17, ry: 8 }],
  scalp: [{ f: 'b', cx: 55, cy: 18, rx: 12, ry: 11 }],
  upper_arm: [{ f: 'f', cx: 22, cy: 68, rx: 5, ry: 17 }, { f: 'f', cx: 88, cy: 68, rx: 5, ry: 17 }],
  medarm: [{ f: 'f', cx: 30, cy: 70, rx: 3, ry: 14 }],
  calf: [{ f: 'b', cx: 44, cy: 216, rx: 6, ry: 20 }, { f: 'b', cx: 66, cy: 216, rx: 6, ry: 20 }],
  supraclav: [{ f: 'f', cx: 43, cy: 44, rx: 9, ry: 3 }, { f: 'f', cx: 67, cy: 44, rx: 9, ry: 3 }],
  postaur: [{ f: 'b', cx: 40, cy: 20, rx: 3, ry: 5 }],
  groin: [{ f: 'f', cx: 55, cy: 134, rx: 15, ry: 4 }],
  hypothenar: [{ f: 'f', cx: 17, cy: 140, rx: 3, ry: 5 }],
  instep: [{ f: 'f', cx: 44, cy: 262, rx: 6, ry: 3 }],
};

function body(dx: number) {
  return `<g transform="translate(${dx} 0)" class="bd">
    <circle cx="55" cy="20" r="13"/><rect x="49" y="31" width="12" height="10" rx="4"/>
    <path d="M33 42 Q55 36 77 42 L79 70 L77 132 Q55 140 33 132 L31 70 Z"/>
    <path d="M30 46 Q18 50 16 70 L14 104 Q14 110 19 110 L24 110 L27 70 Z"/>
    <path d="M80 46 Q92 50 94 70 L96 104 Q96 110 91 110 L86 110 L83 70 Z"/>
    <path d="M36 132 L53 132 L51 270 L40 270 Z"/><path d="M57 132 L74 132 L70 270 L59 270 Z"/>
  </g>`;
}

export function donorMap(active: string, front = 'front', back = 'back'): string {
  const mk = (fig: 'f' | 'b', dx: number) => Object.entries(ZONES).flatMap(([id, zs]) => zs.filter((z) => z.f === fig).map((z) => `<ellipse class="z ${id === active ? 'on' : ''}" cx="${z.cx + dx}" cy="${z.cy}" rx="${z.rx}" ry="${z.ry}"/>`)).join('');
  return `<svg viewBox="0 0 230 280" role="img" aria-label="donor map" class="dmapsvg">${body(0)}${body(120)}${mk('f', 0)}${mk('b', 120)}<text x="55" y="278" text-anchor="middle">${front}</text><text x="175" y="278" text-anchor="middle">${back}</text></svg>`;
}
