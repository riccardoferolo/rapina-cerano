import * as THREE from 'three';
import { texturaPiani, texturaTerra, texturaIndustriale, texturaMattoni, texturaChiesa, texturaTegole, texturaTettoPiano, texturaDettaglio } from './facciate.js';
import { superficieLastre, superficiePorfido, superficieIntonaco } from './superfici.js';
import { creaAtlante, materialeAtlante } from './atlante.js';

const LATO_ATLANTE = 2048;

function materialeSuolo(mappa, limite, piena) {
  const erba = texturaDettaglio('erba');
  const terra = texturaDettaglio('terra');
  const ghiaia = texturaDettaglio('ghiaia');
  const m = new THREE.MeshStandardMaterial({ map: mappa, roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = shader => {
    shader.uniforms.dettErba = { value: erba };
    shader.uniforms.dettTerra = { value: terra };
    shader.uniforms.dettGhiaia = { value: ghiaia };
    shader.uniforms.limiteSuolo = { value: limite };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D dettErba;
uniform sampler2D dettTerra;
uniform sampler2D dettGhiaia;
uniform float limiteSuolo;`)
      .replace('#include <map_fragment>', `
  vec4 baseSuolo = texture2D( map, vMapUv );
  vec2 mondo = vec2( vMapUv.x, 1.0 - vMapUv.y ) * ( 2.0 * limiteSuolo ) - limiteSuolo;
  vec3 cs = baseSuolo.rgb;
  float massimo = max( cs.r, max( cs.g, cs.b ) );
  float minimo = min( cs.r, min( cs.g, cs.b ) );
  float verde = cs.g - max( cs.r, cs.b );
  float saturo = ( massimo - minimo ) / max( massimo, 0.001 );
  float wE = smoothstep( 0.002, 0.02, verde );
  float wG = ( 1.0 - wE ) * ( 1.0 - smoothstep( 0.12, 0.3, saturo ) );
  float wT = max( 0.0, 1.0 - wE - wG );
  ${piena ? `float dett = texture2D( dettErba, mondo * 0.45 ).r * wE + texture2D( dettTerra, mondo * 0.22 ).r * wT + texture2D( dettGhiaia, mondo * 0.6 ).r * wG;
  dett = dett * 2.0 * mix( 1.0, texture2D( dettGhiaia, mondo * 0.031 ).r * 2.0, 0.35 );` : 'float dett = 1.0;'}
  float luma = dot( cs, vec3( 0.299, 0.587, 0.114 ) );
  cs = max( vec3( 0.0 ), mix( vec3( luma ), cs, 1.35 ) );
  diffuseColor.rgb *= cs * dett * 1.25;`);
  };
  m.customProgramCacheKey = () => `suolo${piena ? 1 : 0}`;
  return m;
}

function caricaImmagine(url) {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => ko(new Error(`Immagine mancante: ${url}`));
    img.src = url;
  });
}

async function caricaReale(nome) {
  const [map, normalMap, roughnessMap] = await Promise.all(['diff', 'nor', 'rough'].map(s => caricaImmagine(`./texture/${nome}_${s}.jpg`)));
  return { map, normalMap, roughnessMap };
}

export async function creaMateriali({ piena = true, limite }) {
  const [asfalto, cemento, terra, suoloMappa] = await Promise.all([
    caricaReale('asfalto'),
    caricaReale('cemento'),
    caricaReale('terra'),
    caricaImmagine('./cerano/suolo.jpg'),
  ]);
  const suoloTex = new THREE.Texture(suoloMappa);
  suoloTex.colorSpace = THREE.SRGBColorSpace;
  suoloTex.anisotropy = 4;
  suoloTex.needsUpdate = true;
  const atlanteEdifici = creaAtlante(LATO_ATLANTE, [
    { nome: 'piani', x: 8, y: 8, w: 1024, h: 1024, ...texturaPiani(1) },
    { nome: 'tegole', x: 1048, y: 8, w: 512, h: 512, ...texturaTegole() },
    { nome: 'intonaco', x: 1576, y: 8, w: 464, h: 464, ...superficieIntonaco(), datiFissi: 'rgb(255,236,0)' },
    { nome: 'industriale', x: 1048, y: 536, w: 512, h: 512, ...texturaIndustriale() },
    { nome: 'mattoni', x: 1576, y: 496, w: 464, h: 464, ...texturaMattoni() },
    { nome: 'terraCasa', x: 8, y: 1048, w: 1024, h: 320, ...texturaTerra(false, 3) },
    { nome: 'terraNegozi', x: 8, y: 1384, w: 1024, h: 320, ...texturaTerra(true, 4) },
    { nome: 'chiesa', x: 1048, y: 1064, w: 384, h: 768, ...texturaChiesa() },
    { nome: 'tettoPiano', x: 1448, y: 1064, w: 256, h: 256, ...texturaTettoPiano() },
    { nome: 'gronda', x: 1720, y: 1064, w: 48, h: 48, tinta: '#4f3d30', datiFissi: 'rgb(0,215,0)' },
    { nome: 'metallo', x: 1784, y: 1064, w: 48, h: 48, tinta: '#3a3d40', datiFissi: 'rgb(0,120,0)' },
  ]);
  const atlanteStrade = creaAtlante(LATO_ATLANTE, [
    { nome: 'asfalto', x: 8, y: 8, w: 1008, h: 1008, ...asfalto },
    { nome: 'porfido', x: 1032, y: 8, w: 1008, h: 1008, ...superficiePorfido(), datiFissi: 'rgb(0,205,0)' },
    { nome: 'sterrato', x: 8, y: 1032, w: 1008, h: 1008, ...terra },
    { nome: 'lastre', x: 1032, y: 1032, w: 496, h: 496, ...superficieLastre(), datiFissi: 'rgb(0,215,0)' },
    { nome: 'cemento', x: 1544, y: 1032, w: 496, h: 496, ...cemento },
    { nome: 'massicciata', x: 1032, y: 1544, w: 48, h: 48, tinta: '#6d655c', datiFissi: 'rgb(0,255,0)' },
  ]);
  if (!piena) {
    atlanteEdifici.normalMap = null;
    atlanteStrade.normalMap = null;
  }
  return {
    rettangoliEdifici: atlanteEdifici.rettangoli,
    rettangoliStrade: atlanteStrade.rettangoli,
    suolo: materialeSuolo(suoloTex, limite, piena),
    edifici: materialeAtlante(atlanteEdifici, { tinta: true, luce: true, normali: piena }),
    strade: materialeAtlante(atlanteStrade, { tinta: false, normali: piena }),
    strisce: new THREE.MeshStandardMaterial({ color: 0xe4e2da, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    acqua: new THREE.MeshStandardMaterial({ color: 0x1a2a2c, roughness: 0.04, metalness: 0.1 }),
    piscina: new THREE.MeshStandardMaterial({ color: 0x3fa6c8, roughness: 0.08, emissive: 0x0d4d66, emissiveIntensity: 0.6 }),
    binari: new THREE.MeshStandardMaterial({ color: 0x7a7470, roughness: 0.35, metalness: 0.8 }),
  };
}

export function luceFinestre(materiali, intensita) {
  materiali.edifici.emissiveIntensity = intensita;
}
