import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = 'http://localhost:5431/';
const FOTO = fileURLToPath(new URL('./foto/collaudo/', import.meta.url));
mkdirSync(FOTO, { recursive: true });
const ARGOMENTI = ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const LATO = { width: Number(process.env.LARGO ?? 960), height: Number(process.env.ALTO ?? 540) };

const esiti = [];
const verifica = (nome, ok, dettaglio = '') => {
  esiti.push(ok);
  console.log(`${ok ? 'OK ' : 'NO '} ${nome}${dettaglio ? ` — ${dettaglio}` : ''}`);
};
const stato = p => p.evaluate(() => window.__gioco.stato());
const partita = (host, corpo, arg) => host.evaluate(([c, a]) => new Function('p', 'a', c)(window.__gioco.partita(), a), [corpo, arg]);
async function attendi(pagina, condizione, ms = 15000, arg) {
  const fine = Date.now() + ms;
  while (Date.now() < fine) {
    if (await pagina.evaluate(condizione, arg).catch(() => false)) return true;
    await pagina.waitForTimeout(150);
  }
  return false;
}
const foto = (p, nome) => p.screenshot({ path: `${FOTO}${nome}.png` });

async function entra(pagina, nome, ruolo) {
  await pagina.goto(`${BASE}?locale`);
  await pagina.waitForFunction(() => window.__gioco?.pronto() && !document.getElementById('entra-citta').disabled, null, { timeout: 120000 });
  await pagina.evaluate(() => localStorage.removeItem('rapina.campagna'));
  await pagina.fill('#nome', nome);
  await pagina.click(`[data-ruolo="${ruolo}"]`);
  await pagina.click('#entra-citta');
}

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ARGOMENTI });
try {
  const contesto = await browser.newContext({ viewport: LATO });
  await contesto.addInitScript(() => localStorage.setItem('rapina.grafica', 'media'));
  const host = await contesto.newPage();
  const ospite = await contesto.newPage();
  const errori = [];
  for (const [nome, p] of [['host', host], ['ospite', ospite]]) {
    p.on('pageerror', e => errori.push(`${nome}: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errori.push(`${nome}: ${m.text().slice(0, 300)}`); });
  }
  await entra(host, 'Richi', 'scassinatore');
  const inCitta = await attendi(host, () => window.__gioco.stato().vista?.fase === 'mondo' && !!window.__gioco.partita(), 30000);
  verifica('si entra subito in città, senza stanze', inCitta);
  await entra(ospite, 'Seba', 'autista');
  const insieme = await attendi(host, () => window.__gioco.partita()?.giocatori.length === 2, 30000) && await attendi(ospite, () => window.__gioco.stato().vista?.giocatori.length === 2, 20000);
  verifica('Seba entra nella stessa Cerano senza lobby', insieme);
  verifica('collegamento diretto', (await stato(ospite)).modo === 'diretto', (await stato(ospite)).modo);
  await host.waitForTimeout(1500);
  await foto(host, '01-citta');

  const amb = await host.evaluate(() => window.__gioco.ambiente().rifugio);
  await host.evaluate(([x, z]) => window.__gioco.vaiA(x + 0.8, z + 0.8), amb);
  await host.waitForTimeout(400);
  const tavolo = await host.evaluate(() => window.__gioco.interazione()?.chiave);
  verifica('al tavolo della cascina c\'è la mappa dei colpi', tavolo === 'ui:colpi', tavolo);

  const idOspite = (await stato(ospite)).mioId;
  await host.evaluate(id => window.__gioco.azione({ tipo: 'chiama', a: id }), idOspite);
  const squilla = await attendi(ospite, () => !document.getElementById('chiamata').hidden, 8000);
  verifica('chiamato al telefono, a Seba squilla', squilla);
  await foto(ospite, '02-chiamata');
  await ospite.keyboard.press('KeyY');
  const dentro = await attendi(host, a => window.__gioco.partita().banda.membri.includes(a), 5000, idOspite);
  verifica('risponde (Y) ed entra nella banda', dentro);
  await ospite.evaluate(() => window.__gioco.azione({ tipo: 'pianifica', colpo: 'tabaccheria' }));
  await host.waitForTimeout(600);
  verifica('solo il capo sceglie il colpo', (await partita(host, 'return p.banda.colpo')) === null);
  await host.evaluate(() => window.__gioco.azione({ tipo: 'pianifica', colpo: 'tabaccheria' }));
  await host.waitForTimeout(300);
  await host.evaluate(() => window.__gioco.azione({ tipo: 'avvia', preparazioni: [], veicolo: 'utilitaria' }));
  const inColpo = await attendi(ospite, () => window.__gioco.stato().vista?.colpo === 'tabaccheria', 20000)
    && await attendi(host, () => window.__gioco.stato().vista?.colpo === 'tabaccheria', 20000);
  verifica('il capo dà il via e il colpo si accende nel mondo, per tutti e due', inColpo);
  await host.waitForTimeout(1500);

  const set = await host.evaluate(() => window.__gioco.set());
  const biglietto = set.biglietti[0];
  const cf = set.casseforti[0];
  await partita(host, `for (const q of p.png) { q.x = a[0]; q.z = a[1]; q.giro = [{ x: a[0], z: a[1], sosta: 999 }]; q.tappa = 0; }`, [cf.x + 300, cf.z + 300]);
  await host.evaluate(([x, z]) => window.__gioco.vaiA(x + 0.6, z + 0.6), [biglietto.x, biglietto.z]);
  await host.waitForTimeout(500);
  await host.evaluate(k => window.__gioco.azione({ tipo: 'usa', chiave: k, attivo: true }), `biglietto:${biglietto.id}`);
  await host.waitForTimeout(2200);
  verifica('il foglietto rivela la combinazione', (await partita(host, 'return p.casseforti[0].codiceNoto')) === true);
  await host.evaluate(([x, z]) => window.__gioco.vaiA(x, z), [cf.x - Math.sin(cf.yaw) * 1, cf.z - Math.cos(cf.yaw) * 1]);
  await host.waitForTimeout(500);
  await host.evaluate(k => window.__gioco.azione({ tipo: 'usa', chiave: k, attivo: true }), `codice:${cf.id}`);
  await host.waitForTimeout(3500);
  verifica('la cassaforte si apre con la combinazione', (await partita(host, 'return p.casseforti[0].stato')) === 'aperta');
  await foto(host, '03-cassaforte-aperta');

  const sacchi = await partita(host, 'return p.sacchi.filter(s => s.portatoDa === null && s.veicolo === null).map(s => ({ id: s.id, x: s.x, z: s.z }))');
  const auto = await partita(host, 'const v = p.veicoli.find(x => x.nostro); return { id: v.id, x: v.x, z: v.z, yaw: v.yaw }');
  const bagagliaio = await host.evaluate(a => [a.x + Math.sin(a.yaw) * 2.65, a.z + Math.cos(a.yaw) * 2.65], auto);
  let caricati = 0;
  for (const [i, sacco] of sacchi.entries()) {
    const pagina = i % 2 === 0 ? host : ospite;
    await pagina.evaluate(([x, z]) => window.__gioco.vaiA(x + 0.4, z), [sacco.x, sacco.z]);
    await pagina.waitForTimeout(400);
    await pagina.evaluate(k => window.__gioco.azione({ tipo: 'usa', chiave: k, attivo: true }), `sacco:${sacco.id}`);
    await pagina.waitForTimeout(500);
    await pagina.evaluate(([x, z]) => window.__gioco.vaiA(x, z), bagagliaio);
    await pagina.waitForTimeout(500);
    await pagina.evaluate(k => window.__gioco.azione({ tipo: 'usa', chiave: k, attivo: true }), `bagagliaio:${auto.id}`);
    await pagina.waitForTimeout(600);
    caricati = await partita(host, 'return p.veicoli.find(x => x.nostro).sacchi.length');
  }
  const capienza = await partita(host, 'return { utilitaria: 4, berlina: 5, furgone: 8 }[p.veicoli.find(x => x.nostro).tipo]');
  verifica('sacchi nel bagagliaio fino alla capienza (portati da tutti e due)', caricati === Math.min(capienza, sacchi.length), `${caricati}/${sacchi.length}`);
  verifica('nessun allarme finora', (await partita(host, 'return p.allarme.attivo')) === false, await partita(host, 'return p.allarme.motivo'));

  const porte = await host.evaluate(a => {
    const fx = -Math.sin(a.yaw);
    const fz = -Math.cos(a.yaw);
    const rx = Math.cos(a.yaw);
    const rz = -Math.sin(a.yaw);
    return { guida: [a.x + fx * 0.2 - rx * 1.45, a.z + fz * 0.2 - rz * 1.45], pass: [a.x + fx * 0.2 + rx * 1.45, a.z + fz * 0.2 + rz * 1.45] };
  }, auto);
  await ospite.evaluate(([x, z]) => window.__gioco.vaiA(x, z), porte.guida);
  await host.evaluate(([x, z]) => window.__gioco.vaiA(x, z), porte.pass);
  await host.waitForTimeout(500);
  await ospite.evaluate(k => window.__gioco.azione({ tipo: 'usa', chiave: k, attivo: true }), `auto:${auto.id}:0`);
  await host.evaluate(k => window.__gioco.azione({ tipo: 'usa', chiave: k, attivo: true }), `auto:${auto.id}:1`);
  const inAuto = await attendi(host, a => window.__gioco.partita().veicoli.find(v => v.nostro)?.guidatore === a, 5000, idOspite);
  verifica('Seba guida, Richi è passeggero', inAuto);
  await ospite.waitForTimeout(800);
  const prima = (await stato(ospite)).io.auto;
  await ospite.evaluate(() => window.__gioco.guidaPer(1, 0, 2.5));
  await ospite.waitForTimeout(2800);
  const dopo = (await stato(ospite)).io.auto;
  const spostata = dopo && prima ? Math.hypot(dopo.x - prima.x, dopo.z - prima.z) : 0;
  verifica("l'auto si muove guidata dall'ospite", spostata > 5, `${spostata.toFixed(1)} m`);

  const percorso = await host.evaluate(([a, r]) => window.__gioco.ambiente().citta.grafo.percorso({ x: a.x, z: a.z }, { x: r[0], z: r[1] }), [dopo, amb]);
  for (const [i, p] of percorso.entries()) {
    await ospite.evaluate(([x, z, x2, z2]) => {
      const a = window.__gioco.auto();
      if (!a) return;
      Object.assign(a, { x, z, yaw: Math.atan2(-(x2 - x), -(z2 - z)), vx: 0, vz: 0 });
    }, [p.x, p.z, percorso[Math.min(i + 1, percorso.length - 1)].x, percorso[Math.min(i + 1, percorso.length - 1)].z]);
    await ospite.waitForTimeout(60);
  }
  await ospite.evaluate(([x, z]) => Object.assign(window.__gioco.auto(), { x, z }), amb);
  const fine = await attendi(host, () => window.__gioco.stato().vista?.esito?.vinto === true, 10000);
  verifica('colpo riuscito alla cascina', fine, JSON.stringify(await partita(host, 'return p.esito && { totale: p.esito.totale, sacchi: p.esito.sacchi }')));
  const esitoOspite = await attendi(ospite, () => window.__gioco.stato().pannello === 'esito', 5000);
  verifica("anche l'ospite vede l'esito", esitoOspite);
  await foto(ospite, '04-esito');
  await host.waitForTimeout(800);
  const soldiHost = await host.evaluate(() => window.__gioco.stato().riassunto.giocatori.Richi?.soldi);
  const soldiOspite = await ospite.evaluate(() => window.__gioco.stato().riassunto.giocatori.Seba?.soldi);
  verifica('ognuno incassa la sua parte sul suo computer', soldiHost > 2500 && soldiOspite > 2500, `Richi ${soldiHost}, Seba ${soldiOspite}`);
  const libera = await attendi(host, () => window.__gioco.stato().vista?.fase === 'mondo', 15000) && await attendi(ospite, () => window.__gioco.stato().vista?.fase === 'mondo', 8000);
  verifica('dopo il colpo la città torna libera', libera);
  const sbloccato = await host.evaluate(() => window.__gioco.stato().riassunto.colpi.supermercato.sbloccato);
  verifica('il supermercato si sblocca', sbloccato);

  await host.close();
  const passa = await attendi(ospite, () => !!window.__gioco.partita(), 25000);
  verifica('se chi ospita se ne va, la città passa all\'altro', passa);
  await ospite.waitForTimeout(1500);
  verifica('e si continua a giocare', (await stato(ospite)).vista?.giocatori.length === 1, `${(await stato(ospite)).vista?.giocatori.length} in città`);
  await foto(ospite, '05-nuovo-host');
  for (const e of [...new Set(errori)].slice(0, 12)) console.log('   errore:', e);
  verifica('nessun errore in pagina', errori.length === 0, `${errori.length}`);
} finally {
  await browser.close();
}
const ok = esiti.filter(Boolean).length;
console.log(`\n${ok}/${esiti.length} verifiche superate`);
process.exitCode = ok === esiti.length ? 0 : 1;
