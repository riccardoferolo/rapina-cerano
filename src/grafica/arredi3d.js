import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const Y_VERNICE = 0.042;
const SLOT = Object.freeze({ stop: 0, precedenza: 1, fermata: 2, retroOttagono: 3, retroTriangolo: 4, retroRettangolo: 5, semaforo: 6 });
const SLOT_TOTALI = 7;
const ALTO_CARTELLO = 2.3;

function atlanteCartelli() {
  const c = document.createElement('canvas');
  c.width = 128 * SLOT_TOTALI;
  c.height = 128;
  const ctx = c.getContext('2d');
  const ottagono = (cx, cy, r) => {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
  };
  const triangolo = (cx, cy, r) => {
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r * 0.8);
    ctx.lineTo(cx + r, cy - r * 0.8);
    ctx.lineTo(cx, cy + r * 0.95);
    ctx.closePath();
  };
  ottagono(64, 64, 62);
  ctx.fillStyle = '#f4f4f4';
  ctx.fill();
  ottagono(64, 64, 56);
  ctx.fillStyle = '#c4161c';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 38px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('STOP', 64, 66);
  triangolo(192, 60, 62);
  ctx.fillStyle = '#c4161c';
  ctx.fill();
  triangolo(192, 60, 44);
  ctx.fillStyle = '#f4f4f4';
  ctx.fill();
  ctx.fillStyle = '#1d4e9e';
  ctx.fillRect(256 + 8, 8, 112, 112);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(256 + 16, 16, 96, 96);
  ctx.fillStyle = '#1d4e9e';
  ctx.font = 'bold 30px Arial, sans-serif';
  ctx.fillText('BUS', 320, 48);
  ctx.font = 'bold 17px Arial, sans-serif';
  ctx.fillText('FERMATA', 320, 84);
  ottagono(384 + 64, 64, 62);
  ctx.fillStyle = '#8a8f94';
  ctx.fill();
  triangolo(576, 60, 62);
  ctx.fill();
  ctx.fillRect(640 + 8, 8, 112, 112);
  ctx.fillStyle = '#111214';
  ctx.fillRect(768, 0, 128, 128);
  for (const [y, colore] of [[22, '#3a0e0e'], [64, '#3a320e'], [106, '#2cff7a']]) {
    ctx.beginPath();
    ctx.ellipse(768 + 64, y, 36, 13, 0, 0, Math.PI * 2);
    ctx.fillStyle = colore;
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function materialiArredi() {
  const atlante = atlanteCartelli();
  const vernice = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  return {
    vernice,
    palo: new THREE.MeshStandardMaterial({ color: 0x8a8f94, roughness: 0.4, metalness: 0.6 }),
    cartelli: new THREE.MeshStandardMaterial({ map: atlante, alphaTest: 0.5, roughness: 0.5 }),
    luci: new THREE.MeshStandardMaterial({ map: atlante, emissive: 0xffffff, emissiveMap: atlante, emissiveIntensity: 0.9, alphaTest: 0.5, roughness: 0.4 }),
    nero: new THREE.MeshStandardMaterial({ color: 0x141517, roughness: 0.5, metalness: 0.4 }),
    pietra: new THREE.MeshStandardMaterial({ color: 0xc9c1b2, roughness: 0.88 }),
    pietraScura: new THREE.MeshStandardMaterial({ color: 0x8f877b, roughness: 0.9 }),
    acqua: new THREE.MeshStandardMaterial({ color: 0x2f5c6a, roughness: 0.04, metalness: 0.15 }),
    ghisa: new THREE.MeshStandardMaterial({ color: 0x2e4636, roughness: 0.5, metalness: 0.5 }),
  };
}

function creaRaccolta() {
  const perMateriale = new Map();
  const matrice = new THREE.Matrix4();
  const posizione = new THREE.Vector3();
  const rotazione = new THREE.Quaternion();
  const scala = new THREE.Vector3(1, 1, 1);
  const asseY = new THREE.Vector3(0, 1, 0);
  return {
    metti(materiale, geometria, x, y, z, yaw = 0) {
      posizione.set(x, y, z);
      rotazione.setFromAxisAngle(asseY, yaw);
      matrice.compose(posizione, rotazione, scala);
      const g = geometria.index ? geometria : geometria.setIndex([...Array(geometria.attributes.position.count).keys()]);
      g.applyMatrix4(matrice);
      if (!perMateriale.has(materiale)) perMateriale.set(materiale, []);
      perMateriale.get(materiale).push(g);
    },
    finisci(gruppo) {
      for (const [materiale, geometrie] of perMateriale) {
        const unita = mergeGeometries(geometrie, false);
        unita.computeBoundingSphere();
        const mesh = new THREE.Mesh(unita, materiale);
        mesh.matrixAutoUpdate = false;
        mesh.receiveShadow = true;
        mesh.castShadow = materiale !== gruppo.userData.senzaOmbra;
        gruppo.add(mesh);
      }
    },
  };
}

function pianoSlot(largo, alto, slot, retro = false) {
  const g = new THREE.PlaneGeometry(largo, alto);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, (slot + (retro ? 1 - uv.getX(i) : uv.getX(i))) / SLOT_TOTALI);
  if (retro) g.rotateY(Math.PI);
  return g;
}

