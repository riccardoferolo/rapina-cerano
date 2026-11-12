import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creaAmbiente } from '../src/gioco/ambiente.js';
import { creaPartita, passo, scattaAllarme } from '../src/gioco/partita.js';
import { faiIstantanea, espandi, interpola } from '../src/gioco/istantanea.js';
import { valida, normalizzaCodice, pulisciNome } from '../src/rete/protocollo.js';

const dati = JSON.parse(readFileSync(new URL('../public/cerano/cerano.json', import.meta.url), 'utf8'));
const amb = creaAmbiente(dati);

test("l'istantanea di un colpo passa la validazione e si espande", () => {
  const s = creaPartita({ seme: 4, colpo: 'tabaccheria', giocatori: [{ id: 'x1', nome: 'Richi', ruolo: 'hacker' }, { id: 'x2', nome: 'Seba', ruolo: 'azione' }], ambiente: amb });
  scattaAllarme(s, 'prova', []);
  s.polizia.prossima = 0.05;
  for (let i = 0; i < 120; i++) passo(s, 1 / 60, {}, amb);
  const ist = faiIstantanea(s);
  const m = valida(JSON.parse(JSON.stringify({ t: 'st', g: 4, ist })));
  assert.ok(m, 'istantanea rifiutata');
  const v = espandi(m.ist);
  assert.equal(v.giocatori.length, 2);
  assert.equal(v.giocatori[0].ruolo, 'hacker');
  assert.ok(v.veicoli.some(x => x.tipo === 'volante'));
  assert.equal(v.allarme.attivo, true);
  const mezzo = interpola(v, v, 0.5);
  assert.equal(mezzo.png.length, v.png.length);
});

test('i messaggi sbagliati vengono scartati', () => {
  assert.equal(valida({ t: 'g', x: 'a', z: 0, yaw: 0, pitch: 0, tp: 0 }), null);
  assert.equal(valida({ t: 'az', a: { tipo: 'usa', chiave: 'x'.repeat(200), attivo: true } }), null);
  assert.equal(valida({ t: 'az', a: { tipo: 'distruggi' } }), null);
  assert.ok(valida({ t: 'az', a: { tipo: 'usa', chiave: 'porta:retro', attivo: true } }));
  assert.equal(valida({ t: 'inizia', seme: 3, colpo: 'casinò' }), null);
  assert.equal(normalizzaCodice('kxrt'), 'KXRT');
  assert.equal(pulisciNome('<b>Richi</b>'), 'bRichi/b');
});
