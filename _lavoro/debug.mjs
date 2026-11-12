import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
try {
  const pagina = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  pagina.on('pageerror', e => console.log('ERR', e.message, e.stack?.split('\n').slice(0,4).join(' | ')));
  pagina.on('console', m => console.log(m.type(), m.text().slice(0, 400)));
  await pagina.goto(process.argv[2] ?? 'http://localhost:5431/');
  await pagina.waitForTimeout(Number(process.argv[3] ?? 25000));
  console.log('pronto:', await pagina.evaluate(() => !!window.__gioco));
} finally { await browser.close(); }
