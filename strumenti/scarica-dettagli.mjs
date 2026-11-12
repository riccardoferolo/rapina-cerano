import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const USCITA = fileURLToPath(new URL('./osm/cerano-dettagli.json', import.meta.url));
const BBOX = '45.398,8.765,45.428,8.808';
const SERVER = ['https://overpass.kumi.systems/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const FILTRI = [
  'nwr["barrier"]', 'nwr["amenity"]', 'nwr["shop"]', 'nwr["leisure"]', 'node["natural"="tree"]', 'nwr["natural"="tree_row"]', 'nwr["natural"="hedge"]',
  'node["highway"]', 'nwr["man_made"]', 'nwr["building:levels"]', 'nwr["building:part"]', 'nwr["roof:shape"]', 'nwr["height"]', 'nwr["tourism"]',
  'nwr["historic"]', 'nwr["area:highway"]', 'nwr["place"="square"]', 'nwr["craft"]', 'nwr["office"]',
];
const QUERY = `[out:json][timeout:180];(${FILTRI.map(f => `${f}(${BBOX});`).join('')});out tags geom;`;
const TENTATIVI = 8;

async function scarica() {
  let attesa = 15000;
  for (let t = 0; t < TENTATIVI; t++) {
    const server = SERVER[t % SERVER.length];
    try {
      const r = await fetch(server, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'rapina-cerano/0.1 (gioco amatoriale)' },
        body: `data=${encodeURIComponent(QUERY)}`,
        signal: AbortSignal.timeout(220000),
      });
      const testo = await r.text();
      if (r.ok && testo.trimStart().startsWith('{')) {
        const dati = JSON.parse(testo);
        mkdirSync(fileURLToPath(new URL('./osm/', import.meta.url)), { recursive: true });
        writeFileSync(USCITA, testo);
        console.log(`scaricati ${dati.elements.length} elementi da ${server}`);
        return;
      }
      console.log(`${server}: ${r.status} ${testo.slice(0, 80).replace(/\s+/g, ' ')}`);
    } catch (e) {
      console.log(`${server}: ${e.message}`);
    }
    await new Promise(ok => setTimeout(ok, attesa + Math.random() * 5000));
    attesa = Math.min(120000, attesa * 2);
  }
  throw new Error('Overpass non risponde: riprova più tardi');
}

await scarica();
