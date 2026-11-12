import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leggiPng, scriviPng, creaTela } from './png.mjs';
import { caricaAltezze } from './altezze-bdtre.mjs';
import {
  areaFirmata, baricentro, dentro, puntoSegmento, intersezioneRaggio, campionaLinea, semplifica, rientra, scatola, larghezzaMinima, hashNumero, distanza,
} from '../src/citta/geometria.js';

const SORGENTE = process.argv[2] ?? 'C:/Users/RiccardoF/Desktop/sito/gtacerano';
const USCITA = fileURLToPath(new URL('../public/cerano/', import.meta.url));
const ANTEPRIME = fileURLToPath(new URL('../_lavoro/anteprime/', import.meta.url));
const ROTAZIONE = (18.7 * Math.PI) / 180;
const LIMITE = 2600;
const CHIESA = 566072002;
const MUNICIPIO = 858928968;
const METRI_PER_GRADO = 111320;
const RAGGIO_CENTRO_STORICO = 380;
const RAGGIO_RAGGI_MARCIAPIEDE = 14;
const PASSO_MARCIAPIEDE = 5;
const PASSO_LAMPIONI = 27;
const LATO_GRIGLIA = 25;

const STRADE = Object.freeze({
  secondary: { largo: 8, auto: 1, rango: 4 },
  tertiary: { largo: 7, auto: 1, rango: 3 },
  tertiary_link: { largo: 6, auto: 1, rango: 3 },
  unclassified: { largo: 5.6, auto: 1, rango: 2 },
  residential: { largo: 5.4, auto: 1, rango: 2 },
  living_street: { largo: 5, auto: 1, rango: 1 },
  service: { largo: 3.8, auto: 1, rango: 1 },
  track: { largo: 3, auto: 1, rango: 0, sterrata: 1 },
  pedestrian: { largo: 5, auto: 0, rango: 1, pedonale: 1 },
  footway: { largo: 1.8, auto: 0, rango: 0 },
  cycleway: { largo: 2.4, auto: 0, rango: 0 },
  path: { largo: 1.4, auto: 0, rango: 0, sterrata: 1 },
});
const SUPERFICI_STERRATE = new Set(['unpaved', 'ground', 'gravel', 'dirt', 'dirt/sand', 'sand/gravel/stones', 'grass', 'soil', 'compacted', 'fine_gravel']);
const AREE = Object.freeze({
  farmland: 'campo', meadow: 'prato', grass: 'prato', grassland: 'prato', village_green: 'prato', park: 'parco', garden: 'parco', pitch: 'campetto',
  playground: 'parco', forest: 'bosco', wood: 'bosco', scrub: 'bosco', farmyard: 'aia', industrial: 'piazzale', commercial: 'piazzale', retail: 'piazzale',
  cemetery: 'cimitero', quarry: 'cava', aquaculture: 'acqua', water: 'acqua', parking: 'parcheggio', swimming_pool: 'piscina', railway: 'massicciata',
});
const ACQUE = Object.freeze({ river: 18, canal: 4, stream: 2, ditch: 1.2, drain: 1 });
const NAVIGLI = /naviglio|diramatore|scolmatore/i;
const BASSI = new Set(['garage', 'garages', 'shed', 'carport', 'service']);

const rnd1 = v => Math.round(v * 10) / 10;
const rnd2 = v => Math.round(v * 100) / 100;

const osm = JSON.parse(readFileSync(join(SORGENTE, 'data/osm/cerano.json'), 'utf8'));
const correzioni = existsSync(join(SORGENTE, 'data/correzioni.json')) ? JSON.parse(readFileSync(join(SORGENTE, 'data/correzioni.json'), 'utf8')) : { aggiunte: [], rimuoviId: [] };
const elementi = osm.elements.filter(e => !correzioni.rimuoviId.includes(e.id));
correzioni.aggiunte.forEach((a, i) => elementi.push({ type: 'way', id: `correzione-${i}`, tags: a.tags, geometry: a.punti.map(([lat, lon]) => ({ lat, lon })) }));

const chiesa = elementi.find(e => e.id === CHIESA);
const facciataA = chiesa.geometry[0];
const facciataB = chiesa.geometry[chiesa.geometry.length - 2];
const LAT0 = (facciataA.lat + facciataB.lat) / 2;
const LON0 = (facciataA.lon + facciataB.lon) / 2;
const MX = METRI_PER_GRADO * Math.cos((LAT0 * Math.PI) / 180);
const MY = METRI_PER_GRADO;
const COS = Math.cos(ROTAZIONE);
const SIN = Math.sin(ROTAZIONE);

const proietta = (lat, lon) => {
  const ex = (lon - LON0) * MX;
  const sz = (LAT0 - lat) * MY;
  return [ex * COS - sz * SIN, ex * SIN + sz * COS];
};
const aGeo = (x, z) => {
  const ex = x * COS + z * SIN;
  const sz = -x * SIN + z * COS;
  return { lat: LAT0 - sz / MY, lon: LON0 + ex / MX };
};
const dentroLimite = ([x, z], m = 0) => Math.abs(x) <= LIMITE + m && Math.abs(z) <= LIMITE + m;

