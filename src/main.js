import './stile.css';
import * as THREE from 'three';
import { caricaDati } from './citta/citta.js';
import { creaAmbiente, RIFUGIO } from './gioco/ambiente.js';
import { COLPI, colpoPerId, definizione, PREPARAZIONI, conInterni } from './gioco/colpi/indice.js';
import { R, RUOLI, ARMI, SACCHI, ATTREZZI, POTENZIAMENTI, VEICOLI, ELENCO_RUOLI, velocitaConSacco } from './gioco/regole.js';
import { creaPartita, creaRifugio, passo, aggiungiGiocatore, rimuoviGiocatore, interazioni, sincronizzaPorte } from './gioco/partita.js';
import { allestisci } from './gioco/allestimento.js';
import { faiIstantanea, espandi, interpola } from './gioco/istantanea.js';
import { guida, puntiVeicolo, velocita } from './gioco/veicoli.js';
import { creaArsenale, armaAttiva, aggiorna as aggiornaArsenale, spara, ricarica, cambia, allinea } from './gioco/arsenale.js';
import { semeCasuale } from './gioco/caso.js';
import * as camp from './gioco/campagna.js';
import { bloccaColpi } from './gioco/luoghi.js';
import { apriSegnali } from './rete/segnali.js';
import { collega, collegaHost } from './rete/collegamento.js';
import { codiceStanza, normalizzaCodice, pulisciNome, azioneValida } from './rete/protocollo.js';
import { creaMondo } from './grafica/scena.js';
import { creaGioco3d } from './grafica/gioco3d.js';
import { LIVELLI, leggiScelta, salvaScelta, livelloAttivo } from './grafica/qualita.js';
import { creaComandi } from './comandi.js';
import { creaHud } from './hud.js';
import { creaAudio } from './audio.js';

const PARAMETRI = new URLSearchParams(location.search);
const LOCALE = PARAMETRI.has('locale');
const SOLO_RISERVA = PARAMETRI.has('riserva');
const CHIAVE_NOME = 'rapina.nome';
const CHIAVE_RUOLO = 'rapina.ruolo';
const ISTANTANEE_OGNI_MS = { diretto: 50, riserva: 100 };
const RITARDO_VISTA_S = { diretto: 0.12, riserva: 0.25 };
const GIOCATORE_OGNI_MS = 33;
const PING_OGNI_MS = 1000;
const CIAO_OGNI_MS = 1000;
const SILENZIO_RIMOZIONE_MS = 10000;
const RECUPERO_MASSIMO_S = 0.25;
const SCARTO_SALTO_S = 0.5;
const SCARTO_PESO = 0.05;
const BUFFER_MASSIMO = 40;
const AZIONI_REMOTE_MASSIME = 160;
const FOV = 72;
const FOV_MIRA = 54;
const DISTANZA_SPARO = 90;
const RAGGIO_BERSAGLIO = 0.38;
const ALTEZZA_TESTA = 1.52;
const ANGOLO_INTERAZIONE = 0.9;
const DISTANZA_RIFUGIO_TAVOLO = 2.6;
const ALTEZZA_SEDILE = 1.15;
const CAMERA_AUTO = Object.freeze({ dietro: 6.8, su: 2.6, mira: 1.3 });

const $ = id => document.getElementById(id);
const schermate = ['schermata-inizio', 'schermata-stanza'].map($);
const mostraSchermata = id => schermate.forEach(sch => { sch.hidden = sch.id !== id; });

const hud = creaHud();
const audio = creaAudio();
const comandi = creaComandi($('mondo'));

const s = {
  mioId: crypto.randomUUID(),
  nome: null,
  ruolo: leggiSalvato(CHIAVE_RUOLO) ?? 'scassinatore',
  sonoHost: false,
  stanza: null,
  coll: null,
  nomeHost: null,
  ospiti: new Map(),
  lobby: [],
  pingOspiti: new Map(),
  fase: 'inizio',
  partita: null,
  semeCorrente: null,
  colpoCorrente: null,
  set: null,
  buffer: [],
  scarto: null,
  vista: null,
  vistaPrima: null,
  azioniLocali: [],
  azioniRemote: [],
  accumulo: 0,
  ultimaIstantanea: 0,
  ultimoInvioG: 0,
  ultimoPing: 0,
  ultimoCiao: 0,
  ultimoTickHost: 0,
  lobbyRicevuta: false,
  ping: null,
  statoSegnali: null,
  campagna: null,
  riassunto: null,
  esitoMostrato: null,
  pannello: null,
};
const io = { x: 0, z: 0, yaw: 0, pitch: 0, pronto: false, tp: 0, chino: false, corsa: false, movimento: 0, inMira: false, auto: null, visuale: 'terza', guardaYaw: 0, guardaPitch: 0, quota: 0, usoChiave: null };
const arsenale = creaArsenale('pistola');
let amb = null;
let mondo = null;
let gioco = null;

function leggiSalvato(chiave) {
  try {
    return localStorage.getItem(chiave);
  } catch {
    return null;
  }
}
function salva(chiave, valore) {
  try {
    localStorage.setItem(chiave, valore);
  } catch {
    return false;
  }
  return true;
}

const collegato = () => s.coll && (s.coll.modo === 'diretto' || s.coll.modo === 'riserva');
const modoRete = () => (s.coll?.modo === 'diretto' ? 'diretto' : 'riserva');

function inviaAzione(azione) {
  if (!azioneValida(azione)) return;
  if (s.sonoHost) s.azioniLocali.push({ da: s.mioId, ...azione });
  else s.coll?.invia({ t: 'az', a: azione });
}

function testoRete() {
  if (!s.coll) return '';
  if (s.sonoHost && s.ospiti.size === 0) return 'da solo';
  if (s.coll.modo === 'diretto') return `diretto${s.ping !== null ? ` · ${s.ping} ms` : ''}`;
  if (s.coll.modo === 'riserva') return `via server${s.ping !== null ? ` · ${s.ping} ms` : ''}`;
  return 'collegamento…';
}

function giocatoriLobby() {
  if (!s.sonoHost) return s.lobby;
  return [{ nome: s.nome, ruolo: s.ruolo, pronto: true }, ...[...s.ospiti.values()].map(o => ({ nome: o.nome, ruolo: o.ruolo, pronto: true }))];
}

function aggiornaStanza() {
  $('t-codice').textContent = s.stanza;
  $('blocco-link').hidden = !s.sonoHost;
  $('parti').hidden = !s.sonoHost;
  const stato = $('t-stato');
  const amici = giocatoriLobby().filter(g => g.nome !== s.nome);
  if (s.coll?.modo === 'occupata') {
    stato.textContent = 'La stanza è piena: la banda è già di quattro.';
    stato.dataset.tipo = 'errore';
  } else if (s.statoSegnali === 'offline' && !collegato()) {
    stato.textContent = 'Il server dei collegamenti non risponde, riprovo…';
    stato.dataset.tipo = 'errore';
  } else if (collegato() && amici.length) {
    stato.textContent = `Collegati ${s.coll.modo === 'diretto' ? '(diretto)' : '(via server)'}`;
    stato.dataset.tipo = 'ok';
  } else {
    stato.textContent = s.sonoHost ? 'Manda il link ai tuoi amici (fino a 3). Puoi anche partire da solo.' : 'Mi collego alla stanza…';
    stato.dataset.tipo = 'attesa';
  }
  $('t-giocatori').innerHTML = giocatoriLobby().map(g => `<li><span>${pulisciNome(g.nome) ?? '?'}</span><span>${RUOLI[g.ruolo]?.nome ?? ''}</span></li>`).join('');
  $('parti').textContent = amici.length ? 'Andate al rifugio' : 'Vai al rifugio da solo';
  $('nota-stanza').textContent = s.sonoHost ? 'Chi arriva dopo entra direttamente in partita.' : s.nomeHost ? `Aspetta che ${s.nomeHost} parta per il rifugio.` : '';
}

