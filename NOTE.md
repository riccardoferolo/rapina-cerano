# Rapina a Cerano — stato del lavoro

## Fatto
- `strumenti/costruisci-cerano.mjs`: OSM + foto aeree di GTA Cerano → `public/cerano/cerano.json` (3690 edifici, 859 strade, alberi, lampioni) e `_lavoro/suolo.png` → `_lavoro/suolo-jpg.mjs` → `public/cerano/suolo.jpg`.
- Logica città `src/citta/`: collisioni (segmenti+cerchi a griglia), grafo stradale A*, marciapiedi tagliati agli incroci, quote, auto parcheggiate (717).
- Grafica città `src/grafica/`: atlante unico edifici + atlante strade (shader `atlante.js`), celle 320 m, alberi istanziati (1 disegno per cella), lampioni con pozze e luci vere a rotazione, cielo tramonto/notte/giorno, ombre solo vicino. ~80 disegni.
- Gioco `src/gioco/`: regole, ruoli, partita host (PNG con cono di vista e sospetto, telecamere, allarme, polizia a ondate con volanti sul grafo, ostaggi, sacchi, auto), istantanee, campagna, allestimento col seme.
- Colpo 1 tabaccheria (Via Roma, edificio 1239072096). Rifugio = cascina 1228609824 in Via Ranzina.
- Rete copiata da Ultima Campanella, prefisso `rapinacerano`.
- `main.js`: schermate, stanza, rifugio con mappa e banco, colpo, guida locale, spari, HUD, esito, spartizione.
- Test: `npm test` (15 verdi). Collaudo in due: `_lavoro/collaudo-due.mjs` (18/19, guida via `guidaPer` corretta dopo).

## Comandi
- vite: `npx vite --port 5431` (fermare per PID). Foto città: `_lavoro/foto-citta.mjs [qualita] [ora]`. Foto colpo: `_lavoro/foto-colpo.mjs [qualita] [colpo]`.

- Colpi 2-5 in `src/gioco/colpi/altri.js` (furgone solo esterno con scadenza, oreficeria, banca con scostamento/scala, Municipio con cornice manuale lungo la facciata OSM obliqua) e 5 preparazioni (`prep:<id>`).
- Guscio degli edifici dei colpi dalla sagoma OSM vera con aperture sugli spigoli (`apertureSuSpigolo`), pavimenti interni a 0,17 m (`QUOTA_INTERNI`).
- Prestazioni: deposito di agenti e volanti pronti, shader compilati al caricamento, A* senza allocazioni (1 per passo), ombre entro 150 m (alberi 55 m), isteresi della risoluzione. Alta: 58-60 fps con polizia, Media: 60 fisso.

## Da fare
- Comportamento dei PNG da rifinire sul campo (giri dentro i negozi, coperture della polizia).
- Personaggi: c'è solo il soldato tinto (asset CC0 degli esempi three.js).
- Pubblicato: https://github.com/riccardoferolo/rapina-cerano (main = sorgenti) e https://riccardoferolo.github.io/rapina-cerano/ (ramo gh-pages = `dist`, ricostruito con `npm run build` e spinto a mano). Prova online: `node _lavoro/prova-online.mjs`.

