import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creaAmbiente } from '../src/gioco/ambiente.js';
import { creaPartita, passo } from '../src/gioco/partita.js';
import { R } from '../src/gioco/regole.js';
import { puntiVeicolo, guida, creaVeicolo, velocita } from '../src/gioco/veicoli.js';
import { allestisci } from '../src/gioco/allestimento.js';

const dati = JSON.parse(readFileSync(new URL('../public/cerano/cerano.json', import.meta.url), 'utf8'));
const amb = creaAmbiente(dati);
const luogo = amb.luoghi.get('tabaccheria');
const SQUADRA = [{ id: 'a', nome: 'Richi', ruolo: 'scassinatore' }, { id: 'b', nome: 'Seba', ruolo: 'autista' }];

function nuova(seme = 7) {
  return creaPartita({ seme, colpo: 'tabaccheria', giocatori: SQUADRA, ambiente: amb });
}
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
const allontana = stato => {
  for (const p of stato.png) {
    p.x = luogo.centro[0] + 400;
    p.z = luogo.centro[1] + 400;
    p.giro = [{ x: p.x, z: p.z, sosta: 999 }];
    p.tappa = 0;
  }
};

test('il seme cambia cassaforte e combinazione, lo stesso seme le ripete', () => {
  const a = allestisci(luogo.def, 1, luogo, amb.citta);
  const b = allestisci(luogo.def, 1, luogo, amb.citta);
  assert.deepEqual(a.casseforti, b.casseforti);
  const diversi = new Set(Array.from({ length: 12 }, (_, i) => {
    const c = allestisci(luogo.def, i + 10, luogo, amb.citta).casseforti[0];
    return `${c.x.toFixed(1)}|${c.codice}`;
  }));
  assert.ok(diversi.size >= 6, `poche varianti: ${diversi.size}`);
});

test("la tabaccheria è su Via Roma e l'auto è parcheggiata vicino", () => {
  assert.equal(amb.citta.viaVicina(...luogo.ingresso), 'Via Roma');
  const s = nuova();
  const v = s.veicoli[0];
  const d = Math.hypot(v.x - luogo.ingresso[0], v.z - luogo.ingresso[1]);
  assert.ok(d > 20 && d < 95, `auto a ${d} m`);
});

test('foglietto, combinazione, sacchi nel bagagliaio e fuga fino al rifugio senza allarme', () => {
  const s = nuova(11);
  allontana(s);
  const b = s.biglietti[0];
  avanza(s, 0.1, { posizioni: metti(s, 'a', b.x, b.z) });
  avanza(s, 0.1, { azioni: [usa('a', `biglietto:${b.id}`)], posizioni: {} });
  avanza(s, 2, {});
  const c = s.casseforti[0];
  assert.equal(c.codiceNoto, true, 'combinazione non letta');
  avanza(s, 0.1, { posizioni: metti(s, 'a', c.x, c.z) });
  avanza(s, 0.1, { azioni: [usa('a', `codice:${c.id}`)] });
  avanza(s, 3, {});
  assert.equal(c.stato, 'aperta');
  const sacchi = s.sacchi.filter(x => x.portatoDa === null && x.veicolo === null && Math.hypot(x.x - c.x, x.z - c.z) < 3);
  assert.equal(sacchi.length, 3);
  const auto = s.veicoli[0];
  for (const sacco of sacchi) {
    avanza(s, 0.1, { posizioni: metti(s, 'a', sacco.x, sacco.z) });
    avanza(s, 0.1, { azioni: [usa('a', `sacco:${sacco.id}`)] });
    assert.equal(sacco.portatoDa, 'a');
    const [tx, tz] = puntiVeicolo(auto).bagagliaio;
    avanza(s, 0.1, { posizioni: metti(s, 'a', tx, tz) });
    avanza(s, 0.1, { azioni: [usa('a', `bagagliaio:${auto.id}`)] });
    assert.equal(sacco.veicolo, auto.id);
  }
  const pv = puntiVeicolo(auto);
  avanza(s, 0.1, { posizioni: { ...metti(s, 'b', ...pv.portaGuida), ...metti(s, 'a', ...pv.portaPasseggero) } });
  avanza(s, 0.1, { azioni: [usa('b', `auto:${auto.id}:0`), usa('a', `auto:${auto.id}:1`)] });
  assert.equal(auto.guidatore, 'b');
  assert.equal(s.allarme.attivo, false, `allarme: ${s.allarme.motivo}`);
  const percorso = amb.citta.grafo.percorso({ x: auto.x, z: auto.z }, { x: amb.rifugio[0], z: amb.rifugio[1] });
  for (const p of percorso) avanza(s, 0.05, { posizioni: { b: { x: 0, z: 0, yaw: 0, pitch: 0, veicolo: { ...auto, x: p.x, z: p.z, vx: 0, vz: 0 } } } });
  avanza(s, 0.3, { posizioni: { b: { x: 0, z: 0, yaw: 0, pitch: 0, veicolo: { ...auto, x: amb.rifugio[0], z: amb.rifugio[1], vx: 0, vz: 0 } } } });
  assert.ok(s.esito?.vinto, `nessun esito: ${JSON.stringify(s.esito)} fuga ${JSON.stringify(s.fuga)}`);
  assert.equal(s.esito.pulito, true);
  assert.equal(s.esito.lordo, 15000);
  assert.equal(s.esito.totale, 18000);
});