function inviaLobby() {
  if (!s.sonoHost || !collegato()) return;
  const giocatori = giocatoriLobby();
  for (const id of s.ospiti.keys()) s.coll.inviaA(id, { t: 'lobby', nomeHost: s.nome, giocatori, campagna: s.riassunto ?? undefined });
  if (s.fase === 'gioco') s.coll.invia({ t: 'inizia', seme: s.semeCorrente, colpo: s.colpoCorrente });
}

function entraInStanza(sonoHost, stanza) {
  audio.prepara();
  s.sonoHost = sonoHost;
  s.stanza = stanza;
  s.fase = 'stanza';
  if (sonoHost) {
    s.campagna = camp.caricaCampagna();
    camp.scheda(s.campagna, s.nome);
    s.riassunto = camp.riassunto(s.campagna);
  }
  const segnali = apriSegnali(stanza, { locale: LOCALE });
  segnali.suStato(stato => {
    s.statoSegnali = stato;
    aggiornaStanza();
  });
  s.coll = sonoHost ? collegaHost({ segnali, mioId: s.mioId, soloRiserva: SOLO_RISERVA }) : collega({ segnali, sonoHost, mioId: s.mioId, soloRiserva: SOLO_RISERVA });
  s.coll.suStato(() => {
    aggiornaStanza();
    if (collegato()) inviaLobby();
  });
  s.coll.suMessaggio(suMessaggio);
  const extra = [LOCALE ? 'locale' : null, SOLO_RISERVA ? 'riserva' : null].filter(Boolean).map(p => `&${p}`).join('');
  $('link').value = `${location.origin}${location.pathname}?stanza=${stanza}${extra}`;
  mostraSchermata('schermata-stanza');
  aggiornaStanza();
  if (sonoHost) $('parti').focus();
}

function datiGiocatore(id, nome, ruolo) {
  const sch = s.campagna ? camp.scheda(s.campagna, nome) : { attrezzi: [], potenziamenti: [] };
  return { id, nome, ruolo, attrezzi: [...sch.attrezzi], potenziamenti: [...sch.potenziamenti] };
}

function iniziaPartita(seme, colpo) {
  s.semeCorrente = seme;
  s.colpoCorrente = colpo;
  s.buffer = [];
  s.scarto = null;
  s.vista = null;
  s.vistaPrima = null;
  s.accumulo = 0;
  s.azioniLocali = [];
  s.azioniRemote = [];
  s.esitoMostrato = null;
  chiudiPannello();
  const def = colpo ? definizione(colpo) : null;
  s.set = def ? allestisci(def, seme, amb.luogoDi(colpo), amb.citta) : null;
  gioco.preparaColpo(colpo, s.set);
  mondo.impostaOra(def?.ora ?? 'tramonto');
  Object.assign(io, { pronto: false, tp: 0, auto: null, chino: false, pitch: 0, visuale: 'terza' });
  arsenale.armi = [{ tipo: RUOLI[s.ruolo].arma, caricatore: ARMI[RUOLI[s.ruolo].arma].caricatore, riserva: ARMI[RUOLI[s.ruolo].arma].riserva }];
  arsenale.attiva = 0;
  if (s.sonoHost) {
    const giocatori = [datiGiocatore(s.mioId, s.nome, s.ruolo)];
    for (const [id, o] of s.ospiti) giocatori.push(datiGiocatore(id, o.nome, o.ruolo));
    const preparazioni = colpo && s.campagna ? camp.preparazioniFatte(s.campagna, colpo) : [];
    const campagna = { attrezzi: {}, preparazioni, veicolo: colpo && s.campagna ? camp.veicoloColpo(s.campagna, colpo) : 'utilitaria' };
    s.partita = colpo ? creaPartita({ seme, colpo, giocatori, campagna, ambiente: amb }) : creaRifugio({ seme, giocatori, campagna, ambiente: amb });
    sincronizzaPorte(s.partita, amb);
  }
  s.fase = 'gioco';
  if (s.sonoHost) inviaLobby();
  mostraSchermata(null);
  hud.mostra(true);
  comandi.attiva(true);
  document.activeElement?.blur();
  hud.messaggio(colpo ? `${def.nome} — ${def.via}` : `${RIFUGIO.nome}: la mappa è sul tavolo (F)`, 'info');
}

function scegliColpo(colpo) {
  if (s.sonoHost) partiComeHost(colpo === 'rifugio' ? null : colpo);
  else inviaAzione({ tipo: 'scegli', colpo });
}

function partiComeHost(colpo = null) {
  if (!s.sonoHost) return;
  const seme = semeCasuale();
  iniziaPartita(seme, colpo);
  if (collegato()) s.coll.invia({ t: 'inizia', seme, colpo });
}

function suMessaggio(m, da) {
  switch (m.t) {
    case 'ciao': {
      if (!s.sonoHost || !da || m.id !== da) return;
      const nome = pulisciNome(m.nome) ?? 'Amico';
      const ruolo = ELENCO_RUOLI.includes(m.ruolo) ? m.ruolo : 'azione';
      const ospite = s.ospiti.get(da) ?? { nome, ruolo, remoto: null };
      Object.assign(ospite, { nome, ruolo });
      s.ospiti.set(da, ospite);
      if (s.campagna) camp.scheda(s.campagna, nome);
      s.riassunto = s.campagna ? camp.riassunto(s.campagna) : null;
      if (s.fase === 'gioco' && s.partita) aggiungiGiocatore(s.partita, datiGiocatore(da, nome, ruolo));
      inviaLobby();
      aggiornaStanza();
      return;
    }
    case 'lobby':
      if (s.sonoHost) return;
      s.lobbyRicevuta = true;
      s.nomeHost = pulisciNome(m.nomeHost);
      s.lobby = m.giocatori;
      s.riassunto = m.campagna ?? s.riassunto;
      if (s.pannello) aggiornaPannello();
      aggiornaStanza();
      return;
    case 'inizia':
      if (s.sonoHost || (m.seme === s.semeCorrente && m.colpo === s.colpoCorrente)) return;
      iniziaPartita(m.seme, m.colpo);
      return;
    case 'g': {
      const ospite = s.sonoHost ? s.ospiti.get(da) : null;
      if (!ospite) return;
      riprendiOspite(da);
      ospite.remoto = { x: m.x, z: m.z, yaw: m.yaw, pitch: m.pitch, chino: m.chino, corsa: m.corsa, tp: m.tp, veicolo: m.veicolo };
      return;
    }
    case 'az':
      if (!s.sonoHost || !s.ospiti.has(da)) return;
      riprendiOspite(da);
      if (s.azioniRemote.length >= AZIONI_REMOTE_MASSIME) s.azioniRemote.shift();
      s.azioniRemote.push({ ...m.a, da });
      return;
    case 'st': {
      if (s.sonoHost || s.fase === 'inizio') return;
      if (m.g !== s.semeCorrente || m.ist.c !== s.colpoCorrente) {
        iniziaPartita(m.g, m.ist.c);
        return;
      }
      const ultima = s.buffer[s.buffer.length - 1];
      if (ultima && m.ist.t <= ultima.tempo) return;
      const arrivo = performance.now();
      const campione = m.ist.t - arrivo / 1000;
      const salto = s.scarto === null || Math.abs(campione - s.scarto) > SCARTO_SALTO_S;
      s.scarto = salto ? campione : s.scarto + (campione - s.scarto) * SCARTO_PESO;
      s.buffer.push(espandi(m.ist));
      if (s.buffer.length > BUFFER_MASSIMO) s.buffer.splice(0, s.buffer.length - BUFFER_MASSIMO);
      return;
    }
    case 'ev':
      if (!s.sonoHost && s.fase === 'gioco') suEventi(m.eventi);
      return;
    case 'ping':
      if (!s.sonoHost) s.coll.invia({ t: 'pong', n: m.n });
      return;
    case 'pong':
      if (!s.sonoHost || !s.ospiti.has(da)) return;
      s.pingOspiti.set(da, Math.round(performance.now() - m.n));
      s.ping = Math.max(...s.pingOspiti.values());
      return;
    default:
  }
}

