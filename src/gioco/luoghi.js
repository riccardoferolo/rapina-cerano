import { cornice, pezziMuro, muriPianta } from './pianta.js';

const ALTO_BASSO = 1.3;

const PIANTA_VUOTA = Object.freeze({ W: 10, D: 10, altezza: 3, stanze: [], muri: [], porte: [], vetrine: [], finestre: [] });

export function preparaLuogo(citta, def) {
  const c = cornice(citta, def.edificio, { manuale: def.cornice ?? null });
  const p = def.pianta && !def.soloEsterno ? def.pianta : { ...PIANTA_VUOTA, W: c.latoReale, D: c.profReale };
  const [du, dv] = def.scostamento ?? [0, 0];
  const su = def.scalaU ?? Math.min(1, c.latoReale / p.W);
  const sv = def.scalaV ?? c.profReale / p.D;
  const mondo = (u, v) => [c.ox + c.ux * (du + u * su) + c.vx * (dv + v * sv), c.oz + c.uz * (du + u * su) + c.vz * (dv + v * sv)];
  const locale = (x, z) => [((x - c.ox) * c.ux + (z - c.oz) * c.uz - du) / su, ((x - c.ox) * c.vx + (z - c.oz) * c.vz - dv) / sv];
  const versoMondo = verso => {
    const du = Math.sin(verso);
    const dv = Math.cos(verso);
    const dx = c.ux * du + c.vx * dv;
    const dz = c.uz * du + c.vz * dv;
    return Math.atan2(-dx, -dz);
  };
  const W = p.W;
  const D = p.D;
  const porte = p.porte.map(d => ({ ...d, mondo: null }));
  const muri = (p === def.pianta ? muriPianta(p) : []).map(({ m, esterno }) => {
    const { pieni, buchi } = pezziMuro(m, porte);
    return { m, esterno, pieni, buchi };
  });
  for (const m of muri) for (const b of m.buchi) b.porta.mondo = { da: mondo(...b.da), a: mondo(...b.a), muro: m.m };
  const resto = [];
  const stanze = p.stanze.map(s => ({ ...s }));
  const arredi = (def.arredi ?? []).map((a, i) => ({ ...a, id: `${a.tipo}-${i}`, basso: a.alto < ALTO_BASSO }));
  const centro = mondo(W / 2, D / 2);
  const ingresso = porte.find(d => d.esterna && d.v === 0) ?? porte[0] ?? { u: W / 2, v: 0 };
  return {
    def, c, su, sv, W, D, interni: p === def.pianta, mondo, locale, versoMondo, porte, muri, resto, stanze, arredi, centro,
    ingresso: mondo(ingresso.u, -1.5),
    zonaDi(x, z) {
      const [u, v] = locale(x, z);
      return stanze.find(s => u >= s.u0 && u <= s.u1 && v >= s.v0 && v <= s.v1) ?? null;
    },
    dentro(x, z) {
      const [u, v] = locale(x, z);
      return u >= 0 && u <= W && v >= 0 && v <= D;
    },
    privata(x, z) {
      const zona = this.zonaDi(x, z);
      return !!zona && (def.zonaPrivata ?? []).includes(zona.id);
    },
  };
}

export function registraCollisioni(collisioni, luogo) {
  const { mondo } = luogo;
  if (!luogo.interni) return new Map();
  const reale = luogo.c.edificio.p;
  for (let i = 0; i < reale.length; i++) {
    const a = reale[i];
    const b = reale[(i + 1) % reale.length];
    for (const [ax, az, bx, bz] of tagliaAperture(luogo, a, b)) collisioni.aggiungiSegmento(ax, az, bx, bz, 'muro');
  }
  for (const m of luogo.muri) {
    for (const [u0, v0, u1, v1] of m.pieni) {
      const [ax, az] = mondo(u0, v0);
      const [bx, bz] = mondo(u1, v1);
      collisioni.aggiungiSegmento(ax, az, bx, bz, 'muro');
    }
  }
  for (const [u0, v0, u1, v1] of luogo.resto) {
    const [ax, az] = mondo(u0, v0);
    const [bx, bz] = mondo(u1, v1);
    collisioni.aggiungiSegmento(ax, az, bx, bz, 'muro');
  }
  for (const a of luogo.arredi) {
    const angoli = [[a.u0, a.v0], [a.u1, a.v0], [a.u1, a.v1], [a.u0, a.v1]].map(([u, v]) => mondo(u, v));
    collisioni.aggiungiAnello(angoli, a.basso ? 'basso' : 'arredo');
  }
  const porte = new Map();
  for (const d of luogo.porte) {
    if (!d.mondo) continue;
    const [ax, az] = d.mondo.da;
    const [bx, bz] = d.mondo.a;
    const seg = collisioni.aggiungiSegmento(ax, az, bx, bz, d.tipo === 'vetro' ? 'porta-vetro' : 'porta', { porta: `${luogo.def.id}:${d.id}` });
    porte.set(d.id, seg);
  }
  return porte;
}

