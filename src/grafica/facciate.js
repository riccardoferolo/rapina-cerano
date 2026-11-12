import * as THREE from 'three';
import { creaCaso } from './caso-grafica.js';
import { normaleDaAltezza } from './superfici.js';

const ANISOTROPIA = 8;
export const CAMPATA = 2.8;
export const PIANO = 3;
export const PIANO_TERRA = 3.5;
const INSEGNE = Object.freeze(['ALIMENTARI', 'PARRUCCHIERE', 'CALZATURE', 'FERRAMENTA', 'PANETTERIA', 'MERCERIA', 'ABBIGLIAMENTO', 'OTTICA', 'FIORI', 'PASTICCERIA', 'ASSICURAZIONI', 'LAVANDERIA', 'MACELLERIA', 'CARTOLERIA', 'ESTETICA', 'GELATERIA']);

function tela(l, a) {
  const c = document.createElement('canvas');
  c.width = l;
  c.height = a;
  return c;
}

function comeTexture(canvas, colore) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = colore ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = ANISOTROPIA;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function strati(l, a, pittore, { forza = 2.5, seme = 1, luce = false } = {}) {
  const tele = { c: tela(l, a), h: tela(l, a), d: tela(l, a), e: luce ? tela(l, a) : null };
  const ctx = { c: tele.c.getContext('2d'), h: tele.h.getContext('2d'), d: tele.d.getContext('2d'), e: tele.e?.getContext('2d') ?? null };
  ctx.h.fillStyle = 'rgb(128,128,128)';
  ctx.h.fillRect(0, 0, l, a);
  ctx.d.fillStyle = 'rgb(255,235,0)';
  ctx.d.fillRect(0, 0, l, a);
  if (ctx.e) {
    ctx.e.fillStyle = '#000';
    ctx.e.fillRect(0, 0, l, a);
  }
  const caso = creaCaso(seme * 7919 + l + a);
  const pz = (x, y, w, h, { colore = null, altezza = null, maschera = null, ruvido = null } = {}) => {
    if (colore) {
      ctx.c.fillStyle = colore;
      ctx.c.fillRect(x, y, w, h);
    }
    if (altezza !== null) {
      ctx.h.fillStyle = `rgb(${altezza},${altezza},${altezza})`;
      ctx.h.fillRect(x, y, w, h);
    }
    if (maschera !== null || ruvido !== null) {
      ctx.d.fillStyle = `rgb(${Math.round((maschera ?? 0) * 255)},${Math.round((ruvido ?? 0.8) * 255)},0)`;
      ctx.d.fillRect(x, y, w, h);
    }
  };
  pittore({ ...ctx, pz, caso, l, a });
  const risultato = {
    map: comeTexture(tele.c, true),
    normalMap: normaleDaAltezza(tele.h, forza),
    roughnessMap: comeTexture(tele.d, false),
  };
  if (tele.e) risultato.emissiveMap = comeTexture(tele.e, true);
  return risultato;
}

function rumore(ctx, l, a, caso, quanti, colori, lato = 2) {
  for (let i = 0; i < quanti; i++) {
    ctx.fillStyle = colori[Math.floor(caso() * colori.length)];
    ctx.fillRect(caso() * l, caso() * a, lato * (0.5 + caso()), lato * (0.5 + caso()));
  }
}

function colature(ctx, l, a, caso, quante, colore) {
  for (let i = 0; i < quante; i++) {
    const x = caso() * l;
    const y = caso() * a;
    const lungo = 30 + caso() * 140;
    const g = ctx.createLinearGradient(0, y, 0, y + lungo);
    g.addColorStop(0, colore);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, 3 + caso() * 9, lungo);
  }
}

