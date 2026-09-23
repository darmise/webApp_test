/**
 * script.js
 * App statica, nessun backend. Dopo il login Google, il browser legge
 * (sola lettura) il foglio configurato in config.js e cerca per NOMINATIVO.
 * Se più persone condividono lo stesso nominativo, viene mostrata una
 * lista di selezione (disambiguata tramite data di nascita).
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
const viewSelect = document.getElementById("view-select");
const viewResult = document.getElementById("view-result");
const allViews = [viewLogin, viewSearch, viewSelect, viewResult];

const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");
const btnNewSearch = document.getElementById("btn-new-search");
const btnBackToSearch = document.getElementById("btn-back-to-search");
const loginError = document.getElementById("login-error");
const searchStatus = document.getElementById("search-status");
const searchForm = document.getElementById("search-form");
const candidateList = document.getElementById("candidate-list");
const resultContent = document.getElementById("result-content");

// ---- Navigazione viste ----
function showView(view, bandState = "neutral") {
  allViews.forEach(v => v.classList.add("hidden"));
  view.classList.remove("hidden");
  setStatusBand(bandState);
}

function setStatusBand(state) {
  statusBand.classList.remove("band-ok", "band-no");
  if (state === "ok") statusBand.classList.add("band-ok");
  if (state === "no") statusBand.classList.add("band-no");
}

// ---- Login / Logout ----
window.addEventListener("load", () => {
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
  console.error("Dettaglio errore:", err);
  const message = err && err.status === 403
    ? "Il tuo account non è autorizzato a consultare questo elenco. Contatta l'amministratore."
    : (err && err.message) || "Impossibile leggere i dati in questo momento. Riprova più tardi.";
  loginError.textContent = message;
  loginError.classList.remove("hidden");
  showView(viewLogin);
}

// ---- Lettura del foglio (struttura originale, non modificata) ----

/**
 * Ricostruisce le intestazioni piatte leggendo le due righe di intestazione
 * del foglio così come sono (gruppo + sotto-campo), esattamente come nel
 * file Excel originale. Una cella di gruppo vuota eredita l'ultimo gruppo
 * non vuoto a sinistra (è così che appaiono le celle unite lette via API:
 * il valore compare solo nella cella in alto a sinistra della fusione).
 */
function detectHeaderRows(values) {
  const target = CONFIG.SEARCH_FIELD.trim().toLowerCase();
  const maxScan = Math.min(values.length, 30); // non serve guardare oltre le prime righe

  for (let r = 0; r < maxScan; r++) {
    const row = values[r] || [];
    const found = row.some(cell => (cell || "").toString().trim().toLowerCase() === target);
    if (found) {
      return { group: r + 1, sub: r + 2, dataStart: r + 3 }; // numerazione 1-based, come nel foglio
    }
  }
  return null;
}

function buildFlatHeaders(values, headerRows) {
  const groupRow = values[headerRows.group - 1] || [];
  const subRow = values[headerRows.sub - 1] || [];
  const colCount = Math.max(groupRow.length, subRow.length);

  const headers = [];
  let lastGroup = "";
  for (let c = 0; c < colCount; c++) {
    const group = (groupRow[c] || "").toString().trim();
    const sub = (subRow[c] || "").toString().trim();
    if (group) lastGroup = group;

    let header;
    if (sub) {
      header = `${lastGroup} - ${sub}`;
    } else {
      header = group; // colonna senza sotto-campo (es. NOMINATIVO, NOTE)
    }
    headers.push(header.trim().toLowerCase());
  }
  return headers;
}

