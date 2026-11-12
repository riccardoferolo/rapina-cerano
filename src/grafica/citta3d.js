import * as THREE from 'three';
import { rientra, areaFirmata, larghezzaMinima, baricentro, hashNumero, dentro, campionaLinea } from '../citta/geometria.js';
import { lineaSpostata, puntoA, ALTEZZA_MARCIAPIEDE } from '../citta/viabilita.js';
import { CAMPATA, PIANO, PIANO_TERRA } from './facciate.js';

export const LATO_CELLA = 320;
const OMBRE_ENTRO = 150;
const Y_ASFALTO = 0.03;
const Y_STERRATO = 0.022;
const Y_PORFIDO = 0.04;
const Y_STRISCE = 0.036;
const SPORTO_GRONDA = 0.45;
const PENDENZA = Math.tan((27 * Math.PI) / 180);
const LARGO_CORDOLO = 0.16;
const UV_ASFALTO = 5;
const UV_MARCIAPIEDE = 1.6;
const UV_PORFIDO = 3;
const UV_TEGOLE = 2.4;
const PARAPETTO = 0.7;
const MAX_RIENTRO = 4.2;

const colore = new THREE.Color();
const lineare = hex => {
  colore.setHex(hex);
  return [colore.r, colore.g, colore.b];
};

function creaLotti() {
  const celle = new Map();
  const chiave = (i, j) => `${i}|${j}`;
  function buffer(x, z, virtuale) {
    const reale = virtuale.reale ?? virtuale;
    const i = Math.floor(x / LATO_CELLA);
    const j = Math.floor(z / LATO_CELLA);
    const k = chiave(i, j);
    let cella = celle.get(k);
    if (!cella) {
      cella = { i, j, materiali: new Map() };
      celle.set(k, cella);
    }
    let b = cella.materiali.get(reale);
    if (!b) {
      b = { p: [], n: [], u: [], c: [], a: [] };
      cella.materiali.set(reale, b);
    }
    return virtuale.rett ? { p: b.p, n: b.n, u: b.u, c: b.c, a: b.a, r: virtuale.rett } : b;
  }
  return { celle, buffer };
}

function vertice(b, x, y, z, nx, ny, nz, u, v, c) {
  b.p.push(x, y, z);
  b.n.push(nx, ny, nz);
  b.u.push(u, v);
  b.c.push(c[0], c[1], c[2]);
  if (b.r) b.a.push(b.r[0], b.r[1], b.r[2], b.r[3]);
}

const BIANCO = [1, 1, 1];

function quad(b, a, bb, cc, d, n, uv, c = BIANCO) {
  const ux = bb[0] - a[0];
  const uy = bb[1] - a[1];
  const uz = bb[2] - a[2];
  const vx = cc[0] - a[0];
  const vy = cc[1] - a[1];
  const vz = cc[2] - a[2];
  const wx = uy * vz - uz * vy;
  const wy = uz * vx - ux * vz;
  const wz = ux * vy - uy * vx;
  if (wx * n[0] + wy * n[1] + wz * n[2] < 0) {
    vertice(b, ...a, ...n, ...uv[0], c);
    vertice(b, ...cc, ...n, ...uv[2], c);
    vertice(b, ...bb, ...n, ...uv[1], c);
    vertice(b, ...a, ...n, ...uv[0], c);
    vertice(b, ...d, ...n, ...uv[3], c);
    vertice(b, ...cc, ...n, ...uv[2], c);
    return;
  }
  vertice(b, ...a, ...n, ...uv[0], c);
  vertice(b, ...bb, ...n, ...uv[1], c);
  vertice(b, ...cc, ...n, ...uv[2], c);
  vertice(b, ...a, ...n, ...uv[0], c);
  vertice(b, ...cc, ...n, ...uv[2], c);
  vertice(b, ...d, ...n, ...uv[3], c);
}

function triangoloNormale(b, a, bb, cc, uv, c = BIANCO) {
  const ux = bb[0] - a[0];
  const uy = bb[1] - a[1];
  const uz = bb[2] - a[2];
  const vx = cc[0] - a[0];
  const vy = cc[1] - a[1];
  const vz = cc[2] - a[2];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l;
  ny /= l;
  nz /= l;
  if (ny < 0) {
    vertice(b, ...a, -nx, -ny, -nz, ...uv[0], c);
    vertice(b, ...cc, -nx, -ny, -nz, ...uv[2], c);
    vertice(b, ...bb, -nx, -ny, -nz, ...uv[1], c);
    return;
  }
  vertice(b, ...a, nx, ny, nz, ...uv[0], c);
  vertice(b, ...bb, nx, ny, nz, ...uv[1], c);
  vertice(b, ...cc, nx, ny, nz, ...uv[2], c);
}

