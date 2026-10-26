# Hotel California: gestione prenotazioni

Applicazione web per gestire le prenotazioni di un albergo: calendario settimanale con le camere, cruscotto di oggi, prenotazioni con arrivi e annullamenti, e gestione delle camere. Realizzata con React e Firebase come progetto per il portfolio.

🔗 **Demo live:** https://hotel-california-gcl.web.app
Per provarla premi **Accedi in demo**: i dati sono di esempio (nomi e telefoni inventati) e la data di oggi è fissata a **lunedì 5 ottobre 2026**, così la settimana demo è sempre piena. Il pulsante **Oggi** del calendario riporta a quella data.

## Funzionalità

- **Accesso** con email e password (Firebase Authentication) e pulsante **Accedi in demo** con dati di prova già pronti.
- **Calendario settimanale** di 7 giorni, con le camere sulle righe raggruppate per tipologia (Standard, Superior, Suite). Ogni prenotazione è una barra che parte da metà del giorno di check-in e finisce a metà del giorno di check-out, quindi chi parte e chi arriva lo stesso giorno non si sovrappongono. Navigazione per settimana, pulsante **Oggi**, colonna di oggi evidenziata e casella **Mostra annullate**.
- **Cruscotto di oggi**: arrivi, partenze, camere occupate stanotte, libere e percentuale di occupazione, più una scheda per ogni camera con lo stato scritto a parole (Libera, Occupata, Arrivo oggi, Partenza oggi, Fuori servizio). Il filtro **Solo libere stanotte** mostra le camere disponibili. Il cruscotto resta su oggi anche quando il calendario mostra un’altra settimana.
- **Prenotazioni**: creazione dal pulsante **Nuova prenotazione** o cliccando una cella libera del calendario, dettaglio, modifica, registrazione dell’arrivo, annullamento ed eliminazione (solo se annullata), sempre con conferma per le azioni che non si possono rimettere a posto. Notti e totale si calcolano da soli.
- **Controlli sulle prenotazioni**: check-out dopo il check-in, soggiorno massimo di 30 notti, nessuna sovrapposizione sulla stessa camera (verificata leggendo dal database, anche fuori dalla settimana mostrata), capienza rispettata, camere fuori servizio escluse. In modifica la tariffa resta quella bloccata alla prenotazione, finché non si cambia camera.
- **Gestione delle camere**: elenco, aggiunta, modifica di nome, tipologia, capienza e prezzo, fuori servizio ed eliminazione. Una camera con soggiorni in corso o futuri non si mette fuori servizio, non si riduce sotto le persone già prenotate e non si elimina se ha prenotazioni.
- **Modalità demo separata**: l’account demo lavora su collezioni distinte (`roomsDemo` e `bookingsDemo`) e non vede mai i dati reali. In fondo alla pagina un avviso spiega la data fissa.

### Stati di una prenotazione

Gli stati **salvati** sono tre: **Prenotata**, **Arrivato** e **Annullata**. Si passa da Prenotata ad Arrivato o ad Annullata, e da lì non si torna indietro.

**«Partito» non si salva**: una prenotazione non annullata con il check-out già passato viene mostrata come Partito ed è di sola lettura. Il giorno del check-out è ancora modificabile. Se un cliente parte prima o dopo del previsto, si modifica il check-out: la camera si libera o resta occupata di conseguenza, senza un passaggio di stato a parte.

## Stack

- React e Vite
- Tailwind CSS (la palette è definita in `src/index.css`)
- Firebase: Authentication, Cloud Firestore, Hosting
- lucide-react (icone)
- Vitest e Testing Library (test)

## Architettura

L’applicazione è una **Single Page Application** in React che usa Firebase come backend gestito (Backend-as-a-Service): non c’è un server proprio da mantenere.

Il codice è organizzato a **livelli**, con separazione delle responsabilità, secondo il pattern **Container/Presentational** con hook personalizzati. Il flusso dei dati è:

`Componenti (interfaccia)  →  Hook (stato e controlli)  →  Service (accesso ai dati)  →  Firebase`

Le regole di dominio (date, notti, sovrapposizioni, stati, stato di una camera in un giorno, posizione delle barre) sono **funzioni pure** in `utils/`, senza React né Firebase, e per questo si provano facilmente.

```
src/
├── firebase.js            # inizializzazione Firebase (unico punto)
├── App.jsx                # accesso o schermata principale
├── index.css              # tema: colori e carattere
├── services/              # accesso ai dati, nessuna logica di interfaccia
│   ├── authService.js
│   ├── roomsService.js
│   └── bookingsService.js
├── hooks/                 # stato, caricamento, errori e controlli
│   ├── useAuth.js
│   ├── useRooms.js
│   └── useBookings.js
├── components/            # interfaccia: ricevono tutto dalle props
│   ├── Dashboard.jsx      # contenitore: usa gli hook e passa i dati
│   ├── Calendar.jsx
│   ├── TodayBoard.jsx
│   ├── BookingDetail.jsx
│   ├── BookingForm.jsx
│   ├── RoomManager.jsx
│   ├── Modal.jsx
│   ├── LoginPage.jsx
│   └── ContactInfo.jsx
└── utils/                 # funzioni pure
    ├── dateUtils.js
    ├── bookingUtils.js
    ├── calendarUtils.js
    └── roomUtils.js
scripts/
├── demoData.js            # 20 camere e 52 prenotazioni di esempio
└── seedDemo.js            # carica i dati demo su Firestore
firestore.rules            # regole di sicurezza
```

