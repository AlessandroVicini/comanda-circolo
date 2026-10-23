# Comanda Circolo

Sistema di comanda per circoli e feste: ordini dal tavolo con QR, cameriere, schermate per cucina/pizzeria/bar, display "pronto", cassa, magazzino con scarico automatico da ricetta e prima nota stampabile.
Gira tutto nel browser (Firebase e il generatore di QR si caricano da CDN pubblici): il sito sta su **GitHub Pages** e i dati in tempo reale su **Firebase**, entrambi gratuiti.

## Cosa fa

| Postazione | A cosa serve |
|---|---|
| **Cliente (QR del tavolo)** | Il socio inquadra il QR, sceglie dal menù e invia l'ordine. Quando l'ordine è pronto il telefono suona, vibra e mostra una schermata "PRONTO!". |
| **Cameriere** | Mappa dei tavoli, presa ordini con note, conferma degli ordini arrivati dal QR, lista di quello che c'è da servire. |
| **Reparti** (Cucina, Pizzeria, Bar…) | Coda delle preparazioni del proprio reparto, con il riepilogo di quanto c'è da preparare in tutto. Con un tocco su "Pronto" il cliente viene avvisato. |
| **Display ritiro** | Per una TV o un tablet: mostra il numero dei tavoli con l'ordine pronto. Si possono fare anche chiamate manuali dalla Regia. |
| **Cassa** | Conto per tavolo (anche parziale o alla romana), vendita al banco con QR "segui il tuo ordine", calcolo del resto, uscite di cassa, storno dei movimenti. |
| **Magazzino** | Giacenze, carichi (con il costo aggiornato), inventario, lista della spesa per gli articoli sotto scorta. Ogni ordine scala gli ingredienti secondo la ricetta. Quando un ingrediente finisce, il prodotto risulta esaurito anche sul QR. |
| **Menù e ricette** | Prezzi, categorie, reparti, allergeni, ricette, food cost e margine per prodotto. |
| **Prima nota** | Il registro della serata con giorno, nome del socio, consumazione e importo, più i totali per contanti e POS e i contanti attesi in cassa. Si può stampare ed esportare in CSV (per serata o per mese) per il bilancio. |
| **Regia** | Apre e chiude la serata, attiva o disattiva il QR, chiama numeri sul display e mostra tutti gli ordini, le code dei reparti, gli incassi e i prodotti più venduti. |

