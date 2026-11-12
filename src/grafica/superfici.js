import * as THREE from 'three';
import { creaCaso } from './caso-grafica.js';

const ANISOTROPIA = 16;

function telaVuota(l, a) {
  const canvas = document.createElement('canvas');
  canvas.width = l;
  canvas.height = a;
  return canvas;
}

function comeTexture(canvas, { colore = true, ripeti = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = colore ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = ANISOTROPIA;
  if (ripeti) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function normaleDaAltezza(altezza, forza) {
  const l = altezza.width;
  const a = altezza.height;
  const dati = altezza.getContext('2d').getImageData(0, 0, l, a).data;
  const h = new Float32Array(l * a);
  for (let i = 0; i < l * a; i++) h[i] = dati[i * 4] / 255;
  const uscita = telaVuota(l, a);
  const ctx = uscita.getContext('2d');
  const immagine = ctx.createImageData(l, a);
  for (let y = 0; y < a; y++) {
    const su = ((y - 1 + a) % a) * l;
    const giu = ((y + 1) % a) * l;
    for (let x = 0; x < l; x++) {
      const sx = (x - 1 + l) % l;
      const dx = (x + 1) % l;
      const nx = -(h[y * l + dx] - h[y * l + sx]) * forza;
      const ny = (h[giu + x] - h[su + x]) * forza;
      const lungo = Math.hypot(nx, ny, 1);
      const i = (y * l + x) * 4;
      immagine.data[i] = (nx / lungo * 0.5 + 0.5) * 255;
      immagine.data[i + 1] = (ny / lungo * 0.5 + 0.5) * 255;
      immagine.data[i + 2] = (1 / lungo * 0.5 + 0.5) * 255;
      immagine.data[i + 3] = 255;
    }
  }
  ctx.putImageData(immagine, 0, 0);
  return comeTexture(uscita, { colore: false });
}

function conRilievo(l, a, pittore, { forza = 3, seme = 0 } = {}) {
  const colore = telaVuota(l, a);
  const altezza = telaVuota(l, a);
  pittore(colore.getContext('2d'), altezza.getContext('2d'), l, a, creaCaso(l * 31 + a * 17 + seme));
  return { map: comeTexture(colore), normalMap: normaleDaAltezza(altezza, forza) };
}

function avvolto(l, a, x, y, raggio, disegna) {
  for (const ox of [-l, 0, l]) {
    if (x + ox < -raggio || x + ox > l + raggio) continue;
    for (const oy of [-a, 0, a]) {
      if (y + oy < -raggio || y + oy > a + raggio) continue;
      disegna(x + ox, y + oy);
    }
  }
}

const rgb = (r, g, b) => `rgb(${Math.max(0, Math.min(255, Math.round(r)))},${Math.max(0, Math.min(255, Math.round(g)))},${Math.max(0, Math.min(255, Math.round(b)))})`;
const grigio = v => rgb(v, v, v);

function sporca(ctx, l, a, caso, quante, colore, raggioMax) {
  for (let i = 0; i < quante; i++) {
    const x = caso() * l;
    const y = caso() * a;
    const r = raggioMax * (0.3 + caso() * 0.7);
    avvolto(l, a, x, y, r, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, colore);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }
}

function granella(ctx, l, a, caso, quanti, chiaro, scuro, lato = 2) {
  for (let i = 0; i < quanti; i++) {
    ctx.fillStyle = caso() < 0.5 ? chiaro : scuro;
    ctx.fillRect(caso() * l, caso() * a, lato * (0.5 + caso()), lato * (0.5 + caso()));
  }
}

const PORFIDI = Object.freeze([[112, 92, 86], [96, 86, 84], [124, 104, 92], [88, 80, 82], [104, 90, 96], [118, 98, 80], [80, 74, 72]]);

export const superficiePorfido = () => conRilievo(1024, 1024, (c, h, l, a, caso) => {
  c.fillStyle = '#211d1b';
  c.fillRect(0, 0, l, a);
  h.fillStyle = '#000';
  h.fillRect(0, 0, l, a);
  const passo = l / 4;
  const cubo = passo * 0.088;
  const righe = Math.round(a / (passo / 2));
  for (let riga = -1; riga <= righe; riga++) {
    for (let col = -1; col <= 4; col++) {
      const cx = col * passo + ((riga % 2 + 2) % 2) * passo / 2;
      const cy = riga * passo / 2;
      for (let anello = 1; anello <= 8; anello++) {
        const r = anello * cubo * 1.06;
        const quanti = Math.max(3, Math.round((Math.PI * r) / (cubo * 1.08)));
        for (let k = 0; k <= quanti; k++) {
          const ang = Math.PI * (k / quanti);
          const x = cx + Math.cos(ang) * r * 1.08;
          const y = cy + Math.sin(ang) * r * 0.62;
          const base = PORFIDI[Math.floor(caso() * PORFIDI.length)];
          const luce = (caso() - 0.5) * 26;
          const larghezza = cubo * (0.84 + caso() * 0.12);
          const profondita = cubo * (0.78 + caso() * 0.12);
          const rot = ang + Math.PI / 2 + (caso() - 0.5) * 0.3;
          const rilievo = 150 + caso() * 70;
          avvolto(l, a, x, y, cubo, (px, py) => {
            c.save();
            c.translate(px, py);
            c.rotate(rot);
            c.fillStyle = rgb(base[0] + luce, base[1] + luce, base[2] + luce);
            c.fillRect(-larghezza / 2, -profondita / 2, larghezza, profondita);
            c.fillStyle = 'rgba(255,240,230,0.08)';
            c.fillRect(-larghezza / 2, -profondita / 2, larghezza, profondita * 0.35);
            c.fillStyle = 'rgba(0,0,0,0.14)';
            c.fillRect(-larghezza / 2, profondita * 0.2, larghezza, profondita * 0.3);
            c.restore();
            h.save();
            h.translate(px, py);
            h.rotate(rot);
            h.fillStyle = grigio(rilievo * 0.7);
            h.fillRect(-larghezza / 2, -profondita / 2, larghezza, profondita);
            h.fillStyle = grigio(rilievo);
            h.fillRect(-larghezza / 2 + 2, -profondita / 2 + 2, larghezza - 4, profondita - 4);
            h.restore();
          });
        }
      }
    }
  }
  granella(c, l, a, caso, 26000, 'rgba(255,245,235,0.07)', 'rgba(0,0,0,0.12)', 2);
  sporca(c, l, a, caso, 40, 'rgba(20,14,10,0.22)', 90);
  sporca(c, l, a, caso, 18, 'rgba(160,150,140,0.08)', 120);
}, { forza: 5 });

export const superficieCiottoli = () => conRilievo(512, 512, (c, h, l, a, caso) => {
  c.fillStyle = '#4a4540';
  c.fillRect(0, 0, l, a);
  h.fillStyle = '#202020';
  h.fillRect(0, 0, l, a);
  for (let i = 0; i < 2600; i++) {
    const x = caso() * l;
    const y = caso() * a;
    const r = 5 + caso() * 6;
    const schiaccia = 0.55 + caso() * 0.35;
    const giro = caso() * Math.PI;
    const v = caso();
    const tono = v < 0.5 ? [150, 144, 132] : v < 0.8 ? [128, 122, 114] : v < 0.93 ? [168, 160, 146] : [110, 96, 86];
    const luce = (caso() - 0.5) * 24;
    avvolto(l, a, x, y, r, (px, py) => {
      c.save();
      c.translate(px, py);
      c.rotate(giro);
      const g = c.createRadialGradient(-r * 0.3, -r * 0.35 * schiaccia, r * 0.1, 0, 0, r);
      g.addColorStop(0, rgb(tono[0] + 40 + luce, tono[1] + 38 + luce, tono[2] + 34 + luce));
      g.addColorStop(0.6, rgb(tono[0] + luce, tono[1] + luce, tono[2] + luce));
      g.addColorStop(1, rgb(tono[0] * 0.62, tono[1] * 0.62, tono[2] * 0.62));
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(0, 0, r, r * schiaccia, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
      h.save();
      h.translate(px, py);
      h.rotate(giro);
      const gh = h.createRadialGradient(0, 0, 0, 0, 0, r);
      gh.addColorStop(0, '#fff');
      gh.addColorStop(0.7, '#aaa');
      gh.addColorStop(1, '#333');
      h.fillStyle = gh;
      h.beginPath();
      h.ellipse(0, 0, r, r * schiaccia, 0, 0, Math.PI * 2);
      h.fill();
      h.restore();
    });
  }
  sporca(c, l, a, caso, 14, 'rgba(25,20,15,0.25)', 60);
}, { forza: 4, seme: 3 });

export const superficieLastre = () => conRilievo(512, 512, (c, h, l, a, caso) => {
  const n = 4;
  const lato = l / n;
  c.fillStyle = '#5a5650';
  c.fillRect(0, 0, l, a);
  h.fillStyle = '#000';
  h.fillRect(0, 0, l, a);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = caso() * 22 - 11;
      c.fillStyle = rgb(160 + v, 155 + v, 146 + v);
      c.fillRect(i * lato + 2, j * lato + 2, lato - 4, lato - 4);
      h.fillStyle = grigio(200 + caso() * 30);
      h.fillRect(i * lato + 3, j * lato + 3, lato - 6, lato - 6);
    }
  }
  granella(c, l, a, caso, 14000, 'rgba(255,255,255,0.12)', 'rgba(0,0,0,0.12)', 2);
  granella(h, l, a, caso, 6000, 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0.05)', 2);
  sporca(c, l, a, caso, 22, 'rgba(30,25,20,0.18)', 70);
}, { forza: 3, seme: 5 });

export const superficieIntonaco = () => conRilievo(512, 512, (c, h, l, a, caso) => {
  c.fillStyle = '#efe9df';
  c.fillRect(0, 0, l, a);
  h.fillStyle = '#808080';
  h.fillRect(0, 0, l, a);
  sporca(c, l, a, caso, 30, 'rgba(255,255,250,0.22)', 110);
  sporca(c, l, a, caso, 26, 'rgba(120,100,80,0.10)', 90);
  for (let i = 0; i < 26; i++) {
    const x = caso() * l;
    const y0 = caso() * a;
    const lungo = 40 + caso() * 160;
    const largo = 3 + caso() * 10;
    const g = c.createLinearGradient(0, y0, 0, y0 + lungo);
    g.addColorStop(0, 'rgba(70,60,50,0.12)');
    g.addColorStop(1, 'rgba(70,60,50,0)');
    c.fillStyle = g;
    avvolto(l, a, x, y0, lungo, (px, py) => c.fillRect(px - largo / 2, py, largo, lungo));
  }
  granella(c, l, a, caso, 30000, 'rgba(255,255,255,0.10)', 'rgba(60,45,30,0.07)', 2);
  granella(h, l, a, caso, 30000, 'rgba(255,255,255,0.20)', 'rgba(0,0,0,0.20)', 2);
  c.strokeStyle = 'rgba(60,50,40,0.25)';
  h.strokeStyle = 'rgba(0,0,0,0.6)';
  for (let i = 0; i < 4; i++) {
    let x = caso() * l;
    let y = caso() * a;
    c.beginPath(); h.beginPath();
    c.moveTo(x, y); h.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += (caso() - 0.5) * 18;
      y += 4 + caso() * 10;
      c.lineTo(x, y); h.lineTo(x, y);
    }
    c.lineWidth = 1; h.lineWidth = 1.5;
    c.stroke(); h.stroke();
  }
}, { forza: 1.4, seme: 7 });

