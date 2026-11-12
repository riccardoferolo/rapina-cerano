import { readFileSync } from 'node:fs';
import { baricentro, larghezzaMinima, areaFirmata } from '../src/citta/geometria.js';
const d = JSON.parse(readFileSync(new URL('../public/cerano/cerano.json', import.meta.url), 'utf8'));
for (const id of process.argv.slice(2).map(Number)) {
  const e = d.edifici.find(x => x.id === id);
  const [x, z] = baricentro(e.p);
  const m = larghezzaMinima(e.p);
  console.log(id, e.u, e.h, Math.round(x), Math.round(z), `${m.lungo.toFixed(1)}x${m.largo.toFixed(1)}`, 'rett', (areaFirmata(e.p) / (m.lungo * m.largo)).toFixed(2), 'via', d.vie[e.v], 'n', e.n ?? '');
}
