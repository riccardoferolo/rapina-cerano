import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as clonaScheletro } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { modelloArmaUnito } from './armi3d.js';

const DISSOLVENZA = 0.25;
const SEGUI = 14;
const TINTE = Object.freeze({
  guardia: 0x6f7a86, vigilante: 0x7a6e5a, poliziotto: 0x2a3654, titolare: 0xe2dccd, civile: null, giocatore: 0x4a4a4c,
});
const CIVILI = [0xb56a4a, 0x5a7a9a, 0x8a8a5a, 0xc0b090, 0x6a4a6a, 0x9aa0a8];
const ARMI_PNG = Object.freeze({ guardia: 'pistola', vigilante: 'revolver', poliziotto: 'carabina' });
const RAGGIO_VISTA = 2.5;

export async function caricaPersonaggio() {
  const gltf = await new GLTFLoader().loadAsync('./modelli/soldato.glb');
  gltf.scene.traverse(o => {
    if (o.isMesh) {
      o.frustumCulled = false;
      o.castShadow = true;
    }
  });
  return { modello: gltf.scene, clip: new Map(gltf.animations.map(a => [a.name, a])) };
}

function etichetta(testo, colore) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 48;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 26px Segoe UI, Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText(testo, 128, 24);
  ctx.fillStyle = colore;
  ctx.fillText(testo, 128, 24);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(1.5, 0.28, 1);
  s.renderOrder = 30;
  return s;
}

function creaPersona(scena, personaggio, materialiArmi, { tipo, nome, colore }) {
  const radice = new THREE.Group();
  const postura = new THREE.Group();
  const corpo = clonaScheletro(personaggio.modello);
  corpo.rotation.y = Math.PI;
  const tinta = colore ?? TINTE[tipo] ?? 0xffffff;
  corpo.traverse(o => {
    if (!o.isMesh) return;
    o.material = [].concat(o.material).map(m => {
      const copia = m.clone();
      copia.color.setHex(tinta);
      return copia;
    });
    if (o.material.length === 1) o.material = o.material[0];
  });
  let mano = null;
  let testa = null;
  corpo.traverse(o => {
    if (!mano && o.isBone && /RightHand$/.test(o.name)) mano = o;
    if (!testa && o.isBone && /Head$/.test(o.name)) testa = o;
  });
  postura.add(corpo);
  radice.add(postura);
  const mixer = new THREE.AnimationMixer(corpo);
  const azioni = new Map();
  for (const [logico, clip] of Object.entries({ fermo: 'Idle', cammina: 'Walk', corre: 'Run' })) {
    const c = personaggio.clip.get(clip);
    if (c) azioni.set(logico, mixer.clipAction(c));
  }
  let attuale = null;
  const suona = n => {
    if (attuale === n || !azioni.has(n)) return;
    const nuova = azioni.get(n);
    nuova.reset().play();
    azioni.get(attuale)?.crossFadeTo(nuova, DISSOLVENZA, false);
    attuale = n;
  };
  const passamontagna = new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 10).scale(1, 1.18, 1.08), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 }));
  passamontagna.visible = false;
  if (testa) {
    testa.add(passamontagna);
    passamontagna.position.set(0, 0.1, 0.02);
    passamontagna.scale.setScalar(1 / Math.max(0.01, testa.getWorldScale(new THREE.Vector3()).x || 1));
  }
  const sacco = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.45, 4, 10).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2f3328, roughness: 0.9 }));
  sacco.position.set(0, 1.25, 0.2);
  sacco.visible = false;
  radice.add(sacco);
  const supporto = new THREE.Group();
  radice.add(supporto);
  let armaMostrata = null;
  const mostraArma = arma => {
    if (armaMostrata === arma) return;
    supporto.clear();
    armaMostrata = arma;
    if (!arma) return;
    const { gruppo } = modelloArmaUnito(arma, materialiArmi);
    gruppo.rotation.y = Math.PI;
    supporto.add(gruppo);
  };
  const scritta = nome ? etichetta(nome, '#e8f2ff') : null;
  if (scritta) {
    scritta.position.y = 2.15;
    radice.add(scritta);
  }
  const allarme = etichetta('!', '#ff4a3a');
  allarme.scale.set(0.9, 0.9, 1);
  allarme.position.y = 2.3;
  allarme.visible = false;
  radice.add(allarme);
  scena.add(radice);
  const visto = { x: 0, z: 0, yaw: 0, pronto: false, velocita: 0 };
  const posMano = new THREE.Vector3();
  return {
    radice,
    aggiorna(e, dt, quota = 0, inVista = true) {
      const salto = !visto.pronto || Math.hypot(e.x - visto.x, e.z - visto.z) > 3;
      const k = salto ? 1 : 1 - Math.exp(-dt * SEGUI);
      const px = visto.x;
      const pz = visto.z;
      visto.x += (e.x - visto.x) * k;
      visto.z += (e.z - visto.z) * k;
      visto.yaw += Math.atan2(Math.sin(e.yaw - visto.yaw), Math.cos(e.yaw - visto.yaw)) * k;
      visto.pronto = true;
      const v = salto || dt <= 0 ? 0 : Math.hypot(visto.x - px, visto.z - pz) / dt;
      visto.velocita += (v - visto.velocita) * Math.min(1, dt * 8);
      radice.position.set(visto.x, quota, visto.z);
      radice.rotation.y = visto.yaw;
      const disegna = inVista && !e.inAuto && e.stato !== 'fuggito';
      radice.visible = disegna;
      radice.matrixWorldAutoUpdate = disegna;
      if (!disegna) return;
      const giu = e.stato === 'morto' || e.stato === 'stordito' || e.stato === 'terra' || e.stato === 'arrestato';
      const inGinocchio = e.stato === 'a terra' || e.stato === 'legato';
      suona(giu || inGinocchio ? 'fermo' : visto.velocita > 3.2 ? 'corre' : visto.velocita > 0.4 ? 'cammina' : 'fermo');
      mixer.update(giu ? 0 : dt);
      postura.rotation.x = giu ? -Math.PI / 2 : 0;
      postura.position.y = giu ? 0.18 : inGinocchio ? -0.55 : 0;
      passamontagna.visible = !!e.maschera;
      sacco.visible = !!e.sacchi?.length && !giu;
      allarme.visible = e.stato === 'panico' || e.stato === 'radio' || e.stato === 'chiama';
      if (scritta) scritta.visible = !giu;
      mostraArma(giu || inGinocchio ? null : e.arma ?? null);
      if (mano && armaMostrata) {
        radice.updateMatrixWorld(true);
        mano.getWorldPosition(posMano);
        radice.worldToLocal(posMano);
        supporto.position.copy(posMano);
        supporto.rotation.x = -(e.pitch ?? 0);
      }
    },
    chiudi() {
      scena.remove(radice);
      mixer.stopAllAction();
      mixer.uncacheRoot(corpo);
      corpo.traverse(o => o.skeleton?.dispose());
    },
  };
}

