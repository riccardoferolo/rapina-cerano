import * as THREE from 'three';
import { creaCostruttore, quad, muro, poligonoOrizzontale, BIANCO, tettoAFalde, tettoPiano } from './citta3d.js';
import { apertureSuSpigolo } from '../gioco/luoghi.js';
import { baricentro } from '../citta/geometria.js';
import { CAMPATA, PIANO, PIANO_TERRA } from './facciate.js';
import { superficieIntonaco } from './superfici.js';
import { creaCaso } from './caso-grafica.js';

const ALTO_PORTA = 2.2;
export const BASE_INTERNI = 0.17;
const SPESSORE_MURO = 0.12;
const SPORTO = 0.45;
const PENDENZA = Math.tan((27 * Math.PI) / 180);
const COLORI_PRODOTTI = [0xc8102e, 0xf2f2f2, 0x1d3f8f, 0xd4af37, 0x111111, 0x2e7d32, 0xe57c23, 0x6d2b8f];

function caricaTexture(caricatore, nome, ripeti = 1, colore = true) {
  const t = caricatore.load(`./texture/${nome}.jpg`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = colore ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.repeat.set(ripeti, ripeti);
  return t;
}

function texturaInsegna(testo, sfondo = '#0d2f6e', colore = '#ffffff', tabacchi = true) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = sfondo;
  ctx.fillRect(0, 0, 1024, 128);
  ctx.fillStyle = colore;
  ctx.font = 'bold 82px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(testo, tabacchi ? 560 : 512, 68, tabacchi ? 860 : 960);
  if (tabacchi) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(18, 14, 100, 100);
    ctx.fillStyle = sfondo;
    ctx.font = 'bold 92px Georgia, serif';
    ctx.fillText('T', 68, 68);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function texturaBiglietto(codice) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 192;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f4f0e2';
  ctx.fillRect(0, 0, 256, 192);
  ctx.strokeStyle = 'rgba(80,110,170,0.4)';
  for (let y = 30; y < 192; y += 26) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  ctx.fillStyle = '#1f2a55';
  ctx.font = 'italic 30px "Segoe Print", "Comic Sans MS", cursive';
  ctx.fillText('cassaforte', 20, 60);
  ctx.font = 'bold 54px "Segoe Print", "Comic Sans MS", cursive';
  ctx.fillText(codice.split('').join(' '), 26, 140);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function creaMaterialiInterni() {
  const car = new THREE.TextureLoader();
  const intonaco = superficieIntonaco();
  return {
    piastrelle: new THREE.MeshStandardMaterial({ map: caricaTexture(car, 'piastrelle_diff'), normalMap: caricaTexture(car, 'piastrelle_nor', 1, false), roughness: 0.35 }),
    parquet: new THREE.MeshStandardMaterial({ map: caricaTexture(car, 'parquet_diff'), normalMap: caricaTexture(car, 'parquet_nor', 1, false), roughness: 0.6 }),
    cemento: new THREE.MeshStandardMaterial({ map: caricaTexture(car, 'cemento_diff'), color: 0xb0aca4, roughness: 0.9 }),
    soffitto: new THREE.MeshStandardMaterial({ map: caricaTexture(car, 'soffitto_diff'), color: 0xf2efe8, roughness: 0.95 }),
    muroInterno: new THREE.MeshStandardMaterial({ map: intonaco.map, normalMap: intonaco.normalMap, color: 0xefe6d2, roughness: 0.92 }),
    battiscopa: new THREE.MeshStandardMaterial({ color: 0x3b2b20, roughness: 0.6 }),
    legno: new THREE.MeshStandardMaterial({ map: caricaTexture(car, 'legno_diff'), roughness: 0.55 }),
    laminato: new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.35 }),
    porta: new THREE.MeshStandardMaterial({ map: caricaTexture(car, 'porta_diff'), roughness: 0.6 }),
    metallo: new THREE.MeshStandardMaterial({ map: caricaTexture(car, 'metallo_diff'), color: 0x9aa0a6, roughness: 0.4, metalness: 0.7 }),
    acciaio: new THREE.MeshStandardMaterial({ color: 0x4a4f55, roughness: 0.32, metalness: 0.85 }),
    nero: new THREE.MeshStandardMaterial({ color: 0x151618, roughness: 0.5, metalness: 0.3 }),
    vetro: new THREE.MeshPhysicalMaterial({ color: 0x9fb8c8, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
    prodotti: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }),
    cartone: new THREE.MeshStandardMaterial({ color: 0xa57c4f, roughness: 0.9 }),
    luce: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 2.2 }),
    rosso: new THREE.MeshStandardMaterial({ color: 0xc81e1e, emissive: 0x400000, roughness: 0.4 }),
    led: new THREE.MeshBasicMaterial({ color: 0xff2020 }),
    carta: new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.9 }),
    pietra: new THREE.MeshStandardMaterial({ map: caricaTexture(car, 'cemento_diff'), color: 0x8f8a80, roughness: 0.85 }),
  };
}