async function loadSheetData() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(CONFIG.SHEET_RANGE)}`;
  let res;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch (networkErr) {
    // fetch stesso ha fallito: nessuna risposta dal server (rete, CORS, offline...)
    const err = new Error("Connessione all'API di Google Sheets fallita (verifica la connessione di rete).");
    err.status = 0;
    throw err;
  }

  if (!res.ok) {
    let apiMessage = "";
    try {
      const body = await res.json();
      apiMessage = body?.error?.message || "";
    } catch (_) { /* corpo non JSON o vuoto */ }

    const err = new Error(apiMessage || `Errore HTTP ${res.status} dall'API di Google Sheets.`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const values = data.values || [];
  if (values.length === 0) { sheetHeaders = []; sheetRows = []; return; }

  const detected = detectHeaderRows(values);
  const headerRows = detected || CONFIG.HEADER_ROWS;

  const allHeaders = buildFlatHeaders(values, headerRows);

  // scarta colonne senza alcuna intestazione (celle vuote non appartenenti a nessun gruppo)
  const keepIdx = allHeaders.map((h, i) => h ? i : -1).filter(i => i !== -1);
  sheetHeaders = keepIdx.map(i => allHeaders[i]);

  const required = [CONFIG.SEARCH_FIELD, CONFIG.DISAMBIGUATION_FIELD.key];
  const missing = required.filter(k => !sheetHeaders.includes(k));
  if (missing.length > 0) {
    console.error("Intestazioni individuate:", sheetHeaders);
    console.error("Righe usate per l'intestazione:", headerRows);
    console.error("Prime 10 righe grezze del foglio:", values.slice(0, 10));
    throw new Error(
      `Colonna non trovata nel foglio: ${missing.join(", ")}. ` +
      `Apri la console del browser (F12) per vedere le prime righe grezze del foglio ` +
      `e capire in quale riga si trova realmente "${CONFIG.SEARCH_FIELD}".`
    );
  }

  const dataRows = values.slice(headerRows.dataStart - 1);
  sheetRows = dataRows.map(row => {
    const record = {};
    keepIdx.forEach((colIdx, i) => {
      record[sheetHeaders[i]] = row[colIdx] !== undefined ? String(row[colIdx]).trim() : "";
    });
    return record;
  }).filter(r => r[CONFIG.SEARCH_FIELD]); // scarta righe vuote
}

/* ============================= RICERCA ============================= */

searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const query = document.getElementById("input-nominativo").value.trim().toLowerCase();
  const unilavOnly = true;
  if (!query) return;

  let pool = sheetRows;
  if (unilavOnly) {
    pool = pool.filter(r => (r[CONFIG.UNILAV_FIELD] || "").trim().toLowerCase() === CONFIG.UNILAV_YES_VALUE);
  }

  const matches = pool.filter(r => (r[CONFIG.SEARCH_FIELD] || "").toLowerCase().includes(query));

  if (matches.length === 0) {
    renderNotFound(query, unilavOnly);
    showView(viewResult, "no");
  } else if (matches.length === 1) {
    renderResult(matches[0]);
    showView(viewResult, "ok");
  } else {
    renderCandidateList(matches);
    showView(viewSelect);
  }
});

btnBackToSearch.addEventListener("click", () => showView(viewSearch));

btnNewSearch.addEventListener("click", () => {
  searchForm.reset();
  showView(viewSearch);
});

/* ===================== SELEZIONE OMONIMI ===================== */

function renderCandidateList(matches) {
  const dKey = CONFIG.DISAMBIGUATION_FIELD.key;
  const dLabel = CONFIG.DISAMBIGUATION_FIELD.label;

  candidateList.innerHTML = matches.map((m, i) => `
    <button type="button" class="candidate-row" data-idx="${i}">
      <span class="candidate-name">${escapeHtml(m[CONFIG.SEARCH_FIELD])}</span>
      <span class="candidate-meta">${escapeHtml(dLabel)}: ${escapeHtml(m[dKey] || "—")}</span>
    </button>
  `).join("");

  candidateList.querySelectorAll(".candidate-row").forEach(btn => {
    btn.addEventListener("click", () => {
      renderResult(matches[Number(btn.dataset.idx)]);
      showView(viewResult, "ok");
    });
  });
}

/* ============================= RISULTATO ============================= */

function renderNotFound(query, unilavOnly) {
  resultContent.innerHTML = `
    <h2 class="result-title no">Non trovato</h2>
    <p class="result-empty">Nessuna corrispondenza per "${escapeHtml(query)}" nell'elenco.</p>
  `;
}

