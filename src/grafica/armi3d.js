import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ARMI } from '../gioco/regole.js';

const URL_ARMI = './modelli/armi.glb';
const MODELLO_COLTELLO = 'Bayonet';
const VIOLA = new THREE.Color(0x9d5cff);
const EMISSIVO_POTENZIATO = new THREE.Color(0x3a0a70);

function finitura(m) {
  if (m.map) return { metalness: 0.55, roughness: 0.4 };
  if (/Wood/i.test(m.name)) return { metalness: 0, roughness: 0.62 };
  if (/Glass/i.test(m.name)) return { metalness: 0.3, roughness: 0.08 };
  if (/Metal|Main|Black|Grey/i.test(m.name)) return { metalness: 0.75, roughness: 0.38 };
  return { metalness: 0.1, roughness: 0.6 };
}

function materialeGioco(m) {
  const nuovo = new THREE.MeshStandardMaterial({
    name: m.name,
    color: m.color.clone(),
    map: m.map ?? null,
    emissive: m.emissiveMap ? new THREE.Color(0xffffff) : new THREE.Color(0x000000),
    emissiveMap: m.emissiveMap ?? null,
    flatShading: true,
    ...finitura(m),
  });
  for (const t of [nuovo.map, nuovo.emissiveMap]) {
    if (!t) continue;
    t.anisotropy = 4;
    t.needsUpdate = true;
  }
  return nuovo;
}

async function caricaFile(url, libreria) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const convertiti = new Map();
  for (const figlio of [...gltf.scene.children]) {
    figlio.traverse(o => {
      if (!o.isMesh) return;
      const lista = [].concat(o.material).map(m => {
        if (!convertiti.has(m)) convertiti.set(m, materialeGioco(m));
        return convertiti.get(m);
      });
      o.material = Array.isArray(o.material) ? lista : lista[0];
    });
    libreria.set(figlio.name, figlio);
  }
}

export async function caricaArmi() {
  const libreria = new Map();
  await caricaFile(URL_ARMI, libreria);
  return libreria;
}

export function creaMaterialiArmi(texture, libreria) {
  return {
    libreria,
    varianti: new Map(),
    guanto: new THREE.MeshStandardMaterial({ color: 0x24272a, roughness: 0.85 }),
    nocche: new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.7 }),
    manica: new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.95 }),
    polsino: new THREE.MeshStandardMaterial({ color: 0x1b1d1f, roughness: 0.9 }),
  };
}

function variante(materiali, originale, chiave, crea) {
  const k = `${originale.uuid}|${chiave}`;
  if (!materiali.varianti.has(k)) materiali.varianti.set(k, crea(originale.clone()));
  return materiali.varianti.get(k);
}

function vestiArma(gruppo, dati, materiali) {
  const colore = dati.colore !== undefined ? new THREE.Color(dati.colore) : null;
  const chiave = `${dati.colore ?? 'vera'}|${dati.potenziata ? 'p' : ''}`;
  if (!colore && !dati.potenziata) return;
  gruppo.traverse(o => {
    if (!o.isMesh) return;
    const lista = [].concat(o.material).map(m => variante(materiali, m, chiave, nuovo => {
      if (colore) {
        nuovo.emissive.copy(colore).multiplyScalar(dati.potenziata ? 1.6 : 1.1);
        nuovo.color.lerp(colore, 0.18);
      }
      if (dati.potenziata) {
        nuovo.color.lerp(VIOLA, colore ? 0.25 : 0.45);
        if (!colore) nuovo.emissive.copy(EMISSIVO_POTENZIATO);
      }
      return nuovo;
    }));
    o.material = Array.isArray(o.material) ? lista : lista[0];
  });
}

export function modelloArma(tipo, materiali) {
  const dati = tipo === 'coltello' ? { modello: MODELLO_COLTELLO } : ARMI[tipo];
  const modello = materiali.libreria.get(dati.modello);
  const extra = modello.userData;
  const bocca = new THREE.Vector3().fromArray(extra.bocca ?? [0, 0.03, -0.3]);
  const presa = extra.presa ? new THREE.Vector3().fromArray(extra.presa) : null;
  const lunghezza = extra.lunghezza ?? 0.5;
  const colore = dati.colore ?? null;
  const gruppo = modello.clone();
  gruppo.position.set(0, 0, 0);
  gruppo.rotation.set(0, 0, 0);
  if (tipo !== 'coltello') vestiArma(gruppo, dati, materiali);
  return { gruppo, bocca, presa, lunghezza, colore };
}

function capsula(gruppo, materiale, raggio, da, a) {
  const inizio = new THREE.Vector3(...da);
  const fine = new THREE.Vector3(...a);
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(raggio, inizio.distanceTo(fine), 3, 8), materiale);
  mesh.position.copy(inizio).add(fine).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), fine.clone().sub(inizio).normalize());
  gruppo.add(mesh);
  return mesh;
}

function avambraccio(gruppo, materiali, polso, gomito) {
  const da = new THREE.Vector3(...polso);
  const a = new THREE.Vector3(...gomito);
  const asse = a.clone().sub(da);
  const manica = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.03, asse.length(), 10), materiali.manica);
  manica.position.copy(da).add(a).multiplyScalar(0.5);
  manica.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), asse.clone().normalize());
  const polsino = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.04, 10), materiali.polsino);
  polsino.position.copy(da).addScaledVector(asse.clone().normalize(), 0.02);
  polsino.quaternion.copy(manica.quaternion);
  gruppo.add(manica, polsino);
}

export function creaBraccio(materiali) {
  const gruppo = new THREE.Group();
  capsula(gruppo, materiali.guanto, 0.026, [0.012, -0.03, 0.032], [0.008, -0.075, 0.05]);
  for (let i = 0; i < 4; i++) {
    const y = -0.03 - i * 0.014;
    capsula(gruppo, materiali.guanto, 0.0085, [0.026, y, 0.03], [0.012, y - 0.004, -0.004]);
    capsula(gruppo, materiali.nocche, 0.0082, [0.012, y - 0.004, -0.004], [-0.014, y - 0.006, 0.006]);
  }
  capsula(gruppo, materiali.guanto, 0.0095, [-0.012, -0.012, 0.048], [-0.014, -0.004, 0.01]);
  avambraccio(gruppo, materiali, [0.01, -0.085, 0.07], [0.07, -0.22, 0.36]);
  return gruppo;
}

export function creaManoSinistra(materiali) {
  const gruppo = new THREE.Group();
  capsula(gruppo, materiali.guanto, 0.025, [-0.012, -0.03, 0.03], [-0.006, -0.03, -0.02]);
  for (let i = 0; i < 4; i++) {
    const z = 0.012 - i * 0.015;
    capsula(gruppo, materiali.guanto, 0.0085, [0.006, -0.032, z], [0.024, -0.008, z - 0.004]);
  }
  capsula(gruppo, materiali.guanto, 0.009, [-0.024, -0.02, 0.02], [-0.026, 0.004, -0.012]);
  avambraccio(gruppo, materiali, [-0.02, -0.05, 0.04], [-0.1, -0.26, 0.22]);
  return gruppo;
}
