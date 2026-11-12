import { readFileSync } from 'node:fs';
import { areaFirmata, baricentro, larghezzaMinima } from '../src/citta/geometria.js';
const d = JSON.parse(readFileSync(new URL('../public/cerano/cerano.json', import.meta.url), 'utf8'));
const vie = process.argv.slice(2);
for (const via of vie) {
  const iv = d.vie.indexOf(via);
  const c = d.edifici.filter(e => e.v === iv).map(e => {
    const { lungo, largo, angolo } = larghezzaMinima(e.p);
    const [x, z] = baricentro(e.p);
    return { id: e.id, u: e.u, h: e.h, x: Math.round(x), z: Math.round(z), lungo: lungo.toFixed(1), largo: largo.toFixed(1), rett: (areaFirmata(e.p) / (lungo * largo)).toFixed(2), n: e.p.length, ang: (angolo * 180 / Math.PI).toFixed(0) };
  }).filter(e => +e.rett > 0.8 && +e.largo >= 7 && +e.lungo <= 24);
  console.log(`== ${via}: ${c.length}`);
  for (const e of c.slice(0, 40)) console.log(JSON.stringify(e));
}
