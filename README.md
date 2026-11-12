# Rapina a Cerano

Mondo aperto online nella Cerano vera (Novara): chi apre il sito entra subito in città, senza stanze né lobby,
insieme a chi c'è già (fino a 8 per città). Ci si chiama al telefono, si forma la banda e si parte per i colpi. Design in [DESIGN.md](DESIGN.md).

## Avvio in locale

```bash
npm install
npx vite --port 5431
npm test
```

Con `?locale` i segnali passano da `BroadcastChannel` (due schede dello stesso browser), senza `?locale` da Supabase.
Il primo che entra ospita la città; se esce, la città passa da sola al giocatore rimasto con l'id più basso.

## Comandi

| Tasto | A piedi | In auto |
|---|---|---|
| WASD | muoversi | gas, freno/retro, sterzo |
| Shift / C | correre / chinarsi | — / visuale prima-terza persona |
| F (tenuto) | usare: porte, serrature, cassaforte, sacchi, auto, fascette | scendere |
| P | telefono: chiama la banda, scegli il colpo, si parte | — |
| Y / N | rispondi / rifiuta una chiamata | — |
| Q | passamontagna | — |
| E | «A terra!»: gli ostaggi si inginocchiano | — |
| G | lanciare il sacco | — |
| V | colpo alle spalle | — |
| T | tagliare il telefono (dove serve) | — |
| Mouse | mira e spara (col passamontagna) | il passeggero spara |
| Spazio | — | freno a mano |

## Cosa c'è

- **Cerano**: 3690 edifici (2554 con l'altezza misurata dal LiDAR regionale, gli altri stimati) e colori dei
  tetti dalla foto aerea, 859 strade coi nomi veri, marciapiedi rialzati tagliati agli incroci, rogge e navigli,
  46 mila alberi, 800 lampioni, 717 auto parcheggiate, 95 piscine, e l'arredo vero di OpenStreetMap: 40 strisce
  pedonali, 82 stop con la linea a terra, 18 fermate, semafori, fontanelle, la Fontana Beato Pacifico in Piazza
  Crespi, i monumenti ai caduti. Tramonto, notte e giorno. Riusabile in altri giochi: [MAPPA.md](MAPPA.md).
- **Campagna** di 6 colpi: Tabaccheria «Il Fumo del Borgo» (Via Roma), Supermercato «Il Paniere» (Piazza Crespi,
  nell'edificio vero del supermercato: tre casse, guardia giurata, sette telecamere, antipanico da staccare in sala
  sicurezza, cassa centrale dietro la tessera del direttore con la serratura a tempo, portavalori che ritira
  l'incasso dopo sei minuti), furgone portavalori «Blindati Ovesticino»
  (Via Novara, di giorno, riparte dopo 4 minuti), Oreficeria «La Spiga d'Oro» (Via Mazzini), Credito Rurale
  Ceranese (Via Matteotti), Caveau del Municipio (Piazza Crespi, di notte). Ognuno si sblocca col precedente.
- **Preparazioni**: fotografie di telecamere e guardia, tessera del direttore al bar, linea telefonica,
  trapano termico dal cantiere, furgone per la fuga (8 sacchi).
- **Mondo aperto**: passanti sui marciapiedi, traffico che gira per le vie (auto ferme si rubano, l'autista scappa
  e chiama i carabinieri), un'auto tua appena entri, polizia anche fuori dai colpi.
- **Telefono** (P): chi è in città, chiama, chi risponde entra nella banda; il capo sceglie il colpo e dà il via, il
  colpo si accende nel mondo dov'è. Bottino a casa nella cascina di Via Ranzina, ognuno tiene i suoi soldi sul suo
  computer. Banco degli attrezzi e mappa dei colpi nella cascina.
- **Persone vere**: undici personaggi generati in Blender con MPFB/MakeHuman (CC0) e animati con Moveset (fermo,
  cammina, corre, chino, guardia, pugno); la banda ha il passamontagna. Script in `strumenti/blender/`.
- **Schermata iniziale**: copertina renderizzata in Blender con gli edifici veri di Piazza Crespi, foto
  segnaletiche della banda, neon, sirene, banconote che volano, notiziario.
- **Ruoli**: scassinatore, hacker, autista, uomo d'azione.
- **Di nascosto o a sparatoria**: coni di vista con sospetto, telecamere che ruotano, rumore, antipanico,
  ostaggi con le fascette, polizia a ondate con le volanti sul grafo stradale, inseguimento fino a seminarle.
- **Seme casuale**: cassaforte, combinazione e foglietto, giri, telecamere, porte aperte, posto dell'auto.

## Prove

- `npm test`: logica della città, colpi, supermercato, preparazioni, campagna, rete (34 test).
- `node _lavoro/collaudo-due.mjs`: due giocatori in rete con Edge: entrata senza lobby, chiamata, colpo, fuga,
  spartizione e passaggio dell'host quando chi ospita esce (22 verifiche).
- `node _lavoro/foto-colpo.mjs alta tabaccheria` e `node _lavoro/foto-citta.mjs alta tramonto`: foto e fps a 1280×720.

## Crediti

Dati cartografici © OpenStreetMap contributors (ODbL). Ortofoto 2010 © Regione Piemonte (CC BY 4.0), usata per
il colore dei tetti, dei campi e per gli alberi. Altezze degli edifici © Regione Piemonte – BDTRE, ARPA Piemonte
(CC BY 4.0). Come riusare la mappa: [MAPPA.md](MAPPA.md). Persone generate con MPFB/MakeHuman (asset CC0) e animate con Moveset in Blender, armi
«Ultimate Gun Pack» di Quaternius (CC0), texture Poly Haven (CC0). Nomi di negozi, banca e ditte inventati.
