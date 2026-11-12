import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:5431/?locale';
const FOTO = new URL('./foto/mondo/', import.meta.url);
mkdirSync(FOTO, { recursive: true });
const percorso = nome => decodeURIComponent(new URL(nome, FOTO).pathname.slice(1));
const verifiche = [];
const verifica = (ok, testo, extra = '') => {
  verifiche.push(ok);
  console.log(`${ok ? 'OK ' : 'NO '} ${testo}${extra ? ` — ${extra}` : ''}`);
};

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
try {
  const contesto = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await contesto.addInitScript(() => localStorage.setItem('rapina.grafica', 'media'));
  const errori = [];
  const apri = async nome => {
    const p = await contesto.newPage();
    p.on('pageerror', e => errori.push(`${nome}: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) errori.push(`${nome}: ${m.text().slice(0, 200)}`); });
    await p.goto(BASE);
    await p.waitForFunction(() => !document.getElementById('entra-citta').disabled, null, { timeout: 120000 });
    return p;
  };
  const a = await apri('Richi');
  await a.waitForTimeout(1500);
  await a.screenshot({ path: percorso('titolo.png') });
  await a.fill('#nome', 'Richi');
  await a.click('#entra-citta');
  await a.waitForFunction(() => window.__gioco.stato().vista?.giocatori?.length >= 1, null, { timeout: 30000 });
  const statoA = await a.evaluate(() => ({ fase: window.__gioco.stato().vista.fase, host: !!window.__gioco.partita() }));
  verifica(statoA.fase === 'mondo' && statoA.host, 'il primo che entra ospita una Cerano senza colpo', JSON.stringify(statoA));
  const b = await apri('Seba');
  await b.fill('#nome', 'Seba');
  await b.click('.segnaletica[data-ruolo="autista"]');
  await b.click('#entra-citta');
  await b.waitForFunction(() => window.__gioco.stato().vista?.giocatori?.length >= 2, null, { timeout: 40000 }).catch(() => {});
  const nB = await b.evaluate(() => window.__gioco.stato().vista?.giocatori?.length ?? 0);
  verifica(nB === 2, 'il secondo entra senza lobby e vede l\'altro', `${nB} giocatori`);
  await a.waitForTimeout(3000);
  await a.screenshot({ path: percorso('citta-host.png') });
  await b.screenshot({ path: percorso('citta-ospite.png') });
  const idB = await b.evaluate(() => window.__gioco.stato().mioId);
  await a.evaluate(id => window.__gioco.azione({ tipo: 'chiama', a: id }), idB);
  await b.waitForFunction(() => !document.getElementById('chiamata').hidden, null, { timeout: 8000 }).catch(() => {});
  verifica(await b.evaluate(() => !document.getElementById('chiamata').hidden), 'al secondo squilla il telefono');
  await b.screenshot({ path: percorso('chiamata.png') });
  await b.keyboard.press('KeyY');
  await a.waitForTimeout(800);
  const banda = await a.evaluate(() => window.__gioco.partita().banda);
  verifica(banda.membri.length === 2, 'rispondendo entra nella banda', JSON.stringify(banda));
  await a.evaluate(() => window.__gioco.azione({ tipo: 'pianifica', colpo: 'tabaccheria' }));
  await a.waitForTimeout(300);
  await a.evaluate(() => window.__gioco.azione({ tipo: 'avvia', preparazioni: [], veicolo: 'utilitaria' }));
  await b.waitForFunction(() => window.__gioco.stato().vista?.colpo === 'tabaccheria', null, { timeout: 8000 }).catch(() => {});
  verifica(await b.evaluate(() => window.__gioco.stato().vista?.colpo === 'tabaccheria'), 'il capo dà il via e il colpo si accende nel mondo per tutti');
  await a.keyboard.press('KeyP');
  await a.waitForTimeout(500);
  await a.screenshot({ path: percorso('telefono.png') });
  verifica(errori.length === 0, 'nessun errore in pagina', errori.slice(0, 4).join(' | '));
} finally {
  await browser.close();
}
console.log(`${verifiche.filter(Boolean).length}/${verifiche.length} verifiche superate`);
