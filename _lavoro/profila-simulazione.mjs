import { readFileSync } from 'node:fs';
import { Session } from 'node:inspector/promises';
import { creaAmbiente } from '../src/gioco/ambiente.js';
import { creaMondoAperto, aggiungiGiocatore, passo } from '../src/gioco/partita.js';
import { R } from '../src/gioco/regole.js';

const dati = JSON.parse(readFileSync(new URL('../public/cerano/cerano.json', import.meta.url), 'utf8'));
const amb = creaAmbiente(dati);
const stato = creaMondoAperto({ seme: 5 });
aggiungiGiocatore(stato, { id: 'a', nome: 'Richi', posizione: { x: -18, z: 10, yaw: 0 } });
for (let i = 0; i < 1200; i++) passo(stato, R.PASSO, {}, amb);
const sessione = new Session();
sessione.connect();
await sessione.post('Profiler.enable');
await sessione.post('Profiler.start');
const t0 = performance.now();
const N = 3000;
for (let i = 0; i < N; i++) passo(stato, R.PASSO, {}, amb);
const ms = (performance.now() - t0) / N;
const { profile } = await sessione.post('Profiler.stop');
console.log(`${ms.toFixed(3)} ms per passo · passanti ${stato.png.filter(p => p.passante).length} · traffico ${stato.veicoli.filter(v => v.traffico).length}`);
const perId = new Map(profile.nodes.map(n => [n.id, n]));
const conta = new Map();
for (const id of profile.samples) {
  const n = perId.get(id);
  const k = `${n.callFrame.functionName || '(anonima)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`;
  conta.set(k, (conta.get(k) ?? 0) + 1);
}
for (const [k, v] of [...conta].sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`${((v / profile.samples.length) * 100).toFixed(1)}%  ${k}`);
