import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FOTO = fileURLToPath(new URL('./foto/colpo/', import.meta.url));
mkdirSync(FOTO, { recursive: true });
const QUALITA = process.argv[2] ?? 'alta';
const COLPO = process.argv[3] ?? 'tabaccheria';
const PUNTI = JSON.parse(process.argv[4] ?? 'null') ?? [
  { nome: 'negozio', u: 8.5, v: 1.2, verso: -2.6, pitch: -0.05 },
  { nome: 'bancone', u: 3, v: 1.4, verso: 0, pitch: -0.12 },
  { nome: 'retro', u: 7.4, v: 9.5, verso: Math.PI * 0.75, pitch: -0.1 },
  { nome: 'ufficio', u: 3.2, v: 7.2, verso: 2.6, pitch: -0.15 },
  { nome: 'facciata', u: 5, v: -9, verso: 0, pitch: 0.12 },
];

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
try {
  const contesto = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await contesto.addInitScript(q => localStorage.setItem('rapina.grafica', q), QUALITA);
  const pagina = await contesto.newPage();
  const errori = [];
  pagina.on('pageerror', e => errori.push(e.message));
  pagina.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errori.push(m.text().slice(0, 300)); });
  await pagina.goto('http://localhost:5431/?locale');
  await pagina.waitForFunction(() => window.__gioco?.pronto(), null, { timeout: 120000 });
  await pagina.fill('#nome', 'Foto');
  await pagina.click('#entra-citta');
  await pagina.waitForFunction(() => window.__gioco.stato().vista?.giocatori?.length >= 1, null, { timeout: 30000 });
  await pagina.waitForTimeout(900);
  await pagina.addStyleTag({ content: '#clicca, #messaggi { display: none !important; }' });
  if (COLPO !== 'citta') {
    await pagina.evaluate(c => window.__gioco.parti(c), COLPO);
    await pagina.waitForFunction(c => window.__gioco.stato().vista?.colpo === c, COLPO, { timeout: 30000 });
    await pagina.evaluate(() => {
      const p = window.__gioco.partita();
      for (const g of p.giocatori) {
        g.maschera = true;
        g.vita = g.vitaMax = 1e9;
      }
    });
    if (process.env.ALLARME) {
      await pagina.evaluate(() => {
        const p = window.__gioco.partita();
        p.allarme.attivo = true;
        p.allarme.tempo = p.tempo;
        p.polizia.prossima = p.tempo + 1;
      });
      await pagina.waitForTimeout(Number(process.env.ALLARME) * 1000);
    }
  }
  await pagina.waitForTimeout(2000);
  for (const punto of PUNTI) {
    await pagina.evaluate(({ u, v, verso, pitch, x, z, yaw }) => {
      const amb = window.__gioco.ambiente();
      const id = window.__gioco.stato().vista.colpo;
      if (x !== undefined) {
        window.__gioco.vaiA(x, z, yaw, pitch);
        return;
      }
      const l = amb.luoghi.get(id);
      const [wx, wz] = l.mondo(u, v);
      window.__gioco.vaiA(wx, wz, l.versoMondo(verso), pitch);
    }, punto);
    await pagina.waitForTimeout(Number(process.env.ASSESTA ?? 1200));
    const fps = await pagina.evaluate(async () => {
      const t0 = performance.now();
      let n = 0;
      await new Promise(fine => {
        const giro = () => {
          n += 1;
          if (performance.now() - t0 < 3000) requestAnimationFrame(giro);
          else fine();
        };
        requestAnimationFrame(giro);
      });
      return Math.round((n * 1000) / (performance.now() - t0));
    });
    await pagina.screenshot({ path: `${FOTO}${COLPO}-${punto.nome}-${QUALITA}.png` });
    const st = await pagina.evaluate(() => {
      const m = window.__gioco.mondo();
      const info = m.renderer.info;
      let pelle = 0;
      m.scena.traverse(o => { if (o.isSkinnedMesh && o.visible) pelle += 1; });
      const t0 = performance.now();
      for (let i = 0; i < 20; i++) window.__gioco.partita() && null;
      const v = window.__gioco.stato().vista;
      return { calls: info.render.calls, tri: Math.round(info.render.triangles / 1000), pelle, png: v.png.length, auto: v.veicoli.length, scala: m.scala, luci: m.scena.children.filter(o => o.isLight).length };
    });
    const cpu = await pagina.evaluate(async () => {
      const campioni = [];
      const giro = () => new Promise(r => requestAnimationFrame(t => r(t)));
      let prima = await giro();
      for (let i = 0; i < 60; i++) {
        const t = await giro();
        campioni.push(t - prima);
        prima = t;
      }
      campioni.sort((a, b) => a - b);
      return { mediana: campioni[30].toFixed(1), p90: campioni[54].toFixed(1) };
    });
    console.log(`${punto.nome}: ${fps} fps`, JSON.stringify(st), JSON.stringify(cpu));
  }
  for (const e of [...new Set(errori)].slice(0, 10)) console.log('  errore:', e);
} finally {
  await browser.close();
}