const indiceFoto = JSON.parse(readFileSync(join(SORGENTE, 'data/foto/indice.json'), 'utf8'));
const tasselli = new Map();
function coloreFoto(x, z) {
  const { lat, lon } = aGeo(x, z);
  const px = (lon - indiceFoto.lonOvest) / indiceFoto.gradiLonPerPx;
  const py = (indiceFoto.latNord - lat) / indiceFoto.gradiLatPerPx;
  const i = Math.floor(px / indiceFoto.lato);
  const j = Math.floor(py / indiceFoto.lato);
  if (px < 0 || py < 0 || i >= indiceFoto.nx || j >= indiceFoto.ny) return null;
  const chiave = `${i}_${j}`;
  if (!tasselli.has(chiave)) {
    const file = join(SORGENTE, `data/foto/f_${i}_${j}.png`);
    tasselli.set(chiave, existsSync(file) ? leggiPng(readFileSync(file)) : null);
  }
  const t = tasselli.get(chiave);
  if (!t) return null;
  const tx = Math.floor(px - i * indiceFoto.lato);
  const ty = Math.floor(py - j * indiceFoto.lato);
  if (tx >= t.w || ty >= t.h) return null;
  const o = (ty * t.w + tx) * t.canali;
  return [t.dati[o], t.dati[o + 1], t.dati[o + 2]];
}

