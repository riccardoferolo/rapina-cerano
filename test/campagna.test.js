import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creaAmbiente } from '../src/gioco/ambiente.js';
import { creaPartita, passo } from '../src/gioco/partita.js';
import { R, VEICOLI } from '../src/gioco/regole.js';
import { COLPI, PREPARAZIONI } from '../src/gioco/colpi/indice.js';
import { puntiVeicolo } from '../src/gioco/veicoli.js';
import * as camp from '../src/gioco/campagna.js';
import { faiIstantanea } from '../src/gioco/istantanea.js';
import { valida } from '../src/rete/protocollo.js';

const dati = JSON.parse(readFileSync(new URL('../public/cerano/cerano.json', import.meta.url), 'utf8'));
const amb = creaAmbiente(dati);
const SQUADRA = [{ id: 'a', nome: 'Richi', ruolo: 'scassinatore' }, { id: 'b', nome: 'Seba', ruolo: 'autista' }];

function avanza(stato, secondi, ingressi = {}) {
  const eventi = [];
  const n = Math.max(1, Math.round(secondi / R.PASSO));
  for (let i = 0; i < n; i++) eventi.push(...passo(stato, R.PASSO, i === 0 ? ingressi : { posizioni: ingressi.posizioni }, amb));
  return eventi;
}
function metti(stato, id, x, z, extra = {}) {
  const g = stato.giocatori.find(q => q.id === id);
  g.teletrasporto += 1;
  return { [id]: { x, z, yaw: extra.yaw ?? g.yaw, pitch: 0, tp: g.teletrasporto, ...extra } };
}
const usa = (da, chiave) => ({ da, tipo: 'usa', chiave, attivo: true });

test('ogni colpo e ogni preparazione si allestiscono su strade vere e producono istantanee valide', () => {
  for (const id of [...COLPI.map(c => c.id), ...Object.keys(PREPARAZIONI).map(p => `prep:${p}`)]) {
    for (const seme of [1, 2, 3]) {
      const s = creaPartita({ seme, colpo: id, giocatori: SQUADRA, ambiente: amb });
      avanza(s, 0.5, {});
      assert.ok(valida(JSON.parse(JSON.stringify({ t: 'st', g: seme, ist: faiIstantanea(s) }))), `istantanea rifiutata per ${id}`);
      assert.ok(s.veicoli.some(v => v.nostro), `${id}: manca l'auto`);
    }
  }
});

test('le vie dei colpi sono quelle del design', () => {
  const vie = Object.fromEntries(COLPI.map(c => [c.id, amb.citta.viaVicina(...amb.luogoDi(c.id).ingresso)]));
  assert.equal(vie.tabaccheria, 'Via Roma');
  assert.equal(vie.furgone, 'Via Novara');
  assert.equal(vie.oreficeria, 'Via Giuseppe Mazzini');
  assert.equal(vie.banca, 'Via Giacomo Matteotti');
  assert.ok(['Piazza Crespi', 'Via Vittime della Mafia'].includes(vie.municipio), vie.municipio);
});

test('furgone: stesa una guardia si hanno le chiavi del portellone; se aspetti troppo il blindato riparte', () => {
  const s = creaPartita({ seme: 5, colpo: 'furgone', giocatori: SQUADRA, ambiente: amb });
  const carico = s.casseforti[0];
  assert.equal(carico.suVeicolo, true);
  const guardia = s.png.find(p => p.tipo === 'vigilante');
  guardia.stato = 'legato';
  avanza(s, 0.2, {});
  assert.equal(carico.codiceNoto, true);
  avanza(s, 0.1, { posizioni: metti(s, 'a', carico.x, carico.z) });
  avanza(s, 0.1, { azioni: [usa('a', `codice:${carico.id}`)] });
  avanza(s, 3, {});
  assert.equal(carico.stato, 'aperta');
  assert.equal(s.sacchi.filter(k => k.tipo === 'contanti').length, 4);
  const tardi = creaPartita({ seme: 6, colpo: 'furgone', giocatori: SQUADRA, ambiente: amb });
  for (const p of tardi.png) p.giro = [{ x: p.x, z: p.z, sosta: 999 }];
  tardi.tempo = tardi.scadenza - 0.1;
  avanza(tardi, 1, {});
  assert.equal(tardi.casseforti[0].stato, 'persa');
  assert.equal(tardi.veicoli.find(v => v.blindato).compito, 'parte');
});

test('banca: la tessera del direttore apre il caveau, le preparazioni passano al colpo', () => {
  const s = creaPartita({ seme: 3, colpo: 'banca', giocatori: SQUADRA, ambiente: amb, campagna: { preparazioni: ['tessera', 'linea'] } });
  assert.equal(s.tessera, true);
  assert.equal(s.allarme.lineaTagliata, true);
  const senza = creaPartita({ seme: 3, colpo: 'banca', giocatori: SQUADRA, ambiente: amb });
  assert.equal(senza.tessera, false);
  const direttore = senza.png.find(p => p.tessera);
  assert.ok(direttore, 'manca il direttore');
  direttore.stato = 'legato';
  avanza(senza, 0.2, {});
  assert.equal(senza.tessera, true);
});

