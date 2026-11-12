import { ATTREZZI, POTENZIAMENTI } from './regole.js';
import { COLPI } from './colpi/indice.js';

const CHIAVE = 'rapina.campagna';
const SOLDI_INIZIALI = 2500;

export function nuovaCampagna() {
  return { versione: 1, colpi: {}, giocatori: {}, preparazioni: {}, veicolo: 'utilitaria' };
}

export function caricaCampagna(archivio = globalThis.localStorage) {
  try {
    const dati = JSON.parse(archivio?.getItem(CHIAVE) ?? 'null');
    if (dati?.versione === 1) return dati;
  } catch {
    return nuovaCampagna();
  }
  return nuovaCampagna();
}

export function salvaCampagna(c, archivio = globalThis.localStorage) {
  try {
    archivio?.setItem(CHIAVE, JSON.stringify(c));
    return true;
  } catch {
    return false;
  }
}

export function scheda(c, nome) {
  c.giocatori[nome] ??= { soldi: SOLDI_INIZIALI, attrezzi: [], potenziamenti: [] };
  return c.giocatori[nome];
}

export function sbloccato(c, id) {
  const def = COLPI.find(x => x.id === id);
  if (!def) return false;
  if (def.ordine === 1) return true;
  const prima = COLPI.find(x => x.ordine === def.ordine - 1);
  return !prima || (c.colpi[prima.id]?.fatti ?? 0) > 0;
}

export function preparazioniFatte(c, id) {
  return c.preparazioni[id] ?? [];
}

export function registraEsito(c, idColpo, esito, nomi) {
  if (!esito?.vinto) return [];
  const voce = (c.colpi[idColpo] ??= { fatti: 0, migliore: 0 });
  voce.fatti += 1;
  voce.migliore = Math.max(voce.migliore, esito.totale);
  const presenti = nomi.length ? nomi : ['?'];
  const quota = Math.floor(esito.totale / presenti.length);
  return presenti.map(nome => {
    const s = scheda(c, nome);
    s.soldi += quota;
    for (const usa of ['kit']) s.attrezzi = s.attrezzi.filter(a => a !== usa);
    return { nome, quota };
  });
}

export function registraPreparazione(c, idColpo, idPrep) {
  const elenco = (c.preparazioni[idColpo] ??= []);
  if (!elenco.includes(idPrep)) elenco.push(idPrep);
}

export function compra(c, nome, voce) {
  const s = scheda(c, nome);
  const a = ATTREZZI[voce];
  if (!a) return { ok: false, motivo: 'Attrezzo sconosciuto' };
  if (s.attrezzi.includes(voce)) return { ok: false, motivo: 'Ce l\'hai già' };
  if (s.soldi < a.costo) return { ok: false, motivo: 'Non hai abbastanza soldi' };
  s.soldi -= a.costo;
  s.attrezzi.push(voce);
  return { ok: true };
}

export function potenzia(c, nome, ruolo, nomePotenziamento) {
  const s = scheda(c, nome);
  const p = POTENZIAMENTI[ruolo]?.find(x => x.nome === nomePotenziamento);
  if (!p) return { ok: false, motivo: 'Potenziamento sconosciuto' };
  if (s.potenziamenti.includes(p.nome)) return { ok: false, motivo: 'Ce l\'hai già' };
  if (s.soldi < p.costo) return { ok: false, motivo: 'Non hai abbastanza soldi' };
  s.soldi -= p.costo;
  s.potenziamenti.push(p.nome);
  return { ok: true };
}

export function veicoloColpo(c, idColpo) {
  return preparazioniFatte(c, idColpo).includes('furgone') ? 'furgone' : 'utilitaria';
}

export function riassunto(c) {
  return {
    colpi: Object.fromEntries(COLPI.map(def => [def.id, { fatti: c.colpi[def.id]?.fatti ?? 0, migliore: c.colpi[def.id]?.migliore ?? 0, sbloccato: sbloccato(c, def.id), preparazioni: preparazioniFatte(c, def.id) }])),
    giocatori: c.giocatori,
    veicolo: c.veicolo,
  };
}
