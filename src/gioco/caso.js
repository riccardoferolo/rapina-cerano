export function passoCaso(stato) {
  const s = (stato + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}

export function semeCasuale() {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

export function creaCaso(seme) {
  let stato = seme >>> 0;
  return () => {
    const [valore, nuovo] = passoCaso(stato);
    stato = nuovo;
    return valore;
  };
}

export const scegli = (caso, elenco) => elenco[Math.floor(caso() * elenco.length) % elenco.length];
