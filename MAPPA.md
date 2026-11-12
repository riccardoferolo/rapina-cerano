# La mappa di Cerano — come riusarla

La città del gioco è un file di dati più due cartelle di codice senza dipendenze dal gioco. Per usarla in un
altro progetto bastano questi tre pezzi:

| Pezzo | Cosa contiene | Dipende da |
|---|---|---|
| `public/cerano/cerano.json` (+ `suolo.jpg`) | tutta la città, in metri | niente |
| `src/citta/` | collisioni, grafo stradale con A*, marciapiedi, quote dei ponti, parcheggi | niente (JS puro, gira anche in Node) |
| `src/grafica/citta3d.js`, `facciate.js`, `superfici.js`, `alberi3d.js`, `lampioni3d.js`, `arredi3d.js`, `materiali.js`, `atlante.js`, `atmosfera.js`, `scena.js` | il disegno con three.js 0.170 | three |

```js
import { preparaCitta } from './src/citta/citta.js';
import { creaMondo } from './src/grafica/scena.js';

const dati = await (await fetch('./cerano/cerano.json')).json();
const citta = preparaCitta(dati);                     // collisioni, grafo, quote, parcheggi
const mondo = await creaMondo(contenitore, citta);    // scena three.js con città, alberi, lampioni, arredo
mondo.disegna({ x: 0, y: 1.7, z: 10, yaw: 0, pitch: 0 }, 1 / 60);
```

## Sistema di riferimento

- Metri, origine al **centro della facciata della chiesa parrocchiale** (Piazza Crespi).
- `x` verso est, `z` verso sud, `y` in alto; il piano è ruotato di **18,7°** perché le vie del centro
  siano dritte sugli assi. La conversione esatta sta in `strumenti/costruisci-cerano.mjs` (`proietta` e
  `aGeo`): `origine` nel JSON porta latitudine, longitudine e rotazione.
- Copre un quadrato di ±2600 m (`limite`).

## Il file `cerano.json`

| Chiave | Forma | Note |
|---|---|---|
| `vie` | elenco di nomi | i nomi veri delle strade |
| `edifici[]` | `{ id, u, m, h, np, t, ct, cm, p, n?, hr? }` | `id` OSM; `u` uso (`centro`, `villetta`, `condominio`, `cascina`, `capannone`, `chiesa`, `municipio`, `box`, …); `m` muro; `h` altezza alla gronda in metri; `np` piani; `t` tetto `falde`/`piano`; `ct`/`cm` colore tetto e muro; `p` impronta (anello antiorario); `hr: 1` se l'altezza è **misurata** (BDTRE) e non stimata |
| `strade[]` | `{ n, t, l, a, r, s, o, b, pe, p, … }` | `n` nome; `t` tipo OSM; `l` larghezza; `a` carrabile; `r` rango; `s` sterrata; `o` senso unico; `b` ponte; `pe` pedonale; `p` asse |
| `aree[]` | `{ t, p, c? }` | `campo`, `prato`, `parco`, `bosco`, `piazza`, `parcheggio`, `piscina` (95 piscine vere), `cimitero`, … |
| `acque[]` | `{ n, t, l, p }` | rogge, canali, il Ticino |
| `ferrovie[]` | `{ b, p }` | |
| `alberi[]` | `[x, z, scala]` | dalla ortofoto più gli alberi singoli di OSM |
| `lampioni[]` | `[x, z, angolo, aMuro]` | |
| `arredi[]` | `[tipo, x, z, angolo, extra]` | dati OSM: `strisce` (extra = larghezza strada), `linea` di stop, `stop`, `precedenza`, `semaforo`, `fermata` (extra = nome), `fontana`, `fontanella`, `monumento`, `stele` |
| `luoghi[]` | `{ n, t, x, z }` | negozi e servizi con nome (solo per orientarsi, nel gioco i nomi sono inventati) |

## Quanto è fedele

- **Impronte di edifici, strade, acque, piscine, arredo**: OpenStreetMap, al metro.
- **Altezze**: 2554 edifici su 3690 hanno l'altezza **misurata** col LiDAR (Regione Piemonte – BDTRE,
  volumi ARPA da rilievo 2009-2011, media fra gronda e colmo, convertita in altezza di gronda). Gli altri
  1134 (garage, tettoie, costruzioni recenti, valori di ripiego da 3 m) restano stimati da tipo e posizione.
- **Colori di tetti e campi, alberi**: ortofoto 2010.
- **Non** sono nei dati: facciate reali (finestre e colori sono generati), forma dei tetti, interni,
  campanili come volumi a sé. La Fontana Beato Pacifico e i monumenti sono nel punto giusto ma con forma
  generica: OSM dice dove sono, non com'erano fatti.

## Rigenerarla

```bash
node strumenti/scarica-dettagli.mjs          # arredo OSM (Overpass, ritenta su più server)
npm run cerano                                # ricostruisce public/cerano/cerano.json
```

`costruisci-cerano.mjs` legge i dati OSM della cartella di GTA Cerano (solo lettura), i dettagli in
`strumenti/osm/`, le altezze in `strumenti/bdtre/volumi-cerano.json` (estratto dal servizio WFS
`geoservices.csi.it/.../bdtre_imm`, strato `un_vol`, coordinate UTM 32N convertite da `altezze-bdtre.mjs`).

## Licenze da citare

Dati © OpenStreetMap contributors (ODbL) · Ortofoto 2010 © Regione Piemonte (CC BY 4.0) · Altezze edifici
© Regione Piemonte – BDTRE, ARPA Piemonte (CC BY 4.0).