function muro(b, ax, az, bx, bz, y0, y1, uInizio, uMetri, vDa, c) {
  const l = Math.hypot(bx - ax, bz - az);
  if (l < 0.05 || y1 - y0 < 0.02) return;
  const nx = (bz - az) / l;
  const nz = -(bx - ax) / l;
  const u0 = uInizio / uMetri;
  const u1 = (uInizio + l) / uMetri;
  const v0 = vDa(y0) + 0.002;
  const v1 = vDa(y1) - 0.002;
  quad(b, [ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], [nx, 0, nz], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], c);
}

function poligonoOrizzontale(b, anello, y, uvScala, c = BIANCO, giu = false) {
  const contorno = anello.map(([x, z]) => new THREE.Vector2(x, z));
  const tris = THREE.ShapeUtils.triangulateShape(contorno, []);
  const verso = giu ? -1 : 1;
  for (const [i, j, k] of tris) {
    const pts = [anello[i], anello[j], anello[k]];
    const ny = (pts[1][1] - pts[0][1]) * (pts[2][0] - pts[0][0]) - (pts[1][0] - pts[0][0]) * (pts[2][1] - pts[0][1]);
    const giusti = ny * verso >= 0 ? pts : [pts[0], pts[2], pts[1]];
    for (const [x, z] of giusti) vertice(b, x, y, z, 0, verso, 0, x / uvScala, -z / uvScala, c);
  }
}

function anelloValido(esterno, interno) {
  if (areaFirmata(interno) <= 0.5) return false;
  for (let i = 0; i < esterno.length; i++) {
    const a = esterno[i];
    const b = esterno[(i + 1) % esterno.length];
    const c = interno[i];
    const d = interno[(i + 1) % interno.length];
    if ((b[0] - a[0]) * (d[0] - c[0]) + (b[1] - a[1]) * (d[1] - c[1]) <= 0) return false;
  }
  return true;
}

function tettoAFalde(lotti, e, cx, cz, h, cTetto, cMuro, materiali, mat) {
  const fuori = rientra(e.p, -SPORTO_GRONDA);
  const { largo } = larghezzaMinima(e.p);
  let d = Math.min(MAX_RIENTRO, largo * 0.49);
  let dentroAnello = null;
  while (d > 0.5) {
    const prova = rientra(e.p, d);
    if (anelloValido(e.p, prova)) {
      dentroAnello = prova;
      break;
    }
    d *= 0.7;
  }
  if (!dentroAnello) return false;
  const salita = (d + SPORTO_GRONDA) * PENDENZA;
  const bt = lotti.buffer(cx, cz, mat.tegole);
  const bg = lotti.buffer(cx, cz, mat.gronda);
  const n = e.p.length;
  for (let i = 0; i < n; i++) {
    const k = (i + 1) % n;
    const o0 = fuori[i];
    const o1 = fuori[k];
    const i0 = dentroAnello[i];
    const i1 = dentroAnello[k];
    const lato = Math.hypot(o1[0] - o0[0], o1[1] - o0[1]);
    const ex = (o1[0] - o0[0]) / (lato || 1);
    const ez = (o1[1] - o0[1]) / (lato || 1);
    const proietta = p => ((p[0] - o0[0]) * ex + (p[1] - o0[1]) * ez) / UV_TEGOLE;
    const falda = Math.hypot(d + SPORTO_GRONDA, salita) / UV_TEGOLE;
    triangoloNormale(bt, [o0[0], h, o0[1]], [i1[0], h + salita, i1[1]], [o1[0], h, o1[1]], [[0, 0], [proietta(i1), falda], [lato / UV_TEGOLE, 0]], cTetto);
    triangoloNormale(bt, [o0[0], h, o0[1]], [i0[0], h + salita, i0[1]], [i1[0], h + salita, i1[1]], [[0, 0], [proietta(i0), falda], [proietta(i1), falda]], cTetto);
    const p0 = e.p[i];
    const p1 = e.p[k];
    quad(bg, [p0[0], h, p0[1]], [o0[0], h, o0[1]], [o1[0], h, o1[1]], [p1[0], h, p1[1]], [0, -1, 0], [[0, 0], [0, 0], [0, 0], [0, 0]]);
    const ln = Math.hypot(o1[0] - o0[0], o1[1] - o0[1]) || 1;
    quad(bg, [o0[0], h - 0.16, o0[1]], [o1[0], h - 0.16, o1[1]], [o1[0], h + 0.02, o1[1]], [o0[0], h + 0.02, o0[1]], [(o1[1] - o0[1]) / ln, 0, -(o1[0] - o0[0]) / ln], [[0, 0], [0, 0], [0, 0], [0, 0]]);
  }
  if (areaFirmata(dentroAnello) > 0.3) poligonoOrizzontale(bt, dentroAnello, h + salita, UV_TEGOLE, cTetto);
  const caso = hashNumero(typeof e.id === 'number' ? e.id : 77);
  if (['centro', 'villetta', 'condominio', 'cascina'].includes(e.u)) {
    const camini = caso < 0.5 ? 1 : 2;
    const bi = lotti.buffer(cx, cz, mat.intonaco);
    for (let k = 0; k < camini; k++) {
      const t = (k + 0.5) / camini;
      const a = dentroAnello[Math.floor(t * dentroAnello.length) % dentroAnello.length];
      const px = a[0] * 0.7 + cx * 0.3;
      const pz = a[1] * 0.7 + cz * 0.3;
      const top = h + salita + 0.9;
      const s = 0.32;
      const base = h + salita * 0.4;
      const facce = [[[px - s, pz - s], [px + s, pz - s]], [[px + s, pz - s], [px + s, pz + s]], [[px + s, pz + s], [px - s, pz + s]], [[px - s, pz + s], [px - s, pz - s]]];
      for (const [[ax, az], [bx, bz]] of facce) muro(bi, ax, az, bx, bz, base, top, 0, 1.4, y => y / 1.4, cMuro);
      const bc = lotti.buffer(cx, cz, mat.tegole);
      poligonoOrizzontale(bc, [[px - s - 0.08, pz - s - 0.08], [px + s + 0.08, pz - s - 0.08], [px + s + 0.08, pz + s + 0.08], [px - s - 0.08, pz + s + 0.08]], top + 0.12, 1, cTetto);
      for (const [[ax, az], [bx, bz]] of facce) muro(bc, ax + (ax - px) * 0.25, az + (az - pz) * 0.25, bx + (bx - px) * 0.25, bz + (bz - pz) * 0.25, top, top + 0.12, 0, 1, y => y, cTetto);
    }
  }
  return true;
}

