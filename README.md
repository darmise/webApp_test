# Controllo Accessi — Frontend (login, ricerca, risultato)

App statica (HTML/CSS/JS, nessun server) con 3 viste:

1. **Login** — accesso con Google
2. **Ricerca** — campi generati da `CONFIG.SEARCH_FIELDS` (di default nome + cognome)
3. **Risultato** — dati della persona se trovata, o messaggio di assenza

**Sicurezza**: nessuna credenziale nel codice. L'accesso ai dati dipende
solo dalla condivisione del foglio Google (solo chi è autorizzato come
Viewer può leggerlo); l'app è di sola lettura, non scrive mai sul foglio.

## File

| File | Ruolo |
|---|---|
| `index.html` | struttura delle 3 viste |
| `style.css` | stile |
| `config.js` | **unico file da modificare**: credenziali Google + campi di ricerca |
| `script.js` | login, lettura foglio, ricerca, rendering risultato |

## 1. Prepara il foglio Google

Prima riga = intestazioni colonna, devono includere almeno `nome` e
`cognome` (o i campi che scegli in `SEARCH_FIELDS`). Le altre colonne
sono libere e vengono mostrate automaticamente nel risultato.

```
nome     cognome   stato     scadenza
Mario    Rossi     attivo    2026-12-31
```

Condividi il foglio, come **Viewer**, solo con gli account Google
autorizzati a usare l'app.

## 2. Credenziali OAuth (Google Cloud Console)

1. [console.cloud.google.com](https://console.cloud.google.com/) → crea/scegli un progetto.
2. **API e servizi → Libreria** → abilita **Google Sheets API**.
3. **API e servizi → Schermata di consenso OAuth** → tipo Esterno →
   aggiungi come "utenti di test" gli account che useranno l'app.
4. **API e servizi → Credenziali → Crea credenziali → ID client OAuth**,
   tipo "Applicazione web". In "Origini JavaScript autorizzate" inserisci
   l'URL di GitHub Pages (es. `https://tuo-utente.github.io`). Copia il
   **Client ID**.

## 3. Configura `config.js`

```js
const CONFIG = {
  GOOGLE_CLIENT_ID: "IL-TUO-CLIENT-ID.apps.googleusercontent.com",
  SPREADSHEET_ID: "IL-TUO-SPREADSHEET-ID",
  SHEET_RANGE: "Foglio1!A1:Z1000",
  SCOPE: "https://www.googleapis.com/auth/spreadsheets.readonly",
  SEARCH_FIELDS: [
    { key: "nome", label: "Nome" },
    { key: "cognome", label: "Cognome" }
  ]
};
```

Per aggiungere un nuovo criterio di ricerca (es. un codice tessera),
basta aggiungere una riga a `SEARCH_FIELDS` — il modulo si aggiorna da
solo, nessuna modifica a `script.js` o `index.html` necessaria:

```js
SEARCH_FIELDS: [
  { key: "nome", label: "Nome" },
  { key: "cognome", label: "Cognome" },
  { key: "codice", label: "Codice tessera" }
]
```

## 4. Pubblica su GitHub Pages

Carica i 4 file nella root del repo (o in `/docs`), poi
**Settings → Pages** → seleziona branch/cartella. L'URL generato deve
combaciare con l'origine autorizzata al punto 2.