function strumenti(luogo, costruttore) {
  const P = (u, y, v) => {
    const [x, z] = luogo.mondo(u, v);
    return [x, y + BASE_INTERNI, z];
  };
  const N = (du, dv) => {
    const { c } = luogo;
    const x = c.ux * du + c.vx * dv;
    const z = c.uz * du + c.vz * dv;
    const l = Math.hypot(x, z) || 1;
    return [x / l, 0, z / l];
  };
  const parete = (mat, u0, v0, u1, v1, y0, y1, normale, uv = 1, colore = BIANCO, uInizio = 0, vDa = null) => {
    const l = Math.hypot(u1 - u0, v1 - v0);
    const a = uInizio / uv;
    const b = (uInizio + l) / uv;
    const va = vDa ? vDa(y0) : y0 / uv;
    const vb = vDa ? vDa(y1) : y1 / uv;
    quad(costruttore.buffer(mat), P(u0, y0, v0), P(u1, y0, v1), P(u1, y1, v1), P(u0, y1, v0), N(...normale), [[a, va], [b, va], [b, vb], [a, vb]], colore);
  };
  const piano = (mat, u0, v0, u1, v1, y, su = true, uv = 1) => {
    const pts = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    const mondo = pts.map(([u, v]) => luogo.mondo(u, v));
    const b = costruttore.buffer(mat);
    const n = su ? [0, 1, 0] : [0, -1, 0];
    const w = mondo.map(([x, z]) => [x, y + BASE_INTERNI, z]);
    quad(b, w[0], w[1], w[2], w[3], n, pts.map(([u, v]) => [u / uv, v / uv]));
  };
  const scatola = (mat, u0, v0, u1, v1, y0, y1, colore = BIANCO, uv = 1) => {
    parete(mat, u0, v0, u1, v0, y0, y1, [0, -1], uv, colore);
    parete(mat, u1, v1, u0, v1, y0, y1, [0, 1], uv, colore);
    parete(mat, u0, v1, u0, v0, y0, y1, [-1, 0], uv, colore);
    parete(mat, u1, v0, u1, v1, y0, y1, [1, 0], uv, colore);
    const b = costruttore.buffer(mat);
    const w = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => P(u, y1, v));
    quad(b, w[0], w[1], w[2], w[3], [0, 1, 0], [[0, 0], [(u1 - u0) / uv, 0], [(u1 - u0) / uv, (v1 - v0) / uv], [0, (v1 - v0) / uv]], colore);
  };
  return { P, N, parete, piano, scatola };
}

function aperture(def, lato, W, D) {
  const elenco = [];
  for (const p of def.pianta.porte) {
    if (!p.esterna) continue;
    const suLato = (lato === 'fronte' && p.v === 0) || (lato === 'retro' && p.v === D) || (lato === 'sinistra' && p.u === 0) || (lato === 'destra' && p.u === W);
    if (!suLato) continue;
    const s = lato === 'fronte' || lato === 'retro' ? p.u : p.v;
    elenco.push({ s0: s - p.largo / 2, s1: s + p.largo / 2, y0: 0, y1: ALTO_PORTA, porta: p });
  }
  if (lato === 'fronte') for (const v of def.pianta.vetrine ?? []) elenco.push({ s0: v.u0, s1: v.u1, y0: v.da, y1: v.da + v.alta, vetrina: v });
  for (const f of def.pianta.finestre ?? []) if (f.lato === lato) elenco.push({ s0: f.u0, s1: f.u1, y0: f.da, y1: f.da + f.alta, finestra: f });
  return elenco.sort((a, b) => a.s0 - b.s0);
}