function creaCaso(seme) {
  let s = seme >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function campionaColore(anello, quanti, seme) {
  const { x0, z0, x1, z1 } = scatola(anello);
  const caso = creaCaso(seme);
  const campioni = [];
  for (let k = 0; k < quanti * 6 && campioni.length < quanti; k++) {
    const x = x0 + caso() * (x1 - x0);
    const z = z0 + caso() * (z1 - z0);
    if (!dentro(x, z, anello)) continue;
    const c = coloreFoto(x, z);
    if (c) campioni.push(c);
  }
  if (!campioni.length) return null;
  return [0, 1, 2].map(k => {
    const v = campioni.map(c => c[k]).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  });
}

const aHex = ([r, g, b]) => (Math.max(0, Math.min(255, Math.round(r))) << 16) | (Math.max(0, Math.min(255, Math.round(g))) << 8) | Math.max(0, Math.min(255, Math.round(b)));

function anelliDi(e) {
  if (e.type === 'way' && e.geometry) return [e.geometry];
  if (e.type === 'relation') return (e.members ?? []).filter(m => m.role === 'outer' && m.geometry).map(m => m.geometry);
  return [];
}

function creaGriglia() {
  const celle = new Map();
  const chiave = (i, j) => `${i}|${j}`;
  return {
    aggiungi(x0, z0, x1, z1, voce) {
      for (let i = Math.floor(x0 / LATO_GRIGLIA); i <= Math.floor(x1 / LATO_GRIGLIA); i++) {
        for (let j = Math.floor(z0 / LATO_GRIGLIA); j <= Math.floor(z1 / LATO_GRIGLIA); j++) {
          const k = chiave(i, j);
          if (!celle.has(k)) celle.set(k, []);
          celle.get(k).push(voce);
        }
      }
    },
    vicini(x0, z0, x1, z1) {
      const visti = new Set();
      for (let i = Math.floor(x0 / LATO_GRIGLIA); i <= Math.floor(x1 / LATO_GRIGLIA); i++) {
        for (let j = Math.floor(z0 / LATO_GRIGLIA); j <= Math.floor(z1 / LATO_GRIGLIA); j++) for (const v of celle.get(chiave(i, j)) ?? []) visti.add(v);
      }
      return visti;
    },
  };
}

const distanzaCentro = (x, z) => Math.hypot(x - 25, z);

function stimaEdificio(id, tag, anello, area, c) {
  const tipo = tag.building;
  const caso = hashNumero(typeof id === 'number' ? id : [...String(id)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7));
  const dc = distanzaCentro(...c);
  const { largo } = larghezzaMinima(anello);
  if (id === CHIESA) return { piani: 0, altezza: 17, uso: 'chiesa', muro: 'chiesa' };
  if (id === MUNICIPIO) return { piani: 2, altezza: 11.5, uso: 'municipio', muro: 'intonaco' };
  if (tipo === 'church' || tag.amenity === 'place_of_worship') return { piani: 0, altezza: 11 + caso * 4, uso: 'chiesa', muro: 'chiesa' };
  if (tipo === 'roof' || tipo === 'carport') return { piani: 0, altezza: 3.4, uso: 'tettoia', muro: 'nessuno' };
  if (tipo === 'storage_tank' || tag.man_made === 'storage_tank' || tag.man_made === 'silo') return { piani: 0, altezza: Math.min(18, Math.max(6, largo * 0.9)), uso: 'serbatoio', muro: 'metallo' };
  if (tipo === 'transformer_tower') return { piani: 0, altezza: 8.5, uso: 'cabina', muro: 'intonaco' };
  if (tipo === 'greenhouse') return { piani: 0, altezza: 3.6, uso: 'serra', muro: 'vetro' };
  if (tipo === 'ruins') return { piani: 0, altezza: 3, uso: 'rudere', muro: 'mattoni' };
  if (BASSI.has(tipo) || area < 22) return { piani: 1, altezza: 2.7, uso: 'box', muro: area < 60 && dc > 300 ? 'mattoni' : 'intonaco' };
  if (tipo === 'industrial' || (tipo === 'yes' && area > 1400 && dc > 450)) return { piani: 0, altezza: 7 + caso * 3, uso: 'capannone', muro: 'industriale' };
  if (tipo === 'apartments') {
    const piani = area > 300 ? 4 + Math.floor(caso * 3) : 3 + Math.floor(caso * 2);
    return { piani, altezza: 3.4 + (piani - 1) * 3, uso: 'condominio', muro: 'intonaco' };
  }
  if (tipo === 'school' || tipo === 'public') return { piani: 3, altezza: 11, uso: 'pubblico', muro: 'intonaco' };
  if (tipo === 'kindergarten') return { piani: 1, altezza: 4.2, uso: 'pubblico', muro: 'intonaco' };
  if (tipo === 'farm_auxiliary' || (dc > 900 && area > 250)) return { piani: 2, altezza: 7 + caso * 2, uso: 'cascina', muro: caso < 0.6 ? 'mattoni' : 'intonaco' };
  if (dc < RAGGIO_CENTRO_STORICO) {
    const piani = caso < 0.42 ? 2 : caso < 0.9 ? 3 : 4;
    return { piani, altezza: 3.5 + (piani - 1) * 3, uso: 'centro', muro: 'intonaco' };
  }
  if (area > 380 && area <= 1400) {
    const piani = 3 + Math.floor(caso * 3);
    return { piani, altezza: 3.4 + (piani - 1) * 3, uso: 'condominio', muro: 'intonaco' };
  }
  const piani = caso < 0.1 ? 1 : caso < 0.94 ? 2 : 3;
  return { piani, altezza: 3.3 + (piani - 1) * 3, uso: 'villetta', muro: 'intonaco' };
}

const TINTE_MURO = Object.freeze([
  [233, 214, 172], [240, 226, 196], [226, 196, 150], [236, 208, 170], [228, 222, 206], [242, 212, 150], [214, 170, 132], [228, 186, 160],
  [208, 196, 178], [236, 232, 220], [222, 160, 112], [200, 186, 160],
]);

const USI_BASSI = new Set(['box', 'tettoia', 'serra', 'cabina', 'rudere']);
const RIDUZIONE_FALDA = 0.23;
const altezze = caricaAltezze(proietta);
const edifici = [];
const grigliaEdifici = creaGriglia();
for (const e of elementi) {
  const tag = e.tags ?? {};
  if (!tag.building || tag.building === 'no') continue;
  for (const geo of anelliDi(e)) {
    let anello = geo.map(p => proietta(p.lat, p.lon));
    if (!anello.some(p => dentroLimite(p))) continue;
    anello = semplifica(anello, 0.12);
    if (anello.length < 3) continue;
    if (areaFirmata(anello) < 0) anello.reverse();
    const area = areaFirmata(anello);
    if (area < 6) continue;
    const c = baricentro(anello);
    const stima = stimaEdificio(e.id, tag, anello, area, c);
    const interno = area > 60 ? rientra(anello, 0.8) : anello;
    const fotoTetto = campionaColore(areaFirmata(interno) > 4 ? interno : anello, 16, typeof e.id === 'number' ? e.id : 99);
    const caso = hashNumero((typeof e.id === 'number' ? e.id : 7) * 3 + 1);
    let tetto = 'falde';
    if (['capannone', 'serbatoio', 'box', 'cabina', 'tettoia', 'serra', 'rudere'].includes(stima.uso)) tetto = 'piano';
    if (fotoTetto) {
      const [r, g, b] = fotoTetto;
      const grigio = Math.max(r, g, b) - Math.min(r, g, b) < 16;
      if (grigio && stima.uso === 'condominio' && caso < 0.6) tetto = 'piano';
      if (!grigio && r > g + 18 && ['capannone', 'box'].includes(stima.uso) && area < 900) tetto = 'falde';
    }
    if (stima.uso === 'box' && caso < 0.5) tetto = 'piano';
    let coloreTetto = fotoTetto ?? [150, 84, 64];
    if (tetto === 'falde') {
      const [r, g, b] = coloreTetto;
      coloreTetto = r > g + 8 ? [Math.min(255, r * 1.08), g * 0.95, b * 0.9] : [142 + caso * 20, 82 + caso * 14, 62];
    } else coloreTetto = [coloreTetto[0] * 0.9, coloreTetto[1] * 0.9, coloreTetto[2] * 0.92];
    let altezza = stima.altezza;
    let piani = stima.piani;
    const reale = e.id === CHIESA || e.id === MUNICIPIO ? null : altezze.altezzaReale(anello, USI_BASSI.has(stima.uso));
    if (reale !== null) {
      const tolta = tetto === 'falde' ? RIDUZIONE_FALDA * Math.min(4.2, 0.49 * larghezzaMinima(anello).largo) : 0;
      altezza = Math.max(2.4, reale - tolta);
      if (piani > 0) piani = Math.max(1, Math.min(8, Math.round((altezza - 0.3) / 3)));
    }
    const tinta = stima.muro === 'mattoni' ? [172, 104, 80] : stima.muro === 'industriale' ? [190 + caso * 30, 192 + caso * 26, 188 + caso * 20] : TINTE_MURO[Math.floor(caso * TINTE_MURO.length)];
    const voce = {
      id: e.id, u: stima.uso, m: stima.muro, h: rnd1(altezza), np: piani, t: tetto, ct: aHex(coloreTetto), cm: aHex(tinta),
      p: anello.map(([x, z]) => [rnd1(x), rnd1(z)]),
    };
    if (tag.name) voce.n = tag.name;
    if (reale !== null) voce.hr = 1;
    const s = scatola(anello);
    edifici.push(voce);
    grigliaEdifici.aggiungi(s.x0, s.z0, s.x1, s.z1, voce);
  }
}

function spezzaNelLimite(punti, nodi, margine) {
  const pezzi = [];
  let attuale = null;
  for (let i = 0; i < punti.length; i++) {
    const ok = dentroLimite(punti[i], margine);
    if (ok) {
      if (!attuale) {
        attuale = { p: [], k: [] };
        if (i > 0) {
          attuale.p.push(punti[i - 1]);
          attuale.k.push(nodi[i - 1]);
        }
      }
      attuale.p.push(punti[i]);
      attuale.k.push(nodi[i]);
    } else if (attuale) {
      attuale.p.push(punti[i]);
      attuale.k.push(nodi[i]);
      pezzi.push(attuale);
      attuale = null;
    }
  }
  if (attuale) pezzi.push(attuale);
  return pezzi.filter(p => p.p.length >= 2);
}

const idNodi = new Map();
const nodoCompatto = id => {
  if (!idNodi.has(id)) idNodi.set(id, idNodi.size);
  return idNodi.get(id);
};

const strade = [];
for (const e of elementi) {
  const tag = e.tags ?? {};
  const regola = STRADE[tag.highway];
  if (!regola || e.type !== 'way' || !e.geometry) continue;
  if (tag.area === 'yes') continue;
  const punti = e.geometry.map(p => proietta(p.lat, p.lon));
  const nodi = (e.nodes ?? e.geometry.map((_, i) => `${e.id}-${i}`)).map(nodoCompatto);
  for (const pezzo of spezzaNelLimite(punti, nodi, 150)) {
    let largo = regola.largo;
    const dichiarata = Number.parseFloat(tag.width);
    if (Number.isFinite(dichiarata) && dichiarata >= 2) largo = dichiarata;
    if (tag.oneway === 'yes' && regola.rango >= 2) largo = Math.max(4.2, largo - 1.2);
    if (tag.lanes === '1') largo = Math.min(largo, 4.5);
    const voce = {
      n: tag.name ?? '', t: tag.highway, l: rnd1(largo), a: regola.auto, r: regola.rango,
      s: regola.sterrata || SUPERFICI_STERRATE.has(tag.surface) ? 1 : 0,
      o: tag.oneway === 'yes' ? 1 : 0, b: tag.bridge === 'yes' ? 1 : 0, g: tag.tunnel === 'yes' || tag.tunnel === 'building_passage' ? 1 : 0,
      ro: tag.junction === 'roundabout' ? 1 : 0, pe: regola.pedonale ? 1 : 0, m: [0, 0],
      p: pezzo.p.map(([x, z]) => [rnd1(x), rnd1(z)]), k: pezzo.k,
    };
    strade.push(voce);
  }
}

const segmentiEdifici = creaGriglia();
for (const ed of edifici) {
  if (ed.u === 'tettoia') continue;
  for (let i = 0; i < ed.p.length; i++) {
    const a = ed.p[i];
    const b = ed.p[(i + 1) % ed.p.length];
    segmentiEdifici.aggiungi(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), [a[0], a[1], b[0], b[1]]);
  }
}