export function creaFolla(scena, personaggio, materialiArmi) {
  const persone = new Map();
  const cono = new THREE.Frustum();
  const proiezione = new THREE.Matrix4();
  const sfera = new THREE.Sphere(new THREE.Vector3(), RAGGIO_VISTA);
  const deposito = new Map();
  const chiaveDeposito = (tipo, colore) => `${tipo}|${colore ?? ''}`;
  const prendi = (tipo, opzioni) => {
    const k = chiaveDeposito(tipo, opzioni.colore);
    const libere = deposito.get(k);
    if (libere?.length && !opzioni.nome) return libere.pop();
    const p = creaPersona(scena, personaggio, materialiArmi, { tipo, ...opzioni });
    p.chiaveDeposito = k;
    return p;
  };
  const posa = (p, conNome) => {
    p.radice.visible = false;
    p.radice.matrixWorldAutoUpdate = false;
    if (conNome) {
      p.chiudi();
      return;
    }
    if (!deposito.has(p.chiaveDeposito)) deposito.set(p.chiaveDeposito, []);
    deposito.get(p.chiaveDeposito).push(p);
  };
  return {
    riempi(quanti) {
      for (const [tipo, n] of Object.entries(quanti)) {
        for (let i = 0; i < n; i++) {
          const p = creaPersona(scena, personaggio, materialiArmi, { tipo });
          p.chiaveDeposito = chiaveDeposito(tipo, null);
          p.aggiorna({ x: 0, z: 0, yaw: 0, stato: 'giro', arma: { guardia: 'pistola', vigilante: 'revolver', poliziotto: 'carabina' }[tipo] ?? null }, 0.016, -50);
          posa(p, false);
        }
      }
    },
    aggiorna(vista, mioId, dt, quota, camera = null) {
      const presenti = new Set();
      let inVista = () => true;
      if (camera) {
        camera.updateMatrixWorld();
        proiezione.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        cono.setFromProjectionMatrix(proiezione);
        inVista = (x, y, z) => {
          sfera.center.set(x, y + 0.9, z);
          return cono.intersectsSphere(sfera);
        };
      }
      for (const g of vista?.giocatori ?? []) {
        if (g.id === mioId) continue;
        const k = `g:${g.id}`;
        presenti.add(k);
        if (!persone.has(k)) persone.set(k, prendi('giocatore', { nome: g.nome }));
        const qg = quota(g.x, g.z);
        persone.get(k).aggiorna({ ...g, arma: g.maschera ? g.arma : null }, dt, qg, inVista(g.x, qg, g.z));
      }
      for (const p of vista?.png ?? []) {
        const k = `p:${p.id}`;
        presenti.add(k);
        if (!persone.has(k)) persone.set(k, prendi(p.tipo, { colore: p.tipo === 'civile' ? CIVILI[p.id % CIVILI.length] : null }));
        const qp = quota(p.x, p.z);
        persone.get(k).aggiorna({ ...p, arma: ['combatte', 'radio', 'sospetto', 'giro'].includes(p.stato) ? ARMI_PNG[p.tipo] ?? null : null }, dt, qp, inVista(p.x, qp, p.z));
      }
      for (const [k, p] of persone) {
        if (presenti.has(k)) continue;
        posa(p, k.startsWith('g:'));
        persone.delete(k);
      }
    },
    svuota() {
      for (const p of persone.values()) p.chiudi();
      persone.clear();
    },
  };
}