function muroConAperture(t, mat, lato, a, b, normale, y0, y1, buchi, uvOpz) {
  const [u0, v0] = a;
  const [u1, v1] = b;
  const l = Math.hypot(u1 - u0, v1 - v0);
  const punto = s => [u0 + ((u1 - u0) * s) / l, v0 + ((v1 - v0) * s) / l];
  const tagli = [0, l];
  for (const h of buchi) tagli.push(Math.max(0, Math.min(l, h.s0)), Math.max(0, Math.min(l, h.s1)));
  const ordinati = [...new Set(tagli)].sort((x, y) => x - y);
  for (let i = 1; i < ordinati.length; i++) {
    const s0 = ordinati[i - 1];
    const s1 = ordinati[i];
    if (s1 - s0 < 1e-3) continue;
    const meta = (s0 + s1) / 2;
    const buco = buchi.find(h => meta > h.s0 && meta < h.s1);
    const [pa, qa] = punto(s0);
    const [pb, qb] = punto(s1);
    const pezzi = buco ? [[y0, Math.max(y0, buco.y0)], [Math.min(y1, buco.y1), y1]] : [[y0, y1]];
    for (const [ya, yb] of pezzi) if (yb - ya > 0.01) t.parete(mat, pa, qa, pb, qb, ya, yb, normale, uvOpz.uv, uvOpz.colore, s0, uvOpz.vDa);
  }
}

