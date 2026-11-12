import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FOTO = fileURLToPath(new URL('./foto/citta/', import.meta.url));
mkdirSync(FOTO, { recursive: true });
const QUALITA = process.argv[2] ?? 'alta';
const ORA = process.argv[3] ?? 'tramonto';
const SOLO = process.argv[4]?.split(',');
const MISURA_MS = 5000;
const PUNTI = [
  { nome: 'piazza', x: -40, y: 1.7, z: 8, yaw: -1.45, pitch: 0.02 },
  { nome: 'via', x: -150, y: 1.7, z: -60, yaw: 2.2, pitch: 0 },
  { nome: 'centro-alto', x: -260, y: 60, z: 260, yaw: -2.4, pitch: -0.32 },
  { nome: 'periferia', x: 420, y: 1.7, z: 380, yaw: 0.6, pitch: 0 },
  { nome: 'campi', x: 900, y: 1.7, z: -500, yaw: 2.4, pitch: 0.02 },
];

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
try {
  const contesto = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await contesto.addInitScript(q => localStorage.setItem('rapina.grafica', q), QUALITA);
  const pagina = await contesto.newPage();
  const errori = [];
  pagina.on('pageerror', e => errori.push(e.message));
  pagina.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errori.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  const inizio = Date.now();
  await pagina.goto('http://localhost:5431/?locale');
  await pagina.waitForFunction(() => window.__gioco?.pronto(), null, { timeout: 120000 });
  console.log(`caricata in ${((Date.now() - inizio) / 1000).toFixed(1)} s`);
  await pagina.fill('#nome', 'Foto');
  await pagina.click('#crea');
  await pagina.click('#parti');
  await pagina.waitForFunction(() => window.__gioco.stato().vista?.fase === 'rifugio', null, { timeout: 30000 });
  await pagina.addStyleTag({ content: '#hud { display: none !important; }' });
  await pagina.evaluate(o => window.__gioco.mondo().impostaOra(o), ORA);
  for (const p of PUNTI) {
    if (SOLO && !SOLO.includes(p.nome)) continue;
    await pagina.evaluate(v => {
      window.__gioco.vaiA(v.x, v.z, v.yaw, v.pitch);
      const m = window.__gioco.mondo();
      const vecchio = m.disegna;
      if (!m._alto) {
        m._alto = true;
        m.disegna = (posa, dt, dopo) => vecchio({ ...posa, y: window.__altezza ?? posa.y }, dt, dopo);
      }
      window.__altezza = v.y > 3 ? v.y : undefined;
    }, p);
    await pagina.waitForTimeout(1500);
    const fps = await pagina.evaluate(async ms => {
      const t0 = performance.now();
      let n = 0;
      let peggiore = 0;
      let ultimo = t0;
      await new Promise(fine => {
        const giro = ora => {
          n += 1;
          peggiore = Math.max(peggiore, ora - ultimo);
          ultimo = ora;
          if (ora - t0 < ms) requestAnimationFrame(giro);
          else fine();
        };
        requestAnimationFrame(giro);
      });
      return { media: Math.round((n * 1000) / (performance.now() - t0)), peggiore: Math.round(peggiore) };
    }, MISURA_MS);
    const st = await pagina.evaluate(() => ({ ...window.__gioco.mondo().statistiche() }));
    await pagina.screenshot({ path: `${FOTO}${p.nome}-${ORA}-${QUALITA}.png` });
    console.log(`${p.nome}: ${fps.media} fps (peggiore ${fps.peggiore} ms), ${st.calls} disegni, ${Math.round(st.triangles / 1000)}k triangoli, scala ${st.scala}`);
  }
  for (const e of [...new Set(errori)].slice(0, 12)) console.log('  ', e);
} finally {
  await browser.close();
}
