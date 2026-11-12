import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dentro, scatola } from '../src/citta/geometria.js';

const FILE = fileURLToPath(new URL('./bdtre/volumi-cerano.json', import.meta.url));
const LATO_CELLA = 25;
const COPERTURA_MINIMA = 0.3;
const SEGNAPOSTO = 3;
const CAMPIONI_MASSIMI = 220;

const A = 6378137;
const F = 1 / 298.257223563;
const K0 = 0.9996;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const E1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));

/** Converte coordinate UTM fuso 32 nord (EPSG:32632) in latitudine e longitudine WGS84, in gradi. */
export function utm32InGradi(est, nord) {
  const x = est - 500000;
  const mu = nord / K0 / (A * (1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256));
  const phi1 = mu + ((3 * E1) / 2 - (27 * E1 ** 3) / 32) * Math.sin(2 * mu) + ((21 * E1 ** 2) / 16 - (55 * E1 ** 4) / 32) * Math.sin(4 * mu)
    + ((151 * E1 ** 3) / 96) * Math.sin(6 * mu) + ((1097 * E1 ** 4) / 512) * Math.sin(8 * mu);
  const s = Math.sin(phi1);
  const c = Math.cos(phi1);
  const t1 = Math.tan(phi1) ** 2;
  const c1 = EP2 * c ** 2;
  const n1 = A / Math.sqrt(1 - E2 * s ** 2);
  const r1 = (A * (1 - E2)) / (1 - E2 * s ** 2) ** 1.5;
  const d = x / (n1 * K0);
  const lat = phi1 - ((n1 * Math.tan(phi1)) / r1) * (d ** 2 / 2 - ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * EP2) * d ** 4) / 24
    + ((61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * EP2 - 3 * c1 ** 2) * d ** 6) / 720);
  const lon0 = (9 * Math.PI) / 180;
  const lon = lon0 + (d - ((1 + 2 * t1 + c1) * d ** 3) / 6 + ((5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * EP2 + 24 * t1 ** 2) * d ** 5) / 120) / c;
  return [(lat * 180) / Math.PI, (lon * 180) / Math.PI];
}

/**
 * Carica i volumi BDTRE di Cerano nel sistema locale del gioco e restituisce `altezzaReale(anello, bassoAmmesso)`:
 * la media delle altezze dei volumi che coprono l'impronta (pesata sulla superficie coperta), oppure null
 * se meno del 30% dell'impronta ha un'altezza misurata. I 3 m sono il valore di ripiego di ARPA: valgono
 * solo per edifici bassi (box, tettoie), altrove si considerano assenti.
 */
export function caricaAltezze(proietta) {
  const dati = JSON.parse(readFileSync(FILE, 'utf8'));
  const volumi = dati.volumi.map(([h, anello]) => {
    const locale = anello.map(([e, n]) => proietta(...utm32InGradi(e, n)));
    return { h, anello: locale, s: scatola(locale) };
  });
  const celle = new Map();
  const chiave = (i, j) => `${i},${j}`;
  for (const v of volumi) {
    for (let i = Math.floor(v.s.x0 / LATO_CELLA); i <= Math.floor(v.s.x1 / LATO_CELLA); i++) {
      for (let j = Math.floor(v.s.z0 / LATO_CELLA); j <= Math.floor(v.s.z1 / LATO_CELLA); j++) {
        const k = chiave(i, j);
        if (!celle.has(k)) celle.set(k, []);
        celle.get(k).push(v);
      }
    }
  }
  const volumeIn = (x, z) => {
    for (const v of celle.get(chiave(Math.floor(x / LATO_CELLA), Math.floor(z / LATO_CELLA))) ?? []) {
      if (x >= v.s.x0 && x <= v.s.x1 && z >= v.s.z0 && z <= v.s.z1 && dentro(x, z, v.anello)) return v;
    }
    return null;
  };
  const statistiche = { volumi: volumi.length, misurati: 0, ripiego: 0 };
  return {
    statistiche,
    altezzaReale(anello, bassoAmmesso) {
      const s = scatola(anello);
      const area = (s.x1 - s.x0) * (s.z1 - s.z0);
      const passo = Math.max(0.6, Math.sqrt(area / CAMPIONI_MASSIMI));
      let campioni = 0;
      let pesati = 0;
      let somma = 0;
      for (let x = s.x0 + passo / 2; x < s.x1; x += passo) {
        for (let z = s.z0 + passo / 2; z < s.z1; z += passo) {
          if (!dentro(x, z, anello)) continue;
          campioni += 1;
          const v = volumeIn(x, z);
          if (!v || v.h === null || v.h <= 0) continue;
          if (v.h <= SEGNAPOSTO && !bassoAmmesso) continue;
          pesati += 1;
          somma += v.h;
        }
      }
      if (!campioni || pesati / campioni < COPERTURA_MINIMA) {
        statistiche.ripiego += 1;
        return null;
      }
      statistiche.misurati += 1;
      return somma / pesati;
    },
  };
}
