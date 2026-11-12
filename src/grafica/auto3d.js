import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { VEICOLI } from '../gioco/regole.js';

const SAGOME = Object.freeze({
  utilitaria: { corpo: [[0, 0.32], [0, 0.86], [0.05, 0.95], [0.3, 0.98], [0.8, 0.93], [0.96, 0.8], [1, 0.62], [1, 0.32]], cabina: [[0.07, 0.95], [0.15, 1.44], [0.6, 1.47], [0.79, 0.95]], ruote: [0.17, 0.81] },
  berlina: { corpo: [[0, 0.34], [0, 0.8], [0.04, 0.92], [0.24, 0.95], [0.72, 0.93], [0.95, 0.8], [1, 0.62], [1, 0.34]], cabina: [[0.17, 0.94], [0.3, 1.42], [0.6, 1.44], [0.75, 0.94]], ruote: [0.18, 0.8] },
  volante: { corpo: [[0, 0.34], [0, 0.8], [0.04, 0.92], [0.24, 0.95], [0.72, 0.93], [0.95, 0.8], [1, 0.62], [1, 0.34]], cabina: [[0.17, 0.94], [0.3, 1.42], [0.6, 1.44], [0.75, 0.94]], ruote: [0.18, 0.8] },
  furgone: { corpo: [[0, 0.38], [0, 2.22], [0.76, 2.24], [0.84, 2.05], [0.95, 1.22], [1, 1.0], [1, 0.38]], cabina: [[0.82, 1.2], [0.84, 1.95], [0.94, 1.22]], ruote: [0.16, 0.8] },
  blindato: { corpo: [[0, 0.45], [0, 2.4], [0.7, 2.42], [0.72, 2.2], [0.86, 2.15], [0.95, 1.4], [1, 1.1], [1, 0.45]], cabina: [[0.72, 1.45], [0.73, 2.02], [0.85, 2.0], [0.93, 1.42]], ruote: [0.15, 0.82] },
});

function estrusa(punti, lungo, largo, smusso) {
  const forma = new THREE.Shape();
  punti.forEach(([a, y], i) => (i ? forma.lineTo(a * lungo - lungo / 2, y) : forma.moveTo(a * lungo - lungo / 2, y)));
  const g = new THREE.ExtrudeGeometry(forma, { depth: Math.max(0.01, largo - smusso * 2), bevelEnabled: smusso > 0, bevelThickness: smusso, bevelSize: smusso, bevelSegments: 3, curveSegments: 4 });
  g.translate(0, 0, -(largo - smusso * 2) / 2);
  g.rotateY(Math.PI / 2);
  return g.index ? g.toNonIndexed() : g;
}

function colora(g, colore) {
  const c = new THREE.Color(colore);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}

function scatola(l, a, p, x, y, z, colore) {
  return colora(new THREE.BoxGeometry(l, a, p).toNonIndexed().translate(x, y, z), colore);
}