function raggioMuro(x, z, dx, dz, massimo) {
  let migliore = Infinity;
  for (const [ax, az, bx, bz] of segmentiEdifici.vicini(x - massimo, z - massimo, x + massimo, z + massimo)) {
    migliore = Math.min(migliore, intersezioneRaggio(x, z, dx, dz, ax, az, bx, bz));
  }
  return migliore <= massimo ? migliore : null;
}

const percentile = (valori, q) => {
  const s = [...valori].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * q))];
};

for (const s of strade) {
  if (!s.a || s.r < 1 || s.t === 'track' || s.b || s.g) continue;
  const campioni = campionaLinea(s.p, PASSO_MARCIAPIEDE);
  const lati = [[], []];
  let colpiti = 0;
  for (const c of campioni) {
    let preso = false;
    for (const [k, verso] of [[0, 1], [1, -1]]) {
      const nx = -c.uz * verso;
      const nz = c.ux * verso;
      const d = raggioMuro(c.x, c.z, nx, nz, RAGGIO_RAGGI_MARCIAPIEDE);
      if (d !== null) {
        lati[k].push(d);
        preso = true;
      }
    }
    if (preso) colpiti += 1;
  }
  const urbana = campioni.length > 0 && colpiti / campioni.length > 0.3;
  s.u = urbana ? 1 : 0;
  if (!urbana || s.pe) continue;
  const meta = s.l / 2;
  s.m = lati.map(dist => {
    if (dist.length < Math.max(2, campioni.length * 0.2)) return s.r >= 2 ? 1.6 : 0;
    const d = percentile(dist, 0.3);
    const marciapiede = Math.min(2.2, d - meta - 0.25);
    if (marciapiede < 0.9) return 0;
    return rnd1(marciapiede);
  });
}

