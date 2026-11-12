import { ELENCO_RUOLI, ARMI } from '../gioco/regole.js';
import { COLPI } from '../gioco/colpi/indice.js';

const LETTERE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const NOME_MASSIMO = 16;
const ID_MASSIMO = 64;
const CHIAVE_MASSIMA = 48;
const ELENCO_MASSIMO = 400;
const COLPI_VALIDI = new Set(COLPI.map(c => c.id));

export function codiceStanza(caso = Math.random) {
  return Array.from({ length: 4 }, () => LETTERE[Math.floor(caso() * LETTERE.length)]).join('');
}

export function normalizzaCodice(testo) {
  const codice = String(testo ?? '').trim().toUpperCase();
  return /^[A-HJ-NP-Z]{4}$/.test(codice) ? codice : null;
}

export function pulisciNome(testo) {
  const nome = String(testo ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, NOME_MASSIMO);
  return nome || null;
}

const numero = x => typeof x === 'number' && Number.isFinite(x);
const testo = (x, massimo = ID_MASSIMO) => typeof x === 'string' && x.length > 0 && x.length <= massimo;
const elenco = (x, controllo, massimo = ELENCO_MASSIMO) => Array.isArray(x) && x.length <= massimo && x.every(controllo);
const tupla = (lunghezza, ...tipi) => x => Array.isArray(x) && x.length === lunghezza && x.every((v, i) => (tipi[i] ?? numero)(v));
const ruolo = x => ELENCO_RUOLI.includes(x);
const arma = x => typeof x === 'string' && Object.hasOwn(ARMI, x);
const colpo = x => x === null || COLPI_VALIDI.has(x) || (typeof x === 'string' && /^prep:[a-z]{3,16}$/.test(x));

function eGiocatore(g) {
  return !!g && typeof g === 'object' && testo(g.id) && typeof g.n === 'string' && g.n.length <= NOME_MASSIMO && ruolo(g.r)
    && [g.x, g.z, g.y, g.p, g.v, g.vm, g.s, g.m, g.au, g.po, g.c, g.co, g.fa, g.u, g.gb, g.tt, g.tp].every(numero)
    && elenco(g.k, numero, 2) && arma(g.a) && typeof g.uk === 'string' && g.uk.length <= CHIAVE_MASSIMA && elenco(g.ar, arma, 4);
}

function eVeicolo(v) {
  return !!v && typeof v === 'object' && [v.x, v.z, v.yaw, v.vx, v.vz, v.w, v.sterzo, v.vita].every(numero) && (v.gas === undefined || numero(v.gas));
}

function eIstantanea(i) {
  return !!i && typeof i === 'object' && numero(i.t) && ['rifugio', 'colpo', 'fine'].includes(i.f) && colpo(i.c)
    && elenco(i.g, eGiocatore, 4)
    && elenco(i.p, tupla(9))
    && elenco(i.v, tupla(13), 40)
    && elenco(i.k, tupla(7), 60)
    && elenco(i.tc, tupla(3), 20)
    && elenco(i.po, tupla(3, x => testo(x, 24), numero, numero), 30)
    && elenco(i.cf, tupla(4), 10)
    && elenco(i.bl, numero, 10) && elenco(i.ca, numero, 10) && elenco(i.vt, tupla(2), 30)
    && tupla(5)(i.al) && tupla(3)(i.fu) && tupla(7)(i.mi)
    && (i.es === null || (typeof i.es === 'object' && typeof i.es.vinto === 'boolean'));
}

const AZIONI = {
  usa: a => testo(a.chiave, CHIAVE_MASSIMA) && typeof a.attivo === 'boolean',
  maschera: () => true,
  lancia: a => a.pitch === undefined || numero(a.pitch),
  grida: () => true,
  colpo: a => numero(a.png) && numero(a.danno) && (a.mischia === undefined || typeof a.mischia === 'boolean') && (a.testa === undefined || typeof a.testa === 'boolean'),
  sparo: a => numero(a.yaw) && numero(a.pitch) && (a.arma === undefined || arma(a.arma)) && (a.telecamera === undefined || testo(a.telecamera, 24)),
  arma: a => arma(a.arma),
  taglia: () => true,
  scegli: a => a.colpo === 'rifugio' || colpo(a.colpo),
  compra: a => testo(a.voce, 32),
  potenzia: a => testo(a.voce, 40),
  ruolo: a => ruolo(a.ruolo),
  pronto: a => typeof a.attivo === 'boolean',
};

const CONTROLLI = {
  ciao: m => pulisciNome(m.nome) !== null && testo(m.id) && (m.ruolo === undefined || ruolo(m.ruolo)),
  lobby: m => pulisciNome(m.nomeHost) !== null && Array.isArray(m.giocatori) && m.giocatori.length <= 4
    && m.giocatori.every(g => g && typeof g.nome === 'string' && ruolo(g.ruolo) && typeof g.pronto === 'boolean')
    && (m.campagna === undefined || (!!m.campagna && typeof m.campagna === 'object')),
  inizia: m => numero(m.seme) && colpo(m.colpo) && (m.ora === undefined || ['giorno', 'tramonto', 'notte'].includes(m.ora)),
  g: m => [m.x, m.z, m.yaw, m.pitch, m.tp].every(numero) && (m.veicolo === undefined || eVeicolo(m.veicolo)),
  az: m => !!m.a && typeof m.a === 'object' && typeof m.a.tipo === 'string' && Object.hasOwn(AZIONI, m.a.tipo) && AZIONI[m.a.tipo](m.a),
  st: m => numero(m.g) && eIstantanea(m.ist),
  ev: m => Array.isArray(m.eventi) && m.eventi.length <= 200 && m.eventi.every(e => e && typeof e.k === 'string'),
  ping: m => numero(m.n),
  pong: m => numero(m.n),
};

export function valida(messaggio) {
  if (!messaggio || typeof messaggio !== 'object' || typeof messaggio.t !== 'string') return null;
  const controllo = CONTROLLI[messaggio.t];
  return controllo && controllo(messaggio) ? messaggio : null;
}

export const azioneValida = a => !!a && typeof a === 'object' && Object.hasOwn(AZIONI, a.tipo) && AZIONI[a.tipo](a);
