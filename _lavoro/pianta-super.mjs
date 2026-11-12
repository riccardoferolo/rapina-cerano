import { readFileSync } from 'node:fs';
import { creaAmbiente } from '../src/gioco/ambiente.js';

const dati = JSON.parse(readFileSync(new URL('../public/cerano/cerano.json', import.meta.url), 'utf8'));
const amb = creaAmbiente(dati);
const l = amb.luoghi.get(process.argv[2] ?? 'supermercato');
const poli = l.c.edificio.p;
const dentroPoli = (x, z, p) => {
  let d = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i];
    const [xj, zj] = p[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) d = !d;
  }
  return d;
};
console.log('cornice', { su: l.su.toFixed(3), sv: l.sv.toFixed(3), lato: l.c.latoReale.toFixed(2), prof: l.c.profReale.toFixed(2) });
console.log('sagoma in u,v:', poli.map(([x, z]) => l.locale(x, z).map(n => n.toFixed(1)).join(',')).join('  '));
const righe = [];
for (let v = 0.25; v < l.D; v += 0.5) {
  let r = '';
  for (let u = 0.25; u < l.W; u += 0.5) {
    const [x, z] = l.mondo(u, v);
    const s = l.zonaDi(x, z);
    r += !dentroPoli(x, z, poli) ? '#' : s ? s.id[0] : '.';
  }
  righe.push(`${v.toFixed(1).padStart(5)} ${r}`);
}
console.log(righe.join('\n'));
const vicini = dati.edifici.filter(e => e.id !== l.c.edificio.id && e.p.some(([x, z]) => Math.hypot(x - l.centro[0], z - l.centro[1]) < 30));
for (const [nome, u, v] of [['servizio', 13.4, 15.4], ['uscita', 2.6, -0.8], ['ingresso', 10.4, -0.8]]) {
  const [x, z] = l.mondo(u, v);
  const dentro = vicini.filter(e => dentroPoli(x, z, e.p)).map(e => e.id);
  console.log(nome, 'fuori dalla porta cade in', dentro.length ? dentro.join(',') : 'spazio libero');
}
