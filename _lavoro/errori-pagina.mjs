import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
try {
  const pagina = await browser.newPage();
  pagina.on('pageerror', e => console.log('ERRORE', e.message, e.stack?.split('\n').slice(0, 4).join(' | ')));
  pagina.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(m.type(), m.text().slice(0, 300)); });
  await pagina.goto(process.argv[2] ?? 'http://localhost:5431/?locale');
  await pagina.waitForTimeout(Number(process.argv[3] ?? 15000));
  console.log('pronto:', await pagina.evaluate(() => window.__gioco?.pronto?.() ?? 'nessun __gioco'));
} finally {
  await browser.close();
}
