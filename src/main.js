import './stile.css';
import './titolo.css';
import * as THREE from 'three';
import { caricaDati } from './citta/citta.js';
import { creaAmbiente, RIFUGIO } from './gioco/ambiente.js';
import { COLPI, colpoPerId, definizione, PREPARAZIONI, conInterni } from './gioco/colpi/indice.js';
import { R, RUOLI, ARMI, SACCHI, ATTREZZI, POTENZIAMENTI, VEICOLI, ELENCO_RUOLI, velocitaConSacco } from './gioco/regole.js';
import { creaPartita, creaMondoAperto, allestisciColpo, chiudiColpo, passo, aggiungiGiocatore, rimuoviGiocatore, interazioni, sincronizzaPorte } from './gioco/partita.js';
import { allestisci, postoAuto } from './gioco/allestimento.js';
import { faiIstantanea, espandi, interpola } from './gioco/istantanea.js';
import { guida, puntiVeicolo, velocita, creaVeicolo } from './gioco/veicoli.js';
import { creaArsenale, armaAttiva, aggiorna as aggiornaArsenale, spara, ricarica, cambia, allinea } from './gioco/arsenale.js';
import { semeCasuale } from './gioco/caso.js';
import * as camp from './gioco/campagna.js';
import { bloccaColpi } from './gioco/luoghi.js';
import { baricentro } from './citta/geometria.js';
import { apriSegnali } from './rete/segnali.js';
import { entraNelMondo, GIOCATORI_PER_MONDO } from './rete/mondoPubblico.js';
import { pulisciNome, azioneValida } from './rete/protocollo.js';
import { avviaCopertina } from './copertina.js';
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
const CHIUSURA_COLPO_S = 9;
const COLORI_AUTO = [0x8a1f1f, 0x2d3a4a, 0x3a5a3a, 0xc8c2b4, 0x1c1c1e, 0x6b4a2a, 0x9aa3ad, 0x2a4a7a];
const ALTEZZA_SEDILE = 1.15;
const CAMERA_AUTO = Object.freeze({ dietro: 6.8, su: 2.6, mira: 1.3 });

const $ = id => document.getElementById(id);
const schermate = ['schermata-inizio'].map($);
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
  rete: null,
  statoRete: null,
  presentato: false,
  chiamata: null,
  chiusuraColpo: null,
  schedaTelefono: 'banda',
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
  if (!s.rete) return '';
  const citta = `Cerano ${s.rete.mondo} · ${s.vista?.giocatori.length ?? 1} in città`;
  if (s.sonoHost) return s.ospiti.size ? `${citta} · ospiti tu` : citta;
  if (s.coll?.modo === 'diretto') return `${citta}${s.ping !== null ? ` · ${s.ping} ms` : ''}`;
  if (s.coll?.modo === 'riserva') return `${citta} · via server`;
  return `${citta} · collegamento…`;
}

function entraInCitta() {
  audio.prepara();
  s.campagna = camp.caricaCampagna();
  camp.scheda(s.campagna, s.nome);
  s.riassunto = camp.riassunto(s.campagna);
  s.fase = 'gioco';
  $('schermata-inizio').classList.add('t-uscita');
  setTimeout(() => {
    mostraSchermata(null);
    copertina?.ferma();
  }, 650);
  hud.mostra(true);
  comandi.attiva(true);
  document.activeElement?.blur();
  s.rete = entraNelMondo({
    mioId: s.mioId, locale: LOCALE, soloRiserva: SOLO_RISERVA,
    giocatoriNoti: () => s.vista?.giocatori.map(g => g.id) ?? [s.mioId],
    suStato: st => { s.statoRete = st; },
    suRuolo,
  });
  hud.messaggio('Sei a Cerano. P per il telefono: chiama la banda e scegli il colpo.', 'info');
}

function suRuolo(ruolo, coll) {
  s.coll = coll;
  s.sonoHost = ruolo === 'host';
  s.ospiti = new Map();
  s.pingOspiti = new Map();
  s.buffer = [];
  s.scarto = null;
  s.presentato = false;
  coll.suMessaggio(suMessaggio);
  if (s.sonoHost) creaMondoHost();
  else s.partita = null;
}

