import { ARMI, COLTELLO } from './regole.js';

const FATTORE_LAMPO = 0.5;
const CAMBIO_ARMA = 0.35;

const nuovaArma = tipo => ({ tipo, caricatore: ARMI[tipo].caricatore, riserva: ARMI[tipo].riserva });

export function creaArsenale(pistola = 'pistola') {
  return { armi: [nuovaArma(pistola)], attiva: 0, attesa: 0, ricarica: 0, ricaricaTotale: 0, daCaricare: 0, cambio: 0, coltello: 0 };
}

export const armaAttiva = a => a.armi[a.attiva];
export const occupato = a => a.ricarica > 0 || a.cambio > 0 || a.coltello > 0;

export function aggiorna(a, dt) {
  a.attesa = Math.max(0, a.attesa - dt);
  a.cambio = Math.max(0, a.cambio - dt);
  a.coltello = Math.max(0, a.coltello - dt);
  if (a.ricarica <= 0) return false;
  a.ricarica -= dt;
  if (a.ricarica > 0) return false;
  a.ricarica = 0;
  const arma = armaAttiva(a);
  const servono = ARMI[arma.tipo].caricatore - arma.caricatore;
  const prese = Math.min(servono, arma.riserva);
  arma.caricatore += prese;
  arma.riserva -= prese;
  return true;
}

export function spara(a, bevande = []) {
  const arma = armaAttiva(a);
  if (occupato(a) || a.attesa > 0 || arma.caricatore <= 0) return null;
  arma.caricatore -= 1;
  a.attesa = ARMI[arma.tipo].cadenza;
  return ARMI[arma.tipo];
}

export function ricarica(a, bevande = []) {
  const arma = armaAttiva(a);
  if (occupato(a) || arma.riserva <= 0 || arma.caricatore >= ARMI[arma.tipo].caricatore) return false;
  a.ricarica = ARMI[arma.tipo].ricarica;
  a.ricaricaTotale = a.ricarica;
  a.daCaricare = Math.min(ARMI[arma.tipo].caricatore - arma.caricatore, arma.riserva);
  return true;
}

export function coltellata(a) {
  if (a.coltello > 0 || a.cambio > 0) return false;
  a.ricarica = 0;
  a.coltello = COLTELLO.attesa;
  return true;
}

export function cambia(a, indice = (a.attiva + 1) % a.armi.length) {
  if (indice === a.attiva || !a.armi[indice]) return false;
  a.attiva = indice;
  a.ricarica = 0;
  a.cambio = CAMBIO_ARMA;
  return true;
}

export function allinea(a, armiHost, armaNuova = null) {
  const attivaPrima = armaAttiva(a)?.tipo;
  const vecchie = new Map(a.armi.map(x => [x.tipo, x]));
  a.armi = armiHost.map(tipo => (tipo === armaNuova ? nuovaArma(tipo) : vecchie.get(tipo) ?? nuovaArma(tipo)));
  a.attiva = Math.max(0, a.armi.findIndex(x => x.tipo === (armaNuova ?? attivaPrima)));
  if (!armaNuova) return;
  a.cambio = CAMBIO_ARMA;
  a.ricarica = 0;
}

export function bevi(a, durata) {
  a.ricarica = 0;
  a.cambio = Math.max(a.cambio, durata);
}

export function riempi(a, tipo) {
  const arma = a.armi.find(x => x.tipo === tipo);
  if (arma) Object.assign(arma, nuovaArma(tipo));
}

export function azzera(a, pistola) {
  Object.assign(a, creaArsenale(pistola));
}
