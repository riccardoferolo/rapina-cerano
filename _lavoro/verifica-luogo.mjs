import { readFileSync } from 'node:fs';
import { creaAmbiente } from '../src/gioco/ambiente.js';
const dati = JSON.parse(readFileSync(new URL('../public/cerano/cerano.json', import.meta.url), 'utf8'));
const amb = creaAmbiente(dati);
for (const [id, l] of amb.luoghi) {
  const { c } = l;
  console.log(id, 'lato', c.latoReale.toFixed(1), 'prof', c.profReale.toFixed(1), 'su', l.su.toFixed(2), 'sv', l.sv.toFixed(2), 'W', l.W, 'D', l.D, 'via', amb.citta.viaVicina(...l.ingresso));
  const Wr = c.latoReale / l.su;
  let intrusi = [];
  for (const e of dati.edifici) {
    if (e.id === l.def.edificio) continue;
    for (const [x, z] of e.p) {
      const [u, v] = l.locale(x, z);
      if (u > 0.3 && u < Wr - 0.3 && v > 0.3 && v < l.D - 0.3) { intrusi.push(e.id); break; }
    }
  }
  console.log('  edifici che entrano nel rettangolo:', intrusi);
  const orig = amb.citta.edificioPerId(l.def.edificio);
  console.log('  sagoma reale (locale):', orig.p.map(([x, z]) => l.locale(x, z).map(v => v.toFixed(1)).join(',')).join(' | '));
}