export const superficiePersiana = () => conRilievo(128, 256, (c, h, l, a) => {
  c.fillStyle = '#c8c8c8';
  c.fillRect(0, 0, l, a);
  h.fillStyle = '#b0b0b0';
  h.fillRect(0, 0, l, a);
  const bordo = 10;
  c.fillStyle = '#d8d8d8';
  c.fillRect(0, 0, l, a);
  h.fillStyle = '#ffffff';
  h.fillRect(0, 0, l, bordo); h.fillRect(0, a - bordo, l, bordo); h.fillRect(0, 0, bordo, a); h.fillRect(l - bordo, 0, bordo, a);
  for (let y = bordo; y < a - bordo; y += 9) {
    const g = c.createLinearGradient(0, y, 0, y + 9);
    g.addColorStop(0, '#e6e6e6');
    g.addColorStop(0.7, '#9a9a9a');
    g.addColorStop(1, '#4a4a4a');
    c.fillStyle = g;
    c.fillRect(bordo, y, l - bordo * 2, 9);
    const gh = h.createLinearGradient(0, y, 0, y + 9);
    gh.addColorStop(0, '#f0f0f0');
    gh.addColorStop(1, '#303030');
    h.fillStyle = gh;
    h.fillRect(bordo, y, l - bordo * 2, 9);
  }
  c.strokeStyle = '#5a5a5a';
  c.lineWidth = 2;
  c.strokeRect(1, 1, l - 2, a - 2);
}, { forza: 4, seme: 9 });

