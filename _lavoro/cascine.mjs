import { readFileSync } from 'node:fs';
import { baricentro, larghezzaMinima } from '../src/citta/geometria.js';
const d = JSON.parse(readFileSync(new URL('../public/cerano/cerano.json', import.meta.url), 'utf8'));
for (const via of process.argv.slice(2)) {
  const iv = d.vie.indexOf(via);
  const s = d.strade.filter(x => x.n === via);
  const pts = s.flatMap(x => x.p);
  console.log(via, iv, s.length, pts.length ? [Math.min(...pts.map(p => p[0])), Math.max(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[1]))].map(Math.round) : '');
  const ed = d.edifici.filter(e => e.v === iv).map(e => { const [x, z] = baricentro(e.p); const m = larghezzaMinima(e.p); return [e.id, e.u, Math.round(x), Math.round(z), `${m.lungo.toFixed(0)}x${m.largo.toFixed(0)}`, e.h]; });
  console.log(ed.slice(0, 14));
}
