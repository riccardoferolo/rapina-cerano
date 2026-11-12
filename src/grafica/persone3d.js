import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as clonaScheletro } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { modelloArmaUnito } from './armi3d.js';
import { aspettoDi, ASPETTI } from '../gioco/aspetto.js';

const DISSOLVENZA = 0.25;
const SEGUI = 14;
const RAGGIO_VISTA = 2.5;
const ARMI_PNG = Object.freeze({ guardia: 'pistola', vigilante: 'revolver', poliziotto: 'carabina' });
const CLIP = Object.freeze({ fermo: 'idle_normal', cammina: 'walk_normal', corre: 'run_normal', chino: 'crouch_normal', chinoCammina: 'crouch_walk_normal', guardia: 'guard', pugno: 'punch' });
const PASSO_CLIP = Object.freeze({ cammina: 1.35, corre: 3.6, chinoCammina: 0.9 });
const PRIORITA = ASPETTI;
const ALFA = /eyebrow|eyelash|short0|long0|bob0|ponytail|afro|braid/i;
const TINTE = Object.freeze({
  poliziotto: { polo: 0x2f3d5c, cargo: 0x262d3c },
  vigilante: { polo: 0x55595f, cargo: 0x2b2d31 },
});

function preparaModello(gltf) {
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    o.castShadow = true;
    const m = o.material;
    const alfa = ALFA.test(m.name);
    m.transparent = false;
    m.depthWrite = true;
    m.alphaTest = alfa ? 0.5 : 0;
    m.side = alfa ? THREE.DoubleSide : THREE.FrontSide;
    m.envMapIntensity = 0.6;
    o.userData.maschera = /hood|mask/i.test(m.name);
    o.userData.capelli = /short0|long0|bob0|ponytail|afro|braid/i.test(m.name);
    if (o.userData.maschera) m.color.setHex(0x111214);
    o.visible = !o.userData.maschera;
  });
  return { modello: gltf.scene, clip: new Map(gltf.animations.map(a => [a.name, a])) };
}

