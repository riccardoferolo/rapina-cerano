import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] ?? 'https://riccardoferolo.github.io/rapina-cerano/';
const FOTO = fileURLToPath(new URL('./foto/online/', import.meta.url));
mkdirSync(FOTO, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
let esito = 0;
try {
  const contesto = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await contesto.addInitScript(() => localStorage.setItem('rapina.grafica', 'media'));
  const errori = [];
  const entra = async nome => {
    const p = await contesto.newPage();
    p.on('pageerror', e => errori.push(`${nome}: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) errori.push(`${nome}: ${m.text().slice(0, 200)}`); });
    const t0 = Date.now();
    await p.goto(BASE);
    await p.waitForFunction(() => !document.getElementById('entra-citta').disabled, null, { timeout: 120000 });
    console.log(`${nome}: pronto in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    await p.fill('#nome', nome);
    await p.click('#entra-citta');
    return p;
  };
  const a = await entra('Richi');
  await a.waitForFunction(() => /Cerano \d/.test(document.getElementById('rete')?.textContent ?? ''), null, { timeout: 30000 });
  const b = await entra('Seba');
  await b.waitForFunction(() => /2 in città/.test(document.getElementById('rete')?.textContent ?? ''), null, { timeout: 60000 }).catch(() => {});
  await a.waitForTimeout(3000);
  const reteA = await a.textContent('#rete');
  const reteB = await b.textContent('#rete');
  console.log('Richi:', reteA);
  console.log('Seba:', reteB);
  await a.screenshot({ path: `${FOTO}citta-richi.png` });
  await b.screenshot({ path: `${FOTO}citta-seba.png` });
  for (const e of [...new Set(errori)].slice(0, 8)) console.log('  errore:', e);
  const insieme = /2 in città/.test(reteA) && /2 in città/.test(reteB);
  console.log(insieme && !errori.length ? 'TUTTO OK: stessa Cerano, senza lobby' : 'PROBLEMI');
  esito = insieme && !errori.length ? 0 : 1;
} catch (e) {
  console.log('NON RIUSCITO:', e.message.split('\n')[0]);
  esito = 1;
} finally {
  await browser.close();
}
process.exitCode = esito;