function tettoPiano(lotti, e, cx, cz, h, cTetto, cMuro, mat, parapetto) {
  const bt = lotti.buffer(cx, cz, mat.tettoPiano);
  poligonoOrizzontale(bt, e.p, h + (parapetto ? 0.05 : 0), 3, cTetto);
  if (!parapetto) return;
  const interno = rientra(e.p, 0.25);
  const bi = lotti.buffer(cx, cz, mat.intonaco);
  let u = 0;
  for (let i = 0; i < e.p.length; i++) {
    const a = e.p[i];
    const b = e.p[(i + 1) % e.p.length];
    muro(bi, a[0], a[1], b[0], b[1], h, h + PARAPETTO, u, 3, y => y / 3, cMuro);
    const ia = interno[i];
    const ib = interno[(i + 1) % interno.length];
    muro(bi, ib[0], ib[1], ia[0], ia[1], h, h + PARAPETTO, u, 3, y => y / 3, cMuro);
    quad(bi, [a[0], h + PARAPETTO, a[1]], [b[0], h + PARAPETTO, b[1]], [ib[0], h + PARAPETTO, ib[1]], [ia[0], h + PARAPETTO, ia[1]], [0, 1, 0], [[0, 0], [1, 0], [1, 0.1], [0, 0.1]], cMuro);
    u += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
}

function edificio(lotti, e, mat, negozio) {
  const [cx, cz] = baricentro(e.p);
  const cMuro = lineare(e.cm);
  const cTetto = lineare(e.ct);
  const caso = hashNumero((typeof e.id === 'number' ? e.id : 99) * 7 + 3);
  const h = e.h;
  if (e.u === 'tettoia') {
    const bm = lotti.buffer(cx, cz, mat.metallo);
    for (const [x, z] of e.p) {
      for (const [ax, az, bx, bz] of [[-0.08, -0.08, 0.08, -0.08], [0.08, -0.08, 0.08, 0.08], [0.08, 0.08, -0.08, 0.08], [-0.08, 0.08, -0.08, -0.08]]) {
        muro(bm, x + ax, z + az, x + bx, z + bz, 0, h, 0, 1, y => y, BIANCO);
      }
    }
    const bt = lotti.buffer(cx, cz, mat.tettoPiano);
    poligonoOrizzontale(bt, e.p, h, 3, cTetto);
    poligonoOrizzontale(bt, e.p, h - 0.12, 3, cTetto, true);
    return;
  }
  const uOff = Math.floor(caso * 4) * CAMPATA;
  const vRiga = Math.floor(hashNumero((typeof e.id === 'number' ? e.id : 5) + 11) * 4) * 0.25;
  let u = uOff;
  const n = e.p.length;
  for (let i = 0; i < n; i++) {
    const a = e.p[i];
    const b = e.p[(i + 1) % n];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (e.m === 'intonaco') {
      const terra = Math.min(h, PIANO_TERRA);
      const conNegozi = negozio(e, a, b);
      const bt = lotti.buffer(cx, cz, conNegozi ? mat.terraNegozi : mat.terraCasa);
      muro(bt, a[0], a[1], b[0], b[1], 0, terra, u, CAMPATA * 4, y => y / PIANO_TERRA, cMuro);
      if (h > PIANO_TERRA + 0.3) {
        const bp = lotti.buffer(cx, cz, mat.piani);
        muro(bp, a[0], a[1], b[0], b[1], PIANO_TERRA, h, u, CAMPATA * 4, y => vRiga + (y - PIANO_TERRA) / (PIANO * 4), cMuro);
      }
    } else if (e.m === 'mattoni') {
      muro(lotti.buffer(cx, cz, mat.mattoni), a[0], a[1], b[0], b[1], 0, h, u, CAMPATA, y => y / PIANO, cMuro);
    } else if (e.m === 'chiesa') {
      muro(lotti.buffer(cx, cz, mat.chiesa), a[0], a[1], b[0], b[1], 0, h, u, 5.6, y => y / h, cMuro);
    } else {
      muro(lotti.buffer(cx, cz, mat.industriale), a[0], a[1], b[0], b[1], 0, h, u, 4, y => y / h, cMuro);
    }
    u += l;
  }
  const fatto = e.t === 'falde' && tettoAFalde(lotti, e, cx, cz, h, cTetto, cMuro, null, mat);
  if (!fatto) tettoPiano(lotti, e, cx, cz, h, cTetto, cMuro, mat, ['condominio', 'centro', 'pubblico', 'villetta', 'municipio'].includes(e.u));
  if (e.u === 'capannone' && caso < 0.7) {
    const bm = lotti.buffer(cx, cz, mat.metallo);
    for (let i = 0; i < n; i++) {
      const a = e.p[i];
      const b = e.p[(i + 1) % n];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (l < 9) continue;
      const t = 0.5;
      const mx = a[0] + (b[0] - a[0]) * t;
      const mz = a[1] + (b[1] - a[1]) * t;
      const ux = (b[0] - a[0]) / l;
      const uz = (b[1] - a[1]) / l;
      const nx = uz * 0.04;
      const nz = -ux * 0.04;
      muro(bm, mx - ux * 2 + nx, mz - uz * 2 + nz, mx + ux * 2 + nx, mz + uz * 2 + nz, 0, 4.2, 0, 0.3, y => y / 0.3, BIANCO);
      break;
    }
  }
}

function strisciaStrada(b, punti, cum, s0, s1, meta, y, uvScala, c = BIANCO) {
  const sx = lineaSpostata(punti, cum, s0, s1, meta);
  const dx = lineaSpostata(punti, cum, s0, s1, -meta);
  for (let i = 1; i < sx.length; i++) {
    quad(b, [dx[i - 1][0], y, dx[i - 1][1]], [dx[i][0], y, dx[i][1]], [sx[i][0], y, sx[i][1]], [sx[i - 1][0], y, sx[i - 1][1]], [0, 1, 0],
      [[dx[i - 1][0] / uvScala, -dx[i - 1][1] / uvScala], [dx[i][0] / uvScala, -dx[i][1] / uvScala], [sx[i][0] / uvScala, -sx[i][1] / uvScala], [sx[i - 1][0] / uvScala, -sx[i - 1][1] / uvScala]], c);
  }
}

function disco(b, x, z, r, y, uvScala, lati = 12) {
  for (let k = 0; k < lati; k++) {
    const a0 = (k / lati) * Math.PI * 2;
    const a1 = ((k + 1) / lati) * Math.PI * 2;
    const p0 = [x + Math.cos(a0) * r, z + Math.sin(a0) * r];
    const p1 = [x + Math.cos(a1) * r, z + Math.sin(a1) * r];
    const pts = [[x, z], p1, p0];
    for (const [px, pz] of pts) vertice(b, px, y, pz, 0, 1, 0, px / uvScala, -pz / uvScala, BIANCO);
  }
}

function fascia(b, sinistra, destra, y, uvScala) {
  for (let i = 1; i < sinistra.length; i++) {
    const a = destra[i - 1];
    const bb = destra[i];
    const c = sinistra[i];
    const d = sinistra[i - 1];
    quad(b, [a[0], y, a[1]], [bb[0], y, bb[1]], [c[0], y, c[1]], [d[0], y, d[1]], [0, 1, 0],
      [[a[0] / uvScala, -a[1] / uvScala], [bb[0] / uvScala, -bb[1] / uvScala], [c[0] / uvScala, -c[1] / uvScala], [d[0] / uvScala, -d[1] / uvScala]]);
  }
}

function bordoVerticale(b, linea, y0, y1, verso, uvScala = 1) {
  for (let i = 1; i < linea.length; i++) {
    const [ax, az] = linea[i - 1];
    const [bx, bz] = linea[i];
    const l = Math.hypot(bx - ax, bz - az);
    if (l < 1e-4) continue;
    let nx = (bz - az) / l;
    let nz = -(bx - ax) / l;
    if (verso < 0) {
      nx = -nx;
      nz = -nz;
    }
    const s0 = linea[i - 1][2] / uvScala;
    const s1 = linea[i][2] / uvScala;
    quad(b, [ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], [nx, 0, nz], [[s0, 0], [s1, 0], [s1, (y1 - y0) / uvScala], [s0, (y1 - y0) / uvScala]]);
  }
}

function strada(lotti, s, v, mat) {
  if (s.g) return;
  const [mx, mz] = s.p[Math.floor(s.p.length / 2)];
  const pedonale = s.pe || (!s.a && s.l >= 3 && !s.s);
  const materiale = pedonale ? mat.porfido : s.s ? mat.sterrato : mat.asfalto;
  const y = pedonale ? Y_PORFIDO : s.s ? Y_STERRATO : Y_ASFALTO;
  const uv = pedonale ? UV_PORFIDO : UV_ASFALTO;
  const pezzi = Math.max(1, Math.ceil(v.lungo / 60));
  for (let k = 0; k < pezzi; k++) {
    const s0 = (v.lungo * k) / pezzi;
    const s1 = (v.lungo * (k + 1)) / pezzi;
    const meta = (s0 + s1) / 2;
    let i = 1;
    while (i < v.cum.length - 1 && v.cum[i] < meta) i++;
    const b = lotti.buffer(s.p[i][0], s.p[i][1], materiale);
    strisciaStrada(b, s.p, v.cum, s0, s1, s.l / 2, y, uv);
  }
  if (s.a || pedonale) {
    for (const p of [s.p[0], s.p[s.p.length - 1]]) disco(lotti.buffer(p[0], p[1], materiale), p[0], p[1], s.l / 2, y - 0.002, uv);
  }
  if (s.b) {
    for (const verso of [1, -1]) {
      const linea = lineaSpostata(s.p, v.cum, 0, v.lungo, verso * (s.l / 2));
      const b = lotti.buffer(mx, mz, mat.argine);
      const esterna = lineaSpostata(s.p, v.cum, 0, v.lungo, verso * (s.l / 2 + 0.3));
      bordoVerticale(b, linea.map(p => p), Y_ASFALTO, 1.0, verso, 2);
      bordoVerticale(b, esterna, -0.4, 1.0, -verso, 2);
      fascia(b, esterna, lineaSpostata(s.p, v.cum, 0, v.lungo, verso * (s.l / 2)), 1.0, 2);
    }
  }
  [0, 1].forEach(lato => {
    const segno = lato === 0 ? 1 : -1;
    const m = s.m[lato];
    for (const [s0, s1] of v.pezzi[lato]) {
      const interno = lineaSpostata(s.p, v.cum, s0, s1, segno * (s.l / 2));
      const cordolo = lineaSpostata(s.p, v.cum, s0, s1, segno * (s.l / 2 + LARGO_CORDOLO));
      const esterno = lineaSpostata(s.p, v.cum, s0, s1, segno * (s.l / 2 + m));
      const centro = interno[Math.floor(interno.length / 2)];
      const bm = lotti.buffer(centro[0], centro[1], mat.marciapiede);
      const bc = lotti.buffer(centro[0], centro[1], mat.cordolo);
      if (segno > 0) {
        fascia(bm, esterno, cordolo, ALTEZZA_MARCIAPIEDE, UV_MARCIAPIEDE);
        fascia(bc, cordolo, interno, ALTEZZA_MARCIAPIEDE + 0.004, 0.6);
      } else {
        fascia(bm, cordolo, esterno, ALTEZZA_MARCIAPIEDE, UV_MARCIAPIEDE);
        fascia(bc, interno, cordolo, ALTEZZA_MARCIAPIEDE + 0.004, 0.6);
      }
      bordoVerticale(bc, interno, Y_ASFALTO - 0.01, ALTEZZA_MARCIAPIEDE + 0.004, segno, 0.6);
      bordoVerticale(bc, esterno, 0, ALTEZZA_MARCIAPIEDE, -segno, 0.6);
      for (const [p, q, verso, ss] of [[interno[0], esterno[0], -1, s0], [interno[interno.length - 1], esterno[esterno.length - 1], 1, s1]]) {
        const t = puntoA(s.p, v.cum, ss);
        quad(bc, [p[0], 0, p[1]], [q[0], 0, q[1]], [q[0], ALTEZZA_MARCIAPIEDE, q[1]], [p[0], ALTEZZA_MARCIAPIEDE, p[1]], [t.ux * verso, 0, t.uz * verso], [[0, 0], [1, 0], [1, 0.1], [0, 0.1]]);
      }
    }
  });
  if (!s.a || s.s || s.g) return;
  const bs = lotti.buffer(mx, mz, mat.strisce);
  const tratteggio = s.r >= 3 || (s.r === 2 && s.l >= 6.5 && !s.o);
  if (tratteggio) {
    for (let a = 2; a + 3 < v.lungo; a += 7.5) strisciaStrada(lotti.buffer(...s.p[Math.min(s.p.length - 1, Math.floor((a / v.lungo) * s.p.length))], mat.strisce), s.p, v.cum, a, a + 3, 0.07, Y_STRISCE, 1);
  }
  if (s.r >= 3 && !s.u) {
    for (const verso of [1, -1]) {
      const a = lineaSpostata(s.p, v.cum, 0, v.lungo, verso * (s.l / 2 - 0.3));
      const b = lineaSpostata(s.p, v.cum, 0, v.lungo, verso * (s.l / 2 - 0.42));
      fascia(bs, verso > 0 ? a : b, verso > 0 ? b : a, Y_STRISCE, 1);
    }
  }
  const viste = new Set();
  for (const z of v.strisce) {
    const chiave = Math.round(z.s);
    if (viste.has(chiave) || z.s < 1 || z.s > v.lungo - 1) continue;
    viste.add(chiave);
    const s0 = Math.max(0, z.s - 1.25);
    const s1 = Math.min(v.lungo, z.s + 1.25);
    for (let o = -s.l / 2 + 0.5; o < s.l / 2 - 0.3; o += 1) {
      const a = lineaSpostata(s.p, v.cum, s0, s1, o);
      const b = lineaSpostata(s.p, v.cum, s0, s1, o + 0.5);
      fascia(bs, b, a, Y_STRISCE, 1);
    }
  }
}

function acqua(lotti, a, mat) {
  if (a.g || a.l < 0.9) return;
  const cum = [0];
  for (let i = 1; i < a.p.length; i++) cum.push(cum[i - 1] + Math.hypot(a.p[i][0] - a.p[i - 1][0], a.p[i][1] - a.p[i - 1][1]));
  const lungo = cum[cum.length - 1];
  const fondo = a.l >= 3 ? -0.45 : -0.18;
  const pezzi = Math.max(1, Math.ceil(lungo / 80));
  for (let k = 0; k < pezzi; k++) {
    const s0 = (lungo * k) / pezzi;
    const s1 = (lungo * (k + 1)) / pezzi;
    const meta = lineaSpostata(a.p, cum, (s0 + s1) / 2, (s0 + s1) / 2 + 0.1, 0)[0];
    strisciaStrada(lotti.buffer(meta[0], meta[1], mat.acqua), a.p, cum, s0, s1, a.l / 2, fondo, 4);
    if (a.l >= 3) {
      for (const verso of [1, -1]) {
        const linea = lineaSpostata(a.p, cum, s0, s1, verso * (a.l / 2));
        bordoVerticale(lotti.buffer(meta[0], meta[1], mat.argine), linea, fondo - 0.3, 0.02, verso, 2);
      }
    }
  }
}

function areaPiana(lotti, a, mat) {
  const [cx, cz] = baricentro(a.p);
  if (a.t === 'parcheggio') poligonoOrizzontale(lotti.buffer(cx, cz, mat.asfalto), a.p, Y_ASFALTO - 0.006, UV_ASFALTO);
  else if (a.t === 'piazza') poligonoOrizzontale(lotti.buffer(cx, cz, mat.porfido), a.p, Y_PORFIDO - 0.004, UV_PORFIDO);
  else if (a.t === 'piscina') {
    poligonoOrizzontale(lotti.buffer(cx, cz, mat.piscina), a.p, 0.08, 2);
    const b = lotti.buffer(cx, cz, mat.cordolo);
    const fuori = rientra(a.p, -0.4);
    for (let i = 0; i < a.p.length; i++) {
      const k = (i + 1) % a.p.length;
      quad(b, [a.p[i][0], 0.12, a.p[i][1]], [fuori[i][0], 0.12, fuori[i][1]], [fuori[k][0], 0.12, fuori[k][1]], [a.p[k][0], 0.12, a.p[k][1]], [0, 1, 0], [[0, 0], [0.3, 0], [0.3, 1], [0, 1]]);
    }
  } else if (a.t === 'acqua' && areaFirmata(a.p) < 200000) poligonoOrizzontale(lotti.buffer(cx, cz, mat.acqua), a.p, -0.25, 4);
}

function ferrovia(lotti, f, mat) {
  const cum = [0];
  for (let i = 1; i < f.p.length; i++) cum.push(cum[i - 1] + Math.hypot(f.p[i][0] - f.p[i - 1][0], f.p[i][1] - f.p[i - 1][1]));
  const lungo = cum[cum.length - 1];
  const pezzi = Math.max(1, Math.ceil(lungo / 80));
  for (let k = 0; k < pezzi; k++) {
    const s0 = (lungo * k) / pezzi;
    const s1 = (lungo * (k + 1)) / pezzi;
    const m = lineaSpostata(f.p, cum, (s0 + s1) / 2, (s0 + s1) / 2 + 0.1, 0)[0];
    strisciaStrada(lotti.buffer(m[0], m[1], mat.massicciata), f.p, cum, s0, s1, 1.8, 0.1, 2);
    for (const o of [-0.72, 0.72]) {
      const sx = lineaSpostata(f.p, cum, s0, s1, o + 0.04);
      const dx = lineaSpostata(f.p, cum, s0, s1, o - 0.04);
      const b = lotti.buffer(m[0], m[1], mat.binari);
      fascia(b, sx, dx, 0.24, 1);
      bordoVerticale(b, sx, 0.1, 0.24, 1, 1);
      bordoVerticale(b, dx, 0.1, 0.24, -1, 1);
    }
  }
}

export function costruisciCitta(scena, citta, materiali, { esclusi = new Set() } = {}) {
  const { dati, viabilita, grafo } = citta;
  const lotti = creaLotti();
  const RE = materiali.rettangoliEdifici;
  const RS = materiali.rettangoliStrade;
  const virtuale = (reale, rett) => ({ reale, rett });
  const mat = {
    suolo: materiali.suolo,
    strisce: materiali.strisce,
    acqua: materiali.acqua,
    piscina: materiali.piscina,
    binari: materiali.binari,
    piani: virtuale(materiali.edifici, RE.piani),
    terraCasa: virtuale(materiali.edifici, RE.terraCasa),
    terraNegozi: virtuale(materiali.edifici, RE.terraNegozi),
    industriale: virtuale(materiali.edifici, RE.industriale),
    mattoni: virtuale(materiali.edifici, RE.mattoni),
    chiesa: virtuale(materiali.edifici, RE.chiesa),
    intonaco: virtuale(materiali.edifici, RE.intonaco),
    tegole: virtuale(materiali.edifici, RE.tegole),
    tettoPiano: virtuale(materiali.edifici, RE.tettoPiano),
    gronda: virtuale(materiali.edifici, RE.gronda),
    metallo: virtuale(materiali.edifici, RE.metallo),
    asfalto: virtuale(materiali.strade, RS.asfalto),
    sterrato: virtuale(materiali.strade, RS.sterrato),
    porfido: virtuale(materiali.strade, RS.porfido),
    marciapiede: virtuale(materiali.strade, RS.lastre),
    cordolo: virtuale(materiali.strade, RS.cemento),
    argine: virtuale(materiali.strade, RS.cemento),
    massicciata: virtuale(materiali.strade, RS.massicciata),
  };
  const negozio = (e, a, b) => {
    if (e.u !== 'centro') return false;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < 4) return false;
    const mx = (a[0] + b[0]) / 2 + ((b[1] - a[1]) / l) * 4;
    const mz = (a[1] + b[1]) / 2 - ((b[0] - a[0]) / l) * 4;
    const vicino = grafo.piuVicino(mx, mz, 30);
    if (!vicino || vicino.d > dati.strade[vicino.seg.strada].l / 2 + 2.5) return false;
    return dati.strade[vicino.seg.strada].r >= 2 && hashNumero(Math.round(mx * 7 + mz * 13)) < 0.6;
  };
  for (const e of dati.edifici) if (!esclusi.has(e.id)) edificio(lotti, e, mat, negozio);
  dati.strade.forEach((s, i) => strada(lotti, s, viabilita[i], mat));
  for (const a of dati.acque) acqua(lotti, a, mat);
  for (const a of dati.aree) areaPiana(lotti, a, mat);
  for (const f of dati.ferrovie) ferrovia(lotti, f, mat);

  const limite = dati.limite;
  const celle = [];
  for (let i = Math.floor(-limite / LATO_CELLA); i < Math.ceil(limite / LATO_CELLA); i++) {
    for (let j = Math.floor(-limite / LATO_CELLA); j < Math.ceil(limite / LATO_CELLA); j++) {
      const b = lotti.buffer(i * LATO_CELLA + 1, j * LATO_CELLA + 1, mat.suolo);
      const x0 = i * LATO_CELLA;
      const z0 = j * LATO_CELLA;
      const x1 = x0 + LATO_CELLA;
      const z1 = z0 + LATO_CELLA;
      const uv = (x, z) => [(x + limite) / (2 * limite), 1 - (z + limite) / (2 * limite)];
      quad(b, [x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0], [0, 1, 0], [uv(x0, z1), uv(x1, z1), uv(x1, z0), uv(x0, z0)]);
    }
  }
  for (const cella of lotti.celle.values()) {
    const gruppo = new THREE.Group();
    gruppo.matrixAutoUpdate = false;
    let triangoli = 0;
    for (const [materiale, b] of cella.materiali) {
      if (!b.p.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.u, 2));
      if (materiale.vertexColors) g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
      if (b.a.length) g.setAttribute('atlante', new THREE.Float32BufferAttribute(b.a, 4));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, materiale);
      mesh.matrixAutoUpdate = false;
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.userData.ombra = materiale === materiali.edifici;
      gruppo.add(mesh);
      triangoli += b.p.length / 9;
    }
    scena.add(gruppo);
    celle.push({ gruppo, x: (cella.i + 0.5) * LATO_CELLA, z: (cella.j + 0.5) * LATO_CELLA, triangoli });
  }
  const sotto = new THREE.Mesh(new THREE.PlaneGeometry(20000, 20000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4d5a3a, roughness: 1 }));
  sotto.position.y = -0.05;
  scena.add(sotto);
  return {
    celle,
    aggiorna(camera, distanza) {
      const raggio = LATO_CELLA * 0.72;
      for (const c of celle) {
        const d = Math.hypot(c.x - camera.position.x, c.z - camera.position.z) - raggio;
        c.gruppo.visible = d < distanza;
        const ombra = d < OMBRE_ENTRO;
        if (c.ombra !== ombra) {
          c.ombra = ombra;
          for (const m of c.gruppo.children) m.castShadow = ombra && m.userData.ombra;
        }
      }
    },
  };
}

