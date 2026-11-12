import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { preparaCitta } from '../src/citta/citta.js';
import { creaCollisioni } from '../src/citta/collisioni.js';
import { lunghezzaPercorso } from '../src/citta/strade.js';
import { ALTEZZA_MARCIAPIEDE } from '../src/citta/viabilita.js';

const dati = JSON.parse(readFileSync(new URL('../public/cerano/cerano.json', import.meta.url), 'utf8'));
const citta = preparaCitta(dati);

test('i dati di Cerano hanno edifici, strade coi nomi veri e la chiesa all\'origine', () => {
  assert.ok(dati.edifici.length > 3000);
  assert.ok(dati.vie.includes('Via Roma'));
  assert.ok(dati.vie.includes('Piazza Crespi'));
  const chiesa = dati.edifici.find(e => e.id === 566072002);
  assert.ok(chiesa, 'manca la chiesa');
  const xs = chiesa.p.map(p => p[0]);
  assert.ok(Math.min(...xs) > -1.5 && Math.min(...xs) < 1.5, `facciata non a x=0: ${Math.min(...xs)}`);
  assert.ok(Math.max(...xs) > 45, 'la navata deve andare verso est');
});

test('un cerchio non attraversa un muro', () => {
  const c = creaCollisioni();
  c.aggiungiSegmento(0, -5, 0, 5);
  const esito = c.muoviCerchio(-2, 0, 5, 0, 0.4);
  assert.ok(esito.x <= -0.39, `passato attraverso: ${esito.x}`);
  assert.equal(esito.urto, true);
  const libero = c.muoviCerchio(-2, 7, 5, 0, 0.4);
  assert.ok(libero.x > 2.9);
});

test('il raggio si ferma sul primo muro', () => {
  const c = creaCollisioni();
  c.aggiungiSegmento(10, -5, 10, 5);
  c.aggiungiSegmento(20, -5, 20, 5);
  const r = c.raggio(0, 0, 1, 0, 50);
  assert.ok(Math.abs(r.distanza - 10) < 1e-6);
  assert.equal(c.libero(0, 0, 9, 0), true);
  assert.equal(c.libero(0, 0, 15, 0), false);
});

test('nessun edificio si attraversa camminando', () => {
  const e = dati.edifici.find(x => x.u === 'centro' && x.p.length >= 4);
  const [cx, cz] = citta.centroEdificio(e);
  const fuori = [e.p[0][0] + (e.p[0][0] - cx) * 0.6, e.p[0][1] + (e.p[0][1] - cz) * 0.6];
  const esito = citta.collisioni.muoviCerchio(fuori[0], fuori[1], (cx - fuori[0]) * 1.5, (cz - fuori[1]) * 1.5, 0.35);
  assert.equal(citta.edificioIn(esito.x, esito.z)?.id === e.id, false, 'il giocatore è finito dentro la casa');
});

test('il grafo stradale porta da Piazza Crespi alla circonvallazione', () => {
  const p = citta.grafo.percorso({ x: -20, z: 0 }, { x: 900, z: 300 });
  assert.ok(p && p.length > 3, 'percorso non trovato');
  const l = lunghezzaPercorso(p);
  assert.ok(l > 900 && l < 2500, `percorso strano: ${l} m`);
});

test('i marciapiedi sono rialzati e interrotti agli incroci', () => {
  const conMarciapiede = citta.viabilita.filter((v, i) => dati.strade[i].m.some(m => m > 0));
  assert.ok(conMarciapiede.length > 50);
  let rialzati = 0;
  dati.strade.forEach((s, i) => {
    const v = citta.viabilita[i];
    if (!v.pezzi[0].length) return;
    const [s0, s1] = v.pezzi[0][0];
    const meta = (s0 + s1) / 2;
    let k = 1;
    while (k < v.cum.length - 1 && v.cum[k] < meta) k++;
    const a = s.p[k - 1];
    const b = s.p[k];
    const t = (meta - v.cum[k - 1]) / (v.cum[k] - v.cum[k - 1]);
    const x = a[0] + (b[0] - a[0]) * t;
    const z = a[1] + (b[1] - a[1]) * t;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = -(b[1] - a[1]) / l;
    const nz = (b[0] - a[0]) / l;
    const d = s.l / 2 + s.m[0] / 2;
    if (citta.quota(x + nx * d, z + nz * d) === ALTEZZA_MARCIAPIEDE) rialzati += 1;
    assert.equal(citta.quota(x, z) === ALTEZZA_MARCIAPIEDE && !s.b, false, 'la carreggiata è rialzata');
  });
  assert.ok(rialzati > 40, `marciapiedi rialzati trovati: ${rialzati}`);
});

test('le altezze degli edifici vengono dal rilievo BDTRE per la maggior parte della città', () => {
  const misurati = dati.edifici.filter(e => e.hr);
  assert.ok(misurati.length / dati.edifici.length > 0.6, `solo ${misurati.length} su ${dati.edifici.length}`);
  const supermercato = dati.edifici.find(e => e.id === 1239347530);
  assert.equal(supermercato.hr, 1);
  assert.ok(supermercato.h > 7 && supermercato.h < 11, `altezza ${supermercato.h}`);
  assert.ok(misurati.every(e => e.h >= 2.4 && e.h < 25), 'altezza misurata fuori scala');
});

test('l\'arredo urbano vero di OpenStreetMap è nella mappa e si urta', () => {
  const conta = t => dati.arredi.filter(a => a[0] === t).length;
  assert.ok(conta('strisce') >= 30, `strisce ${conta('strisce')}`);
  assert.ok(conta('stop') >= 60, `stop ${conta('stop')}`);
  assert.ok(conta('fermata') >= 15, `fermate ${conta('fermata')}`);
  const fontana = dati.arredi.find(a => a[0] === 'fontana' && a[4] === 'Fontana Beato Pacifico');
  assert.ok(fontana, 'manca la fontana di Piazza Crespi');
  assert.ok(Math.hypot(fontana[1] + 35, fontana[2] - 24) < 2, `fontana fuori posto: ${fontana[1]},${fontana[2]}`);
  assert.equal(citta.collisioni.respingi(fontana[1] + 0.5, fontana[2], 0.3).urto, true);
  const caduti = dati.arredi.find(a => a[0] === 'monumento' && a[4] === 'Monumento ai Caduti');
  assert.ok(caduti, 'manca il Monumento ai Caduti');
});
