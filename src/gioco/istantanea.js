const r2 = v => Math.round(v * 100) / 100;
const r3 = v => Math.round(v * 1000) / 1000;
const STATI_GIOCATORE = ['vivo', 'terra', 'arrestato'];
const STATI_PNG = ['giro', 'sospetto', 'chiama', 'radio', 'panico', 'a terra', 'legato', 'stordito', 'morto', 'fuggito', 'combatte'];
const TIPI_PNG = ['guardia', 'poliziotto', 'titolare', 'civile', 'vigilante'];
const TIPI_VEICOLO = ['utilitaria', 'berlina', 'furgone', 'volante', 'blindato'];
const TIPI_SACCO = ['contanti', 'gioielli', 'oro', 'sigarette', 'documenti'];
const STATI_TELECAMERA = ['attiva', 'loop', 'rotta'];
const STATI_CASSAFORTE = ['chiusa', 'trapano', 'aperta', 'ritardo', 'persa'];

export function faiIstantanea(s) {
  return {
    t: r3(s.tempo),
    f: s.fase,
    c: s.colpo,
    g: s.giocatori.map(g => ({
      id: g.id, n: g.nome, r: g.ruolo, x: r2(g.x), z: r2(g.z), y: r3(g.yaw), p: r3(g.pitch), v: Math.round(g.vita), vm: g.vitaMax,
      s: STATI_GIOCATORE.indexOf(g.stato), m: g.maschera ? 1 : 0, k: g.sacchi.slice(0, 2), a: g.arma, au: g.inAuto ?? -1, po: g.posto,
      c: g.chino ? 1 : 0, co: g.corsa ? 1 : 0, fa: g.fascette, u: g.uso ? r2(g.uso.progresso / g.uso.totale) : -1, uk: g.uso?.chiave ?? '',
      gb: Math.round(g.giubbotto), tt: Math.round(g.timerTerra), tp: g.teletrasporto, ar: g.armi,
    })),
    p: s.png.map(p => [p.id, TIPI_PNG.indexOf(p.tipo), r2(p.x), r2(p.z), r3(p.yaw), STATI_PNG.indexOf(p.stato), r2(p.sospetto), Math.round(p.vita), p.muove ? r2(p.muove) : 0]),
    v: s.veicoli.map(v => [v.id, TIPI_VEICOLO.indexOf(v.tipo), r2(v.x), r2(v.z), r3(v.yaw), r2(v.vx), r2(v.vz), r2(v.sterzo), v.sirena ? 1 : 0, Math.round(v.vita), v.nostro ? 1 : 0, v.sacchi.length, r2(v.gas ?? 0)]),
    k: s.sacchi.map(k => [k.id, TIPI_SACCO.indexOf(k.tipo), r2(k.x), r2(k.y), r2(k.z), k.portatoDa ? 1 : 0, k.veicolo ?? -1]),
    tc: s.telecamere.map(t => [STATI_TELECAMERA.indexOf(t.stato), r3(t.yaw), r2(t.sospetto)]),
    po: Object.entries(s.porte).map(([id, p]) => [id, p.aperta ? 1 : 0, p.serratura ? 1 : 0]),
    cf: s.casseforti.map(c => [STATI_CASSAFORTE.indexOf(c.stato), r2(c.progresso), c.codiceNoto ? 1 : 0, c.inceppato ? 1 : 0]),
    bl: s.biglietti.map(b => (b.letto ? 1 : 0)),
    ca: s.casse.map(c => (c.piena ? 1 : 0)),
    vt: s.vetrine.map(v => [v.rotta ? 1 : 0, v.vuota ? 1 : 0]),
    al: [s.allarme.attivo ? 1 : 0, r2(s.allarme.tempo ?? 0), s.polizia.prossima === null || s.polizia.prossima === undefined ? -1 : r2(s.polizia.prossima), s.polizia.ondata ?? 0, s.allarme.lineaTagliata ? 1 : 0],
    fu: [s.fuga?.attiva ? 1 : 0, s.fuga?.polizia ? 1 : 0, r2(s.fuga?.lontano ?? 0)],
    mi: [s.tessera ? 1 : 0, s.fotografie ? 1 : 0, s.missione?.fatto ? 1 : 0, s.missione?.foto.length ?? 0, s.missione?.obiettivi.length ?? 0, s.scadenza ? r2(Math.max(0, s.scadenza - s.tempo)) : -1, s.antipanico === false ? 0 : 1],
    es: s.esito ?? null,
  };
}

