import { creaCaso, scegli } from './caso.js';
import { VEICOLI } from './regole.js';
import { cerchiVeicolo } from './veicoli.js';

export function hashTesto(t) {
  let h = 2166136261;
  for (const ch of String(t)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function postoAuto(citta, luogo, def, caso, opzioni = def.auto ?? {}, evita = []) {
  const [ex, ez] = luogo.ingresso;
  const tipo = opzioni.tipo ?? 'utilitaria';
  const d = VEICOLI[tipo];
  const min = opzioni.distanzaMin ?? 25;
  const max = opzioni.distanzaMax ?? 90;
  const candidati = [];
  for (const seg of citta.grafo.segmenti) {
    const s = citta.dati.strade[seg.strada];
    if (s.r < 1 || s.s || s.b) continue;
    const l = Math.hypot(seg.b.x - seg.a.x, seg.b.z - seg.a.z);
    if (l < d.lungo + 2) continue;
    for (let t = (d.lungo / 2 + 1) / l; t <= 1 - (d.lungo / 2 + 1) / l; t += 6 / l) {
      const x = seg.a.x + (seg.b.x - seg.a.x) * t;
      const z = seg.a.z + (seg.b.z - seg.a.z) * t;
      const dist = Math.hypot(x - ex, z - ez);
      if (dist < min || dist > max) continue;
      const ux = (seg.b.x - seg.a.x) / l;
      const uz = (seg.b.z - seg.a.z) / l;
      const off = s.l / 2 - d.largo / 2 - 0.25;
      const px = x - uz * off;
      const pz = z + ux * off;
      const yaw = Math.atan2(-ux, -uz);
      const prova = { x: px, z: pz, yaw, tipo };
      if (cerchiVeicolo(prova).some(c => citta.collisioni.respingi(c.x, c.z, c.r).urto)) continue;
      if (evita.some(e => Math.hypot(e.x - px, e.z - pz) < 9)) continue;
      candidati.push({ x: px, z: pz, yaw, dist });
    }
  }
  if (!candidati.length) throw new Error(`Nessun posto per il veicolo vicino a ${def.nome}`);
  candidati.sort((a, b) => a.dist - b.dist);
  return scegli(caso, candidati.slice(0, 12));
}

export function allestisci(def, seme, luogo, citta) {
  const caso = creaCaso((seme ^ hashTesto(def.id)) >>> 0);
  const { mondo, versoMondo } = luogo;
  const blindato = def.blindato ? postoAuto(citta, luogo, def, caso, { tipo: 'blindato', ...def.blindato }) : null;
  const daRubare = def.preparazione === 'furgone' ? postoAuto(citta, luogo, def, caso, { tipo: 'furgone', distanzaMin: 5, distanzaMax: 45 }) : null;
  const relativo = (lat, lon) => {
    const fx = -Math.sin(blindato.yaw);
    const fz = -Math.cos(blindato.yaw);
    return [blindato.x + Math.cos(blindato.yaw) * lat + fx * lon, blindato.z - Math.sin(blindato.yaw) * lat + fz * lon];
  };
  const casseforti = (def.casseforti ?? []).map(cf => {
    if (cf.suVeicolo) {
      const lungo = VEICOLI.blindato.lungo / 2 + 0.55;
      const [x, z] = relativo(0, -lungo);
      return { id: cf.id, tipo: cf.tipo, x, z, yaw: blindato.yaw + Math.PI, codice: '0000', bottino: cf.bottino, grande: false, suVeicolo: true, chiaviDa: cf.chiaviDa };
    }
    const pos = scegli(caso, cf.candidati);
    const codice = Array.from({ length: 4 }, () => Math.floor(caso() * 10)).join('');
    const [x, z] = mondo(pos.u, pos.v);
    return { id: cf.id, tipo: cf.tipo, x, z, yaw: versoMondo(pos.verso ?? 0), codice, bottino: cf.bottino, grande: !!cf.grande, chiaviDa: cf.chiaviDa ?? null, ritardo: cf.ritardo ?? 0 };
  });
  const biglietti = (def.biglietti ?? []).map((b, i) => {
    const pos = scegli(caso, b.candidati);
    const [x, z] = mondo(pos.u, pos.v);
    return { id: `biglietto-${i}`, per: b.per, x, z, y: pos.y ?? 0.8 };
  });
  const telecamere = (def.telecamere ?? []).filter(t => t.sempre || caso() < (t.probabilita ?? 1)).map(t => {
    const [x, z] = mondo(t.u, t.v);
    return { id: t.id, x, z, y: t.y, yaw: versoMondo(t.verso), ampiezza: t.ampiezza, giro: t.giro ?? 0.6 };
  });
  const porte = (def.pianta?.porte ?? []).map(p => ({
    id: p.id,
    aperta: !!p.aperta,
    serratura: p.serratura && caso() >= (p.apertaProbabilita ?? 0) ? p.serratura : null,
  }));
  const sacchi = (def.bottinoSparso ?? []).filter(b => caso() < (b.probabilita ?? 1)).map(b => {
    const [x, z] = mondo(b.u, b.v);
    return { tipo: b.sacco, valore: b.valore, x, z };
  });
  const casse = (def.casse ?? []).map(c => {
    const [x, z] = mondo(c.u, c.v);
    return { id: c.id, x, z, y: c.y ?? 1.05, yaw: versoMondo(c.verso ?? 0), sacco: c.sacco, valore: c.valore };
  });
  const pulsanti = (def.pulsanti ?? []).map(p => {
    const [x, z] = mondo(p.u, p.v);
    return { id: p.id, x, z };
  });
  const png = (def.png ?? []).filter(p => caso() < (p.probabilita ?? 1)).map((p, i) => {
    const giro = p.giro.map(([u, v, sosta]) => {
      const [x, z] = p.relativo ? relativo(u, v) : mondo(u, v);
      return { x, z, sosta: (sosta ?? 3) * (0.7 + caso() * 0.6) };
    });
    const inizio = Math.floor(caso() * giro.length);
    return { indice: i, tipo: p.tipo, nome: p.nome, cliente: !!p.cliente, tessera: !!p.tessera, giro, inizio, uscita: p.uscita ? mondo(...p.uscita) : p.relativo ? relativo(-4.5, 30) : luogo.ingresso };
  });
  const auto = postoAuto(citta, luogo, def, caso, def.auto ?? {}, [blindato, daRubare].filter(Boolean));
  const extra = missione(def, luogo, caso);
  const propri = (def.oggetti ?? []).map(o => {
    const [x, z] = mondo(o.u, o.v);
    return { id: o.id, tipo: o.tipo, x, z, y: o.y ?? 0, yaw: versoMondo(o.verso ?? 0) };
  });
  const vetrine = (def.vetrineGioielli ?? []).map((v, i) => {
    const [x, z] = mondo(v.u, v.v);
    return { id: `vetrina-${i}`, x, z, yaw: versoMondo(v.verso ?? 0), valore: v.valore, sacco: v.sacco ?? 'gioielli' };
  });
  for (const p of extra.png) png.push(p);
  for (const s of extra.sacchi) sacchi.push(s);
  const foto = def.preparazione === 'fotografie' ? [...telecamere.map(t => t.id), ...png.filter(p => p.tipo === 'vigilante').map(p => `png:${p.indice}`)] : [];
  return { casseforti, biglietti, telecamere, porte, sacchi, casse, pulsanti, png, auto, vetrine, blindato, daRubare, oggetti: [...propri, ...extra.oggetti], foto, ora: def.ora };
}

function missione(def, luogo, caso) {
  const { mondo } = luogo;
  const vuota = { png: [], sacchi: [], oggetti: [] };
  const giro = punti => punti.map(([u, v, sosta]) => {
    const [x, z] = mondo(u, v);
    return { x, z, sosta: sosta * (0.8 + caso() * 0.4) };
  });
  switch (def.preparazione) {
    case 'tessera':
      return { ...vuota, png: [
        { indice: 100, tipo: 'civile', nome: 'Il direttore', tessera: true, giro: giro([[5.5, -6.5, 25], [8.5, -8, 10], [3.5, -7.5, 14]]), inizio: 0, uscita: mondo(14, -18) },
        { indice: 101, tipo: 'civile', nome: 'Un avventore', giro: giro([[9.5, -5.5, 30], [12, -9, 8]]), inizio: 0, uscita: mondo(-6, -18) },
        { indice: 102, tipo: 'civile', nome: 'La barista', giro: giro([[2, -4, 12], [6.5, -5, 6]]), inizio: 0, uscita: mondo(0, -16) },
      ] };
    case 'linea': {
      const [x, z] = mondo(luogo.W * 0.82, -1.7);
      return { ...vuota, oggetti: [{ id: 'centralina', tipo: 'centralina', x, z, yaw: luogo.versoMondo(Math.PI) }] };
    }
    case 'trapano': {
      const [x, z] = mondo(luogo.W * 0.5, -4.5);
      return { ...vuota, sacchi: [{ tipo: 'trapano', valore: 0, x, z }], png: [{ indice: 100, tipo: 'vigilante', nome: 'Il guardiano del cantiere', giro: giro([[luogo.W * 0.3, -6, 14], [luogo.W * 0.75, -6.5, 10], [luogo.W * 0.55, -9, 8]]), inizio: 0, uscita: mondo(-5, -20) }] };
    }
    case 'furgone':
      return { ...vuota, png: [{ indice: 100, tipo: 'vigilante', nome: 'Il guardiano del piazzale', giro: giro([[luogo.W * 0.2, -8, 12], [luogo.W * 0.8, -8, 12]]), inizio: 0, uscita: mondo(-5, -20) }] };
    default:
      return vuota;
  }
}