export const superficieSaracinesca = () => conRilievo(128, 128, (c, h, l, a) => {
  for (let y = 0; y < a; y += 8) {
    const g = c.createLinearGradient(0, y, 0, y + 8);
    g.addColorStop(0, '#c9ccd0');
    g.addColorStop(0.5, '#8a8e94');
    g.addColorStop(1, '#55585c');
    c.fillStyle = g;
    c.fillRect(0, y, l, 8);
    const gh = h.createLinearGradient(0, y, 0, y + 8);
    gh.addColorStop(0, '#fff');
    gh.addColorStop(1, '#000');
    h.fillStyle = gh;
    h.fillRect(0, y, l, 8);
  }
}, { forza: 3, seme: 11 });

function vetrata(ctx, l, a, sfondo) {
  ctx.fillStyle = sfondo;
  ctx.fillRect(0, 0, l, a);
  ctx.fillStyle = '#3a2a1c';
  const telaio = l * 0.07;
  ctx.fillRect(0, 0, l, telaio);
  ctx.fillRect(0, a - telaio, l, telaio);
  ctx.fillRect(0, 0, telaio, a);
  ctx.fillRect(l - telaio, 0, telaio, a);
  ctx.fillRect(l / 2 - telaio / 2, 0, telaio, a);
  ctx.fillRect(0, a * 0.36, l, telaio * 0.7);
}

