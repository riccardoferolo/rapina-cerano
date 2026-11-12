import { chromium } from 'playwright-core';
const PROVE = [['supermercato', [6.4, 5.0, 0]], ['tabaccheria', [8.5, 2.5, 0.4]], ['supermercato', [3.65, 4.9, 0]], ['banca', [5, 3, 0]]];
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
try {
  for (const [colpo, [u, v, verso]] of PROVE) {
    const contesto = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await contesto.addInitScript(() => localStorage.setItem('rapina.grafica', 'alta'));
    const p = await contesto.newPage();
    await p.goto('http://localhost:5431/?locale');
    await p.waitForFunction(() => window.__gioco?.pronto(), null, { timeout: 120000 });
    await p.fill('#nome', 'Prova');
    await p.click('#entra-citta');
    await p.waitForFunction(() => window.__gioco.stato().vista?.giocatori?.length >= 1, null, { timeout: 30000 });
    await p.waitForTimeout(900);
    await p.evaluate(c => window.__gioco.parti(c), colpo);
    await p.waitForFunction(c => window.__gioco.stato().vista?.colpo === c, colpo, { timeout: 30000 });
    await p.evaluate(([c, u, v, verso]) => {
      const l = window.__gioco.ambiente().luoghi.get(c);
      const [x, z] = l.mondo(u, v);
      window.__gioco.vaiA(x, z, l.versoMondo(verso), -0.05);
    }, [colpo, u, v, verso]);
    await p.waitForTimeout(4000);
    const r = await p.evaluate(() => new Promise(ok => {
      const t = [];
      const cpu = [];
      let prima = performance.now();
      const f = ora => { t.push(ora - prima); prima = ora; if (t.length < 900) requestAnimationFrame(f); else ok(t); };
      requestAnimationFrame(f);
    }));
    const lenti = r.filter(x => x > 20).length / r.length;
    const st = await p.evaluate(() => ({ ...window.__gioco.mondo().statistiche(), fps: window.__gioco.stato().fps }));
    console.log(`${colpo.padEnd(13)} fotogrammi lenti ${(lenti * 100).toFixed(1)}%  fps ${st.fps}  qualita ${st.qualita} scala ${st.scala.toFixed(2)}`);
    await contesto.close();
  }
} finally { await browser.close(); }
