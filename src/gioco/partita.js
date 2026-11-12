import { R, RUOLI, ARMI, PNG, SOSPETTO, POLIZIA, SACCHI, VEICOLI, tempoAzione, velocitaConSacco, fattoreGiocatori, RUMORE_SILENZIATO } from './regole.js';
import { passoCaso } from './caso.js';
import { creaVeicolo, guida, puntiVeicolo, velocita, cerchiVeicolo, urtaVeicolo, avanti } from './veicoli.js';
import { bloccaVista } from './luoghi.js';
import { allestisci } from './allestimento.js';
import { puntoAvanti } from '../citta/strade.js';
import { definizione } from './colpi/indice.js';

const TOLLERANZA_POSIZIONE = 1.2;
const VISTA_OGNI = 0.12;
const DISTANZA_PNG_USO = 1.6;
const SOGLIA_PANICO = 1;
const ATTESA_PULSANTE = 1.2;
const CHIAMATA_CIVILE = 7;
const TEMPO_RADIO = 2.5;
const SPARO_OGNI = [0.7, 1.3];
const PORTATA_SPARO_PNG = 45;
const DANNO_PNG = { pistola: 9, revolver: 14, carabina: 11 };
const CALO_PRECISIONE = 30;
const AGENTI_PER_VOLANTE = 2;
const DISTANZA_ARRIVO_VOLANTE = 22;
const ZONA_CALDA = 160;
const RAGGIO_RIFUGIO = 30;
const RITARDO_LANCIO = 0.25;
const TRAPANO_INCEPPA = 0.025;
const DURATA_LOOP = 60;
const ARRIVO_RANDOM = 260;
const INSEGUIMENTO_VISTA = 70;
const FUGA_POLIZIA_AVVIO = 3;
const VOLANTI_FUGA_MAX = 5;

const distanza = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angolo = a => Math.atan2(Math.sin(a), Math.cos(a));

function caso(stato) {
  const [v, n] = passoCaso(stato.rng);
  stato.rng = n;
  return v;
}

function messaggio(eventi, testo, tipo = 'info', a = null) {
  eventi.push({ k: 'messaggio', testo, tipo, a });
}

export function creaRifugio({ seme, giocatori = [], campagna = null, ambiente }) {
  const stato = {
    seme: seme >>> 0, rng: seme >>> 0, tempo: 0, fase: 'rifugio', colpo: null, prossimoId: 1, giocatori: [], png: [], telecamere: [], porte: {}, casseforti: [],
    biglietti: [], casse: [], vetrine: [], pulsanti: [], sacchi: [], veicoli: [], allarme: { attivo: false }, polizia: { ondata: 0 }, esito: null,
    statistiche: {}, campagna, attrezzi: {}, fuga: {},
  };
  const [rx, rz] = ambiente.rifugio;
  const [ax, az] = ambiente.rifugioAuto;
  stato.veicoli.push(creaVeicolo(stato.prossimoId++, campagna?.veicolo ?? 'utilitaria', ax, az, ambiente.rifugioYaw, { nostro: true }));
  giocatori.forEach((g, i) => {
    const nuovo = aggiungiGiocatore(stato, g);
    nuovo.x = rx + (i % 2) * 1.5 - 0.75;
    nuovo.z = rz + Math.floor(i / 2) * 1.5;
  });
  return stato;
}

export function creaPartita({ seme, colpo, giocatori = [], campagna = null, ambiente }) {
  const luogo = ambiente.luogoDi(colpo);
  const def = definizione(colpo);
  const preparazioni = campagna?.preparazioni ?? [];
  const set = allestisci(def, seme, luogo, ambiente.citta);
  const stato = {
    seme: seme >>> 0,
    rng: (seme ^ 0x9e3779b9) >>> 0,
    tempo: 0,
    fase: 'colpo',
    colpo,
    prossimoId: 1,
    giocatori: [],
    png: [],
    telecamere: set.telecamere.map(t => ({ ...t, yaw0: t.yaw, stato: 'attiva', sospetto: 0, loopFino: 0, fase: caso({ rng: seme }) * 6 })),
    luogo: luogo.def.id,
    scadenza: def.scadenza ?? null,
    tessera: preparazioni.includes('tessera'),
    fotografie: preparazioni.includes('fotografie'),
    missione: def.preparazione ? { tipo: def.preparazione, fatto: false, foto: [], obiettivi: set.foto ?? [] } : null,
    oggetti: set.oggetti ?? [],
    porte: Object.fromEntries(set.porte.map(p => [p.id, { aperta: p.aperta, serratura: p.serratura, progresso: 0 }])),
    casseforti: set.casseforti.map(c => ({ ...c, stato: 'chiusa', progresso: 0, trapano: null, codiceNoto: false })),
    biglietti: set.biglietti.map(b => ({ ...b, letto: false })),
    casse: set.casse.map(c => ({ ...c, piena: true })),
    vetrine: set.vetrine.map(v => ({ ...v, rotta: false, vuota: false })),
    pulsanti: set.pulsanti,
    sacchi: [],
    veicoli: [],
    allarme: { attivo: false, tempo: 0, motivo: null, polizia: null, lineaTagliata: preparazioni.includes('linea'), ritardo: 0 },
    polizia: { ondata: 0, prossima: null, arrivate: 0 },
    esito: null,
    statistiche: { uccisi: 0, legati: 0, sparatoria: false, inizio: 0 },
    campagna,
    attrezzi: { ...(campagna?.attrezzi ?? {}), termico: preparazioni.includes('trapano') },
    fuga: { polizia: false, lontano: 0, attiva: false },
  };
  for (const s of set.sacchi) creaSacco(stato, s.tipo, s.valore, s.x, 0.25, s.z);
  for (const p of set.png) {
    const tipo = PNG[p.tipo];
    const g0 = p.giro[p.inizio];
    stato.png.push({
      id: stato.prossimoId++, tipo: p.tipo, nome: p.nome, cliente: p.cliente, x: g0.x, z: g0.z, yaw: 0, vita: tipo.vita,
      stato: 'giro', sospetto: 0, giro: p.giro, tappa: p.inizio, sosta: g0.sosta, timer: 0, punto: null, bersaglio: null,
      attesaVista: caso(stato) * VISTA_OGNI, attesaSparo: 1, uscita: p.uscita, visto: null, motivo: null, percorso: null, ip: 0, tessera: p.tessera, indice: p.indice,
    });
  }
  const a = set.auto;
  stato.veicoli.push(creaVeicolo(stato.prossimoId++, campagna?.veicolo ?? def.auto?.tipo ?? 'utilitaria', a.x, a.z, a.yaw, { nostro: true, acceso: false }));
  if (set.blindato) stato.veicoli.push(creaVeicolo(stato.prossimoId++, 'blindato', set.blindato.x, set.blindato.z, set.blindato.yaw, { blindato: true }));
  if (set.daRubare) stato.veicoli.push(creaVeicolo(stato.prossimoId++, 'furgone', set.daRubare.x, set.daRubare.z, set.daRubare.yaw, { daRubare: true, colore: 0xdcdcd6 }));
  giocatori.forEach(g => aggiungiGiocatore(stato, g));
  return stato;
}

export function aggiungiGiocatore(stato, { id, nome, ruolo = 'scassinatore', attrezzi = [], potenziamenti = [] }) {
  const esistente = stato.giocatori.find(g => g.id === id);
  if (esistente) {
    esistente.nome = nome;
    return esistente;
  }
  const auto = stato.veicoli.find(v => v.nostro);
  const [rx, rz] = auto ? [Math.cos(auto.yaw), -Math.sin(auto.yaw)] : [1, 0];
  const n = stato.giocatori.length;
  const [fx, fz] = auto ? avanti(auto) : [0, -1];
  const x = (auto?.x ?? 0) - rx * 2.6 + fx * (n - 1.5) * 1.1;
  const z = (auto?.z ?? 0) - rz * 2.6 + fz * (n - 1.5) * 1.1;
  const info = RUOLI[ruolo] ?? RUOLI.scassinatore;
  const vitaMax = Math.round(R.VITA * (info.vita ?? 1) + (potenziamenti.includes('Pelle dura') ? 40 : 0));
  const g = {
    id, nome, ruolo, x, z, yaw: auto ? auto.yaw : 0, pitch: 0, chino: false, corsa: false, vita: vitaMax, vitaMax,
    giubbotto: attrezzi.includes('giubbotto') ? R.GIUBBOTTO : 0, stato: 'vivo', timerTerra: 0, maschera: false, sacchi: [], arma: info.arma,
    armi: [info.arma, ...(attrezzi.includes('carabina') ? ['carabina'] : [])], inAuto: null, posto: -1, uso: null, fascette: attrezzi.includes('fascette') ? 8 : R.FASCETTE,
    attrezzi, potenziamenti, kit: attrezzi.includes('kit'), ultimoDanno: -99, teletrasporto: 1, bottinoPortato: 0, uccisioni: 0,
  };
  stato.giocatori.push(g);
  return g;
}

export function rimuoviGiocatore(stato, id) {
  const g = stato.giocatori.find(x => x.id === id);
  if (!g) return;
  for (const s of stato.sacchi) if (s.portatoDa === id) lasciaSacco(stato, g, s);
  if (g.inAuto) esciAuto(stato, g, []);
  stato.giocatori = stato.giocatori.filter(x => x.id !== id);
}

