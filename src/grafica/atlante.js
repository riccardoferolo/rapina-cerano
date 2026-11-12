import * as THREE from 'three';

const BORDO = 8;

function tela(l, a) {
  const c = document.createElement('canvas');
  c.width = l;
  c.height = a;
  return c;
}

function immagineDi(fonte) {
  if (!fonte) return null;
  if (fonte.isTexture) return fonte.image;
  return fonte;
}

function disegnaRipetuto(ctx, img, x, y, w, h) {
  if (!img) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - BORDO, y - BORDO, w + BORDO * 2, h + BORDO * 2);
  ctx.clip();
  for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) ctx.drawImage(img, x + ox, y + oy, w, h);
  ctx.restore();
}

export function creaAtlante(lato, parti) {
  const strati = { colore: tela(lato, lato), normale: tela(lato, lato), dati: tela(lato, lato), luce: tela(lato, lato) };
  const ctx = Object.fromEntries(Object.entries(strati).map(([k, c]) => [k, c.getContext('2d')]));
  ctx.normale.fillStyle = 'rgb(128,128,255)';
  ctx.normale.fillRect(0, 0, lato, lato);
  ctx.dati.fillStyle = 'rgb(0,230,0)';
  ctx.dati.fillRect(0, 0, lato, lato);
  ctx.luce.fillStyle = '#000';
  ctx.luce.fillRect(0, 0, lato, lato);
  const rettangoli = {};
  for (const p of parti) {
    const { x, y, w, h } = p;
    if (p.tinta) {
      for (const k of ['colore', 'dati']) {
        ctx[k].fillStyle = k === 'colore' ? p.tinta : p.datiFissi ?? 'rgb(0,200,0)';
        ctx[k].fillRect(x - BORDO, y - BORDO, w + BORDO * 2, h + BORDO * 2);
      }
    } else {
      disegnaRipetuto(ctx.colore, immagineDi(p.map), x, y, w, h);
      disegnaRipetuto(ctx.normale, immagineDi(p.normalMap), x, y, w, h);
      if (p.roughnessMap) disegnaRipetuto(ctx.dati, immagineDi(p.roughnessMap), x, y, w, h);
      else {
        ctx.dati.fillStyle = p.datiFissi ?? 'rgb(255,235,0)';
        ctx.dati.fillRect(x - BORDO, y - BORDO, w + BORDO * 2, h + BORDO * 2);
      }
      if (p.emissiveMap) disegnaRipetuto(ctx.luce, immagineDi(p.emissiveMap), x, y, w, h);
    }
    rettangoli[p.nome] = [x / lato, 1 - (y + h) / lato, w / lato, h / lato];
  }
  const texture = (canvas, colore) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = colore ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };
  return {
    rettangoli,
    map: texture(strati.colore, true),
    normalMap: texture(strati.normale, false),
    roughnessMap: texture(strati.dati, false),
    emissiveMap: texture(strati.luce, true),
  };
}

const CAMPIONA = `
varying vec4 vAtlante;
varying vec2 vUvAtl;
vec4 campiona( sampler2D t ) {
  vec2 uvA = vAtlante.xy + fract( vUvAtl ) * vAtlante.zw;
  return textureGrad( t, uvA, dFdx( vUvAtl ) * vAtlante.zw, dFdy( vUvAtl ) * vAtlante.zw );
}`;

export function materialeAtlante(atlante, { tinta = true, luce = false, normali = true, ...extra } = {}) {
  const m = new THREE.MeshStandardMaterial({
    map: atlante.map,
    normalMap: normali ? atlante.normalMap : null,
    roughnessMap: atlante.roughnessMap,
    emissiveMap: luce ? atlante.emissiveMap : null,
    emissive: luce ? 0xffc98a : 0x000000,
    emissiveIntensity: 0,
    vertexColors: tinta,
    roughness: 1,
    metalness: 0,
    ...extra,
  });
  const S = THREE.ShaderChunk;
  m.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 atlante;\nvarying vec4 vAtlante;\nvarying vec2 vUvAtl;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvAtlante = atlante;\nvUvAtl = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${CAMPIONA}`)
      .replace('#include <map_fragment>', S.map_fragment.replace('texture2D( map, vMapUv )', 'campiona( map )'))
      .replace('#include <roughnessmap_fragment>', S.roughnessmap_fragment.replace('texture2D( roughnessMap, vRoughnessMapUv )', 'campiona( roughnessMap )'))
      .replace('#include <normal_fragment_maps>', S.normal_fragment_maps.replace('texture2D( normalMap, vNormalMapUv )', 'campiona( normalMap )'))
      .replace('#include <emissivemap_fragment>', S.emissivemap_fragment.replace('texture2D( emissiveMap, vEmissiveMapUv )', 'campiona( emissiveMap )'))
      .replace('#include <color_fragment>', tinta ? `
#ifdef USE_COLOR
  diffuseColor.rgb *= mix( vec3( 1.0 ), vColor.rgb, campiona( roughnessMap ).r );
#endif` : '');
  };
  m.customProgramCacheKey = () => `atlante${tinta ? 1 : 0}${luce ? 1 : 0}${normali ? 1 : 0}`;
  return m;
}
