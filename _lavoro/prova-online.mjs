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
  const host = await contesto.newPage();
  const ospite = await contesto.newPage();
  const errori = [];
  for (const [n, p] of [['host', host], ['ospite', ospite]]) {
    p.on('pageerror', e => errori.push(`${n}: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) errori.push(`${n}: ${m.text().slice(0, 200)}`); });
  }
  const t0 = Date.now();
  await host.goto(BASE);
  await host.waitForFunction(() => !document.getElementById('crea').disabled, null, { timeout: 120000 });
  console.log(`caricato in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await host.fill('#nome', 'Richi');
  await host.click('#crea');
  await host.waitForSelector('#schermata-stanza:not([hidden])');
  const codice = await host.textContent('#t-codice');
  await ospite.goto(`${BASE}?stanza=${codice}`);
  await ospite.waitForFunction(() => !document.getElementById('entra').disabled, null, { timeout: 120000 });
  await ospite.fill('#nome', 'Seba');
  await ospite.click('#entra');
  await host.waitForFunction(() => /Seba/.test(document.getElementById('t-giocatori').textContent), null, { timeout: 40000 });
  console.log('stanza', codice, '—', await host.textContent('#t-stato'));
  await host.click('#parti');
  await ospite.waitForFunction(() => document.getElementById('hud') && !document.getElementById('hud').hidden && /Rifugio/.test(document.getElementById('obiettivo').textContent), null, { timeout: 40000 });
  await host.waitForTimeout(3000);
  console.log('ospite al rifugio:', await ospite.textContent('#rete'));
  await host.screenshot({ path: `${FOTO}rifugio-host.png` });
  await ospite.screenshot({ path: `${FOTO}rifugio-ospite.png` });
  for (const e of [...new Set(errori)].slice(0, 8)) console.log('  errore:', e);
  console.log(errori.length ? 'ERRORI' : 'nessun errore');
  esito = errori.length ? 1 : 0;
} catch (e) {
  console.log('NON RIUSCITO:', e.message.split('\n')[0]);
  esito = 1;
} finally {
  await browser.close();
}
process.exitCode = esito;