function creaSacco(stato, tipo, valore, x, y, z) {
  const s = { id: stato.prossimoId++, tipo, valore, x, y, z, vx: 0, vy: 0, vz: 0, inVolo: false, portatoDa: null, veicolo: null, lanciatoDa: null, attesa: 0 };
  stato.sacchi.push(s);
  return s;
}

function lasciaSacco(stato, g, s) {
  s.portatoDa = null;
  s.x = g.x;
  s.z = g.z;
  s.y = 0.25;
  g.sacchi = g.sacchi.filter(id => id !== s.id);
}

const vivi = stato => stato.giocatori.filter(g => g.stato === 'vivo');
const auto = stato => stato.veicoli.find(v => v.nostro);

function rumore(stato, x, z, raggio, tipo, eventi) {
  eventi.push({ k: 'rumore', x, z, raggio, tipo });
  for (const p of stato.png) {
    if (!['giro', 'sospetto'].includes(p.stato)) continue;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d > raggio) continue;
    if (tipo === 'sparo' || tipo === 'vetro' || tipo === 'esplosione') {
      if (PNG[p.tipo].armato) avviaAllarmePng(stato, p, 'ha sentito degli spari', eventi);
      else panico(stato, p, eventi);
    } else {
      p.sospetto = Math.min(0.95, p.sospetto + SOSPETTO.rumore * (1 - d / raggio));
      p.stato = 'sospetto';
      p.punto = { x, z };
      p.timer = 6;
    }
  }
}

export function scattaAllarme(stato, motivo, eventi) {
  const a = stato.allarme;
  if (a.attivo) return;
  a.attivo = true;
  a.tempo = stato.tempo;
  a.motivo = motivo;
  const n = stato.giocatori.length;
  const hacker = stato.giocatori.some(g => g.ruolo === 'hacker');
  const centralino = stato.giocatori.some(g => g.potenziamenti.includes('Centralino'));
  const base = (definizione(stato.colpo)?.polizia?.attesa ?? POLIZIA.attesaBase) / fattoreGiocatori(n) * 1.15;
  const ritardo = (a.lineaTagliata ? 45 : 0) + (hacker ? RUOLI.hacker.ritardoChiamata : 0) + (centralino ? 30 : 0);
  stato.polizia.prossima = stato.tempo + base + ritardo;
  stato.statistiche.sparatoria = true;
  eventi.push({ k: 'allarme', motivo });
  messaggio(eventi, `Allarme! ${motivo}. La polizia arriva fra ${Math.round(base + ritardo)} secondi`, 'allarme');
  for (const p of stato.png) {
    if (p.stato === 'legato' || p.stato === 'morto' || p.stato === 'stordito') continue;
    if (PNG[p.tipo].armato) p.stato = 'combatte';
    else if (p.stato !== 'a terra') panico(stato, p, eventi, true);
  }
}

let luogoCorrente = null;
const luogoDi = () => luogoCorrente;

function panico(stato, p, eventi, silenzioso = false) {
  if (['legato', 'morto', 'stordito', 'fuggito', 'a terra'].includes(p.stato)) return;
  if (p.stato === 'panico') return;
  p.stato = 'panico';
  p.timer = 0;
  const pulsante = stato.pulsanti[0];
  p.meta = !stato.allarme.attivo && pulsante && p.tipo === 'titolare' ? { x: pulsante.x, z: pulsante.z, pulsante: true } : { x: p.uscita[0], z: p.uscita[1], fuga: true };
  p.percorso = null;
  if (!silenzioso) eventi.push({ k: 'urlo', x: p.x, z: p.z, id: p.id });
}

function avviaAllarmePng(stato, p, motivo, eventi) {
  if (stato.allarme.attivo) {
    p.stato = 'combatte';
    return;
  }
  p.stato = 'radio';
  p.timer = TEMPO_RADIO;
  p.motivo = motivo;
  eventi.push({ k: 'radio', id: p.id });
}

function puoVedere(stato, amb, da, x, z, portata, ampiezza, yaw) {
  const dx = x - da.x;
  const dz = z - da.z;
  const d = Math.hypot(dx, dz);
  if (d > portata) return 0;
  const direzione = Math.atan2(-dx, -dz);
  if (Math.abs(angolo(direzione - yaw)) > ampiezza / 2 && d > 1.2) return 0;
  if (!amb.citta.collisioni.libero(da.x, da.z, x, z, bloccaVista)) return 0;
  return 1 - (d / portata) * 0.65;
}

function stimolo(stato, luogo, g) {
  if (g.stato !== 'vivo') return 0;
  if (g.inAuto) return 0;
  let s = 0;
  if (g.maschera) s = SOSPETTO.mascherato;
  else if (luogo.privata(g.x, g.z)) s = SOSPETTO.sconosciuto;
  if (g.sacchi.length) s = Math.max(s, SOSPETTO.sacco);
  return s * (g.chino ? 0.6 : 1);
}

function aggiornaVistaPng(stato, amb, luogo, p, dt, eventi) {
  const t = PNG[p.tipo];
  const portata = t.vista * (luogo.dentro(p.x, p.z) ? 1 : stato.fuoriBuio ?? 1);
  let migliore = null;
  for (const g of stato.giocatori) {
    const s = stimolo(stato, luogo, g);
    if (s <= 0) continue;
    const v = puoVedere(stato, amb, p, g.x, g.z, portata * (g.chino ? 0.7 : 1), t.angolo * 2, p.yaw);
    if (!v) continue;
    const valore = s * v;
    if (!migliore || valore > migliore.valore) migliore = { g, valore };
  }
  for (const altro of stato.png) {
    if (altro === p || !['legato', 'morto', 'stordito', 'a terra'].includes(altro.stato)) continue;
    if (!puoVedere(stato, amb, p, altro.x, altro.z, portata * 0.7, t.angolo * 2, p.yaw)) continue;
    if (!migliore || SOSPETTO.corpo > migliore.valore) migliore = { corpo: altro, valore: SOSPETTO.corpo };
  }
  return migliore;
}

function vaiVerso(stato, amb, p, meta, velocitaPng, dt) {
  const d = Math.hypot(meta.x - p.x, meta.z - p.z);
  if (d < 0.15) return true;
  let bersaglio = meta;
  if (!amb.citta.collisioni.libero(p.x, p.z, meta.x, meta.z)) {
    const nav = amb.navigazione?.(stato.luogo);
    const stessaMeta = p.metaPercorso && Math.hypot(meta.x - p.metaPercorso.x, meta.z - p.metaPercorso.z) < 1.5;
    if (nav && stato.tempo >= (p.prossimoPercorso ?? 0) && (!p.percorso || !stessaMeta) && stato.percorsiPasso < 1) {
      stato.percorsiPasso += 1;
      p.percorso = nav.percorso({ x: p.x, z: p.z }, meta);
      p.metaPercorso = { x: meta.x, z: meta.z };
      p.prossimoPercorso = stato.tempo + 0.6 + caso(stato) * 0.4;
      p.ip = 1;
    }
    if (p.percorso && p.ip < p.percorso.length) {
      bersaglio = p.percorso[p.ip];
      if (Math.hypot(bersaglio.x - p.x, bersaglio.z - p.z) < 0.4) p.ip += 1;
    }
  } else p.percorso = null;
  const dx = bersaglio.x - p.x;
  const dz = bersaglio.z - p.z;
  const l = Math.hypot(dx, dz) || 1;
  const passo = Math.min(l, velocitaPng * dt);
  const esito = amb.citta.collisioni.muoviCerchio(p.x, p.z, (dx / l) * passo, (dz / l) * passo, R.RAGGIO_PNG);
  p.x = esito.x;
  p.z = esito.z;
  p.yaw = Math.atan2(-dx, -dz);
  p.muove = velocitaPng;
  apriPorteVicine(stato, amb, p);
  return d < 0.3;
}

function apriPorteVicine(stato, amb, p) {
  for (const [id, seg] of amb.porte.get(stato.luogo) ?? []) {
    const porta = stato.porte[id];
    if (porta.aperta || porta.serratura) continue;
    const mx = (seg.ax + seg.bx) / 2;
    const mz = (seg.az + seg.bz) / 2;
    if (Math.hypot(mx - p.x, mz - p.z) < 1.1) {
      porta.aperta = true;
      seg.attivo = false;
    }
  }
}

