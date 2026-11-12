import * as THREE from 'three';
import { caricaArmi, creaMaterialiArmi } from './armi3d.js';
import { creaVista1p } from './vista1p.js';
import { caricaPersonaggio, creaFolla } from './persone3d.js';
import { creaMaterialiAuto, creaParco, costruisciParcheggi } from './auto3d.js';
import { creaMaterialiInterni, costruisciLuogo, creaDinamicheLuogo } from './luoghi3d.js';
import { SACCHI } from '../gioco/regole.js';

const TRACCE = 24;
const DURATA_TRACCIA = 0.07;

function creaSacchi3d(scena) {
  const geometria = new THREE.CapsuleGeometry(0.2, 0.5, 4, 10).rotateZ(Math.PI / 2);
  const mesh = new Map();
  const materiali = new Map();
  const materiale = tipo => {
    if (!materiali.has(tipo)) materiali.set(tipo, new THREE.MeshStandardMaterial({ color: SACCHI[tipo]?.colore ?? 0x333333, roughness: 0.92 }));
    return materiali.get(tipo);
  };
  return {
    aggiorna(sacchi) {
      const presenti = new Set();
      for (const s of sacchi ?? []) {
        if (s.portato || s.veicolo !== null) continue;
        presenti.add(s.id);
        if (!mesh.has(s.id)) {
          const m = new THREE.Mesh(geometria, materiale(s.tipo));
          m.castShadow = true;
          scena.add(m);
          mesh.set(s.id, m);
        }
        const m = mesh.get(s.id);
        m.position.set(s.x, Math.max(0.2, s.y), s.z);
        m.rotation.y = s.id * 1.3;
      }
      for (const [id, m] of mesh) {
        if (presenti.has(id)) continue;
        scena.remove(m);
        mesh.delete(id);
      }
    },
  };
}

function creaTracce(scena) {
  const pool = Array.from({ length: TRACCE }, () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    l.visible = false;
    l.frustumCulled = false;
    scena.add(l);
    return { l, t: 0 };
  });
  let prossima = 0;
  const lampo = new THREE.PointLight(0xffc27a, 0, 9, 1.6);
  scena.add(lampo);
  let tempoLampo = 0;
  return {
    traccia(da, a) {
      const voce = pool[prossima++ % TRACCE];
      const p = voce.l.geometry.attributes.position;
      p.setXYZ(0, da.x, da.y, da.z);
      p.setXYZ(1, a.x, a.y, a.z);
      p.needsUpdate = true;
      voce.l.visible = true;
      voce.t = DURATA_TRACCIA;
    },
    lampo(x, y, z) {
      lampo.position.set(x, y, z);
      lampo.intensity = 12;
      tempoLampo = 0.05;
    },
    aggiorna(dt) {
      for (const v of pool) {
        if (!v.l.visible) continue;
        v.t -= dt;
        if (v.t <= 0) v.l.visible = false;
      }
      tempoLampo -= dt;
      if (tempoLampo <= 0) lampo.intensity = 0;
    },
  };
}

function costruisciRifugio(scena, amb, mat) {
  const [x, z] = amb.rifugio;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = amb.rifugioYaw;
  const piano = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 1.3), mat.legno);
  piano.position.y = 0.82;
  g.add(piano);
  for (const [a, b] of [[-1.1, -0.55], [1.1, -0.55], [-1.1, 0.55], [1.1, 0.55]]) {
    const gamba = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.8, 0.07), mat.legno);
    gamba.position.set(a, 0.4, b);
    g.add(gamba);
  }
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 300;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e9e0c8';
  ctx.fillRect(0, 0, 512, 300);
  ctx.strokeStyle = '#7a6a50';
  ctx.lineWidth = 3;
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * 512, Math.random() * 300);
    ctx.lineTo(Math.random() * 512, Math.random() * 300);
    ctx.stroke();
  }
  ctx.fillStyle = '#a01818';
  ctx.font = 'bold 34px Georgia';
  ctx.fillText('CERANO', 170, 160);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mappa = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  mappa.position.y = 0.86;
  g.add(mappa);
  const lampada = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), mat.luce);
  lampada.position.set(0, 2.6, 0);
  g.add(lampada);
  const banco = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 0.7), mat.metallo);
  banco.position.set(3.2, 0.45, 0.4);
  g.add(banco);
  for (let i = 0; i < 5; i++) {
    const attrezzo = new THREE.Mesh(new THREE.BoxGeometry(0.25 + Math.random() * 0.2, 0.08, 0.15), i % 2 ? mat.acciaio : mat.rosso);
    attrezzo.position.set(2.6 + i * 0.3, 0.94, 0.4 + (Math.random() - 0.5) * 0.3);
    g.add(attrezzo);
  }
  scena.add(g);
  const luogoBanco = new THREE.Vector3(3.2, 0, 0.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), amb.rifugioYaw);
  return { mappa: [x, z], banco: [x + luogoBanco.x, z + luogoBanco.z], luce: { x, y: 2.5, z } };
}

