import { creaVeicolo, velocita } from './veicoli.js';
import { PNG } from './regole.js';
import { aspettoDi } from './aspetto.js';

const LATO_CELLA = 100;
const PASSANTI_PER_GIOCATORE = 7;
const PASSANTI_MASSIMI = 22;
const TRAFFICO_PER_GIOCATORE = 4;
const TRAFFICO_MASSIMO = 12;
const COMPARSA = Object.freeze([45, 130]);
const SPARIZIONE = 180;
const MARCIAPIEDE = 1.15;
const CORSIA = 1.55;
const LIMITE_CITTA = 11;
const CONTROLLA_OGNI = 0.5;
const TIPI_TRAFFICO = Object.freeze(['utilitaria', 'utilitaria', 'utilitaria', 'berlina', 'berlina', 'furgone']);
const COLORI_TRAFFICO = Object.freeze([0xd8d4cc, 0x1c1c1e, 0x6f747a, 0x2d3a4a, 0x8a1f1f, 0x3a5a3a, 0xc8b089, 0x234a7a, 0x9aa3ad]);
const ASPETTI_PASSANTI = Object.freeze(['civile', 'civile2', 'civile3', 'anziano', 'ragazza']);
const NOMI_PASSANTI = Object.freeze(['Un passante', 'Una signora', 'Un signore', 'Una ragazza', 'Un ragazzo']);

/** Prepara i percorsi sui marciapiedi e la griglia per far comparire passanti e traffico vicino ai giocatori. */
export function preparaVita(citta) {
  const linee = [];
  const celle = new Map();
  const chiave = (x, z) => `${Math.floor(x / LATO_CELLA)},${Math.floor(z / LATO_CELLA)}`;
  for (const s of citta.dati.strade) {
    if (!s.a || s.s || s.b || s.l < 4 || s.p.length < 2) continue;
    for (const lato of [1, -1]) {
      const punti = [];
      for (let i = 0; i < s.p.length; i++) {
        const [ax, az] = s.p[Math.max(0, i - 1)];
        const [bx, bz] = s.p[Math.min(s.p.length - 1, i + 1)];
        const l = Math.hypot(bx - ax, bz - az) || 1;
        const o = (s.l / 2 + MARCIAPIEDE) * lato;
        punti.push({ x: s.p[i][0] - ((bz - az) / l) * o, z: s.p[i][1] + ((bx - ax) / l) * o });
      }
      const linea = { punti };
      linee.push(linea);
      for (const p of punti) {
        const k = chiave(p.x, p.z);
        if (!celle.has(k)) celle.set(k, []);
        if (!celle.get(k).includes(linea)) celle.get(k).push(linea);
      }
    }
  }
  const nodi = [...citta.grafo.nodi.values()].filter(n => n.archi.length >= 1);
  return {
    vicine(x, z) {
      const elenco = [];
      const ci = Math.floor(x / LATO_CELLA);
      const cj = Math.floor(z / LATO_CELLA);
      for (let i = ci - 2; i <= ci + 2; i++) for (let j = cj - 2; j <= cj + 2; j++) for (const l of celle.get(`${i},${j}`) ?? []) elenco.push(l);
      return elenco;
    },
    nodi,
  };
}

function corsiaDestra(percorso) {
  return percorso.map((p, i) => {
    const a = percorso[Math.max(0, i - 1)];
    const b = percorso[Math.min(percorso.length - 1, i + 1)];
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return { x: p.x - ((b.z - a.z) / l) * CORSIA, z: p.z + ((b.x - a.x) / l) * CORSIA };
  });
}

const vicinoAiGiocatori = (stato, x, z, raggio) => stato.giocatori.some(g => Math.hypot(g.x - x, g.z - z) < raggio);

function nuovoPassante(stato, amb, caso) {
  const g = stato.giocatori[Math.floor(caso() * stato.giocatori.length)];
  if (!g) return;
  const linee = amb.vita.vicine(g.x, g.z);
  for (let prova = 0; prova < 8 && linee.length; prova++) {
    const linea = linee[Math.floor(caso() * linee.length)];
    const i = Math.floor(caso() * linea.punti.length);
    const p = linea.punti[i];
    const d = Math.hypot(p.x - g.x, p.z - g.z);
    if (d < COMPARSA[0] || d > COMPARSA[1] || vicinoAiGiocatori(stato, p.x, p.z, COMPARSA[0] * 0.8)) continue;
    if (amb.citta.collisioni.respingi(p.x, p.z, 0.4).urto) continue;
    const avanti = caso() < 0.5;
    const tratto = avanti ? linea.punti.slice(i) : linea.punti.slice(0, i + 1).reverse();
    if (tratto.length < 2) continue;
    const giro = [...tratto, ...tratto.slice(1, -1).reverse()].map(q => ({ x: q.x, z: q.z, sosta: 0.2 }));
    const fine = tratto[tratto.length - 1];
    const k = Math.floor(caso() * ASPETTI_PASSANTI.length);
    stato.png.push({
      id: stato.prossimoId++, tipo: 'civile', nome: NOMI_PASSANTI[k], passante: true, aspetto: aspettoDi({ aspetto: ASPETTI_PASSANTI[k] }), x: p.x, z: p.z, yaw: 0, vita: PNG.civile.vita,
      stato: 'giro', sospetto: 0, giro, tappa: 1, sosta: 0, timer: 0, punto: null, bersaglio: null, attesaVista: caso() * 0.12, attesaSparo: 1,
      uscita: [fine.x, fine.z], visto: null, motivo: null, percorso: null, ip: 0, tessera: false, indice: stato.prossimoId,
    });
    return;
  }
}

