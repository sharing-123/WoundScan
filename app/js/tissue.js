/* Estimasi komposisi dasar luka dari warna (relatif terhadap kulit peri-luka).
   Ini estimasi berbasis warna, bukan histologi: tidak menggantikan penilaian klinis. */
window.TIS = (() => {
  const NAMES = { 1: 'Granulasi', 2: 'Slough', 3: 'Nekrotik', 4: 'Epitel/pucat' };
  const COLORS = { 1: '#ff3d63', 2: '#ffd23f', 3: '#3b2a5c', 4: '#ffb6c8' };

  function median(a) { if (!a.length) return 0; const s = Float32Array.from(a).sort(); return s[s.length >> 1]; }

  function classify(rgba, W, H, mask) {
    const d = G.edt(mask, W, H);
    let area = 0; for (let i = 0; i < W * H; i++) area += mask[i];
    const dmin = 4, dmax = Math.max(18, 0.4 * Math.sqrt(area));
    const Ls = [], As = [], Bs = [];
    for (let i = 0; i < W * H; i += 2) {
      if (!mask[i] && d[i] >= dmin && d[i] <= dmax) { const v = G.rgb2lab(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]); Ls.push(v[0]); As.push(v[1]); Bs.push(v[2]); }
    }
    const skin = Ls.length > 50 ? { L: median(Ls), a: median(As), b: median(Bs) } : { L: 65, a: 14, b: 18 };
    const labels = new Uint8Array(W * H);
    const cnt = [0, 0, 0, 0, 0];
    for (let i = 0; i < W * H; i++) {
      if (!mask[i]) continue;
      const [L, a, b] = G.rgb2lab(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
      const C = Math.hypot(a, b), hue = Math.atan2(b, a) * 180 / Math.PI, da = a - skin.a;
      let t;
      if (L < 20 || (L < 36 && C < 24) || (L < skin.L * 0.5 && C < 26)) t = 3;    // nekrotik/eskar: gelap dan kroma rendah (darah merah tua = kroma tinggi, bukan nekrosis)
      else if (hue > 52 && C > 16 && L > 38 && a < 20) t = 2;                      // slough: kuning-krem
      else if (L > 68 && b - skin.b > 9 && da < 6) t = 2;                           // slough pucat
      else if (da > 12 && hue < 52) t = 1;                                          // granulasi: merah
      else t = 4;                                                                    // epitel / pink pucat
      labels[i] = t; cnt[t]++;
    }
    const tot = Math.max(1, cnt[1] + cnt[2] + cnt[3] + cnt[4]);
    const pct = { gran: 100 * cnt[1] / tot, slough: 100 * cnt[2] / tot, nekro: 100 * cnt[3] / tot, epi: 100 * cnt[4] / tot };
    return { labels, pct, skin };
  }

  /* kanvas overlay RGBA dari label jaringan */
  function overlay(labels, W, H) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); const im = x.createImageData(W, H);
    const col = { 1: [255, 61, 99, 150], 2: [255, 210, 63, 160], 3: [52, 30, 92, 190], 4: [255, 182, 200, 110] };
    for (let i = 0; i < W * H; i++) { const t = labels[i]; if (!t) continue; const v = col[t]; im.data[i * 4] = v[0]; im.data[i * 4 + 1] = v[1]; im.data[i * 4 + 2] = v[2]; im.data[i * 4 + 3] = v[3]; }
    x.putImageData(im, 0, 0); return c;
  }

  return { NAMES, COLORS, classify, overlay };
})();
