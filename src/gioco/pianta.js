import { larghezzaMinima, baricentro, puntoSegmento } from '../citta/geometria.js';

const SPESSORE = 0.2;
const MARGINE_PORTA = 0.05;

export function cornice(citta, idEdificio, { larghezza, profondita, manuale = null } = {}) {
  const e = citta.edificioPerId(idEdificio);
  if (!e) throw new Error(`Edificio ${idEdificio} non trovato nei dati di Cerano`);
  if (manuale) {
    const { ox, oz, ux, uz, vx, vz, lato, prof } = manuale;
    return { ox, oz, ux, uz, vx, vz, W: larghezza ?? lato, D: profondita ?? prof, latoReale: lato, profReale: prof, altezza: e.h, edificio: e };
  }
  const { angolo, lungo, largo } = larghezzaMinima(e.p);
  const [cx, cz] = baricentro(e.p);
  const ax = [Math.cos(angolo), Math.sin(angolo)];
  const az = [-Math.sin(angolo), Math.cos(angolo)];
  const candidati = [
    { n: [-az[0], -az[1]], lato: lungo, prof: largo },
    { n: [az[0], az[1]], lato: lungo, prof: largo },
    { n: [-ax[0], -ax[1]], lato: largo, prof: lungo },
    { n: [ax[0], ax[1]], lato: largo, prof: lungo },
  ];
  let migliore = null;
  for (const c of candidati) {
    const fuoriX = cx + c.n[0] * (c.prof / 2 + 3);
    const fuoriZ = cz + c.n[1] * (c.prof / 2 + 3);
    const v = citta.grafo.piuVicino(fuoriX, fuoriZ, 60);
    const punteggio = v ? v.d - c.lato * 0.15 : 99;
    if (!migliore || punteggio < migliore.punteggio) migliore = { ...c, punteggio };
  }
  const W = larghezza ?? migliore.lato;
  const D = profondita ?? migliore.prof;
  const vx = -migliore.n[0];
  const vz = -migliore.n[1];
  const ux = -vz;
  const uz = vx;
  const fx = cx + migliore.n[0] * (migliore.prof / 2);
  const fz = cz + migliore.n[1] * (migliore.prof / 2);
  const ox = fx - ux * (migliore.lato / 2);
  const oz = fz - uz * (migliore.lato / 2);
  return { ox, oz, ux, uz, vx, vz, W, D, latoReale: migliore.lato, profReale: migliore.prof, altezza: e.h, edificio: e };
}

export const aMondo = (c, u, v) => [c.ox + c.ux * u + c.vx * v, c.oz + c.uz * u + c.vz * v];
export const daMondo = (c, x, z) => [(x - c.ox) * c.ux + (z - c.oz) * c.uz, (x - c.ox) * c.vx + (z - c.oz) * c.vz];
export const angoloMondo = (c, verso) => Math.atan2(-(c.ux * Math.sin(verso) + c.vx * Math.cos(verso)), -(c.uz * Math.sin(verso) + c.vz * Math.cos(verso)));
export const direzioneMondo = (c, du, dv) => [c.ux * du + c.vx * dv, c.uz * du + c.vz * dv];

export function pezziMuro(muro, porte) {
  const [u0, v0, u1, v1] = muro;
  const l = Math.hypot(u1 - u0, v1 - v0);
  const du = (u1 - u0) / l;
  const dv = (v1 - v0) / l;
  const buchi = [];
  for (const p of porte) {
    const q = puntoSegmento(p.u, p.v, u0, v0, u1, v1);
    if (q.d > SPESSORE) continue;
    const s = q.t * l;
    buchi.push([s - p.largo / 2 - MARGINE_PORTA, s + p.largo / 2 + MARGINE_PORTA, p]);
  }
  buchi.sort((a, b) => a[0] - b[0]);
  const pieni = [];
  let s = 0;
  for (const [a, b] of buchi) {
    if (a > s + 0.01) pieni.push([s, a]);
    s = Math.max(s, b);
  }
  if (l > s + 0.01) pieni.push([s, l]);
  return {
    pieni: pieni.map(([a, b]) => [u0 + du * a, v0 + dv * a, u0 + du * b, v0 + dv * b]),
    buchi: buchi.map(([a, b, p]) => ({ porta: p, da: [u0 + du * a, v0 + dv * a], a: [u0 + du * b, v0 + dv * b] })),
  };
}

export function muriPianta(pianta) {
  const perimetro = [
    [0, 0, pianta.W, 0],
    [pianta.W, 0, pianta.W, pianta.D],
    [pianta.W, pianta.D, 0, pianta.D],
    [0, pianta.D, 0, 0],
  ];
  return [...perimetro.map(m => ({ m, esterno: true })), ...pianta.muri.map(m => ({ m, esterno: false }))];
}

export function zonaDi(pianta, u, v) {
  return pianta.stanze.find(s => u >= s.u0 && u <= s.u1 && v >= s.v0 && v <= s.v1) ?? null;
}