Gli stati di un ordine sono: **da confermare** (solo per gli ordini dal QR) → **in preparazione** → **pronto** (scatta l'avviso al cliente e il numero compare sul display) → **servito**. Il pagamento è un'informazione separata, perché si può pagare prima o dopo.

## Provarlo subito (modalità demo)

Senza configurare nulla, l'app parte in **modalità demo** con il menù di esempio. I dati restano nel browser e più schede aperte si parlano tra loro: apri il cameriere, la cucina, il display e il QR di un tavolo in schede diverse e prova il giro completo.

## Metterlo online (circa 20 minuti, una volta sola)

### 1. Pubblica il sito su GitHub Pages
1. Su GitHub crea un repository nuovo, per esempio `comanda-circolo`, **pubblico**. Le pagine gratuite richiedono un repository pubblico, e nel codice non c'è niente di segreto.
2. Usa **Add file → Upload files** e trascina **tutto il contenuto** di questa cartella. Poi conferma con **Commit changes**.
3. Vai in **Settings → Pages**. In *Source* scegli **Deploy from a branch**, poi il branch `main` e la cartella `/ (root)`, e salva.
4. Dopo un minuto il sito è su `https://<tuo-utente>.github.io/comanda-circolo/`.

### 2. Crea il progetto Firebase
1. Vai su <https://console.firebase.google.com> → **Aggiungi progetto**. Google Analytics non serve.
2. **Build → Authentication → Inizia**. Nella scheda *Metodo di accesso* attiva **Email/password** e **Anonimo** (serve ai clienti del QR, che non devono registrarsi).
3. Sempre in Authentication, apri **Impostazioni → Domini autorizzati** e aggiungi `<tuo-utente>.github.io`.
4. **Build → Realtime Database → Crea database**. Come posizione scegli **Belgio (europe-west1)** e avvia in **modalità bloccata**.
5. Nella scheda **Regole** del database cancella tutto, incolla il contenuto del file `database.rules.json` e premi **Pubblica**.

### 3. Collega il sito a Firebase
1. In Firebase apri ⚙️ **Impostazioni progetto → Le tue app**, clicca l'icona web `</>`, dai un nome all'app e registrala. Firebase Hosting non serve.
2. Copia l'oggetto `firebaseConfig` che compare. Controlla che contenga `databaseURL`: se manca, prendilo dall'indirizzo in cima alla pagina del Realtime Database.
3. Su GitHub apri `js/config.js`, clicca la matita ✏️ e sostituisci `export const FIREBASE_CONFIG = null;` con:
   ```js
   export const FIREBASE_CONFIG = { apiKey: "...", authDomain: "...", databaseURL: "...", projectId: "...", storageBucket: "...", messagingSenderId: "...", appId: "..." };
   ```
   Poi fai **Commit changes**. Questi valori non sono segreti: a proteggere i dati ci pensano le regole del database.

### 4. Primo avvio
1. Apri il sito e scegli **Crea account**: il **primo account in assoluto diventa amministratore**.
2. Vai in **Impostazioni → Carica menù e magazzino di esempio**, poi sistema prezzi e ricette in **Menù** e **Magazzino**.
3. In **Tavoli e QR** stampa i cartellini e mettine uno su ogni tavolo.
4. Gli altri volontari creano il proprio account dalla schermata di accesso e tu li abiliti da **Impostazioni → Staff**. Per i tablet fissi (cucina, display) va benissimo un account condiviso, per esempio "banco".

### Ogni serata
**Regia → Apri serata**, inserisci il fondo cassa e il gioco è fatto. A fine serata usa **Chiudi serata**: i QR smettono di accettare ordini e la prima nota resta consultabile e stampabile.

## Avvisi "ordine pronto" sui telefoni: cosa aspettarsi
- Il cliente tiene **aperta la pagina del QR** (o del numero, se ha ordinato al banco) e tocca **"Attiva avviso"**. Quando l'ordine è pronto la pagina diventa verde e lampeggia, suona e vibra, e su Android arriva anche la notifica di sistema. Lo schermo resta acceso finché la pagina è aperta.
- Su **iPhone** vibrazione e notifiche funzionano solo in parte: il suono e la schermata "PRONTO!" arrivano con la pagina aperta in primo piano. Per tutti c'è comunque il **display** con il numero del tavolo.
- Non è una notifica push "a app chiusa": per quella servirebbe un server a pagamento (Firebase Cloud Functions, piano Blaze).
- L'avviso arriva a chiunque abbia aperto il QR di quel tavolo, anche per gli ordini presi dal cameriere.

## Sicurezza
- I clienti (accesso anonimo) possono soltanto leggere il menù e **creare** ordini "da confermare", e solo se il QR del tavolo è valido, la serata è aperta e l'ordinazione dal QR è attiva. I prezzi vengono ricalcolati dal menù al momento della conferma.
- Se qualcuno fotografa i QR per fare scherzi, usa **Tavoli e QR → Rigenera tutti i QR** e ristampa i cartellini: i codici vecchi smettono di funzionare.
- Cassa, magazzino, ordini e prima nota sono accessibili solo agli account dello staff abilitati.

## Limiti del piano gratuito (Firebase Spark)
100 connessioni contemporanee, 1 GB di dati salvati e 10 GB al mese di traffico. Per un circolo bastano ampiamente: ogni telefono o tablet aperto conta come una connessione.

## Nota fiscale
È un gestionale interno: **non sostituisce il registratore telematico** né il documento commerciale, se l'attività ne richiede l'uso. La prima nota esportata serve per la contabilità dell'associazione. Su cosa sia commerciale o meno conviene sentire il comitato ARCI o il commercialista.

## Struttura
```
index.html              pagina unica (app a schermate con #/indirizzi)
css/app.css             stile (chiaro/scuro, mobile)
js/config.js            ← qui va la configurazione Firebase
js/db.js                dati: Firebase oppure demo locale
js/store.js, logic.js   stato condiviso e operazioni (ordini, cassa, magazzino)
js/seed.js              menù e magazzino di esempio
js/views/*.js           le schermate
database.rules.json     regole di sicurezza da incollare in Firebase
sw.js                   service worker per le notifiche
```