function riprendiOspite(id) {
  const o = s.ospiti.get(id);
  if (s.fase !== 'gioco' || !s.partita || !o || s.partita.giocatori.some(g => g.id === id)) return;
  aggiungiGiocatore(s.partita, datiGiocatore(id, o.nome, o.ruolo));
}

function eseguiAzioniHost(azioni) {
  const resto = [];
  for (const a of azioni) {
    if (a.tipo === 'compra' || a.tipo === 'potenzia') {
      const nome = a.da === s.mioId ? s.nome : s.ospiti.get(a.da)?.nome;
      if (!nome || !s.campagna) continue;
      const ruolo = a.da === s.mioId ? s.ruolo : s.ospiti.get(a.da)?.ruolo;
      const esito = a.tipo === 'compra' ? camp.compra(s.campagna, nome, a.voce) : camp.potenzia(s.campagna, nome, ruolo, a.voce);
      camp.salvaCampagna(s.campagna);
      s.riassunto = camp.riassunto(s.campagna);
      inviaLobby();
      notifica(a.da, esito.ok ? `Comprato: ${ATTREZZI[a.voce]?.nome ?? a.voce}` : esito.motivo, esito.ok ? 'bene' : 'avviso');
      if (s.pannello) aggiornaPannello();
      continue;
    }
    if (a.tipo === 'scegli') {
      const scelto = a.colpo === 'rifugio' ? null : a.colpo;
      const def = scelto ? definizione(scelto) : null;
      const base = def?.preparazione ? def.per : scelto;
      if (!scelto || !s.campagna || camp.sbloccato(s.campagna, base)) s.daAvviare = { colpo: scelto };
      continue;
    }
    resto.push(a);
  }
  return resto;
}

function notifica(id, testo, tipo) {
  const e = [{ k: 'messaggio', testo, tipo, a: id }];
  if (id === s.mioId) suEventi(e);
  else s.coll?.inviaA(id, { t: 'ev', eventi: e });
}

function suEventi(eventi) {
  const me = s.vista?.giocatori.find(g => g.id === s.mioId);
  for (const e of eventi) {
    switch (e.k) {
      case 'messaggio':
        if (!e.a || e.a === s.mioId) hud.messaggio(e.testo, e.tipo);
        break;
      case 'allarme':
        audio.allarme(true);
        break;
      case 'sparo': {
        if (e.da === s.mioId) break;
        const d = me ? Math.hypot(e.x - io.x, e.z - io.z) : 30;
        audio.sparo(e.arma, d, panDi(e.x, e.z), e.silenziato);
        if (e.png && e.ax !== undefined) {
          gioco.tracce.traccia({ x: e.x, y: e.y, z: e.z }, e.colpito ? { x: e.ax, y: e.ay, z: e.az } : { x: e.ax + (Math.random() - 0.5) * 3, y: e.ay + Math.random(), z: e.az + (Math.random() - 0.5) * 3 });
          gioco.tracce.lampo(e.x, 1.5, e.z);
        }
        break;
      }
      case 'ferito':
        if (e.a === s.mioId) hud.danno();
        break;
      case 'vetro':
        audio.vetro(Math.hypot(e.x - io.x, e.z - io.z), panDi(e.x, e.z));
        break;
      case 'urlo':
        if (s.vista) {
          const p = s.vista.png.find(x => x.id === e.id);
          if (p) audio.urlo(Math.hypot(p.x - io.x, p.z - io.z), panDi(p.x, p.z));
        }
        break;
      case 'presa':
      case 'caricato':
      case 'lancio':
        if (!e.a || e.a === s.mioId) audio.sacco();
        break;
      case 'fine':
        break;
      default:
    }
  }
}

function panDi(x, z) {
  const ang = Math.atan2(-(x - io.x), -(z - io.z)) - (io.auto ? io.auto.yaw : io.yaw);
  return -Math.sin(ang);
}

function pulisciOspiti() {
  let cambiato = false;
  for (const id of [...s.ospiti.keys()]) {
    if (s.coll.silenzio(id) <= SILENZIO_RIMOZIONE_MS) continue;
    if (s.partita) rimuoviGiocatore(s.partita, id);
    s.ospiti.delete(id);
    s.pingOspiti.delete(id);
    s.coll.rimuovi(id);
    cambiato = true;
  }
  if (!cambiato) return;
  aggiornaStanza();
  inviaLobby();
}

function mieiIngressi() {
  const dati = { x: io.x, z: io.z, yaw: io.auto ? io.auto.yaw : io.yaw, pitch: io.pitch, chino: io.chino, corsa: io.corsa, tp: io.tp };
  if (io.auto) dati.veicolo = { x: io.auto.x, z: io.auto.z, yaw: io.auto.yaw, vx: io.auto.vx, vz: io.auto.vz, w: io.auto.w, sterzo: io.auto.sterzo, gas: io.auto.gas ?? 0, mano: io.auto.mano ?? 0, vita: io.auto.vita };
  return dati;
}

function tickHost(dt, ora) {
  const p = s.partita;
  if (s.fase === 'gioco' && p) {
    s.accumulo = Math.min(s.accumulo + dt, RECUPERO_MASSIMO_S);
    const eventi = [];
    while (s.accumulo >= R.PASSO) {
      if (s.accumulo < 2 * R.PASSO) s.vistaPrima = espandi(faiIstantanea(p));
      const posizioni = {};
      if (io.pronto) posizioni[s.mioId] = mieiIngressi();
      for (const [id, o] of s.ospiti) if (o.remoto) posizioni[id] = o.remoto;
      const azioni = eseguiAzioniHost([...s.azioniLocali.splice(0), ...s.azioniRemote.splice(0)]);
      eventi.push(...passo(p, R.PASSO, { posizioni, azioni }, amb));
      s.accumulo -= R.PASSO;
    }
    s.ultimoTickHost = ora;
    if (s.daAvviare) {
      const { colpo } = s.daAvviare;
      s.daAvviare = null;
      partiComeHost(colpo);
      return;
    }
    if (eventi.length && collegato()) s.coll.invia({ t: 'ev', eventi });
    if (eventi.length) suEventi(eventi);
    const fine = eventi.find(e => e.k === 'fine');
    if (fine && s.campagna && p.colpo) {
      const nomi = p.giocatori.map(g => g.nome);
      const missione = definizione(p.colpo);
      if (missione?.preparazione && fine.vinto) camp.registraPreparazione(s.campagna, missione.per, missione.preparazione);
      const quote = missione?.preparazione ? [] : camp.registraEsito(s.campagna, p.colpo, fine, nomi);
      camp.salvaCampagna(s.campagna);
      s.riassunto = camp.riassunto(s.campagna);
      p.esito.quote = quote;
      inviaLobby();
    }
  }
  const ogni = ISTANTANEE_OGNI_MS[modoRete()];
  if (p && collegato() && ora - s.ultimaIstantanea >= ogni) {
    s.coll.invia({ t: 'st', g: s.semeCorrente, ist: faiIstantanea(p) }, { veloce: true });
    s.ultimaIstantanea = Math.max(s.ultimaIstantanea + ogni, ora - ogni);
  }
}

function tickOspite(ora) {
  if (s.fase !== 'gioco' || !io.pronto || ora - s.ultimoInvioG < GIOCATORE_OGNI_MS) return;
  s.coll.invia({ t: 'g', ...mieiIngressi() }, { veloce: true });
  s.ultimoInvioG = ora;
}

let ultimoTick = performance.now();
function tick() {
  const ora = performance.now();
  const dt = Math.min(RECUPERO_MASSIMO_S, (ora - ultimoTick) / 1000);
  ultimoTick = ora;
  if (s.sonoHost && s.coll && s.fase !== 'inizio') pulisciOspiti();
  if (s.coll && collegato()) {
    if (s.sonoHost && ora - s.ultimoPing > PING_OGNI_MS) {
      s.coll.invia({ t: 'ping', n: ora });
      s.ultimoPing = ora;
    }
    if (!s.sonoHost && !s.lobbyRicevuta && ora - s.ultimoCiao > CIAO_OGNI_MS) {
      s.coll.invia({ t: 'ciao', nome: s.nome, id: s.mioId, ruolo: s.ruolo });
      s.ultimoCiao = ora;
    }
  }
  if (s.fase !== 'gioco') return;
  if (s.sonoHost) tickHost(dt, ora);
  else tickOspite(ora);
}