function puntoDiPartenza() {
  const piazze = amb.citta.dati.aree.filter(a => a.t === 'piazza');
  const piazza = piazze.sort((a, b) => Math.hypot(...baricentro(a.p)) - Math.hypot(...baricentro(b.p)))[0];
  for (let i = 0; piazza && i < 200; i++) {
    const [x0, z0, x1, z1] = [Math.min(...piazza.p.map(q => q[0])), Math.min(...piazza.p.map(q => q[1])), Math.max(...piazza.p.map(q => q[0])), Math.max(...piazza.p.map(q => q[1]))];
    const x = x0 + Math.random() * (x1 - x0);
    const z = z0 + Math.random() * (z1 - z0);
    if (!dentroAnello(x, z, piazza.p) || amb.citta.collisioni.respingi(x, z, 0.8).urto) continue;
    return { x, z, yaw: Math.random() * Math.PI * 2 };
  }
  return { x: -18, z: 10, yaw: 0 };
}

function dentroAnello(x, z, anello) {
  let d = false;
  for (let i = 0, j = anello.length - 1; i < anello.length; j = i++) {
    const [xi, zi] = anello[i];
    const [xj, zj] = anello[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) d = !d;
  }
  return d;
}

function daiAuto(stato, g) {
  if (stato.veicoli.some(v => v.di === g.id)) return;
  try {
    const posto = postoAuto(amb.citta, { ingresso: [g.x, g.z] }, { nome: 'auto' }, Math.random, { tipo: 'utilitaria', distanzaMin: 6, distanzaMax: 70 }, stato.veicoli);
    stato.veicoli.push(creaVeicolo(stato.prossimoId++, 'utilitaria', posto.x, posto.z, posto.yaw, { libera: true, di: g.id, colore: COLORI_AUTO[stato.prossimoId % COLORI_AUTO.length] }));
  } catch {
    return;
  }
}

function creaMondoHost() {
  const prima = s.vista;
  s.partita = creaMondoAperto({ seme: semeCasuale() });
  s.semeCorrente = null;
  s.colpoCorrente = null;
  s.set = null;
  gioco.preparaColpo(null, null);
  const posizione = io.pronto ? { x: io.x, z: io.z, yaw: io.yaw } : puntoDiPartenza();
  const io_ = aggiungiGiocatore(s.partita, { ...datiGiocatore(s.mioId, s.nome, s.ruolo), posizione });
  io_.teletrasporto = io.tp + 1;
  if (!io.auto) daiAuto(s.partita, io_);
  if (prima) hud.messaggio('Chi ospitava se n\'è andato: ora la città gira sul tuo computer', 'avviso');
  sincronizzaPorte(s.partita, amb);
}

function presentati() {
  s.coll?.invia({ t: 'ciao', nome: s.nome, id: s.mioId, ruolo: s.ruolo, ...(io.pronto ? { x: io.x, z: io.z, yaw: io.yaw } : {}), attrezzi: mieiAttrezzi().attrezzi, potenziamenti: mieiAttrezzi().potenziamenti });
}

function mieiAttrezzi() {
  const sch = s.campagna ? camp.scheda(s.campagna, s.nome) : { attrezzi: [], potenziamenti: [] };
  return { attrezzi: [...sch.attrezzi], potenziamenti: [...sch.potenziamenti] };
}

function datiGiocatore(id, nome, ruolo, extra = null) {
  const propri = id === s.mioId ? mieiAttrezzi() : { attrezzi: extra?.attrezzi ?? [], potenziamenti: extra?.potenziamenti ?? [] };
  return { id, nome, ruolo, attrezzi: propri.attrezzi.filter(a => Object.hasOwn(ATTREZZI, a)), potenziamenti: propri.potenziamenti.filter(x => typeof x === 'string').slice(0, 8) };
}

function aggiornaColpoLocale(seme, colpo) {
  if (seme === s.semeCorrente && colpo === s.colpoCorrente) return;
  s.semeCorrente = seme;
  s.colpoCorrente = colpo;
  const def = colpo ? definizione(colpo) : null;
  s.set = def ? allestisci(def, seme, amb.luogoDi(colpo), amb.citta) : null;
  gioco.preparaColpo(colpo, s.set);
  s.esitoMostrato = null;
  if (def) hud.messaggio(`Colpo in corso: ${def.nome} — ${def.via}`, 'avviso');
}

