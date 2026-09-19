
const CONFIG = {
  GOOGLE_CLIENT_ID: "1054897318345-fqkg9t81ag25tn566hk5662fk8oo06b0.apps.googleusercontent.com",

  SPREADSHEET_ID: "1Hr8wGG10SpNrxSa1iX-JnnRGUnaU_8Uik1xZjdNArNY",

  SHEET_RANGE: "Foglio1!A1:BI1000",

  SCOPE: "https://www.googleapis.com/auth/spreadsheets.readonly",

  HEADER_ROWS: {
    group: 4,
    sub: 5,
    dataStart: 6
  },

  SEARCH_FIELD: "nominativo",

  // Colonna usata per distinguere gli omonimi nella lista di selezione
  // quando la ricerca trova più persone con lo stesso nominativo.
  DISAMBIGUATION_FIELD: { key: "data nascita", label: "Data di nascita" },

  // Colonne mostrate come riepilogo rapido, subito sotto il nome, quando
  // si apre il risultato (oltre a tutte le altre, mostrate più sotto
  // raggruppate per categoria).
  HIGHLIGHT_FIELDS: ["mansione", "unilav", "stato"],

  // Colonna e valore usati dal filtro "cerca solo tra persone con Unilav = SI"
  UNILAV_FIELD: "unilav",
  UNILAV_YES_VALUE: "si"
};