export function costruisciLuogo(scena, luogo, matCitta, mat) {
  const gruppo = new THREE.Group();
  scena.add(gruppo);
  const statico = creaCostruttore();
  const t = strumenti(luogo, statico);
  const { def, c } = luogo;
  const W = luogo.W;
  const D = luogo.D;
  const Wr = c.latoReale / luogo.su;
  const h = Math.max(c.altezza, PIANO_TERRA + 3);
  const colore = new THREE.Color(c.edificio.cm);
  const cMuro = [colore.r, colore.g, colore.b];
  const tetto = new THREE.Color(c.edificio.ct);
  const cTetto = [tetto.r, tetto.g, tetto.b];
  const RE = matCitta.rettangoliEdifici;
  const atl = rett => ({ reale: matCitta.edifici, rett });
  const poli = c.edificio.p;
  const fintoLotti = { buffer: (x, z, v) => statico.buffer(v) };
  const matTetto = { tegole: atl(RE.tegole), gronda: atl(RE.gronda), intonaco: atl(RE.intonaco), tettoPiano: atl(RE.tettoPiano) };
  let uMuro = 0;
  for (let i = 0; i < poli.length; i++) {
    const a = poli[i];
    const b = poli[(i + 1) % poli.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < 0.05) continue;
    const ux = (b[0] - a[0]) / l;
    const uz = (b[1] - a[1]) / l;
    const buchi = apertureSuSpigolo(luogo, a, b);
    const tagli = [...new Set([0, l, ...buchi.flatMap(x => [x.s0, x.s1])])].sort((p, q) => p - q);
    for (let k = 1; k < tagli.length; k++) {
      const s0 = tagli[k - 1];
      const s1 = tagli[k];
      if (s1 - s0 < 1e-3) continue;
      const meta = (s0 + s1) / 2;
      const buco = buchi.find(x => meta > x.s0 && meta < x.s1);
      const ax = a[0] + ux * s0;
      const az = a[1] + uz * s0;
      const bx = a[0] + ux * s1;
      const bz = a[1] + uz * s1;
      const pezzi = buco ? [[0, buco.y0], [buco.y1, PIANO_TERRA]] : [[0, PIANO_TERRA]];
      for (const [y0, y1] of pezzi) {
        if (y1 - y0 < 0.01) continue;
        if (y0 < 0.55) muro(statico.buffer(mat.pietra), ax, az, bx, bz, y0, Math.min(0.55, y1), uMuro + s0, 1.5, y => y / 1.5, BIANCO);
        if (y1 > 0.55) muro(statico.buffer(atl(RE.intonaco)), ax, az, bx, bz, Math.max(0.55, y0), y1, uMuro + s0, 4, y => y / 4, cMuro);
      }
    }
    muro(statico.buffer(atl(RE.piani)), a[0], a[1], b[0], b[1], PIANO_TERRA, h, uMuro, CAMPATA * 4, y => (y - PIANO_TERRA) / (PIANO * 4), cMuro);
    muro(statico.buffer(mat.pietra), a[0], a[1], b[0], b[1], PIANO_TERRA - 0.06, PIANO_TERRA + 0.12, uMuro, 1.5, y => y / 1.5, BIANCO);
    uMuro += l;
  }
  const [cx, cz] = baricentro(poli);
  const edificioTetto = { ...c.edificio, h };
  if (c.edificio.t !== 'falde' || !tettoAFalde(fintoLotti, edificioTetto, cx, cz, h, cTetto, cMuro, null, matTetto)) tettoPiano(fintoLotti, edificioTetto, cx, cz, h, cTetto, cMuro, matTetto, true);

  const alto = def.pianta.altezza;
  for (const s of luogo.stanze) {
    t.piano(mat[s.pavimento] ?? mat.piastrelle, s.u0, s.v0, s.u1, s.v1, 0.02, true, s.pavimento === 'piastrelle' ? 1.2 : 2);
    t.piano(mat.soffitto, s.u0, s.v0, s.u1, s.v1, alto, false, 2);
    for (const [u, v] of s.luci ?? []) t.scatola(mat.luce, u - 0.6, v - 0.15, u + 0.6, v + 0.15, alto - 0.05, alto - 0.01);
  }
  t.piano(mat.soffitto, 0, 0, W, D, PIANO_TERRA - 0.08, false, 2);
  for (const m of luogo.muri) {
    const [u0, v0, u1, v1] = m.m;
    const l = Math.hypot(u1 - u0, v1 - v0);
    const du = (u1 - u0) / l;
    const dv = (v1 - v0) / l;
    const nu = dv;
    const nv = -du;
    const buchi = m.buchi.map(b => {
      const s0 = (b.da[0] - u0) * du + (b.da[1] - v0) * dv;
      const s1 = (b.a[0] - u0) * du + (b.a[1] - v0) * dv;
      return { s0: Math.min(s0, s1), s1: Math.max(s0, s1), y0: 0, y1: ALTO_PORTA };
    });
    if (m.esterno) {
      const lato = v0 === 0 && v1 === 0 ? 'fronte' : v0 === D && v1 === D ? 'retro' : null;
      for (const h0 of lato ? aperture(def, lato, W, D) : []) {
        if (h0.porta) continue;
        const a0 = (h0.s0 - u0) * du;
        const a1 = (h0.s1 - u0) * du;
        buchi.push({ s0: Math.min(a0, a1), s1: Math.max(a0, a1), y0: h0.y0, y1: h0.y1 });
      }
    }
    const facce = m.esterno ? [[1, -1]] : [[SPESSORE_MURO / 2, 1], [-SPESSORE_MURO / 2, -1]];
    for (const [off, verso] of facce) {
      const spost = m.esterno ? 0.02 : off;
      const centro = [(u0 + u1) / 2, (v0 + v1) / 2];
      const dentroVerso = m.esterno ? [centro[0] + nu * 0.5, centro[1] + nv * 0.5] : null;
      let segno = verso;
      if (m.esterno) segno = dentroVerso[0] > 0 && dentroVerso[0] < W && dentroVerso[1] > 0 && dentroVerso[1] < D ? 1 : -1;
      const a = [u0 + nu * spost * (m.esterno ? segno : 1), v0 + nv * spost * (m.esterno ? segno : 1)];
      const b = [u1 + nu * spost * (m.esterno ? segno : 1), v1 + nv * spost * (m.esterno ? segno : 1)];
      muroConAperture(t, mat.muroInterno, 'interno', a, b, [nu * segno, nv * segno], 0, alto, buchi, { uv: 2.5 });
      muroConAperture(t, mat.battiscopa, 'interno', [a[0] + nu * segno * 0.008, a[1] + nv * segno * 0.008], [b[0] + nu * segno * 0.008, b[1] + nv * segno * 0.008], [nu * segno, nv * segno], 0, 0.09, buchi, { uv: 1 });
    }
  }
  const caso = creaCaso(7);
  for (const a of luogo.arredi) arredo(t, mat, a, caso);
  for (const v of def.pianta.vetrine ?? []) {
    const n = [0, -1];
    t.parete(mat.vetro, v.u0, 0.03, v.u1, 0.03, v.da, v.da + v.alta, n, 2);
    for (const u of [v.u0, (v.u0 + v.u1) / 2, v.u1]) t.scatola(mat.nero, u - 0.04, -0.02, u + 0.04, 0.08, v.da, v.da + v.alta);
    t.scatola(mat.nero, v.u0, -0.02, v.u1, 0.08, v.da - 0.06, v.da);
    t.scatola(mat.nero, v.u0, -0.02, v.u1, 0.08, v.da + v.alta, v.da + v.alta + 0.06);
  }
  for (const f of def.pianta.finestre ?? []) {
    const v = f.lato === 'retro' ? D : 0;
    t.parete(mat.vetro, f.u0, v - 0.05, f.u1, v - 0.05, f.da, f.da + f.alta, [0, 1], 2);
    if (f.grata) for (let u = f.u0 + 0.1; u < f.u1; u += 0.14) t.scatola(mat.nero, u - 0.012, v + 0.02, u + 0.012, v + 0.05, f.da, f.da + f.alta);
  }
  statico.finisci(gruppo);
  if (def.insegna) {
    const vet = def.pianta.vetrine?.[0];
    const u0 = Math.min(vet?.u0 ?? 1, 1);
    const u1 = vet?.u1 ?? W - 1;
    const insegna = new THREE.Mesh(new THREE.PlaneGeometry(u1 - u0, 0.62), new THREE.MeshStandardMaterial({ map: texturaInsegna(def.insegna.testo, def.insegna.colore ?? '#0d2f6e', def.insegna.tipo === 'oreficeria' ? '#e8c46a' : '#ffffff', def.insegna.tipo === 'tabacchi'), emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0.0, roughness: 0.4 }));
    insegna.material.emissiveMap = insegna.material.map;
    const [x, z] = luogo.mondo((u0 + u1) / 2, -0.07);
    insegna.position.set(x, PIANO_TERRA - 0.45, z);
    insegna.rotation.y = luogo.versoMondo(Math.PI) + Math.PI;
    gruppo.add(insegna);
    gruppo.userData.insegna = insegna;
  }
  const luci = luogo.stanze.flatMap(s => (s.luci ?? []).map(([u, v]) => {
    const [x, z] = luogo.mondo(u, v);
    return { x, y: alto - 0.3, z, dentro: true, luogo: def.id };
  }));
  return { gruppo, luci, mat };
}

