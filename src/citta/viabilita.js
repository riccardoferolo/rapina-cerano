export const ALTEZZA_MARCIAPIEDE = 0.14;
const LATO_QUOTE = 8;
const RACCORDO = 0.3;
const CONTINUAZIONE = 0.92;
const TAGLIO_MASSIMO = 26;

export function cumulate(punti) {
  const c = [0];
  for (let i = 1; i < punti.length; i++) c.push(c[i - 1] + Math.hypot(punti[i][0] - punti[i - 1][0], punti[i][1] - punti[i - 1][1]));
  return c;
}

function tangente(punti, i) {
  const a = punti[Math.max(0, i - 1)];
  const b = punti[Math.min(punti.length - 1, i + 1)];
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
}

function unisci(intervalli) {
  const s = intervalli.filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
  const out = [];
  for (const [a, b] of s) {
    if (out.length && a <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], b);
    else out.push([a, b]);
  }
  return out;
}

function complemento(tagli, lungo, minimo = 0.8) {
  const pezzi = [];
  let inizio = 0;
  for (const [a, b] of unisci(tagli)) {
    if (a - inizio > minimo) pezzi.push([inizio, Math.min(a, lungo)]);
    inizio = Math.max(inizio, b);
  }
  if (lungo - inizio > minimo) pezzi.push([inizio, lungo]);
  return pezzi.filter(([a, b]) => b - a > minimo);
}

export function calcolaViabilita(strade) {
  const incroci = new Map();
  strade.forEach((s, si) => {
    s.k.forEach((k, i) => {
      if (!incroci.has(k)) incroci.set(k, []);
      incroci.get(k).push({ si, i });
    });
  });
  return strade.map((s, si) => {
    const cum = cumulate(s.p);
    const lungo = cum[cum.length - 1];
    const tagli = [[], []];
    const strisce = [];
    s.k.forEach((k, i) => {
      const altri = incroci.get(k).filter(o => o.si !== si || o.i !== i);
      if (!altri.length) return;
      const [tx, tz] = tangente(s.p, i);
      const nx = -tz;
      const nz = tx;
      const finale = i === 0 || i === s.p.length - 1;
      for (const o of altri) {
        const r = strade[o.si];
        if (!r.a && !r.pe && r.l < 3) continue;
        for (const j of [o.i - 1, o.i + 1]) {
          if (j < 0 || j >= r.p.length) continue;
          const dx = r.p[j][0] - r.p[o.i][0];
          const dz = r.p[j][1] - r.p[o.i][1];
          const dl = Math.hypot(dx, dz) || 1;
          const ux = dx / dl;
          const uz = dz / dl;
          const lungo_ = ux * tx + uz * tz;
          if (Math.abs(lungo_) > CONTINUAZIONE && !finale) continue;
          if (finale && Math.abs(lungo_) > CONTINUAZIONE && r.l <= s.l + 0.5) continue;
          const seno = Math.max(0.3, Math.sqrt(Math.max(0, 1 - lungo_ * lungo_)));
          const lato = ux * nx + uz * nz > 0 ? 0 : 1;
          const taglio = Math.min(TAGLIO_MASSIMO, (r.l / 2 + RACCORDO) / seno + (s.m[lato] ?? 0) * Math.abs(lungo_) / seno);
          const centro = cum[i] + lungo_ * 0;
          if (finale) {
            const a = i === 0 ? 0 : lungo - taglio;
            const b = i === 0 ? taglio : lungo;
            tagli[0].push([a, b]);
            tagli[1].push([a, b]);
          } else tagli[lato].push([centro - taglio, centro + taglio]);
          if (s.u && s.r >= 2 && r.a) strisce.push({ s: Math.max(0, Math.min(lungo, i === 0 ? taglio + 1.6 : i === s.p.length - 1 ? lungo - taglio - 1.6 : NaN)) });
        }
      }
    });
    const pezzi = [0, 1].map(lato => (s.m[lato] > 0 ? complemento(tagli[lato], lungo) : []));
    return { cum, lungo, pezzi, strisce: strisce.filter(x => Number.isFinite(x.s)) };
  });
}

