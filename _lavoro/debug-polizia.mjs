import { readFileSync } from 'node:fs';
import { creaAmbiente } from '../src/gioco/ambiente.js';
import { creaPartita, passo, scattaAllarme } from '../src/gioco/partita.js';
import { velocita } from '../src/gioco/veicoli.js';
const dati = JSON.parse(readFileSync(new URL('../public/cerano/cerano.json', import.meta.url), 'utf8'));
const amb = creaAmbiente(dati);
const s = creaPartita({ seme: 3, colpo: 'tabaccheria', giocatori: [{ id: 'a', nome: 'R', ruolo: 'azione' }], ambiente: amb });
scattaAllarme(s, 'prova', []);
s.polizia.prossima = 0.1;
const luogo = amb.luoghi.get('tabaccheria');
for (let t = 0; t < 90; t += 1 / 60) {
  passo(s, 1 / 60, {}, amb);
  if (Math.abs(t % 5) < 1 / 60) {
    console.log(t.toFixed(0), s.veicoli.filter(v => v.polizia).map(v => `${v.compito} d=${Math.hypot(v.meta[0] - v.x, v.meta[1] - v.z).toFixed(0)} v=${velocita(v).toFixed(1)} vita=${v.vita.toFixed(0)} perc=${v.percorso?.length}`).join(' | '), 'agenti', s.png.filter(p => p.tipo === 'poliziotto').length);
  }
}