export function texturaVetroSpento() {
  const canvas = telaVuota(128, 256);
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 128, 256);
  g.addColorStop(0, '#2b3446');
  g.addColorStop(0.45, '#121722');
  g.addColorStop(0.55, '#1c2433');
  g.addColorStop(1, '#0b0e14');
  vetrata(ctx, 128, 256, g);
  ctx.fillStyle = 'rgba(160,180,210,0.10)';
  ctx.beginPath(); ctx.moveTo(20, 256); ctx.lineTo(70, 0); ctx.lineTo(90, 0); ctx.lineTo(40, 256); ctx.fill();
  return comeTexture(canvas, { ripeti: false });
}

export function texturaVetroAcceso() {
  const canvas = telaVuota(256, 256);
  const ctx = canvas.getContext('2d');
  const caso = creaCaso(77);
  for (let v = 0; v < 2; v++) {
    const x0 = v * 128;
    const g = ctx.createLinearGradient(x0, 0, x0, 256);
    g.addColorStop(0, v ? '#ffcf8a' : '#ffd9a0');
    g.addColorStop(1, v ? '#b86a2a' : '#c88a44');
    ctx.fillStyle = g;
    ctx.fillRect(x0, 0, 128, 256);
    for (let k = 0; k < 14; k++) {
      const x = x0 + (k / 14) * 128;
      const p = ctx.createLinearGradient(x, 0, x + 128 / 14, 0);
      p.addColorStop(0, 'rgba(90,40,10,0.32)');
      p.addColorStop(0.5, 'rgba(255,240,210,0.10)');
      p.addColorStop(1, 'rgba(90,40,10,0.32)');
      ctx.fillStyle = p;
      ctx.fillRect(x, 0, 128 / 14, 256);
    }
    if (v) {
      ctx.fillStyle = 'rgba(40,20,10,0.55)';
      ctx.beginPath(); ctx.ellipse(x0 + 64 + (caso() - 0.5) * 30, 150, 18, 30, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x0 + 64 + (caso() - 0.5) * 30, 108, 12, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save();
    ctx.translate(x0, 0);
    ctx.beginPath(); ctx.rect(0, 0, 128, 256); ctx.clip();
    const telaio = 128 * 0.07;
    ctx.fillStyle = '#2a1c10';
    ctx.fillRect(0, 0, 128, telaio); ctx.fillRect(0, 256 - telaio, 128, telaio);
    ctx.fillRect(0, 0, telaio, 256); ctx.fillRect(128 - telaio, 0, telaio, 256);
    ctx.fillRect(64 - telaio / 2, 0, telaio, 256);
    ctx.fillRect(0, 256 * 0.36, 128, telaio * 0.7);
    ctx.restore();
  }
  return comeTexture(canvas, { ripeti: false });
}

export function texturaVetrina() {
  const canvas = telaVuota(256, 128);
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#20283a');
  g.addColorStop(1, '#0a0c12');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = 'rgba(170,190,220,0.10)';
  ctx.beginPath(); ctx.moveTo(30, 128); ctx.lineTo(110, 0); ctx.lineTo(140, 0); ctx.lineTo(60, 128); ctx.fill();
  ctx.fillStyle = '#2a2c30';
  ctx.fillRect(0, 0, 256, 6); ctx.fillRect(0, 122, 256, 6); ctx.fillRect(0, 0, 6, 128); ctx.fillRect(250, 0, 6, 128); ctx.fillRect(125, 0, 6, 128);
  return comeTexture(canvas, { ripeti: false });
}