const grigliaStrade = creaGriglia();
for (const s of strade) {
  for (let i = 1; i < s.p.length; i++) {
    const [ax, az] = s.p[i - 1];
    const [bx, bz] = s.p[i];
    const m = s.l / 2 + Math.max(...s.m) + 1;
    grigliaStrade.aggiungi(Math.min(ax, bx) - m, Math.min(az, bz) - m, Math.max(ax, bx) + m, Math.max(az, bz) + m, { s, ax, az, bx, bz });
  }
}

function suStrada(x, z, margine = 0) {
  for (const seg of grigliaStrade.vicini(x - 1, z - 1, x + 1, z + 1)) {
    if (puntoSegmento(x, z, seg.ax, seg.az, seg.bx, seg.bz).d < seg.s.l / 2 + Math.max(...seg.s.m) + margine) return seg.s;
  }
  return null;
}

function dentroEdificio(x, z) {
  for (const ed of grigliaEdifici.vicini(x, z, x, z)) if (dentro(x, z, ed.p)) return ed;
  return null;
}

const nomiVie = [...new Set(strade.filter(s => s.n).map(s => s.n))].sort((a, b) => a.localeCompare(b, 'it'));
for (const ed of edifici) {
  const [cx, cz] = baricentro(ed.p);
  let migliore = 30;
  let via = null;
  for (const seg of grigliaStrade.vicini(cx - 30, cz - 30, cx + 30, cz + 30)) {
    if (!seg.s.n) continue;
    const d = puntoSegmento(cx, cz, seg.ax, seg.az, seg.bx, seg.bz).d;
    if (d < migliore) {
      migliore = d;
      via = seg.s.n;
    }
  }
  if (via) ed.v = nomiVie.indexOf(via);
}

const aree = [];
for (const e of elementi) {
  const tag = e.tags ?? {};
  const tipo = (tag.highway && tag.area === 'yes') || tag.place === 'square' ? 'piazza' : AREE[tag.landuse] ?? AREE[tag.natural] ?? AREE[tag.leisure] ?? AREE[tag.amenity] ?? (tag.water ? 'acqua' : null);
  if (!tipo || tag.building) continue;
  for (const geo of anelliDi(e)) {
    let anello = geo.map(p => proietta(p.lat, p.lon));
    const s = scatola(anello);
    if (s.x1 < -LIMITE || s.x0 > LIMITE || s.z1 < -LIMITE || s.z0 > LIMITE) continue;
    anello = semplifica(anello, 0.3);
    if (anello.length < 3) continue;
    if (areaFirmata(anello) < 0) anello.reverse();
    const area = areaFirmata(anello);
    if (area < 4) continue;
    const voce = { t: tipo, p: anello.map(([x, z]) => [rnd1(x), rnd1(z)]) };
    if (['campo', 'prato', 'bosco', 'aia', 'parco'].includes(tipo)) {
      const c = campionaColore(anello, 40, Math.round(area));
      if (c) voce.c = aHex(c);
    }
    aree.push(voce);
  }
}

const acque = [];
for (const e of elementi) {
  const tag = e.tags ?? {};
  const base = ACQUE[tag.waterway];
  if (!base || e.type !== 'way' || !e.geometry) continue;
  const punti = e.geometry.map(p => proietta(p.lat, p.lon));
  const largo = tag.waterway === 'canal' && NAVIGLI.test(tag.name ?? '') ? 9 : tag.waterway === 'canal' && tag.name ? 4.5 : base;
  for (const pezzo of spezzaNelLimite(punti, punti.map(() => 0), 100)) {
    acque.push({ n: tag.name ?? '', t: tag.waterway, l: largo, g: tag.tunnel === 'culvert' || tag.tunnel === 'yes' ? 1 : 0, p: pezzo.p.map(([x, z]) => [rnd1(x), rnd1(z)]) });
  }
}

