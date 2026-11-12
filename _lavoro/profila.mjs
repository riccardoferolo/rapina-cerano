import { chromium } from 'playwright-core';

const QUALITA = process.argv[2] ?? 'alta';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
try {
  const contesto = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await contesto.addInitScript(q => localStorage.setItem('rapina.grafica', q), QUALITA);
  const pagina = await contesto.newPage();
  await pagina.goto('http://localhost:5431/?locale');
  await pagina.waitForFunction(() => window.__gioco?.pronto(), null, { timeout: 120000 });
  await pagina.fill('#nome', 'Prof');
  await pagina.click('#crea');
  await pagina.click('#parti');
  await pagina.waitForFunction(() => window.__gioco.stato().vista?.fase === 'rifugio', null, { timeout: 30000 });
  await pagina.evaluate(() => window.__gioco.parti('tabaccheria'));
  await pagina.waitForFunction(() => window.__gioco.stato().vista?.colpo === 'tabaccheria', null, { timeout: 30000 });
  await pagina.evaluate(() => {
    const p = window.__gioco.partita();
    for (const g of p.giocatori) { g.maschera = true; g.vita = g.vitaMax = 1e9; }
    p.allarme.attivo = true;
    p.allarme.tempo = p.tempo;
    p.polizia.prossima = p.tempo + 1;
  });
  await pagina.waitForTimeout(35000);
  await pagina.evaluate(() => {
    const l = window.__gioco.ambiente().luoghi.get('tabaccheria');
    const [x, z] = l.mondo(8.5, 2.5);
    window.__gioco.vaiA(x, z, l.versoMondo(0.4), -0.05);
  });
  await pagina.waitForTimeout(1500);
  const cdp = await contesto.newCDPSession(pagina);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  await pagina.waitForTimeout(4000);
  const { profile } = await cdp.send('Profiler.stop');
  const perId = new Map(profile.nodes.map(n => [n.id, n]));
  const totali = new Map();
  const campioni = profile.samples.length;
  for (const id of profile.samples) {
    const n = perId.get(id);
    const k = `${n.callFrame.functionName || '(anonima)'} ${n.callFrame.url.split('/').pop().split('?')[0]}:${n.callFrame.lineNumber + 1}`;
    totali.set(k, (totali.get(k) ?? 0) + 1);
  }
  const ordinati = [...totali].sort((a, b) => b[1] - a[1]).slice(0, 25);
  for (const [k, v] of ordinati) console.log(`${((v / campioni) * 100).toFixed(1)}%  ${k}`);
} finally {
  await browser.close();
}
