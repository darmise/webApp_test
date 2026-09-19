/**
 * config.js
 * Nessun valore qui è segreto: CLIENT_ID e SPREADSHEET_ID sono
 * identificativi pubblici. La protezione reale è la condivisione del
 * foglio su Google (solo chi è autorizzato può leggerlo).
 */

const CONFIG = {
  // Google Cloud Console > API e servizi > Credenziali > ID client OAuth
  GOOGLE_CLIENT_ID: "559443131366-7lo2fa3jv9u975c1mfhe0cocutacnih8.apps.googleusercontent.com",

  // Dall'URL del foglio: https://docs.google.com/spreadsheets/d/QUESTO/edit
  SPREADSHEET_ID: "INSERISCI_LO_SPREADSHEET_ID",

  // Nome del tab e intervallo da leggere (riga 1 = intestazioni colonne)
  SHEET_RANGE: "Foglio1!A1:Z1000",

  // Sola lettura: questa app non scrive mai sul foglio
  SCOPE: "https://www.googleapis.com/auth/spreadsheets.readonly",

  // Campi su cui cercare: devono corrispondere (in minuscolo) alle
  // intestazioni di colonna nel foglio. Per aggiungere un nuovo criterio
  // di ricerca (es. "email" o "codice"), basta aggiungerlo qui: il modulo
  // di ricerca si genera automaticamente da questa lista.
  SEARCH_FIELDS: [
    { key: "nome", label: "Nome" },
    { key: "cognome", label: "Cognome" }
  ]
};
