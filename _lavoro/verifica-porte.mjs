import { readFileSync } from 'node:fs';
import { creaAmbiente } from '../src/gioco/ambiente.js';
import { apertureMondo, apertureSuSpigolo } from '../src/gioco/luoghi.js';
const dati = JSON.parse(readFileSync(new URL('../public/cerano/cerano.json', import.meta.url), 'utf8'));
const amb = creaAmbiente(dati);
for (const [id, l] of amb.luoghi) {
  if (!l.interni) { console.log(id, '(solo esterno) via', amb.citta.viaVicina(...l.ingresso)); continue; }
  const poli = l.c.edificio.p;
  let trovate = 0;
  for (let i = 0; i < poli.length; i++) trovate += apertureSuSpigolo(l, poli[i], poli[(i + 1) % poli.length]).length;
  const totali = apertureMondo(l).length;
  console.log(id, `aperture sul guscio ${trovate}/${totali}`, 'via', amb.citta.viaVicina(...l.ingresso), 'ingresso', l.ingresso.map(v => v.toFixed(1)).join(','));
  const fuori = [];
  for (let u = 0.3; u < l.W; u += 0.5) for (let v = 0.3; v < l.D; v += 0.5) {
    const [x, z] = l.mondo(u, v);
    let d = false;
    for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) { const [xi, zi] = poli[i]; const [xj, zj] = poli[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) d = !d; }
    if (!d) fuori.push([u.toFixed(1), v.toFixed(1)]);
  }
  console.log('   punti della pianta fuori dalla sagoma:', fuori.length, fuori.slice(0, 6).map(p => p.join(',')).join(' '));
}