function capovolgi(g) {
  const n = g.attributes.normal;
  for (let i = 0; i < n.array.length; i++) n.array[i] = -n.array[i];
  const indice = g.index.array;
  for (let t = 0; t < indice.length; t += 3) [indice[t + 1], indice[t + 2]] = [indice[t + 2], indice[t + 1]];
  return g;
}

function rettangoloTerra(lungo, largo) {
  return new THREE.PlaneGeometry(lungo, largo).rotateX(-Math.PI / 2);
}

function cartello(r, mat, x, y, z, yaw, slot, retro, largo) {
  r.metti(mat.palo, new THREE.CylinderGeometry(0.035, 0.035, ALTO_CARTELLO + 0.3, 8).translate(0, (ALTO_CARTELLO + 0.3) / 2, 0), x, y, z, yaw);
  r.metti(mat.cartelli, pianoSlot(largo, largo, slot).translate(0, ALTO_CARTELLO, 0.045), x, y, z, yaw);
  r.metti(mat.cartelli, pianoSlot(largo, largo, retro, true).translate(0, ALTO_CARTELLO, 0.04), x, y, z, yaw);
}

function fontana(r, mat, x, y, z) {
  r.metti(mat.pietra, new THREE.CylinderGeometry(1.75, 1.85, 0.55, 40, 1, true).translate(0, 0.275, 0), x, y, z);
  r.metti(mat.pietra, new THREE.RingGeometry(1.5, 1.78, 40).rotateX(-Math.PI / 2).translate(0, 0.55, 0), x, y, z);
  r.metti(mat.pietraScura, capovolgi(new THREE.CylinderGeometry(1.5, 1.5, 0.5, 40, 1, true)).translate(0, 0.3, 0), x, y, z);
  r.metti(mat.acqua, new THREE.CircleGeometry(1.5, 40).rotateX(-Math.PI / 2).translate(0, 0.42, 0), x, y, z);
  r.metti(mat.pietra, new THREE.CylinderGeometry(0.22, 0.32, 1.25, 16).translate(0, 0.62, 0), x, y, z);
  r.metti(mat.pietra, new THREE.CylinderGeometry(0.62, 0.2, 0.22, 24).translate(0, 1.3, 0), x, y, z);
  r.metti(mat.acqua, new THREE.CircleGeometry(0.56, 24).rotateX(-Math.PI / 2).translate(0, 1.38, 0), x, y, z);
  r.metti(mat.pietra, new THREE.SphereGeometry(0.16, 14, 10).translate(0, 1.55, 0), x, y, z);
}

function monumento(r, mat, x, y, z, yaw) {
  r.metti(mat.pietraScura, new THREE.BoxGeometry(3.2, 0.25, 3.2).translate(0, 0.125, 0), x, y, z, yaw);
  r.metti(mat.pietra, new THREE.BoxGeometry(2.4, 0.3, 2.4).translate(0, 0.4, 0), x, y, z, yaw);
  r.metti(mat.pietra, new THREE.BoxGeometry(1.3, 1.7, 1.3).translate(0, 1.4, 0), x, y, z, yaw);
  r.metti(mat.pietraScura, new THREE.BoxGeometry(1.45, 0.14, 1.45).translate(0, 2.32, 0), x, y, z, yaw);
  r.metti(mat.pietra, new THREE.CylinderGeometry(0.22, 0.42, 3.4, 4).rotateY(Math.PI / 4).translate(0, 4.09, 0), x, y, z, yaw);
  r.metti(mat.pietra, new THREE.ConeGeometry(0.3, 0.45, 4).rotateY(Math.PI / 4).translate(0, 6.0, 0), x, y, z, yaw);
}