function nuovoTraffico(stato, amb, caso) {
  const g = stato.giocatori[Math.floor(caso() * stato.giocatori.length)];
  if (!g) return;
  const nodi = amb.vita.nodi;
  let calcolati = 0;
  for (let prova = 0; prova < 24 && calcolati < 1; prova++) {
    const n = nodi[Math.floor(caso() * nodi.length)];
    const d = Math.hypot(n.x - g.x, n.z - g.z);
    if (d < 60 || d > 150 || vicinoAiGiocatori(stato, n.x, n.z, 50)) continue;
    if (stato.veicoli.some(v => Math.hypot(v.x - n.x, v.z - n.z) < 14)) continue;
    const meta = nodi[Math.floor(caso() * nodi.length)];
    if (Math.hypot(meta.x - n.x, meta.z - n.z) < 150 || Math.hypot(meta.x - n.x, meta.z - n.z) > 600) continue;
    calcolati += 1;
    const grezzo = amb.citta.grafo.percorso({ x: n.x, z: n.z }, { x: meta.x, z: meta.z });
    if (!grezzo || grezzo.length < 3) continue;
    const percorso = corsiaDestra(grezzo);
    const a = percorso[0];
    const b = percorso[1];
    const tipo = TIPI_TRAFFICO[Math.floor(caso() * TIPI_TRAFFICO.length)];
    stato.veicoli.push(creaVeicolo(stato.prossimoId++, tipo, a.x, a.z, Math.atan2(-(b.x - a.x), -(b.z - a.z)), {
      traffico: true, percorso, meta: [meta.x, meta.z], acceso: true, limite: LIMITE_CITTA, colore: COLORI_TRAFFICO[Math.floor(caso() * COLORI_TRAFFICO.length)],
    }));
    return;
  }
}

/** Fa vivere la città intorno ai giocatori: compaiono e spariscono passanti e auto, il traffico gira per le vie. */
export function aggiornaVita(stato, amb, dt, caso, guidaAI) {
  if (!amb.vita || !stato.giocatori.length) return;
  stato.percorsiTraffico = 0;
  for (const v of stato.veicoli) {
    if (!v.traffico) continue;
    if (v.percorso && v.vita > 0) {
      const fine = v.percorso[v.percorso.length - 1];
      if (Math.hypot(fine.x - v.x, fine.z - v.z) < 8 && (stato.percorsiTraffico ?? 0) < 1) {
        stato.percorsiTraffico = (stato.percorsiTraffico ?? 0) + 1;
        const meta = amb.vita.nodi[Math.floor(caso() * amb.vita.nodi.length)];
        const grezzo = amb.citta.grafo.percorso({ x: v.x, z: v.z }, { x: meta.x, z: meta.z });
        v.percorso = grezzo && grezzo.length > 1 ? corsiaDestra(grezzo) : null;
        v.meta = [meta.x, meta.z];
      }
    }
    guidaAI(stato, amb, v, dt);
  }
  stato.controlloVita = (stato.controlloVita ?? 0) - dt;
  if (stato.controlloVita > 0) return;
  stato.controlloVita = CONTROLLA_OGNI;
  const lontano = o => !vicinoAiGiocatori(stato, o.x, o.z, SPARIZIONE);
  stato.png = stato.png.filter(p => !p.passante || (!lontano(p) && p.stato !== 'fuggito'));
  const sirene = stato.veicoli.filter(v => v.polizia && v.sirena);
  const intralcia = v => sirene.some(p => Math.hypot(p.x - v.x, p.z - v.z) < 40) && !vicinoAiGiocatori(stato, v.x, v.z, 35);
  stato.veicoli = stato.veicoli.filter(v => !v.traffico || v.posti.some(Boolean) || (!lontano(v) && !intralcia(v)));
  const passanti = stato.png.filter(p => p.passante).length;
  const traffico = stato.veicoli.filter(v => v.traffico).length;
  const n = stato.giocatori.length;
  if (passanti < Math.min(PASSANTI_MASSIMI, PASSANTI_PER_GIOCATORE * n)) nuovoPassante(stato, amb, caso);
  if (traffico < Math.min(TRAFFICO_MASSIMO, TRAFFICO_PER_GIOCATORE * n)) nuovoTraffico(stato, amb, caso);
}

/** Un'auto del traffico ferma diventa tua: l'autista scappa urlando. */
export function rubaDalTraffico(stato, v) {
  if (!v.traffico || velocita(v) > 2.5) return false;
  v.traffico = false;
  v.libera = true;
  v.percorso = null;
  v.rubata = true;
  return true;
}
