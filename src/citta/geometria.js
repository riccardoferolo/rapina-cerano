export const distanza = (ax, az, bx, bz) => Math.hypot(bx - ax, bz - az);

export function areaFirmata(anello) {
  let s = 0;
  for (let i = 0, j = anello.length - 1; i < anello.length; j = i++) s += anello[j][0] * anello[i][1] - anello[i][0] * anello[j][1];
  return s / 2;
}

export function baricentro(anello) {
  let a = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0, j = anello.length - 1; i < anello.length; j = i++) {
    const f = anello[j][0] * anello[i][1] - anello[i][0] * anello[j][1];
    a += f;
    cx += (anello[j][0] + anello[i][0]) * f;
    cz += (anello[j][1] + anello[i][1]) * f;
  }
  if (Math.abs(a) < 1e-9) {
    const n = anello.length;
    return [anello.reduce((s, p) => s + p[0], 0) / n, anello.reduce((s, p) => s + p[1], 0) / n];
  }
  return [cx / (3 * a), cz / (3 * a)];
}

export function dentro(x, z, anello) {
  let d = false;
  for (let i = 0, j = anello.length - 1; i < anello.length; j = i++) {
    const [xi, zi] = anello[i];
    const [xj, zj] = anello[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) d = !d;
  }
  return d;
}

export function puntoSegmento(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  const qx = ax + dx * t;
  const qz = az + dz * t;
  return { x: qx, z: qz, t, d: Math.hypot(px - qx, pz - qz) };
}

export function intersezioneRaggio(ox, oz, dx, dz, ax, az, bx, bz) {
  const ex = bx - ax;
  const ez = bz - az;
  const den = dx * ez - dz * ex;
  if (Math.abs(den) < 1e-12) return Infinity;
  const t = ((ax - ox) * ez - (az - oz) * ex) / den;
  const u = ((ax - ox) * dz - (az - oz) * dx) / den;
  return t >= 0 && u >= 0 && u <= 1 ? t : Infinity;
}

export function lunghezzaLinea(punti) {
  let l = 0;
  for (let i = 1; i < punti.length; i++) l += distanza(punti[i - 1][0], punti[i - 1][1], punti[i][0], punti[i][1]);
  return l;
}

export function campionaLinea(punti, passo) {
  const out = [];
  let resto = 0;
  for (let i = 1; i < punti.length; i++) {
    const [ax, az] = punti[i - 1];
    const [bx, bz] = punti[i];
    const l = distanza(ax, az, bx, bz);
    if (l < 1e-6) continue;
    const ux = (bx - ax) / l;
    const uz = (bz - az) / l;
    for (let s = resto; s <= l; s += passo) out.push({ x: ax + ux * s, z: az + uz * s, ux, uz, i });
    resto = (resto - l) % passo;
    if (resto < 0) resto += passo;
  }
  return out;
}

export function semplifica(anello, tolleranza = 0.15) {
  let punti = anello.filter((p, i) => i === 0 || distanza(p[0], p[1], anello[i - 1][0], anello[i - 1][1]) > 0.05);
  if (punti.length > 1 && distanza(punti[0][0], punti[0][1], punti.at(-1)[0], punti.at(-1)[1]) < 0.05) punti.pop();
  let cambiato = true;
  while (cambiato && punti.length > 3) {
    cambiato = false;
    for (let i = 0; i < punti.length; i++) {
      const a = punti[(i - 1 + punti.length) % punti.length];
      const b = punti[i];
      const c = punti[(i + 1) % punti.length];
      if (puntoSegmento(b[0], b[1], a[0], a[1], c[0], c[1]).d < tolleranza) {
        punti.splice(i, 1);
        cambiato = true;
        break;
      }
    }
  }
  return punti;
}

export function rientra(anello, d) {
  const n = anello.length;
  const out = [];
  const segno = areaFirmata(anello) > 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const p = anello[(i - 1 + n) % n];
    const c = anello[i];
    const s = anello[(i + 1) % n];
    const l1 = Math.hypot(c[0] - p[0], c[1] - p[1]) || 1;
    const l2 = Math.hypot(s[0] - c[0], s[1] - c[1]) || 1;
    const n1 = [(-(c[1] - p[1]) / l1) * segno, ((c[0] - p[0]) / l1) * segno];
    const n2 = [(-(s[1] - c[1]) / l2) * segno, ((s[0] - c[0]) / l2) * segno];
    let mx = n1[0] + n2[0];
    let mz = n1[1] + n2[1];
    const lm = Math.hypot(mx, mz);
    if (lm < 1e-6) {
      out.push([c[0] + n1[0] * d, c[1] + n1[1] * d]);
      continue;
    }
    mx /= lm;
    mz /= lm;
    const coseno = Math.max(0.35, mx * n1[0] + mz * n1[1]);
    out.push([c[0] + (mx * d) / coseno, c[1] + (mz * d) / coseno]);
  }
  return out;
}

export function scatola(anello) {
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const [x, z] of anello) {
    x0 = Math.min(x0, x);
    z0 = Math.min(z0, z);
    x1 = Math.max(x1, x);
    z1 = Math.max(z1, z);
  }
  return { x0, z0, x1, z1 };
}

export function assePrincipale(anello) {
  let migliore = 0;
  let angolo = 0;
  for (let i = 0; i < anello.length; i++) {
    const a = anello[i];
    const b = anello[(i + 1) % anello.length];
    const l = distanza(a[0], a[1], b[0], b[1]);
    if (l > migliore) {
      migliore = l;
      angolo = Math.atan2(b[1] - a[1], b[0] - a[0]);
    }
  }
  return angolo;
}

export function larghezzaMinima(anello) {
  const ang = assePrincipale(anello);
  const c = Math.cos(-ang);
  const s = Math.sin(-ang);
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  for (const [x, z] of anello) {
    const u = x * c - z * s;
    const v = x * s + z * c;
    u0 = Math.min(u0, u);
    u1 = Math.max(u1, u);
    v0 = Math.min(v0, v);
    v1 = Math.max(v1, v);
  }
  return { lungo: u1 - u0, largo: v1 - v0, angolo: ang };
}

export function hashNumero(n) {
  let h = (n >>> 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