Regole del progetto: un componente non importa mai Firebase, un hook non contiene JSX, un service non contiene stato React. I test stanno accanto al file che provano (`*.test.js` e `*.test.jsx`).

## Modello dei dati

Collezioni Firestore: `rooms` e `bookings` (dati reali), `roomsDemo` e `bookingsDemo` (dati demo).

**Camera** (un documento per camera):

| Campo           | Tipo    | Esempio                               |
| --------------- | ------- | ------------------------------------- |
| `name`          | string  | `"101"`                               |
| `type`          | string  | `"standard"`, `"superior"`, `"suite"` |
| `capacity`      | number  | `2` (persone, da 1 a 10)              |
| `pricePerNight` | number  | `85` (euro, intero)                   |
| `active`        | boolean | `true` (`false` = fuori servizio)     |

**Prenotazione** (un documento per soggiorno):

| Campo           | Tipo   | Esempio                                               |
| --------------- | ------ | ----------------------------------------------------- |
| `guestName`     | string | `"Marco Bianchi"` (intestatario)                      |
| `phone`         | string | `"333 000 1001"`                                      |
| `email`         | string | `""` (facoltativa, può essere vuota)                  |
| `roomId`        | string | `"room_101"` (collega la prenotazione alla camera)    |
| `checkIn`       | string | `"2026-10-05"`                                        |
| `checkOut`      | string | `"2026-10-08"`                                        |
| `guestsCount`   | number | `2` (numero di persone)                               |
| `nights`        | number | `3` (calcolato dall’app, massimo 30)                  |
| `pricePerNight` | number | `85` (tariffa bloccata al momento della prenotazione) |
| `total`         | number | `255` (notti × tariffa)                               |
| `status`        | string | `"booked"`, `"checkedIn"` o `"cancelled"`             |
| `notes`         | string | `""`                                                  |

Le date sono salvate come testo `AAAA-MM-GG`. Una settimana si legge con **una sola interrogazione** per intervallo su `checkIn`, che parte 30 giorni prima dell’inizio della settimana (il soggiorno più lungo) in modo da includere anche i soggiorni iniziati prima e ancora in corso; quelli già finiti si scartano nell’app. Non servono indici aggiuntivi.

## Sicurezza

Le regole di Firestore (`firestore.rules`) stabiliscono che:

- il **personale** (elenco di email nelle regole) può leggere e scrivere sia i dati reali sia quelli demo;
- l’**account demo** può accedere solo alle collezioni `roomsDemo` e `bookingsDemo`;
- chiunque altro non può leggere né scrivere nulla;
- ogni camera e ogni prenotazione viene validata (tipi, lunghezze, formato delle date, `checkOut` dopo `checkIn`, massimo 30 notti, `total` uguale a notti × tariffa, nessun campo non previsto);
- gli stati ammessi sono tre e i passaggi consentiti sono solo Prenotata → Arrivato e Prenotata → Annullata; una prenotazione annullata non si modifica; dopo l’arrivo il check-in non si cambia;
- una prenotazione si elimina solo se è annullata.

La registrazione con email e password è aperta a chiunque abbia la chiave web, che per le app Firebase è pubblica. Per questo il personale è riconosciuto da un elenco di email nelle regole e non da un semplice «utente autenticato».

Le credenziali dell’account demo sono pubbliche per scelta: l’account vede solo dati inventati.

## Installazione in locale

Servono Node.js 20 o superiore e un progetto Firebase con Authentication (email e password) e Firestore.

```bash
git clone <URL-DEL-REPOSITORY>
cd hotel-california
npm install
cp .env.example .env        # su Windows PowerShell: Copy-Item .env.example .env
npm run dev
```

### Variabili d’ambiente (`.env`)

