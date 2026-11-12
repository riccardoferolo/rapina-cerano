import * as THREE from 'three';
import { LIVELLI, ORDINE, livelloAttivo } from './qualita.js';
import { creaMateriali, luceFinestre } from './materiali.js';
import { costruisciCitta } from './citta3d.js';
import { costruisciAlberi } from './alberi3d.js';
import { costruisciLampioni } from './lampioni3d.js';
import { costruisciArredi } from './arredi3d.js';
import { creaAtmosfera } from './atmosfera.js';

const FOV = 72;
const FPS_BASSI = 52;
const FPS_ALTI = 59;
const ATTESA_RIALZO_S = 12;
const VERIFICA_OGNI_S = 1.5;
const CONTROLLI_PRIMA_DI_SCENDERE = 3;
const PASSO_SCALA = 0.1;

export async function creaMondo(contenitore, citta, { ora = 'tramonto', esclusi = new Set(), suQualita = () => {} } = {}) {
  let livello = livelloAttivo();
  let q = LIVELLI[livello];
  const renderer = new THREE.WebGLRenderer({ antialias: q.antialias, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = q.ombre;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  contenitore.appendChild(renderer.domElement);

  const scena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, q.distanza + 40);
  camera.rotation.order = 'YXZ';
  scena.add(camera);

  const atmosfera = creaAtmosfera(scena, renderer, { ombre: q.ombre, distanza: q.distanza });
  const materiali = await creaMateriali({ piena: q.texturePiene, limite: citta.dati.limite });
  const edifici = costruisciCitta(scena, citta, materiali, { esclusi });
  const alberi = costruisciAlberi(scena, citta.dati, {
    densita: q.densita,
    esclusoDa: (x, z) => citta.edificioIn(x, z) !== null,
  });
  const lampioni = costruisciLampioni(scena, citta.dati, { luci: q.luci, quota: citta.quota });
  costruisciArredi(scena, citta.dati, { quota: citta.quota });

  function impostaOra(nome) {
    const o = atmosfera.imposta(nome);
    luceFinestre(materiali, o.finestre);
    lampioni.accendi(o.lampioni);
    return o;
  }
  impostaOra(ora);
  atmosfera.distanza(q.distanza);

  let scala = q.scalaMassima;
  let controlliBassi = 0;
  let controlliAlti = 0;
  let ultimoCalo = -Infinity;
  let orologio = 0;
  let campioni = 0;
  let sommaDt = 0;
  function dimensiona() {
    const l = Math.max(1, Math.floor(contenitore.clientWidth * scala));
    const a = Math.max(1, Math.floor(contenitore.clientHeight * scala));
    renderer.setSize(l, a, false);
    camera.aspect = l / a;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(dimensiona).observe(contenitore);
  dimensiona();

  function adattaRisoluzione(dt) {
    orologio += dt;
    campioni += 1;
    sommaDt += dt;
    if (sommaDt < VERIFICA_OGNI_S) return;
    const fps = campioni / sommaDt;
    campioni = 0;
    sommaDt = 0;
    controlliBassi = fps < FPS_BASSI && scala <= q.scalaMinima + 0.01 ? controlliBassi + 1 : 0;
    if (controlliBassi >= CONTROLLI_PRIMA_DI_SCENDERE && livello !== ORDINE[ORDINE.length - 1]) {
      livello = ORDINE[ORDINE.indexOf(livello) + 1];
      q = { ...LIVELLI[livello], antialias: q.antialias, texturePiene: q.texturePiene, ombre: q.ombre && LIVELLI[livello].ombre };
      controlliBassi = 0;
      camera.far = q.distanza + 40;
      camera.updateProjectionMatrix();
      atmosfera.distanza(q.distanza);
      suQualita(livello);
    }
    controlliAlti = fps > FPS_ALTI ? controlliAlti + 1 : 0;
    let nuova = scala;
    if (fps < FPS_BASSI) {
      nuova = Math.max(q.scalaMinima, scala - PASSO_SCALA);
      ultimoCalo = orologio;
    } else if (controlliAlti >= 3 && orologio - ultimoCalo > ATTESA_RIALZO_S) {
      nuova = Math.min(q.scalaMassima, scala + PASSO_SCALA / 2);
      controlliAlti = 0;
    }
    if (Math.abs(nuova - scala) < 0.01) return;
    scala = nuova;
    dimensiona();
  }

  const aggiornatori = new Set();
  return {
    renderer,
    scena,
    camera,
    materiali,
    lampioni,
    get qualita() { return livello; },
    get ora() { return atmosfera.ora; },
    get scala() { return scala; },
    impostaOra,
    alChiuso(chiuso) {
      renderer.shadowMap.autoUpdate = !chiuso;
    },
    aggiungiAggiornatore(f) {
      aggiornatori.add(f);
      return () => aggiornatori.delete(f);
    },
    disegna({ x, y, z, yaw, pitch, fov = FOV }, dt, dopo = null) {
      adattaRisoluzione(dt);
      camera.position.set(x, y, z);
      camera.rotation.set(pitch, yaw, 0);
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      camera.updateMatrixWorld();
      atmosfera.aggiorna(camera);
      edifici.aggiorna(camera, q.distanza);
      alberi.aggiorna(camera, q.distanza);
      lampioni.aggiorna(camera, dt);
      for (const f of aggiornatori) f(dt, camera);
      renderer.clear();
      renderer.render(scena, camera);
      dopo?.();
    },
    statistiche: () => ({ ...renderer.info.render, celle: edifici.celle.length, alberi: alberi.quanti, qualita: livello, scala }),
  };
}
