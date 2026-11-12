# Rapina a Cerano — documento di design

Co-op online da 2 a 4 amici, in prima persona, grafica realistica, senza zombie. Cerano (Novara) è
ricostruita in metri dai dati OpenStreetMap; i colpi, i nomi dei negozi e della banca sono inventati,
le vie sono quelle vere.

## Ciclo di gioco

```
Rifugio (cascina) ─► mappa del paese ─► preparazione o colpo ─► fuga in auto ─► rifugio
   ▲  spartizione, acquisti, potenziamenti                                         │
   └───────────────────────────────────────────────────────────────────────────────┘
```

Un colpo: **arrivo** in borghese (nessuno vi bada) → **dentro** col passamontagna (si può essere
scoperti) → **bottino** nei sacchi fino al veicolo → **fuga** fino a una delle uscite del paese e poi al
rifugio, seminando la polizia.

## Campagna — difficoltà che cresce

| # | Colpo | Dove (via vera) | Cosa c'è di nuovo | Bottino |
|---|---|---|---|---|
| 1 | Tabaccheria «Il Fumo del Borgo» | Via Roma | titolare, una telecamera, cassaforte a combinazione | 10-20 mila € |
| 2 | Furgone portavalori «Blindati Ovesticino» | percorso su Via Novara | furgone che gira, 2 guardie armate, porta da tagliare | 40-60 mila € |
| 3 | Oreficeria «La Spiga d'Oro» | Via Giuseppe Mazzini | vetrine da rompere, guardia, 3 telecamere, retro | 80-120 mila € |
| 4 | Credito Rurale Ceranese | Via Giacomo Matteotti | tessera del direttore, caveau a tempo, 3 guardie | 200-300 mila € |
| 5 | Caveau del Municipio | Piazza Crespi | sotterraneo, due tessere, porta blindata, trapano termico | 500-700 mila € |

Il colpo n+1 si sblocca finendo il colpo n. Ogni colpo si può rigiocare.

**Preparazioni** (prima dei colpi 3-5, facoltative ma decisive):

| Preparazione | Dove | Vantaggio nel colpo |
|---|---|---|
| Rubare il furgone per la fuga | zona industriale di Via Novara | veicolo più capiente e robusto (6 sacchi invece di 4) |
| Fotografare telecamere e guardie | attorno al bersaglio, di giorno | giri delle guardie e telecamere sulla mappa |
| Procurarsi la tessera magnetica | il direttore al bar di Piazza Crespi | la porta del caveau si apre subito |
| Rubare il trapano termico | cantiere di Via Vigevano | casseforti grosse e porte blindate in metà tempo |
| Tagliare la linea telefonica | centralina davanti alla banca | la polizia arriva più tardi |

## Rifugio

Una cascina vera in fondo a Via Ranzina, fra i campi a nord-ovest del paese. Dentro: il tavolo con la **mappa di Cerano**
(si sceglie il colpo o la preparazione), la **spartizione** (il bottino del colpo diviso fra i presenti),
il **banco degli attrezzi** (grimaldelli, fascette, trapano, silenziatore, kit medico, giubbotto) e i
**potenziamenti** del ruolo. I soldi sono di ciascuno; la campagna è salvata dal capo della banda.

## Ruoli

Tutti possono fare tutto, ma lentamente o con rumore; il ruolo giusto lo fa bene. Così ci si coordina.

| Ruolo | Solo lui lo fa bene | Passivo |
|---|---|---|
| Scassinatore | serrature in 3 s (gli altri 12 s), casseforti a combinazione «a orecchio» | trapano più veloce e silenzioso |
| Hacker | mette in loop le telecamere, apre le porte elettroniche, ritarda la chiamata alla polizia | vede le guardie dalle telecamere |
| Autista | avvia un'auto senza chiavi in 2 s (gli altri 10 s con l'allarme dell'auto) | auto più veloce, vede le volanti sulla mappa in fuga |
| Uomo d'azione | stende una guardia alle spalle senza rumore, porta 2 sacchi | più vita, intimidisce gli ostaggi al volo |

## Due approcci per ogni colpo