| Variabile                           | Contenuto                                  |
| ----------------------------------- | ------------------------------------------ |
| `VITE_FIREBASE_API_KEY`             | dalla configurazione dell’app web Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN`         | idem                                       |
| `VITE_FIREBASE_PROJECT_ID`          | idem                                       |
| `VITE_FIREBASE_STORAGE_BUCKET`      | idem                                       |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | idem                                       |
| `VITE_FIREBASE_APP_ID`              | idem                                       |
| `VITE_DEMO_EMAIL`                   | email dell’account demo                    |
| `VITE_DEMO_PASSWORD`                | password dell’account demo                 |
| `VITE_CONTACT_EMAIL`                | email mostrata nel pulsante «Contatti»     |

Il file `.env` non va mai caricato nel repository: è escluso dal `.gitignore`. Nelle regole di `firestore.rules` vanno sostituiti i due segnaposto con le email del personale e dell’account demo.

### Dati demo

Lo script `scripts/seedDemo.js` svuota le collezioni `roomsDemo` e `bookingsDemo` e le riempie con 20 camere e 52 prenotazioni di esempio, attorno alla data demo. La data fissa è la costante `DEMO_TODAY` in `src/utils/dateUtils.js`: se la cambi, vanno cambiate anche le date in `scripts/demoData.js`. Lo script non tocca mai le collezioni reali.

```powershell
# PowerShell
$env:SEED_EMAIL = "email-del-personale"
$env:SEED_PASSWORD = "password"
node --env-file=.env scripts/seedDemo.js
Remove-Item Env:SEED_PASSWORD
```

```bash
# macOS / Linux
SEED_EMAIL="email-del-personale" SEED_PASSWORD="password" node --env-file=.env scripts/seedDemo.js
```

Con `node scripts/seedDemo.js --dry-run` si vede cosa verrebbe caricato, senza scrivere nulla. Rilanciandolo, la demo torna allo stato iniziale: conviene farlo ogni tanto, perché i visitatori possono modificare i dati.

## Test

```bash
npm test          # test automatici (Vitest)
npm run lint
npm run build
```

I test automatici sono oltre 300. Provano le funzioni di dominio, i service (con Firestore simulato), gli hook (con i service simulati) e i componenti, compresi focus, tastiera, finestre di dialogo e stati scritti a parole. Sui dati demo controllano anche che non ci siano sovrapposizioni e che i numeri del cruscotto siano quelli attesi.

## Piano gratuito di Firebase

Il progetto è pensato per il piano gratuito (Spark). Con i dati demo, aprire la pagina legge circa 100 documenti (20 camere, la settimana mostrata e di nuovo la data di oggi per il cruscotto), cambiare settimana ne rilegge circa 50, e ogni creazione, modifica o cambio di stato costa una scrittura più le letture per controllare le sovrapposizioni e riaggiornare il cruscotto. Per un uso da portfolio i consumi restano molto sotto le quote giornaliere; i limiti aggiornati sono nella documentazione di Firebase.

## Accessibilità

- Gli stati si leggono sempre anche a parole (Libera, Occupata, Arrivato, Partito...), mai solo dal colore.
- Gli errori dei moduli compaiono accanto ai campi e il focus va sul primo campo con un errore.
- Le finestre di dialogo tengono il focus al loro interno, si chiudono con Esc e riportano il focus dove era.
- Le azioni che non si possono rimettere a posto (annullare, eliminare) chiedono conferma, con il focus sulla scelta sicura.
- Le celle libere del calendario sono una scorciatoia per mouse e tocco e sono fuori dall’ordine di Tab (sarebbero circa 130 tappe); da tastiera la stessa funzione è il pulsante **Nuova prenotazione**.
- I contrasti dei colori sono stati calcolati secondo le soglie WCAG AA per testo e bordi dei campi.

Non è stata fatta una verifica con screen reader reali né con strumenti automatici di audit.

## Limiti noti e sviluppi futuri

- Il controllo delle **sovrapposizioni** e della **capienza** è nell’app e non nelle regole di Firestore, che non possono confrontare documenti diversi. Due salvataggi contemporanei sulla stessa camera potrebbero quindi entrare in conflitto.
- Il **blocco dei soggiorni già finiti** vale solo nell’app: le regole non possono confrontare la data di oggi. Una prenotazione mai passata ad Arrivato, con il check-out passato, risulta comunque «Partito» e non si può più annullare né eliminare.
- Le **regole di Firestore** e il collegamento reale con Firebase non sono coperti da test automatici (servirebbe l’emulatore): sono stati provati a mano.
- I dati demo sono **condivisi** tra tutti i visitatori e possono essere cambiati da chiunque.
- Il calendario su telefono richiede lo scorrimento orizzontale: una vista giornaliera per schermi piccoli è un’estensione prevista.
- Non ci sono tariffe stagionali, trattamenti (colazione, mezza pensione), tasse di soggiorno, pagamenti, email di conferma né un’anagrafica degli ospiti: l’intestatario si scrive a mano a ogni prenotazione. I prezzi sono interi, in euro.
- All’ultimo controllo `npm audit` segnalava vulnerabilità nella dipendenza indiretta `@grpc/grpc-js` di Firebase, che riguardano il lato server e non il codice che gira nel browser; da ricontrollare con gli aggiornamenti.
- Estensioni possibili: pulsante per registrare l’arrivo direttamente dalla scheda di oggi, stato di pulizia delle camere, ruoli differenziati per il personale, promemoria (richiederebbero le Cloud Functions e il piano a pagamento), date demo relative alla data fissa.
- I dati di un albergo reale sono **dati personali** (nomi, telefoni, date di soggiorno): prima di un uso con ospiti veri servono informativa privacy, consenso e una valutazione sulla conformità alla normativa vigente.

## Contatti

Per informazioni o collaborazioni: **gcl.dev42@gmail.com**
