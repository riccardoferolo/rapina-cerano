import { creaCollisioni } from './collisioni.js';
import { creaGrafo } from './strade.js';
import { calcolaViabilita, creaQuote } from './viabilita.js';
import { campionaLinea, puntoSegmento, scatola, dentro, baricentro } from './geometria.js';
import { calcolaParcheggi, cerchiParcheggio } from './parcheggi.js';
import { VEICOLI } from '../gioco/regole.js';

const RAGGIO_PALO = 0.14;
const RAGGIO_TRONCO = 0.3;
const ALBERI_COLLIDONO_ENTRO = 1300;

export async function caricaDati(url = './cerano/cerano.json') {
  const risposta = await fetch(url);
  if (!risposta.ok) throw new Error(`Non riesco a scaricare ${url}: ${risposta.status}`);
  return risposta.json();
}

function sponde(collisioni, dati) {
  const LATO = 20;
  const griglia = new Map();
  for (const s of dati.strade) {
    if (!s.a && !s.pe) continue;
    for (let i = 1; i < s.p.length; i++) {
      const [ax, az] = s.p[i - 1];
      const [bx, bz] = s.p[i];
      const seg = { ax, az, bx, bz, m: s.l / 2 + 2.5 };
      for (let a = Math.floor((Math.min(ax, bx) - 4) / LATO); a <= Math.floor((Math.max(ax, bx) + 4) / LATO); a++) {
        for (let b = Math.floor((Math.min(az, bz) - 4) / LATO); b <= Math.floor((Math.max(az, bz) + 4) / LATO); b++) {
          const k = a * 100003 + b;
          if (!griglia.has(k)) griglia.set(k, []);
          griglia.get(k).push(seg);
        }
      }
    }
  }
  const vicinoStrada = (x, z) => (griglia.get(Math.floor(x / LATO) * 100003 + Math.floor(z / LATO)) ?? [])
    .some(g => puntoSegmento(x, z, g.ax, g.az, g.bx, g.bz).d < g.m);
  for (const a of dati.acque) {
    if (a.l < 3 || a.g) continue;
    if (!a.p.some(([x, z]) => Math.hypot(x, z) < 2000)) continue;
    const campioni = campionaLinea(a.p, 2.5);
    for (const verso of [1, -1]) {
      let prima = null;
      for (const c of campioni) {
        const x = c.x - c.uz * (a.l / 2) * verso;
        const z = c.z + c.ux * (a.l / 2) * verso;
        if (vicinoStrada(c.x, c.z)) {
          prima = null;
          continue;
        }
        if (prima) collisioni.aggiungiSegmento(prima[0], prima[1], x, z, 'acqua');
        prima = [x, z];
      }
    }
  }
}

export function preparaCitta(dati, { esclusi = new Set() } = {}) {
  const collisioni = creaCollisioni();
  const edifici = dati.edifici.filter(e => !esclusi.has(e.id));
  for (const e of edifici) {
    e.scatola ??= scatola(e.p);
    if (e.u === 'tettoia') {
      for (const [x, z] of e.p) collisioni.aggiungiCerchio(x, z, 0.15, 'palo');
      continue;
    }
    collisioni.aggiungiAnello(e.p, 'muro', { edificio: e.id });
  }
  for (const [x, z, , muro] of dati.lampioni) if (!muro) collisioni.aggiungiCerchio(x, z, RAGGIO_PALO, 'palo');
  for (const [x, z, s] of dati.alberi) if (Math.hypot(x, z) < ALBERI_COLLIDONO_ENTRO) collisioni.aggiungiCerchio(x, z, RAGGIO_TRONCO * s, 'albero');
  sponde(collisioni, dati);
  const l = dati.limite;
  collisioni.aggiungiAnello([[-l, -l], [l, -l], [l, l], [-l, l]], 'confine');
  const viabilita = calcolaViabilita(dati.strade);
  const quota = creaQuote(dati.strade, viabilita);
  const parcheggi = calcolaParcheggi(dati, viabilita);
  for (const a of parcheggi) for (const c of cerchiParcheggio(a, VEICOLI[a.modello].lungo)) collisioni.aggiungiCerchio(c.x, c.z, c.r, 'auto');
  const grafo = creaGrafo(dati.strade);

  const grigliaEdifici = new Map();
  for (const e of dati.edifici) {
    const s = e.scatola ?? scatola(e.p);
    for (let i = Math.floor(s.x0 / 40); i <= Math.floor(s.x1 / 40); i++) {
      for (let j = Math.floor(s.z0 / 40); j <= Math.floor(s.z1 / 40); j++) {
        const k = i * 100003 + j;
        if (!grigliaEdifici.has(k)) grigliaEdifici.set(k, []);
        grigliaEdifici.get(k).push(e);
      }
    }
  }
  const edificioIn = (x, z) => (grigliaEdifici.get(Math.floor(x / 40) * 100003 + Math.floor(z / 40)) ?? []).find(e => dentro(x, z, e.p)) ?? null;

  function viaVicina(x, z) {
    const vicino = grafo.piuVicino(x, z, 120);
    if (!vicino) return null;
    const s = dati.strade[vicino.seg.strada];
    return s.n || null;
  }

  return {
    dati,
    collisioni,
    viabilita,
    parcheggi,
    quota,
    grafo,
    edificioIn,
    viaVicina,
    edificioPerId: id => dati.edifici.find(e => e.id === id) ?? null,
    centroEdificio: e => baricentro(e.p),
  };
}