export function geometriaAuto(tipo, { vernice = 0xffffff, ruoteSeparate = false } = {}) {
  const d = VEICOLI[tipo];
  const s = SAGOME[tipo];
  const L = d.lungo;
  const W = d.largo;
  const pezzi = [];
  const corpo = colora(estrusa(s.corpo, L, W, 0.07), vernice);
  pezzi.push(corpo);
  const vetro = 0x0c1118;
  if (tipo === 'furgone' || tipo === 'blindato') {
    pezzi.push(colora(estrusa(s.cabina, L, W + 0.004, 0.02), vetro));
    pezzi.push(scatola(0.02, 0.5, 0.75, -W / 2 - 0.006, (s.cabina[0][1] + s.cabina[1][1]) / 2 + 0.05, -L * 0.36, vetro));
    pezzi.push(scatola(0.02, 0.5, 0.75, W / 2 + 0.006, (s.cabina[0][1] + s.cabina[1][1]) / 2 + 0.05, -L * 0.36, vetro));
  } else {
    pezzi.push(colora(estrusa(s.cabina, L, W - 0.16, 0.05), vetro));
    const tetto = s.cabina.slice(1, 3);
    const yTetto = Math.max(tetto[0][1], tetto[1][1]);
    const z0 = -(tetto[1][0] * L - L / 2);
    const z1 = -(tetto[0][0] * L - L / 2);
    pezzi.push(scatola(W - 0.22, 0.05, Math.abs(z1 - z0) + 0.06, 0, yTetto + 0.015, (z0 + z1) / 2, vernice));
    const montanti = [s.cabina[0], s.cabina[1], [(s.cabina[1][0] + s.cabina[2][0]) / 2, s.cabina[2][1]], s.cabina[2], s.cabina[3]];
    for (const lato of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const [aa, ya] = i === 0 ? s.cabina[0] : s.cabina[3];
        const [ab, yb] = i === 0 ? s.cabina[1] : s.cabina[2];
        const za = -(aa * L - L / 2);
        const zb = -(ab * L - L / 2);
        const lungo = Math.hypot(zb - za, yb - ya);
        const g = colora(new THREE.BoxGeometry(0.05, lungo, 0.08).toNonIndexed(), vernice);
        g.rotateX(Math.atan2(zb - za, yb - ya));
        g.translate(lato * (W / 2 - 0.1), (ya + yb) / 2, (za + zb) / 2);
        pezzi.push(g);
      }
      const mz = -((montanti[2][0]) * L - L / 2);
      pezzi.push(scatola(0.06, s.cabina[1][1] - s.cabina[0][1] - 0.04, 0.07, lato * (W / 2 - 0.09), (s.cabina[0][1] + s.cabina[1][1]) / 2, mz, vernice));
      pezzi.push(scatola(0.1, 0.06, 0.16, lato * (W / 2 + 0.04), s.corpo[3][1] + 0.05, -L * 0.18, vernice));
    }
  }
  const scuro = 0x16171a;
  pezzi.push(scatola(W + 0.02, 0.22, 0.12, 0, 0.42, -L / 2 + 0.03, scuro));
  pezzi.push(scatola(W + 0.02, 0.22, 0.12, 0, 0.42, L / 2 - 0.03, scuro));
  pezzi.push(scatola(W - 0.06, 0.06, L - 0.3, 0, 0.3, 0, scuro));
  pezzi.push(scatola(0.52, 0.11, 0.02, 0, 0.5, -L / 2 - 0.04, 0xf2f2ee));
  pezzi.push(scatola(0.52, 0.11, 0.02, 0, 0.6, L / 2 + 0.04, 0xf2f2ee));
  const ruote = [];
  const rRuota = tipo === 'furgone' || tipo === 'blindato' ? 0.38 : 0.31;
  for (const a of s.ruote) {
    for (const lato of [-1, 1]) {
      const z = -(a * L - L / 2);
      const pneumatico = colora(new THREE.CylinderGeometry(rRuota, rRuota, 0.22, 18).rotateZ(Math.PI / 2).toNonIndexed(), 0x111111);
      const cerchio = colora(new THREE.CylinderGeometry(rRuota * 0.62, rRuota * 0.62, 0.23, 12).rotateZ(Math.PI / 2).toNonIndexed(), 0x8a8e94);
      const ruota = mergeGeometries([pneumatico, cerchio]);
      if (ruoteSeparate) ruote.push({ geometria: ruota, x: lato * (W / 2 - 0.13), y: rRuota, z, anteriore: a > 0.5 });
      else pezzi.push(ruota.translate(lato * (W / 2 - 0.13), rRuota, z));
      pezzi.push(scatola(0.06, rRuota * 0.9, rRuota * 2.3, lato * (W / 2 - 0.02), rRuota + 0.12, z, scuro));
    }
  }
  return { corpo: mergeGeometries(pezzi), ruote, rRuota };
}