function vistaHost(ora) {
  if (!s.partita) return null;
  const attuale = espandi(faiIstantanea(s.partita));
  if (!s.vistaPrima || s.vistaPrima.tempo > attuale.tempo) return attuale;
  return interpola(s.vistaPrima, attuale, (s.accumulo + (ora - s.ultimoTickHost) / 1000) / R.PASSO);
}

function vistaOspite(ora) {
  if (s.buffer.length === 0 || s.scarto === null) return null;
  const tempo = ora / 1000 + s.scarto - RITARDO_VISTA_S[modoRete()];
  while (s.buffer.length > 2 && s.buffer[1].tempo <= tempo) s.buffer.shift();
  const [a, b] = s.buffer;
  if (b && tempo > a.tempo) return interpola(a, b, (tempo - a.tempo) / Math.max(1e-6, b.tempo - a.tempo));
  return a;
}

function sincronizzaPorteLocali(vista) {
  if (!vista?.colpo) return;
  const segmenti = amb.porte.get(vista.colpo);
  for (const [id, seg] of segmenti ?? []) seg.attivo = !vista.porte[id]?.aperta;
}

function pseudoStato(vista) {
  const set = s.set;
  const porteSet = new Map((set?.porte ?? []).map(p => [p.id, p]));
  const posti = new Map();
  for (const g of vista.giocatori) if (g.inAuto !== null) posti.set(`${g.inAuto}:${g.posto}`, g.id);
  return {
    colpo: vista.colpo,
    porte: Object.fromEntries(Object.entries(vista.porte ?? {}).map(([id, p]) => [id, { aperta: p.aperta, serratura: p.serratura ? porteSet.get(id)?.serratura ?? 'chiave' : null }])),
    casseforti: (set?.casseforti ?? []).map((c, i) => ({ ...c, ...(vista.casseforti[i] ?? {}) })),
    biglietti: (set?.biglietti ?? []).map((b, i) => ({ ...b, letto: !!vista.biglietti[i] })),
    casse: (set?.casse ?? []).map((c, i) => ({ ...c, piena: vista.casse[i] ?? true })),
    vetrine: (set?.vetrine ?? []).map((v, i) => ({ ...v, ...(vista.vetrine[i] ?? {}) })),
    telecamere: (set?.telecamere ?? []).map((t, i) => ({ ...t, ...(vista.telecamere[i] ?? {}) })),
    sacchi: vista.sacchi.map(k => ({ ...k, portatoDa: k.portato ? 'x' : null, inVolo: false })),
    png: vista.png,
    giocatori: vista.giocatori.map(g => ({ ...g, attrezzi: [], potenziamenti: [] })),
    veicoli: vista.veicoli.map(v => ({ ...v, sacchi: Array.from({ length: v.sacchi }), posti: [0, 1, 2, 3].map(k => posti.get(`${v.id}:${k}`) ?? null) })),
    attrezzi: {},
    tessera: false,
  };
}

function scegliInterazione(vista, me) {
  if (!vista || !me || me.stato !== 'vivo') return null;
  if (vista.fase === 'rifugio') {
    if (me.inAuto) return { chiave: 'esci', testo: 'Scendi dall\'auto', tempo: 0, x: me.x, z: me.z };
    const [mx, mz] = gioco.rifugio.mappa;
    if (Math.hypot(mx - io.x, mz - io.z) < DISTANZA_RIFUGIO_TAVOLO) return { chiave: 'ui:mappa', testo: 'Guarda la mappa di Cerano e scegli il colpo', tempo: 0, x: mx, z: mz };
    const [bx, bz] = gioco.rifugio.banco;
    if (Math.hypot(bx - io.x, bz - io.z) < DISTANZA_RIFUGIO_TAVOLO) return { chiave: 'ui:banco', testo: 'Banco degli attrezzi', tempo: 0, x: bx, z: bz };
    return null;
  }
  const elenco = interazioni(pseudoStato(vista), amb, { ...me, attrezzi: [], potenziamenti: [] });
  let migliore = null;
  for (const i of elenco) {
    if (i.sempre) continue;
    const d = Math.hypot(i.x - io.x, i.z - io.z);
    if (d > (i.distanza ?? R.DISTANZA_USO)) continue;
    const dir = Math.atan2(-(i.x - io.x), -(i.z - io.z));
    const scarto = Math.abs(Math.atan2(Math.sin(dir - io.yaw), Math.cos(dir - io.yaw)));
    if (d > 0.9 && scarto > ANGOLO_INTERAZIONE && i.chiave !== 'esci') continue;
    const punteggio = d + scarto * 1.2;
    if (!migliore || punteggio < migliore.punteggio) migliore = { ...i, punteggio };
  }
  return migliore;
}

function muoviAPiedi(lettura, me, dt, vista) {
  io.inMira = me.maschera && lettura.mira;
  io.corsa = lettura.corsa && lettura.avanti > 0 && !io.chino && !io.inMira;
  const l = Math.hypot(lettura.avanti, lettura.lato);
  io.movimento = l > 0 ? 1 : 0;
  if (!l) return;
  const sacco = me.sacchi?.length ? vista.sacchi.find(k => k.id === me.sacchi[0])?.tipo : null;
  const base = io.chino ? R.VELOCITA_CHINO : io.corsa && !sacco ? R.VELOCITA_CORSA : R.VELOCITA;
  const v = base * velocitaConSacco(sacco, me.ruolo) * (io.inMira ? 0.6 : 1) * dt;
  const av = lettura.avanti / l;
  const la = lettura.lato / l;
  const fx = -Math.sin(io.yaw);
  const fz = -Math.cos(io.yaw);
  const dx = (fx * av + Math.cos(io.yaw) * la) * v;
  const dz = (fz * av - Math.sin(io.yaw) * la) * v;
  let esito = amb.citta.collisioni.muoviCerchio(io.x, io.z, dx, dz, R.RAGGIO_GIOCATORE);
  for (const p of vista.png) {
    if (['morto', 'fuggito'].includes(p.stato)) continue;
    const ddx = esito.x - p.x;
    const ddz = esito.z - p.z;
    const d = Math.hypot(ddx, ddz);
    const minimo = R.RAGGIO_GIOCATORE + R.RAGGIO_PNG;
    if (d < minimo && d > 1e-4) esito = { x: p.x + (ddx / d) * minimo, z: p.z + (ddz / d) * minimo };
  }
  for (const veicolo of vista.veicoli) {
    for (const c of cerchiAuto(veicolo)) {
      const ddx = esito.x - c.x;
      const ddz = esito.z - c.z;
      const d = Math.hypot(ddx, ddz);
      const minimo = R.RAGGIO_GIOCATORE + c.r;
      if (d < minimo && d > 1e-4) esito = { x: c.x + (ddx / d) * minimo, z: c.z + (ddz / d) * minimo };
    }
  }
  io.x = esito.x;
  io.z = esito.z;
}

function cerchiAuto(v) {
  const d = VEICOLI[v.tipo];
  const fx = -Math.sin(v.yaw);
  const fz = -Math.cos(v.yaw);
  const o = (d.lungo - d.largo) / 2;
  return [-o, 0, o].map(k => ({ x: v.x + fx * k, z: v.z + fz * k, r: d.largo / 2 }));
}

function guidaLocale(lettura, me, vista, dt) {
  const a = io.auto;
  const ostacoli = vista.veicoli.filter(v => v.id !== a.id && Math.hypot(v.x - a.x, v.z - a.z) < 12);
  const abilita = me.ruolo === 'autista' ? RUOLI.autista.guida : 1;
  const forzato = io.forzato && performance.now() < io.forzato.fino ? io.forzato : null;
  guida(a, forzato ? { gas: forzato.gas, sterzo: forzato.sterzo } : { gas: lettura.avanti, sterzo: -lettura.lato, mano: lettura.freno }, dt, { collisioni: amb.citta.collisioni, ostacoli, abilita });
  io.x = a.x;
  io.z = a.z;
}

