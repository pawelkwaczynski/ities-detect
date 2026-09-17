import { locale, t } from "/shared/i18n.js";
import {
  belowThresholdSentence,
  folderStatsText,
  justification,
  nextSentence,
  verdictInfo,
} from "./format.js";
import { pointTable } from "./details.js";
import { renderOffscreenPng } from "./chart.js";

const DB_NAME = "ities-detect";
const STORE = "session";
const SESSIONS = "sessions";
const LEGACY_KEY = "current";
const META_KEY = "meta";
const DB_VERSION = 2;
export const SESSION_FILE_FORMAT = "ities-session/1";
export const SESSION_FILE_WARN_BYTES = 200 * 1024 * 1024;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(SESSIONS)) db.createObjectStore(SESSIONS, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run(store, mode, work) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const result = work(tx.objectStore(store));
        tx.oncomplete = () => resolve(result instanceof IDBRequest ? result.result : result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
}

function emptyPayload() {
  return { files: [], folders: [], skipped: null, duplicateSkipped: 0, operator: "", filter: "all" };
}

async function readMeta() {
  const meta = await run(STORE, "readonly", (store) => store.get(META_KEY));
  return meta && typeof meta === "object" ? meta : { currentId: null };
}

async function writeMeta(meta) {
  await run(STORE, "readwrite", (store) => store.put(meta, META_KEY));
}

async function allSessions() {
  const rows = await run(SESSIONS, "readonly", (store) => store.getAll());
  return Array.isArray(rows) ? rows : [];
}

function sessionSummary(record) {
  const files = record.payload?.files || [];
  return {
    id: record.id,
    name: record.name,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    files: files.length,
    bytes: files.reduce((sum, file) => sum + (Number(file.sizeBytes) || 0), 0),
  };
}

export function defaultSessionName(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

// The one session of version 1.3 has no name and no id. It becomes the first named
// session instead of being thrown away the moment the store grows a second shape.
async function migrateLegacy() {
  const legacy = await run(STORE, "readonly", (store) => store.get(LEGACY_KEY));
  if (!legacy) return null;
  const now = new Date().toISOString();
  const record = {
    id: newId(),
    name: defaultSessionName(new Date()),
    createdAt: now,
    updatedAt: now,
    payload: legacy,
  };
  await run(SESSIONS, "readwrite", (store) => store.put(record));
  await run(STORE, "readwrite", (store) => store.delete(LEGACY_KEY));
  return record;
}

export async function ensureCurrentSession() {
  const meta = await readMeta();
  if (meta.currentId) {
    const record = await run(SESSIONS, "readonly", (store) => store.get(meta.currentId));
    if (record) return record;
  }
  const rows = await allSessions();
  if (rows.length) {
    const newest = rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
    await writeMeta({ currentId: newest.id });
    return newest;
  }
  const migrated = await migrateLegacy();
  if (migrated) {
    await writeMeta({ currentId: migrated.id });
    return migrated;
  }
  const now = new Date().toISOString();
  const record = {
    id: newId(),
    name: defaultSessionName(new Date()),
    createdAt: now,
    updatedAt: now,
    payload: emptyPayload(),
  };
  await run(SESSIONS, "readwrite", (store) => store.put(record));
  await writeMeta({ currentId: record.id });
  return record;
}

export async function listSessions() {
  const rows = await allSessions();
  return rows
    .map(sessionSummary)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function currentSessionInfo() {
  const record = await ensureCurrentSession();
  return sessionSummary(record);
}

export async function saveSession(payload) {
  const record = await ensureCurrentSession();
  record.payload = payload;
  record.updatedAt = new Date().toISOString();
  await run(SESSIONS, "readwrite", (store) => store.put(record));
  return record.updatedAt;
}

export async function loadSession() {
  const record = await ensureCurrentSession();
  const payload = record.payload;
  return payload && (payload.files?.length || payload.folders?.length) ? payload : null;
}

// Clear session empties the named session, it does not delete the name: the operator
// asked to drop the measurements, not to lose where they were working.
export async function deleteSession() {
  const record = await ensureCurrentSession();
  record.payload = emptyPayload();
  record.updatedAt = new Date().toISOString();
  await run(SESSIONS, "readwrite", (store) => store.put(record));
}

export async function createSession(name, payload = null) {
  const now = new Date().toISOString();
  const record = {
    id: newId(),
    name: name || defaultSessionName(new Date()),
    createdAt: now,
    updatedAt: now,
    payload: payload || emptyPayload(),
  };
  await run(SESSIONS, "readwrite", (store) => store.put(record));
  await writeMeta({ currentId: record.id });
  return sessionSummary(record);
}

export async function openSessionById(id) {
  const record = await run(SESSIONS, "readonly", (store) => store.get(id));
  if (!record) return null;
  await writeMeta({ currentId: id });
  return record;
}

export async function renameSession(id, name) {
  const clean = String(name || "").trim();
  if (!clean) return false;
  const record = await run(SESSIONS, "readonly", (store) => store.get(id));
  if (!record) return false;
  record.name = clean;
  record.updatedAt = new Date().toISOString();
  await run(SESSIONS, "readwrite", (store) => store.put(record));
  return true;
}

export async function removeSession(id) {
  await run(SESSIONS, "readwrite", (store) => store.delete(id));
  const meta = await readMeta();
  if (meta.currentId === id) await writeMeta({ currentId: null });
}

// ---------------------------------------------------------------- session file

function bytesToBase64(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < view.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, view.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToBytes(text) {
  const binary = atob(String(text || ""));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// The file carries the measurements, the results and the folders, and nothing that
// belongs to the server: no password, no cookie, no host.
export function buildSessionFile({ name, payload, appVersion, algoVersion, algoSha, paramsOverride }) {
  return {
    format: SESSION_FILE_FORMAT,
    name: name || defaultSessionName(new Date()),
    savedAt: new Date().toISOString(),
    app: appVersion,
    algo: { version: algoVersion || "", sha256: algoSha || "" },
    paramsOverride: paramsOverride || null,
    operator: payload.operator || "",
    filter: payload.filter || "all",
    folders: payload.folders || [],
    skipped: payload.skipped || null,
    duplicateSkipped: payload.duplicateSkipped || 0,
    files: (payload.files || []).map((file) => {
      const { bytes, ...rest } = file;
      return { ...rest, bytesBase64: bytesToBase64(bytes) };
    }),
  };
}

export function downloadSessionFile(data, name) {
  const text = JSON.stringify(data);
  const blob = new Blob([text], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${String(name || "sesja").replace(/[^\p{L}\p{N} ._-]/gu, "_")}.ities.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  return blob.size;
}

// Every file is checked against the SHA-256 written next to it. One mismatch and the
// whole file is refused, with the names, because a silently repaired measurement is
// worse than no measurement at all.
export async function readSessionFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    return { ok: false, reason: "format", bad: [] };
  }
  if (!data || data.format !== SESSION_FILE_FORMAT) {
    return { ok: false, reason: "format", bad: [], found: data?.format || "" };
  }
  const files = [];
  const bad = [];
  for (const entry of data.files || []) {
    const { bytesBase64, ...rest } = entry;
    let bytes;
    try {
      bytes = base64ToBytes(bytesBase64);
    } catch (_) {
      bad.push(rest.name || "?");
      continue;
    }
    const hex = await sha256Hex(bytes);
    if (rest.sha256 && hex !== rest.sha256) {
      bad.push(rest.name || "?");
      continue;
    }
    files.push({ ...rest, sha256: hex, bytes });
  }
  if (bad.length) return { ok: false, reason: "sha", bad };
  return {
    ok: true,
    name: data.name || defaultSessionName(new Date()),
    paramsOverride: data.paramsOverride || null,
    payload: {
      files,
      folders: data.folders || [],
      skipped: data.skipped || null,
      duplicateSkipped: data.duplicateSkipped || 0,
      operator: data.operator || "",
      filter: data.filter || "all",
    },
  };
}

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toMv(value) {
  return value == null || value === "" ? "" : Number(value) * 1000;
}

// CSV keeps the notebook's technical column names in both languages; it is a data
// file for a script, not a page for a reader.
export function exportCsv(files, { operator, algoVersion, algoSha, defaultConstants }) {
  const extras = [
    "file_sha256",
    "algo_version",
    "algo_sha256",
    "analysed_at",
    "mode",
    "operator",
    "folder",
    "params_override",
    "detection_tolerance_mV",
    "uncertain_tolerance_mV",
    "target_delta_V",
  ];
  const rows = files.filter((f) => f.auto || f.expert);
  if (!rows.length) return null;
  const first = (rows[0].expert || rows[0].auto).result_row || {};
  const keys = Object.keys(first);
  const header = keys.concat(extras);
  const lines = [header.join(",")];
  for (const file of rows) {
    const result = file.expert || file.auto;
    const row = result.result_row || { file_name: file.name, status: result.status };
    const cells = keys.map((k) => csvEscape(row[k]));
    const params = file.paramsOverride || null;
    const defaults = defaultConstants || {};
    cells.push(
      csvEscape(file.sha256),
      csvEscape(file.algoVersion || algoVersion),
      csvEscape(file.algoSha || algoSha),
      csvEscape(file.analysedAt),
      csvEscape(result.mode),
      csvEscape(operator || ""),
      csvEscape(file.folder || ""),
      csvEscape(params ? JSON.stringify(params) : ""),
      csvEscape(toMv(params?.DETECTION_TOLERANCE_V ?? defaults.DETECTION_TOLERANCE_V)),
      csvEscape(toMv(params?.UNCERTAIN_TOLERANCE_V ?? defaults.UNCERTAIN_TOLERANCE_V)),
      csvEscape(params?.AMPHETAMINE_TARGET_DELTA_V ?? defaults.AMPHETAMINE_TARGET_DELTA_V ?? "")
    );
    lines.push(cells.join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ities_sesja.csv";
  a.click();
  URL.revokeObjectURL(a.href);
  return blob;
}

function paramsText(overrides) {
  if (!overrides) return "";
  const pos = overrides.WIN_TPRA_POS_RAW || [];
  const neg = overrides.WIN_TPRA_NEG_RAW || [];
  return [
    `DETECTION_TOLERANCE_V = ${overrides.DETECTION_TOLERANCE_V}`,
    `UNCERTAIN_TOLERANCE_V = ${overrides.UNCERTAIN_TOLERANCE_V}`,
    `AMPHETAMINE_TARGET_DELTA_V = ${overrides.AMPHETAMINE_TARGET_DELTA_V}`,
    `WIN_TPRA_POS_RAW = (${pos.join(", ")})`,
    `WIN_TPRA_NEG_RAW = (${neg.join(", ")})`,
  ].join("; ");
}

function pointHtml(result) {
  const rows = pointTable(result);
  return `<table class="print-points"><thead><tr>
    <th>${t("print.points.pt")}</th><th>${t("print.points.eRaw")}</th>
    <th>${t("print.points.eCal")}</th><th>${t("print.points.i")}</th>
  </tr></thead><tbody>${rows.map((r) => `<tr>
    <td>${r.k}</td>
    <td>${r.raw == null ? t("common.none") : r.raw.toFixed(6)}</td>
    <td>${r.cal == null ? t("common.none") : r.cal.toFixed(6)}</td>
    <td>${r.i == null ? t("common.none") : r.i.toFixed(4)}</td>
  </tr>`).join("")}</tbody></table>`;
}

function modeLine(file, shown) {
  if (shown.mode !== "manual") return t("print.modeAuto");
  return t("print.modeManual", {
    operator: shown._operator || t("print.noOperator"),
    time: shown._savedAtLabel || "",
    reason: shown._reason || t("common.none"),
  });
}

// Every page of a printed report has to name the tool, the algorithm and its hash: a
// page torn out of the stack still has to answer for itself. Chrome will not number
// pages from plain CSS, so the footer carries everything but the count.
function printFooter({ appVersion, algoVersion, algoSha }) {
  return `<div class="print-running-foot">${esc(
    t("print.footer", {
      app: appVersion || "",
      algo: algoVersion || "",
      sha: algoSha || "",
    })
  )}</div>`;
}

export function buildPrintReport({
  files,
  operator,
  constants,
  algoVersion,
  algoSha,
  appVersion,
  scopeText,
  sessionName,
}) {
  const now = new Date();
  const c = constants || {};
  const rows = files.filter((file) => file.auto || file.expert);
  const custom = rows.filter((file) => file.paramsOverride).length;
  const blocks = [];
  blocks.push(printFooter({ appVersion, algoVersion, algoSha }));
  blocks.push(`<header class="print-head">
    <h1>${t("print.title")}</h1>
    <p>${esc(t("print.meta", {
      datetime: now.toLocaleString(locale()),
      operator: operator || t("print.noOperator"),
    }))}</p>
    ${sessionName ? `<p>${esc(t("print.session", { name: sessionName }))}</p>` : ""}
    <p>${esc(t("print.algo", { version: algoVersion, sha: algoSha }))}</p>
    ${scopeText ? `<p>${esc(t("print.scopeLine", { scope: scopeText }))}</p>` : ""}
    <p>${t("print.thresholds")} TPRA_TARGET_V = ${c.TPRA_TARGET_V},
       AMPHETAMINE_TARGET_DELTA_V = ${c.AMPHETAMINE_TARGET_DELTA_V},
       DETECTION_TOLERANCE_V = ${c.DETECTION_TOLERANCE_V},
       UNCERTAIN_TOLERANCE_V = ${c.UNCERTAIN_TOLERANCE_V},
       PEAK_PROMINENCE_A = ${c.PEAK_PROMINENCE_A}</p>
    ${custom ? `<p class="print-validation-warning">${esc(
      t("print.mixed", { n: custom, total: rows.length })
    )}</p>` : ""}
    <p>${esc(t("export.backgroundHint"))}</p>
  </header>`);
  const groups = new Map();
  for (const file of rows) {
    const key = file.folder || "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(file);
  }
  for (const [folder, groupFiles] of groups) {
    blocks.push(`<section class="print-folder-head">
      <h2>${esc(folder || t("folder.printOutside"))}</h2>
      <p>${esc(folderStatsText(groupFiles))}</p>
    </section>`);
    for (const file of groupFiles) {
    const auto = file.auto;
    const expert = file.expert;
    const shown = expert || auto;
    const info = verdictInfo(shown.status);
    const png = shown.curve ? renderOffscreenPng(shown) : null;
    const warn = (shown.warnings || []).map((w) => `<li>${esc(w.message)}</li>`).join("");
    let body = `<section class="print-file">
      <h2>${esc(file.name)}</h2>
      <p>${esc(t("print.fileSha", { sha: file.sha256 || t("common.none") }))}</p>
      <p>${esc(t("print.algo", { version: file.algoVersion || algoVersion, sha: file.algoSha || algoSha }))}</p>
      <p>${esc(modeLine(file, shown))}</p>
      <p class="print-verdict">${esc(info.word)}</p>
      ${belowThresholdSentence(shown, constants)
        ? `<p class="print-below-threshold">${esc(belowThresholdSentence(shown, constants))}</p>`
        : ""}
      <p>${esc(justification(shown, constants))}</p>
      <p>${esc(nextSentence(shown))}</p>
      ${file.paramsOverride ? `<p><strong>${esc(t("params.custom"))}:</strong> ${esc(paramsText(file.paramsOverride))}</p>
      <p class="print-validation-warning">${esc(t("params.outsideValidation"))}</p>` : ""}
      ${png ? `<img src="${png}" alt="${esc(t("print.chartAlt", { name: file.name }))}">` : ""}
      ${pointHtml(shown)}
      ${warn ? `<ul>${warn}</ul>` : ""}`;
    if (expert && auto) {
      body += `<div class="print-split">
        <div><h3>${t("print.auto")}</h3><p>${esc(verdictInfo(auto.status).word)}</p>${pointHtml(auto)}</div>
        <div><h3>${t("print.expert")}</h3><p>${esc(verdictInfo(expert.status).word)}</p>${pointHtml(expert)}</div>
      </div>`;
    }
    body += "</section>";
      blocks.push(body);
    }
  }
  blocks.push(`<footer class="print-foot">
    <p>${t("print.disclaimer")}</p>
  </footer>`);
  return blocks.join("\n");
}

export function printReport(html) {
  const root = document.getElementById("print-root");
  root.innerHTML = html;
  root.hidden = false;
  document.body.classList.add("printing");
  const done = () => {
    document.body.classList.remove("printing");
    root.hidden = true;
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}

export function downloadDiscrepancy({ file, auto, expert, reason, version, sha256, operator }) {
  const bytes = file.bytes;
  let b64 = "";
  if (bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < u8.length; i += chunk) {
      bin += String.fromCharCode(...u8.subarray(i, i + chunk));
    }
    b64 = btoa(bin);
  }
  const payload = {
    file_name: file.name,
    file_base64: b64,
    sha256: file.sha256,
    auto,
    expert_points: expert && {
      E1: expert.E1_raw ?? expert.E1,
      E2: expert.E2_raw ?? expert.E2,
      E3: expert.E3_raw ?? expert.E3,
      E4: expert.E4_raw ?? expert.E4,
    },
    expert_result: expert,
    reason,
    algo_version: version,
    algo_sha256: sha256,
    operator: operator || "",
    at: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file.name + ".discrepancy.json";
  a.click();
  URL.revokeObjectURL(a.href);
}