function fontanella(r, mat, x, y, z, yaw) {
  r.metti(mat.ghisa, new THREE.CylinderGeometry(0.13, 0.17, 1.05, 14).translate(0, 0.525, 0), x, y, z, yaw);
  r.metti(mat.ghisa, new THREE.SphereGeometry(0.15, 12, 8).translate(0, 1.08, 0), x, y, z, yaw);
  r.metti(mat.ghisa, new THREE.BoxGeometry(0.04, 0.04, 0.22).translate(0, 0.78, -0.2), x, y, z, yaw);
  r.metti(mat.pietraScura, new THREE.BoxGeometry(0.5, 0.12, 0.5).translate(0, 0.06, -0.25), x, y, z, yaw);
}

/** Disegna l'arredo urbano reale di Cerano (dati OpenStreetMap): strisce, linee e cartelli di stop, semafori, fermate, fontane, monumenti. */
export function costruisciArredi(scena, dati, { quota = () => 0 } = {}) {
  const mat = materialiArredi();
  const gruppo = new THREE.Group();
  gruppo.matrixAutoUpdate = false;
  gruppo.userData.senzaOmbra = mat.vernice;
  const r = creaRaccolta();
  for (const [tipo, x, z, a, extra] of dati.arredi ?? []) {
    const y = quota(x, z);
    switch (tipo) {
      case 'strisce': {
        const ux = Math.cos(a);
        const uz = Math.sin(a);
        for (let k = -extra / 2 + 0.45; k <= extra / 2 - 0.45; k += 1) {
          r.metti(mat.vernice, rettangoloTerra(0.5, 3).rotateY(-a + Math.PI / 2), x - uz * k, y + Y_VERNICE, z + ux * k);
        }
        break;
      }
      case 'linea':
        r.metti(mat.vernice, rettangoloTerra(0.45, extra).rotateY(-a), x, y + Y_VERNICE, z);
        break;
      case 'stop':
        cartello(r, mat, x, y, z, a, SLOT.stop, SLOT.retroOttagono, 0.62);
        break;
      case 'precedenza':
        cartello(r, mat, x, y, z, a, SLOT.precedenza, SLOT.retroTriangolo, 0.75);
        break;
      case 'fermata':
        r.metti(mat.palo, new THREE.CylinderGeometry(0.04, 0.04, 2.7, 8).translate(0, 1.35, 0), x, y, z, a);
        r.metti(mat.cartelli, pianoSlot(0.5, 0.5, SLOT.fermata).translate(0, 2.45, 0.045), x, y, z, a);
        r.metti(mat.cartelli, pianoSlot(0.5, 0.5, SLOT.fermata).rotateY(Math.PI).translate(0, 2.45, 0.035), x, y, z, a);
        break;
      case 'semaforo':
        r.metti(mat.palo, new THREE.CylinderGeometry(0.05, 0.06, 3.1, 8).translate(0, 1.55, 0), x, y, z, a);
        r.metti(mat.nero, new THREE.BoxGeometry(0.3, 0.85, 0.22).translate(0, 2.75, 0), x, y, z, a);
        r.metti(mat.luci, pianoSlot(0.3, 0.85 * 1.0, SLOT.semaforo).rotateY(Math.PI).translate(0, 2.75, -0.115), x, y, z, a);
        break;
      case 'fontana':
        fontana(r, mat, x, y, z);
        break;
      case 'monumento':
        monumento(r, mat, x, y, z, a);
        break;
      case 'stele':
        r.metti(mat.pietraScura, new THREE.BoxGeometry(1.2, 0.2, 0.9).translate(0, 0.1, 0), x, y, z, a);
        r.metti(mat.pietra, new THREE.BoxGeometry(0.7, 1.6, 0.3).translate(0, 1.0, 0), x, y, z, a);
        break;
      case 'fontanella':
        fontanella(r, mat, x, y, z, a);
        break;
      default:
    }
  }
  r.finisci(gruppo);
  scena.add(gruppo);
  return gruppo;
}