## Richiesta del 12/11 pomeriggio (fatto e pubblicato il 12/11)
- Bug multigiocatore «se l'amico parte non mi porta»: corretto (ospite si aggancia dalle istantanee, l'host include tutti, chiunque sceglie il colpo). Collaudo 20/20.
- Supermercato «Il Paniere» = colpo 2 (gli altri slittano a 3-6): edificio 1239347530, quello dove OSM mette il negozio vero di Piazza Crespi. Pianta adattata alla sagoma (scostamento 0,4 m, angolo smussato dietro a sinistra = vani chiusi), porta di servizio sul lato destro (unico lato libero, dà sul cortile verso la strada; il retro confina con la banca). Meccaniche nuove nel motore: antipanico più vicino, quadro che li stacca (`quadro:`), videoregistratore che spegne le telecamere (`registratore:`), cassaforte con `ritardo` (stato `ritardo`, 40 s), `prelievo` del portavalori a 360 s (avvisi a 90 e 30 s; cassa chiusa = persa, cassa in ritardo/trapano = allarme), borseggio della tessera anche fuori dalla preparazione. Istantanea: `mi[6]` = antipanico, stati cassaforte `ritardo`/`persa`. 9 test in `test/supermercato.test.js`.
- Grafica interni: corsie a due facce, frighi a vetri, banco murale, casse col nastro, carrelli a rete, banco frutta, monitor, cartelli appesi, gres chiaro. Prodotti = solo fronte+coperchio e senza ombra.
- Prestazioni (misurate con `_lavoro/confronto-fps.mjs`): armi dei PNG fuse per materiale (`modelloArmaUnito`: erano 30-170 mesh l'una), personaggi fuori inquadratura e in deposito non aggiornati né disegnati, ombra del sole congelata al chiuso (`mondo.alChiuso`). Supermercato da 34% di fotogrammi lenti a 1%, 60 fps in Alta; tabaccheria e banca tornano a risoluzione piena.
- Mappa: altezze vere BDTRE (`strumenti/altezze-bdtre.mjs`, dati in `strumenti/bdtre/volumi-cerano.json`, 2554 edifici misurati su 3690); arredo OSM (`arredi` nel JSON, `src/grafica/arredi3d.js`, collisioni in `citta.js`); insegne dei negozi non più specchiate. Documentazione per il riuso: `MAPPA.md`. 34 test.
- Limiti dichiarati: personaggi = unico modello (soldato tinto); fontana e monumenti nel punto vero ma con forma generica; facciate e tetti generati.

## Rifacimento del 12/11 sera (mondo aperto) — pubblicato il 12/11
- Niente lobby: `src/rete/mondoPubblico.js` cerca il «faro» dell'host del mondo 1 (canale `mondo-N`), se nessuno risponde
  diventa host, se è pieno (8) passa al mondo 2; se l'host tace 6 s il giocatore con l'id più basso prende il suo posto
  (collaudo: «se chi ospita se ne va, la città passa all'altro»). `collegaHost.chiudiConnessione` chiude gli ospiti
  senza chiudere i segnali.
- Stato unico: `creaMondoAperto` / `allestisciColpo` / `chiudiColpo` in `partita.js`; la banda (`stato.banda`: capo,
  membri, colpo, inviti) va nell'istantanea (`bd`); fuga, esito e sconfitta contano solo i membri. Azioni nuove:
  chiama, rispondi, pianifica, avvia, lascia, attrezzi. La campagna è di ogni giocatore sul suo computer (evento
  `bottino`).
- Vita: `src/gioco/vita.js` (passanti sui marciapiedi, traffico sulla corsia destra a 40 km/h, furto dal traffico,
  le auto del traffico si tolgono di mezzo davanti alle sirene); polizia anche senza colpo (`allarme.punto`, si
  calma dopo 150 s).
- Persone: `public/modelli/persone/*.glb` generate da `strumenti/blender/personaggi.py` (MPFB + Moveset), texture
  ridotte da `strumenti/comprimi-glb.py`; l'aspetto lo decide la logica (`src/gioco/aspetto.js`) e passa in rete.
  Copertina e foto segnaletiche: `strumenti/blender/copertina.py`, `ritratti.py`. Blender e MPFB sono stati
  cancellati dal PC dopo l'uso (richiesta dell'utente): per rigenerare serve reinstallarli.
- Prestazioni: armi dei PNG fuse, persone fuori inquadratura non aggiornate, ombra del sole congelata al chiuso.
  Misure: colpi 58-60 fps in Alta, città 57-58 in Alta (60 in Media). 34 test, collaudo 22/22.
- Limiti: la Fontana e i monumenti hanno forma generica; il passamontagna è fatto di due pezzi del pacchetto
  MakeHuman tinti di nero (senza fori per gli occhi); un solo colpo alla volta per città.
