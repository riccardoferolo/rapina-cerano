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
  await host.goto(`${BASE}?locale`);
  await host.waitForFunction(() => window.__gioco?.pronto(), null, { timeout: 120000 });
  await host.evaluate(() => localStorage.removeItem('rapina.campagna'));
  await host.fill('#nome', 'Richi');
  await host.click('[data-ruolo="scassinatore"]');
  await host.click('#crea');
  await host.waitForSelector('#schermata-stanza:not([hidden])');
  const codice = await host.textContent('#t-codice');
  verifica('stanza creata', /^[A-Z]{4}$/.test(codice), codice);

  await ospite.goto(`${BASE}?locale&stanza=${codice}`);
  await ospite.waitForFunction(() => window.__gioco?.pronto(), null, { timeout: 120000 });
  await ospite.fill('#nome', 'Seba');
  await ospite.click('[data-ruolo="autista"]');
  await ospite.click('#entra');
  const insieme = await attendi(host, () => /Seba/.test(document.getElementById('t-giocatori').textContent), 25000);
  verifica("l'host vede Seba nella stanza", insieme, await host.textContent('#t-giocatori'));
  verifica('collegamento diretto', (await stato(host)).modo === 'diretto', (await stato(host)).modo);

  await host.click('#parti');
  const rifugio = await attendi(ospite, () => window.__gioco.stato().vista?.fase === 'rifugio', 20000);
  verifica('si parte dal rifugio, in due', rifugio && (await partita(host, 'return p.giocatori.length')) === 2);
  await host.waitForTimeout(2500);
  await foto(host, '01-rifugio');
  const amb = await host.evaluate(() => window.__gioco.ambiente().rifugio);
  await host.evaluate(([x, z]) => window.__gioco.vaiA(x + 0.8, z + 0.8), amb);
  await host.waitForTimeout(400);
  const tavolo = await host.evaluate(() => window.__gioco.interazione()?.chiave);
  verifica('al tavolo si apre la mappa', tavolo === 'ui:mappa', tavolo);

  await ospite.evaluate(() => window.__gioco.azione({ tipo: 'scegli', colpo: 'tabaccheria' }));
  const inColpo = await attendi(ospite, () => window.__gioco.stato().vista?.colpo === 'tabaccheria', 20000)
    && await attendi(host, () => window.__gioco.stato().vista?.colpo === 'tabaccheria', 20000);
  verifica("l'amico sceglie il colpo e tutti e due ci entrano", inColpo);
  await host.waitForTimeout(3000);
  await foto(host, '02-arrivo-host');
  await foto(ospite, '02-arrivo-ospite');

  const set = await host.evaluate(() => window.__gioco.set());
  const idOspite = (await stato(ospite)).mioId;
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
  await host.evaluate(([x, z]) => window.__gioco.guarda(Math.atan2(-(x - window.__gioco.stato().io.x), -(z - window.__gioco.stato().io.z)), -0.3), [cf.x, cf.z]);
  await host.evaluate(k => window.__gioco.azione({ tipo: 'usa', chiave: k, attivo: true }), `codice:${cf.id}`);
  await host.waitForTimeout(3500);
  verifica('la cassaforte si apre con la combinazione', (await partita(host, 'return p.casseforti[0].stato')) === 'aperta');
  await foto(host, '03-cassaforte-aperta');

  const sacchi = await partita(host, 'return p.sacchi.filter(s => s.portatoDa === null && s.veicolo === null).map(s => ({ id: s.id, x: s.x, z: s.z }))');
  const auto = await partita(host, 'const v = p.veicoli.find(x => x.nostro); return { id: v.id, x: v.x, z: v.z, yaw: v.yaw }');
  const bagagliaio = await host.evaluate(a => {
    const fx = -Math.sin(a.yaw);
    const fz = -Math.cos(a.yaw);
    return [a.x - fx * 2.65, a.z - fz * 2.65];
  }, auto);
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
    const sit = await partita(host, 'const k = p.sacchi.find(x => x.id === a); return { portatoDa: k.portatoDa, veicolo: k.veicolo, x: k.x, z: k.z, tipo: k.tipo }', sacco.id);
    if (!sit.veicolo) console.log('   sacco non caricato', i % 2 ? 'ospite' : 'host', JSON.stringify(sit), JSON.stringify(await (i % 2 ? ospite : host).evaluate(() => window.__gioco.stato().io)).slice(0, 120));
  }
  const capienza = await partita(host, 'return { utilitaria: 4, berlina: 5, furgone: 8 }[p.veicoli.find(x => x.nostro).tipo]');
  verifica('sacchi nel bagagliaio fino alla capienza (portati da tutti e due)', caricati === Math.min(capienza, sacchi.length), `${caricati}/${sacchi.length}, capienza ${capienza}`);
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
  const inAuto = await attendi(host, a => window.__gioco.partita().veicoli.find(v => v.nostro).guidatore === a, 5000, idOspite);
  verifica('Seba guida, Richi è passeggero', inAuto && (await partita(host, 'return p.giocatori.find(g => g.nome === "Richi").inAuto !== null')));
  await ospite.waitForTimeout(800);
  const prima = (await stato(ospite)).io.auto;
  await ospite.evaluate(() => window.__gioco.guidaPer(1, 0, 2.5));
  await ospite.waitForTimeout(2800);
  const dopo = (await stato(ospite)).io.auto;
  const spostata = dopo && prima ? Math.hypot(dopo.x - prima.x, dopo.z - prima.z) : 0;
  verifica("l'auto si muove guidata dall'ospite", spostata > 5, `${spostata.toFixed(1)} m`);
  await host.waitForTimeout(2500);
  const ora = (await stato(ospite)).io.auto;
  const sulHost = await partita(host, 'const v = p.veicoli.find(x => x.nostro); return [v.x, v.z]');
  verifica("l'host vede l'auto dove la guida l'ospite", Math.hypot(sulHost[0] - ora.x, sulHost[1] - ora.z) < 3, `${Math.hypot(sulHost[0] - ora.x, sulHost[1] - ora.z).toFixed(2)} m`);
  await foto(ospite, '04-guida-ospite');
  await foto(host, '04-passeggero-host');

  const percorso = await host.evaluate(([a, r]) => window.__gioco.ambiente().citta.grafo.percorso({ x: a.x, z: a.z }, { x: r[0], z: r[1] }), [dopo, amb]);
  for (const [i, p] of percorso.entries()) {
    await ospite.evaluate(([x, z, x2, z2]) => {
      const a = window.__gioco.auto();
      if (!a) return;
      a.x = x;
      a.z = z;
      a.yaw = Math.atan2(-(x2 - x), -(z2 - z));
      a.vx = 0;
      a.vz = 0;
    }, [p.x, p.z, percorso[Math.min(i + 1, percorso.length - 1)].x, percorso[Math.min(i + 1, percorso.length - 1)].z]);
    await ospite.waitForTimeout(60);
    if (i === Math.floor(percorso.length / 2)) await foto(host, '05-in-viaggio');
  }
  await ospite.evaluate(([x, z]) => {
    const a = window.__gioco.auto();
    a.x = x;
    a.z = z;
  }, amb);
  const fine = await attendi(host, () => window.__gioco.stato().vista?.esito?.vinto === true, 10000);
  verifica('colpo riuscito al rifugio', fine, JSON.stringify(await partita(host, 'return p.esito')));
  const esitoOspite = await attendi(ospite, () => window.__gioco.stato().pannello === 'esito', 5000);
  verifica("anche l'ospite vede l'esito", esitoOspite);
  await foto(ospite, '06-esito');
  const soldi = await host.evaluate(() => window.__gioco.stato().riassunto.giocatori);
  verifica('il bottino è spartito fra i due', soldi.Richi?.soldi > 2500 && soldi.Seba?.soldi > 2500, JSON.stringify(soldi));

  await ospite.click('#torna');
  const ritorno = await attendi(host, () => window.__gioco.stato().vista?.fase === 'rifugio', 15000)
    && await attendi(ospite, () => window.__gioco.stato().vista?.fase === 'rifugio', 15000);
  verifica("l'amico riporta tutti al rifugio", ritorno);
  await host.evaluate(() => window.__gioco.partiSenzaAvviso('tabaccheria'));
  const segue = await attendi(ospite, () => window.__gioco.stato().vista?.colpo === 'tabaccheria' && window.__gioco.stato().vista?.giocatori.length === 2, 15000);
  verifica("se l'avviso di partenza si perde, l'amico segue lo stesso", segue);
  const sbloccato = await host.evaluate(() => window.__gioco.stato().riassunto.colpi);
  verifica('il colpo successivo è sbloccato', Object.values(sbloccato).filter(c => c.sbloccato).length >= Math.min(2, Object.keys(sbloccato).length), JSON.stringify(Object.fromEntries(Object.entries(sbloccato).map(([k, v]) => [k, v.sbloccato]))));
  for (const e of [...new Set(errori)].slice(0, 12)) console.log('   errore:', e);
  verifica('nessun errore in pagina', errori.length === 0, `${errori.length}`);
} finally {
  await browser.close();
}
const ok = esiti.filter(Boolean).length;
console.log(`\n${ok}/${esiti.length} verifiche superate`);
process.exitCode = ok === esiti.length ? 0 : 1;
