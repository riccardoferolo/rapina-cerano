import { inflateSync, deflateSync } from 'node:zlib';

const FIRMA = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CANALI = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export function leggiPng(buf) {
  if (!buf.subarray(0, 8).equals(FIRMA)) throw new Error('PNG non valido: firma assente');
  let pos = 8;
  let w = 0;
  let h = 0;
  let canali = 0;
  let tipoColore = 0;
  let tavolozza = null;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const lunghezza = buf.readUInt32BE(pos);
    const tipo = buf.toString('ascii', pos + 4, pos + 8);
    const dati = buf.subarray(pos + 8, pos + 8 + lunghezza);
    if (tipo === 'IHDR') {
      w = dati.readUInt32BE(0);
      h = dati.readUInt32BE(4);
      canali = CANALI[dati[9]];
      tipoColore = dati[9];
      if (dati[8] !== 8 || dati[12] !== 0 || !canali) throw new Error(`PNG non supportato: profondità ${dati[8]}, colore ${dati[9]}`);
    } else if (tipo === 'PLTE') tavolozza = dati;
    else if (tipo === 'IDAT') idat.push(dati);
    else if (tipo === 'IEND') break;
    pos += 12 + lunghezza;
  }
  const grezzo = inflateSync(Buffer.concat(idat));
  const passo = w * canali;
  const out = new Uint8Array(passo * h);
  for (let y = 0; y < h; y++) {
    const filtro = grezzo[y * (passo + 1)];
    const riga = y * (passo + 1) + 1;
    const o = y * passo;
    for (let i = 0; i < passo; i++) {
      const x = grezzo[riga + i];
      const a = i >= canali ? out[o + i - canali] : 0;
      const b = y > 0 ? out[o - passo + i] : 0;
      const c = i >= canali && y > 0 ? out[o - passo + i - canali] : 0;
      const p = filtro === 1 ? a : filtro === 2 ? b : filtro === 3 ? (a + b) >> 1 : filtro === 4 ? paeth(a, b, c) : 0;
      out[o + i] = (x + p) & 255;
    }
  }
  if (tipoColore !== 3) return { w, h, canali, dati: out };
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const k = out[i] * 3;
    rgb[i * 3] = tavolozza[k];
    rgb[i * 3 + 1] = tavolozza[k + 1];
    rgb[i * 3 + 2] = tavolozza[k + 2];
  }
  return { w, h, canali: 3, dati: rgb };
}

const TABELLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABELLA_CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pezzo(tipo, dati) {
  const l = Buffer.alloc(4);
  l.writeUInt32BE(dati.length);
  const td = Buffer.concat([Buffer.from(tipo, 'ascii'), dati]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([l, td, c]);
}

export function scriviPng(w, h, rgb) {
  const righe = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    righe[y * (w * 3 + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(righe, y * (w * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([FIRMA, pezzo('IHDR', ihdr), pezzo('IDAT', deflateSync(righe, { level: 6 })), pezzo('IEND', Buffer.alloc(0))]);
}

export function creaTela(w, h, sfondo = [0, 0, 0]) {
  const dati = new Uint8Array(w * h * 3);
  for (let i = 0; i < w * h; i++) dati.set(sfondo, i * 3);
  const punto = (x, y, c) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    dati.set(c, ((y | 0) * w + (x | 0)) * 3);
  };
  return {
    w, h, dati, punto,
    poligono(anello, c) {
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const p of anello) {
        y0 = Math.min(y0, p[1]);
        y1 = Math.max(y1, p[1]);
      }
      for (let y = Math.max(0, Math.ceil(y0)); y <= Math.min(h - 1, Math.floor(y1)); y++) {
        const xs = [];
        for (let i = 0, j = anello.length - 1; i < anello.length; j = i++) {
          const [xi, yi] = anello[i];
          const [xj, yj] = anello[j];
          if ((yi > y) !== (yj > y)) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k])); x <= Math.min(w - 1, xs[k + 1]); x++) dati.set(c, (y * w + x) * 3);
      }
    },
    linea(punti, spessore, c) {
      const r = Math.max(0.5, spessore / 2);
      for (let i = 1; i < punti.length; i++) {
        const [ax, ay] = punti[i - 1];
        const [bx, by] = punti[i];
        const passi = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / Math.max(0.5, r * 0.7)));
        for (let s = 0; s <= passi; s++) {
          const x = ax + ((bx - ax) * s) / passi;
          const y = ay + ((by - ay) * s) / passi;
          for (let oy = -Math.ceil(r); oy <= Math.ceil(r); oy++) for (let ox = -Math.ceil(r); ox <= Math.ceil(r); ox++) if (ox * ox + oy * oy <= r * r) punto(x + ox, y + oy, c);
        }
      }
    },
  };
}
