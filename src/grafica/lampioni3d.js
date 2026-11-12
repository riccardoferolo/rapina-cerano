import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const ALTEZZA_PALO = 7.2;
const ALTEZZA_MURO = 5.4;
const SPORTO = 1.3;
const RAGGIO_POZZA = 7.5;
const RIASSEGNA_OGNI = 0.4;
const COLORE_LUCE = 0xffc77a;

function texturaRadiale(nucleo, bordo) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, nucleo);
  g.addColorStop(0.35, bordo);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function geometriaPalo() {
  const fusto = new THREE.CylinderGeometry(0.06, 0.11, ALTEZZA_PALO, 8).translate(0, ALTEZZA_PALO / 2, 0);
  const base = new THREE.CylinderGeometry(0.16, 0.18, 0.5, 8).translate(0, 0.25, 0);
  const braccio = new THREE.CylinderGeometry(0.04, 0.04, SPORTO, 6).rotateX(Math.PI / 2).translate(0, ALTEZZA_PALO - 0.15, SPORTO / 2);
  const cappello = new THREE.CylinderGeometry(0.12, 0.34, 0.18, 10).translate(0, ALTEZZA_PALO - 0.12, SPORTO);
  return mergeGeometries([fusto, base, braccio, cappello]);
}

function geometriaMuro() {
  const staffa = new THREE.BoxGeometry(0.05, 0.05, 0.7).translate(0, ALTEZZA_MURO + 0.25, 0.35);
  const piastra = new THREE.BoxGeometry(0.18, 0.3, 0.04).translate(0, ALTEZZA_MURO + 0.2, 0.02);
  const tetto = new THREE.ConeGeometry(0.2, 0.22, 4).rotateY(Math.PI / 4).translate(0, ALTEZZA_MURO + 0.16, 0.72);
  return mergeGeometries([staffa, piastra, tetto]);
}

export function costruisciLampioni(scena, dati, { luci = 4, quota = () => 0 } = {}) {
  const pali = dati.lampioni.filter(l => !l[3]);
  const muri = dati.lampioni.filter(l => l[3]);
  const metallo = new THREE.MeshStandardMaterial({ color: 0x2b2e30, roughness: 0.5, metalness: 0.6 });
  const vetroAcceso = new THREE.MeshStandardMaterial({ color: 0xfff4e0, emissive: COLORE_LUCE, emissiveIntensity: 3 });
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const su = new THREE.Vector3(0, 1, 0);
  const uno = new THREE.Vector3(1, 1, 1);
  const testa = [];
  function istanze(geometria, materiale, elenco, testaY, sporto) {
    const im = new THREE.InstancedMesh(geometria, materiale, elenco.length);
    const lampada = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 10, 6).scale(1.2, 0.55, 1.2), vetroAcceso, elenco.length);
    elenco.forEach(([x, z, ang], i) => {
      const y = quota(x, z);
      q.setFromAxisAngle(su, ang);
      im.setMatrixAt(i, m.compose(new THREE.Vector3(x, y, z), q, uno));
      const tx = x + Math.sin(ang) * sporto;
      const tz = z + Math.cos(ang) * sporto;
      lampada.setMatrixAt(i, m.compose(new THREE.Vector3(tx, y + testaY, tz), q, uno));
      testa.push({ x: tx, y: y + testaY, z: tz });
    });
    im.castShadow = true;
    im.computeBoundingSphere();
    lampada.computeBoundingSphere();
    scena.add(im, lampada);
    return lampada;
  }
  const lampadePali = istanze(geometriaPalo(), metallo, pali, ALTEZZA_PALO - 0.24, SPORTO);
  const lampadeMuri = istanze(geometriaMuro(), metallo, muri, ALTEZZA_MURO + 0.02, 0.72);

  const pozzaTex = texturaRadiale('rgba(255,200,130,0.55)', 'rgba(255,170,90,0.22)');
  const pozze = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
    map: pozzaTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  }), testa.length);
  const aloneGeo = new THREE.BufferGeometry();
  aloneGeo.setAttribute('position', new THREE.Float32BufferAttribute(testa.flatMap(t => [t.x, t.y, t.z]), 3));
  const aloni = new THREE.Points(aloneGeo, new THREE.PointsMaterial({
    map: texturaRadiale('rgba(255,236,200,1)', 'rgba(255,190,110,0.35)'), size: 3.2, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd8a0,
  }));
  testa.forEach((t, i) => pozze.setMatrixAt(i, m.compose(new THREE.Vector3(t.x, 0.17, t.z), q.identity(), new THREE.Vector3(RAGGIO_POZZA * 2, 1, RAGGIO_POZZA * 2))));
  pozze.computeBoundingSphere();
  pozze.renderOrder = 2;
  scena.add(pozze, aloni);

  const luciVere = Array.from({ length: luci }, () => {
    const l = new THREE.PointLight(COLORE_LUCE, 0, 22, 1.6);
    scena.add(l);
    return l;
  });
  let accesi = true;
  let attesa = 0;
  const assegnate = new Array(luci).fill(-1);
  function accendi(si) {
    accesi = si;
    vetroAcceso.emissiveIntensity = si ? 3 : 0.05;
    pozze.visible = si;
    aloni.visible = si;
    if (!si) luciVere.forEach(l => { l.intensity = 0; });
  }
  return {
    accendi,
    teste: testa,
    aggiorna(camera, dt) {
      if (!accesi || !luciVere.length) return;
      attesa -= dt;
      if (attesa <= 0) {
        attesa = RIASSEGNA_OGNI;
        const p = camera.position;
        const vicine = testa.map((t, i) => [Math.hypot(t.x - p.x, t.z - p.z), i]).sort((a, b) => a[0] - b[0]).slice(0, luci).map(v => v[1]);
        const libere = vicine.filter(i => !assegnate.includes(i));
        for (let k = 0; k < luci; k++) {
          if (vicine.includes(assegnate[k])) continue;
          assegnate[k] = libere.shift() ?? -1;
          luciVere[k].intensity = 0;
        }
      }
      for (let k = 0; k < luci; k++) {
        const t = testa[assegnate[k]];
        if (!t) continue;
        luciVere[k].position.set(t.x, t.y - 0.25, t.z);
        luciVere[k].intensity = Math.min(26, luciVere[k].intensity + dt * 60);
      }
    },
    aggiungi() {
      return { lampadePali, lampadeMuri };
    },
  };
}
