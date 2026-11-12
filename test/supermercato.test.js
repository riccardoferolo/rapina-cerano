import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creaAmbiente } from '../src/gioco/ambiente.js';
import { creaPartita, passo, interazioni } from '../src/gioco/partita.js';
import { R } from '../src/gioco/regole.js';
import { faiIstantanea, espandi } from '../src/gioco/istantanea.js';
import { valida } from '../src/rete/protocollo.js';

const dati = JSON.parse(readFileSync(new URL('../public/cerano/cerano.json', import.meta.url), 'utf8'));
const amb = creaAmbiente(dati);
const luogo = amb.luoghi.get('supermercato');
const SQUADRA = [{ id: 'a', nome: 'Richi', ruolo: 'scassinatore' }, { id: 'b', nome: 'Seba', ruolo: 'hacker' }];

const nuova = (seme = 7) => creaPartita({ seme, colpo: 'supermercato', giocatori: SQUADRA, ambiente: amb });
function metti(stato, id, x, z, extra = {}) {
  const g = stato.giocatori.find(q => q.id === id);
  g.teletrasporto += 1;
  return { [id]: { x, z, yaw: extra.yaw ?? g.yaw, pitch: 0, tp: g.teletrasporto, ...extra } };
}
function avanza(stato, secondi, ingressi = {}) {
  const eventi = [];
  const n = Math.max(1, Math.round(secondi / R.PASSO));
  for (let i = 0; i < n; i++) eventi.push(...passo(stato, R.PASSO, i === 0 ? ingressi : { posizioni: ingressi.posizioni }, amb));
  return eventi;
}
const usa = (da, chiave, attivo = true) => ({ da, tipo: 'usa', chiave, attivo });
const fermo = (p, u, v, yaw = 0) => {
  [p.x, p.z] = luogo.mondo(u, v);
  p.giro = [{ x: p.x, z: p.z, sosta: 999 }];
  p.tappa = 0;
  p.yaw = yaw;
};
const allontana = (stato, tranne = []) => {
  for (const p of stato.png) {
    if (tranne.includes(p)) continue;
    p.x = luogo.centro[0] + 400;
    p.z = luogo.centro[1] + 400;
    p.giro = [{ x: p.x, z: p.z, sosta: 999 }];
    p.tappa = 0;
  }
};
const telecamereInLoop = stato => {
  for (const t of stato.telecamere) {
    t.stato = 'loop';
    t.loopFino = Infinity;
  }
};
const centroPorta = id => {
  const d = luogo.porte.find(p => p.id === id).mondo;
  return [(d.da[0] + d.a[0]) / 2, (d.da[1] + d.a[1]) / 2];
};

test('il supermercato è in Piazza Crespi, nell\'edificio dove OpenStreetMap mette il negozio', () => {
  assert.equal(luogo.c.edificio.id, 1239347530);
  assert.match(amb.citta.viaVicina(...luogo.ingresso), /Crespi/);
  const s = nuova(3);
  assert.equal(s.casse.length, 3);
  assert.equal(s.pulsanti.length, 3);
  assert.equal(s.casseforti[0].ritardo, 40);
  assert.equal(s.prelievo.tempo, 360);
  assert.equal(s.scadenza, 360);
  assert.ok(s.png.length >= 9, `pochi personaggi: ${s.png.length}`);
  for (const id of ['ingresso', 'uscita', 'servizio']) assert.ok(luogo.porte.find(p => p.id === id).mondo, `porta ${id} non sul guscio`);
  const nomi = s.oggetti.map(o => o.tipo).sort();
  assert.deepEqual(nomi, ['quadro', 'registratore']);
});

test('la cassa centrale vuole la tessera: si sfila al direttore alle spalle e la porta si apre', () => {
  const s = nuova(5);
  telecamereInLoop(s);
  const dir = s.png.find(p => p.tessera);
  allontana(s, [dir]);
  fermo(dir, 6.3, 15.4, 0.4);
  const [px, pz] = centroPorta('cassaCentrale');
  avanza(s, 0.1, { posizioni: metti(s, 'a', px, pz) });
  const g = s.giocatori.find(q => q.id === 'a');
  const voce = interazioni(s, amb, g).find(i => i.chiave === 'tessera:cassaCentrale');
  assert.equal(voce.tempo, Infinity, 'senza tessera la porta non deve aprirsi');
  const dietro = [dir.x + Math.sin(dir.yaw) * 1.1, dir.z + Math.cos(dir.yaw) * 1.1];
  avanza(s, 0.1, { posizioni: metti(s, 'a', ...dietro) });
  avanza(s, 0.1, { azioni: [usa('a', `borseggia:${dir.id}`)] });
  avanza(s, 4, {});
  assert.equal(s.tessera, true, `stato del direttore: ${dir.stato}`);
  avanza(s, 0.1, { posizioni: metti(s, 'a', px, pz) });
  avanza(s, 0.1, { azioni: [usa('a', 'tessera:cassaCentrale')] });
  avanza(s, 1, {});
  assert.equal(s.porte.cassaCentrale.aperta, true);
  assert.equal(s.allarme.attivo, false, s.allarme.motivo ?? '');
});

