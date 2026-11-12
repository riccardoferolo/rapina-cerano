export const R = Object.freeze({
  PASSO: 1 / 60,
  ALTEZZA_OCCHI: 1.66,
  ALTEZZA_CHINO: 1.12,
  RAGGIO_GIOCATORE: 0.32,
  VELOCITA: 3.4,
  VELOCITA_CORSA: 5.8,
  VELOCITA_CHINO: 1.7,
  VITA: 100,
  VITA_AZIONE: 160,
  GIUBBOTTO: 60,
  RIGENERA_DOPO: 6,
  RIGENERA_AL_SECONDO: 4,
  TEMPO_A_TERRA: 45,
  RIANIMA_IN: 3.5,
  DISTANZA_USO: 2,
  DISTANZA_LANCIO: 7,
  GRAVITA: 14,
  FASCETTE: 4,
  INTIMIDISCI_ENTRO: 9,
  ARRENDE_DOPO: 25,
  RAGGIO_PNG: 0.34,
});

const arma = dati => Object.freeze({ pallini: 1, dispersione: 0.02, automatica: false, rumore: 38, ...dati });

export const ARMI = Object.freeze({
  pistola: arma({ nome: 'Pistola P9', famiglia: 'pistola', modello: 'Pistol_1', danno: 38, cadenza: 0.22, caricatore: 12, riserva: 60, ricarica: 1.4, dispersione: 0.006 }),
  revolver: arma({ nome: 'Revolver .357', famiglia: 'revolver', modello: 'Revolver_1', danno: 90, cadenza: 0.45, caricatore: 6, riserva: 36, ricarica: 2.6, dispersione: 0.006 }),
  mitra: arma({ nome: 'Mitra MK-5', famiglia: 'mitra', modello: 'SubmachineGun_1', danno: 26, cadenza: 0.075, automatica: true, caricatore: 30, riserva: 150, ricarica: 2.2, dispersione: 0.03 }),
  pompa: arma({ nome: 'Fucile a pompa 870', famiglia: 'pompa', modello: 'Shotgun_1', danno: 22, cadenza: 0.85, caricatore: 6, riserva: 36, ricarica: 3, pallini: 9, dispersione: 0.085 }),
  carabina: arma({ nome: 'Carabina M-4', famiglia: 'assalto', modello: 'AssaultRifle2_1', danno: 34, cadenza: 0.09, automatica: true, caricatore: 30, riserva: 150, ricarica: 2.3, dispersione: 0.016 }),
});

export const MODI_RICARICA = Object.freeze({ pistola: 'caricatore', mitra: 'caricatore', assalto: 'caricatore', revolver: 'tamburo', pompa: 'cartucce' });
export const modoRicarica = tipo => MODI_RICARICA[ARMI[tipo]?.famiglia] ?? 'caricatore';
export const COLTELLO = Object.freeze({ danno: 60, attesa: 0.6, portata: 1.8, arco: 0.9 });
export const RUMORE_SILENZIATO = 7;

export const RUOLI = Object.freeze({
  scassinatore: Object.freeze({
    nome: 'Scassinatore', arma: 'pistola', colore: 0x8a6a3a,
    abilita: 'Serrature in 3 secondi, casseforti a combinazione «a orecchio», trapano più veloce e silenzioso.',
    serratura: 3, orecchio: true, trapano: 0.7, rumoreTrapano: 0.5,
  }),
  hacker: Object.freeze({
    nome: 'Hacker', arma: 'pistola', colore: 0x3a6a8a,
    abilita: 'Mette in loop le telecamere da lontano, apre le porte elettroniche, ritarda la chiamata alla polizia.',
    loop: true, porteElettroniche: 4, ritardoChiamata: 40,
  }),
  autista: Object.freeze({
    nome: 'Autista', arma: 'mitra', colore: 0x6a3a3a,
    abilita: "Avvia un'auto senza chiavi in 2 secondi, guida meglio, vede le volanti sulla mappa durante la fuga.",
    avvio: 2, guida: 1.18, radar: true,
  }),
  azione: Object.freeze({
    nome: "Uomo d'azione", arma: 'pompa', colore: 0x4a4a4a,
    abilita: 'Stende una guardia alle spalle senza rumore, porta due sacchi, più vita, intimidisce al volo.',
    vita: 1.6, sacchi: 2, colpoAlleSpalle: true, intimidisce: 2,
  }),
});
export const ELENCO_RUOLI = Object.freeze(Object.keys(RUOLI));