function sparaColpo(arma, vista, me, origine, yaw, pitch) {
  const dati = ARMI[arma];
  const colpiti = new Map();
  let telecamera;
  let ultimoPunto = null;
  for (let k = 0; k < dati.pallini; k++) {
    const spread = dati.dispersione * (io.inMira ? 0.4 : 1) * (io.movimento ? 1.6 : 1);
    const y = yaw + (Math.random() - 0.5) * spread * 2;
    const p = pitch + (Math.random() - 0.5) * spread * 2;
    const dx = -Math.sin(y) * Math.cos(p);
    const dy = Math.sin(p);
    const dz = -Math.cos(y) * Math.cos(p);
    const orizz = Math.hypot(dx, dz);
    const muro = amb.citta.collisioni.raggio(origine.x, origine.z, dx, dz, DISTANZA_SPARO * orizz, bloccaColpi).distanza / Math.max(1e-3, orizz);
    let fine = Math.min(muro, DISTANZA_SPARO);
    if (dy < -0.02) fine = Math.min(fine, (origine.y - 0.05) / -dy);
    let bersaglio = null;
    for (const png of vista.png) {
      if (['morto', 'fuggito'].includes(png.stato)) continue;
      const qx = png.x - origine.x;
      const qz = png.z - origine.z;
      const t = (qx * dx + qz * dz) / (orizz * orizz);
      if (t <= 0 || t >= fine) continue;
      const px = origine.x + dx * t;
      const pz = origine.z + dz * t;
      if (Math.hypot(px - png.x, pz - png.z) > RAGGIO_BERSAGLIO) continue;
      const altezza = origine.y + dy * t - amb.citta.quota(png.x, png.z);
      const giu = ['a terra', 'legato'].includes(png.stato);
      if (altezza < 0 || altezza > (giu ? 1.2 : 1.85)) continue;
      if (!bersaglio || t < bersaglio.t) bersaglio = { png, t, testa: altezza > (giu ? 0.95 : ALTEZZA_TESTA) };
    }
    for (const [i, tc] of (s.set?.telecamere ?? []).entries()) {
      if (vista.telecamere[i]?.stato === 'rotta') continue;
      const qx = tc.x - origine.x;
      const qy = tc.y - origine.y;
      const qz = tc.z - origine.z;
      const t = qx * dx + qy * dy + qz * dz;
      if (t <= 0 || t >= fine) continue;
      if (Math.hypot(origine.x + dx * t - tc.x, origine.y + dy * t - tc.y, origine.z + dz * t - tc.z) < 0.22) telecamera = tc.id;
    }
    const t = bersaglio ? bersaglio.t : fine;
    ultimoPunto = { x: origine.x + dx * t, y: origine.y + dy * t, z: origine.z + dz * t };
    if (bersaglio) {
      const danno = dati.danno * (bersaglio.testa ? 2.4 : 1) * Math.max(0.4, 1 - bersaglio.t / 80);
      const prima = colpiti.get(bersaglio.png.id) ?? { danno: 0, testa: false };
      colpiti.set(bersaglio.png.id, { danno: prima.danno + danno, testa: prima.testa || bersaglio.testa });
    }
  }
  inviaAzione({ tipo: 'sparo', yaw, pitch, arma, ...(telecamera ? { telecamera } : {}) });
  for (const [png, c] of colpiti) inviaAzione({ tipo: 'colpo', png, danno: Math.round(c.danno), testa: c.testa });
  const silenziato = arma === 'pistola' && (s.riassunto?.giocatori?.[s.nome]?.attrezzi ?? []).includes('silenziatore');
  audio.sparo(arma, 0, 0, silenziato);
  const bocca = { x: origine.x - Math.sin(yaw) * 0.6 + Math.cos(yaw) * 0.12, y: origine.y - 0.12, z: origine.z - Math.cos(yaw) * 0.6 - Math.sin(yaw) * 0.12 };
  if (ultimoPunto) gioco.tracce.traccia(bocca, ultimoPunto);
  gioco.tracce.lampo(bocca.x, bocca.y, bocca.z);
}

function colpoMischia(vista, me) {
  let migliore = null;
  for (const p of vista.png) {
    if (['morto', 'fuggito', 'stordito'].includes(p.stato)) continue;
    const d = Math.hypot(p.x - io.x, p.z - io.z);
    if (d > 2.2) continue;
    const dir = Math.atan2(-(p.x - io.x), -(p.z - io.z));
    if (Math.abs(Math.atan2(Math.sin(dir - io.yaw), Math.cos(dir - io.yaw))) > 0.8) continue;
    if (!migliore || d < migliore.d) migliore = { p, d };
  }
  if (migliore) inviaAzione({ tipo: 'colpo', png: migliore.p.id, danno: 45, mischia: true });
}

let fTenuto = null;
function usaArmiEAzioni(lettura, me, vista, dt, interazione) {
  for (const a of lettura.azioni) {
    if (a === 'maschera' && !me.maschera && vista.fase === 'colpo') inviaAzione({ tipo: 'maschera' });
    else if (a === 'grida' && vista.fase === 'colpo') inviaAzione({ tipo: 'grida' });
    else if (a === 'lancia' && me.sacchi?.length) inviaAzione({ tipo: 'lancia', pitch: io.pitch });
    else if (a === 'chino' && !me.inAuto) io.chino = !io.chino;
    else if (a === 'chino' && me.inAuto) io.visuale = io.visuale === 'terza' ? 'prima' : 'terza';
    else if (a === 'ricarica' && ricarica(arsenale)) audio.ricarica();
    else if (a === 'mischia' && vista.fase === 'colpo' && !me.inAuto) colpoMischia(vista, me);
    else if (a === 'taglia' && vista.fase === 'colpo') inviaAzione({ tipo: 'taglia' });
    else if (typeof a === 'object' && a.arma !== undefined && me.armi?.[a.arma]) {
      allinea(arsenale, me.armi);
      if (cambia(arsenale, a.arma)) inviaAzione({ tipo: 'arma', arma: me.armi[a.arma] });
    }
  }
  if (lettura.fPremuto && interazione) {
    if (interazione.chiave.startsWith('ui:')) apriPannello(interazione.chiave.slice(3));
    else if (interazione.chiave === 'esci' && vista.fase === 'rifugio') inviaAzione({ tipo: 'usa', chiave: 'esci', attivo: true });
    else {
      inviaAzione({ tipo: 'usa', chiave: interazione.chiave, attivo: true });
      fTenuto = interazione.chiave;
    }
  } else if (lettura.fPremuto && me.inAuto) inviaAzione({ tipo: 'usa', chiave: 'esci', attivo: true });
  if (fTenuto && (lettura.fRilasciato || interazione?.chiave !== fTenuto) && !lettura.f) {
    inviaAzione({ tipo: 'usa', chiave: fTenuto, attivo: false });
    fTenuto = null;
  }
  aggiornaArsenale(arsenale, dt);
  const guidi = me.inAuto !== null && me.posto === 0;
  if (!me.maschera || guidi || vista.fase !== 'colpo' || me.stato !== 'vivo') return;
  const arma = armaAttiva(arsenale);
  const dati = ARMI[arma.tipo];
  const preme = dati.automatica ? lettura.sparo : lettura.sparoPremuto;
  if (!preme) return;
  if (arma.caricatore <= 0) {
    if (lettura.sparoPremuto) {
      audio.clic();
      if (ricarica(arsenale)) audio.ricarica();
    }
    return;
  }
  if (!spara(arsenale)) return;
  gioco.vista1p.spara();
  const origine = { x: io.x, y: io.quota + (io.chino ? R.ALTEZZA_CHINO : R.ALTEZZA_OCCHI), z: io.z };
  if (me.inAuto) origine.y = ALTEZZA_SEDILE + 0.1;
  sparaColpo(arma.tipo, vista, me, origine, io.yaw, io.pitch);
}

