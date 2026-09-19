/**
 * script.js
 * App statica, nessun backend. Dopo il login Google, il browser legge
 * direttamente (sola lettura) il foglio configurato in config.js.
 * L'accesso ai dati dipende solo dalla condivisione del foglio su Google:
 * chi non è stato autorizzato come Viewer riceve un errore di permessi.
 */

// ---- Stato ----
let accessToken = null;
let tokenClient = null;
let sheetHeaders = [];
let sheetRows = [];

// ---- Riferimenti DOM ----
const statusBand = document.getElementById("status-band");
const userBadge = document.getElementById("user-badge");

const viewLogin = document.getElementById("view-login");
const viewSearch = document.getElementById("view-search");
const viewResult = document.getElementById("view-result");

const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");
const btnNewSearch = document.getElementById("btn-new-search");
const loginError = document.getElementById("login-error");
const searchStatus = document.getElementById("search-status");
const searchForm = document.getElementById("search-form");
const searchFieldsContainer = document.getElementById("search-fields");
const resultContent = document.getElementById("result-content");

// ---- Navigazione viste ----
function showView(view) {
  [viewLogin, viewSearch, viewResult].forEach(v => v.classList.add("hidden"));
  view.classList.remove("hidden");
  setStatusBand(view === viewResult ? statusBand.dataset.lastState : "neutral");
}

function setStatusBand(state) {
  statusBand.classList.remove("band-ok", "band-no");
  if (state === "ok") statusBand.classList.add("band-ok");
  if (state === "no") statusBand.classList.add("band-no");
  statusBand.dataset.lastState = state;
}

// ---- Costruzione dinamica del form di ricerca da CONFIG.SEARCH_FIELDS ----
function buildSearchForm() {
  searchFieldsContainer.innerHTML = CONFIG.SEARCH_FIELDS.map(f => `
    <div class="field">
      <label for="input-${f.key}">${escapeHtml(f.label)}</label>
      <input type="text" id="input-${f.key}" data-field="${f.key}" autocomplete="off" required>
    </div>
  `).join("");
}

// ---- Login / Logout ----
window.addEventListener("load", () => {
  buildSearchForm();
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    scope: CONFIG.SCOPE,
    callback: onLoginSuccess,
    error_callback: onLoginError
  });
});

btnLogin.addEventListener("click", () => {
  loginError.classList.add("hidden");
  tokenClient.requestAccessToken({ prompt: "consent" });
});

btnLogout.addEventListener("click", () => {
  if (accessToken) google.accounts.oauth2.revoke(accessToken, () => {});
  accessToken = null;
  sheetHeaders = [];
  sheetRows = [];
  userBadge.classList.add("hidden");
  showView(viewLogin);
});

async function onLoginSuccess(tokenResponse) {
  accessToken = tokenResponse.access_token;
  userBadge.textContent = "Connesso";
  userBadge.classList.remove("hidden");

  setStatus(searchStatus, "Caricamento elenco in corso...");
  try {
    await loadSheetData();
    clearStatus(searchStatus);
    showView(viewSearch);
  } catch (err) {
    console.error(err);
    handleFetchError(err);
  }
}

function onLoginError(err) {
  console.error(err);
  loginError.textContent = "Accesso non riuscito. Riprova.";
  loginError.classList.remove("hidden");
}

function handleFetchError(err) {
  const message = err && err.status === 403
    ? "Il tuo account non è autorizzato a consultare questo elenco. Contatta l'amministratore."
    : "Impossibile leggere i dati in questo momento. Riprova più tardi.";
  loginError.textContent = message;
  loginError.classList.remove("hidden");
  showView(viewLogin);
}

// ---- Lettura del foglio ----
async function loadSheetData() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(CONFIG.SHEET_RANGE)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

  if (!res.ok) {
    const err = new Error("Errore nella richiesta al foglio");
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const values = data.values || [];
  if (values.length === 0) { sheetHeaders = []; sheetRows = []; return; }

  sheetHeaders = values[0].map(h => String(h).trim().toLowerCase());

  const missing = CONFIG.SEARCH_FIELDS.map(f => f.key).filter(k => !sheetHeaders.includes(k));
  if (missing.length > 0) {
    throw new Error(`Il foglio non ha la colonna richiesta: ${missing.join(", ")}`);
  }

  sheetRows = values.slice(1).map(row => {
    const record = {};
    sheetHeaders.forEach((h, i) => { record[h] = row[i] !== undefined ? String(row[i]).trim() : ""; });
    return record;
  });
}

// ---- Ricerca ----
searchForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const criteria = CONFIG.SEARCH_FIELDS.map(f => ({
    key: f.key,
    value: document.getElementById(`input-${f.key}`).value.trim().toLowerCase()
  }));

  const match = sheetRows.find(row =>
    criteria.every(c => (row[c.key] || "").toLowerCase() === c.value)
  );

  renderResult(match, criteria);
  showView(viewResult);
});

function renderResult(match, criteria) {
  if (!match) {
    setStatusBand("no");
    const searched = criteria.map(c => c.value).filter(Boolean).join(" ");
    resultContent.innerHTML = `
      <h2 class="result-title no">Non trovato</h2>
      <p class="result-empty">Nessuna corrispondenza per "${escapeHtml(searched)}" nell'elenco.</p>
    `;
    return;
  }

  setStatusBand("ok");

  const primary = CONFIG.SEARCH_FIELDS.map(f => match[f.key]).filter(Boolean).join(" ");
  const searchKeys = new Set(CONFIG.SEARCH_FIELDS.map(f => f.key));

  const detailsHtml = sheetHeaders
    .filter(h => !searchKeys.has(h))
    .map(h => `
      <div class="detail-row">
        <span class="detail-label">${escapeHtml(h)}</span>
        <span class="detail-value">${escapeHtml(match[h] || "—")}</span>
      </div>
    `).join("");

  resultContent.innerHTML = `
    <h2 class="result-title ok">Trovato</h2>
    <p class="result-subject">${escapeHtml(primary)}</p>
    <div class="detail-list">${detailsHtml}</div>
  `;
}

btnNewSearch.addEventListener("click", () => {
  searchForm.reset();
  showView(viewSearch);
});

// ---- Utility ----
function setStatus(el, message) {
  el.textContent = message;
  el.classList.remove("hidden");
}

function clearStatus(el) {
  el.classList.add("hidden");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}