export function dentroUnEdificio(dati, x, z) {
  return dati.edifici.some(e => dentro(x, z, e.p));
}

export { campionaLinea };

export function meshDaBuffer(materiale, b) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(b.u, 2));
  if (materiale.vertexColors) g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
  if (b.a?.length) g.setAttribute('atlante', new THREE.Float32BufferAttribute(b.a, 4));
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, materiale);
  mesh.matrixAutoUpdate = false;
  mesh.receiveShadow = true;
  return mesh;
}

export function creaCostruttore() {
  const materiali = new Map();
  return {
    buffer(virtuale) {
      const reale = virtuale.reale ?? virtuale;
      if (!materiali.has(reale)) materiali.set(reale, { p: [], n: [], u: [], c: [], a: [] });
      const b = materiali.get(reale);
      return virtuale.rett ? { p: b.p, n: b.n, u: b.u, c: b.c, a: b.a, r: virtuale.rett } : b;
    },
    finisci(contenitore, { ombre = true } = {}) {
      for (const [materiale, b] of materiali) {
        if (!b.p.length) continue;
        const m = meshDaBuffer(materiale, b);
        m.castShadow = ombre && !materiale.transparent;
        contenitore.add(m);
      }
    },
  };
}

export { quad, muro, poligonoOrizzontale, triangoloNormale, vertice, BIANCO, tettoAFalde, tettoPiano };
