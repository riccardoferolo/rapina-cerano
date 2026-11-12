import * as THREE from 'three';
import { modelloArma, creaBraccio, creaManoSinistra } from './armi3d.js';
import { ARMI, modoRicarica } from '../gioco/regole.js';

const RIPOSO = new THREE.Vector3(0.11, -0.095, -0.29);
const MIRA = new THREE.Vector3(0, -0.068, -0.24);
const DURATA_LAMPO = 0.05;
const RINCULO_POMPA = 2.2;
const LAMPO_POMPA = 2.1;
const CALCIO_POMPA = 1;
const CALCIO_ALTRE = 0.22;
const SOSTEGNO_PISTOLA = new THREE.Vector3(-0.018, -0.05, 0.04);
const COLORE_LAMPO = 0xfff3c4;
const DURATA_FENDENTE = 0.32;
const liscio = t => t * t * (3 - 2 * t);
const fase = (p, a, b) => liscio(Math.min(1, Math.max(0, (p - a) / (b - a))));
const GRAVITA_CADUTA = 9;
const SOTTO = new THREE.Vector3(0.02, -0.36, 0.12);

function oggettiRicarica(colore) {
  const metallo = new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.75, roughness: 0.4 });
  const ottone = new THREE.MeshStandardMaterial({ color: 0xc8a24a, metalness: 0.9, roughness: 0.3 });
  const caricatore = () => {
    const g = new THREE.Group();
    const corpo = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.085, 0.036), metallo);
    corpo.position.y = -0.03;
    corpo.rotation.x = 0.12;
    const punta = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.02, 8).rotateX(Math.PI / 2), ottone);
    punta.position.set(0, 0.016, -0.004);
    g.add(corpo, punta);
    return g;
  };
  const cartuccia = new THREE.Group();
  const bossolo = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.045, 10), new THREE.MeshStandardMaterial({ color: 0xa3201b, roughness: 0.5 }));
  const fondello = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.012, 10), ottone);
  fondello.position.y = -0.026;
  cartuccia.add(bossolo, fondello);
  cartuccia.rotation.x = Math.PI / 2;
  const tamburo = new THREE.Group();
  const anello = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 14), metallo);
  tamburo.add(anello);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const colpo = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.004, 0.03, 8), ottone);
    colpo.position.set(Math.cos(a) * 0.014, 0.018, Math.sin(a) * 0.014);
    tamburo.add(colpo);
  }
  tamburo.rotation.x = Math.PI / 2;
  const bossoli = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.025, 8), ottone);
    b.position.set(Math.cos(i) * 0.012, 0, Math.sin(i) * 0.012);
    bossoli.add(b);
  }
  const capsula = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 12), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: colore, emissiveIntensity: 2.2, roughness: 0.2 }));
  return { nuovo: caricatore(), vecchio: caricatore(), cartuccia, tamburo, bossoli, capsula };
}

function texturaLampo() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(16, 16);
    ctx.lineTo(16 + Math.cos(a) * 15, 16 + Math.sin(a) * 15);
    ctx.lineTo(16 + Math.cos(a + 0.3) * 6, 16 + Math.sin(a + 0.3) * 6);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  return t;
}