function aggiornaPng(stato, amb, luogo, dt, eventi) {
  for (const p of stato.png) {
    p.muove = 0;
    const t = PNG[p.tipo];
    if (['morto', 'legato', 'stordito', 'fuggito'].includes(p.stato)) continue;
    p.attesaVista -= dt;
    let visto = null;
    if (p.attesaVista <= 0) {
      p.attesaVista += VISTA_OGNI;
      visto = aggiornaVistaPng(stato, amb, luogo, p, VISTA_OGNI, eventi);
      p.visto = visto?.g?.id ?? null;
      p.vedeCorpo = !!visto?.corpo;
      if (visto && ['giro', 'sospetto'].includes(p.stato)) {
        p.sospetto = Math.min(1.2, p.sospetto + visto.valore * VISTA_OGNI * (t.armato ? 1 : 0.9));
        p.punto = visto.g ? { x: visto.g.x, z: visto.g.z } : { x: visto.corpo.x, z: visto.corpo.z };
        if (p.sospetto >= SOGLIA_PANICO) {
          const mascherato = visto.corpo || visto.g?.maschera || visto.g?.sacchi.length;
          if (t.armato) avviaAllarmePng(stato, p, visto.corpo ? 'ha trovato una persona a terra' : 'ha visto un rapinatore', eventi);
          else if (mascherato) panico(stato, p, eventi);
          else {
            p.stato = 'chiama';
            p.timer = CHIAMATA_CIVILE;
            messaggio(eventi, `${p.nome ?? 'Qualcuno'}: «Lei non può stare qui! Chiamo i carabinieri!»`, 'avviso');
          }
        } else if (p.stato === 'giro' && p.sospetto > 0.35) {
          p.stato = 'sospetto';
          p.timer = 5;
        }
      } else if (!visto) p.sospetto = Math.max(0, p.sospetto - SOSPETTO.calo * VISTA_OGNI);
    }
    switch (p.stato) {
      case 'giro': {
        p.tappa %= p.giro.length;
        const tappa = p.giro[p.tappa];
        if (vaiVerso(stato, amb, p, tappa, t.velocita, dt)) {
          p.sosta -= dt;
          if (p.sosta <= 0) {
            p.tappa = (p.tappa + 1) % p.giro.length;
            p.sosta = p.giro[p.tappa].sosta;
          }
        }
        break;
      }
      case 'sospetto': {
        p.timer -= dt;
        if (p.punto) {
          const d = Math.hypot(p.punto.x - p.x, p.punto.z - p.z);
          if (d > 2) vaiVerso(stato, amb, p, p.punto, t.velocita, dt);
          else p.yaw = Math.atan2(-(p.punto.x - p.x), -(p.punto.z - p.z));
        }
        if (p.timer <= 0 && p.sospetto < 0.3) {
          p.stato = 'giro';
          p.punto = null;
        }
        break;
      }
      case 'chiama':
        p.timer -= dt;
        if (p.timer <= 0) {
          scattaAllarme(stato, `${p.nome ?? 'un testimone'} ha chiamato il 112`, eventi);
          p.stato = 'giro';
        }
        break;
      case 'radio':
        p.timer -= dt;
        if (p.timer <= 0) {
          scattaAllarme(stato, `${p.nome ?? 'la guardia'} ${p.motivo} e ha dato l'allarme`, eventi);
          p.stato = 'combatte';
        }
        break;
      case 'panico': {
        const arrivato = vaiVerso(stato, amb, p, p.meta, t.corsa, dt);
        if (arrivato) {
          p.timer += dt;
          if (p.meta.pulsante && p.timer > ATTESA_PULSANTE) {
            scattaAllarme(stato, `${p.nome ?? 'il titolare'} ha premuto l'antipanico`, eventi);
            p.meta = { x: p.uscita[0], z: p.uscita[1], fuga: true };
            p.timer = 0;
          } else if (p.meta.fuga) {
            p.stato = 'fuggito';
            if (!stato.allarme.attivo) scattaAllarme(stato, `${p.nome ?? 'un testimone'} è scappato in strada urlando`, eventi);
          }
        }
        break;
      }
      case 'a terra':
        p.timer -= dt;
        if (p.timer <= 0) {
          p.stato = 'giro';
          if (PNG[p.tipo].armato) avviaAllarmePng(stato, p, 'si è liberato', eventi);
          else panico(stato, p, eventi);
          messaggio(eventi, `${p.nome ?? 'Un ostaggio'} si è rialzato!`, 'avviso');
        }
        break;
      case 'combatte':
        combatti(stato, amb, p, t, dt, eventi);
        break;
      default:
    }
  }
}

function combatti(stato, amb, p, t, dt, eventi) {
  let bersaglio = null;
  let migliore = Infinity;
  for (const g of stato.giocatori) {
    if (g.stato !== 'vivo') continue;
    const d = distanza(p, g);
    if (d > PORTATA_SPARO_PNG) continue;
    const libero = amb.citta.collisioni.libero(p.x, p.z, g.x, g.z, bloccaVista);
    if (!libero) continue;
    if (d < migliore) {
      migliore = d;
      bersaglio = g;
    }
  }
  if (!bersaglio) {
    const vicino = stato.giocatori.filter(g => g.stato === 'vivo').sort((a, b) => distanza(p, a) - distanza(p, b))[0];
    if (vicino && p.tipo === 'poliziotto') vaiVerso(stato, amb, p, { x: vicino.x, z: vicino.z }, t.velocita * 1.6, dt);
    return;
  }
  p.yaw = Math.atan2(-(bersaglio.x - p.x), -(bersaglio.z - p.z));
  if (p.tipo === 'poliziotto' && migliore > 14) vaiVerso(stato, amb, p, { x: bersaglio.x, z: bersaglio.z }, t.velocita * 1.4, dt);
  p.attesaSparo -= dt;
  if (p.attesaSparo > 0) return;
  p.attesaSparo = SPARO_OGNI[0] + caso(stato) * (SPARO_OGNI[1] - SPARO_OGNI[0]);
  const precisione = t.precisione * Math.max(0.25, 1 - migliore / CALO_PRECISIONE) * (bersaglio.corsa ? 0.7 : 1) * (bersaglio.chino ? 0.75 : 1) * (bersaglio.inAuto ? 0.6 : 1);
  const colpito = caso(stato) < precisione;
  eventi.push({ k: 'sparo', da: p.id, png: true, x: p.x, y: 1.4, z: p.z, ax: bersaglio.x, ay: 1.2, az: bersaglio.z, colpito, arma: t.arma });
  rumore(stato, p.x, p.z, ARMI[t.arma]?.rumore ?? 35, 'sparo', eventi);
  if (colpito) ferisci(stato, bersaglio, DANNO_PNG[t.arma] ?? 10, eventi);
}

function ferisci(stato, g, danno, eventi) {
  if (g.stato !== 'vivo') return;
  let resto = danno;
  if (g.giubbotto > 0) {
    const assorbito = Math.min(g.giubbotto, resto * 0.7);
    g.giubbotto -= assorbito;
    resto -= assorbito;
  }
  g.vita -= resto;
  g.ultimoDanno = stato.tempo;
  eventi.push({ k: 'ferito', a: g.id, danno: Math.round(resto) });
  if (g.vita > 0) return;
  g.vita = 0;
  if (g.kit) {
    g.kit = false;
    g.vita = g.vitaMax * 0.5;
    messaggio(eventi, `${g.nome} usa il kit medico e resta in piedi`, 'bene');
    return;
  }
  g.stato = 'terra';
  g.timerTerra = R.TEMPO_A_TERRA;
  g.uso = null;
  for (const id of [...g.sacchi]) {
    const s = stato.sacchi.find(x => x.id === id);
    if (s) lasciaSacco(stato, g, s);
  }
  messaggio(eventi, `${g.nome} è a terra! Rialzatelo (F)`, 'allarme');
}

function aggiornaTelecamere(stato, amb, luogo, dt, eventi) {
  for (const t of stato.telecamere) {
    if (t.stato === 'loop' && stato.tempo > t.loopFino) {
      t.stato = 'attiva';
      messaggio(eventi, 'Il loop della telecamera è finito', 'avviso');
    }
    if (t.stato !== 'attiva') continue;
    t.yaw = t.yaw0 + Math.sin((stato.tempo + t.fase) * 0.35) * t.giro;
    if (stato.allarme.attivo) continue;
    let vede = 0;
    for (const g of stato.giocatori) {
      const s = stimolo(stato, luogo, g);
      if (s < SOSPETTO.mascherato * 0.5) continue;
      const v = puoVedere(stato, amb, t, g.x, g.z, 16, t.ampiezza * 2, t.yaw);
      vede = Math.max(vede, s * v);
    }
    t.sospetto = vede ? Math.min(1, t.sospetto + vede * dt * 1.1) : Math.max(0, t.sospetto - dt * 0.2);
    if (t.sospetto >= 1) scattaAllarme(stato, 'una telecamera vi ha ripreso col passamontagna', eventi);
  }
}

function aggiornaChiavi(stato, eventi) {
  const giu = p => ['legato', 'stordito', 'morto', 'a terra'].includes(p.stato);
  for (const c of stato.casseforti) {
    if (!c.chiaviDa || c.codiceNoto || c.stato !== 'chiusa') continue;
    if (stato.png.some(p => p.tipo === c.chiaviDa && giu(p))) {
      c.codiceNoto = true;
      messaggio(eventi, c.suVeicolo ? 'Avete le chiavi del portellone del blindato' : 'Avete le chiavi', 'bene');
    }
  }
  if (!stato.tessera && stato.png.some(p => p.tessera && giu(p) && p.stato !== 'a terra')) {
    stato.tessera = true;
    messaggio(eventi, 'Avete la tessera del direttore', 'bene');
  }
}

function aggiornaBlindato(stato, amb, dt, eventi) {
  const v = stato.veicoli.find(x => x.blindato);
  if (!v) return;
  stato.blindatoFermo = v.compito !== 'parte';
  if (v.compito === 'parte') {
    guidaAI(stato, amb, v, dt);
    return;
  }
  guida(v, { gas: 0, sterzo: 0, freno: true }, dt, { collisioni: amb.citta.collisioni });
  if (stato.scadenza === null || stato.tempo < stato.scadenza) return;
  const carico = stato.casseforti.find(c => c.suVeicolo);
  if (!carico || carico.stato !== 'chiusa') return;
  const guardie = stato.png.filter(p => p.tipo === 'vigilante' && ['giro', 'sospetto'].includes(p.stato));
  if (!guardie.length) return;
  carico.stato = 'persa';
  for (const p of guardie) p.stato = 'fuggito';
  const nodi = [...amb.citta.grafo.nodi.values()].filter(n => Math.hypot(n.x - v.x, n.z - v.z) > 500);
  const meta = nodi[Math.floor(caso(stato) * nodi.length)];
  v.percorso = meta ? amb.citta.grafo.percorso({ x: v.x, z: v.z }, { x: meta.x, z: meta.z }) : null;
  v.compito = 'parte';
  v.meta = meta ? [meta.x, meta.z] : null;
  messaggio(eventi, 'Troppo tardi: il blindato è ripartito con le guardie', 'allarme');
}

