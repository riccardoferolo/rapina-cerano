import { SUPABASE_URL, SUPABASE_CHIAVE_PUBBLICA, BATTITO_MS, RICONNESSIONE_MIN_MS, RICONNESSIONE_MAX_MS, PREFISSO_CANALE } from './configurazione.js';

const CODA_MASSIMA = 200;

function creaAscoltatori() {
  const elenco = new Set();
  return {
    aggiungi: cb => {
      elenco.add(cb);
      return () => elenco.delete(cb);
    },
    avvisa: valore => elenco.forEach(cb => cb(valore)),
  };
}

function segnaliLocali(stanza) {
  const canale = new BroadcastChannel(`${PREFISSO_CANALE}-${stanza}`);
  const messaggi = creaAscoltatori();
  const stati = creaAscoltatori();
  canale.onmessage = e => messaggi.avvisa(e.data);
  return {
    invia: msg => canale.postMessage(msg),
    suMessaggio: messaggi.aggiungi,
    suStato: cb => { stati.aggiungi(cb); cb('online'); },
    chiudi: () => canale.close(),
  };
}

function segnaliSupabase(stanza) {
  const topic = `realtime:${PREFISSO_CANALE}-${stanza}`;
  const indirizzo = `${SUPABASE_URL.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(SUPABASE_CHIAVE_PUBBLICA)}&vsn=1.0.0`;
  const messaggi = creaAscoltatori();
  const stati = creaAscoltatori();
  const coda = [];
  let socket = null;
  let unito = false;
  let ref = 0;
  let battito = null;
  let riprova = null;
  let attesa = RICONNESSIONE_MIN_MS;
  let chiuso = false;
  let statoAttuale = 'connessione';

  const cambiaStato = s => { statoAttuale = s; stati.avvisa(s); };
  const grezzo = (event, payload, t = topic) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ topic: t, event, payload, ref: String(++ref), join_ref: '1' }));
  };
  const spedisci = msg => grezzo('broadcast', { type: 'broadcast', event: 'm', payload: msg });

  function connetti() {
    if (chiuso) return;
    cambiaStato('connessione');
    unito = false;
    const s = new WebSocket(indirizzo);
    socket = s;
    s.onopen = () => {
      grezzo('phx_join', { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, private: false } });
      clearInterval(battito);
      battito = setInterval(() => grezzo('heartbeat', {}, 'phoenix'), BATTITO_MS);
    };
    s.onmessage = e => {
      let d;
      try { d = JSON.parse(e.data); } catch { return; }
      if (d.topic !== topic) return;
      if (d.event === 'phx_reply' && !unito && d.payload?.status !== 'ok') {
        console.error("Supabase ha rifiutato l'ingresso nel canale della stanza:", d.payload?.response);
        s.close();
      } else if (d.event === 'phx_reply' && d.payload?.status === 'ok' && !unito) {
        unito = true;
        attesa = RICONNESSIONE_MIN_MS;
        cambiaStato('online');
        coda.splice(0).forEach(spedisci);
      } else if (d.event === 'broadcast' && d.payload?.event === 'm') {
        messaggi.avvisa(d.payload.payload);
      } else if (d.event === 'phx_error' || d.event === 'phx_close') {
        s.close();
      }
    };
    s.onclose = () => {
      if (socket !== s || chiuso) return;
      clearInterval(battito);
      unito = false;
      cambiaStato('offline');
      riprova = setTimeout(connetti, attesa);
      attesa = Math.min(RICONNESSIONE_MAX_MS, attesa * 2);
    };
  }
  connetti();

  return {
    invia(msg, { scartabile = false } = {}) {
      if (unito) {
        spedisci(msg);
        return;
      }
      if (scartabile) return;
      if (coda.length >= CODA_MASSIMA) coda.shift();
      coda.push(msg);
    },
    suMessaggio: messaggi.aggiungi,
    suStato: cb => { stati.aggiungi(cb); cb(statoAttuale); },
    chiudi() {
      chiuso = true;
      clearTimeout(riprova);
      clearInterval(battito);
      socket?.close();
    },
  };
}

export function apriSegnali(stanza, { locale = false } = {}) {
  return locale ? segnaliLocali(stanza) : segnaliSupabase(stanza);
}
