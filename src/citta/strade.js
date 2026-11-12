import { puntoSegmento } from './geometria.js';

const LATO_GRIGLIA = 40;

export function creaGrafo(strade) {
  const nodi = new Map();
  const nodo = (k, x, z) => {
    let n = nodi.get(k);
    if (!n) {
      n = { k, x, z, archi: [] };
      nodi.set(k, n);
    }
    return n;
  };
  const segmenti = [];
  strade.forEach((s, indice) => {
    if (!s.a) return;
    for (let i = 1; i < s.p.length; i++) {
      const a = nodo(s.k[i - 1], s.p[i - 1][0], s.p[i - 1][1]);
      const b = nodo(s.k[i], s.p[i][0], s.p[i][1]);
      const lungo = Math.hypot(b.x - a.x, b.z - a.z);
      if (lungo < 0.01) continue;
      const costo = lungo * (s.s ? 1.8 : 1) / (1 + s.r * 0.15);
      a.archi.push({ verso: b, lungo, costo, strada: indice });
      b.archi.push({ verso: a, lungo, costo, strada: indice });
      segmenti.push({ a, b, strada: indice, largo: s.l });
    }
  });
  const griglia = new Map();
  const chiave = (i, j) => i * 100003 + j;
  for (const seg of segmenti) {
    const x0 = Math.floor(Math.min(seg.a.x, seg.b.x) / LATO_GRIGLIA);
    const x1 = Math.floor(Math.max(seg.a.x, seg.b.x) / LATO_GRIGLIA);
    const z0 = Math.floor(Math.min(seg.a.z, seg.b.z) / LATO_GRIGLIA);
    const z1 = Math.floor(Math.max(seg.a.z, seg.b.z) / LATO_GRIGLIA);
    for (let i = x0; i <= x1; i++) {
      for (let j = z0; j <= z1; j++) {
        const k = chiave(i, j);
        if (!griglia.has(k)) griglia.set(k, []);
        griglia.get(k).push(seg);
      }
    }
  }

  function piuVicino(x, z, raggioMassimo = 400) {
    const ci = Math.floor(x / LATO_GRIGLIA);
    const cj = Math.floor(z / LATO_GRIGLIA);
    let migliore = null;
    for (let r = 0; r * LATO_GRIGLIA <= raggioMassimo; r++) {
      for (let i = ci - r; i <= ci + r; i++) {
        for (let j = cj - r; j <= cj + r; j++) {
          if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue;
          for (const seg of griglia.get(chiave(i, j)) ?? []) {
            const q = puntoSegmento(x, z, seg.a.x, seg.a.z, seg.b.x, seg.b.z);
            if (!migliore || q.d < migliore.d) migliore = { ...q, seg };
          }
        }
      }
      if (migliore && migliore.d < r * LATO_GRIGLIA) break;
    }
    return migliore;
  }

  function percorso(da, a) {
    const inizio = piuVicino(da.x, da.z);
    const fine = piuVicino(a.x, a.z);
    if (!inizio || !fine) return null;
    const partenze = [inizio.seg.a, inizio.seg.b];
    const arrivi = new Set([fine.seg.a, fine.seg.b]);
    const g = new Map();
    const da_ = new Map();
    const aperti = [];
    const h = n => Math.hypot(n.x - fine.x, n.z - fine.z) * 0.7;
    for (const p of partenze) {
      const c = Math.hypot(p.x - inizio.x, p.z - inizio.z);
      g.set(p, c);
      aperti.push({ n: p, f: c + h(p) });
    }
    let trovato = null;
    let giri = 0;
    while (aperti.length && giri++ < 60000) {
      let im = 0;
      for (let i = 1; i < aperti.length; i++) if (aperti[i].f < aperti[im].f) im = i;
      const { n, f } = aperti[im];
      aperti[im] = aperti[aperti.length - 1];
      aperti.pop();
      if (f - h(n) > g.get(n) + 1e-6) continue;
      if (arrivi.has(n)) {
        trovato = n;
        break;
      }
      for (const arco of n.archi) {
        const ng = g.get(n) + arco.costo;
        if (ng < (g.get(arco.verso) ?? Infinity)) {
          g.set(arco.verso, ng);
          da_.set(arco.verso, n);
          aperti.push({ n: arco.verso, f: ng + h(arco.verso) });
        }
      }
    }
    if (!trovato) return null;
    const punti = [];
    for (let n = trovato; n; n = da_.get(n)) punti.push({ x: n.x, z: n.z });
    punti.reverse();
    punti.unshift({ x: inizio.x, z: inizio.z });
    punti.push({ x: fine.x, z: fine.z });
    return punti;
  }

  return { nodi, segmenti, piuVicino, percorso };
}

export function lunghezzaPercorso(punti) {
  let l = 0;
  for (let i = 1; i < punti.length; i++) l += Math.hypot(punti[i].x - punti[i - 1].x, punti[i].z - punti[i - 1].z);
  return l;
}

export function puntoAvanti(punti, x, z, avanti) {
  let migliore = { d: Infinity, i: 0, t: 0 };
  for (let i = 1; i < punti.length; i++) {
    const q = puntoSegmento(x, z, punti[i - 1].x, punti[i - 1].z, punti[i].x, punti[i].z);
    if (q.d < migliore.d) migliore = { d: q.d, i, t: q.t, x: q.x, z: q.z };
  }
  let resto = avanti;
  let px = migliore.x ?? punti[0].x;
  let pz = migliore.z ?? punti[0].z;
  for (let i = Math.max(1, migliore.i); i < punti.length; i++) {
    const bx = punti[i].x;
    const bz = punti[i].z;
    const l = Math.hypot(bx - px, bz - pz);
    if (l >= resto) return { x: px + ((bx - px) * resto) / l, z: pz + ((bz - pz) * resto) / l, indice: i, distanza: migliore.d };
    resto -= l;
    px = bx;
    pz = bz;
  }
  const ultimo = punti[punti.length - 1];
  return { x: ultimo.x, z: ultimo.z, indice: punti.length - 1, distanza: migliore.d, fine: true };
}
