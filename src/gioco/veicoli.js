import { VEICOLI } from './regole.js';

const RESISTENZA_ARIA = 0.0042;
const ROTOLAMENTO = 0.45;
const FRENO = 11;
const FRENO_A_MANO = 0.35;
const RETRO_MASSIMA = 9;
const STERZO_MASSIMO = 0.58;
const STERZO_RAPIDITA = 3.2;
const RITORNO_STERZO = 4.5;
const RIMBALZO = 0.25;
const DANNO_URTO_SOPRA = 4;
const CERCHI = 3;

export function creaVeicolo(id, tipo, x, z, yaw, extra = {}) {
  return {
    id, tipo, x, z, yaw, vx: 0, vz: 0, w: 0, sterzo: 0, gas: 0, freno: 0, mano: 0,
    vita: VEICOLI[tipo].vita, sirena: false, fari: true, guidatore: null, posti: [], sacchi: [], acceso: false, urto: 0, ...extra,
  };
}

export const avanti = v => [-Math.sin(v.yaw), -Math.cos(v.yaw)];
export const destra = v => [Math.cos(v.yaw), -Math.sin(v.yaw)];
export const velocita = v => Math.hypot(v.vx, v.vz);
export const velocitaAvanti = v => {
  const [fx, fz] = avanti(v);
  return v.vx * fx + v.vz * fz;
};

export function cerchiVeicolo(v) {
  const d = VEICOLI[v.tipo];
  const [fx, fz] = avanti(v);
  const r = d.largo / 2;
  const passo = (d.lungo - d.largo) / (CERCHI - 1);
  return Array.from({ length: CERCHI }, (_, i) => {
    const o = -(d.lungo - d.largo) / 2 + passo * i;
    return { x: v.x + fx * o, z: v.z + fz * o, r };
  });
}

export function guida(v, comandi, dt, { collisioni = null, ostacoli = [], abilita = 1 } = {}) {
  const d = VEICOLI[v.tipo];
  const [fx, fz] = avanti(v);
  const [rx, rz] = destra(v);
  let vf = v.vx * fx + v.vz * fz;
  let vl = v.vx * rx + v.vz * rz;
  const gas = v.vita > 0 ? Math.max(-1, Math.min(1, comandi.gas ?? 0)) : 0;
  const voluto = Math.max(-1, Math.min(1, comandi.sterzo ?? 0));
  const mano = comandi.mano ? 1 : 0;
  const rapidita = voluto === 0 ? RITORNO_STERZO : STERZO_RAPIDITA;
  v.sterzo += Math.max(-dt * rapidita, Math.min(dt * rapidita, voluto - v.sterzo));
  v.gas = gas;
  v.mano = mano;
  const potenza = d.potenza * abilita;
  const massima = d.velocitaMax * abilita;
  let acc = 0;
  if (gas > 0) acc = vf < -0.5 ? FRENO : potenza * gas * Math.max(0, 1 - vf / massima);
  else if (gas < 0) acc = vf > 0.5 ? -FRENO : -potenza * 0.6 * Math.max(0, 1 + vf / RETRO_MASSIMA) * -gas;
  acc -= RESISTENZA_ARIA * vf * Math.abs(vf) + ROTOLAMENTO * Math.sign(vf);
  if (Math.abs(vf) < 0.3 && gas === 0) acc = -vf / dt;
  if (mano) acc -= Math.sign(vf) * FRENO * FRENO_A_MANO;
  if (comandi.freno) acc = Math.abs(vf) < FRENO * dt ? -vf / dt : -Math.sign(vf) * FRENO;
  vf += acc * dt;
  const angolo = v.sterzo * STERZO_MASSIMO * (1 / (1 + Math.abs(vf) * 0.035));
  let wVoluto = (vf * Math.tan(angolo)) / d.passo;
  const aderenza = d.aderenza * (mano ? 0.45 : 1) * (v.vita > 0 ? 1 : 0.6);
  const wMax = aderenza / Math.max(2, Math.abs(vf));
  wVoluto = Math.max(-wMax * (mano ? 2.2 : 1.1), Math.min(wMax * (mano ? 2.2 : 1.1), wVoluto));
  v.w += (wVoluto - v.w) * Math.min(1, dt * (mano ? 3 : 9));
  v.yaw += v.w * dt;
  const presa = mano ? 2.2 : 11;
  const perso = Math.min(Math.abs(vl), aderenza * dt * (presa / 10));
  vl -= Math.sign(vl) * perso;
  vl *= Math.exp(-dt * (mano ? 0.4 : 2.5));
  const [nfx, nfz] = avanti(v);
  const [nrx, nrz] = destra(v);
  v.vx = nfx * vf + nrx * vl;
  v.vz = nfz * vf + nrz * vl;
  const prima = [v.x, v.z];
  v.x += v.vx * dt;
  v.z += v.vz * dt;
  v.urto = 0;
  if (collisioni) urtaMuri(v, collisioni);
  for (const o of ostacoli) urtaVeicolo(v, o);
  const mosso = Math.hypot(v.x - prima[0], v.z - prima[1]);
  const atteso = Math.hypot(v.vx, v.vz) * dt;
  if (v.urto > 0 && atteso > 0.01 && mosso < atteso * 0.25) {
    v.vx *= 0.3;
    v.vz *= 0.3;
  }
  return v;
}

