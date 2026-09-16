import { locale, t } from "/shared/i18n.js";
import { justification, nextSentence, verdictInfo } from "./format.js";
import { pointTable } from "./details.js";
import { renderOffscreenPng } from "./chart.js";

const DB_NAME = "ities-detect";
const STORE = "session";
const KEY = "current";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSession(payload) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(payload, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadSession() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
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

// CSV keeps the notebook's technical column names in both languages; it is a data
// file for a script, not a page for a reader.
export function exportCsv(files, { operator, algoVersion, algoSha }) {
  const extras = ["file_sha256", "algo_version", "algo_sha256", "analysed_at", "mode", "operator"];
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
    cells.push(
      csvEscape(file.sha256),
      csvEscape(file.algoVersion || algoVersion),
      csvEscape(file.algoSha || algoSha),
      csvEscape(file.analysedAt),
      csvEscape(result.mode),
      csvEscape(operator || "")
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

export function buildPrintReport({ files, operator, constants, algoVersion, algoSha }) {
  const now = new Date();
  const c = constants || {};
  const blocks = [];
  blocks.push(`<header class="print-head">
    <h1>${t("print.title")}</h1>
    <p>${esc(t("print.meta", {
      datetime: now.toLocaleString(locale()),
      operator: operator || t("print.noOperator"),
    }))}</p>
    <p>${esc(t("print.algo", { version: algoVersion, sha: algoSha }))}</p>
    <p>${t("print.thresholds")} TPRA_TARGET_V = ${c.TPRA_TARGET_V},
       AMPHETAMINE_TARGET_DELTA_V = ${c.AMPHETAMINE_TARGET_DELTA_V},
       DETECTION_TOLERANCE_V = ${c.DETECTION_TOLERANCE_V},
       UNCERTAIN_TOLERANCE_V = ${c.UNCERTAIN_TOLERANCE_V},
       PEAK_PROMINENCE_A = ${c.PEAK_PROMINENCE_A}</p>
  </header>`);
  for (const file of files) {
    const auto = file.auto;
    const expert = file.expert;
    const shown = expert || auto;
    if (!shown) continue;
    const info = verdictInfo(shown.status);
    const png = shown.curve ? renderOffscreenPng(shown) : null;
    const warn = (shown.warnings || []).map((w) => `<li>${esc(w.message)}</li>`).join("");
    let body = `<section class="print-file">
      <h2>${esc(file.name)}</h2>
      <p>${esc(t("print.fileSha", { sha: file.sha256 || t("common.none") }))}</p>
      <p class="print-verdict">${esc(info.word)}</p>
      <p>${esc(justification(shown, constants))}</p>
      <p>${esc(nextSentence(shown))}</p>
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
