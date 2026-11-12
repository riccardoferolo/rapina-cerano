const PASSO = 0.5;
const VICINI = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
const GIRI_MASSIMI = 14000;

function creaMucchio() {
  const chiavi = [];
  const valori = [];
  return {
    get vuoto() { return chiavi.length === 0; },
    metti(p, v) {
      let i = chiavi.length;
      chiavi.push(p);
      valori.push(v);
      while (i > 0) {
        const padre = (i - 1) >> 1;
        if (chiavi[padre] <= chiavi[i]) break;
        [chiavi[padre], chiavi[i]] = [chiavi[i], chiavi[padre]];
        [valori[padre], valori[i]] = [valori[i], valori[padre]];
        i = padre;
      }
    },
    togli() {
      const v = valori[0];
      const ultimaC = chiavi.pop();
      const ultimoV = valori.pop();
      if (chiavi.length) {
        chiavi[0] = ultimaC;
        valori[0] = ultimoV;
        let i = 0;
        for (;;) {
          const a = 2 * i + 1;
          const b = a + 1;
          let m = i;
          if (a < chiavi.length && chiavi[a] < chiavi[m]) m = a;
          if (b < chiavi.length && chiavi[b] < chiavi[m]) m = b;
          if (m === i) break;
          [chiavi[m], chiavi[i]] = [chiavi[i], chiavi[m]];
          [valori[m], valori[i]] = [valori[i], valori[m]];
          i = m;
        }
      }
      return v;
    },
  };
}

export function creaNavigazione(collisioni, { x0, z0, x1, z1 }, { raggio = 0.32, passo = PASSO, filtro = null } = {}) {
  const nx = Math.ceil((x1 - x0) / passo);
  const nz = Math.ceil((z1 - z0) / passo);
  const bloccata = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = x0 + (i + 0.5) * passo;
      const z = z0 + (j + 0.5) * passo;
      const esito = collisioni.respingi(x, z, raggio, filtro);
      if (esito.urto) bloccata[j * nx + i] = 1;
    }
  }
  const indice = (x, z) => {
    const i = Math.floor((x - x0) / passo);
    const j = Math.floor((z - z0) / passo);
    if (i < 0 || j < 0 || i >= nx || j >= nz) return -1;
    return j * nx + i;
  };
  const centro = k => [x0 + ((k % nx) + 0.5) * passo, z0 + (Math.floor(k / nx) + 0.5) * passo];

  function libera(k) {
    if (k < 0) return -1;
    if (!bloccata[k]) return k;
    const ci = k % nx;
    const cj = Math.floor(k / nx);
    for (let r = 1; r < 6; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          const i = ci + di;
          const j = cj + dj;
          if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
          if (!bloccata[j * nx + i]) return j * nx + i;
        }
      }
    }
    return -1;
  }

  const g = new Float32Array(nx * nz);
  const da_ = new Int32Array(nx * nz);
  const visto = new Uint32Array(nx * nz);
  const chiuso = new Uint32Array(nx * nz);
  let giro = 0;
  function percorso(da, a, { liscia = true } = {}) {
    const s = libera(indice(da.x, da.z));
    const t = libera(indice(a.x, a.z));
    if (s < 0 || t < 0) return null;
    giro += 1;
    const [tx, tz] = centro(t);
    const h = k => {
      const [x, z] = centro(k);
      return Math.hypot(x - tx, z - tz) / passo;
    };
    const costoDi = q => (visto[q] === giro ? g[q] : Infinity);
    const mucchio = creaMucchio();
    mucchio.metti(h(s), s);
    g[s] = 0;
    da_[s] = -1;
    visto[s] = giro;
    let giri = 0;
    while (!mucchio.vuoto && giri++ < GIRI_MASSIMI) {
      const k = mucchio.togli();
      if (chiuso[k] === giro) continue;
      chiuso[k] = giro;
      if (k === t) break;
      const ci = k % nx;
      const cj = Math.floor(k / nx);
      for (const [di, dj, costo] of VICINI) {
        const i = ci + di;
        const j = cj + dj;
        if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
        const q = j * nx + i;
        if (bloccata[q] || chiuso[q] === giro) continue;
        if (di && dj && (bloccata[cj * nx + i] || bloccata[j * nx + ci])) continue;
        const ng = g[k] + costo;
        if (ng < costoDi(q)) {
          g[q] = ng;
          visto[q] = giro;
          da_[q] = k;
          mucchio.metti(ng + h(q), q);
        }
      }
    }
    if (chiuso[t] !== giro) return null;
    const celle = [];
    for (let k = t; k !== -1; k = da_[k]) celle.push(k);
    celle.reverse();
    const punti = celle.map(centro).map(([x, z]) => ({ x, z }));
    punti[punti.length - 1] = { x: a.x, z: a.z };
    if (!liscia) return punti;
    const lisci = [punti[0]];
    let i = 0;
    while (i < punti.length - 1) {
      let j = i + 1;
      while (j + 1 < punti.length && j - i < 40 && collisioni.libero(punti[i].x, punti[i].z, punti[j + 1].x, punti[j + 1].z, filtro)) j++;
      lisci.push(punti[j]);
      i = j;
    }
    return lisci;
  }

  return { percorso, indice, bloccata, nx, nz, passo, x0, z0, libera: (x, z) => indice(x, z) >= 0 && !bloccata[indice(x, z)] };
}
