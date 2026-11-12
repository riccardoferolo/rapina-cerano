import { SERVER_ICE, ATTESA_RISERVA_MS, CIAO_OGNI_MS } from './configurazione.js';
import { valida } from './protocollo.js';

const OSPITE_SCADUTO_MS = 5000;
export const OSPITI_MASSIMI = 3;
const RIPROVA_ACCOGLIENZA_MS = 2500;
const BUFFER_MASSIMO = 64 * 1024;

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

export function collega({ segnali, sonoHost, mioId, soloRiserva = false, ospite = null }) {
  const messaggi = creaAscoltatori();
  const stati = creaAscoltatori();
  let altroId = null;
  let pc = null;
  let canali = {};
  let modo = 'attesa';
  let timerRiserva = null;
  let timerCiao = null;
  let ultimoRicevuto = 0;
  let iceInAttesa = [];
  let ultimaAccoglienza = 0;

  const cambiaModo = nuovo => {
    if (modo === nuovo) return;
    modo = nuovo;
    stati.avvisa(nuovo);
  };
  const versoAltro = (tipo, extra = {}, opzioni = {}) => segnali.invia({ tipo, da: mioId, a: altroId, ...extra }, opzioni);

  function riceviGioco(dati) {
    const m = valida(dati);
    if (!m) return;
    ultimoRicevuto = performance.now();
    messaggi.avvisa(m);
  }

  function controllaDiretto() {
    if (canali.veloce?.readyState !== 'open' || canali.sicuro?.readyState !== 'open') return;
    clearTimeout(timerRiserva);
    cambiaModo('diretto');
  }

  function avviaRiserva() {
    clearTimeout(timerRiserva);
    timerRiserva = setTimeout(() => { if (modo !== 'diretto') cambiaModo('riserva'); }, ATTESA_RISERVA_MS);
  }

  function preparaCanale(canale) {
    canali[canale.label] = canale;
    canale.onmessage = e => {
      let dati;
      try { dati = JSON.parse(e.data); } catch { return; }
      riceviGioco(dati);
    };
    canale.onopen = controllaDiretto;
    canale.onclose = () => {
      if (canali[canale.label] === canale && modo === 'diretto') cambiaModo('riserva');
    };
  }

  function chiudiPc() {
    for (const c of Object.values(canali)) {
      c.onopen = c.onclose = c.onmessage = null;
      c.close();
    }
    canali = {};
    if (pc) {
      pc.onicecandidate = pc.onconnectionstatechange = pc.ondatachannel = null;
      pc.close();
    }
    pc = null;
  }

  function nuovaConnessione() {
    chiudiPc();
    cambiaModo('collegamento');
    if (soloRiserva) {
      clearTimeout(timerRiserva);
      cambiaModo('riserva');
      return null;
    }
    const nuova = new RTCPeerConnection({ iceServers: SERVER_ICE });
    pc = nuova;
    nuova.onicecandidate = e => { if (e.candidate) versoAltro('ice', { c: e.candidate.toJSON() }); };
    nuova.onconnectionstatechange = () => {
      if (pc !== nuova) return;
      if (nuova.connectionState === 'connected') controllaDiretto();
      else if (['failed', 'closed', 'disconnected'].includes(nuova.connectionState) && modo === 'diretto') cambiaModo('riserva');
    };
    nuova.ondatachannel = e => preparaCanale(e.channel);
    avviaRiserva();
    return nuova;
  }

  async function svuotaIce(connessione) {
    for (const c of iceInAttesa.splice(0)) {
      if (pc !== connessione) return;
      await connessione.addIceCandidate(c).catch(() => {});
    }
  }

  async function accogliOspite(ospite) {
    altroId = ospite;
    ultimaAccoglienza = performance.now();
    ultimoRicevuto = performance.now();
    iceInAttesa = [];
    versoAltro('benvenuto');
    const mia = nuovaConnessione();
    if (!mia) return;
    preparaCanale(mia.createDataChannel('veloce', { ordered: false, maxRetransmits: 0 }));
    preparaCanale(mia.createDataChannel('sicuro'));
    const offerta = await mia.createOffer();
    if (pc !== mia) return;
    await mia.setLocalDescription(offerta);
    if (pc !== mia) return;
    versoAltro('offerta', { sdp: mia.localDescription.toJSON() });
  }

  async function rispondiAllOfferta(sdp) {
    const mia = nuovaConnessione();
    if (!mia) return;
    await mia.setRemoteDescription(sdp);
    if (pc !== mia) return;
    await svuotaIce(mia);
    const risposta = await mia.createAnswer();
    if (pc !== mia) return;
    await mia.setLocalDescription(risposta);
    if (pc !== mia) return;
    versoAltro('risposta', { sdp: mia.localDescription.toJSON() });
  }

  const ripiega = errore => {
    console.error('Collegamento diretto non riuscito, passo dalla riserva:', errore);
    cambiaModo('riserva');
  };

  function conosciHost(id) {
    if (altroId === id) return;
    altroId = id;
    clearInterval(timerCiao);
    if (soloRiserva) nuovaConnessione();
    else {
      cambiaModo('collegamento');
      avviaRiserva();
    }
  }

  function suSegnale(msg) {
    if (!msg || typeof msg !== 'object' || typeof msg.da !== 'string' || msg.da === mioId) return;
    if (sonoHost && msg.tipo === 'ciao') {
      const ferma = msg.da === altroId && modo === 'collegamento' && performance.now() - ultimaAccoglienza > RIPROVA_ACCOGLIENZA_MS;
      if (ferma) accogliOspite(msg.da).catch(ripiega);
      return;
    }
    if (msg.a !== mioId) return;
    if (!sonoHost && (msg.tipo === 'benvenuto' || (msg.tipo === 'offerta' && !altroId))) conosciHost(msg.da);
    if (!sonoHost && msg.tipo === 'occupata') {
      if (!altroId) cambiaModo('occupata');
      return;
    }
    if (msg.da !== altroId) return;
    if (!sonoHost && msg.tipo === 'offerta') rispondiAllOfferta(msg.sdp).catch(ripiega);
    else if (sonoHost && msg.tipo === 'risposta' && pc) {
      const mia = pc;
      mia.setRemoteDescription(msg.sdp).then(() => svuotaIce(mia)).catch(ripiega);
    } else if (msg.tipo === 'ice') {
      if (pc?.remoteDescription) pc.addIceCandidate(msg.c).catch(() => {});
      else iceInAttesa.push(msg.c);
    } else if (msg.tipo === 'gioco') riceviGioco(msg.m);
  }

  const smetti = segnali.suMessaggio(suSegnale);
  if (sonoHost && ospite) accogliOspite(ospite).catch(ripiega);
  if (!sonoHost) {
    const ciao = () => segnali.invia({ tipo: 'ciao', da: mioId });
    ciao();
    timerCiao = setInterval(ciao, CIAO_OGNI_MS);
  }

  return {
    get modo() { return modo; },
    get altroId() { return altroId; },
    silenzio: () => (ultimoRicevuto ? performance.now() - ultimoRicevuto : Infinity),
    suMessaggio: messaggi.aggiungi,
    suStato: stati.aggiungi,
    invia(m, { veloce = false } = {}) {
      if (modo === 'diretto') {
        const canale = veloce ? canali.veloce : canali.sicuro;
        if (canale?.readyState === 'open') {
          if (!veloce || canale.bufferedAmount < BUFFER_MASSIMO) canale.send(JSON.stringify(m));
          return;
        }
      }
      if (altroId && (modo === 'riserva' || modo === 'diretto')) versoAltro('gioco', { m }, { scartabile: veloce });
    },
    chiudiConnessione() {
      clearInterval(timerCiao);
      clearTimeout(timerRiserva);
      chiudiPc();
      smetti?.();
    },
    chiudi() {
      this.chiudiConnessione();
      segnali.chiudi();
    },
  };
}

