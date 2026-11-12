export const ASPETTI = Object.freeze(['banda', 'banda2', 'banda3', 'banda4', 'civile', 'civile2', 'civile3', 'anziano', 'ragazza', 'cassiera', 'guardia', 'direttore']);
const CIVILI = ['civile', 'civile2', 'civile3', 'anziano', 'ragazza'];
const BANDA = Object.freeze({ scassinatore: 'banda', hacker: 'banda2', autista: 'banda3', azione: 'banda4' });

/** Il modello di persona da usare per un giocatore o un personaggio non giocante, deciso dalla logica e mandato in rete. */
export function aspettoDi({ tipo, nome = '', ruolo = null, id = 0, aspetto = null }) {
  if (aspetto && ASPETTI.includes(aspetto)) return aspetto;
  if (tipo === 'giocatore') return BANDA[ruolo] ?? 'banda';
  if (tipo === 'guardia' || tipo === 'vigilante' || tipo === 'poliziotto') return 'guardia';
  const n = String(nome).toLowerCase();
  if (/cassier/.test(n)) return 'cassiera';
  if (/direttore/.test(n)) return 'direttore';
  if (/titolare|magazzin|barista/.test(n)) return 'civile3';
  if (/signora|una cliente|mamma/.test(n)) return 'civile2';
  if (/anzian|signore/.test(n)) return 'anziano';
  if (/ragazz/.test(n)) return 'ragazza';
  return CIVILI[Math.abs(Math.floor(id)) % CIVILI.length];
}