function aggiornaCasseforti(stato, dt, eventi) {
  for (const c of stato.casseforti) {
    if (c.stato !== 'trapano') continue;
    if (c.inceppato) continue;
    c.progresso += dt / c.durata;
    if (caso(stato) < TRAPANO_INCEPPA * dt) {
      c.inceppato = true;
      messaggio(eventi, 'Il trapano si è inceppato: riavvialo (F)', 'avviso');
      eventi.push({ k: 'trapano', id: c.id, stato: 'inceppato' });
      continue;
    }
    if (Math.floor(stato.tempo * 2) !== Math.floor((stato.tempo - dt) * 2)) rumore(stato, c.x, c.z, 14 * c.rumoreTrapano, 'trapano', eventi);
    if (c.progresso >= 1) apriCassaforte(stato, c, eventi);
  }
}

function apriCassaforte(stato, c, eventi) {
  c.stato = 'aperta';
  c.progresso = 1;
  const [fx, fz] = [-Math.sin(c.yaw), -Math.cos(c.yaw)];
  c.bottino.forEach(([tipo, valore], i) => creaSacco(stato, tipo, valore, c.x + fx * (0.7 + i * 0.25) + (i - 1) * 0.3 * fz, 0.25, c.z + fz * (0.7 + i * 0.25) - (i - 1) * 0.3 * fx));
  eventi.push({ k: 'cassaforte', id: c.id });
  messaggio(eventi, 'La cassaforte è aperta! Prendete i sacchi', 'bene');
}

function aggiornaSacchi(stato, amb, dt, eventi) {
  const macchina = auto(stato);
  for (const s of stato.sacchi) {
    if (s.portatoDa !== null || s.veicolo !== null) {
      const g = stato.giocatori.find(x => x.id === s.portatoDa);
      if (g) {
        s.x = g.x;
        s.z = g.z;
      }
      continue;
    }
    if (!s.inVolo) continue;
    s.attesa = Math.max(0, s.attesa - dt);
    s.vy -= R.GRAVITA * dt;
    const esito = amb.citta.collisioni.muoviCerchio(s.x, s.z, s.vx * dt, s.vz * dt, 0.25);
    if (esito.urto) {
      s.vx *= -0.3;
      s.vz *= -0.3;
    }
    s.x = esito.x;
    s.z = esito.z;
    s.y += s.vy * dt;
    if (macchina && caricabile(stato, macchina) && Math.hypot(s.x - puntiVeicolo(macchina).bagagliaio[0], s.z - puntiVeicolo(macchina).bagagliaio[1]) < 1.6 && s.y < 1.6) {
      carica(stato, macchina, s, eventi);
      continue;
    }
    for (const g of vivi(stato)) {
      if (s.attesa > 0 || g.id === s.lanciatoDa || g.inAuto || g.sacchi.length >= maxSacchi(g)) continue;
      if (Math.hypot(g.x - s.x, g.z - s.z) < 1 && s.y < 2.2) {
        s.inVolo = false;
        s.portatoDa = g.id;
        g.sacchi.push(s.id);
        eventi.push({ k: 'presa', a: g.id, sacco: s.id });
        break;
      }
    }
    if (s.portatoDa === null && s.veicolo === null && s.y <= 0.25) {
      s.y = 0.25;
      s.inVolo = false;
      s.vx = s.vy = s.vz = 0;
    }
  }
}

const maxSacchi = g => (g.ruolo === 'azione' ? RUOLI.azione.sacchi : 1);
const caricabile = (stato, v) => v.sacchi.length < VEICOLI[v.tipo].sacchi;

function carica(stato, v, s, eventi) {
  s.inVolo = false;
  s.portatoDa = null;
  s.veicolo = v.id;
  v.sacchi.push(s.id);
  eventi.push({ k: 'caricato', sacco: s.id, veicolo: v.id });
  messaggio(eventi, `Sacco nel bagagliaio (${v.sacchi.length}/${VEICOLI[v.tipo].sacchi})`, 'bene');
}

function entraAuto(stato, g, v, posto, eventi) {
  if (v.posti[posto]) return false;
  for (const id of [...g.sacchi]) {
    const s = stato.sacchi.find(x => x.id === id);
    if (s && caricabile(stato, v)) {
      g.sacchi = g.sacchi.filter(q => q !== id);
      carica(stato, v, s, eventi);
    } else if (s) lasciaSacco(stato, g, s);
  }
  v.posti[posto] = g.id;
  g.inAuto = v.id;
  g.posto = posto;
  g.uso = null;
  if (posto === 0) v.guidatore = g.id;
  eventi.push({ k: 'auto', a: g.id, dentro: true, veicolo: v.id, posto });
  return true;
}

function esciAuto(stato, g, eventi) {
  const v = stato.veicoli.find(x => x.id === g.inAuto);
  if (!v) {
    g.inAuto = null;
    return;
  }
  v.posti[g.posto] = null;
  if (g.posto === 0) {
    v.guidatore = null;
  }
  const p = puntiVeicolo(v);
  const uscita = [p.portaGuida, p.portaPasseggero, p.portaDietroSx, p.portaDietroDx][g.posto] ?? p.portaGuida;
  g.x = uscita[0];
  g.z = uscita[1];
  g.teletrasporto += 1;
  g.inAuto = null;
  g.posto = -1;
  eventi.push({ k: 'auto', a: g.id, dentro: false, veicolo: v.id });
}

function aggiornaGiocatori(stato, amb, posizioni, dt, eventi) {
  for (const g of stato.giocatori) {
    const p = posizioni[g.id];
    if (p && g.stato === 'vivo' && !g.inAuto) {
      const salto = Math.hypot(p.x - g.x, p.z - g.z);
      const massimo = (R.VELOCITA_CORSA * 1.3 + 2) * Math.max(dt, 0.05) + TOLLERANZA_POSIZIONE;
      if (salto <= massimo || p.tp === g.teletrasporto) {
        g.x = p.x;
        g.z = p.z;
      }
      g.yaw = p.yaw;
      g.pitch = p.pitch;
      g.chino = !!p.chino;
      g.corsa = !!p.corsa;
      if (g.corsa && !g.chino && Math.floor(stato.tempo * 3) !== Math.floor((stato.tempo - dt) * 3)) rumore(stato, g.x, g.z, 3.5, 'passi', eventi);
    } else if (p) {
      g.yaw = p.yaw;
      g.pitch = p.pitch;
    }
    if (g.inAuto && p?.veicolo) {
      const v = stato.veicoli.find(x => x.id === g.inAuto);
      if (v && v.guidatore === g.id) Object.assign(v, pulisciVeicolo(p.veicolo));
    }
    if (g.inAuto) {
      const v = stato.veicoli.find(x => x.id === g.inAuto);
      if (v) {
        const sedile = puntiVeicolo(v).sedili[g.posto] ?? [v.x, v.z];
        g.x = sedile[0];
        g.z = sedile[1];
      }
    }
    if (g.stato === 'vivo' && g.vita < g.vitaMax && stato.tempo - g.ultimoDanno > R.RIGENERA_DOPO) g.vita = Math.min(g.vitaMax, g.vita + R.RIGENERA_AL_SECONDO * dt);
    if (g.stato === 'terra') {
      g.timerTerra -= dt;
      if (g.timerTerra <= 0) {
        g.stato = 'arrestato';
        messaggio(eventi, `${g.nome} è stato arrestato`, 'allarme');
      }
    }
    if (g.uso) avanzaUso(stato, amb, g, dt, eventi);
  }
}

function pulisciVeicolo(v) {
  const numero = x => (Number.isFinite(x) ? x : 0);
  return { x: numero(v.x), z: numero(v.z), yaw: numero(v.yaw), vx: numero(v.vx), vz: numero(v.vz), w: numero(v.w), sterzo: numero(v.sterzo), gas: numero(v.gas), mano: v.mano ? 1 : 0, vita: Math.max(0, Math.min(numero(v.vita), 2000)) };
}