function obiettivo(vista, me) {
  if (!vista || !me) return '';
  if (vista.fase === 'rifugio') return 'Rifugio — cascina di Via Ranzina. Al tavolo la mappa dei colpi, a destra il banco degli attrezzi.';
  if (vista.esito) return '';
  if (me.stato === 'terra') return 'Sei a terra: aspetta che un compagno ti rialzi.';
  const def = definizione(vista.colpo);
  const auto = vista.veicoli.find(v => v.nostro);
  if (vista.fuga.attiva) return vista.fuga.polizia ? 'Seminate la polizia, poi andate alla cascina di Via Ranzina.' : 'Andate alla cascina di Via Ranzina (punto verde sulla mappa).';
  if (def.preparazione) {
    const m = vista.missione;
    if (m.fatto || (def.preparazione === 'trapano' && auto?.sacchi) || (def.preparazione === 'furgone' && auto?.tipo === 'furgone')) return 'Fatto: tornate al rifugio senza farvi seguire.';
    return {
      fotografie: `In borghese, fotografate telecamere e guardia (${m.foto}/${m.totale}). La telecamera del laboratorio è nel retro.`,
      tessera: 'Il direttore è al bar in Piazza Crespi: avvicinati alle sue spalle e sfilagli la tessera (F).',
      linea: 'La centralina è sul marciapiede davanti alla banca: taglia i fili (F).',
      trapano: 'Il trapano termico è nel cantiere: caricalo nel bagagliaio senza svegliare il guardiano.',
      furgone: 'Il furgone bianco è nel piazzale: l\'autista lo avvia in silenzio, gli altri fanno scattare l\'antifurto.',
    }[def.preparazione];
  }
  const chiuse = vista.casseforti.filter(c => c.stato === 'chiusa' || c.stato === 'trapano' || c.stato === 'ritardo').length;
  const sparsi = vista.sacchi.filter(k => !k.portato && k.veicolo === null).length;
  if (def.id === 'furgone' && chiuse) return `Blindato in sosta in Via Novara${vista.scadenza !== null ? `: riparte fra ${Math.ceil(vista.scadenza)} s` : ''}. Le chiavi del portellone le ha una guardia (stendila o falla arrendere), oppure il trapano.`;
  if (chiuse) {
    const cf = s.set?.casseforti[0];
    const extra = vista.casseforti[0]?.codiceNoto ? ` (combinazione ${cf?.codice})` : ': cercate il foglietto con la combinazione';
    if (def.id === 'banca') return `Caveau: la porta elettronica la apre l'hacker, quella del caveau la tessera del direttore${vista.tessera ? ' (l\'avete)' : ''}. Poi la cassaforte grande${extra}.`;
    if (def.id === 'supermercato') {
      const cassa = vista.casseforti[0];
      const portavalori = vista.scadenza !== null ? ` Il portavalori arriva fra ${Math.ceil(vista.scadenza)} s.` : '';
      if (cassa?.stato === 'ritardo') return `Serratura a tempo: la cassa centrale si apre fra ${Math.ceil((1 - cassa.progresso) * (cf?.ritardo ?? 40))} s. Tenete la posizione.${portavalori}`;
      if (cassa?.stato === 'trapano') return `Il trapano lavora sulla cassa centrale: tenete lontani clienti e guardie.${portavalori}`;
      return `Cassa centrale nel retro: la porta vuole la tessera del direttore${vista.tessera ? ' (l\'avete)' : ', che la tiene nel giaccone'}, la cassaforte ha la serratura a tempo${extra}.${vista.antipanico ? ' Gli antipanico si staccano dal quadro della sala sicurezza.' : ' Antipanico staccati.'}${portavalori}`;
    }
    if (def.id === 'municipio') return `Tesoreria del Municipio: porta blindata (serve il trapano), poi la cassaforte grande${extra}.`;
    return `${def.nome}, ${def.via}. Aprite la cassaforte${extra}.`;
  }
  if (sparsi || vista.giocatori.some(g => g.sacchi?.length)) return `Portate i sacchi nel bagagliaio (${auto?.sacchi ?? 0}/${VEICOLI[auto?.tipo ?? 'utilitaria'].sacchi}). G per lanciarli.`;
  return 'Tutti in auto: andate al rifugio.';
}

function apriPannello(tipo) {
  s.pannello = tipo;
  comandi.attiva(false);
  $('pannello').hidden = false;
  aggiornaPannello();
}

function chiudiPannello() {
  if (!s.pannello) return;
  s.pannello = null;
  $('pannello').hidden = true;
  if (s.fase === 'gioco') comandi.attiva(true);
}

const euro = n => `${Math.round(n).toLocaleString('it-IT')} €`;

function aggiornaPannello() {
  const corpo = $('pannello-corpo');
  const ria = s.riassunto;
  if (s.pannello === 'mappa') {
    $('pannello-titolo').textContent = 'La mappa di Cerano';
    corpo.innerHTML = `<div class="colpi">${COLPI.map(def => {
      const c = ria?.colpi?.[def.id];
      const aperto = c?.sbloccato ?? def.ordine === 1;
      const preps = (def.preparazioni ?? []).map(id => {
        const fatta = c?.preparazioni?.includes(id);
        return `<span class="prep ${fatta ? 'fatta' : ''}">${fatta ? '✓ ' : ''}${PREPARAZIONI[id].nome}${aperto && !fatta ? ` <button data-colpo="prep:${id}">Vai</button>` : ''}</span>`;
      }).join('');
      return `<div class="colpo ${aperto ? '' : 'chiuso'}"><div><h3>${def.ordine}. ${def.nome}</h3><p>${def.via} — ${def.breve}</p><p>${c?.fatti ? `Fatto ${c.fatti} volte, migliore ${euro(c.migliore)}` : aperto ? 'Mai tentato' : 'Si sblocca col colpo precedente'}</p>${preps ? `<div class="preps">${preps}</div>` : ''}</div>
        <div>${aperto ? `<button class="primario" data-colpo="${def.id}">Si parte</button>` : ''}</div></div>`;
    }).join('')}</div><p class="tasti">Le preparazioni sono facoltative ma decisive. Chiunque della banda può scegliere: si parte tutti insieme.</p>`;
    corpo.querySelectorAll('[data-colpo]').forEach(b => b.addEventListener('click', () => scegliColpo(b.dataset.colpo)));
  } else if (s.pannello === 'banco') {
    $('pannello-titolo').textContent = 'Banco degli attrezzi';
    const mia = ria?.giocatori?.[s.nome] ?? { soldi: 0, attrezzi: [], potenziamenti: [] };
    corpo.innerHTML = `<p>Hai <b>${euro(mia.soldi)}</b>. Gli attrezzi restano tuoi per tutta la campagna (il kit medico si consuma).</p>
      <div class="negozio">${Object.entries(ATTREZZI).map(([k, a]) => `<div class="voce"><b>${a.nome}</b><span>${a.descrizione}</span><span class="costo">${euro(a.costo)}</span>${mia.attrezzi.includes(k) ? '<span>Ce l\'hai</span>' : `<button data-compra="${k}" ${mia.soldi < a.costo ? 'disabled' : ''}>Compra</button>`}</div>`).join('')}</div>
      <h3>Potenziamenti da ${RUOLI[s.ruolo].nome}</h3>
      <div class="negozio">${POTENZIAMENTI[s.ruolo].map(p => `<div class="voce"><b>${p.nome}</b><span>${p.effetto}</span><span class="costo">${euro(p.costo)}</span>${mia.potenziamenti.includes(p.nome) ? '<span>Ce l\'hai</span>' : `<button data-potenzia="${p.nome}" ${mia.soldi < p.costo ? 'disabled' : ''}>Compra</button>`}</div>`).join('')}</div>`;
    corpo.querySelectorAll('[data-compra]').forEach(b => b.addEventListener('click', () => inviaAzione({ tipo: 'compra', voce: b.dataset.compra })));
    corpo.querySelectorAll('[data-potenzia]').forEach(b => b.addEventListener('click', () => inviaAzione({ tipo: 'potenzia', voce: b.dataset.potenzia })));
  } else if (s.pannello === 'esito') {
    const e = s.esitoMostrato;
    $('pannello-titolo').textContent = e?.preparazione ? (e.vinto ? 'Preparazione riuscita' : 'Preparazione fallita') : e?.vinto ? 'Colpo riuscito' : 'Colpo fallito';
    corpo.innerHTML = `<div class="esito"><h3>${e?.preparazione ? (e.vinto ? PREPARAZIONI[e.preparazione]?.nome ?? '' : 'Da rifare') : e?.vinto ? euro(e.totale) : 'Niente bottino'}</h3>
      <p>${e?.vinto ? `${e.sacchi} sacchi, ${e.pulito ? 'senza allarme (+20%)' : 'con l\'allarme'} in ${Math.floor(e.durata / 60)} min ${e.durata % 60} s` : 'La polizia vi ha presi.'}</p>
      <table>${(e?.giocatori ?? []).map(g => `<tr><td>${g.nome}</td><td>${RUOLI[g.ruolo]?.nome ?? ''}</td><td>${g.stato === 'arrestato' ? 'arrestato' : 'libero'}</td><td>${e.quote?.find(q => q.nome === g.nome) ? euro(e.quote.find(q => q.nome === g.nome).quota) : ''}</td></tr>`).join('')}</table>
      <button class="primario" id="torna">Torna al rifugio</button></div>`;
    $('torna')?.addEventListener('click', () => scegliColpo('rifugio'));
  }
}

