import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { creaCaso } from './caso-grafica.js';
import { dentro, scatola, areaFirmata } from '../citta/geometria.js';

const LATO_CELLA = 320;
const OMBRE_ENTRO = 55;
const VICINO = 190;
const DENSITA_BOSCO = 1 / 70;
const MASSIMO_BOSCO = 14000;

function texturaFoglie(seme) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const caso = creaCaso(seme);
  for (let i = 0; i < 1400; i++) {
    const a = caso() * Math.PI * 2;
    const r = Math.pow(caso(), 0.6) * 104;
    const x = 128 + Math.cos(a) * r;
    const y = 128 + Math.sin(a) * r;
    const v = 0.55 + caso() * 0.55;
    const ombra = 1 - (r / 128) * 0.25;
    ctx.fillStyle = `rgb(${Math.round(70 * v * ombra)},${Math.round(104 * v * ombra)},${Math.round(46 * v * ombra)})`;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(caso() * Math.PI);
    ctx.beginPath();
    ctx.ellipse(0, 0, 3 + caso() * 4, 1.5 + caso() * 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(60,44,30,0.9)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.moveTo(128, 128);
    const a = caso() * Math.PI * 2;
    ctx.lineTo(128 + Math.cos(a) * 70, 128 + Math.sin(a) * 70);
    ctx.stroke();
  }
  ctx.fillStyle = '#5a4636';
  ctx.fillRect(0, 240, 16, 16);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function chioma(carte, raggio, altezza, seme) {
  const caso = creaCaso(seme);
  const pezzi = [];
  for (let i = 0; i < carte; i++) {
    const g = new THREE.PlaneGeometry(raggio * 1.25, raggio * 1.25);
    const u = caso() * 2 - 1;
    const a = caso() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    const d = 0.25 + caso() * 0.55;
    const centro = new THREE.Vector3(Math.cos(a) * r * raggio * d, altezza + u * raggio * 0.65 * d, Math.sin(a) * r * raggio * d);
    const uvc = g.attributes.uv;
    for (let k = 0; k < uvc.count; k++) uvc.setXY(k, 0.08 + uvc.getX(k) * 0.92, 0.08 + uvc.getY(k) * 0.92);
    g.rotateX(caso() * Math.PI);
    g.rotateY(caso() * Math.PI);
    g.rotateZ(caso() * Math.PI);
    g.translate(centro.x, centro.y, centro.z);
    const p = g.attributes.position;
    const n = g.attributes.normal;
    for (let k = 0; k < p.count; k++) {
      const v = new THREE.Vector3(p.getX(k), p.getY(k) - altezza, p.getZ(k)).normalize();
      n.setXYZ(k, v.x, v.y * 0.8 + 0.2, v.z);
    }
    pezzi.push(g);
  }
  return mergeGeometries(pezzi, false);
}

function tronco(alto, raggio) {
  const g = new THREE.CylinderGeometry(raggio * 0.6, raggio, alto, 6, 1, true);
  g.translate(0, alto / 2, 0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.04, 0.04);
  return g;
}

function albero(carte, raggio, altezza, alto, rTronco, seme) {
  return mergeGeometries([chioma(carte, raggio, altezza, seme), tronco(alto, rTronco)], false);
}

export function costruisciAlberi(scena, dati, { densita = 1, esclusoDa = () => false } = {}) {
  const caso = creaCaso(11);
  const punti = dati.alberi.map(([x, z, s]) => [x, z, s]);
  let bosco = 0;
  for (const a of dati.aree) {
    if (a.t !== 'bosco' && a.t !== 'parco') continue;
    const s = scatola(a.p);
    const area = areaFirmata(a.p);
    const quanti = Math.min(4000, Math.floor(area * DENSITA_BOSCO * (a.t === 'parco' ? 0.25 : 1)));
    for (let i = 0; i < quanti * 3 && bosco < MASSIMO_BOSCO; i++) {
      const x = s.x0 + caso() * (s.x1 - s.x0);
      const z = s.z0 + caso() * (s.z1 - s.z0);
      if (Math.abs(x) > dati.limite || Math.abs(z) > dati.limite || !dentro(x, z, a.p) || esclusoDa(x, z)) continue;
      punti.push([x, z, 0.8 + caso() * 0.7]);
      bosco += 1;
      if (i > quanti) break;
    }
  }
  const foglie = new THREE.MeshStandardMaterial({ map: texturaFoglie(5), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9 });
  const vicina = albero(20, 2.8, 5.8, 4.6, 0.24, 1);
  const lontana = albero(7, 3.0, 5.8, 4.6, 0.24, 2);
  const celle = new Map();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const asse = new THREE.Vector3(0, 1, 0);
  const tinta = new THREE.Color();
  for (const [x, z, s] of punti) {
    if (esclusoDa(x, z)) continue;
    if (densita < 1 && caso() > densita) continue;
    const k = `${Math.floor(x / LATO_CELLA)}|${Math.floor(z / LATO_CELLA)}`;
    if (!celle.has(k)) celle.set(k, { x: (Math.floor(x / LATO_CELLA) + 0.5) * LATO_CELLA, z: (Math.floor(z / LATO_CELLA) + 0.5) * LATO_CELLA, voci: [] });
    const scala = s * (0.75 + caso() * 0.45);
    m.compose(new THREE.Vector3(x, 0, z), q.setFromAxisAngle(asse, caso() * Math.PI * 2), new THREE.Vector3(scala, scala * (0.9 + caso() * 0.25), scala));
    const v = 0.75 + caso() * 0.45;
    tinta.setRGB(v * (0.85 + caso() * 0.2), v, v * (0.8 + caso() * 0.25));
    celle.get(k).voci.push({ matrice: m.clone(), colore: tinta.clone() });
  }
  const gruppi = [];
  for (const cella of celle.values()) {
    const crea = geometria => {
      const im = new THREE.InstancedMesh(geometria, foglie, cella.voci.length);
      cella.voci.forEach((v, i) => {
        im.setMatrixAt(i, v.matrice);
        im.setColorAt(i, v.colore);
      });
      im.computeBoundingSphere();
      scena.add(im);
      return im;
    };
    gruppi.push({ x: cella.x, z: cella.z, vicino: crea(vicina), lontano: crea(lontana) });
  }
  return {
    quanti: punti.length,
    aggiorna(camera, distanza) {
      const raggio = LATO_CELLA * 0.72;
      for (const g of gruppi) {
        const d = Math.hypot(g.x - camera.position.x, g.z - camera.position.z) - raggio;
        g.vicino.visible = d < VICINO;
        g.vicino.castShadow = d < OMBRE_ENTRO;
        g.lontano.visible = d >= VICINO && d < distanza;
      }
    },
  };
}
