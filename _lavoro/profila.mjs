import { chromium } from 'playwright-core';

const QUALITA = process.argv[2] ?? 'alta';
const COLPO = process.argv[3] ?? 'tabaccheria';
const [PU, PV, PVERSO] = (process.argv[4] ?? '8.5,2.5,0.4').split(',').map(Number);
const ALLARME = process.env.ALLARME !== '0';
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
  await pagina.evaluate(c => window.__gioco.parti(c), COLPO);
  await pagina.waitForFunction(c => window.__gioco.stato().vista?.colpo === c, COLPO, { timeout: 30000 });
  await pagina.evaluate(allarme => {
    const p = window.__gioco.partita();
    for (const g of p.giocatori) { g.maschera = allarme; g.vita = g.vitaMax = 1e9; }
    if (!allarme) return;
    p.allarme.attivo = true;
    p.allarme.tempo = p.tempo;
    p.polizia.prossima = p.tempo + 1;
  }, ALLARME);
  await pagina.waitForTimeout(ALLARME ? 35000 : 4000);
  await pagina.evaluate(([c, u, v, verso]) => {
    const l = window.__gioco.ambiente().luoghi.get(c);
    const [x, z] = l.mondo(u, v);
    window.__gioco.vaiA(x, z, l.versoMondo(verso), -0.05);
  }, [COLPO, PU, PV, PVERSO]);
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
  const figli = new Map(profile.nodes.map(n => [n.id, n.children ?? []]));
  const proprio = new Map();
  for (const id of profile.samples) proprio.set(id, (proprio.get(id) ?? 0) + 1);
  const inclusivo = new Map();
  const visita = id => {
    if (inclusivo.has(id)) return inclusivo.get(id);
    let t = proprio.get(id) ?? 0;
    for (const c of figli.get(id)) t += visita(c);
    inclusivo.set(id, t);
    return t;
  };
  for (const n of profile.nodes) visita(n.id);
  const perNome = new Map();
  for (const n of profile.nodes) {
    const file = n.callFrame.url.split('/').pop().split('?')[0];
    if (!file || file.startsWith('chunk-')) continue;
    const k = `${n.callFrame.functionName || '(anonima)'} ${file}:${n.callFrame.lineNumber + 1}`;
    perNome.set(k, Math.max(perNome.get(k) ?? 0, inclusivo.get(n.id)));
  }
  console.log('--- inclusivo (nostro codice)');
  for (const [k, v] of [...perNome].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`${((v / campioni) * 100).toFixed(1)}%  ${k}`);
  const perFile = new Map();
  for (const [k, v] of totali) {
    const f = k.split(' ').pop().split(':')[0] || '(nativo)';
    perFile.set(f, (perFile.get(f) ?? 0) + v);
  }
  console.log('--- per file');
  for (const [f, v] of [...perFile].sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`${((v / campioni) * 100).toFixed(1)}%  ${f}`);
  console.log('--- per funzione');
  const ordinati = [...totali].sort((a, b) => b[1] - a[1]).slice(0, 25);
  for (const [k, v] of ordinati) console.log(`${((v / campioni) * 100).toFixed(1)}%  ${k}`);
} finally {
  await browser.close();
}
