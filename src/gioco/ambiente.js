import { preparaCitta } from '../citta/citta.js';
import { baricentro } from '../citta/geometria.js';
import { preparaLuogo, registraCollisioni } from './luoghi.js';
import { creaNavigazione } from './navigazione.js';
import { preparaVita } from './vita.js';
import { COLPI, PREPARAZIONI, conInterni } from './colpi/indice.js';

export const RIFUGIO = Object.freeze({ edificio: 1228609824, nome: 'La cascina di Via Ranzina' });
const MARGINE_NAV = 55;
export const QUOTA_INTERNI = 0.17;

export function creaAmbiente(dati) {
  const esclusi = new Set(COLPI.filter(conInterni).map(c => c.edificio));
  const citta = preparaCitta(dati, { esclusi });
  const luoghi = new Map();
  const porte = new Map();
  for (const def of COLPI) {
    const luogo = preparaLuogo(citta, def);
    luoghi.set(def.id, luogo);
    porte.set(def.id, registraCollisioni(citta.collisioni, luogo));
  }
  for (const prep of Object.values(PREPARAZIONI)) {
    if (prep.luogo) continue;
    luoghi.set(`prep:${prep.id}`, preparaLuogo(citta, { id: `prep:${prep.id}`, edificio: prep.edificio, soloEsterno: true }));
  }
  const conPavimento = [...luoghi.values()].filter(l => l.interni);
  const quotaStrada = citta.quota;
  citta.quota = (x, z) => (conPavimento.some(l => l.dentro(x, z)) ? QUOTA_INTERNI : quotaStrada(x, z));
  const cascina = citta.edificioPerId(RIFUGIO.edificio);
  const [cx, cz] = baricentro(cascina.p);
  const strada = citta.grafo.piuVicino(cx, cz, 200);
  const dx = strada.x - cx;
  const dz = strada.z - cz;
  const l = Math.hypot(dx, dz) || 1;
  const rifugio = [cx + (dx / l) * (l * 0.45), cz + (dz / l) * (l * 0.45)];
  const rifugioAuto = [cx + (dx / l) * (l * 0.7) - (dz / l) * 3, cz + (dz / l) * (l * 0.7) + (dx / l) * 3];
  const rifugioYaw = Math.atan2(dx / l, dz / l);
  const nav = new Map();
  const vita = preparaVita(citta);
  return {
    citta, luoghi, porte, nav, vita, rifugio, rifugioAuto, rifugioYaw, cascina, esclusi,
    luogoDi(id) {
      if (luoghi.has(id)) return luoghi.get(id);
      const prep = id?.startsWith('prep:') ? PREPARAZIONI[id.slice(5)] : null;
      return prep?.luogo ? luoghi.get(prep.luogo) : null;
    },
    navigazione(id) {
      if (!id) return null;
      if (!nav.has(id)) {
        const luogo = this.luogoDi(id);
        if (!luogo) return null;
        const [x, z] = luogo.centro;
        nav.set(id, creaNavigazione(citta.collisioni, { x0: x - MARGINE_NAV, z0: z - MARGINE_NAV, x1: x + MARGINE_NAV, z1: z + MARGINE_NAV }, { filtro: s => !s.porta }));
      }
      return nav.get(id);
    },
  };
}