test('la serratura a tempo apre la cassa centrale solo dopo quaranta secondi', () => {
  const s = nuova(9);
  telecamereInLoop(s);
  allontana(s);
  const c = s.casseforti[0];
  c.codiceNoto = true;
  avanza(s, 0.1, { posizioni: metti(s, 'a', c.x, c.z) });
  avanza(s, 0.1, { azioni: [usa('a', `codice:${c.id}`)] });
  avanza(s, 3, {});
  assert.equal(c.stato, 'ritardo');
  const g = s.giocatori.find(q => q.id === 'a');
  assert.ok(!interazioni(s, amb, g).some(i => i.chiave.endsWith(`:${c.id}`)), 'durante l\'attesa la cassaforte non si tocca');
  avanza(s, 34, {});
  assert.equal(c.stato, 'ritardo');
  assert.ok(c.progresso > 0.8 && c.progresso < 1, `progresso ${c.progresso}`);
  avanza(s, 5, {});
  assert.equal(c.stato, 'aperta');
  assert.equal(s.sacchi.filter(x => Math.hypot(x.x - c.x, x.z - c.z) < 3).length, 3);
});

function cassieraSpaventata(antipanico) {
  const s = nuova(4);
  s.antipanico = antipanico;
  telecamereInLoop(s);
  const cassiera = s.png.find(p => p.tipo === 'titolare');
  allontana(s, [cassiera]);
  fermo(cassiera, 5.8, 2.9);
  const [x, z] = luogo.mondo(5.9, 1.0);
  cassiera.yaw = Math.atan2(-(x - cassiera.x), -(z - cassiera.z));
  avanza(s, 0.2, { posizioni: metti(s, 'a', x, z), azioni: [{ da: 'a', tipo: 'maschera' }] });
  for (let t = 0; t < 8 && cassiera.stato !== 'panico'; t += 0.1) avanza(s, 0.1, {});
  return { s, cassiera };
}

test('la cassiera spaventata corre all\'antipanico più vicino e fa scattare l\'allarme', () => {
  const { s, cassiera } = cassieraSpaventata(true);
  assert.equal(cassiera.stato, 'panico');
  const vicino = s.pulsanti.reduce((m, b) => (Math.hypot(b.x - cassiera.x, b.z - cassiera.z) < Math.hypot(m.x - cassiera.x, m.z - cassiera.z) ? b : m));
  assert.equal(cassiera.meta.pulsante, true);
  assert.deepEqual([cassiera.meta.x, cassiera.meta.z], [vicino.x, vicino.z]);
  avanza(s, 6, {});
  assert.equal(s.allarme.attivo, true);
  assert.match(s.allarme.motivo, /antipanico/);
});

test('staccati gli antipanico dal quadro, il pulsante non chiama più nessuno', () => {
  const s0 = nuova(4);
  telecamereInLoop(s0);
  allontana(s0);
  const quadro = s0.oggetti.find(o => o.tipo === 'quadro');
  avanza(s0, 0.1, { posizioni: metti(s0, 'b', quadro.x, quadro.z) });
  avanza(s0, 0.1, { azioni: [usa('b', `quadro:${quadro.id}`)] });
  avanza(s0, 4, {});
  assert.equal(s0.antipanico, false, 'l\'hacker stacca il quadro in pochi secondi');
  const { s, cassiera } = cassieraSpaventata(false);
  assert.equal(cassiera.stato, 'panico');
  assert.notEqual(cassiera.meta.pulsante, true);
  avanza(s, 8, {});
  assert.ok(!/antipanico/.test(s.allarme.motivo ?? ''), s.allarme.motivo);
});

test('dal videoregistratore della sala sicurezza si spengono tutte le telecamere', () => {
  const s = nuova(6);
  allontana(s);
  const reg = s.oggetti.find(o => o.tipo === 'registratore');
  avanza(s, 0.1, { posizioni: metti(s, 'b', reg.x, reg.z) });
  avanza(s, 0.1, { azioni: [usa('b', `registratore:${reg.id}`)] });
  avanza(s, 3, {});
  assert.ok(s.telecamere.every(t => t.stato === 'loop'), s.telecamere.map(t => t.stato).join(','));
  avanza(s, 120, {});
  assert.ok(s.telecamere.every(t => t.stato === 'loop'), 'le telecamere sono tornate a registrare');
});

test('il portavalori avvisa, poi ritira l\'incasso se la cassa centrale è ancora chiusa', () => {
  const s = nuova(8);
  allontana(s);
  s.prelievo.tempo = s.scadenza = s.tempo + 95;
  const eventi = avanza(s, 6, {});
  assert.ok(eventi.some(e => e.k === 'messaggio' && /90 secondi/.test(e.testo)), 'manca l\'avviso dei 90 secondi');
  avanza(s, 90, {});
  assert.equal(s.casseforti[0].stato, 'persa');
  assert.equal(s.scadenza, null);
  assert.equal(s.allarme.attivo, false);
});

test('se il portavalori trova la cassa centrale forzata scatta l\'allarme', () => {
  const s = nuova(8);
  telecamereInLoop(s);
  allontana(s);
  const c = s.casseforti[0];
  c.codiceNoto = true;
  s.prelievo.tempo = s.scadenza = s.tempo + 20;
  avanza(s, 0.1, { posizioni: metti(s, 'a', c.x, c.z) });
  avanza(s, 0.1, { azioni: [usa('a', `codice:${c.id}`)] });
  avanza(s, 22, {});
  assert.equal(c.stato, 'ritardo');
  assert.equal(s.allarme.attivo, true);
  assert.match(s.allarme.motivo, /portavalori/);
});

test('l\'istantanea del supermercato passa la validazione e porta antipanico e cassa a tempo', () => {
  const s = nuova(2);
  s.antipanico = false;
  s.casseforti[0].stato = 'ritardo';
  const m = valida(JSON.parse(JSON.stringify({ t: 'st', g: 2, ist: faiIstantanea(s) })));
  assert.ok(m, 'istantanea rifiutata');
  const v = espandi(m.ist);
  assert.equal(v.antipanico, false);
  assert.equal(v.casseforti[0].stato, 'ritardo');
  assert.ok(v.scadenza > 0);
});