export function interazioni(stato, amb, g) {
  const elenco = [];
  if (g.stato !== 'vivo') return elenco;
  const luogo = amb.luogoDi(stato.colpo);
  const ruolo = g.ruolo;
  const metti = (chiave, x, z, y, testo, tempo, extra = {}) => elenco.push({ chiave, x, z, y, testo, tempo, ...extra });
  const v = auto(stato);
  if (g.inAuto) {
    metti('esci', g.x, g.z, 1, 'Scendi dall\'auto', 0);
    return elenco;
  }
  for (const altro of stato.giocatori) {
    if (altro.id !== g.id && altro.stato === 'terra') metti(`rianima:${altro.id}`, altro.x, altro.z, 0.4, `Rialza ${altro.nome}`, R.RIANIMA_IN);
  }
  if (!g.maschera) metti('maschera', g.x, g.z, 1.5, 'Metti il passamontagna', 0, { sempre: true, tasto: 'Q' });
  for (const [id, porta] of Object.entries(stato.porte)) {
    const d = luogo.porte.find(x => x.id === id);
    if (!d?.mondo) continue;
    const x = (d.mondo.da[0] + d.mondo.a[0]) / 2;
    const z = (d.mondo.da[1] + d.mondo.a[1]) / 2;
    if (porta.serratura === 'chiave') metti(`scassina:${id}`, x, z, 1.1, ruolo === 'scassinatore' ? 'Scassina la serratura' : 'Forza la serratura (lento)', tempoAzione('serratura', ruolo, g.attrezzi), { maschera: true });
    else if (porta.serratura === 'elettronica') metti(`hackera:${id}`, x, z, 1.1, ruolo === 'hacker' ? 'Apri la porta elettronica' : 'Collega il clonatore (lento)', tempoAzione('portaElettronica', ruolo), { maschera: true });
    else if (porta.serratura === 'tessera') metti(`tessera:${id}`, x, z, 1.1, stato.tessera ? 'Passa la tessera' : 'Serve la tessera del direttore', stato.tessera ? 0.5 : Infinity, { maschera: true });
    else if (porta.serratura === 'blindata') metti(`blindata:${id}`, x, z, 1.1, g.attrezzi.includes('trapano') || stato.attrezzi.termico ? 'Monta il trapano sulla porta blindata' : 'Serve un trapano', g.attrezzi.includes('trapano') || stato.attrezzi.termico ? 1.5 : Infinity, { maschera: true });
    else metti(`porta:${id}`, x, z, 1.1, porta.aperta ? 'Chiudi la porta' : 'Apri la porta', 0);
  }
  const m = stato.missione;
  if (m?.tipo === 'fotografie' && !g.maschera) {
    for (const t of stato.telecamere) if (!m.foto.includes(t.id)) metti(`fotografa:${t.id}`, t.x, t.z, t.y, 'Fotografa la telecamera', tempoAzione('fotografa', ruolo), { distanza: 16 });
    for (const p of stato.png) if (p.tipo === 'vigilante' && !m.foto.includes(`png:${p.indice}`)) metti(`fotografa:png:${p.indice}`, p.x, p.z, 1.5, 'Fotografa la guardia e il suo giro', tempoAzione('fotografa', ruolo), { distanza: 14 });
  }
  if (m?.tipo === 'tessera' && !m.fatto) {
    for (const p of stato.png) {
      if (!p.tessera || !['giro', 'sospetto'].includes(p.stato)) continue;
      const spalle = Math.abs(angolo(Math.atan2(-(g.x - p.x), -(g.z - p.z)) - p.yaw)) > 1.9;
      if (spalle) metti(`borseggia:${p.id}`, p.x, p.z, 1.1, 'Sfila la tessera dal giaccone', 3, { distanza: 1.7 });
    }
  }
  if (m?.tipo === 'linea' && !m.fatto) for (const o of stato.oggetti) metti(`taglia:${o.id}`, o.x, o.z, 0.8, 'Taglia i fili della centralina', tempoAzione('tagliaFili', ruolo));
  for (const v of stato.veicoli) {
    if (!v.daRubare) continue;
    const [x, z] = puntiVeicolo(v).portaGuida;
    metti(`avvia:${v.id}`, x, z, 1, ruolo === 'autista' ? 'Avvia il furgone senza chiavi' : 'Forza il blocchetto (scatta l\'allarme)', tempoAzione('avvioSenzaChiavi', ruolo), { distanza: 2.2 });
  }
  for (const c of stato.casseforti) {
    if (c.stato === 'aperta' || c.stato === 'persa') continue;
    if (c.suVeicolo && !stato.blindatoFermo) continue;
    if (c.stato === 'trapano') {
      if (c.inceppato) metti(`riavvia:${c.id}`, c.x, c.z, 0.8, 'Riavvia il trapano', 1.5, { maschera: true });
      continue;
    }
    if (c.codiceNoto && c.suVeicolo) metti(`codice:${c.id}`, c.x, c.z, 1, 'Apri il portellone con le chiavi della guardia', tempoAzione('cassaforteCodice', ruolo), { maschera: true });
    else if (c.codiceNoto) metti(`codice:${c.id}`, c.x, c.z, 0.8, `Gira la combinazione ${c.codice}`, tempoAzione('cassaforteCodice', ruolo), { maschera: true });
    else if (ruolo === 'scassinatore' && !c.grande && !c.suVeicolo) metti(`orecchio:${c.id}`, c.x, c.z, 0.8, 'Apri la cassaforte a orecchio', tempoAzione('cassaforteOrecchio', ruolo) * (g.potenziamenti.includes('Orecchio fino') ? 0.5 : 1), { maschera: true });
    if (g.attrezzi.includes('trapano') || stato.attrezzi.termico) metti(`trapano:${c.id}`, c.x, c.z, 0.8, 'Monta il trapano', 1.5, { maschera: true });
    if (!c.codiceNoto && (ruolo !== 'scassinatore' || c.suVeicolo || c.grande) && !g.attrezzi.includes('trapano') && !stato.attrezzi.termico) metti(`chiusa:${c.id}`, c.x, c.z, 0.8, c.suVeicolo ? 'Servono le chiavi di una guardia o un trapano' : c.grande ? 'Serve la combinazione o un trapano' : 'Serve la combinazione, lo scassinatore o un trapano', Infinity);
  }
  for (const b of stato.biglietti) if (!b.letto) metti(`biglietto:${b.id}`, b.x, b.z, b.y, 'Leggi il foglietto', tempoAzione('leggiBiglietto', ruolo));
  for (const c of stato.casse) if (c.piena) metti(`cassa:${c.id}`, c.x, c.z, 1.1, 'Svuota la cassa nel sacco', tempoAzione('riempiSacco', ruolo), { maschera: true });
  for (const vt of stato.vetrine) if (!vt.vuota) metti(`vetrina:${vt.id}`, vt.x, vt.z, 1, vt.rotta ? 'Prendi i gioielli' : 'Rompi la vetrina e prendi i gioielli', tempoAzione('riempiSacco', ruolo) * 0.6, { maschera: true });
  for (const t of stato.telecamere) {
    if (t.stato !== 'attiva') continue;
    if (ruolo === 'hacker') metti(`loop:${t.id}`, t.x, t.z, t.y, 'Metti in loop la telecamera', tempoAzione('loopTelecamera', ruolo), { distanza: g.potenziamenti.includes('Ripetitore') ? 40 : 20 });
  }
  for (const s of stato.sacchi) {
    if (s.portatoDa !== null || s.veicolo !== null || s.inVolo) continue;
    if (g.sacchi.length < maxSacchi(g)) metti(`sacco:${s.id}`, s.x, s.z, 0.3, `Prendi il sacco (${SACCHI[s.tipo].nome})`, 0);
  }
  for (const p of stato.png) {
    if (p.stato === 'a terra' && g.fascette > 0) metti(`lega:${p.id}`, p.x, p.z, 0.6, `Lega con le fascette (${g.fascette})`, tempoAzione('lega', ruolo), { maschera: true });
  }
  if (v) {
    const pv = puntiVeicolo(v);
    if (g.sacchi.length && caricabile(stato, v)) metti(`bagagliaio:${v.id}`, pv.bagagliaio[0], pv.bagagliaio[1], 0.8, 'Metti il sacco nel bagagliaio', 0, { distanza: 2.4 });
    const porte = [['guida', pv.portaGuida, 0], ['passeggero', pv.portaPasseggero, 1], ['dietroSx', pv.portaDietroSx, 2], ['dietroDx', pv.portaDietroDx, 3]];
    for (const [nome, [x, z], posto] of porte) {
      if (v.posti[posto]) continue;
      metti(`auto:${v.id}:${posto}`, x, z, 1, posto === 0 ? 'Guida' : 'Sali in auto', 0, { distanza: 2.2 });
    }
  }
  return elenco;
}

function avviaUso(stato, amb, g, chiave, eventi) {
  const voce = interazioni(stato, amb, g).find(i => i.chiave === chiave);
  if (!voce || !Number.isFinite(voce.tempo)) return;
  if (Math.hypot(voce.x - g.x, voce.z - g.z) > (voce.distanza ?? R.DISTANZA_USO) + TOLLERANZA_POSIZIONE) return;
  if (voce.maschera && !g.maschera) {
    g.maschera = true;
    eventi.push({ k: 'maschera', a: g.id });
  }
  if (voce.tempo <= 0) {
    completaUso(stato, amb, g, chiave, eventi);
    return;
  }
  g.uso = { chiave, progresso: 0, totale: voce.tempo, x: voce.x, z: voce.z, distanza: voce.distanza ?? R.DISTANZA_USO };
  if (chiave.startsWith('scassina:') && g.ruolo !== 'scassinatore') rumore(stato, g.x, g.z, 6, 'scasso', eventi);
}

function avanzaUso(stato, amb, g, dt, eventi) {
  const u = g.uso;
  if (g.stato !== 'vivo' || Math.hypot(u.x - g.x, u.z - g.z) > u.distanza + TOLLERANZA_POSIZIONE + 0.5) {
    g.uso = null;
    return;
  }
  u.progresso += dt;
  if (u.progresso >= u.totale) {
    g.uso = null;
    completaUso(stato, amb, g, u.chiave, eventi);
  }
}

