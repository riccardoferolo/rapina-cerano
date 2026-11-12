import tabaccheria from './tabaccheria.js';
import supermercato from './supermercato.js';
import { FURGONE, OREFICERIA, BANCA, MUNICIPIO, PREPARAZIONI } from './altri.js';

export const COLPI = Object.freeze([tabaccheria, supermercato, FURGONE, OREFICERIA, BANCA, MUNICIPIO]);
export { PREPARAZIONI };
export const colpoPerId = id => COLPI.find(c => c.id === id) ?? null;
export const conInterni = def => !!def.pianta && !def.soloEsterno;

export function missionePerId(id) {
  if (!id?.startsWith('prep:')) return null;
  const prep = PREPARAZIONI[id.slice(5)];
  if (!prep) return null;
  const base = prep.luogo ? colpoPerId(prep.luogo) : null;
  return Object.freeze({
    ...(base ?? {}),
    id,
    preparazione: prep.id,
    per: prep.per,
    nome: prep.nome,
    breve: prep.breve,
    ora: prep.ora,
    luogo: prep.luogo,
    edificio: base?.edificio ?? prep.edificio,
    soloEsterno: !base || base.soloEsterno,
    casseforti: [],
    biglietti: [],
    casse: [],
    vetrineGioielli: [],
    bottinoSparso: [],
    blindato: null,
    scadenza: null,
    prelievo: null,
    oggetti: [],
    png: prep.id === 'fotografie' ? base.png : [],
    polizia: { attesa: 70, ondate: 2, agenti: 3 },
    auto: { tipo: 'utilitaria', distanzaMin: 30, distanzaMax: 100 },
  });
}

export const definizione = id => colpoPerId(id) ?? missionePerId(id);
