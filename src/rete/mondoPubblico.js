import { apriSegnali } from './segnali.js';
import { collega, collegaHost } from './collegamento.js';

export const GIOCATORI_PER_MONDO = 8;
export const MONDI_MASSIMI = 6;
const ASCOLTO_MS = 2600;
const FARO_OGNI_MS = 1200;
const HOST_PERSO_MS = 6000;
const CONFLITTO_MS = 4000;

const nomeMondo = n => `mondo-${n}`;

/**
 * Entra nella Cerano pubblica senza lobby. Ascolta il «faro» dell'host del mondo 1; se nessuno risponde
 * diventa host, se il mondo è pieno passa al 2 e così via. Se l'host sparisce, il giocatore con l'id più
 * basso fra quelli rimasti prende il suo posto e gli altri si ricollegano da soli.
 *
 * `suRuolo(ruolo, coll)` viene chiamata ogni volta che si diventa host o ospite con il collegamento nuovo.
 */
export function entraNelMondo({ mioId, locale = false, soloRiserva = false, suRuolo, suStato = () => {}, giocatoriNoti = () => [] }) {
  let numero = 1;
  let segnali = null;
  let coll = null;
  let ruolo = 'ascolto';
  let ultimoFaro = 0;
  let idHost = null;
  let faro = null;
  let controllo = null;
  let attesa = null;
  let chiuso = false;
  let quanti = 1;

  const stato = testo => suStato({ ruolo, mondo: numero, testo });

  function pulisci() {
    clearInterval(faro);
    clearInterval(controllo);
    clearTimeout(attesa);
    coll?.chiudiConnessione?.();
    coll = null;
  }

  function apri(n) {
    pulisci();
    segnali?.chiudi();
    numero = n;
    segnali = apriSegnali(nomeMondo(n), { locale });
    segnali.suMessaggio(suSegnale);
    ascolta();
  }

  function ascolta(ritardo = 0) {
    ruolo = 'ascolto';
    idHost = null;
    stato(`Cerco Cerano ${numero}…`);
    segnali.invia({ tipo: 'chi', da: mioId });
    attesa = setTimeout(() => {
      if (ruolo === 'ascolto' && !chiuso) diventaHost();
    }, ASCOLTO_MS + ritardo + Math.random() * 600);
  }

  function diventaHost() {
    pulisci();
    ruolo = 'host';
    idHost = mioId;
    coll = collegaHost({ segnali, mioId, soloRiserva, massimo: GIOCATORI_PER_MONDO - 1 });
    const manda = () => segnali.invia({ tipo: 'faro', da: mioId, n: quanti, t: Date.now() }, { scartabile: true });
    manda();
    faro = setInterval(manda, FARO_OGNI_MS);
    stato(`Cerano ${numero}`);
    suRuolo('host', coll, numero);
  }

  function diventaOspite(host) {
    pulisci();
    ruolo = 'ospite';
    idHost = host;
    ultimoFaro = performance.now();
    coll = collega({ segnali, sonoHost: false, mioId, soloRiserva });
    controllo = setInterval(controllaHost, 1000);
    stato(`Cerano ${numero}`);
    suRuolo('ospite', coll, numero);
  }

  function controllaHost() {
    if (ruolo !== 'ospite' || performance.now() - ultimoFaro < HOST_PERSO_MS) return;
    const rimasti = giocatoriNoti().filter(id => id !== idHost).sort();
    const primo = !rimasti.length || rimasti[0] === mioId;
    pulisci();
    ascolta(primo ? 0 : ASCOLTO_MS);
  }

  function suSegnale(msg) {
    if (!msg || typeof msg !== 'object' || msg.da === mioId || chiuso) return;
    if (msg.tipo === 'chi' && ruolo === 'host') {
      segnali.invia({ tipo: 'faro', da: mioId, n: quanti, t: Date.now() }, { scartabile: true });
      return;
    }
    if (msg.tipo !== 'faro') return;
    if (ruolo === 'host') {
      if (msg.da < mioId && msg.n >= 1) {
        pulisci();
        ascolta();
      }
      return;
    }
    if (ruolo === 'ospite') {
      if (msg.da === idHost) ultimoFaro = performance.now();
      else if (performance.now() - ultimoFaro > CONFLITTO_MS) diventaOspite(msg.da);
      return;
    }
    if (ruolo === 'ascolto') {
      clearTimeout(attesa);
      if (msg.n >= GIOCATORI_PER_MONDO && numero < MONDI_MASSIMI) apri(numero + 1);
      else diventaOspite(msg.da);
    }
  }

  apri(1);
  return {
    get ruolo() { return ruolo; },
    get mondo() { return numero; },
    get coll() { return coll; },
    aggiornaQuanti(n) { quanti = n; },
    chiudi() {
      chiuso = true;
      pulisci();
      segnali?.chiudi();
    },
  };
}