function arredo(t, mat, a, caso) {
  const { u0, v0, u1, v1, alto } = a;
  switch (a.tipo) {
    case 'bancone':
      t.scatola(mat.legno, u0 + 0.05, v0 + 0.05, u1 - 0.05, v1 - 0.05, 0, alto - 0.04, BIANCO, 1.2);
      t.scatola(mat.laminato, u0 - 0.04, v0 - 0.04, u1 + 0.04, v1 + 0.04, alto - 0.04, alto);
      break;
    case 'scaffale': {
      const ripiani = 5;
      t.scatola(mat.legno, u0, v0, u0 + 0.03, v1, 0, alto);
      t.scatola(mat.legno, u1 - 0.03, v0, u1, v1, 0, alto);
      const lungoU = u1 - u0 > v1 - v0;
      for (let i = 0; i < ripiani; i++) {
        const y = 0.1 + (i * (alto - 0.2)) / (ripiani - 1);
        t.scatola(mat.legno, u0, v0, u1, v1, y, y + 0.025);
        if (i === ripiani - 1) continue;
        const sopra = (alto - 0.2) / (ripiani - 1) - 0.06;
        const lungo = lungoU ? u1 - u0 : v1 - v0;
        for (let s = 0.05; s < lungo - 0.12; s += 0.09 + caso() * 0.05) {
          const hh = Math.min(sopra, 0.12 + caso() * 0.22);
          const col = new THREE.Color(a.merce === 'scatoloni' ? 0xa57c4f : COLORI_PRODOTTI[Math.floor(caso() * COLORI_PRODOTTI.length)]);
          const c = [col.r, col.g, col.b];
          const w = 0.06 + caso() * 0.03;
          if (lungoU) t.scatola(mat.prodotti, u0 + s, v0 + 0.05, u0 + s + w, v1 - 0.05, y + 0.025, y + 0.025 + hh, c);
          else t.scatola(mat.prodotti, u0 + 0.05, v0 + s, u1 - 0.05, v0 + s + w, y + 0.025, y + 0.025 + hh, c);
        }
      }
      break;
    }
    case 'espositore':
      t.scatola(mat.legno, u0, v0, u1, v1, 0, alto * 0.65);
      for (let s = 0; s < 6; s++) {
        const col = new THREE.Color(COLORI_PRODOTTI[Math.floor(caso() * COLORI_PRODOTTI.length)]);
        const lungoU = u1 - u0 > v1 - v0;
        const passo = ((lungoU ? u1 - u0 : v1 - v0) - 0.1) / 6;
        if (lungoU) t.scatola(mat.prodotti, u0 + 0.05 + s * passo, v0 + 0.05, u0 + 0.05 + (s + 0.9) * passo, v1 - 0.05, alto * 0.65, alto * 0.65 + 0.03 + caso() * 0.2, [col.r, col.g, col.b]);
        else t.scatola(mat.prodotti, u0 + 0.05, v0 + 0.05 + s * passo, u1 - 0.05, v0 + 0.05 + (s + 0.9) * passo, alto * 0.65, alto * 0.65 + 0.03 + caso() * 0.2, [col.r, col.g, col.b]);
      }
      break;
    case 'scrivania':
      t.scatola(mat.legno, u0, v0, u1, v1, alto - 0.04, alto);
      for (const [u, v] of [[u0 + 0.05, v0 + 0.05], [u1 - 0.09, v0 + 0.05], [u0 + 0.05, v1 - 0.09], [u1 - 0.09, v1 - 0.09]]) t.scatola(mat.acciaio, u, v, u + 0.04, v + 0.04, 0, alto - 0.04);
      t.scatola(mat.nero, (u0 + u1) / 2 - 0.25, v1 - 0.25, (u0 + u1) / 2 + 0.25, v1 - 0.2, alto + 0.1, alto + 0.42);
      t.scatola(mat.nero, (u0 + u1) / 2 - 0.04, v1 - 0.24, (u0 + u1) / 2 + 0.04, v1 - 0.2, alto, alto + 0.1);
      t.scatola(mat.nero, (u0 + u1) / 2 - 0.22, v0 + 0.25, (u0 + u1) / 2 + 0.22, v0 + 0.4, alto, alto + 0.02);
      break;
    case 'armadio':
      t.scatola(mat.metallo, u0, v0, u1, v1, 0, alto, BIANCO, 2);
      break;
    case 'bancale':
      t.scatola(mat.legno, u0, v0, u1, v1, 0, 0.14);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) {
        const du = (u1 - u0) / 2;
        const dv = (v1 - v0) / 2;
        t.scatola(mat.cartone, u0 + i * du + 0.02, v0 + j * dv + 0.02, u0 + (i + 1) * du - 0.02, v0 + (j + 1) * dv - 0.02, 0.14 + k * 0.42, 0.54 + k * 0.42);
      }
      break;
    default:
      t.scatola(mat.legno, u0, v0, u1, v1, 0, alto);
  }
}