function completaUso(stato, amb, g, chiave, eventi) {
  const [tipo, id, extra] = chiave.split(':');
  const segPorte = amb.porte.get(stato.luogo);
  switch (tipo) {
    case 'maschera':
      g.maschera = true;
      eventi.push({ k: 'maschera', a: g.id });
      break;
    case 'porta': {
      const porta = stato.porte[id];
      porta.aperta = !porta.aperta;
      const seg = segPorte?.get(id);
      if (seg) seg.attivo = !porta.aperta;
      eventi.push({ k: 'porta', id, aperta: porta.aperta });
      break;
    }
    case 'scassina':
    case 'hackera':
    case 'tessera':
    case 'blindata': {
      const porta = stato.porte[id];
      porta.serratura = null;
      porta.aperta = true;
      const seg = segPorte?.get(id);
      if (seg) seg.attivo = false;
      eventi.push({ k: 'porta', id, aperta: true, forzata: true });
      messaggio(eventi, 'Porta aperta', 'bene', g.id);
      break;
    }
    case 'codice':
    case 'orecchio': {
      const c = stato.casseforti.find(x => x.id === id);
      if (c) apriCassaforte(stato, c, eventi);
      break;
    }
    case 'trapano':
    case 'riavvia': {
      const c = stato.casseforti.find(x => x.id === id);
      if (!c) break;
      if (tipo === 'trapano') {
        c.stato = 'trapano';
        c.durata = tempoAzione('trapano', g.ruolo) * (c.grande ? 2 : 1) * (stato.attrezzi.termico ? 0.5 : 1);
        c.rumoreTrapano = g.ruolo === 'scassinatore' ? (g.potenziamenti.includes('Mani di velluto') ? 0.2 : RUOLI.scassinatore.rumoreTrapano) : 1;
        messaggio(eventi, `Trapano montato: ${Math.round(c.durata)} secondi`, 'bene');
      }
      c.inceppato = false;
      eventi.push({ k: 'trapano', id: c.id, stato: 'acceso' });
      break;
    }
    case 'biglietto': {
      const b = stato.biglietti.find(x => x.id === id);
      if (!b) break;
      b.letto = true;
      const c = stato.casseforti.find(x => x.id === b.per);
      if (c) c.codiceNoto = true;
      messaggio(eventi, `Sul foglietto c'è scritto: ${c?.codice ?? '????'}`, 'bene');
      break;
    }
    case 'cassa': {
      const c = stato.casse.find(x => x.id === id);
      if (!c?.piena) break;
      c.piena = false;
      const s = creaSacco(stato, c.sacco, c.valore, g.x, 0.25, g.z);
      prendiSacco(stato, g, s, eventi);
      break;
    }
    case 'vetrina': {
      const vt = stato.vetrine.find(x => x.id === id);
      if (!vt || vt.vuota) break;
      if (!vt.rotta) {
        vt.rotta = true;
        rumore(stato, vt.x, vt.z, 18, 'vetro', eventi);
        eventi.push({ k: 'vetro', id: vt.id, x: vt.x, z: vt.z });
      }
      vt.vuota = true;
      const s = creaSacco(stato, vt.sacco, vt.valore, g.x, 0.25, g.z);
      prendiSacco(stato, g, s, eventi);
      break;
    }
    case 'loop': {
      const t = stato.telecamere.find(x => x.id === id);
      if (!t) break;
      t.stato = 'loop';
      t.loopFino = stato.tempo + DURATA_LOOP;
      t.sospetto = 0;
      messaggio(eventi, 'Telecamera in loop per un minuto', 'bene');
      break;
    }
    case 'sacco': {
      const s = stato.sacchi.find(x => x.id === Number(id));
      if (s && s.portatoDa === null && s.veicolo === null) prendiSacco(stato, g, s, eventi);
      break;
    }
    case 'lega': {
      const p = stato.png.find(x => x.id === Number(id));
      if (!p || p.stato !== 'a terra' || g.fascette <= 0) break;
      p.stato = 'legato';
      g.fascette -= 1;
      stato.statistiche.legati += 1;
      eventi.push({ k: 'legato', id: p.id });
      break;
    }
    case 'fotografa': {
      const m = stato.missione;
      const chiave = extra !== undefined ? `${id}:${extra}` : id;
      if (!m || m.foto.includes(chiave)) break;
      m.foto.push(chiave);
      eventi.push({ k: 'foto' });
      if (m.obiettivi.every(o => m.foto.includes(o))) {
        m.fatto = true;
        messaggio(eventi, 'Fotografato tutto: tornate al rifugio', 'bene');
      } else messaggio(eventi, `Foto ${m.foto.length}/${m.obiettivi.length}`, 'info', g.id);
      break;
    }
    case 'borseggia': {
      const p = stato.png.find(x => x.id === Number(id));
      if (!p || !stato.missione) break;
      const spalle = Math.abs(angolo(Math.atan2(-(g.x - p.x), -(g.z - p.z)) - p.yaw)) > 1.6;
      if (!spalle) {
        messaggio(eventi, 'Il direttore se n\'è accorto!', 'allarme');
        panico(stato, p, eventi);
        break;
      }
      stato.missione.fatto = true;
      stato.tessera = true;
      messaggio(eventi, 'Tessera presa: allontanatevi senza correre e tornate al rifugio', 'bene');
      break;
    }
    case 'taglia': {
      if (!stato.missione) break;
      stato.missione.fatto = true;
      stato.allarme.lineaTagliata = true;
      eventi.push({ k: 'scintille', x: g.x, z: g.z });
      messaggio(eventi, 'Linea tagliata: tornate al rifugio', 'bene');
      break;
    }
    case 'avvia': {
      const v = stato.veicoli.find(x => x.id === Number(id));
      if (!v?.daRubare) break;
      for (const altra of stato.veicoli) altra.nostro = false;
      v.daRubare = false;
      v.nostro = true;
      v.acceso = true;
      if (g.ruolo !== 'autista') rumore(stato, v.x, v.z, 25, 'antifurto', eventi);
      if (stato.missione) stato.missione.fatto = true;
      messaggio(eventi, 'Il furgone è vostro: portatelo al rifugio', 'bene');
      entraAuto(stato, g, v, 0, eventi);
      break;
    }
    case 'rianima': {
      const altro = stato.giocatori.find(x => x.id === id);
      if (altro?.stato !== 'terra') break;
      altro.stato = 'vivo';
      altro.vita = altro.vitaMax * 0.4;
      messaggio(eventi, `${g.nome} ha rialzato ${altro.nome}`, 'bene');
      break;
    }
    case 'bagagliaio': {
      const v = stato.veicoli.find(x => x.id === Number(id));
      const s = stato.sacchi.find(x => x.id === g.sacchi[g.sacchi.length - 1]);
      if (!v || !s || !caricabile(stato, v)) break;
      g.sacchi = g.sacchi.filter(q => q !== s.id);
      g.bottinoPortato += s.valore;
      carica(stato, v, s, eventi);
      break;
    }
    case 'auto': {
      const v = stato.veicoli.find(x => x.id === Number(id));
      if (v) entraAuto(stato, g, v, Number(extra), eventi);
      break;
    }
    case 'esci':
      esciAuto(stato, g, eventi);
      break;
    default:
  }
}

function prendiSacco(stato, g, s, eventi) {
  if (g.sacchi.length >= maxSacchi(g)) {
    s.x = g.x;
    s.z = g.z;
    return;
  }
  s.portatoDa = g.id;
  g.sacchi.push(s.id);
  eventi.push({ k: 'presa', a: g.id, sacco: s.id });
}

