# Rapina a Cerano

Rapine co-op online da 2 a 4 amici, in prima persona, nella Cerano vera (Novara) ricostruita dai dati
OpenStreetMap. Design in [DESIGN.md](DESIGN.md).

## Avvio in locale

```bash
npm install
npx vite --port 5431
npm test
```

Con `?locale` i segnali passano da `BroadcastChannel` (due schede dello stesso browser), senza `?locale` da Supabase.

## Comandi

| Tasto | A piedi | In auto |
|---|---|---|
| WASD | muoversi | gas, freno/retro, sterzo |
| Shift / C | correre / chinarsi | — / visuale prima-terza persona |
| F (tenuto) | usare: porte, serrature, cassaforte, sacchi, auto, fascette | scendere |
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
- **Rifugio** nella cascina di Via Ranzina: mappa dei colpi, banco degli attrezzi, potenziamenti per ruolo,
  spartizione del bottino. La campagna è salvata dal capo della banda.
- **Ruoli**: scassinatore, hacker, autista, uomo d'azione.
- **Di nascosto o a sparatoria**: coni di vista con sospetto, telecamere che ruotano, rumore, antipanico,
  ostaggi con le fascette, polizia a ondate con le volanti sul grafo stradale, inseguimento fino a seminarle.
- **Seme casuale**: cassaforte, combinazione e foglietto, giri, telecamere, porte aperte, posto dell'auto.

## Prove

- `npm test`: logica della città, colpi, supermercato, preparazioni, campagna, rete (34 test).
- `node _lavoro/collaudo-due.mjs`: due giocatori in rete con Edge, dal rifugio al colpo e ritorno (20 verifiche).
- `node _lavoro/foto-colpo.mjs alta tabaccheria` e `node _lavoro/foto-citta.mjs alta tramonto`: foto e fps a 1280×720.

## Crediti

Dati cartografici © OpenStreetMap contributors (ODbL). Ortofoto 2010 © Regione Piemonte (CC BY 4.0), usata per
il colore dei tetti, dei campi e per gli alberi. Altezze degli edifici © Regione Piemonte – BDTRE, ARPA Piemonte
(CC BY 4.0). Come riusare la mappa: [MAPPA.md](MAPPA.md). Modello del personaggio dagli esempi di three.js, armi
«Ultimate Gun Pack» di Quaternius (CC0), texture Poly Haven (CC0). Nomi di negozi, banca e ditte inventati.