function intonaco(s, base = '#ece8e0') {
  const { c, h, l, a, caso } = s;
  c.fillStyle = base;
  c.fillRect(0, 0, l, a);
  rumore(c, l, a, caso, l * a * 0.03, ['rgba(255,255,255,0.10)', 'rgba(70,55,40,0.07)', 'rgba(120,110,90,0.06)'], 2);
  rumore(h, l, a, caso, l * a * 0.03, ['rgba(255,255,255,0.18)', 'rgba(0,0,0,0.18)'], 2);
  for (let i = 0; i < 18; i++) {
    const x = caso() * l;
    const y = caso() * a;
    const r = 30 + caso() * 90;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, caso() < 0.5 ? 'rgba(90,75,55,0.08)' : 'rgba(255,255,250,0.1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function vetro(s, x, y, w, h, { acceso = false, tende = true, telaio = '#5a3a22' } = {}) {
  const { c, e, pz, caso } = s;
  const g = c.createLinearGradient(x, y, x + w * 0.6, y + h);
  g.addColorStop(0, '#3c4a5e');
  g.addColorStop(0.5, '#161c26');
  g.addColorStop(1, '#0c1016');
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
  c.fillStyle = 'rgba(200,215,235,0.10)';
  c.beginPath();
  c.moveTo(x + w * 0.15, y + h);
  c.lineTo(x + w * 0.55, y);
  c.lineTo(x + w * 0.75, y);
  c.lineTo(x + w * 0.35, y + h);
  c.fill();
  pz(x, y, w, h, { altezza: 45, maschera: 0, ruvido: 0.08 });
  if (acceso && e) {
    const gl = e.createLinearGradient(x, y, x, y + h);
    gl.addColorStop(0, '#ffcf8c');
    gl.addColorStop(1, '#c98a46');
    e.fillStyle = gl;
    e.fillRect(x, y, w, h);
    if (tende) {
      e.fillStyle = 'rgba(60,30,10,0.55)';
      const lt = w * (0.18 + caso() * 0.2);
      e.fillRect(x, y, lt, h);
      e.fillRect(x + w - lt * (0.6 + caso() * 0.6), y, lt, h);
    }
    c.fillStyle = 'rgba(255,200,130,0.35)';
    c.fillRect(x, y, w, h);
  }
  const t = Math.max(4, w * 0.06);
  c.fillStyle = telaio;
  c.fillRect(x, y, w, t);
  c.fillRect(x, y + h - t, w, t);
  c.fillRect(x, y, t, h);
  c.fillRect(x + w - t, y, t, h);
  c.fillRect(x + w / 2 - t / 2, y, t, h);
  c.fillRect(x, y + h * 0.38, w, t * 0.8);
  pz(x, y, w, t, { altezza: 90 });
  pz(x + w / 2 - t / 2, y, t, h, { altezza: 90 });
  if (e) {
    e.fillStyle = '#000';
    e.fillRect(x, y, w, t);
    e.fillRect(x, y + h - t, w, t);
    e.fillRect(x + w / 2 - t / 2, y, t, h);
    e.fillRect(x, y + h * 0.38, w, t * 0.8);
  }
}

function lamelle(s, x, y, w, h, colore, orizzontali = true, passo = 7) {
  const { c, h: hh, pz } = s;
  pz(x, y, w, h, { colore, altezza: 150, maschera: 0, ruvido: 0.55 });
  for (let k = 0; orizzontali ? k < h : k < w; k += passo) {
    c.fillStyle = 'rgba(0,0,0,0.28)';
    hh.fillStyle = 'rgb(95,95,95)';
    if (orizzontali) {
      c.fillRect(x, y + k, w, 2);
      hh.fillRect(x, y + k, w, 2);
    } else {
      c.fillRect(x + k, y, 2, h);
      hh.fillRect(x + k, y, 2, h);
    }
  }
  c.strokeStyle = 'rgba(0,0,0,0.45)';
  c.lineWidth = 2;
  c.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

const VERDI = Object.freeze(['#3d5a40', '#46623e', '#3a5248', '#5a4632', '#4e5a3a']);

export function texturaPiani(seme = 1) {
  return strati(1024, 1024, s => {
    const { c, h, e, pz, caso } = s;
    intonaco(s);
    colature(c, 1024, 1024, caso, 40, 'rgba(60,50,40,0.10)');
    const verde = VERDI[Math.floor(caso() * VERDI.length)];
    for (let r = 0; r < 4; r++) {
      const y0 = r * 256;
      pz(0, y0 + 246, 1024, 10, { colore: '#f1ede6', altezza: 175, maschera: 0.9, ruvido: 0.85 });
      c.fillStyle = 'rgba(0,0,0,0.14)';
      c.fillRect(0, y0 + 244, 1024, 2);
      for (let b = 0; b < 4; b++) {
        const x0 = b * 256;
        const tipo = caso();
        const acceso = caso() < 0.3;
        if (tipo < 0.16) {
          const w = 108;
          const hh = 196;
          const wx = x0 + 74;
          const wy = y0 + 244 - hh;
          pz(wx - 12, wy - 12, w + 24, hh + 12, { colore: '#ddd7c9', altezza: 180, maschera: 0.1, ruvido: 0.7 });
          vetro(s, wx, wy, w, hh, { acceso, telaio: '#6a4a2c' });
          lamelle(s, wx - 54, wy, 50, hh, verde, true);
          lamelle(s, wx + w + 4, wy, 50, hh, verde, true);
          pz(wx - 22, y0 + 236, w + 44, 12, { colore: '#bdb6a6', altezza: 215, maschera: 0, ruvido: 0.7 });
          c.fillStyle = '#1d1d1f';
          h.fillStyle = 'rgb(230,230,230)';
          for (let k = 0; k <= w + 30; k += 9) {
            c.fillRect(wx - 15 + k, wy + hh - 88, 3, 82);
            h.fillRect(wx - 15 + k, wy + hh - 88, 3, 82);
          }
          c.fillRect(wx - 16, wy + hh - 92, w + 34, 5);
          h.fillRect(wx - 16, wy + hh - 92, w + 34, 5);
          if (e) {
            e.fillStyle = '#000';
            for (let k = 0; k <= w + 30; k += 9) e.fillRect(wx - 15 + k, wy + hh - 88, 3, 82);
          }
          continue;
        }
        const w = 100;
        const hh = 134;
        const wx = x0 + 78;
        const wy = y0 + 50;
        pz(wx - 12, wy - 12, w + 24, hh + 12, { colore: '#ddd7c9', altezza: 178, maschera: 0.1, ruvido: 0.72 });
        pz(wx - 18, wy + hh, w + 36, 12, { colore: '#cfc8b8', altezza: 210, maschera: 0, ruvido: 0.7 });
        c.fillStyle = 'rgba(60,50,40,0.12)';
        c.fillRect(wx - 10, wy + hh + 12, w + 20, 40);
        if (tipo < 0.5) {
          const stato = caso();
          if (stato < 0.4) {
            pz(wx, wy, w, hh, { colore: '#111', altezza: 50, maschera: 0, ruvido: 0.5 });
            lamelle(s, wx + 2, wy + 2, w / 2 - 3, hh - 4, verde, true);
            lamelle(s, wx + w / 2 + 1, wy + 2, w / 2 - 3, hh - 4, verde, true);
          } else {
            vetro(s, wx, wy, w, hh, { acceso });
            lamelle(s, wx - 52, wy, 48, hh, verde, true);
            lamelle(s, wx + w + 4, wy, 48, hh, verde, true);
          }
        } else {
          const giu = 0.2 + caso() * 0.75;
          vetro(s, wx, wy, w, hh, { acceso, telaio: tipo < 0.8 ? '#e6e2da' : '#6b4d30' });
          lamelle(s, wx, wy, w, hh * giu, tipo < 0.8 ? '#b9b1a0' : '#8a7458', true, 6);
          if (e) {
            e.fillStyle = '#000';
            e.fillRect(wx, wy, w, hh * giu);
          }
          pz(wx - 6, wy - 16, w + 12, 10, { colore: '#d8d2c4', altezza: 170, maschera: 0.1 });
        }
      }
    }
    pz(4, 0, 9, 1024, { colore: '#6f5641', altezza: 215, maschera: 0, ruvido: 0.45 });
    for (let y = 40; y < 1024; y += 256) pz(0, y, 17, 6, { colore: '#4d3c2e', altezza: 230 });
  }, { forza: 2.2, seme, luce: true });
}

function scritta(ctx, testo, x, y, w, h, colore, sfondo) {
  ctx.fillStyle = sfondo;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = colore;
  ctx.font = `bold ${Math.floor(h * 0.62)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(testo, x + w / 2, y + h / 2 + 1, w * 0.9);
}

export function texturaTerra(negozi = false, seme = 3) {
  return strati(1024, 320, s => {
    const { c, h, e, pz, caso } = s;
    intonaco(s, '#e6e1d6');
    pz(0, 256, 1024, 64, { colore: '#8d887e', altezza: 150, maschera: 0.12, ruvido: 0.9 });
    rumore(c, 1024, 64, caso, 3000, ['rgba(255,255,255,0.08)', 'rgba(0,0,0,0.12)'], 2);
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fillRect(0, 254, 1024, 3);
    colature(c, 1024, 256, caso, 30, 'rgba(70,60,45,0.10)');
    for (let b = 0; b < 4; b++) {
      const x0 = b * 256;
      const tipo = caso();
      if (negozi && tipo < 0.78) {
        const aperto = caso() < 0.3;
        const wx = x0 + 22;
        const w = 212;
        pz(wx - 8, 66, w + 16, 254, { colore: '#4a4844', altezza: 160, maschera: 0, ruvido: 0.5 });
        if (aperto) {
          vetro(s, wx, 100, w, 200, { acceso: true, tende: false, telaio: '#2b2b2d' });
          if (e) {
            e.fillStyle = '#fff0d8';
            e.fillRect(wx + 8, 108, w - 16, 184);
          }
        } else lamelle(s, wx, 100, w, 200, '#8f9396', true, 6);
        const insegna = INSEGNE[Math.floor(caso() * INSEGNE.length)];
        const colori = [['#f4efe2', '#7a1f22'], ['#1f3b5c', '#f2efe6'], ['#2d4a2b', '#f5f0dd'], ['#efe6cf', '#2a2a2a']][Math.floor(caso() * 4)];
        scritta(c, insegna, wx, 68, w, 30, colori[1], colori[0]);
        pz(wx, 68, w, 30, { altezza: 190, maschera: 0, ruvido: 0.4 });
        if (e && caso() < 0.6) {
          e.fillStyle = 'rgba(255,240,210,0.65)';
          e.fillRect(wx + 4, 72, w - 8, 22);
        }
        continue;
      }
      if (tipo < 0.3) {
        const wx = x0 + 70;
        pz(wx - 14, 46, 128, 214, { colore: '#d6d0c2', altezza: 180, maschera: 0.1, ruvido: 0.75 });
        pz(wx, 60, 100, 196, { colore: '#5e3d24', altezza: 120, maschera: 0, ruvido: 0.6 });
        for (let k = 0; k < 4; k++) pz(wx + 8 + (k % 2) * 46, 70 + Math.floor(k / 2) * 92, 38, 80, { colore: '#6d4a2d', altezza: 150 });
        pz(wx + 82, 150, 8, 8, { colore: '#c9a650', altezza: 220 });
        if (e && caso() < 0.5) {
          e.fillStyle = 'rgba(255,214,150,0.9)';
          e.beginPath();
          e.arc(wx + 50, 36, 9, 0, Math.PI * 2);
          e.fill();
        }
        continue;
      }
      if (tipo < 0.5) {
        const wx = x0 + 18;
        pz(wx - 6, 50, 232, 210, { colore: '#ccc6b8', altezza: 170, maschera: 0.1 });
        lamelle(s, wx, 58, 220, 202, '#a7a9a6', false, 10);
        continue;
      }
      const wx = x0 + 80;
      pz(wx - 12, 70, 120, 140, { colore: '#d8d2c4', altezza: 178, maschera: 0.1 });
      vetro(s, wx, 82, 96, 120, { acceso: caso() < 0.35 });
      c.fillStyle = '#1b1b1d';
      h.fillStyle = 'rgb(225,225,225)';
      for (let k = 6; k < 96; k += 14) {
        c.fillRect(wx + k, 82, 3, 120);
        h.fillRect(wx + k, 82, 3, 120);
        if (e) {
          e.fillStyle = '#000';
          e.fillRect(wx + k, 82, 3, 120);
        }
      }
      c.fillRect(wx, 120, 96, 3);
      c.fillRect(wx, 160, 96, 3);
      pz(wx - 16, 202, 128, 10, { colore: '#c4bdac', altezza: 210, maschera: 0 });
    }
  }, { forza: 2.2, seme, luce: true });
}

export function texturaIndustriale() {
  return strati(512, 512, s => {
    const { c, h, pz, caso } = s;
    c.fillStyle = '#d4d6d4';
    c.fillRect(0, 0, 512, 512);
    for (let x = 0; x < 512; x += 16) {
      const g = c.createLinearGradient(x, 0, x + 16, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.10)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0.10)');
      c.fillStyle = g;
      c.fillRect(x, 0, 16, 512);
      const gh = h.createLinearGradient(x, 0, x + 16, 0);
      gh.addColorStop(0, '#606060');
      gh.addColorStop(0.5, '#c0c0c0');
      gh.addColorStop(1, '#606060');
      h.fillStyle = gh;
      h.fillRect(x, 0, 16, 512);
    }
    s.d.fillStyle = 'rgb(255,120,0)';
    s.d.fillRect(0, 0, 512, 512);
    pz(0, 448, 512, 64, { colore: '#9c9890', altezza: 140, maschera: 0.15, ruvido: 0.9 });
    rumore(c, 512, 64, caso, 2500, ['rgba(0,0,0,0.1)', 'rgba(255,255,255,0.08)'], 2);
    c.fillStyle = 'rgba(0,0,0,0.12)';
    c.fillRect(0, 446, 512, 2);
    pz(0, 70, 512, 44, { colore: '#9fb1bd', altezza: 80, maschera: 0, ruvido: 0.15 });
    for (let x = 0; x < 512; x += 64) pz(x, 70, 5, 44, { colore: '#4b4e52', altezza: 140 });
    colature(c, 512, 512, caso, 30, 'rgba(80,60,40,0.10)');
  }, { forza: 1.6, seme: 5 });
}

export function texturaMattoni() {
  return strati(512, 512, s => {
    const { c, h, pz, caso, e } = s;
    c.fillStyle = '#b8b0a0';
    c.fillRect(0, 0, 512, 512);
    h.fillStyle = 'rgb(90,90,90)';
    h.fillRect(0, 0, 512, 512);
    const altoM = 13;
    const lungoM = 46;
    for (let y = 0, riga = 0; y < 512; y += altoM, riga++) {
      for (let x = -(riga % 2) * (lungoM / 2); x < 512; x += lungoM) {
        const v = 0.75 + caso() * 0.35;
        c.fillStyle = `rgb(${Math.round(176 * v)},${Math.round(98 * v)},${Math.round(70 * v)})`;
        c.fillRect(x + 1, y + 1, lungoM - 2, altoM - 2);
        h.fillStyle = `rgb(${150 + Math.floor(caso() * 30)},${150},${150})`;
        h.fillRect(x + 1, y + 1, lungoM - 2, altoM - 2);
      }
    }
    rumore(c, 512, 512, caso, 9000, ['rgba(0,0,0,0.12)', 'rgba(255,230,200,0.08)'], 2);
    s.d.fillStyle = 'rgb(70,240,0)';
    s.d.fillRect(0, 0, 512, 512);
    const wx = 206;
    pz(wx - 8, 180, 116, 150, { colore: '#9a5a3c', altezza: 170, maschera: 0.1 });
    vetro(s, wx, 190, 100, 130, { acceso: caso() < 0.4, telaio: '#4a3220' });
    lamelle(s, wx - 46, 190, 42, 130, '#5a4028', true);
    lamelle(s, wx + 104, 190, 42, 130, '#5a4028', true);
    pz(wx - 14, 320, 128, 10, { colore: '#9c8e7c', altezza: 210, maschera: 0 });
    if (e) e.globalAlpha = 1;
    colature(c, 512, 512, caso, 20, 'rgba(40,30,20,0.12)');
  }, { forza: 2.4, seme: 9, luce: true });
}

export function texturaChiesa() {
  return strati(512, 1024, s => {
    const { c, pz, caso } = s;
    intonaco(s, '#f0dfb6');
    pz(0, 0, 70, 1024, { colore: '#f6e8c6', altezza: 190, maschera: 0.85, ruvido: 0.85 });
    pz(442, 0, 70, 1024, { colore: '#f6e8c6', altezza: 190, maschera: 0.85, ruvido: 0.85 });
    pz(0, 930, 512, 94, { colore: '#bfa98a', altezza: 170, maschera: 0.4 });
    pz(0, 60, 512, 26, { colore: '#f8ecd0', altezza: 200, maschera: 0.85 });
    const wx = 196;
    c.fillStyle = '#d8c7a4';
    c.beginPath();
    c.moveTo(wx - 14, 620);
    c.lineTo(wx - 14, 300);
    c.arc(wx + 60, 300, 74, Math.PI, 0);
    c.lineTo(wx + 134, 620);
    c.fill();
    s.h.fillStyle = 'rgb(185,185,185)';
    s.h.fill();
    const g = c.createLinearGradient(0, 230, 0, 610);
    g.addColorStop(0, '#2b3858');
    g.addColorStop(1, '#151b2c');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(wx, 610);
    c.lineTo(wx, 300);
    c.arc(wx + 60, 300, 60, Math.PI, 0);
    c.lineTo(wx + 120, 610);
    c.fill();
    s.d.fillStyle = 'rgb(0,30,0)';
    s.d.fill();
    s.h.fillStyle = 'rgb(60,60,60)';
    s.h.fill();
    c.strokeStyle = '#3a2e22';
    c.lineWidth = 3;
    for (let y = 320; y < 610; y += 40) {
      c.beginPath();
      c.moveTo(wx, y);
      c.lineTo(wx + 120, y);
      c.stroke();
    }
    colature(c, 512, 1024, caso, 26, 'rgba(90,70,40,0.10)');
  }, { forza: 2, seme: 13 });
}

export function texturaTegole() {
  return strati(512, 512, s => {
    const { c, h, caso } = s;
    c.fillStyle = '#6a6a6a';
    c.fillRect(0, 0, 512, 512);
    const passo = 32;
    for (let y = 0; y < 512; y += 22) {
      const sfasa = (y / 22) % 2 ? passo / 2 : 0;
      for (let x = -passo; x < 512 + passo; x += passo) {
        const v = 0.78 + caso() * 0.36;
        const cx = x + sfasa;
        const g = c.createLinearGradient(cx, 0, cx + passo, 0);
        g.addColorStop(0, `rgba(${Math.round(120 * v)},${Math.round(120 * v)},${Math.round(120 * v)},1)`);
        g.addColorStop(0.5, `rgba(${Math.round(225 * v)},${Math.round(225 * v)},${Math.round(225 * v)},1)`);
        g.addColorStop(1, `rgba(${Math.round(110 * v)},${Math.round(110 * v)},${Math.round(110 * v)},1)`);
        c.fillStyle = g;
        c.fillRect(cx + 1, y, passo - 2, 24);
        const gh = h.createLinearGradient(cx, 0, cx + passo, 0);
        gh.addColorStop(0, '#404040');
        gh.addColorStop(0.5, '#e0e0e0');
        gh.addColorStop(1, '#404040');
        h.fillStyle = gh;
        h.fillRect(cx + 1, y, passo - 2, 24);
        c.fillStyle = 'rgba(0,0,0,0.35)';
        c.fillRect(cx + 1, y + 21, passo - 2, 3);
      }
    }
    rumore(c, 512, 512, caso, 9000, ['rgba(40,60,30,0.10)', 'rgba(0,0,0,0.12)', 'rgba(255,255,255,0.06)'], 2);
    for (let i = 0; i < 25; i++) {
      const x = caso() * 512;
      const y = caso() * 512;
      const r = 20 + caso() * 60;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, caso() < 0.5 ? 'rgba(50,55,35,0.20)' : 'rgba(20,20,20,0.18)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    s.d.fillStyle = 'rgb(255,200,0)';
    s.d.fillRect(0, 0, 512, 512);
  }, { forza: 3, seme: 17 });
}

export function texturaTettoPiano() {
  return strati(256, 256, s => {
    const { c, h, caso } = s;
    c.fillStyle = '#7d7a74';
    c.fillRect(0, 0, 256, 256);
    rumore(c, 256, 256, caso, 9000, ['#8d8a83', '#6a6761', '#9a958c', '#5d5a55'], 2);
    rumore(h, 256, 256, caso, 9000, ['#a0a0a0', '#606060'], 2);
    s.d.fillStyle = 'rgb(255,240,0)';
    s.d.fillRect(0, 0, 256, 256);
  }, { forza: 2, seme: 19 });
}

export function texturaDettaglio(tipo) {
  const c = tela(256, 256);
  const ctx = c.getContext('2d');
  const caso = creaCaso(tipo === 'erba' ? 3 : tipo === 'terra' ? 5 : 7);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  if (tipo === 'erba') {
    for (let i = 0; i < 9000; i++) {
      const v = 90 + Math.floor(caso() * 90);
      ctx.strokeStyle = `rgb(${v},${v},${v})`;
      ctx.lineWidth = 1;
      const x = caso() * 256;
      const y = caso() * 256;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (caso() - 0.5) * 3, y - 2 - caso() * 5);
      ctx.stroke();
    }
  } else if (tipo === 'terra') {
    for (let y = 0; y < 256; y += 16) {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, y, 256, 5);
    }
    rumore(ctx, 256, 256, caso, 7000, ['#9a9a9a', '#666', '#737373', '#a8a8a8'], 2);
  } else {
    rumore(ctx, 256, 256, caso, 12000, ['#a8a8a8', '#5a5a5a', '#8c8c8c', '#777'], 2.5);
  }
  return comeTexture(c, false);
}