export async function creaGioco3d(mondo, amb) {
  const [libreria, personaggio] = await Promise.all([caricaArmi(), caricaPersonaggio()]);
  const materialiArmi = creaMaterialiArmi({}, libreria);
  const matInterni = creaMaterialiInterni();
  const matAuto = creaMaterialiAuto();
  const { scena } = mondo;
  const statici = new Map();
  for (const [id, luogo] of amb.luoghi) {
    if (!luogo.interni) continue;
    const s = costruisciLuogo(scena, luogo, mondo.materiali, matInterni);
    statici.set(id, s);
    mondo.lampioni.teste.push(...s.luci);
  }
  const rifugio = costruisciRifugio(scena, amb, matInterni);
  mondo.lampioni.teste.push(rifugio.luce);
  const parcheggi = costruisciParcheggi(scena, amb.citta.parcheggi, matAuto);
  const folla = creaFolla(scena, personaggio, materialiArmi);
  const parco = creaParco(scena, matAuto);
  const sacchi = creaSacchi3d(scena);
  const tracce = creaTracce(scena);
  const vista1p = creaVista1p(materialiArmi);
  vista1p.scena.environment = scena.environment;
  vista1p.mostra('pistola');
  vista1p.precarica(['pistola', 'mitra', 'pompa', 'carabina', 'revolver']);
  const prova = { png: ['guardia', 'poliziotto', 'titolare', 'civile', 'vigilante'].map((tipo, i) => ({ id: -1 - i, tipo, x: amb.rifugio[0] + i, z: amb.rifugio[1] + 40, yaw: 0, stato: 'combatte', vita: 100 })), giocatori: [], veicoli: ['utilitaria', 'berlina', 'furgone', 'volante', 'blindato'].map((tipo, i) => ({ id: -10 - i, tipo, x: amb.rifugio[0] + i * 6, z: amb.rifugio[1] + 50, yaw: 0, vx: 0, vz: 0, sterzo: 0, sirena: true })), sacchi: [] };
  folla.aggiorna(prova, null, 0.016, amb.citta.quota);
  parco.aggiorna(prova.veicoli, 0.016, 0);
  mondo.camera.position.set(amb.rifugio[0], 2, amb.rifugio[1] + 60);
  mondo.camera.lookAt(amb.rifugio[0], 1, amb.rifugio[1] + 40);
  mondo.camera.updateMatrixWorld();
  mondo.renderer.compile(scena, mondo.camera);
  folla.aggiorna({ png: [], giocatori: [] }, null, 0.016, amb.citta.quota);
  parco.aggiorna([], 0.016, 0);
  folla.riempi({ poliziotto: 12, guardia: 4, vigilante: 2, titolare: 1 });
  parco.riempi({ volante: 7, utilitaria: 1 });
  let dinamiche = null;
  let colpoMostrato = null;
  let tempo = 0;
  mondo.renderer.autoClear = false;
  mondo.aggiungiAggiornatore((dt, camera) => parcheggi.aggiorna(camera, 600));
  return {
    rifugio,
    vista1p,
    tracce,
    preparaColpo(idColpo, set) {
      if (colpoMostrato === idColpo && dinamiche?.set === set) return;
      dinamiche?.chiudi();
      dinamiche = null;
      colpoMostrato = idColpo;
      if (!idColpo) return;
      dinamiche = creaDinamicheLuogo(scena, amb.luogoDi(idColpo), set, matInterni);
      dinamiche.set = set;
    },
    aggiorna(vista, mioId, dt, ora) {
      tempo += dt;
      folla.aggiorna(vista, mioId, dt, amb.citta.quota);
      parco.aggiorna(vista?.veicoli, dt, tempo);
      sacchi.aggiorna(vista?.sacchi);
      dinamiche?.aggiorna(vista, dt, tempo);
      tracce.aggiorna(dt);
      for (const s of statici.values()) {
        const insegna = s.gruppo.userData.insegna;
        if (insegna) insegna.material.emissiveIntensity = ora?.finestre ? 0.9 : 0;
      }
    },
    radiceAuto: id => parco.radice(id),
    disegnaPrimaPersona(armaVisibile) {
      vista1p.nascondi(!armaVisibile);
      mondo.renderer.clearDepth();
      mondo.renderer.render(vista1p.scena, vista1p.camera);
    },
    dimensiona(aspetto) {
      vista1p.camera.aspect = aspetto;
      vista1p.camera.updateProjectionMatrix();
    },
  };
}