function eseguiAzioni(stato, amb, azioni, eventi) {
  for (const a of azioni) {
    const g = stato.giocatori.find(x => x.id === a.da);
    if (!g) continue;
    switch (a.tipo) {
      case 'usa':
        if (a.attivo) avviaUso(stato, amb, g, a.chiave, eventi);
        else if (g.uso?.chiave === a.chiave) g.uso = null;
        break;
      case 'maschera':
        if (g.stato === 'vivo' && !g.maschera) {
          g.maschera = true;
          eventi.push({ k: 'maschera', a: g.id });
        }
        break;
      case 'lancia': {
        if (g.stato !== 'vivo' || !g.sacchi.length || g.inAuto) break;
        const s = stato.sacchi.find(x => x.id === g.sacchi[g.sacchi.length - 1]);
        if (!s) break;
        g.sacchi.pop();
        const forza = R.DISTANZA_LANCIO * (1 - SACCHI[s.tipo].peso * 0.6);
        const cp = Math.cos(a.pitch ?? g.pitch);
        Object.assign(s, {
          portatoDa: null, inVolo: true, lanciatoDa: g.id, attesa: RITARDO_LANCIO,
          x: g.x - Math.sin(g.yaw) * 0.5, z: g.z - Math.cos(g.yaw) * 0.5, y: 1.3,
          vx: -Math.sin(g.yaw) * cp * forza, vz: -Math.cos(g.yaw) * cp * forza, vy: Math.sin(a.pitch ?? g.pitch) * forza + 3,
        });
        eventi.push({ k: 'lancio', a: g.id, sacco: s.id });
        break;
      }
      case 'grida': {
        if (g.stato !== 'vivo') break;
        if (!g.maschera) {
          g.maschera = true;
          eventi.push({ k: 'maschera', a: g.id });
        }
        eventi.push({ k: 'grido', a: g.id, x: g.x, z: g.z });
        rumore(stato, g.x, g.z, 10, 'grido', eventi);
        let quanti = 0;
        for (const p of stato.png) {
          if (['morto', 'legato', 'stordito', 'fuggito'].includes(p.stato)) continue;
          const d = distanza(p, g);
          const davanti = Math.abs(angolo(Math.atan2(-(p.x - g.x), -(p.z - g.z)) - g.yaw)) < 1.1;
          if (d > R.INTIMIDISCI_ENTRO || !davanti) continue;
          if (!amb.citta.collisioni.libero(g.x, g.z, p.x, p.z, bloccaVista)) continue;
          const armato = PNG[p.tipo].armato;
          if (armato && (p.stato === 'combatte' || d > (g.ruolo === 'azione' ? 7 : 4))) continue;
          p.stato = 'a terra';
          p.timer = g.potenziamenti.includes('Voce grossa') ? 1e9 : R.ARRENDE_DOPO * (g.ruolo === 'azione' ? 1.5 : 1);
          p.sospetto = 0;
          quanti += 1;
        }
        if (quanti) messaggio(eventi, quanti === 1 ? '«A terra!» — un ostaggio' : `«A terra!» — ${quanti} ostaggi`, 'info', g.id);
        break;
      }
      case 'colpo': {
        const p = stato.png.find(x => x.id === a.png);
        if (!p || g.stato !== 'vivo' || ['morto', 'fuggito'].includes(p.stato)) break;
        if (distanza(p, g) > 120) break;
        if (a.mischia) {
          if (distanza(p, g) > 2.4) break;
          const spalle = Math.abs(angolo(Math.atan2(-(g.x - p.x), -(g.z - p.z)) - p.yaw)) > 1.9;
          if (spalle && ['giro', 'sospetto', 'a terra', 'legato'].includes(p.stato)) {
            p.stato = 'stordito';
            eventi.push({ k: 'stordito', id: p.id });
            if (g.ruolo !== 'azione') rumore(stato, p.x, p.z, 7, 'colpo', eventi);
            break;
          }
        }
        const danno = Math.min(400, Math.max(0, Number(a.danno) || 0));
        p.vita -= danno;
        eventi.push({ k: 'colpito', id: p.id, testa: !!a.testa });
        if (p.vita <= 0) {
          p.stato = 'morto';
          g.uccisioni += 1;
          stato.statistiche.uccisi += 1;
          eventi.push({ k: 'morto', id: p.id });
        } else if (PNG[p.tipo].armato && p.stato !== 'combatte') avviaAllarmePng(stato, p, 'è stato colpito', eventi);
        else if (!PNG[p.tipo].armato) panico(stato, p, eventi);
        break;
      }
      case 'sparo': {
        if (g.stato !== 'vivo') break;
        const silenziato = g.attrezzi.includes('silenziatore') && (a.arma ?? g.arma) === 'pistola';
        if (!g.maschera) {
          g.maschera = true;
          eventi.push({ k: 'maschera', a: g.id });
        }
        eventi.push({ k: 'sparo', da: g.id, arma: a.arma ?? g.arma, silenziato, x: g.x, z: g.z, yaw: a.yaw, pitch: a.pitch });
        rumore(stato, g.x, g.z, silenziato ? RUMORE_SILENZIATO : ARMI[a.arma ?? g.arma]?.rumore ?? 35, silenziato ? 'passi' : 'sparo', eventi);
        if (a.telecamera) {
          const t = stato.telecamere.find(x => x.id === a.telecamera);
          if (t && t.stato !== 'rotta') {
            t.stato = 'rotta';
            eventi.push({ k: 'telecamera', id: t.id, rotta: true });
          }
        }
        break;
      }
      case 'arma':
        if (g.armi.includes(a.arma)) g.arma = a.arma;
        break;
      case 'taglia':
        if (!stato.allarme.lineaTagliata) {
          stato.allarme.lineaTagliata = true;
          messaggio(eventi, 'Linea telefonica tagliata: la polizia ci metterà di più', 'bene');
        }
        break;
      default:
    }
  }
}

function aggiornaPolizia(stato, amb, dt, eventi) {
  const pol = stato.polizia;
  if (!stato.allarme.attivo || pol.prossima === null || stato.tempo < pol.prossima) return;
  const luogo = amb.luogoDi(stato.colpo);
  const def = definizione(stato.colpo).polizia ?? {};
  const n = stato.giocatori.length;
  const ostaggi = stato.png.filter(p => p.stato === 'legato' || p.stato === 'a terra').length;
  const volanti = Math.max(1, Math.ceil(((def.agenti ?? POLIZIA.agentiBase) + pol.ondata * POLIZIA.agentiPerOndata + (n - 1) * POLIZIA.rinforziPerGiocatore) / AGENTI_PER_VOLANTE));
  pol.ondata += 1;
  pol.prossima = stato.tempo + POLIZIA.ondataOgni + ostaggi * POLIZIA.tempoPerOstaggio;
  messaggio(eventi, pol.ondata === 1 ? 'Sirene! Arriva la polizia' : `Rinforzi della polizia (ondata ${pol.ondata})`, 'allarme');
  eventi.push({ k: 'ondata', n: pol.ondata });
  for (let i = 0; i < volanti; i++) mandaVolante(stato, amb, luogo.ingresso, eventi, 'assalto');
}

function puntoPartenza(stato, amb, verso, distanzaVoluta) {
  const nodi = [...amb.citta.grafo.nodi.values()];
  for (let i = 0; i < 80; i++) {
    const n = nodi[Math.floor(caso(stato) * nodi.length)];
    const d = Math.hypot(n.x - verso[0], n.z - verso[1]);
    const principale = n.archi.length >= 2 && n.archi.some(a => amb.citta.dati.strade[a.strada].r >= 2);
    if (d > distanzaVoluta * 0.7 && d < distanzaVoluta * 1.5 && principale) return n;
  }
  return nodi.find(n => Math.hypot(n.x - verso[0], n.z - verso[1]) > 120) ?? nodi[0];
}

function mandaVolante(stato, amb, meta, eventi, compito) {
  const partenza = puntoPartenza(stato, amb, meta, ARRIVO_RANDOM);
  const percorso = amb.citta.grafo.percorso({ x: partenza.x, z: partenza.z }, { x: meta[0], z: meta[1] });
  if (!percorso) return null;
  const a = percorso[0];
  const b = percorso[Math.min(1, percorso.length - 1)];
  const yaw = Math.atan2(-(b.x - a.x), -(b.z - a.z));
  const v = creaVeicolo(stato.prossimoId++, 'volante', a.x, a.z, yaw, { sirena: true, polizia: true, compito, percorso, meta, agenti: compito === 'assalto' ? AGENTI_PER_VOLANTE : 0, acceso: true, ricalcola: 0 });
  stato.veicoli.push(v);
  return v;
}

function guidaAI(stato, amb, v, dt) {
  const altri = stato.veicoli.filter(o => o !== v && Math.hypot(o.x - v.x, o.z - v.z) < 9);
  const opzioni = { collisioni: amb.citta.collisioni, ostacoli: altri };
  if (!v.percorso || v.vita <= 0) {
    guida(v, { gas: 0, sterzo: 0, freno: true }, dt, opzioni);
    return;
  }
  const vel = velocita(v);
  const vicino = puntoAvanti(v.percorso, v.x, v.z, 5 + vel * 0.35);
  const lontano = puntoAvanti(v.percorso, v.x, v.z, 14 + vel * 1.1);
  const diff = angolo(Math.atan2(-(vicino.x - v.x), -(vicino.z - v.z)) - v.yaw);
  const diffLontano = angolo(Math.atan2(-(lontano.x - v.x), -(lontano.z - v.z)) - v.yaw);
  if (v.retro > 0) {
    v.retro -= dt;
    guida(v, { gas: -1, sterzo: -Math.sign(diff), mano: false }, dt, opzioni);
    return;
  }
  const fine = v.percorso[v.percorso.length - 1];
  const resto = Math.hypot(fine.x - v.x, fine.z - v.z);
  const limite = v.compito === 'insegui' ? 30 : 17;
  const curva = Math.max(6, limite * (1 - Math.min(0.75, Math.abs(diffLontano) * 0.85)));
  const frenata = v.compito === 'insegui' ? Infinity : Math.min(resto * 0.7 + 2, 4 + resto * 0.3);
  v.controllo = (v.controllo ?? 3) - dt;
  if (v.controllo <= 0) {
    v.controllo = 3;
    if (v.compito !== 'insegui' && v.meta && resto > (v.restoPrima ?? Infinity) - 5) {
      v.percorso = amb.citta.grafo.percorso({ x: v.x, z: v.z }, { x: v.meta[0], z: v.meta[1] }) ?? v.percorso;
    }
    v.restoPrima = resto;
  }
  const obiettivo = Math.min(curva, frenata);
  const gas = Math.abs(diff) > 1.6 && vel < 3 ? -1 : vel < obiettivo ? 1 : vel > obiettivo + 2 ? -1 : 0.1;
  const sterzo = Math.max(-1, Math.min(1, (gas < 0 && vel < 3 ? -diff : diff) * 2.4));
  guida(v, { gas, sterzo, mano: false }, dt, opzioni);
  v.fermo = gas > 0 && vel < 0.8 ? (v.fermo ?? 0) + dt : 0;
  v.immobile = vel < 0.8 ? (v.immobile ?? 0) + dt : 0;
  if (v.fermo > 1.4) {
    v.fermo = 0;
    v.retro = 1.2;
  }
  if (v.immobile > 6 && stato.giocatori.every(g => Math.hypot(g.x - v.x, g.z - v.z) > 70)) {
    const salto = puntoAvanti(v.percorso, v.x, v.z, 25);
    const dopo = puntoAvanti(v.percorso, salto.x, salto.z, 6);
    v.x = salto.x;
    v.z = salto.z;
    v.yaw = Math.atan2(-(dopo.x - salto.x), -(dopo.z - salto.z));
    v.vx = v.vz = v.w = 0;
    v.immobile = 0;
  }
}