export function puntoA(punti, cum, s) {
  let i = 1;
  while (i < cum.length - 1 && cum[i] < s) i++;
  const a = punti[i - 1];
  const b = punti[i];
  const l = cum[i] - cum[i - 1] || 1;
  const t = Math.max(0, Math.min(1, (s - cum[i - 1]) / l));
  const ux = (b[0] - a[0]) / l;
  const uz = (b[1] - a[1]) / l;
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, ux, uz, i };
}

export function lineaSpostata(punti, cum, s0, s1, offset) {
  const out = [];
  const inizio = puntoA(punti, cum, s0);
  out.push([inizio.x - inizio.uz * offset, inizio.z + inizio.ux * offset, s0]);
  for (let i = 1; i < punti.length - 1; i++) {
    if (cum[i] <= s0 || cum[i] >= s1) continue;
    const [px, pz] = punti[i - 1];
    const [cx, cz] = punti[i];
    const [qx, qz] = punti[i + 1];
    const l1 = Math.hypot(cx - px, cz - pz) || 1;
    const l2 = Math.hypot(qx - cx, qz - cz) || 1;
    const n1x = -(cz - pz) / l1;
    const n1z = (cx - px) / l1;
    const n2x = -(qz - cz) / l2;
    const n2z = (qx - cx) / l2;
    let mx = n1x + n2x;
    let mz = n1z + n2z;
    const lm = Math.hypot(mx, mz) || 1;
    mx /= lm;
    mz /= lm;
    const coseno = Math.max(0.4, mx * n1x + mz * n1z);
    out.push([cx + (mx * offset) / coseno, cz + (mz * offset) / coseno, cum[i]]);
  }
  const fine = puntoA(punti, cum, s1);
  out.push([fine.x - fine.uz * offset, fine.z + fine.ux * offset, s1]);
  return out;
}

export function creaQuote(strade, viabilita) {
  const celle = new Map();
  const chiave = (i, j) => i * 100003 + j;
  strade.forEach((s, si) => {
    const v = viabilita[si];
    [0, 1].forEach(lato => {
      const segno = lato === 0 ? 1 : -1;
      for (const [s0, s1] of v.pezzi[lato]) {
        const dentro = lineaSpostata(s.p, v.cum, s0, s1, (segno * s.l) / 2);
        const fuori = lineaSpostata(s.p, v.cum, s0, s1, segno * (s.l / 2 + s.m[lato]));
        for (let i = 1; i < dentro.length; i++) {
          const quad = [dentro[i - 1], dentro[i], fuori[i], fuori[i - 1]].map(p => [p[0], p[1]]);
          const xs = quad.map(p => p[0]);
          const zs = quad.map(p => p[1]);
          for (let a = Math.floor(Math.min(...xs) / LATO_QUOTE); a <= Math.floor(Math.max(...xs) / LATO_QUOTE); a++) {
            for (let b = Math.floor(Math.min(...zs) / LATO_QUOTE); b <= Math.floor(Math.max(...zs) / LATO_QUOTE); b++) {
              const k = chiave(a, b);
              if (!celle.has(k)) celle.set(k, []);
              celle.get(k).push(quad);
            }
          }
        }
      }
    });
  });
  const dentroQuad = (x, z, q) => {
    let segno = 0;
    for (let i = 0; i < 4; i++) {
      const [ax, az] = q[i];
      const [bx, bz] = q[(i + 1) % 4];
      const c = (bx - ax) * (z - az) - (bz - az) * (x - ax);
      if (Math.abs(c) < 1e-9) continue;
      const s = c > 0 ? 1 : -1;
      if (segno === 0) segno = s;
      else if (s !== segno) return false;
    }
    return true;
  };
  return function quota(x, z) {
    const cella = celle.get(chiave(Math.floor(x / LATO_QUOTE), Math.floor(z / LATO_QUOTE)));
    if (!cella) return 0;
    for (const q of cella) if (dentroQuad(x, z, q)) return ALTEZZA_MARCIAPIEDE;
    return 0;
  };
}
