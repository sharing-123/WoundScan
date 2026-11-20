/* Peta donor: manekin depan/belakang berskala tinggi badan pasien (proporsi Drillis-Contini),
   dengan lokasi donor bernomor, dimensi (cm), dan lokasi resipien. Satuan SVG = cm. */
window.BMAP = (() => {
  const COL = ['#22d3ee', '#a78bfa', '#fbbf24', '#34d399', '#f472b6'];
  /* posisi resipien: [view, x(fraksi H, + = sisi pasien), y(fraksi H), rx, ry] ; x dikali tanda sisi */
  const REC = { wajah: ['front', 0, .935, .045, .06], 'kulit-kepala': ['back', 0, .955, .05, .045], leher: ['front', 0, .855, .04, .02], badan: ['front', 0, .67, .09, .12], sakrum: ['back', 0, .545, .06, .04],
    tangan: ['front', .2, .43, .03, .04], lengan: ['front', .17, .64, .03, .09], sendi: ['front', .06, .285, .045, .03], tungkai: ['front', .082, .41, .05, .1], pretibia: ['front', .058, .16, .03, .1], tumit: ['back', .055, .045, .03, .025], genital: ['front', 0, .48, .04, .03] };
  /* bentuk donor: view, x, y (fraksi H), rot (deg), dimensi default (cm) */
  const SH = {
    thigh_al: ['front', .088, .405, 4, 30, 10], alt: ['front', .088, .4335, 6, 20, 8], tfl: ['front', .105, .50, -25, 15, 8], gracilis: ['front', .045, .40, -8, 20, 6],
    thigh_post: ['back', .06, .40, 0, 25, 10], buttock: ['back', .05, .505, 0, 16, 12], back: ['back', .07, .66, 0, 30, 10], ld_ped: ['back', .075, .70, 62, 22, 9], ld_free: ['back', .075, .70, 62, 22, 9],
    gluteal: ['back', .045, .52, 0, 14, 10], abdomen: ['front', 0, .565, 0, 28, 10], abdomen_f: ['front', 0, .545, 0, 25, 8], scalp: ['front', 0, .975, 0, 12, 5],
    upper_arm: ['front', .17, .70, 0, 18, 6], medarm: ['front', .162, .70, 0, 14, 5], supraclav: ['front', .078, .845, -8, 12, 3.5], postaur: ['front', .05, .925, 0, 6, 3],
    groin: ['front', .058, .512, 24, 18, 6], scip: ['front', .058, .512, 24, 14, 5], rfff: ['front', .2, .55, 0, 14, 6], rfa_rev: ['front', .2, .55, 0, 14, 6], pectoralis: ['front', .06, .72, 30, 16, 8],
    calf: ['back', .052, .17, 0, 20, 8], rev_sural: ['back', .052, .15, 0, 15, 8], gastroc: ['back', .054, .22, 0, 14, 8], soleus: ['back', .054, .18, 0, 14, 8],
  };
  const f1 = (n) => n.toFixed(1);

  function mannequin(H, xc, top) {
    const Y = (fr) => top + (1 - fr) * H, X = (fr) => xc + fr * H, st = '#2c3e63', fl = '#16223a';
    const cap = (x1, y1, x2, y2, w) => `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${st}" stroke-width="${f1(w + 0.6)}" stroke-linecap="round"/><line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${fl}" stroke-width="${f1(w)}" stroke-linecap="round"/>`;
    let s = '';
    [-1, 1].forEach(sg => {
      s += cap(X(sg * .13), Y(.815), X(sg * .165), Y(.63), .046 * H); s += cap(X(sg * .165), Y(.63), X(sg * .185), Y(.485), .036 * H); s += cap(X(sg * .185), Y(.485), X(sg * .195), Y(.40), .03 * H);
      s += cap(X(sg * .05), Y(.53), X(sg * .06), Y(.285), .105 * H); s += cap(X(sg * .06), Y(.285), X(sg * .055), Y(.045), .066 * H); s += cap(X(sg * .055), Y(.03), X(sg * .06), Y(.012), .05 * H);
    });
    s += `<path d="M${f1(X(-.13))},${f1(Y(.82))} Q${f1(X(0))},${f1(Y(.835))} ${f1(X(.13))},${f1(Y(.82))} L${f1(X(.105))},${f1(Y(.64))} Q${f1(X(.09))},${f1(Y(.58))} ${f1(X(.098))},${f1(Y(.52))} L${f1(X(-.098))},${f1(Y(.52))} Q${f1(X(-.09))},${f1(Y(.58))} ${f1(X(-.105))},${f1(Y(.64))} Z" fill="${fl}" stroke="${st}" stroke-width=".6"/>`;
    s += `<rect x="${f1(X(-.026))}" y="${f1(Y(.87))}" width="${f1(.052 * H)}" height="${f1(.05 * H)}" fill="${fl}" stroke="${st}" stroke-width=".6"/>`;
    s += `<ellipse cx="${f1(xc)}" cy="${f1(Y(.935))}" rx="${f1(.047 * H)}" ry="${f1(.065 * H)}" fill="${fl}" stroke="${st}" stroke-width=".6"/>`;
    return s;
  }

  /* donors: [{id,label,dims:[L,W] cm opsional, n (peringkat), side:'kanan'|'kiri'}] ; rec: {region, side} */
  function svg(H, donors, rec) {
    H = H || 170; const wv = .56 * H, top = 6, hgt = H + 16, W = wv * 2 + 6; const xcF = wv / 2, xcB = wv * 1.5 + 6;
    const sideSign = (view, side) => (side === 'tengah' ? 0 : ((side === 'kanan' ? -1 : 1) * (view === 'back' ? -1 : 1)));
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f1(W)} ${f1(hgt)}" width="100%" role="img" aria-label="Peta donor" font-family="system-ui,sans-serif">`;
    s += `<rect width="${f1(W)}" height="${f1(hgt)}" rx="6" fill="#0b1220"/>`;
    s += mannequin(H, xcF, top) + mannequin(H, xcB, top);
    s += `<text x="${f1(xcF)}" y="${f1(top + 1)}" fill="#8a98b3" font-size="${f1(H * .035)}" text-anchor="middle">DEPAN</text><text x="${f1(xcB)}" y="${f1(top + 1)}" fill="#8a98b3" font-size="${f1(H * .035)}" text-anchor="middle">BELAKANG</text>`;
    // skala vertikal 10 cm
    s += `<line x1="3" y1="${f1(hgt - 16)}" x2="3" y2="${f1(hgt - 6)}" stroke="#fff" stroke-width=".8"/><text x="5.5" y="${f1(hgt - 9)}" fill="#fff" font-size="${f1(H * .03)}">10 cm</text>`;
    const place = (view, fx, fy, side) => { const xc = view === 'front' ? xcF : xcB; const sg = sideSign(view, side); return [xc + sg * fx * H, top + (1 - fy) * H]; };
    // resipien
    if (rec && REC[rec.region]) { const [v, fx, fy, rx, ry] = REC[rec.region]; const [cx, cy] = place(v, fx, fy, rec.side || 'tengah');
      s += `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx * H)}" ry="${f1(ry * H)}" fill="rgba(248,113,113,.25)" stroke="#f87171" stroke-width="1.2" stroke-dasharray="3 2"/>`;
      s += `<text x="${f1(cx)}" y="${f1(cy - ry * H - 1.5)}" fill="#f87171" font-size="${f1(H * .03)}" text-anchor="middle" font-weight="700">LUKA</text>`; }
    donors.forEach((d, i) => {
      const sh = SH[d.id]; if (!sh) return; const [view, fx, fy, rot, L0, W0] = sh; const L = d.dims ? d.dims[0] : L0, Wd = d.dims ? d.dims[1] : W0;
      const [cx, cy] = place(view, fx, fy, d.side || 'kanan'); const col = COL[i % COL.length]; const rotS = rot * sideSign(view, d.side || 'kanan') * -1 || rot;
      s += `<g transform="translate(${f1(cx)} ${f1(cy)}) rotate(${f1(rotS)})"><ellipse rx="${f1(L / 2)}" ry="${f1(Wd / 2)}" fill="${col}33" stroke="${col}" stroke-width="1.2"/></g>`;
      s += `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(H * .017)}" fill="${col}"/><text x="${f1(cx)}" y="${f1(cy + H * .008)}" fill="#04141a" font-size="${f1(H * .022)}" text-anchor="middle" font-weight="800">${d.n || i + 1}</text>`;
      s += `<text x="${f1(cx)}" y="${f1(cy + Wd / 2 + H * .028)}" fill="${col}" font-size="${f1(H * .024)}" text-anchor="middle" font-weight="700">${f1(L)}×${f1(Wd)} cm</text>`;
    });
    return s + '</svg>';
  }
  return { svg, SH, REC };
})();
