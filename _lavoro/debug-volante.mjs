import { readFileSync } from 'node:fs';
import { creaAmbiente } from '../src/gioco/ambiente.js';
import { creaPartita, passo, scattaAllarme } from '../src/gioco/partita.js';
import { velocita } from '../src/gioco/veicoli.js';
import { puntoAvanti } from '../src/citta/strade.js';
const dati = JSON.parse(readFileSync(new URL('../public/cerano/cerano.json', import.meta.url), 'utf8'));
const amb = creaAmbiente(dati);
const s = creaPartita({ seme: 3, colpo: 'tabaccheria', giocatori: [{ id: 'a', nome: 'R', ruolo: 'azione' }], ambiente: amb });
scattaAllarme(s, 'prova', []);
s.polizia.prossima = 0.1;
let n = 0;
for (let t = 0; t < 90; t += 1 / 60) {
  passo(s, 1 / 60, {}, amb);
  n++;
  const v = s.veicoli.filter(x => x.polizia)[2];
  if (v && n % 30 === 0 && t > 64.5 && t < 66.5) {
    const a = puntoAvanti(v.percorso ?? [{ x: 0, z: 0 }], v.x, v.z, 5);
    console.log(t.toFixed(1), v.x.toFixed(1), v.z.toFixed(1), 'yaw', v.yaw.toFixed(2), 'v', velocita(v).toFixed(1), 'ster', v.sterzo.toFixed(2), 'gas', v.gas, 'ant', a.x.toFixed(1), a.z.toFixed(1), 'dist', a.distanza?.toFixed(1), 'retro', (v.retro ?? 0).toFixed(1), 'perc', v.percorso?.length, 'urto', v.urto, 'vx', v.vx.toFixed(2), v.vz.toFixed(2), 'vicini', s.veicoli.filter(o => o !== v && Math.hypot(o.x - v.x, o.z - v.z) < 9).map(o => o.id + ':' + Math.hypot(o.x - v.x, o.z - v.z).toFixed(1)).join(','), 'compito', v.compito);
  }
}