export function espandi(i) {
  return {
    tempo: i.t,
    fase: i.f,
    colpo: i.c,
    giocatori: i.g.map(g => ({
      id: g.id, nome: g.n, ruolo: g.r, x: g.x, z: g.z, yaw: g.y, pitch: g.p, vita: g.v, vitaMax: g.vm, stato: STATI_GIOCATORE[g.s] ?? 'vivo',
      maschera: !!g.m, sacchi: g.k, arma: g.a, inAuto: g.au < 0 ? null : g.au, posto: g.po, chino: !!g.c, corsa: !!g.co, fascette: g.fa,
      uso: g.u, usoChiave: g.uk, giubbotto: g.gb, timerTerra: g.tt, teletrasporto: g.tp, armi: g.ar,
    })),
    png: i.p.map(([id, tipo, x, z, yaw, st, sospetto, vita, muove]) => ({ id, tipo: TIPI_PNG[tipo], x, z, yaw, stato: STATI_PNG[st], sospetto, vita, muove })),
    veicoli: i.v.map(([id, tipo, x, z, yaw, vx, vz, sterzo, sirena, vita, nostro, sacchi, gas]) => ({ id, tipo: TIPI_VEICOLO[tipo], x, z, yaw, vx, vz, sterzo, sirena: !!sirena, vita, nostro: !!nostro, sacchi, gas })),
    sacchi: i.k.map(([id, tipo, x, y, z, portato, veicolo]) => ({ id, tipo: TIPI_SACCO[tipo], x, y, z, portato: !!portato, veicolo: veicolo < 0 ? null : veicolo })),
    telecamere: i.tc.map(([st, yaw, sospetto]) => ({ stato: STATI_TELECAMERA[st], yaw, sospetto })),
    porte: Object.fromEntries(i.po.map(([id, aperta, serratura]) => [id, { aperta: !!aperta, serratura: !!serratura }])),
    casseforti: i.cf.map(([st, progresso, noto, inceppato]) => ({ stato: STATI_CASSAFORTE[st], progresso, codiceNoto: !!noto, inceppato: !!inceppato })),
    biglietti: i.bl.map(Boolean),
    casse: i.ca.map(Boolean),
    vetrine: i.vt.map(([rotta, vuota]) => ({ rotta: !!rotta, vuota: !!vuota })),
    allarme: { attivo: !!i.al[0], tempo: i.al[1], polizia: i.al[2] < 0 ? null : i.al[2], ondata: i.al[3], lineaTagliata: !!i.al[4] },
    fuga: { attiva: !!i.fu[0], polizia: !!i.fu[1], lontano: i.fu[2] },
    tessera: !!i.mi[0],
    fotografie: !!i.mi[1],
    missione: { fatto: !!i.mi[2], foto: i.mi[3], totale: i.mi[4] },
    scadenza: i.mi[5] < 0 ? null : i.mi[5],
    antipanico: i.mi[6] !== 0,
    esito: i.es,
  };
}

const misto = (a, b, t) => a + (b - a) * t;
const mistoAngolo = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

function fondi(elencoA, elencoB, t, chiave = 'id') {
  const prima = new Map(elencoA.map(e => [e[chiave], e]));
  return elencoB.map(b => {
    const a = prima.get(b[chiave]);
    if (!a || Math.hypot(a.x - b.x, a.z - b.z) > 12) return b;
    return { ...b, x: misto(a.x, b.x, t), z: misto(a.z, b.z, t), yaw: mistoAngolo(a.yaw, b.yaw, t), ...(b.y !== undefined && a.y !== undefined ? { y: misto(a.y, b.y, t) } : {}) };
  });
}

export function interpola(a, b, t) {
  const k = Math.max(0, Math.min(1, t));
  return {
    ...b,
    tempo: misto(a.tempo, b.tempo, k),
    giocatori: fondi(a.giocatori, b.giocatori, k),
    png: fondi(a.png, b.png, k),
    veicoli: fondi(a.veicoli, b.veicoli, k),
    sacchi: fondi(a.sacchi, b.sacchi, k),
    telecamere: b.telecamere.map((tc, i) => (a.telecamere[i] ? { ...tc, yaw: mistoAngolo(a.telecamere[i].yaw, tc.yaw, k) } : tc)),
  };
}
