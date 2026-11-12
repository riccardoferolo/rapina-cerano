import { chromium } from 'playwright-core';
const COLPO = process.argv[2] ?? 'supermercato';
const [U, V, VERSO] = (process.argv[3] ?? '6.4,5.0,0').split(',').map(Number);
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
try {
  const contesto = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await contesto.addInitScript(() => {
    localStorage.setItem('rapina.grafica', 'alta');
    const originale = window.requestAnimationFrame.bind(window);
    window.__tempiRaf = [];
    window.requestAnimationFrame = cb => originale(t => {
      const a = performance.now();
      cb(t);
      window.__tempiRaf.push(performance.now() - a);
      if (window.__tempiRaf.length > 2000) window.__tempiRaf.shift();
    });
  });
  const p = await contesto.newPage();
  await p.goto('http://localhost:5431/?locale');
  await p.waitForFunction(() => window.__gioco?.pronto(), null, { timeout: 120000 });
  await p.fill('#nome', 'Prova');
  await p.click('#entra-citta');
  await p.waitForFunction(() => window.__gioco.stato().vista?.giocatori?.length >= 1, null, { timeout: 30000 });
  await p.waitForTimeout(900);
  await p.evaluate(c => window.__gioco.parti(c), COLPO);
  await p.waitForFunction(c => window.__gioco.stato().vista?.colpo === c, COLPO, { timeout: 30000 });
  await p.evaluate(([c, u, v, verso]) => {
    const l = window.__gioco.ambiente().luoghi.get(c);
    const [x, z] = l.mondo(u, v);
    window.__gioco.vaiA(x, z, l.versoMondo(verso), -0.05);
    const r = window.__gioco.mondo().renderer;
    const orig = r.render.bind(r);
    window.__tempiRender = [];
    window.__chiamate = [];
    r.render = (s, cam) => { const a = performance.now(); orig(s, cam); window.__tempiRender.push(performance.now() - a); window.__chiamate.push([s.children.length, r.info.render.calls, r.info.render.triangles]); if (window.__chiamate.length > 50) window.__chiamate.shift(); };
  }, [COLPO, U, V, VERSO]);
  await p.waitForTimeout(6000);
  const r = await p.evaluate(() => {
    const q = (arr, k) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length * k)]?.toFixed(2); };
    const raf = window.__tempiRaf.slice(-300);
    const ren = window.__tempiRender.slice(-600);
    const info = window.__gioco.mondo().renderer.info;
    return `rAF cpu mediana ${q(raf, 0.5)} ms p90 ${q(raf, 0.9)} | render (tutte le chiamate) mediana ${q(ren, 0.5)} p90 ${q(ren, 0.9)} | draw ${info.render.calls} tri ${info.render.triangles} prog ${info.programs.length} geo ${info.memory.geometries} tex ${info.memory.textures}
  per render: ${JSON.stringify(window.__chiamate.slice(-6))}
  oggetti in scena: ${(() => { let n = 0, m = 0, sk = 0; window.__gioco.mondo().scena.traverse(o => { n++; if (o.isMesh) m++; if (o.isSkinnedMesh) sk++; }); return n + ' oggetti, ' + m + ' mesh, ' + sk + ' skinned'; })()}`;
  });
  console.log(COLPO, r);
} finally { await browser.close(); }