export function creaDinamicheLuogo(scena, luogo, set, mat) {
  const gruppo = new THREE.Group();
  gruppo.position.y = luogo.interni ? BASE_INTERNI : 0;
  scena.add(gruppo);
  const porte = new Map();
  for (const d of luogo.porte) {
    if (!d.mondo) continue;
    const [ax, az] = d.mondo.da;
    const [bx, bz] = d.mondo.a;
    const largo = Math.hypot(bx - ax, bz - az);
    const perno = new THREE.Group();
    perno.position.set(ax, 0, az);
    perno.rotation.y = Math.atan2(-(bx - ax), -(bz - az)) + Math.PI / 2;
    const materiale = d.tipo === 'vetro' ? mat.vetro : d.tipo === 'metallo' ? mat.metallo : mat.porta;
    const anta = new THREE.Mesh(new THREE.BoxGeometry(largo - 0.02, ALTO_PORTA - 0.02, d.tipo === 'vetro' ? 0.02 : 0.05), materiale);
    anta.position.set((largo - 0.02) / 2, ALTO_PORTA / 2, 0);
    anta.castShadow = d.tipo !== 'vetro';
    perno.add(anta);
    if (d.tipo === 'vetro') {
      const telaio = new THREE.Mesh(new THREE.BoxGeometry(largo, 0.1, 0.06), mat.nero);
      telaio.position.set(largo / 2, 0.05, 0);
      const telaioSu = telaio.clone();
      telaioSu.position.y = ALTO_PORTA - 0.05;
      perno.add(telaio, telaioSu);
    }
    const maniglia = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.06), mat.acciaio);
    maniglia.position.set(largo - 0.12, 1.02, 0.05);
    perno.add(maniglia);
    if (d.cartello) {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 96;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#f2f0ea';
      ctx.fillRect(0, 0, 256, 96);
      ctx.fillStyle = '#b01818';
      ctx.font = 'bold 54px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(d.cartello, 128, 68);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const cart = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.15), new THREE.MeshStandardMaterial({ map: tex }));
      cart.position.set(largo / 2, 1.6, -0.03);
      cart.rotation.y = Math.PI;
      perno.add(cart);
    }
    gruppo.add(perno);
    porte.set(d.id, { perno, angolo: 0, base: perno.rotation.y });
  }
  for (const o of set.oggetti ?? []) {
    const g = new THREE.Group();
    g.position.set(o.x, 0, o.z);
    g.rotation.y = o.yaw ?? 0;
    const armadio = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.38), new THREE.MeshStandardMaterial({ color: 0x8c9294, roughness: 0.6, metalness: 0.3 }));
    armadio.position.y = 0.65;
    armadio.castShadow = true;
    const targa = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.12), mat.carta);
    targa.position.set(0, 1.0, -0.195);
    targa.rotation.y = Math.PI;
    g.add(armadio, targa);
    gruppo.add(g);
  }
  const casseforti = set.casseforti.map(cf => {
    const g = new THREE.Group();
    g.visible = !cf.suVeicolo;
    g.position.set(cf.x, 0, cf.z);
    g.rotation.y = cf.yaw;
    const corpo = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.9, 0.62), mat.acciaio);
    corpo.position.set(0, 0.45, 0);
    corpo.castShadow = true;
    const anta = new THREE.Group();
    anta.position.set(-0.36, 0.45, -0.31);
    const pannello = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.84, 0.06), mat.acciaio);
    pannello.position.set(0.33, 0, -0.03);
    const manopola = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 20).rotateX(Math.PI / 2), mat.nero);
    manopola.position.set(0.33, 0.1, -0.08);
    const leva = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.04), mat.metallo);
    leva.position.set(0.33, -0.15, -0.08);
    anta.add(pannello, manopola, leva);
    const trapano = new THREE.Group();
    const corpoTrapano = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.45), new THREE.MeshStandardMaterial({ color: 0xd9a400, roughness: 0.5 }));
    corpoTrapano.position.set(0, 0.55, -0.6);
    const punta = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8).rotateX(Math.PI / 2), mat.acciaio);
    punta.position.set(0, 0.55, -0.32);
    const supporto = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.06), mat.nero);
    supporto.position.set(0, 0.45, -0.75);
    trapano.add(corpoTrapano, punta, supporto);
    trapano.visible = false;
    const interno = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.78, 0.04), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
    interno.position.set(0, 0.45, -0.2);
    g.add(corpo, anta, trapano, interno);
    gruppo.add(g);
    return { anta, trapano, punta };
  });
  const biglietti = set.biglietti.map((b, i) => {
    const cf = set.casseforti.find(c => c.id === b.per);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.12).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: texturaBiglietto(cf?.codice ?? '0000'), roughness: 0.9 }));
    m.position.set(b.x, b.y + 0.004, b.z);
    m.rotation.y = i * 0.7;
    gruppo.add(m);
    return m;
  });
  const telecamere = set.telecamere.map(tc => {
    const g = new THREE.Group();
    g.position.set(tc.x, tc.y, tc.z);
    const staffa = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.25, 0.05), mat.nero);
    staffa.position.y = 0.12;
    const testa = new THREE.Group();
    const corpo = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.3), new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: 0.4 }));
    corpo.position.z = -0.12;
    const obiettivo = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.04, 14).rotateX(Math.PI / 2), mat.nero);
    obiettivo.position.z = -0.28;
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), mat.led.clone());
    led.position.set(0.04, 0.04, -0.27);
    testa.add(corpo, obiettivo, led);
    testa.rotation.x = -0.35;
    g.add(staffa, testa);
    gruppo.add(g);
    return { g, led, testa };
  });
  const casse = set.casse.map(cs => {
    const g = new THREE.Group();
    g.position.set(cs.x, 1.05, cs.z);
    g.rotation.y = cs.yaw;
    const corpo = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.42), mat.nero);
    corpo.position.y = 0.06;
    const schermo = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.03), new THREE.MeshStandardMaterial({ color: 0x0c1a10, emissive: 0x2a8f4a, emissiveIntensity: 0.6 }));
    schermo.position.set(0, 0.24, 0.12);
    schermo.rotation.x = -0.3;
    const cassetto = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.4), mat.acciaio);
    cassetto.position.set(0, -0.04, 0);
    g.add(corpo, schermo, cassetto);
    gruppo.add(g);
    return { cassetto };
  });
  for (const p of set.pulsanti) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.03), mat.rosso);
    m.position.set(p.x, 0.85, p.z);
    gruppo.add(m);
  }
  return {
    gruppo,
    aggiorna(vista, dt, tempo) {
      for (const [id, porta] of porte) {
        const stato = vista.porte?.[id];
        const voluto = stato?.aperta ? 1.6 : 0;
        porta.angolo += (voluto - porta.angolo) * Math.min(1, dt * 6);
        porta.perno.rotation.y = porta.base + porta.angolo;
      }
      casseforti.forEach((c, i) => {
        const s = vista.casseforti?.[i];
        if (!s) return;
        const voluto = s.stato === 'aperta' ? -1.9 : 0;
        c.anta.rotation.y += (voluto - c.anta.rotation.y) * Math.min(1, dt * 2);
        c.trapano.visible = s.stato === 'trapano';
        if (c.trapano.visible && !s.inceppato) c.punta.rotation.z += dt * 40;
      });
      telecamere.forEach((t, i) => {
        const s = vista.telecamere?.[i];
        if (!s) return;
        t.g.rotation.y = s.yaw;
        t.led.visible = s.stato === 'attiva' ? Math.sin(tempo * 6) > 0 : s.stato === 'loop';
        t.led.material.color.setHex(s.stato === 'loop' ? 0x20ff60 : 0xff2020);
        t.testa.rotation.z = s.stato === 'rotta' ? 0.9 : 0;
      });
      casse.forEach((c, i) => {
        const piena = vista.casse?.[i] ?? true;
        c.cassetto.position.z += ((piena ? 0 : -0.3) - c.cassetto.position.z) * Math.min(1, dt * 5);
      });
      biglietti.forEach((b, i) => {
        b.visible = true;
        b.material.emissive?.setHex?.(vista.biglietti?.[i] ? 0x000000 : 0x1a1a10);
      });
    },
    chiudi() {
      scena.remove(gruppo);
      gruppo.traverse(o => {
        if (o.isMesh) o.geometry.dispose();
      });
    },
  };
}

export { poligonoOrizzontale };