test("col passamontagna davanti al titolare scatta l'antipanico e poi arriva la polizia", () => {
  const s = nuova(3);
  const tit = s.png.find(p => p.tipo === 'titolare');
  [tit.x, tit.z] = luogo.mondo(2.5, 4.6);
  tit.giro = [{ x: tit.x, z: tit.z, sosta: 999 }];
  tit.tappa = 0;
  const [x, z] = luogo.mondo(2.5, 1.8);
  tit.yaw = Math.atan2(-(x - tit.x), -(z - tit.z));
  const eventi = avanza(s, 0.2, { posizioni: metti(s, 'a', x, z), azioni: [{ da: 'a', tipo: 'maschera' }] });
  eventi.push(...avanza(s, 8, {}));
  assert.equal(s.allarme.attivo, true, `stato titolare: ${tit.stato}, sospetto ${tit.sospetto}`);
  assert.ok(eventi.some(e => e.k === 'allarme'));
  avanza(s, s.polizia.prossima - s.tempo + 0.5, {});
  const volanti = s.veicoli.filter(v => v.polizia);
  assert.ok(volanti.length >= 2, `volanti: ${volanti.length}`);
  avanza(s, 60, {});
  assert.ok(s.png.some(p => p.tipo === 'poliziotto'), 'nessun agente sceso dalle volanti');
});

test("gridare mette a terra il titolare, le fascette lo legano e non dà più l'allarme", () => {
  const s = nuova(5);
  allontana(s);
  const tit = s.png.find(p => p.tipo === 'titolare');
  [tit.x, tit.z] = luogo.mondo(2.5, 4.6);
  tit.giro = [{ x: tit.x, z: tit.z, sosta: 999 }];
  tit.tappa = 0;
  const yawVerso = Math.atan2(2, 0);
  avanza(s, 0.1, { posizioni: metti(s, 'a', tit.x + 2, tit.z, { yaw: yawVerso }) });
  avanza(s, 0.1, { azioni: [{ da: 'a', tipo: 'grida' }] });
  assert.equal(tit.stato, 'a terra');
  avanza(s, 0.1, { azioni: [usa('a', `lega:${tit.id}`)] });
  avanza(s, 3, {});
  assert.equal(tit.stato, 'legato');
  avanza(s, 40, {});
  assert.equal(s.allarme.attivo, false, s.allarme.motivo ?? '');
});

test('se tutti i giocatori vanno a terra il colpo fallisce', () => {
  const s = nuova(9);
  for (const g of s.giocatori) {
    g.vita = 0;
    g.stato = 'terra';
    g.timerTerra = 0.5;
  }
  avanza(s, 1, {});
  assert.equal(s.esito?.vinto, false);
});

test("l'auto accelera, sterza e non attraversa le case", () => {
  const v = creaVeicolo(1, 'utilitaria', -20, 4, -Math.PI / 2);
  for (let i = 0; i < 120; i++) guida(v, { gas: 1, sterzo: 0 }, 1 / 60, {});
  assert.ok(velocita(v) > 8, `troppo lenta: ${velocita(v)}`);
  const yaw0 = v.yaw;
  for (let i = 0; i < 60; i++) guida(v, { gas: 0.5, sterzo: 1 }, 1 / 60, {});
  assert.ok(Math.abs(v.yaw - yaw0) > 0.3, 'non sterza');
  const [cx, cz] = luogo.centro;
  const muro = creaVeicolo(2, 'utilitaria', cx - luogo.c.vx * 25, cz - luogo.c.vz * 25, Math.atan2(-luogo.c.vx, -luogo.c.vz));
  for (let i = 0; i < 600; i++) guida(muro, { gas: 1, sterzo: 0 }, 1 / 60, { collisioni: amb.citta.collisioni });
  assert.ok(Number.isFinite(muro.x) && Number.isFinite(muro.vx));
  assert.equal(luogo.dentro(muro.x, muro.z), false, "l'auto è entrata nella tabaccheria");
});