function aggiornaVolanti(stato, amb, dt, eventi) {
  const nostra = auto(stato);
  for (const v of stato.veicoli) {
    if (!v.polizia) continue;
    if (v.compito === 'assalto') {
      const resto = Math.hypot(v.meta[0] - v.x, v.meta[1] - v.z);
      if (resto < DISTANZA_ARRIVO_VOLANTE || (v.percorso && puntoAvanti(v.percorso, v.x, v.z, 0).fine && velocita(v) < 1)) {
        guida(v, { gas: 0, sterzo: 0, freno: true }, dt, { collisioni: amb.citta.collisioni });
        if (velocita(v) < 1.5 && v.agenti > 0) {
          for (let i = 0; i < v.agenti; i++) {
            const p = puntiVeicolo(v);
            const [x, z] = i === 0 ? p.portaGuida : p.portaPasseggero;
            stato.png.push({
              id: stato.prossimoId++, tipo: 'poliziotto', nome: 'Agente', x, z, yaw: v.yaw, vita: PNG.poliziotto.vita, stato: 'combatte', sospetto: 1,
              giro: [{ x, z, sosta: 5 }], tappa: 0, sosta: 5, timer: 0, attesaVista: 0, attesaSparo: 1 + caso(stato), uscita: [x, z], percorso: null, ip: 0,
            });
          }
          v.agenti = 0;
          v.compito = 'ferma';
          v.percorso = null;
        } else guidaAI(stato, amb, v, dt);
      } else guidaAI(stato, amb, v, dt);
    } else if (v.compito === 'insegui' && nostra) {
      v.ricalcola -= dt;
      if (v.ricalcola <= 0) {
        v.ricalcola = 1.2 + caso(stato) * 0.6;
        const vicino = Math.hypot(nostra.x - v.x, nostra.z - v.z) < 35;
        v.percorso = vicino ? [{ x: v.x, z: v.z }, { x: nostra.x, z: nostra.z }] : amb.citta.grafo.percorso({ x: v.x, z: v.z }, { x: nostra.x, z: nostra.z }) ?? v.percorso;
      }
      guidaAI(stato, amb, v, dt);
    } else if (v.compito === 'blocco') {
      guida(v, { gas: 0, sterzo: 0, freno: true }, dt, { collisioni: amb.citta.collisioni });
    } else if (v.compito === 'ferma') {
      guida(v, { gas: 0, sterzo: 0, freno: true }, dt, { collisioni: amb.citta.collisioni });
    }
  }
}

function aggiornaFuga(stato, amb, dt, eventi) {
  const v = auto(stato);
  if (!v) return;
  const luogo = amb.luogoDi(stato.colpo);
  const dentro = vivi(stato).filter(g => g.inAuto === v.id);
  const attivi = stato.giocatori.filter(g => g.stato !== 'arrestato');
  const lontanoColpo = Math.hypot(v.x - luogo.centro[0], v.z - luogo.centro[1]);
  if (!stato.fuga.attiva && v.guidatore && lontanoColpo > ZONA_CALDA * 0.4 && dentro.length >= attivi.filter(g => g.stato === 'vivo').length) {
    stato.fuga.attiva = true;
    messaggio(eventi, 'Si va al rifugio: la cascina in fondo a Via Ranzina', 'info');
    if (stato.allarme.attivo) {
      stato.fuga.polizia = true;
      for (let i = 0; i < Math.min(VOLANTI_FUGA_MAX, 1 + stato.polizia.ondata + Math.floor(stato.giocatori.length / 2)); i++) {
        const volante = mandaVolante(stato, amb, [v.x, v.z], eventi, 'insegui');
        if (volante) volante.ricalcola = i * 0.4;
      }
      for (const p of stato.veicoli.filter(x => x.polizia && x.compito === 'ferma')) {
        p.compito = 'insegui';
        p.ricalcola = FUGA_POLIZIA_AVVIO;
        p.agenti = 0;
      }
    }
  }
  if (!stato.fuga.attiva) return;
  const volanti = stato.veicoli.filter(x => x.polizia && x.vita > 0 && x.compito === 'insegui');
  const vicina = volanti.some(x => Math.hypot(x.x - v.x, x.z - v.z) < POLIZIA.distanzaSeminati);
  stato.fuga.lontano = vicina ? 0 : stato.fuga.lontano + dt;
  if (stato.fuga.polizia && !vicina && stato.fuga.lontano > POLIZIA.tempoSeminati) {
    stato.fuga.polizia = false;
    messaggio(eventi, 'Seminati! Andate al rifugio', 'bene');
    for (const x of volanti) {
      x.compito = 'ferma';
      x.percorso = null;
    }
  }
  const [rx, rz] = amb.rifugio;
  if (Math.hypot(v.x - rx, v.z - rz) < RAGGIO_RIFUGIO && velocita(v) < 6) {
    if (stato.missione && !obiettivoMissione(stato)) {
      if (!stato.fuga.avvisatoMissione) messaggio(eventi, 'La preparazione non è finita: tornate indietro', 'avviso');
      stato.fuga.avvisatoMissione = true;
      return;
    }
    if (stato.fuga.polizia || vicina) {
      if (!stato.fuga.avvisato) messaggio(eventi, 'Avete la polizia alle costole: seminatela prima di entrare nel rifugio!', 'allarme');
      stato.fuga.avvisato = true;
      return;
    }
    concludi(stato, true, eventi);
  }
}

function obiettivoMissione(stato) {
  const m = stato.missione;
  if (!m) return true;
  const v = auto(stato);
  if (m.tipo === 'trapano') return !!v && v.sacchi.some(id => stato.sacchi.find(s => s.id === id)?.tipo === 'trapano');
  if (m.tipo === 'furgone') return v?.tipo === 'furgone';
  return m.fatto;
}

function concludi(stato, vinto, eventi) {
  if (stato.esito) return;
  const v = auto(stato);
  const sacchi = v ? v.sacchi.map(id => stato.sacchi.find(s => s.id === id)).filter(Boolean) : [];
  const lordo = sacchi.reduce((t, s) => t + s.valore, 0);
  const pulito = !stato.allarme.attivo;
  const bonus = pulito ? Math.round(lordo * 0.2) : 0;
  const arrestati = stato.giocatori.filter(g => g.stato === 'arrestato').length;
  stato.esito = {
    vinto, lordo, bonus, totale: vinto ? lordo + bonus : 0, pulito, sacchi: sacchi.length, durata: Math.round(stato.tempo),
    arrestati, uccisi: stato.statistiche.uccisi, legati: stato.statistiche.legati, preparazione: stato.missione?.tipo ?? null,
    giocatori: stato.giocatori.map(g => ({ id: g.id, nome: g.nome, ruolo: g.ruolo, stato: g.stato, uccisioni: g.uccisioni })),
  };
  stato.fase = 'fine';
  eventi.push({ k: 'fine', ...stato.esito });
}

function controllaSconfitta(stato, eventi) {
  if (stato.esito) return;
  const attivi = stato.giocatori.filter(g => g.stato === 'vivo');
  if (stato.giocatori.length && !attivi.length) {
    messaggio(eventi, 'Siete tutti a terra: la polizia vi ha presi', 'allarme');
    concludi(stato, false, eventi);
  }
}

export function sincronizzaPorte(stato, amb) {
  const segmenti = amb.porte.get(stato.luogo);
  if (!segmenti) return;
  for (const [id, seg] of segmenti) seg.attivo = !stato.porte[id]?.aperta;
}

export function passo(stato, dt, { posizioni = {}, azioni = [] } = {}, amb) {
  const eventi = [];
  stato.tempo += dt;
  if (stato.fase === 'rifugio') {
    aggiornaGiocatori(stato, amb, posizioni, dt, eventi);
    return eventi;
  }
  luogoCorrente = amb.luogoDi(stato.colpo);
  stato.percorsiPasso = 0;
  if (stato.fase !== 'colpo') return eventi;
  sincronizzaPorte(stato, amb);
  const luogo = luogoCorrente;
  eseguiAzioni(stato, amb, azioni, eventi);
  aggiornaGiocatori(stato, amb, posizioni, dt, eventi);
  aggiornaPng(stato, amb, luogo, dt, eventi);
  aggiornaTelecamere(stato, amb, luogo, dt, eventi);
  aggiornaChiavi(stato, eventi);
  aggiornaBlindato(stato, amb, dt, eventi);
  aggiornaCasseforti(stato, dt, eventi);
  aggiornaSacchi(stato, amb, dt, eventi);
  aggiornaPolizia(stato, amb, dt, eventi);
  aggiornaVolanti(stato, amb, dt, eventi);
  const nostra = auto(stato);
  if (nostra && !nostra.guidatore) guida(nostra, { gas: 0, sterzo: 0, mano: true }, dt, { collisioni: amb.citta.collisioni, ostacoli: stato.veicoli.filter(o => o !== nostra && Math.hypot(o.x - nostra.x, o.z - nostra.z) < 9) });
  aggiornaFuga(stato, amb, dt, eventi);
  controllaSconfitta(stato, eventi);
  return eventi;
}

export { concludi, ferisci, cerchiVeicolo, urtaVeicolo };