function suMessaggio(m, da) {
  switch (m.t) {
    case 'ciao': {
      if (!s.sonoHost || !da || m.id !== da || !s.partita) return;
      const nome = pulisciNome(m.nome) ?? 'Amico';
      const ruolo = ELENCO_RUOLI.includes(m.ruolo) ? m.ruolo : 'azione';
      const nuovo = !s.ospiti.has(da);
      const ospite = s.ospiti.get(da) ?? { nome, ruolo, remoto: null };
      Object.assign(ospite, { nome, ruolo, attrezzi: Array.isArray(m.attrezzi) ? m.attrezzi : [], potenziamenti: Array.isArray(m.potenziamenti) ? m.potenziamenti : [] });
      s.ospiti.set(da, ospite);
      if (!s.partita.giocatori.some(g => g.id === da)) {
        const posizione = Number.isFinite(m.x) && Number.isFinite(m.z) ? { x: m.x, z: m.z, yaw: m.yaw ?? 0 } : puntoDiPartenza();
        const g = aggiungiGiocatore(s.partita, { ...datiGiocatore(da, nome, ruolo, ospite), posizione });
        daiAuto(s.partita, g);
        if (nuovo) notificaTutti(`${nome} è arrivato a Cerano`, 'info');
      }
      s.rete?.aggiornaQuanti(s.partita.giocatori.length);
      return;
    }
    case 'g': {
      const ospite = s.sonoHost ? s.ospiti.get(da) : null;
      if (!ospite) return;
      ospite.remoto = { x: m.x, z: m.z, yaw: m.yaw, pitch: m.pitch, chino: m.chino, corsa: m.corsa, tp: m.tp, veicolo: m.veicolo };
      return;
    }
    case 'az':
      if (!s.sonoHost || !s.ospiti.has(da)) return;
      if (s.azioniRemote.length >= AZIONI_REMOTE_MASSIME) s.azioniRemote.shift();
      s.azioniRemote.push({ ...m.a, da });
      return;
    case 'st': {
      if (s.sonoHost || s.fase !== 'gioco') return;
      if (!m.ist.g.some(g => g.id === s.mioId)) {
        presentati();
        return;
      }
      s.presentato = true;
      aggiornaColpoLocale(m.g || null, m.ist.c);
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

function nomeDi(id) {
  return s.partita?.giocatori.find(g => g.id === id)?.nome ?? 'Qualcuno';
}

function notificaTutti(testo, tipo) {
  const e = [{ k: 'messaggio', testo, tipo }];
  suEventi(e);
  if (collegato()) s.coll.invia({ t: 'ev', eventi: e });
}

function avvisaBanda(testo, tipo, escluso = null) {
  for (const id of s.partita.banda.membri) if (id !== escluso) notifica(id, testo, tipo);
}

function gestisciBanda(a) {
  const st = s.partita;
  const b = st.banda;
  const chi = a.da;
  if (a.tipo === 'chiama') {
    if (!st.giocatori.some(g => g.id === a.a) || a.a === chi) return;
    if (b.membri.includes(a.a)) {
      notifica(chi, `${nomeDi(a.a)} è già nella banda`, 'info');
      return;
    }
    if (!b.capo || !b.membri.includes(chi)) {
      if (b.capo && st.colpo) {
        notifica(chi, 'C\'è già un colpo in corso in città: aspetta che finisca', 'avviso');
        return;
      }
      if (!b.capo) Object.assign(b, { capo: chi, membri: [chi], colpo: null, inviti: {} });
    }
    b.inviti[a.a] = { da: chi, scade: st.tempo + 40 };
    const e = [{ k: 'chiamata', a: a.a, da: chi, nome: nomeDi(chi), colpo: b.colpo }];
    if (a.a === s.mioId) suEventi(e);
    else s.coll?.inviaA(a.a, { t: 'ev', eventi: e });
    notifica(chi, `Squilla il telefono di ${nomeDi(a.a)}…`, 'info');
    return;
  }
  if (a.tipo === 'rispondi') {
    const invito = b.inviti[chi];
    delete b.inviti[chi];
    if (!invito || invito.scade < st.tempo) return;
    if (!a.si) {
      notifica(invito.da, `${nomeDi(chi)} non risponde. Peccato.`, 'avviso');
      return;
    }
    if (!b.capo) Object.assign(b, { capo: invito.da, membri: [invito.da] });
    if (!b.membri.includes(chi)) b.membri.push(chi);
    avvisaBanda(`${nomeDi(chi)} è dentro. La banda è di ${b.membri.length}.`, 'bene');
    return;
  }
  if (a.tipo === 'pianifica') {
    if (b.capo && b.capo !== chi) {
      notifica(chi, `Il colpo lo sceglie ${nomeDi(b.capo)}, il capo`, 'avviso');
      return;
    }
    if (!b.capo) Object.assign(b, { capo: chi, membri: [chi], inviti: {} });
    b.colpo = a.colpo;
    avvisaBanda(`Il piano: ${definizione(a.colpo)?.nome ?? a.colpo}. Il capo dà il via dal telefono.`, 'info');
    return;
  }
  if (a.tipo === 'avvia') {
    if (b.capo !== chi || !b.colpo) return;
    if (st.colpo) {
      notifica(chi, 'C\'è già un colpo in corso in città', 'avviso');
      return;
    }
    const preparazioni = (a.preparazioni ?? []).filter(x => typeof x === 'string').slice(0, 6);
    const campagna = { attrezzi: {}, preparazioni, veicolo: a.veicolo === 'furgone' ? 'furgone' : 'utilitaria' };
    const seme = semeCasuale();
    allestisciColpo(st, { seme, colpo: b.colpo, campagna, ambiente: amb });
    sincronizzaPorte(st, amb);
    aggiornaColpoLocale(seme, b.colpo);
    s.chiusuraColpo = null;
    avvisaBanda(`Si parte: ${definizione(b.colpo).nome}, ${definizione(b.colpo).via}. Il punto è sulla mappa.`, 'allarme');
    return;
  }
  if (a.tipo === 'lascia') {
    b.membri = b.membri.filter(id => id !== chi);
    if (b.capo === chi) b.capo = b.membri[0] ?? null;
    if (!b.membri.length) Object.assign(b, { capo: null, colpo: null, inviti: {} });
    notifica(chi, 'Hai lasciato la banda', 'info');
    avvisaBanda(`${nomeDi(chi)} ha lasciato la banda`, 'avviso');
    return;
  }
  if (a.tipo === 'attrezzi') {
    const g = st.giocatori.find(x => x.id === chi);
    if (!g) return;
    g.attrezzi = (a.attrezzi ?? []).filter(x => Object.hasOwn(ATTREZZI, x));
    g.potenziamenti = (a.potenziamenti ?? []).filter(x => typeof x === 'string').slice(0, 8);
  }
}

function avviaColpoDiProva(colpo) {
  if (!s.sonoHost || !s.partita) return;
  if (!colpo) {
    if (s.partita.colpo) chiudiColpoHost();
    return;
  }
  if (s.partita.colpo) chiudiColpoHost();
  const b = s.partita.banda;
  Object.assign(b, { capo: s.mioId, membri: s.partita.giocatori.map(g => g.id), colpo, inviti: {} });
  gestisciBanda({ tipo: 'avvia', da: s.mioId, preparazioni: [], veicolo: 'utilitaria' });
}

function chiudiColpoHost() {
  chiudiColpo(s.partita);
  aggiornaColpoLocale(null, null);
  s.chiusuraColpo = null;
}

const AZIONI_BANDA = new Set(['chiama', 'rispondi', 'pianifica', 'avvia', 'lascia', 'attrezzi']);

function eseguiAzioniHost(azioni) {
  const resto = [];
  for (const a of azioni) {
    if (AZIONI_BANDA.has(a.tipo)) gestisciBanda(a);
    else resto.push(a);
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
        suEventiMondo(e);
    }
  }
}

function panDi(x, z) {
  const ang = Math.atan2(-(x - io.x), -(z - io.z)) - (io.auto ? io.auto.yaw : io.yaw);
  return -Math.sin(ang);
}

function pulisciOspiti() {
  for (const id of [...s.ospiti.keys()]) {
    if (s.coll.silenzio(id) <= SILENZIO_RIMOZIONE_MS) continue;
    const nome = s.ospiti.get(id)?.nome;
    if (s.partita) {
      rimuoviGiocatore(s.partita, id);
      s.partita.veicoli = s.partita.veicoli.filter(v => v.di !== id || v.posti.some(Boolean));
      const b = s.partita.banda;
      b.membri = b.membri.filter(x => x !== id);
      if (b.capo === id) b.capo = b.membri[0] ?? null;
      if (!b.membri.length) Object.assign(b, { capo: null, colpo: null, inviti: {} });
    }
    s.ospiti.delete(id);
    s.pingOspiti.delete(id);
    s.coll.rimuovi(id);
    if (nome) notificaTutti(`${nome} ha lasciato Cerano`, 'info');
    s.rete?.aggiornaQuanti(s.partita?.giocatori.length ?? 1);
  }
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
    const fine = eventi.find(e => e.k === 'fine');
    if (fine && p.colpo) {
      const membri = p.banda.membri.length ? p.banda.membri : p.giocatori.map(g => g.id);
      const quota = fine.vinto ? Math.floor(fine.totale / Math.max(1, membri.length)) : 0;
      p.esito.quote = membri.map(id => ({ nome: nomeDi(id), quota }));
      for (const id of membri) {
        const e = [{ k: 'bottino', a: id, colpo: p.colpo, vinto: fine.vinto, totale: fine.totale, quota }];
        if (id === s.mioId) suEventi(e);
        else s.coll?.inviaA(id, { t: 'ev', eventi: e });
      }
      s.chiusuraColpo = p.tempo + CHIUSURA_COLPO_S;
    }
    if (s.chiusuraColpo !== null && s.chiusuraColpo !== undefined && p.tempo >= s.chiusuraColpo) chiudiColpoHost();
    if (eventi.length && collegato()) s.coll.invia({ t: 'ev', eventi });
    if (eventi.length) suEventi(eventi);
  }
  const ogni = ISTANTANEE_OGNI_MS[modoRete()];
  if (p && collegato() && ora - s.ultimaIstantanea >= ogni) {
    s.coll.invia({ t: 'st', g: p.semeColpo ?? 0, ist: faiIstantanea(p) }, { veloce: true });
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
    if (!s.sonoHost && !s.presentato && ora - s.ultimoCiao > CIAO_OGNI_MS) {
      presentati();
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

function suEventiMondo(e) {
  if (e.k === 'chiamata' && e.a === s.mioId) {
    s.chiamata = { da: e.da, nome: e.nome, colpo: e.colpo, fino: performance.now() + 30000 };
    audio.squillo?.();
    mostraChiamata();
  } else if (e.k === 'bottino' && e.a === s.mioId) {
    const def = definizione(e.colpo);
    if (def?.preparazione && e.vinto) camp.registraPreparazione(s.campagna, def.per, def.preparazione);
    else if (!def?.preparazione) camp.registraEsito(s.campagna, e.colpo, { vinto: e.vinto, totale: e.quota }, [s.nome]);
    camp.salvaCampagna(s.campagna);
    s.riassunto = camp.riassunto(s.campagna);
    if (e.vinto) hud.messaggio(`La tua parte: ${euro(e.quota)}`, 'bene');
  }
}

function mostraChiamata() {
  const c = s.chiamata;
  const box = $('chiamata');
  if (!c) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  $('chiamata-chi').textContent = c.nome;
  $('chiamata-cosa').textContent = c.colpo ? `Ha un piano: ${definizione(c.colpo)?.nome ?? ''}` : 'Ti vuole nella banda';
}

function rispondi(si) {
  if (!s.chiamata) return;
  inviaAzione({ tipo: 'rispondi', si });
  s.chiamata = null;
  mostraChiamata();
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
  if (!me.inAuto) {
    const [mx, mz] = gioco.rifugio.mappa;
    if (Math.hypot(mx - io.x, mz - io.z) < DISTANZA_RIFUGIO_TAVOLO) return { chiave: 'ui:colpi', testo: 'La mappa dei colpi', tempo: 0, x: mx, z: mz };
    const [bx, bz] = gioco.rifugio.banco;
    if (Math.hypot(bx - io.x, bz - io.z) < DISTANZA_RIFUGIO_TAVOLO) return { chiave: 'ui:banco', testo: 'Banco degli attrezzi', tempo: 0, x: bx, z: bz };
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
    if (a === 'telefono') apriPannello('telefono');
    else if (a === 'rispondi' && s.chiamata) rispondi(true);
    else if (a === 'rifiuta' && s.chiamata) rispondi(false);
    else if (a === 'maschera' && !me.maschera && vista.fase === 'colpo') inviaAzione({ tipo: 'maschera' });
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
    if (interazione.chiave === 'ui:colpi') {
      s.schedaTelefono = 'colpi';
      apriPannello('telefono');
    } else if (interazione.chiave.startsWith('ui:')) apriPannello(interazione.chiave.slice(3));
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
  const banda = vista.banda ?? { capo: null, membri: [], colpo: null };
  const mio = banda.membri.includes(s.mioId);
  if (vista.fase !== 'colpo' || (!mio && banda.membri.length)) {
    if (vista.fase === 'colpo') return `Rapina in corso: ${definizione(vista.colpo)?.nome ?? ''}. Non è la tua banda.`;
    if (!mio) return 'Cerano è tua. P: telefono — chiama qualcuno o scegli un colpo e parti da solo. Le auto con la chiave sono tue.';
    const capo = banda.capo === s.mioId ? 'Tu sei il capo' : `Il capo è ${vista.giocatori.find(g => g.id === banda.capo)?.nome ?? '?'}`;
    if (!banda.colpo) return `Banda di ${banda.membri.length}. ${capo}: il colpo si sceglie dal telefono (P).`;
    return `Piano: ${definizione(banda.colpo)?.nome ?? ''}. ${capo}: si parte dal telefono (P).`;
  }
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

function schedaBanda(vista) {
  const banda = vista?.banda ?? { capo: null, membri: [], colpo: null };
  const mio = banda.membri.includes(s.mioId);
  const persone = vista?.giocatori ?? [];
  const membri = persone.filter(g => banda.membri.includes(g.id));
  const altri = persone.filter(g => g.id !== s.mioId && !banda.membri.includes(g.id));
  return `<div class="tel-blocco"><h3>La tua banda</h3>${mio ? `<ul class="tel-lista">${membri.map(g => `<li><b>${pulisciNome(g.nome)}</b><span>${RUOLI[g.ruolo]?.nome ?? ''}${g.id === banda.capo ? ' · capo' : ''}</span></li>`).join('')}</ul><button data-lascia>Lascia la banda</button>` : '<p class="tel-nota">Sei da solo. Chiama qualcuno qui sotto, oppure scegli un colpo: chi ti risponde entra nella banda.</p>'}</div>
    <div class="tel-blocco"><h3>In città adesso</h3>${altri.length ? `<ul class="tel-lista">${altri.map(g => `<li><b>${pulisciNome(g.nome)}</b><span>${RUOLI[g.ruolo]?.nome ?? ''}</span><button data-chiama="${g.id}">📞 Chiama</button></li>`).join('')}</ul>` : persone.length > 1 ? '<p class="tel-nota">Tutti quelli in città sono già nella tua banda.</p>' : '<p class="tel-nota">Per ora sei l\'unico in città. Chi apre il sito entra qui con te.</p>'}</div>`;
}

function schedaColpi(vista) {
  const ria = s.riassunto;
  const banda = vista?.banda ?? { capo: null, membri: [], colpo: null };
  const comando = !banda.capo || banda.capo === s.mioId;
  return `<div class="colpi">${COLPI.map(def => {
    const c = ria?.colpi?.[def.id];
    const aperto = c?.sbloccato ?? def.ordine === 1;
    const scelto = banda.colpo === def.id;
    const preps = (def.preparazioni ?? []).map(id => {
      const fatta = c?.preparazioni?.includes(id);
      return `<span class="prep ${fatta ? 'fatta' : ''}">${fatta ? '✓ ' : ''}${PREPARAZIONI[id].nome}${aperto && !fatta && comando ? ` <button data-pianifica="prep:${id}">Scegli</button>` : ''}</span>`;
    }).join('');
    const azione = !aperto ? '' : scelto && comando ? `<button class="primario" data-avvia="${def.id}">SI PARTE</button>` : comando ? `<button class="primario" data-pianifica="${def.id}">Scegli</button>` : scelto ? '<span class="tel-nota">Il piano del capo</span>' : '';
    return `<div class="colpo ${aperto ? '' : 'chiuso'} ${scelto ? 'scelto' : ''}"><div><h3>${def.ordine}. ${def.nome}</h3><p>${def.via} — ${def.breve}</p><p>${c?.fatti ? `Fatto ${c.fatti} volte, migliore ${euro(c.migliore)}` : aperto ? 'Mai tentato' : 'Si sblocca col colpo precedente'}</p>${preps ? `<div class="preps">${preps}</div>` : ''}</div><div>${azione}</div></div>`;
  }).join('')}</div>${banda.colpo?.startsWith('prep:') && comando ? `<p><button class="primario" data-avvia="${banda.colpo}">SI PARTE: ${definizione(banda.colpo)?.nome ?? ''}</button></p>` : ''}`;
}

function avviaDalTelefono(colpo) {
  const base = definizione(colpo)?.preparazione ? definizione(colpo).per : colpo;
  inviaAzione({ tipo: 'avvia', preparazioni: s.campagna ? camp.preparazioniFatte(s.campagna, base) : [], veicolo: s.campagna ? camp.veicoloColpo(s.campagna, base) : 'utilitaria' });
  chiudiPannello();
}

function aggiornaPannello() {
  const corpo = $('pannello-corpo');
  const ria = s.riassunto;
  if (s.pannello === 'telefono') {
    $('pannello-titolo').textContent = `📱 ${s.nome} · ${euro(ria?.giocatori?.[s.nome]?.soldi ?? 0)}`;
    const schede = { banda: 'Banda', colpi: 'Colpi' };
    corpo.innerHTML = `<div class="tel-schede">${Object.entries(schede).map(([k, n]) => `<button data-scheda="${k}" class="${s.schedaTelefono === k ? 'attiva' : ''}">${n}</button>`).join('')}</div>${s.schedaTelefono === 'colpi' ? schedaColpi(s.vista) : schedaBanda(s.vista)}<p class="tasti">P chiude · gli attrezzi si comprano al banco della cascina di Via Ranzina</p>`;
    corpo.querySelectorAll('[data-scheda]').forEach(b => b.addEventListener('click', () => { s.schedaTelefono = b.dataset.scheda; aggiornaPannello(); }));
    corpo.querySelectorAll('[data-chiama]').forEach(b => b.addEventListener('click', () => inviaAzione({ tipo: 'chiama', a: b.dataset.chiama })));
    corpo.querySelectorAll('[data-lascia]').forEach(b => b.addEventListener('click', () => inviaAzione({ tipo: 'lascia' })));
    corpo.querySelectorAll('[data-pianifica]').forEach(b => b.addEventListener('click', () => { inviaAzione({ tipo: 'pianifica', colpo: b.dataset.pianifica }); setTimeout(aggiornaPannello, 300); }));
    corpo.querySelectorAll('[data-avvia]').forEach(b => b.addEventListener('click', () => avviaDalTelefono(b.dataset.avvia)));
  } else if (s.pannello === 'mappa') {
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
  } else if (s.pannello === 'banco') {
    $('pannello-titolo').textContent = 'Banco degli attrezzi';
    const mia = ria?.giocatori?.[s.nome] ?? { soldi: 0, attrezzi: [], potenziamenti: [] };
    corpo.innerHTML = `<p>Hai <b>${euro(mia.soldi)}</b>. Gli attrezzi restano tuoi per tutta la campagna (il kit medico si consuma).</p>
      <div class="negozio">${Object.entries(ATTREZZI).map(([k, a]) => `<div class="voce"><b>${a.nome}</b><span>${a.descrizione}</span><span class="costo">${euro(a.costo)}</span>${mia.attrezzi.includes(k) ? '<span>Ce l\'hai</span>' : `<button data-compra="${k}" ${mia.soldi < a.costo ? 'disabled' : ''}>Compra</button>`}</div>`).join('')}</div>
      <h3>Potenziamenti da ${RUOLI[s.ruolo].nome}</h3>
      <div class="negozio">${POTENZIAMENTI[s.ruolo].map(p => `<div class="voce"><b>${p.nome}</b><span>${p.effetto}</span><span class="costo">${euro(p.costo)}</span>${mia.potenziamenti.includes(p.nome) ? '<span>Ce l\'hai</span>' : `<button data-potenzia="${p.nome}" ${mia.soldi < p.costo ? 'disabled' : ''}>Compra</button>`}</div>`).join('')}</div>`;
    const dopoAcquisto = esito => {
      hud.messaggio(esito.ok ? 'Comprato' : esito.motivo, esito.ok ? 'bene' : 'avviso');
      camp.salvaCampagna(s.campagna);
      s.riassunto = camp.riassunto(s.campagna);
      inviaAzione({ tipo: 'attrezzi', ...mieiAttrezzi() });
      aggiornaPannello();
    };
    corpo.querySelectorAll('[data-compra]').forEach(b => b.addEventListener('click', () => dopoAcquisto(camp.compra(s.campagna, s.nome, b.dataset.compra))));
    corpo.querySelectorAll('[data-potenzia]').forEach(b => b.addEventListener('click', () => dopoAcquisto(camp.potenzia(s.campagna, s.nome, s.ruolo, b.dataset.potenzia))));
  } else if (s.pannello === 'esito') {
    const e = s.esitoMostrato;
    $('pannello-titolo').textContent = e?.preparazione ? (e.vinto ? 'Preparazione riuscita' : 'Preparazione fallita') : e?.vinto ? 'Colpo riuscito' : 'Colpo fallito';
    corpo.innerHTML = `<div class="esito"><h3>${e?.preparazione ? (e.vinto ? PREPARAZIONI[e.preparazione]?.nome ?? '' : 'Da rifare') : e?.vinto ? euro(e.totale) : 'Niente bottino'}</h3>
      <p>${e?.vinto ? `${e.sacchi} sacchi, ${e.pulito ? 'senza allarme (+20%)' : 'con l\'allarme'} in ${Math.floor(e.durata / 60)} min ${e.durata % 60} s` : 'La polizia vi ha presi.'}</p>
      <table>${(e?.giocatori ?? []).map(g => `<tr><td>${g.nome}</td><td>${RUOLI[g.ruolo]?.nome ?? ''}</td><td>${g.stato === 'arrestato' ? 'arrestato' : 'libero'}</td><td>${e.quote?.find(q => q.nome === g.nome) ? euro(e.quote.find(q => q.nome === g.nome).quota) : ''}</td></tr>`).join('')}</table>
      <button class="primario" id="torna">Torna in città</button></div>`;
    $('torna')?.addEventListener('click', () => chiudiPannello());
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
      if (vista.esito && !s.esitoMostrato && vista.banda?.membri?.includes(s.mioId)) {
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
      const nellaBanda = vista.banda?.membri?.includes(s.mioId);
      const meta = vista.fase === 'colpo' && nellaBanda ? (vista.fuga.attiva || vista.missione?.fatto ? amb.rifugio : amb.luogoDi(vista.colpo)?.ingresso) : null;
      if (s.chiamata && performance.now() > s.chiamata.fino) {
        s.chiamata = null;
        mostraChiamata();
      }
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
  const giri = ['-3deg', '2deg', '-1.5deg', '3deg'];
  const breve = { scassinatore: 'Serrature e casseforti a orecchio', hacker: 'Telecamere, porte elettroniche', autista: 'Auto senza chiavi, guida da paura', azione: 'Due sacchi, ostaggi, botte' };
  $('ruoli').innerHTML = ELENCO_RUOLI.map((r, i) => `<button type="button" class="segnaletica" style="--giro:${giri[i % giri.length]}" title="${RUOLI[r].abilita}" data-ruolo="${r}" aria-pressed="${r === s.ruolo}"><span class="foto"><img src="./copertina/ritratto-${r}.png" alt="" onerror="this.remove()"></span><span class="targa">N° ${427 + i * 113} · CERANO<b>${RUOLI[r].nome}</b><em>${breve[r] ?? ''}</em></span></button>`).join('');
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

$('entra-citta').addEventListener('click', () => {
  if (!gioco || s.fase === 'gioco') return;
  if (leggiNome()) entraInCitta();
});
$('modulo-inizio').addEventListener('submit', e => e.preventDefault());
$('nome').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  $('entra-citta').click();
});
$('chiamata-si').addEventListener('click', () => rispondi(true));
$('chiamata-no').addEventListener('click', () => rispondi(false));
$('pannello-chiudi').addEventListener('click', () => chiudiPannello());
window.addEventListener('keydown', e => {
  if ((e.key === 'Escape' || (e.code === 'KeyP' && s.pannello === 'telefono')) && s.pannello && s.pannello !== 'esito') {
    e.preventDefault();
    chiudiPannello();
  } else if (s.chiamata && e.code === 'KeyY') rispondi(true);
  else if (s.chiamata && e.code === 'KeyN') rispondi(false);
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
costruisciRuoli();
const copertina = avviaCopertina();
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
  $('entra-citta').disabled = false;
  $('entra-citta').querySelector('span').textContent = 'ENTRA IN CERANO';
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
    parti: colpo => avviaColpoDiProva(colpo),
    partiSenzaAvviso: colpo => avviaColpoDiProva(colpo),
    entra: () => entraInCitta(),
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