function rimbalza(v, nx, nz) {
  const verso = v.vx * nx + v.vz * nz;
  if (verso >= 0) return 0;
  v.vx -= (1 + RIMBALZO) * verso * nx;
  v.vz -= (1 + RIMBALZO) * verso * nz;
  v.vx *= 0.82;
  v.vz *= 0.82;
  v.w *= 0.5;
  return -verso;
}

function urtaMuri(v, collisioni) {
  const filtro = s => s.etichetta !== 'albero' || true;
  let forte = 0;
  for (const c of cerchiVeicolo(v)) {
    const esito = collisioni.respingi(c.x, c.z, c.r, filtro);
    if (!esito.urto) continue;
    const dx = esito.x - c.x;
    const dz = esito.z - c.z;
    const l = Math.hypot(dx, dz);
    v.x += dx;
    v.z += dz;
    v.urto = Math.max(v.urto, 0.01);
    if (l > 1e-5) forte = Math.max(forte, rimbalza(v, dx / l, dz / l));
  }
  registraUrto(v, forte);
}

function registraUrto(v, forte) {
  if (forte <= 0) return;
  v.urto = Math.max(v.urto, forte);
  if (forte > DANNO_URTO_SOPRA) v.vita = Math.max(0, v.vita - (forte - DANNO_URTO_SOPRA) * 6);
}

export function urtaVeicolo(v, altro) {
  const mie = cerchiVeicolo(v);
  const sue = cerchiVeicolo(altro);
  let forte = 0;
  for (const a of mie) {
    for (const b of sue) {
      const dx = a.x - b.x;
      const dz = a.z - b.z;
      const d = Math.hypot(dx, dz);
      const somma = a.r + b.r;
      if (d >= somma || d < 1e-6) continue;
      const nx = dx / d;
      const nz = dz / d;
      const spinta = (somma - d) * 0.6;
      v.x += nx * spinta;
      v.z += nz * spinta;
      const relativa = (v.vx - (altro.vx ?? 0)) * nx + (v.vz - (altro.vz ?? 0)) * nz;
      if (relativa < 0) {
        const massaMia = VEICOLI[v.tipo].massa;
        const massaSua = altro.massa ?? VEICOLI[altro.tipo]?.massa ?? 1200;
        const quota = massaSua / (massaMia + massaSua);
        v.vx -= (1 + RIMBALZO) * relativa * nx * quota;
        v.vz -= (1 + RIMBALZO) * relativa * nz * quota;
        forte = Math.max(forte, -relativa);
      }
    }
  }
  registraUrto(v, forte);
  return forte;
}

export function puntiVeicolo(v) {
  const d = VEICOLI[v.tipo];
  const [fx, fz] = avanti(v);
  const [rx, rz] = destra(v);
  const lato = (s, o) => [v.x + fx * s + rx * o, v.z + fz * s + rz * o];
  return {
    portaGuida: lato(0.2, -(d.largo / 2 + 0.6)),
    portaPasseggero: lato(0.2, d.largo / 2 + 0.6),
    portaDietroSx: lato(-0.8, -(d.largo / 2 + 0.6)),
    portaDietroDx: lato(-0.8, d.largo / 2 + 0.6),
    bagagliaio: lato(-(d.lungo / 2 + 0.7), 0),
    sedili: [lato(0.1, -0.38), lato(0.1, 0.38), lato(-0.85, -0.38), lato(-0.85, 0.38)],
  };
}

export function autista(stato, idVeicolo) {
  return stato.veicoli.find(v => v.id === idVeicolo)?.guidatore ?? null;
}
