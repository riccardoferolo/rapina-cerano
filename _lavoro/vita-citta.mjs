import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
try {
  const c = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await c.addInitScript(() => localStorage.setItem('rapina.grafica', 'alta'));
  const p = await c.newPage();
  p.on('pageerror', e => console.log('ERRORE', e.message));
  await p.goto('http://localhost:5431/?locale');
  await p.waitForFunction(() => !document.getElementById('entra-citta').disabled, null, { timeout: 120000 });
  await p.fill('#nome', 'Prova');
  await p.click('#entra-citta');
  await p.waitForFunction(() => window.__gioco.stato().vista?.giocatori?.length >= 1, null, { timeout: 30000 });
  for (let i = 0; i < 4; i++) {
    await p.waitForTimeout(5000);
    console.log(await p.evaluate(() => {
      const v = window.__gioco.stato().vista;
      const st = window.__gioco.mondo().statistiche();
      const io = window.__gioco.stato().io;
      const vicini = v.png.filter(q => Math.hypot(q.x - io.x, q.z - io.z) < 60).length;
      return `fps ${window.__gioco.stato().fps} scala ${st.scala.toFixed(2)} qualita ${st.qualita} · passanti ${v.png.length} (entro 60 m ${vicini}) · auto ${v.veicoli.length} (traffico in moto ${v.veicoli.filter(x => Math.hypot(x.vx, x.vz) > 1).length})`;
    }));
  }
  await p.evaluate(() => {
    const v = window.__gioco.stato().vista;
    const io = window.__gioco.stato().io;
    const q = v.png.sort((a, b) => Math.hypot(a.x - io.x, a.z - io.z) - Math.hypot(b.x - io.x, b.z - io.z))[0];
    if (q) window.__gioco.vaiA(q.x + 6, q.z + 6, Math.atan2(6, 6), -0.05);
  });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: 'C:/Users/RiccardoF/Desktop/sito/rapinacerano/_lavoro/foto/citta/passanti.png' });
} finally { await browser.close(); }
