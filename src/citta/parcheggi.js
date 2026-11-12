import { puntoA } from './viabilita.js';
import { hashNumero } from './geometria.js';

const PASSO = 5.8;
const OCCUPAZIONE = 0.42;
const LARGHEZZA_MINIMA = 5.3;
const MODELLI = ['utilitaria', 'berlina'];
const COLORI = [0xe8e8e6, 0x1c1c1e, 0x8a8f96, 0x3a4a6a, 0x7a1f1f, 0xc9c2b0, 0x2f4a3a, 0x5a5f66, 0xb0b4b8, 0x203040];
export const RAGGIO_AUTO_PARCHEGGIATA = 0.86;

export function calcolaParcheggi(dati, viabilita, { evita = () => false } = {}) {
  const auto = [];
  dati.strade.forEach((s, si) => {
    if (!s.a || !s.u || s.l < LARGHEZZA_MINIMA || s.r < 2 || s.b || s.ro) return;
    const v = viabilita[si];
    const lato = hashNumero(si * 7 + 3) < 0.5 ? 0 : 1;
    for (const [s0, s1] of v.pezzi[lato]) {
      for (let pos = s0 + 3; pos < s1 - 3; pos += PASSO) {
        const h = hashNumero(si * 1000 + Math.round(pos * 10));
        if (h > OCCUPAZIONE) continue;
        const p = puntoA(s.p, v.cum, pos);
        const segno = lato === 0 ? 1 : -1;
        const off = segno * (s.l / 2 - 1.0);
        const x = p.x - p.uz * off;
        const z = p.z + p.ux * off;
        if (evita(x, z)) continue;
        const verso = hashNumero(si + Math.round(pos)) < 0.85 ? 1 : -1;
        const yaw = Math.atan2(-p.ux * verso * segno, -p.uz * verso * segno);
        auto.push({ x, z, yaw, modello: MODELLI[Math.floor(hashNumero(Math.round(x * 13 + z * 7)) * MODELLI.length)], colore: COLORI[Math.floor(h * 1000) % COLORI.length] });
      }
    }
  });
  return auto;
}

export function cerchiParcheggio(a, lungo) {
  const fx = -Math.sin(a.yaw);
  const fz = -Math.cos(a.yaw);
  const o = (lungo - 1.72) / 2;
  return [-o, 0, o].map(k => ({ x: a.x + fx * k, z: a.z + fz * k, r: RAGGIO_AUTO_PARCHEGGIATA }));
}
