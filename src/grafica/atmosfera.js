import * as THREE from 'three';
import { creaCaso } from './caso-grafica.js';

const STELLE = 2200;
const RAGGIO_CIELO = 3000;

export const ORE = Object.freeze({
  giorno: Object.freeze({
    zenit: 0x3d74c4, orizzonte: 0xc4d8ea, bagliore: 0xfff2d8, altezzaSole: 48, azimutSole: 215, luce: 0xfff1dc, forzaLuce: 3.1,
    cieloEmisfero: 0xb5cdee, terraEmisfero: 0x5a5242, forzaEmisfero: 1.15, nebbia: 0xbfd2e4, finestre: 0, lampioni: false, stelle: 0, esposizione: 0.95, ambiente: 0.6,
  }),
  tramonto: Object.freeze({
    zenit: 0x2c3f6e, orizzonte: 0xf0a26c, bagliore: 0xffc488, altezzaSole: 11, azimutSole: 262, luce: 0xffa868, forzaLuce: 2.3,
    cieloEmisfero: 0x7088bc, terraEmisfero: 0x3b2d24, forzaEmisfero: 0.95, nebbia: 0xb98a74, finestre: 0.55, lampioni: true, stelle: 0, esposizione: 1.05, ambiente: 0.45,
  }),
  notte: Object.freeze({
    zenit: 0x040917, orizzonte: 0x1c2846, bagliore: 0x6a7fb0, altezzaSole: 38, azimutSole: 130, luce: 0x8fa8d8, forzaLuce: 0.32,
    cieloEmisfero: 0x34446e, terraEmisfero: 0x0e0b09, forzaEmisfero: 0.5, nebbia: 0x121a2e, finestre: 1, lampioni: true, stelle: 1, esposizione: 1.15, ambiente: 0.18,
  }),
});

function direzione(altezza, azimut) {
  const a = (altezza * Math.PI) / 180;
  const z = (azimut * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(z) * Math.cos(a), Math.sin(a), -Math.cos(z) * Math.cos(a)).normalize();
}

function materialeCielo() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenit: { value: new THREE.Color() },
      orizzonte: { value: new THREE.Color() },
      bagliore: { value: new THREE.Color() },
      sole: { value: new THREE.Vector3(0, 1, 0) },
      forzaBagliore: { value: 1 },
      notte: { value: 0 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize( position );
        vec4 p = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        gl_Position = p.xyww;
      }`,
    fragmentShader: `
      uniform vec3 zenit;
      uniform vec3 orizzonte;
      uniform vec3 bagliore;
      uniform vec3 sole;
      uniform float forzaBagliore;
      uniform float notte;
      varying vec3 vDir;
      void main() {
        float h = clamp( vDir.y, -0.2, 1.0 );
        float t = pow( max( h, 0.0 ), 0.42 );
        vec3 c = mix( orizzonte, zenit, t );
        float s = max( dot( normalize( vDir ), normalize( sole ) ), 0.0 );
        c += bagliore * ( pow( s, 6.0 ) * 0.55 + pow( s, 90.0 ) * 1.6 ) * forzaBagliore * ( 1.0 - 0.6 * notte );
        c += bagliore * pow( s, 1800.0 ) * 6.0 * ( 1.0 - notte * 0.3 );
        c = mix( c, orizzonte * 0.55, smoothstep( 0.0, -0.15, vDir.y ) );
        gl_FragColor = vec4( c, 1.0 );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function stelle() {
  const caso = creaCaso(42);
  const pos = new Float32Array(STELLE * 3);
  const col = new Float32Array(STELLE * 3);
  for (let i = 0; i < STELLE; i++) {
    const u = caso() * 2 - 1;
    const a = caso() * Math.PI * 2;
    const y = 0.05 + Math.abs(u) * 0.95;
    const r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(a) * r * RAGGIO_CIELO * 0.9, y * RAGGIO_CIELO * 0.9, Math.sin(a) * r * RAGGIO_CIELO * 0.9], i * 3);
    const v = 0.4 + caso() * 0.6;
    col.set([v, v, v * (0.9 + caso() * 0.2)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false }));
}

export function creaAtmosfera(scena, renderer, { ombre = true, distanza = 600 } = {}) {
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(RAGGIO_CIELO, 32, 16), materialeCielo());
  cielo.renderOrder = -10;
  cielo.frustumCulled = false;
  scena.add(cielo);
  const puntiStelle = stelle();
  puntiStelle.frustumCulled = false;
  scena.add(puntiStelle);
  const emisfero = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  scena.add(emisfero);
  const sole = new THREE.DirectionalLight(0xffffff, 1);
  sole.castShadow = ombre;
  if (ombre) {
    sole.shadow.mapSize.set(2048, 2048);
    const c = sole.shadow.camera;
    c.left = -55;
    c.right = 55;
    c.top = 55;
    c.bottom = -55;
    c.near = 1;
    c.far = 320;
    sole.shadow.bias = -0.0006;
    sole.shadow.normalBias = 0.04;
  }
  scena.add(sole, sole.target);
  scena.fog = new THREE.Fog(0x000000, 30, distanza);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let ambiente = null;
  let ora = null;
  const dir = new THREE.Vector3();

  function imposta(nome) {
    const o = ORE[nome] ?? ORE.tramonto;
    ora = { nome, ...o };
    const u = cielo.material.uniforms;
    u.zenit.value.setHex(o.zenit);
    u.orizzonte.value.setHex(o.orizzonte);
    u.bagliore.value.setHex(o.bagliore);
    dir.copy(direzione(o.altezzaSole, o.azimutSole));
    u.sole.value.copy(dir);
    u.notte.value = o.stelle;
    u.forzaBagliore.value = nome === 'tramonto' ? 1.4 : nome === 'notte' ? 0.35 : 0.8;
    puntiStelle.visible = o.stelle > 0;
    emisfero.color.setHex(o.cieloEmisfero);
    emisfero.groundColor.setHex(o.terraEmisfero);
    emisfero.intensity = o.forzaEmisfero;
    sole.color.setHex(o.luce);
    sole.intensity = o.forzaLuce;
    scena.fog.color.setHex(o.nebbia);
    renderer.toneMappingExposure = o.esposizione;
    const scenaCielo = new THREE.Scene();
    const copia = cielo.clone();
    copia.scale.setScalar(0.01);
    scenaCielo.add(copia);
    ambiente?.dispose();
    ambiente = pmrem.fromScene(scenaCielo, 0, 0.1, 100).texture;
    scena.environment = ambiente;
    scena.environmentIntensity = o.ambiente;
    return ora;
  }

  return {
    imposta,
    get ora() { return ora; },
    distanza(d) {
      scena.fog.far = d;
      scena.fog.near = Math.min(60, d * 0.15);
    },
    aggiorna(camera) {
      cielo.position.copy(camera.position);
      puntiStelle.position.copy(camera.position);
      const p = camera.position;
      const passo = 4;
      const cx = Math.round(p.x / passo) * passo;
      const cz = Math.round(p.z / passo) * passo;
      sole.target.position.set(cx, 0, cz);
      sole.position.set(cx + dir.x * 200, dir.y * 200, cz + dir.z * 200);
    },
  };
}