function renderResult(match) {
  const dKey = CONFIG.DISAMBIGUATION_FIELD.key;
  const statoKey = "stato";

  // 1) identità: nominativo (già come titolo), data nascita, mansione
  const identityKeys = [dKey, "mansione"];
  const identityHtml = identityKeys
    .filter(k => sheetHeaders.includes(k))
    .map(k => {
      const label = k === dKey ? CONFIG.DISAMBIGUATION_FIELD.label : toTitleCase(k);
      return `<div class="detail-row"><span class="detail-label">${escapeHtml(label)}</span><span class="detail-value">${escapeHtml(match[k] || "—")}</span></div>`;
    }).join("");

  // 2) stato: l'informazione principale, mostrata in evidenza
  const statoHtml = sheetHeaders.includes(statoKey) ? `
    <div class="status-highlight">
      <span class="status-highlight-label">Stato</span>
      <span class="status-highlight-value">${escapeHtml(match[statoKey] || "—")}</span>
    </div>
  ` : "";

  // 3) attestati: solo quelli posseduti, con esito REGOLARE/SCADUTO calcolato sulla scadenza
  const excludeKeys = new Set([CONFIG.SEARCH_FIELD, dKey, "mansione", statoKey, "unilav"]);
  const { groups } = buildGroups(sheetHeaders, excludeKeys);
  const certRows = buildCertificationRows(groups, match);

  const certHtml = certRows.length > 0
    ? `<div class="cert-list">${certRows.map(c => `
        <div class="cert-row">
          <span class="cert-name">${escapeHtml(c.groupName)}</span>
          <span class="cert-meta">
            ${c.scadenzaLabel ? `<span class="cert-date">Scad. ${escapeHtml(c.scadenzaLabel)}</span>` : ""}
            <span class="cert-chip ${c.expired ? "chip-no" : "chip-ok"}">${c.expired ? "SCADUTO" : "REGOLARE"}</span>
          </span>
        </div>
      `).join("")}</div>`
    : `<p class="result-empty">Nessun attestato registrato.</p>`;

  resultContent.innerHTML = `
    <p class="result-subject">${escapeHtml(match[CONFIG.SEARCH_FIELD])}</p>
    <div class="detail-list">${identityHtml}</div>
    ${statoHtml}
    <div class="detail-group">
      <h3 class="detail-group-title">Attestati</h3>
      ${certHtml}
    </div>
  `;
}

/**
 * Per ogni categoria (es. "GRU", "PLE"...), determina se l'attestato/
 * certificato è posseduto (campo ATTESTATO o CERTIFICATO = "SI") e, se sì,
 * calcola REGOLARE/SCADUTO confrontando la SCADENZA con la data odierna.
 * Le categorie non possedute non vengono incluse nel risultato.
 */
function buildCertificationRows(groups, match) {
  const rows = [];
  Object.keys(groups).forEach(groupName => {
    const fields = groups[groupName];
    const possessoField = fields.find(f => f.subLabel === "attestato" || f.subLabel === "certificato");
    if (!possessoField) return;

    const possessoVal = (match[possessoField.key] || "").trim().toLowerCase();
    if (possessoVal !== "si") return;

    const scadenzaField = fields.find(f => f.subLabel === "scadenza");
    const scadenzaRaw = scadenzaField ? (match[scadenzaField.key] || "") : "";
    const status = computeCertStatus(scadenzaRaw);

    rows.push({
      groupName: toTitleCase(groupName),
      scadenzaLabel: scadenzaRaw,
      expired: status.known && status.expired
    });
  });
  return rows;
}

/** Interpreta una data in formato GG/MM/AAAA o AAAA-MM-GG (così come mostrata dal foglio). */
function parseDateFlexible(str) {
  if (!str) return null;
  const s = str.trim();

  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** REGOLARE se la scadenza è oggi o nel futuro, SCADUTO se nel passato. Se la data non è leggibile, si considera REGOLARE (nessuna scadenza nota). */
function computeCertStatus(scadenzaRaw) {
  const d = parseDateFlexible(scadenzaRaw);
  if (!d) return { known: false, expired: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return { known: true, expired: d.getTime() < today.getTime() };
}

/**
 * Divide le intestazioni (esclusi i campi già mostrati in alto) in:
 * - groups: { "nome gruppo": [{ subLabel, key }] }  — per header tipo "GRUPPO - SOTTOCAMPO"
 * - standalone: [{ label, key }]                     — per header senza gruppo (es. "note")
 */
function buildGroups(headers, excludeKeys) {
  const groups = {};
  const standalone = [];

  headers.forEach(h => {
    if (excludeKeys.has(h) || h === "n.") return;
    const sepIdx = h.indexOf(" - ");
    if (sepIdx > -1) {
      const groupName = h.slice(0, sepIdx);
      const subLabel = h.slice(sepIdx + 3);
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push({ subLabel, key: h });
    } else {
      standalone.push({ label: h, key: h });
    }
  });

  return { groups, standalone };
}

/* ============================= Utility ============================= */

function toTitleCase(str) {
  return str.replace(/\s+/g, " ").trim().split(" ")
    .map(w => w.length ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w)
    .join(" ");
}

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