/** Carica i personaggi in sottofondo, prima la banda e i passanti; `pronto(nome)` dice se è già in memoria. */
export function caricaPersonaggi() {
  const caricatore = new GLTFLoader();
  const pronti = new Map();
  const promesse = new Map();
  const carica = nome => {
    if (!promesse.has(nome)) {
      promesse.set(nome, caricatore.loadAsync(`./modelli/persone/${nome}.glb`).then(g => {
        const m = preparaModello(g);
        pronti.set(nome, m);
        return m;
      }));
    }
    return promesse.get(nome);
  };
  const tutti = PRIORITA.reduce((catena, nome) => catena.then(() => carica(nome)).catch(() => carica(nome)), Promise.resolve());
  return { carica, pronto: nome => pronti.get(nome) ?? null, tutti, prima: carica(PRIORITA[0]) };
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

function tingi(corpo, tinte) {
  if (!tinte) return;
  corpo.traverse(o => {
    if (!o.isMesh) return;
    const chiave = Object.keys(tinte).find(k => o.material.name.includes(k));
    if (!chiave) return;
    o.material = o.material.clone();
    o.material.color.setHex(tinte[chiave]);
  });
}

function creaPersona(scena, libreria, materialiArmi, { tipo, nome, modello, tinte }) {
  const radice = new THREE.Group();
  const postura = new THREE.Group();
  radice.add(postura);
  scena.add(radice);
  let corpo = null;
  let mixer = null;
  let mano = null;
  const azioni = new Map();
  const maschere = [];
  const capelli = [];
  let attuale = null;
  const monta = dati => {
    corpo = clonaScheletro(dati.modello);
    tingi(corpo, tinte);
    corpo.traverse(o => {
      if (!mano && o.isBone && /RightHand$/.test(o.name)) mano = o;
      if (o.isMesh && o.userData.maschera) maschere.push(o);
      if (o.isMesh && o.userData.capelli) capelli.push(o);
    });
    postura.add(corpo);
    mixer = new THREE.AnimationMixer(corpo);
    for (const [logico, nomeClip] of Object.entries(CLIP)) {
      const c = dati.clip.get(nomeClip);
      if (c) azioni.set(logico, mixer.clipAction(c));
    }
  };
  const pronto = libreria.pronto(modello);
  if (pronto) monta(pronto);
  else libreria.carica(modello).then(monta).catch(() => {});
  const suona = (n, velocita) => {
    const azione = azioni.get(n);
    if (!azione) return;
    const passo = PASSO_CLIP[n];
    azione.timeScale = passo ? Math.max(0.6, Math.min(1.7, velocita / passo)) : 1;
    if (attuale === n) return;
    azione.reset().play();
    azioni.get(attuale)?.crossFadeTo(azione, DISSOLVENZA, false);
    attuale = n;
  };
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
    scritta.position.y = 2.1;
    radice.add(scritta);
  }
  const allarme = etichetta('!', '#ff4a3a');
  allarme.scale.set(0.9, 0.9, 1);
  allarme.position.y = 2.25;
  allarme.visible = false;
  radice.add(allarme);
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
      if (!disegna || !corpo) return;
      const giu = e.stato === 'morto' || e.stato === 'stordito' || e.stato === 'terra' || e.stato === 'arrestato';
      const inGinocchio = e.stato === 'a terra' || e.stato === 'legato';
      const vel = visto.velocita;
      let clip = vel > 3 ? 'corre' : vel > 0.35 ? 'cammina' : 'fermo';
      if (inGinocchio || (e.chino && vel <= 0.35)) clip = 'chino';
      else if (e.chino) clip = 'chinoCammina';
      else if (e.stato === 'combatte' && vel <= 0.35) clip = 'guardia';
      suona(clip, vel);
      mixer.update(giu ? 0 : dt);
      postura.rotation.x = giu ? -Math.PI / 2 : 0;
      postura.position.y = giu ? 0.18 : 0;
      for (const m of maschere) m.visible = !!e.maschera;
      if (maschere.length) for (const c of capelli) c.visible = !e.maschera;
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
      mixer?.stopAllAction();
      if (corpo) mixer?.uncacheRoot(corpo);
      corpo?.traverse(o => o.skeleton?.dispose());
    },
  };
}

export function creaFolla(scena, libreria, materialiArmi) {
  const persone = new Map();
  const deposito = new Map();
  const cono = new THREE.Frustum();
  const proiezione = new THREE.Matrix4();
  const sfera = new THREE.Sphere(new THREE.Vector3(), RAGGIO_VISTA);
  const prendi = (chiave, opzioni) => {
    const libere = deposito.get(chiave);
    if (libere?.length && !opzioni.nome) return libere.pop();
    const p = creaPersona(scena, libreria, materialiArmi, opzioni);
    p.chiaveDeposito = chiave;
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
          const modello = aspettoDi({ tipo, id: i });
          const p = creaPersona(scena, libreria, materialiArmi, { tipo, modello, tinte: TINTE[tipo] });
          p.chiaveDeposito = `${tipo}|${modello}`;
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
        if (!persone.has(k)) persone.set(k, prendi(k, { tipo: 'giocatore', nome: g.nome, modello: aspettoDi({ tipo: 'giocatore', ruolo: g.ruolo }), tinte: TINTE[g.ruolo] }));
        const qg = quota(g.x, g.z);
        persone.get(k).aggiorna({ ...g, arma: g.maschera ? g.arma : null }, dt, qg, inVista(g.x, qg, g.z));
      }
      for (const p of vista?.png ?? []) {
        const k = `p:${p.id}`;
        presenti.add(k);
        if (!persone.has(k)) {
          const modello = p.aspetto ?? aspettoDi({ tipo: p.tipo, id: p.id });
          persone.set(k, prendi(`${p.tipo}|${modello}`, { tipo: p.tipo, modello, tinte: TINTE[p.tipo] }));
        }
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