function texturaLivrea() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e8eaee';
  ctx.fillRect(0, 0, 512, 64);
  ctx.fillStyle = '#c51d1d';
  ctx.fillRect(0, 44, 512, 10);
  ctx.fillStyle = '#1d2c4a';
  ctx.font = 'bold 40px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('POLIZIA', 256, 36);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function creaMaterialiAuto() {
  return {
    vernice: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.45 }),
    fari: new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff2d0, emissiveIntensity: 2.5 }),
    stop: new THREE.MeshStandardMaterial({ color: 0x7a0a0a, emissive: 0xff1a10, emissiveIntensity: 1.2 }),
    blu: new THREE.MeshStandardMaterial({ color: 0x1030ff, emissive: 0x2050ff, emissiveIntensity: 0 }),
    rosso: new THREE.MeshStandardMaterial({ color: 0xff1010, emissive: 0xff2020, emissiveIntensity: 0 }),
    livrea: new THREE.MeshStandardMaterial({ map: texturaLivrea(), roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -2 }),
  };
}

const geometrieAuto = new Map();
function geometriaCondivisa(tipo, colore) {
  const k = `${tipo}|${colore}`;
  if (!geometrieAuto.has(k)) geometrieAuto.set(k, geometriaAuto(tipo, { vernice: colore, ruoteSeparate: true }));
  return geometrieAuto.get(k);
}

export function creaAuto(scena, tipo, materiali, colore) {
  const d = VEICOLI[tipo];
  const radice = new THREE.Group();
  const { corpo, ruote } = geometriaCondivisa(tipo, colore ?? d.colore);
  const m = new THREE.Mesh(corpo, materiali.vernice);
  m.castShadow = true;
  radice.add(m);
  const mRuote = ruote.map(r => {
    const perno = new THREE.Group();
    perno.position.set(r.x, r.y, r.z);
    const mesh = new THREE.Mesh(r.geometria, materiali.vernice);
    mesh.castShadow = true;
    perno.add(mesh);
    radice.add(perno);
    return { perno, mesh, anteriore: r.anteriore };
  });
  const L = d.lungo;
  const W = d.largo;
  for (const lato of [-1, 1]) {
    const faro = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.04), materiali.fari);
    faro.position.set(lato * (W / 2 - 0.28), 0.72, -L / 2 - 0.02);
    const stop = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.04), materiali.stop);
    stop.position.set(lato * (W / 2 - 0.22), tipo === 'furgone' || tipo === 'blindato' ? 1 : 0.78, L / 2 + 0.02);
    radice.add(faro, stop);
  }
  let lampeggianti = null;
  if (tipo === 'volante') {
    const barra = new THREE.Group();
    const blu = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.11, 0.24), materiali.blu.clone());
    blu.position.x = -0.28;
    const blu2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.11, 0.24), materiali.blu.clone());
    blu2.position.x = 0.28;
    barra.add(blu, blu2);
    barra.position.set(0, 1.5, 0.1);
    radice.add(barra);
    lampeggianti = [blu, blu2];
    for (const lato of [-1, 1]) {
      const fascia = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.62, 0.22), materiali.livrea);
      fascia.position.set(lato * (W / 2 + 0.01), 0.72, 0.1);
      fascia.rotation.y = lato * Math.PI / 2;
      radice.add(fascia);
    }
  }
  scena.add(radice);
  let giro = 0;
  return {
    radice,
    aggiorna(v, dt, tempo) {
      radice.position.set(v.x, 0.02, v.z);
      radice.rotation.y = v.yaw;
      const vel = -(v.vx * Math.sin(v.yaw) + v.vz * Math.cos(v.yaw));
      giro += (vel / 0.32) * dt;
      for (const r of mRuote) {
        r.mesh.rotation.x = -giro;
        r.perno.rotation.y = r.anteriore ? -(v.sterzo ?? 0) * 0.5 : 0;
      }
      if (lampeggianti) {
        const fase = Math.floor(tempo * 6) % 2;
        lampeggianti[0].material.emissiveIntensity = v.sirena && fase ? 6 : 0;
        lampeggianti[1].material.emissiveIntensity = v.sirena && !fase ? 6 : 0;
      }
      radice.rotation.z = Math.max(-0.05, Math.min(0.05, (v.sterzo ?? 0) * Math.min(1, Math.abs(vel) / 15) * 0.05));
    },
    chiudi() {
      scena.remove(radice);
    },
  };
}