export const TEMPI = Object.freeze({
  serratura: 12,
  cassaforteOrecchio: 14,
  cassaforteCodice: 2,
  trapano: 45,
  avvioSenzaChiavi: 10,
  tagliaFili: 7,
  loopTelecamera: 2.2,
  portaElettronica: 10,
  lega: 2,
  riempiSacco: 3,
  apriVetrina: 0.4,
  colpoAlleSpalle: 0.8,
  leggiBiglietto: 1.2,
  fotografa: 1.5,
});

export const SACCHI = Object.freeze({
  contanti: Object.freeze({ nome: 'Contanti', peso: 0.12, colore: 0x3d4a36 }),
  gioielli: Object.freeze({ nome: 'Gioielli', peso: 0.08, colore: 0x2f2f3a }),
  oro: Object.freeze({ nome: 'Oro', peso: 0.38, colore: 0x5a4b2a }),
  sigarette: Object.freeze({ nome: 'Stecche di sigarette', peso: 0.15, colore: 0x5a3a2a }),
  documenti: Object.freeze({ nome: 'Titoli al portatore', peso: 0.06, colore: 0x3a3a4a }),
  trapano: Object.freeze({ nome: 'Trapano termico', peso: 0.3, colore: 0x9a7a10 }),
});

export const ATTREZZI = Object.freeze({
  grimaldelli: Object.freeze({ nome: 'Grimaldelli professionali', costo: 3500, descrizione: 'serrature in metà tempo per tutti' }),
  fascette: Object.freeze({ nome: 'Fascette in più', costo: 1500, descrizione: '8 fascette invece di 4' }),
  trapano: Object.freeze({ nome: 'Trapano da cassaforte', costo: 6000, descrizione: 'apre le casseforti senza combinazione' }),
  silenziatore: Object.freeze({ nome: 'Silenziatore', costo: 4000, descrizione: 'la pistola non si sente oltre pochi metri' }),
  kit: Object.freeze({ nome: 'Kit medico', costo: 2500, descrizione: 'ti rialzi da solo una volta per colpo' }),
  giubbotto: Object.freeze({ nome: 'Giubbotto antiproiettile', costo: 7000, descrizione: '+60 di protezione, un po\' più lento' }),
  carabina: Object.freeze({ nome: 'Carabina M-4', costo: 12000, descrizione: 'arma in più per le sparatorie' }),
});

export const POTENZIAMENTI = Object.freeze({
  scassinatore: Object.freeze([{ nome: 'Mani di velluto', costo: 5000, effetto: 'trapano silenzioso come un frigo' }, { nome: 'Orecchio fino', costo: 9000, effetto: 'casseforti a orecchio in metà tempo' }]),
  hacker: Object.freeze([{ nome: 'Ripetitore', costo: 5000, effetto: 'loop delle telecamere da 40 m' }, { nome: 'Centralino', costo: 9000, effetto: 'la chiamata alla polizia ritarda di altri 30 s' }]),
  autista: Object.freeze([{ nome: 'Motore preparato', costo: 6000, effetto: 'auto della fuga più veloce' }, { nome: 'Scanner', costo: 8000, effetto: 'vede anche i posti di blocco' }]),
  azione: Object.freeze([{ nome: 'Pelle dura', costo: 6000, effetto: '+40 di vita' }, { nome: 'Voce grossa', costo: 7000, effetto: 'gli ostaggi non si rialzano mai' }]),
});

