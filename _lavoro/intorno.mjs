import { readFileSync } from 'node:fs';
import { creaAmbiente } from '../src/gioco/ambiente.js';
const dati = JSON.parse(readFileSync(new URL('../public/cerano/cerano.json', import.meta.url), 'utf8'));
const amb = creaAmbiente(dati);
const l = amb.luoghi.get(process.argv[2] ?? 'supermercato');
const dentroPoli = (x, z, p) => { let d = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, zi] = p[i]; const [xj, zj] = p[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) d = !d; } return d; };
const vicini = dati.edifici.filter(e => e.p.some(([x, z]) => Math.hypot(x - l.centro[0], z - l.centro[1]) < 70));
const strade = amb.citta.grafo.segmenti;
const suStrada = (x, z) => strade.some(s => { const st = dati.strade[s.strada]; const ax = s.a.x, az = s.a.z, bx = s.b.x, bz = s.b.z; const L2 = (bx - ax) ** 2 + (bz - az) ** 2 || 1; const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / L2)); return Math.hypot(x - ax - t * (bx - ax), z - az - t * (bz - az)) < st.l / 2; });
for (let v = -14; v <= 38; v += 1.5) {
  let r = '';
  for (let u = -16; u <= 30; u += 1) {
    const [x, z] = l.mondo(u, v);
    const e = vicini.find(e => dentroPoli(x, z, e.p));
    r += e ? (e.id === l.c.edificio.id ? 'S' : e.id === 1239354600 ? 'B' : '#') : suStrada(x, z) ? '=' : '.';
  }
  console.log(String(v).padStart(5), r);
}
