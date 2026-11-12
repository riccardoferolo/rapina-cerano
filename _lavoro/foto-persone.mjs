import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const NOMI = process.argv[2] ?? 'banda';
const ANIM = (process.argv[3] ?? 'idle_normal,walk_normal').split(',');
mkdirSync(new URL('./foto/persone/', import.meta.url), { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
try {
  for (const a of ANIM) {
    const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    p.on('pageerror', e => console.log('ERRORE', e.message));
    await p.goto(`http://localhost:5431/_lavoro/anteprima-persone.html?n=${NOMI}&a=${a}`);
    await p.waitForFunction(() => window.__pronto, null, { timeout: 60000 });
    await p.waitForTimeout(700);
    console.log(a, JSON.stringify(await p.evaluate(() => window.__info.map(i => [i.nome, i.clip, i.durata?.toFixed(2)]))));
    await p.screenshot({ path: new URL(`./foto/persone/${NOMI.replace(/,/g, '_')}-${a}.png`, import.meta.url).pathname.slice(1) });
    await p.close();
  }
} finally { await browser.close(); }