const ferrovie = [];
for (const e of elementi) {
  if (e.tags?.railway !== 'rail' || !e.geometry) continue;
  const punti = e.geometry.map(p => proietta(p.lat, p.lon));
  for (const pezzo of spezzaNelLimite(punti, punti.map(() => 0), 100)) ferrovie.push({ b: e.tags.bridge === 'yes' ? 1 : 0, p: pezzo.p.map(([x, z]) => [rnd1(x), rnd1(z)]) });
}

const alberi = [];
const grigliaAlberi = new Set();
function aggiungiAlbero(x, z, scala) {
  if (!dentroLimite([x, z])) return;
  const k = `${Math.round(x / 2.2)}|${Math.round(z / 2.2)}`;
  if (grigliaAlberi.has(k)) return;
  if (suStrada(x, z, 0.6) || dentroEdificio(x, z)) return;
  grigliaAlberi.add(k);
  alberi.push([rnd1(x), rnd1(z), rnd2(scala)]);
}
const fileAlberi = join(SORGENTE, 'data/mappa/alberi.json');
if (existsSync(fileAlberi)) {
  const gta = JSON.parse(readFileSync(fileAlberi, 'utf8'));
  const g = { lat0: 45.41392920342961, lon0: 8.787870875507972, m: 2, w: 1984, h: 1600, rot: (24 * Math.PI) / 180 };
  const gmx = METRI_PER_GRADO * Math.cos((g.lat0 * Math.PI) / 180);
  for (const { x, y } of gta) {
    const xr = (x - g.w / 2) * g.m;
    const yr = (y - g.h / 2) * g.m;
    const ex = xr * Math.cos(g.rot) + yr * Math.sin(g.rot);
    const sy = -xr * Math.sin(g.rot) + yr * Math.cos(g.rot);
    const [lx, lz] = proietta(g.lat0 - sy / MY, g.lon0 + ex / gmx);
    aggiungiAlbero(lx, lz, 0.7 + hashNumero(Math.round(x * 13 + y * 7919)) * 0.7);
  }
}
for (const e of elementi) {
  if (e.tags?.natural !== 'tree_row' || !e.geometry) continue;
  const punti = e.geometry.map(p => proietta(p.lat, p.lon));
  for (const c of campionaLinea(punti, 7)) aggiungiAlbero(c.x, c.z, 0.9 + hashNumero(Math.round(c.x * 31 + c.z)) * 0.4);
}

const lampioni = [];
const grigliaLampioni = new Set();
for (const s of strade) {
  if (!s.u || !s.a || s.r < 1 || s.g) continue;
  let lato = 0;
  for (const c of campionaLinea(s.p, PASSO_LAMPIONI).slice(1)) {
    lato = 1 - lato;
    const verso = lato ? 1 : -1;
    const nx = -c.uz * verso;
    const nz = c.ux * verso;
    const marc = s.m[lato ? 0 : 1];
    let off;
    let tipo;
    if (marc > 0) {
      off = s.l / 2 + 0.45;
      tipo = 'palo';
    } else {
      const muro = raggioMuro(c.x, c.z, nx, nz, 9);
      if (muro !== null && muro > s.l / 2 - 0.2) {
        off = muro - 0.05;
        tipo = 'muro';
      } else {
        off = s.l / 2 + 0.6;
        tipo = 'palo';
      }
    }
    const x = c.x + nx * off;
    const z = c.z + nz * off;
    const k = `${Math.round(x / 9)}|${Math.round(z / 9)}`;
    if (grigliaLampioni.has(k)) continue;
    if (tipo === 'palo' && dentroEdificio(x, z)) continue;
    grigliaLampioni.add(k);
    lampioni.push([rnd1(x), rnd1(z), rnd2(Math.atan2(-nx, -nz)), tipo === 'muro' ? 1 : 0]);
  }
}

const luoghi = [];
for (const e of elementi) {
  const tag = e.tags ?? {};
  if (!tag.name || !(tag.amenity || tag.shop || tag.tourism || tag.leisure === 'park')) continue;
  let pos = null;
  if (e.type === 'node') pos = proietta(e.lat, e.lon);
  else if (e.geometry) pos = baricentro(e.geometry.map(p => proietta(p.lat, p.lon)));
  if (!pos || !dentroLimite(pos)) continue;
  luoghi.push({ n: tag.name, t: tag.amenity ?? tag.shop ?? tag.tourism ?? tag.leisure, x: rnd1(pos[0]), z: rnd1(pos[1]) });
}