test('preparazione tessera: alle spalle del direttore si sfila la tessera e al rifugio vale come fatta', () => {
  const s = creaPartita({ seme: 8, colpo: 'prep:tessera', giocatori: SQUADRA, ambiente: amb });
  const d = s.png.find(p => p.tessera);
  d.giro = [{ x: d.x, z: d.z, sosta: 999 }];
  d.yaw = 0;
  avanza(s, 0.1, { posizioni: metti(s, 'a', d.x, d.z + 1.2) });
  avanza(s, 0.1, { azioni: [usa('a', `borseggia:${d.id}`)] });
  avanza(s, 3.5, {});
  assert.equal(s.missione.fatto, true);
  const c = camp.nuovaCampagna();
  camp.registraPreparazione(c, 'banca', 'tessera');
  assert.deepEqual(camp.preparazioniFatte(c, 'banca'), ['tessera']);
});

test('preparazione furgone: l\'autista avvia il furgone e diventa il veicolo della fuga', () => {
  const s = creaPartita({ seme: 4, colpo: 'prep:furgone', giocatori: SQUADRA, ambiente: amb });
  const v = s.veicoli.find(x => x.daRubare);
  const [px, pz] = puntiVeicolo(v).portaGuida;
  avanza(s, 0.1, { posizioni: metti(s, 'b', px, pz) });
  avanza(s, 0.1, { azioni: [usa('b', `avvia:${v.id}`)] });
  avanza(s, 2.5, {});
  assert.equal(v.nostro, true);
  assert.equal(v.guidatore, 'b');
  assert.equal(VEICOLI[v.tipo].sacchi, 8);
});

test('preparazione linea e fotografie si completano con le loro azioni', () => {
  const linea = creaPartita({ seme: 2, colpo: 'prep:linea', giocatori: SQUADRA, ambiente: amb });
  const o = linea.oggetti[0];
  avanza(linea, 0.1, { posizioni: metti(linea, 'a', o.x, o.z) });
  avanza(linea, 0.1, { azioni: [usa('a', `taglia:${o.id}`)] });
  avanza(linea, 8, {});
  assert.equal(linea.missione.fatto, true);
  const foto = creaPartita({ seme: 2, colpo: 'prep:fotografie', giocatori: SQUADRA, ambiente: amb });
  assert.ok(foto.missione.obiettivi.length >= 4);
  for (const ob of foto.missione.obiettivi) {
    const [tipo, id] = ob.startsWith('png:') ? ['png', ob.slice(4)] : ['cam', ob];
    const bersaglio = tipo === 'png' ? foto.png.find(p => String(p.indice) === id) : foto.telecamere.find(t => t.id === id);
    avanza(foto, 0.1, { posizioni: metti(foto, 'a', bersaglio.x + 0.5, bersaglio.z + 0.5) });
    avanza(foto, 0.1, { azioni: [usa('a', tipo === 'png' ? `fotografa:png:${id}` : `fotografa:${id}`)] });
    avanza(foto, 2, {});
  }
  assert.equal(foto.missione.fatto, true, JSON.stringify(foto.missione));
});

test('la campagna sblocca i colpi in ordine (supermercato dopo la tabaccheria) e il furgone rubato vale per il municipio', () => {
  const c = camp.nuovaCampagna();
  assert.equal(camp.sbloccato(c, 'tabaccheria'), true);
  assert.equal(camp.sbloccato(c, 'furgone'), false);
  assert.equal(camp.sbloccato(c, 'supermercato'), false);
  camp.registraEsito(c, 'tabaccheria', { vinto: true, totale: 20000 }, ['Richi', 'Seba']);
  assert.equal(camp.sbloccato(c, 'supermercato'), true);
  assert.equal(camp.sbloccato(c, 'furgone'), false);
  camp.registraEsito(c, 'supermercato', { vinto: false, totale: 0 }, ['Richi', 'Seba']);
  assert.equal(camp.sbloccato(c, 'furgone'), false);
  camp.registraEsito(c, 'supermercato', { vinto: true, totale: 0 }, ['Richi', 'Seba']);
  assert.equal(camp.sbloccato(c, 'furgone'), true);
  assert.equal(camp.scheda(c, 'Richi').soldi, 2500 + 10000);
  assert.equal(camp.compra(c, 'Richi', 'trapano').ok, true);
  assert.equal(camp.compra(c, 'Richi', 'trapano').ok, false);
  camp.registraPreparazione(c, 'municipio', 'furgone');
  assert.equal(camp.veicoloColpo(c, 'municipio'), 'furgone');
});