const vettore = new THREE.Vector3();
function camera(me, vista, dt) {
  if (me?.inAuto !== null && me?.inAuto !== undefined) {
    const veicolo = io.auto ?? vista.veicoli.find(v => v.id === me.inAuto);
    if (veicolo) {
      if (io.visuale === 'prima' || me.posto !== 0) {
        const sedili = puntiVeicolo(veicolo).sedili;
        const [x, z] = sedili[me.posto] ?? [veicolo.x, veicolo.z];
        if (me.posto !== 0) return { x, y: ALTEZZA_SEDILE, z, yaw: io.yaw, pitch: io.pitch, fov: FOV };
        return { x, y: ALTEZZA_SEDILE, z, yaw: veicolo.yaw + io.guardaYaw, pitch: io.pitch * 0.5, fov: FOV };
      }
      const fx = -Math.sin(veicolo.yaw + io.guardaYaw);
      const fz = -Math.cos(veicolo.yaw + io.guardaYaw);
      const cx = veicolo.x - fx * CAMERA_AUTO.dietro;
      const cz = veicolo.z - fz * CAMERA_AUTO.dietro;
      const libero = amb.citta.collisioni.raggio(veicolo.x, veicolo.z, cx - veicolo.x, cz - veicolo.z, CAMERA_AUTO.dietro).distanza;
      const k = Math.min(1, (libero - 0.4) / CAMERA_AUTO.dietro);
      const px = veicolo.x - fx * CAMERA_AUTO.dietro * k;
      const pz = veicolo.z - fz * CAMERA_AUTO.dietro * k;
      vettore.set(veicolo.x + fx * 4 - px, CAMERA_AUTO.mira - CAMERA_AUTO.su, veicolo.z + fz * 4 - pz);
      return { x: px, y: CAMERA_AUTO.su, z: pz, yaw: Math.atan2(-vettore.x, -vettore.z), pitch: Math.atan2(vettore.y, Math.hypot(vettore.x, vettore.z)) + io.pitch * 0.3, fov: 70 };
    }
  }
  const giu = me?.stato === 'terra' ? 0.5 : io.chino ? R.ALTEZZA_CHINO : R.ALTEZZA_OCCHI;
  const bob = io.movimento ? Math.abs(Math.sin(performance.now() / (io.corsa ? 130 : 190))) * (io.corsa ? 0.05 : 0.03) : 0;
  io.quota += (amb.citta.quota(io.x, io.z) - io.quota) * Math.min(1, dt * 12);
  return { x: io.x, y: io.quota + giu + bob, z: io.z, yaw: io.yaw, pitch: io.pitch, fov: io.inMira ? FOV_MIRA : FOV };
}

let ultimoFotogramma = performance.now();
let fps = 60;
function ciclo(ora) {
  const dt = Math.min(0.1, (ora - ultimoFotogramma) / 1000);
  ultimoFotogramma = ora;
  if (dt > 0) fps += (1 / dt - fps) * 0.05;
  if (s.fase === 'gioco' && mondo) {
    const vista = s.sonoHost ? vistaHost(ora) : vistaOspite(ora);
    const me = vista?.giocatori.find(g => g.id === s.mioId);
    if (vista && me) {
      s.vista = vista;
      sincronizzaPorteLocali(vista);
      if (!io.pronto || me.teletrasporto > io.tp) Object.assign(io, { x: me.x, z: me.z, yaw: io.pronto ? io.yaw : me.yaw, tp: me.teletrasporto, pronto: true });
      const lettura = comandi.leggi();
      const guidi = me.inAuto !== null && me.posto === 0 && me.stato === 'vivo';
      if (guidi && !io.auto) {
        const v = vista.veicoli.find(x => x.id === me.inAuto);
        if (v) io.auto = { ...v, w: 0, vita: v.vita };
        io.guardaYaw = 0;
      } else if (!guidi && io.auto) {
        io.auto = null;
        io.yaw = me.yaw;
      }
      if (guidi) {
        const yaw0 = io.yaw;
        comandi.applicaVista(io);
        io.guardaYaw = Math.max(-1.6, Math.min(1.6, io.guardaYaw + (io.yaw - yaw0))) * Math.exp(-dt * 1.5);
        io.pitch = Math.max(-0.6, Math.min(0.5, io.pitch));
        guidaLocale(lettura, me, vista, dt);
        io.yaw = io.auto.yaw + io.guardaYaw;
      } else {
        comandi.applicaVista(io);
        if (me.stato === 'vivo' && !me.inAuto) muoviAPiedi(lettura, me, dt, vista);
        else io.movimento = 0;
        if (me.inAuto) {
          const v = vista.veicoli.find(x => x.id === me.inAuto);
          if (v) {
            const [x, z] = puntiVeicolo(v).sedili[me.posto] ?? [v.x, v.z];
            io.x = x;
            io.z = z;
          }
        }
      }
      if (vista.esito && !s.esitoMostrato) {
        s.esitoMostrato = vista.esito;
        if (s.sonoHost && s.partita?.esito?.quote) s.esitoMostrato = s.partita.esito;
        audio.allarme(false);
        apriPannello('esito');
      }
      const interazione = scegliInterazione(vista, me);
      if (!s.pannello) usaArmiEAzioni(lettura, me, vista, dt, interazione);
      allinea(arsenale, me.armi ?? [RUOLI[me.ruolo].arma]);
      const vistaDisegno = io.auto ? { ...vista, veicoli: vista.veicoli.map(v => (v.id === io.auto.id ? { ...v, ...io.auto } : v)) } : vista;
      gioco.aggiorna(vistaDisegno, s.mioId, dt, mondo.ora);
      const posa = camera(me, vistaDisegno, dt);
      const armaVisibile = me.maschera && !me.inAuto && me.stato === 'vivo' && vista.fase === 'colpo';
      const arma = armaAttiva(arsenale);
      if (armaVisibile) {
        gioco.vista1p.mostra(arma.tipo);
        gioco.vista1p.aggiorna({ dt, movimento: io.movimento, mira: io.inMira, ricarica: arsenale.ricarica > 0 ? Math.min(0.999, 1 - arsenale.ricarica / arsenale.ricaricaTotale) : 0, cambio: arsenale.cambio > 0 ? 1 : 0, coltellata: 0, corsa: io.corsa, colpiRicarica: arsenale.daCaricare });
      }
      mondo.disegna(posa, dt, () => gioco.disegnaPrimaPersona(armaVisibile));
      suoni(vista, me);
      const auto = me.inAuto !== null ? (io.auto ?? vista.veicoli.find(v => v.id === me.inAuto)) : null;
      const nostra = vista.veicoli.find(v => v.nostro);
      const meta = vista.fase === 'colpo' ? (vista.fuga.attiva || vista.missione?.fatto ? amb.rifugio : amb.luogoDi(vista.colpo)?.ingresso) : null;
      hud.aggiorna({
        vista, me: { ...me, x: io.x, z: io.z, yaw: posa.yaw }, interazione, arma: armaVisibile ? arma : null, rete: testoRete(), fps, mira: io.inMira,
        soldi: s.riassunto?.giocatori?.[s.nome]?.soldi ?? null, obiettivo: obiettivo(vista, me),
        auto: auto ? { guidi, velocita: velocita(auto), vita: (auto.vita / VEICOLI[auto.tipo].vita) * 100, sacchi: nostra?.sacchi ?? 0 } : null,
        rifugio: vista.fase === 'colpo' && vista.fuga.attiva ? amb.rifugio : null, meta, polizia: me.ruolo === 'autista' || vista.fuga.polizia,
        segni: vista.fotografie ? [...vista.png.filter(p => ['guardia', 'vigilante'].includes(p.tipo) && !['morto', 'legato', 'stordito'].includes(p.stato)).map(p => [p.x, p.z, '#f87171']), ...(s.set?.telecamere ?? []).map((t, i) => [t.x, t.z, vista.telecamere[i]?.stato === 'attiva' ? '#fbbf24' : '#6b7280'])] : [],
      });
      $('clicca').hidden = comandi.bloccato || !!s.pannello;
    }
  }
  requestAnimationFrame(ciclo);
}