const DETTAGLI = fileURLToPath(new URL('./osm/cerano-dettagli.json', import.meta.url));
const arredi = [];
if (existsSync(DETTAGLI)) {
  const segmenti = [];
  for (const s of strade) {
    if (!s.a && !s.pe) continue;
    for (let i = 1; i < s.p.length; i++) segmenti.push({ s, i, a: s.p[i - 1], b: s.p[i] });
  }
  const lunghezze = new Map(strade.map(s => {
    let l = 0;
    const cum = [0];
    for (let i = 1; i < s.p.length; i++) cum.push((l += distanza(s.p[i - 1], s.p[i])));
    return [s, cum];
  }));
  const piuVicina = (x, z, entro = 12) => {
    let migliore = null;
    for (const g of segmenti) {
      const [ax, az] = g.a;
      const [bx, bz] = g.b;
      const l2 = (bx - ax) ** 2 + (bz - az) ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / l2));
      const px = ax + (bx - ax) * t;
      const pz = az + (bz - az) * t;
      const d = Math.hypot(x - px, z - pz);
      if (d > entro || (migliore && d >= migliore.d)) continue;
      const l = Math.sqrt(l2);
      migliore = { d, px, pz, ux: (bx - ax) / l, uz: (bz - az) / l, s: g.s, i: g.i, t, lato: Math.sign((x - px) * -((bz - az) / l) + (z - pz) * ((bx - ax) / l)) || 1 };
    }
    return migliore;
  };
  const r2 = v => Math.round(v * 100) / 100;
  const elementiDettaglio = JSON.parse(readFileSync(DETTAGLI, 'utf8')).elements;
  const conteggio = {};
  const metti = (voce) => {
    arredi.push(voce);
    conteggio[voce[0]] = (conteggio[voce[0]] ?? 0) + 1;
  };
  for (const e of elementiDettaglio) {
    if (e.type !== 'node') continue;
    const t = e.tags ?? {};
    const [x, z] = proietta(e.lat, e.lon);
    if (!dentroLimite([x, z], -10)) continue;
    if (t.highway === 'crossing' || t.crossing === 'zebra' || t.crossing === 'marked' || t.crossing === 'uncontrolled') {
      const v = piuVicina(x, z, 4);
      if (v) metti(['strisce', rnd1(v.px), rnd1(v.pz), r2(Math.atan2(v.uz, v.ux)), v.s.l]);
      continue;
    }
    if (t.highway === 'stop' || t.highway === 'give_way') {
      const v = piuVicina(x, z, 6);
      if (!v) continue;
      const cum = lunghezze.get(v.s);
      const qui = cum[v.i - 1] + (cum[v.i] - cum[v.i - 1]) * v.t;
      const versoFine = cum[cum.length - 1] - qui < qui ? 1 : -1;
      const dx = v.ux * versoFine;
      const dz = v.uz * versoFine;
      const [rx, rz] = [-dz, dx];
      const fuori = v.s.l / 2 + 0.55;
      metti([t.highway === 'stop' ? 'stop' : 'precedenza', rnd1(v.px + rx * fuori), rnd1(v.pz + rz * fuori), r2(Math.atan2(-dx, -dz))]);
      if (t.highway === 'stop') metti(['linea', rnd1(v.px + rx * v.s.l / 4), rnd1(v.pz + rz * v.s.l / 4), r2(Math.atan2(dz, dx)), r2(v.s.l / 2 - 0.2)]);
      continue;
    }
    if (t.highway === 'traffic_signals') {
      const v = piuVicina(x, z, 6);
      if (!v) continue;
      for (const lato of [1, -1]) {
        const fuori = (v.s.l / 2 + 0.6) * lato;
        metti(['semaforo', rnd1(v.px - v.uz * fuori), rnd1(v.pz + v.ux * fuori), r2(Math.atan2(v.ux * lato, v.uz * lato))]);
      }
      continue;
    }
    if (t.highway === 'bus_stop') {
      const v = piuVicina(x, z, 15);
      if (!v) continue;
      const lato = v.d > 1 ? v.lato : 1;
      const fuori = (v.s.l / 2 + 0.9) * lato;
      metti(['fermata', rnd1(v.px - v.uz * fuori), rnd1(v.pz + v.ux * fuori), r2(Math.atan2(-v.uz * lato, v.ux * lato)), t.name ?? '']);
      continue;
    }
    if (t.amenity === 'fountain') metti(['fontana', rnd1(x), rnd1(z), 0, t.name ?? '']);
    else if (t.amenity === 'drinking_water') metti(['fontanella', rnd1(x), rnd1(z), 0]);
    else if (t.historic === 'memorial' && t.memorial !== 'plaque') metti([t.memorial === 'war_memorial' ? 'monumento' : 'stele', rnd1(x), rnd1(z), 0, t.name ?? '']);
    else if (t.natural === 'tree' && !alberi.some(([ax, az]) => Math.abs(ax - x) < 2 && Math.abs(az - z) < 2)) alberi.push([rnd1(x), rnd1(z), 1]);
  }
  console.log(`dettagli OSM: ${Object.entries(conteggio).map(([k, v]) => `${v} ${k}`).join(', ')}`);
}