export const bloccaVista = s => s.etichetta !== 'basso' && s.etichetta !== 'porta-vetro' && s.etichetta !== 'albero' && s.etichetta !== 'palo' && s.etichetta !== 'acqua';
export const bloccaColpi = s => s.etichetta !== 'basso' && s.etichetta !== 'acqua';

export function apertureMondo(luogo) {
  const elenco = [];
  const { def, mondo } = luogo;
  for (const p of def.pianta.porte) {
    if (!p.esterna) continue;
    const lungoU = p.v === 0 || p.v === luogo.D;
    const a = lungoU ? mondo(p.u - p.largo / 2 - 0.05, p.v) : mondo(p.u, p.v - p.largo / 2 - 0.05);
    const b = lungoU ? mondo(p.u + p.largo / 2 + 0.05, p.v) : mondo(p.u, p.v + p.largo / 2 + 0.05);
    elenco.push({ a, b, y0: 0, y1: 2.2, porta: true });
  }
  for (const v of def.pianta.vetrine ?? []) elenco.push({ a: mondo(v.u0, 0), b: mondo(v.u1, 0), y0: v.da, y1: v.da + v.alta });
  for (const f of def.pianta.finestre ?? []) {
    const v = f.lato === 'retro' ? luogo.D : 0;
    elenco.push({ a: mondo(f.u0, v), b: mondo(f.u1, v), y0: f.da, y1: f.da + f.alta });
  }
  return elenco;
}

export function apertureSuSpigolo(luogo, a, b) {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (l < 0.01) return [];
  const ux = (b[0] - a[0]) / l;
  const uz = (b[1] - a[1]) / l;
  const fuori = [];
  for (const ap of apertureMondo(luogo)) {
    const d1 = Math.abs((ap.a[0] - a[0]) * -uz + (ap.a[1] - a[1]) * ux);
    const d2 = Math.abs((ap.b[0] - a[0]) * -uz + (ap.b[1] - a[1]) * ux);
    if (d1 > 0.9 || d2 > 0.9) continue;
    const s0 = (ap.a[0] - a[0]) * ux + (ap.a[1] - a[1]) * uz;
    const s1 = (ap.b[0] - a[0]) * ux + (ap.b[1] - a[1]) * uz;
    if (Math.max(s0, s1) < 0 || Math.min(s0, s1) > l) continue;
    fuori.push({ s0: Math.max(0, Math.min(s0, s1)), s1: Math.min(l, Math.max(s0, s1)), y0: ap.y0, y1: ap.y1, porta: !!ap.porta });
  }
  return fuori.sort((x, y) => x.s0 - y.s0);
}

function tagliaAperture(luogo, a, b) {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / (l || 1);
  const uz = (b[1] - a[1]) / (l || 1);
  const porte = apertureSuSpigolo(luogo, a, b).filter(x => x.porta);
  const pezzi = [];
  let s = 0;
  for (const p of porte) {
    if (p.s0 > s + 0.01) pezzi.push([a[0] + ux * s, a[1] + uz * s, a[0] + ux * p.s0, a[1] + uz * p.s0]);
    s = Math.max(s, p.s1);
  }
  if (l > s + 0.01) pezzi.push([a[0] + ux * s, a[1] + uz * s, b[0], b[1]]);
  return pezzi;
}