export function creaVista1p(materialiArmi) {
  const scena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
  scena.add(new THREE.HemisphereLight(0xc9d6e8, 0x30261c, 2.6));
  const luce = new THREE.DirectionalLight(0xfff0d0, 2);
  luce.position.set(1, 2, 1);
  scena.add(luce);
  const supporto = new THREE.Group();
  supporto.add(creaBraccio(materialiArmi));
  const manoSinistra = creaManoSinistra(materialiArmi);
  supporto.add(manoSinistra);
  scena.add(supporto);
  const modelli = new Map();
  const lampo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaLampo(), blending: THREE.AdditiveBlending, transparent: true, depthTest: false }));
  lampo.scale.setScalar(0.18);
  lampo.visible = false;
  supporto.add(lampo);
  const coltello = modelloArma('coltello', materialiArmi);
  coltello.gruppo.visible = false;
  scena.add(coltello.gruppo);
  const ricambi = oggettiRicarica(new THREE.Color(0x7df9ff));
  const inMano = new THREE.Group();
  inMano.position.set(0.0, -0.035, 0.0);
  manoSinistra.add(inMano);
  for (const chiave of ['nuovo', 'cartuccia', 'tamburo', 'capsula']) {
    ricambi[chiave].visible = false;
    inMano.add(ricambi[chiave]);
  }
  for (const chiave of ['vecchio', 'bossoli']) {
    ricambi[chiave].visible = false;
    supporto.add(ricambi[chiave]);
  }
  const posaMano = new THREE.Vector3();
  let attuale = null;
  let rinculo = 0;
  let tempoLampo = 0;
  let calcio = 0;
  let lampoForte = false;
  let fendente = 0;
  let passo = 0;
  let tempo = 0;
  const posizione = RIPOSO.clone();

  function mostra(tipo) {
    if (attuale === tipo) return;
    modelli.forEach(m => { m.gruppo.visible = false; });
    if (!modelli.has(tipo)) {
      const m = modelloArma(tipo, materialiArmi);
      supporto.add(m.gruppo);
      modelli.set(tipo, m);
    }
    const m = modelli.get(tipo);
    m.gruppo.visible = true;
    lampo.position.copy(m.bocca);
    lampo.material.color.setHex(m.colore ?? COLORE_LAMPO);
    lampo.scale.setScalar(m.colore ? 0.24 : 0.18);
    manoSinistra.visible = !ARMI[tipo]?.bianca;
    manoSinistra.position.copy(m.presa ?? SOSTEGNO_PISTOLA);
    if (ARMI[tipo]?.colore !== undefined) ricambi.capsula.material.emissive.setHex(ARMI[tipo].colore);
    attuale = tipo;
  }

  const morbido = { cambio: 0, corsa: 0, mira: 0 };
  return {
    scena,
    camera,
    mostra,
    spara() {
      if (ARMI[attuale]?.bianca) {
        fendente = 1;
        return;
      }
      lampoForte = ARMI[attuale]?.famiglia === 'pompa';
      rinculo = lampoForte ? RINCULO_POMPA : 1;
      calcio = lampoForte ? CALCIO_POMPA : CALCIO_ALTRE;
      tempoLampo = DURATA_LAMPO * (lampoForte ? 1.6 : 1);
      lampo.scale.setScalar((modelli.get(attuale)?.colore ? 0.24 : 0.18) * (lampoForte ? LAMPO_POMPA : 1));
      lampo.material.rotation = Math.random() * Math.PI;
    },
    precarica(tipi) {
      for (const tipo of tipi) {
        if (modelli.has(tipo)) continue;
        const m = modelloArma(tipo, materialiArmi);
        m.gruppo.visible = false;
        supporto.add(m.gruppo);
        modelli.set(tipo, m);
      }
    },
    get calcio() { return calcio; },
    get lampoForte() { return lampoForte; },
    get lampoAcceso() { return tempoLampo > 0; },
    get coloreLampo() { return lampo.material.color.getHex(); },
    posaRicarica(p, colpi) {
      const m = modelli.get(attuale);
      const riposo = m.presa ?? SOSTEGNO_PISTOLA;
      const corta = !m.presa;
      const modo = modoRicarica(attuale);
      const pozzo = corta ? new THREE.Vector3(0, -0.13, 0.035) : new THREE.Vector3(0, -0.06, m.bocca.z * 0.3);
      const sotto = pozzo.clone().add(SOTTO);
      const posa = { rollio: 0, beccheggio: 0, spinta: new THREE.Vector3(), mano: riposo.clone(), oggetto: null, scala: 1 };
      const entra = fase(p, 0, 0.14) - fase(p, 0.88, 1);
      const percorso = (punti, tappe) => {
        for (let i = tappe.length - 1; i >= 0; i--) {
          if (p < tappe[i][0]) continue;
          const [da, a] = tappe[i];
          const f = fase(p, da, a);
          return punti[i].clone().lerp(punti[i + 1], f);
        }
        return punti[0].clone();
      };
      ricambi.vecchio.visible = false;
      ricambi.bossoli.visible = false;
      if (modo === 'caricatore' || modo === 'otturatore') {
        posa.rollio = 0.42 * entra;
        posa.beccheggio = 0.12 * entra;
        posa.spinta.set(-0.03 * entra, 0.025 * entra + (p > 0.6 && p < 0.66 ? 0.012 : 0), 0.02 * entra);
        const leva = modo === 'otturatore' ? new THREE.Vector3(0.035, 0.05, 0.1) : corta ? new THREE.Vector3(0, 0.055, 0.06) : new THREE.Vector3(-0.035, 0.045, 0.0);
        const tirata = leva.clone().add(new THREE.Vector3(modo === 'otturatore' ? 0.01 : 0, modo === 'otturatore' ? 0.02 : 0, 0.05));
        posa.mano = percorso([riposo, pozzo, sotto, sotto, pozzo, leva, tirata, leva, riposo], [[0.08, 0.24], [0.26, 0.38], [0.38, 0.44], [0.44, 0.6], [0.64, 0.74], [0.76, 0.82], [0.82, 0.87], [0.88, 1]]);
        if (p > 0.38 && p < 0.62) posa.oggetto = 'nuovo';
        if (p > 0.24 && p < 0.6) {
          const t = (p - 0.24) * 1.6;
          ricambi.vecchio.visible = true;
          ricambi.vecchio.position.copy(pozzo).add(new THREE.Vector3(0, -0.04 - 0.5 * GRAVITA_CADUTA * t * t, 0.01 * t));
          ricambi.vecchio.rotation.set(t * 3, 0, t * 2);
        }
        if (p > 0.82 && p < 0.87) posa.spinta.z += 0.012;
      } else if (modo === 'tamburo') {
        const aperto = fase(p, 0.06, 0.2) - fase(p, 0.74, 0.8);
        posa.rollio = 0.95 * aperto;
        posa.beccheggio = 0.55 * aperto;
        posa.spinta.set(-0.04 * aperto, 0.04 * aperto, 0.03 * aperto);
        const tamburo = new THREE.Vector3(0, 0.03, -0.05);
        const fronte = new THREE.Vector3(0, 0.02, -0.12);
        posa.mano = percorso([riposo, fronte, sotto, sotto, tamburo, riposo], [[0.14, 0.26], [0.3, 0.42], [0.42, 0.5], [0.5, 0.68], [0.8, 0.95]]);
        if (p > 0.42 && p < 0.69) posa.oggetto = 'tamburo';
        if (p > 0.24 && p < 0.55) {
          const t = (p - 0.24) * 1.6;
          ricambi.bossoli.visible = true;
          ricambi.bossoli.position.copy(tamburo).add(new THREE.Vector3(0, -0.5 * GRAVITA_CADUTA * t * t, 0.02 * t));
          ricambi.bossoli.rotation.set(t * 5, t * 2, 0);
        }
      } else if (modo === 'cartucce') {
        posa.rollio = 0.65 * entra;
        posa.beccheggio = 0.08 * entra;
        posa.spinta.set(-0.035 * entra, 0.03 * entra, 0.02 * entra);
        const porta = new THREE.Vector3(0, -0.04, m.bocca.z * 0.18);
        const giu = porta.clone().add(new THREE.Vector3(0.01, -0.13, 0.05));
        const giri = Math.max(1, Math.min(6, colpi));
        if (p >= 0.12 && p < 0.8) {
          const q = ((p - 0.12) / 0.68) * giri;
          const f = q - Math.floor(q);
          posa.mano = f < 0.55 ? giu.clone().lerp(porta, liscio(f / 0.55)) : porta.clone().lerp(giu, liscio((f - 0.55) / 0.45));
          if (f < 0.5) posa.oggetto = 'cartuccia';
        } else if (p < 0.12) posa.mano = riposo.clone().lerp(giu, fase(p, 0.04, 0.12));
        else {
          const pompa = riposo.clone().add(new THREE.Vector3(0, 0, 0.06));
          posa.mano = p < 0.86 ? giu.clone().lerp(riposo, fase(p, 0.8, 0.86)) : p < 0.92 ? riposo.clone().lerp(pompa, fase(p, 0.86, 0.9)) : pompa.clone().lerp(riposo, fase(p, 0.92, 0.97));
          if (p > 0.9 && p < 0.95) posa.spinta.z += 0.01;
        }
      } else {
        posa.rollio = 0.25 * entra;
        posa.beccheggio = 0.3 * entra;
        posa.spinta.set(-0.02 * entra, 0.03 * entra, 0.02 * entra);
        const bocca = new THREE.Vector3(0, 0.07, -0.05);
        posa.mano = percorso([riposo, sotto, sotto, bocca, riposo], [[0.12, 0.26], [0.26, 0.34], [0.34, 0.52], [0.66, 0.84]]);
        if (p > 0.26 && p < 0.62) {
          posa.oggetto = 'capsula';
          ricambi.capsula.scale.setScalar(1 - fase(p, 0.52, 0.62));
        }
        posa.scala = 1 + Math.max(0, Math.sin((p - 0.6) * 40)) * 0.05 * (p > 0.6 && p < 0.84 ? 1 : 0);
      }
      return posa;
    },
    aggiorna({ dt, movimento, mira, ricarica, cambio, coltellata, corsa, colpiRicarica = 0 }) {
      morbido.cambio += (cambio - morbido.cambio) * Math.min(1, dt * 16);
      morbido.corsa += ((corsa ? 1 : 0) - morbido.corsa) * Math.min(1, dt * 10);
      morbido.mira += ((mira ? 1 : 0) - morbido.mira) * Math.min(1, dt * 14);
      passo += dt * (corsa ? 14 : 9) * movimento;
      tempo += dt;
      modelli.get(attuale)?.gruppo.userData.anima?.(tempo);
      rinculo = Math.max(0, rinculo - dt * 9);
      calcio = Math.max(0, calcio - dt * 6);
      tempoLampo = Math.max(0, tempoLampo - dt);
      lampo.visible = tempoLampo > 0;
      const base = mira ? MIRA : RIPOSO;
      posizione.lerp(base, Math.min(1, dt * 14));
      const bob = mira ? 0.2 : 1;
      const posa = ricarica > 0 && modelli.has(attuale) ? this.posaRicarica(ricarica, colpiRicarica) : null;
      supporto.position.set(
        posizione.x + Math.cos(passo) * 0.012 * movimento * bob + (posa?.spinta.x ?? 0),
        posizione.y + Math.abs(Math.sin(passo)) * 0.014 * movimento * bob - morbido.cambio * 0.3 - morbido.corsa * 0.04 + (posa?.spinta.y ?? 0),
        posizione.z + rinculo * 0.05 + (posa?.spinta.z ?? 0),
      );
      fendente = Math.max(0, fendente - dt / DURATA_FENDENTE);
      const arco = fendente > 0 ? Math.sin((1 - fendente) * Math.PI) : 0;
      const verso = fendente > 0 ? 0.9 - (1 - fendente) * 1.8 : 0;
      supporto.rotation.set(rinculo * 0.12 + (posa?.beccheggio ?? 0) - arco * 0.35, morbido.corsa * 0.5 + (1 - morbido.mira) * 0.06 + verso * arco, (posa?.rollio ?? 0) - arco * 0.6);
      supporto.position.x -= arco * 0.08;
      supporto.scale.setScalar(posa?.scala ?? 1);
      const modello = modelli.get(attuale);
      const riposoMano = modello?.presa ?? SOSTEGNO_PISTOLA;
      posaMano.copy(posa?.mano ?? riposoMano);
      manoSinistra.position.lerp(posaMano, posa ? 1 : Math.min(1, dt * 12));
      for (const chiave of ['nuovo', 'cartuccia', 'tamburo', 'capsula']) ricambi[chiave].visible = posa?.oggetto === chiave;
      if (!posa) {
        ricambi.vecchio.visible = false;
        ricambi.bossoli.visible = false;
        ricambi.capsula.scale.setScalar(1);
      }
      coltello.gruppo.visible = coltellata > 0;
      if (coltellata > 0) {
        const f = 1 - coltellata;
        coltello.gruppo.position.set(0.25 - f * 0.45, -0.18 + Math.sin(f * Math.PI) * 0.06, -0.4);
        coltello.gruppo.rotation.set(0, -0.6 + f * 1.4, -0.4);
      }
    },
    nascondi(nascosta) {
      supporto.visible = !nascosta;
    },
  };
}