const dati = {
  versione: 1,
  fonte: 'Dati cartografici © OpenStreetMap contributors (ODbL); colori dei tetti e alberi dalla ortofoto 2010 © Regione Piemonte (CC BY 4.0); altezze degli edifici da Regione Piemonte - BDTRE, ARPA Piemonte (CC BY 4.0)',
  origine: { lat: LAT0, lon: LON0, rotazione: 18.7 },
  limite: LIMITE,
  vie: nomiVie,
  edifici, strade, aree, acque, ferrovie, alberi, lampioni, luoghi, arredi,
};
mkdirSync(USCITA, { recursive: true });
const testo = JSON.stringify(dati);
writeFileSync(join(USCITA, 'cerano.json'), testo);
console.log(`altezze BDTRE: ${altezze.statistiche.misurati} edifici con altezza misurata, ${altezze.statistiche.ripiego} stimati`);
console.log(`cerano.json: ${(testo.length / 1024).toFixed(0)} kB — ${edifici.length} edifici, ${strade.length} strade, ${aree.length} aree, ${acque.length} acque, ${alberi.length} alberi, ${lampioni.length} lampioni, ${luoghi.length} luoghi`);

const COLORI_AREE = { campo: [58, 74, 40], prato: [70, 104, 52], parco: [64, 110, 56], campetto: [70, 120, 60], bosco: [34, 62, 34], aia: [120, 110, 90], piazzale: [110, 110, 110], cimitero: [90, 100, 80], cava: [150, 140, 110], acqua: [40, 80, 120], parcheggio: [80, 80, 84], piscina: [80, 170, 220], massicciata: [120, 110, 100] };
function anteprima(nome, lato, mezzo, cx = 0, cz = 0) {
  const tela = creaTela(lato, lato, [46, 60, 34]);
  const scala = lato / (mezzo * 2);
  const px = ([x, z]) => [(x - cx + mezzo) * scala, (z - cz + mezzo) * scala];
  for (const a of aree) tela.poligono(a.p.map(px), a.c && a.t === 'campo' ? [(a.c >> 16) & 255, (a.c >> 8) & 255, a.c & 255] : COLORI_AREE[a.t] ?? [90, 90, 90]);
  for (const a of acque) tela.linea(a.p.map(px), Math.max(1, a.l * scala), [40, 90, 150]);
  for (const s of strade) tela.linea(s.p.map(px), Math.max(1, (s.l + s.m[0] + s.m[1]) * scala), [200, 196, 186]);
  for (const s of strade) tela.linea(s.p.map(px), Math.max(1, s.l * scala), s.s ? [150, 130, 100] : [70, 72, 76]);
  for (const f of ferrovie) tela.linea(f.p.map(px), Math.max(1, 3 * scala), [110, 90, 80]);
  for (const ed of edifici) tela.poligono(ed.p.map(px), [(ed.ct >> 16) & 255, (ed.ct >> 8) & 255, ed.ct & 255]);
  for (const [x, z] of alberi) {
    const [a, b] = px([x, z]);
    tela.linea([[a, b], [a, b]], Math.max(1, 3 * scala), [30, 80, 30]);
  }
  for (const [x, z] of lampioni) {
    const [a, b] = px([x, z]);
    tela.punto(a, b, [255, 220, 120]);
  }
  mkdirSync(ANTEPRIME, { recursive: true });
  writeFileSync(join(ANTEPRIME, nome), scriviPng(tela.w, tela.h, tela.dati));
}
const LATO_SUOLO = 2048;
const suolo = new Uint8Array(LATO_SUOLO * LATO_SUOLO * 3);
const metriPx = (LIMITE * 2) / LATO_SUOLO;
const OFFSET = [[-0.8, -0.8], [0.8, -0.8], [0, 0], [-0.8, 0.8], [0.8, 0.8]];
for (let py = 0; py < LATO_SUOLO; py++) {
  for (let px = 0; px < LATO_SUOLO; px++) {
    const x = -LIMITE + (px + 0.5) * metriPx;
    const z = -LIMITE + (py + 0.5) * metriPx;
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (const [ox, oz] of OFFSET) {
      const c = coloreFoto(x + ox * metriPx, z + oz * metriPx);
      if (!c) continue;
      r += c[0];
      g += c[1];
      b += c[2];
      n += 1;
    }
    const o = (py * LATO_SUOLO + px) * 3;
    if (n) suolo.set([r / n, g / n, b / n], o);
    else suolo.set([104, 112, 74], o);
  }
}
writeFileSync(join(ANTEPRIME, '..', 'suolo.png'), scriviPng(LATO_SUOLO, LATO_SUOLO, suolo));
console.log('suolo.png scritto (da convertire in public/cerano/suolo.jpg)');
anteprima('cerano-intera.png', 2048, LIMITE);
anteprima('cerano-centro.png', 2048, 520, 0, 0);
console.log(`anteprime in ${ANTEPRIME}`);