**Di nascosto** — guardie col cono di vista (60°, 16 m, 6 m al buio), telecamere che ruotano, rumore
(corsa, vetri, trapano, spari senza silenziatore). Ogni guardia ha un **sospetto** che sale finché vi vede
o sente; pieno = allarme. Una guardia stesa va nascosta, una telecamera rotta insospettisce chi passa.

**A sparatoria** — allarme, la polizia arriva dopo un tempo (meno se nessuno ha tagliato il telefono),
poi **a ondate** sempre più grosse, con le volanti che bloccano le vie. Gli **ostaggi** (fascette) fanno
guadagnare tempo prima di ogni ondata.

## Varietà: il seme

Ogni partita ha un seme casuale che sceglie: stanza e muro della cassaforte, combinazione e dove sta il
foglietto, giri delle guardie, telecamere attive, porta di servizio aperta o chiusa, dove è parcheggiata
l'auto della fuga, quali incroci hanno il posto di blocco e da quale uscita del paese si scappa.

## Bottino

Sacchi da portare a mano: rallentano (contanti poco, oro molto), non si corre, si **lanciano** (tasto G)
anche a un amico o dentro il bagagliaio. Il veicolo ha un numero di posti per i sacchi.

## Fuga in auto

Guida con fisica semplice ma credibile: aderenza, sbandata col freno a mano, peso, urti contro case e
auto, danni. Il passeggero spara dal finestrino. Le volanti seguono il grafo vero delle strade, fanno
posti di blocco agli incroci; si vince uscendo dal paese e restando lontani dalle sirene per 20 s.

## Cerano 3D

- **Dati**: `data/osm/cerano.json` e le foto aeree 2010 (Regione Piemonte, CC BY 4.0) di GTA Cerano, solo in
  lettura. Uno script (`strumenti/costruisci-cerano.mjs`) li trasforma una volta in `public/cerano/*.json`:
  metri, origine al centro della facciata della chiesa, ruotati di 18,7° come la Piazza di Ultima
  Campanella (x = est, z = sud).
- **Strade**: larghezza dal tipo OSM, marciapiedi con cordolo, strisce, incroci raccordati, nomi veri
  sulle targhe agli incroci. **Edifici**: sagome OSM, altezza stimata da tipo, area e posizione (centro
  storico 2-3 piani, villette 2, capannoni 7-9 m), colore del tetto dalla foto aerea, facciate a finestre
  con persiane, tetti a falde. **Campagna**: campi, boschi, rogge, filari, alberi dalla foto aerea.
- **60 fps**: geometria fusa per materiale in celle da 160 m accese solo se inquadrate e vicine; due
  livelli di dettaglio (vicino: finestre in rilievo, persiane, arredo; lontano: scatole con texture);
  nebbia e distanza di vista per livello; alberi, lampioni e auto parcheggiate con `InstancedMesh`.
- **Livelli di qualità** Alta / Media / Bassa (Automatica), come Ultima Campanella, con discesa
  automatica se si scende sotto i 50 fps.

## Rete

Come Ultima Campanella: segnali su Supabase (o `BroadcastChannel` con `?locale`), WebRTC fra i giocatori.
Chi crea la stanza è l'host: simula a 60 Hz guardie, polizia, allarme, bottino e manda istantanee
validate 20 volte al secondo. Ognuno è padrone della propria posizione e dell'auto che guida.

## Codice

| Cartella | Cosa |
|---|---|
| `strumenti/` | costruzione dei dati di Cerano da OSM e foto aeree |
| `src/citta/` | dati del paese, collisioni, grafo stradale (comuni a host e ospiti, senza grafica) |
| `src/gioco/` | regole, partita dell'host, guardie, polizia, veicoli, colpi, campagna |
| `src/grafica/` | scena, città, edifici, strade, verde, auto, persone, interni, vista in prima persona |
| `src/rete/` | segnali e collegamento (copiati da Ultima Campanella) |
| `test/` | test della logica (`node --test`) |
| `_lavoro/` | Playwright con Edge su GPU: collaudo in due, fps, foto |