export function collegaHost({ segnali, mioId, soloRiserva = false, massimo = OSPITI_MASSIMI }) {
  const messaggi = creaAscoltatori();
  const stati = creaAscoltatori();
  const ospiti = new Map();
  const attivo = peer => peer.modo === 'collegamento' || peer.silenzio() < OSPITE_SCADUTO_MS;

  function rimuovi(id) {
    const peer = ospiti.get(id);
    if (!peer) return;
    peer.chiudiConnessione();
    ospiti.delete(id);
    stati.avvisa();
  }

  segnali.suMessaggio(msg => {
    if (!msg || msg.tipo !== 'ciao' || typeof msg.da !== 'string' || msg.da === mioId || ospiti.has(msg.da)) return;
    for (const [id, peer] of [...ospiti]) if (!attivo(peer)) rimuovi(id);
    if (ospiti.size >= massimo) {
      segnali.invia({ tipo: 'occupata', da: mioId, a: msg.da });
      return;
    }
    const id = msg.da;
    const peer = collega({ segnali, sonoHost: true, mioId, soloRiserva, ospite: id });
    peer.suMessaggio(m => messaggi.avvisa({ m, id }));
    peer.suStato(() => stati.avvisa());
    ospiti.set(id, peer);
    stati.avvisa();
  });

  return {
    get modo() {
      const modi = [...ospiti.values()].map(p => p.modo);
      if (modi.includes('diretto')) return 'diretto';
      if (modi.includes('riserva')) return 'riserva';
      return modi.length ? 'collegamento' : 'attesa';
    },
    collegato: id => ['diretto', 'riserva'].includes(ospiti.get(id)?.modo),
    silenzio: id => ospiti.get(id)?.silenzio() ?? Infinity,
    suMessaggio: cb => messaggi.aggiungi(({ m, id }) => cb(m, id)),
    suStato: stati.aggiungi,
    invia(m, opzioni) {
      for (const peer of ospiti.values()) peer.invia(m, opzioni);
    },
    inviaA(id, m, opzioni) {
      ospiti.get(id)?.invia(m, opzioni);
    },
    rimuovi,
    chiudi() {
      for (const peer of ospiti.values()) peer.chiudiConnessione();
      ospiti.clear();
      segnali.chiudi();
    },
  };
}