export const VEICOLI = Object.freeze({
  utilitaria: Object.freeze({ nome: 'Utilitaria', lungo: 3.9, largo: 1.72, alto: 1.5, massa: 1050, potenza: 9.5, velocitaMax: 46, aderenza: 9.5, passo: 2.45, posti: 4, sacchi: 4, vita: 260, colore: 0x8a1f1f }),
  berlina: Object.freeze({ nome: 'Berlina', lungo: 4.6, largo: 1.82, alto: 1.45, massa: 1450, potenza: 11.5, velocitaMax: 54, aderenza: 10, passo: 2.75, posti: 4, sacchi: 5, vita: 340, colore: 0x2d3a4a }),
  furgone: Object.freeze({ nome: 'Furgone', lungo: 5.2, largo: 2, alto: 2.3, massa: 2100, potenza: 9, velocitaMax: 40, aderenza: 8.2, passo: 3.3, posti: 4, sacchi: 8, vita: 480, colore: 0xdcdcd6 }),
  volante: Object.freeze({ nome: 'Volante', lungo: 4.7, largo: 1.85, alto: 1.48, massa: 1500, potenza: 12.5, velocitaMax: 52, aderenza: 10.5, passo: 2.8, posti: 4, sacchi: 0, vita: 380, colore: 0x1d2c4a }),
  blindato: Object.freeze({ nome: 'Portavalori', lungo: 5.6, largo: 2.1, alto: 2.5, massa: 3800, potenza: 8, velocitaMax: 34, aderenza: 8, passo: 3.5, posti: 2, sacchi: 0, vita: 1600, colore: 0x8c8f88 }),
});

export const PNG = Object.freeze({
  guardia: Object.freeze({ vita: 110, vista: 17, angolo: 1.1, velocita: 1.3, corsa: 4.2, arma: 'pistola', precisione: 0.55, armato: true }),
  poliziotto: Object.freeze({ vita: 140, vista: 32, angolo: 1.5, velocita: 1.6, corsa: 4.8, arma: 'carabina', precisione: 0.45, armato: true }),
  titolare: Object.freeze({ vita: 70, vista: 14, angolo: 1.4, velocita: 1.1, corsa: 3.6, armato: false }),
  civile: Object.freeze({ vita: 70, vista: 13, angolo: 1.4, velocita: 1.2, corsa: 4.4, armato: false }),
  vigilante: Object.freeze({ vita: 150, vista: 18, angolo: 1.1, velocita: 1.3, corsa: 4.4, arma: 'revolver', precisione: 0.6, armato: true }),
});

export const SOSPETTO = Object.freeze({
  mascherato: 1.3,
  sacco: 0.9,
  armato: 1.1,
  sconosciuto: 0.18,
  corpo: 1.5,
  telecameraRotta: 0.6,
  rumore: 0.5,
  calo: 0.12,
  buio: 0.5,
});

export const POLIZIA = Object.freeze({
  attesaBase: 75,
  ondataOgni: 45,
  agentiBase: 4,
  agentiPerOndata: 2,
  rinforziPerGiocatore: 1,
  tempoPerOstaggio: 12,
  distanzaSeminati: 150,
  tempoSeminati: 18,
});

export const fattoreGiocatori = n => 0.75 + Math.max(1, Math.min(4, n)) * 0.25;
export const velocitaConSacco = (sacco, ruolo) => (sacco ? 1 - (SACCHI[sacco]?.peso ?? 0.1) * (ruolo === 'azione' ? 0.5 : 1) : 1);
export const tempoAzione = (azione, ruolo, attrezzi = []) => {
  const base = TEMPI[azione] ?? 1;
  if (azione === 'serratura') return ruolo === 'scassinatore' ? RUOLI.scassinatore.serratura : base * (attrezzi.includes('grimaldelli') ? 0.5 : 1);
  if (azione === 'avvioSenzaChiavi') return ruolo === 'autista' ? RUOLI.autista.avvio : base;
  if (azione === 'portaElettronica') return ruolo === 'hacker' ? RUOLI.hacker.porteElettroniche : base;
  if (azione === 'trapano') return base * (ruolo === 'scassinatore' ? RUOLI.scassinatore.trapano : 1);
  if (azione === 'tagliaFili') return ruolo === 'hacker' ? 3 : base;
  if (azione === 'lega' && ruolo === 'azione') return 1;
  return base;
};