export function creaParco(scena, materiali) {
  const auto = new Map();
  const deposito = new Map();
  const chiave = (tipo, colore) => `${tipo}|${colore ?? ''}`;
  const prendi = (tipo, colore) => {
    const k = chiave(tipo, colore);
    const libere = deposito.get(k);
    if (libere?.length) {
      const a = libere.pop();
      a.radice.visible = true;
      return a;
    }
    const a = creaAuto(scena, tipo, materiali, colore ?? undefined);
    a.tipo = k;
    return a;
  };
  return {
    riempi(quanti) {
      for (const [tipo, n] of Object.entries(quanti)) {
        for (let i = 0; i < n; i++) {
          const a = creaAuto(scena, tipo, materiali);
          a.tipo = chiave(tipo, null);
          a.radice.visible = false;
          if (!deposito.has(a.tipo)) deposito.set(a.tipo, []);
          deposito.get(a.tipo).push(a);
        }
      }
    },
    aggiorna(veicoli, dt, tempo) {
      const presenti = new Set();
      for (const v of veicoli ?? []) {
        presenti.add(v.id);
        if (!auto.has(v.id)) auto.set(v.id, prendi(v.tipo, v.colore));
        auto.get(v.id).aggiorna(v, dt, tempo);
      }
      for (const [id, a] of auto) {
        if (presenti.has(id)) continue;
        a.radice.visible = false;
        if (!deposito.has(a.tipo)) deposito.set(a.tipo, []);
        deposito.get(a.tipo).push(a);
        auto.delete(id);
      }
    },
    radice: id => auto.get(id)?.radice ?? null,
    svuota() {
      for (const a of auto.values()) a.chiudi();
      auto.clear();
    },
  };
}

export function costruisciParcheggi(scena, parcheggi, materiali) {
  const LATO = 320;
  const geometrie = Object.fromEntries(['utilitaria', 'berlina'].map(t => [t, geometriaAuto(t).corpo]));
  const celle = new Map();
  for (const a of parcheggi) {
    const k = `${Math.floor(a.x / LATO)}|${Math.floor(a.z / LATO)}|${a.modello}`;
    if (!celle.has(k)) celle.set(k, { x: (Math.floor(a.x / LATO) + 0.5) * LATO, z: (Math.floor(a.z / LATO) + 0.5) * LATO, modello: a.modello, voci: [] });
    celle.get(k).voci.push(a);
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const su = new THREE.Vector3(0, 1, 0);
  const uno = new THREE.Vector3(1, 1, 1);
  const colore = new THREE.Color();
  const gruppi = [];
  for (const c of celle.values()) {
    const im = new THREE.InstancedMesh(geometrie[c.modello], materiali.vernice, c.voci.length);
    c.voci.forEach((a, i) => {
      im.setMatrixAt(i, m.compose(new THREE.Vector3(a.x, 0.02, a.z), q.setFromAxisAngle(su, a.yaw), uno));
      im.setColorAt(i, colore.setHex(a.colore));
    });
    im.computeBoundingSphere();
    im.castShadow = true;
    scena.add(im);
    gruppi.push({ im, x: c.x, z: c.z });
  }
  return {
    aggiorna(camera, distanza) {
      for (const g of gruppi) {
        const d = Math.hypot(g.x - camera.position.x, g.z - camera.position.z) - LATO * 0.72;
        g.im.visible = d < Math.min(distanza, 420);
        g.im.castShadow = d < 120;
      }
    },
  };
}