function suoni(vista, me) {
  const attivi = new Set();
  for (const v of vista.veicoli) {
    const d = Math.hypot(v.x - io.x, v.z - io.z);
    if (d > 120) continue;
    const mia = io.auto && v.id === io.auto.id;
    const vel = mia ? velocita(io.auto) : Math.hypot(v.vx, v.vz);
    if (!mia && vel < 0.5 && !v.polizia && !v.sirena) continue;
    attivi.add(v.id);
    audio.motore(v.id, vel, mia ? io.auto.gas ?? 0 : Math.min(1, vel / 10), mia ? 0 : d);
  }
  audio.spegniMotori(attivi);
  audio.sirene(vista.veicoli.filter(v => v.sirena).map(v => Math.hypot(v.x - io.x, v.z - io.z)));
  if (!vista.allarme.attivo) audio.allarme(false);
  else {
    audio.allarme(true);
    const luogo = amb.luogoDi(vista.colpo);
    if (luogo) audio.distanzaAllarme(Math.hypot(luogo.centro[0] - io.x, luogo.centro[1] - io.z));
  }
  const trapano = vista.casseforti.findIndex(c => c.stato === 'trapano' && !c.inceppato);
  const cf = s.set?.casseforti[trapano];
  audio.trapano(trapano >= 0, cf ? Math.hypot(cf.x - io.x, cf.z - io.z) : 0);
}

function costruisciRuoli() {
  $('ruoli').innerHTML = ELENCO_RUOLI.map(r => `<button type="button" class="ruolo" data-ruolo="${r}" aria-pressed="${r === s.ruolo}"><b>${RUOLI[r].nome}</b>${RUOLI[r].abilita}</button>`).join('');
  $('ruoli').querySelectorAll('[data-ruolo]').forEach(b => b.addEventListener('click', () => {
    s.ruolo = b.dataset.ruolo;
    salva(CHIAVE_RUOLO, s.ruolo);
    costruisciRuoli();
  }));
}

function errore(testo) {
  $('errore-inizio').textContent = testo;
}

function leggiNome() {
  const nome = pulisciNome($('nome').value);
  if (!nome) {
    errore('Scrivi il tuo nome: lo vedrà la banda.');
    $('nome').focus();
    return null;
  }
  salva(CHIAVE_NOME, nome);
  s.nome = nome;
  return nome;
}

$('crea').addEventListener('click', () => {
  if (leggiNome()) entraInStanza(true, codiceStanza());
});
$('entra').addEventListener('click', () => {
  if (!leggiNome()) return;
  const codice = normalizzaCodice($('codice').value);
  if (!codice) {
    errore('Il codice ha 4 lettere (es. KXRT).');
    $('codice').focus();
    return;
  }
  entraInStanza(false, codice);
});
$('modulo-inizio').addEventListener('submit', e => e.preventDefault());
$('nome').addEventListener('keydown', e => {
  if (e.key !== 'Enter' || $('crea').disabled) return;
  e.preventDefault();
  ($('codice').value.trim() ? $('entra') : $('crea')).click();
});
$('copia').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('link').value);
    $('copia').textContent = 'Copiato!';
  } catch {
    $('link').select();
    $('copia').textContent = 'Premi Ctrl+C';
  }
});
$('parti').addEventListener('click', () => partiComeHost(null));
$('pannello-chiudi').addEventListener('click', () => chiudiPannello());
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && s.pannello && s.pannello !== 'esito') chiudiPannello();
});
comandi.suBlocco(bloccato => {
  if (bloccato) audio.prepara();
});

$('nome').value = leggiSalvato(CHIAVE_NOME) ?? '';
$('grafica').value = leggiScelta();
$('grafica').options[0].textContent = `Automatica (${LIVELLI[livelloAttivo()].nome})`;
$('grafica').addEventListener('change', () => {
  salvaScelta($('grafica').value);
  if (pulisciNome($('nome').value)) salva(CHIAVE_NOME, pulisciNome($('nome').value));
  location.reload();
});
const codiceInvito = normalizzaCodice(PARAMETRI.get('stanza'));
if (codiceInvito) {
  $('codice').value = codiceInvito;
  $('crea').classList.remove('primario');
  $('entra').classList.add('primario');
}
costruisciRuoli();
mostraSchermata('schermata-inizio');
$('nome').focus();

async function avvia() {
  const dati = await caricaDati();
  amb = creaAmbiente(dati);
  const esclusi = amb.esclusi;
  mondo = await creaMondo($('mondo'), amb.citta, { esclusi, ora: 'tramonto' });
  gioco = await creaGioco3d(mondo, amb);
  hud.preparaMinimappa(amb.citta);
  $('carico').hidden = true;
  $('crea').disabled = false;
  $('crea').textContent = 'Crea una stanza';
  $('entra').disabled = false;
  requestAnimationFrame(ciclo);
  const orologio = new Worker(new URL('./orologio-worker.js', import.meta.url));
  orologio.onmessage = tick;
}

avvia().catch(e => {
  console.error('Avvio non riuscito:', e);
  errore('Non riesco a caricare Cerano: ricarica la pagina.');
  $('carico').hidden = true;
});

if (import.meta.env.DEV) {
  window.__gioco = {
    pronto: () => !!gioco,
    stato: () => ({ fps: Math.round(fps), fase: s.fase, mioId: s.mioId, modo: s.coll?.modo ?? null, vista: s.vista, io: { ...io, auto: io.auto ? { ...io.auto } : null }, buffer: s.buffer.length, pannello: s.pannello, riassunto: s.riassunto }),
    partita: () => s.partita,
    ambiente: () => amb,
    set: () => s.set,
    vaiA(x, z, yaw = io.yaw, pitch = io.pitch) {
      Object.assign(io, { x, z, yaw, pitch });
    },
    guarda(yaw, pitch) {
      Object.assign(io, { yaw, pitch });
    },
    azione: a => inviaAzione(a),
    parti: colpo => partiComeHost(colpo),
    partiSenzaAvviso: colpo => iniziaPartita(semeCasuale(), colpo),
    mondo: () => mondo,
    interazione: () => scegliInterazione(s.vista, s.vista?.giocatori.find(g => g.id === s.mioId)),
    spara: () => {
      const me = s.vista.giocatori.find(g => g.id === s.mioId);
      sparaColpo(armaAttiva(arsenale).tipo, s.vista, me, { x: io.x, y: io.quota + R.ALTEZZA_OCCHI, z: io.z }, io.yaw, io.pitch);
    },
    auto: () => io.auto,
    guidaPer(gas, sterzo, secondi) {
      io.forzato = { gas, sterzo, fino: performance.now() + secondi * 1000 };
    },
  };
}
