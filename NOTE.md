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
