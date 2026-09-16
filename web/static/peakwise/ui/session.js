import { t, locale } from "./i18n.js";
import {
  baselineLabel,
  baselineWindowLabel,
  cycleLabel,
  fmtNum,
  fmtUnit,
  methodLabel,
  statusNext,
  statusWord,
  warningText,
} from "./format.js";
import { renderOffscreenPng } from "./chart.js";

const DB_NAME = "peakwise";
const STORE = "session";
const KEY = "current";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
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
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Columns are the notebook's own export (cv_wyniki_zbiorcze.csv), taken from the result the
// module returns, plus provenance the notebook has no place for.
const EXTRA = ["elektroda", "file_sha256", "algo_version", "algo_sha256", "analysed_at", "operator"];

export function exportCsv(files, { operator, algoVersion, algoSha }) {
  const rows = files.filter((f) => f.result && f.result.result_row);
  if (!rows.length) return null;
  const keys = Object.keys(rows[0].result.result_row);
  const lines = [keys.concat(EXTRA).join(",")];
  for (const file of rows) {
    const row = file.result.result_row;
    const cells = keys.map((k) => csvEscape(row[k]));
    cells.push(
      csvEscape(file.electrode),
      csvEscape(file.sha256),
      csvEscape(file.algoVersion || algoVersion),
      csvEscape(file.algoSha || algoSha),
      csvEscape(file.analysedAt),
      csvEscape(operator || "")
    );
    lines.push(cells.join(","));
  }
  const blob = new Blob([lines.join("\n") + "\n"], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "peakwise_session.csv";
  a.click();
  URL.revokeObjectURL(a.href);
  return blob;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]
  );
}

function branchRows(result) {
  const out = [];
  for (const [branch, key] of [
    [result.anodic, "read.anodic"],
    [result.cathodic, "read.cathodic"],
  ]) {
    if (!branch) continue;
    out.push(`<tr>
      <th>${escapeHtml(t(key))}</th>
      <td>${escapeHtml(fmtUnit(branch.Ep_V, 4, "V"))}</td>
      <td>${escapeHtml(fmtUnit(branch.Ip_uA, 3, "µA"))}</td>
      <td>${escapeHtml(methodLabel(branch.method_code))}</td>
      <td>${escapeHtml(fmtUnit(branch.Ip_max_nA, 1, "nA"))}</td>
      <td>${escapeHtml(fmtUnit(branch.Ip_curve_at_x_nA, 1, "nA"))}</td>
      <td>${escapeHtml(fmtUnit(branch.Ip_tangents_nA, 1, "nA"))}</td>
      <td>${escapeHtml(baselineLabel(branch.baseline_rule_code))}, ${escapeHtml(baselineWindowLabel(branch.baseline_window))}</td>
    </tr>`);
  }
  return out.join("");
}

export function buildPrintReport({ files, operator, config, algoVersion, algoSha }) {
  const now = new Date();
  const blocks = [];
  const cfg = Object.entries(config || {})
    .filter(([k]) => k !== "CSV_COLUMNS")
    .map(([k, v]) => `${k} = ${Array.isArray(v) ? v.join(", ") : v}`)
    .join("; ");
  blocks.push(`<header class="print-head">
    <h1>${escapeHtml(t("report.title"))}</h1>
    <p>${escapeHtml(now.toLocaleString(locale()))} &middot; ${escapeHtml(t("report.operator"))}: ${escapeHtml(operator || t("report.notGiven"))}</p>
    <p>${escapeHtml(t("details.algo"))} v${escapeHtml(algoVersion)} &middot; SHA-256 ${escapeHtml(algoSha)}</p>
    <p class="print-config">${escapeHtml(t("report.thresholds"))}: ${escapeHtml(cfg)}</p>
  </header>`);

  for (const file of files) {
    const result = file.result;
    if (!result) continue;
    const png = result.curve ? renderOffscreenPng(result) : null;
    const warnings = (result.warnings || []).map((w) => `<li>${escapeHtml(warningText(w))}</li>`).join("");
    blocks.push(`<section class="print-file">
      <h2>${escapeHtml(file.electrode)} &middot; ${escapeHtml(file.name)}</h2>
      <p class="print-verdict">${escapeHtml(statusWord(result.status))}</p>
      <p>${escapeHtml(statusNext(result.status))}</p>
      <p class="print-meta">${escapeHtml(t("details.fileSha"))}: ${escapeHtml(file.sha256 || "")}<br>
         ${escapeHtml(t("metric.dEp"))}: ${escapeHtml(fmtUnit(result.dEp_mV, 1, "mV"))} &middot;
         ${escapeHtml(t("metric.ratio"))}: ${escapeHtml(fmtNum(result.Ip_ratio, 3))} &middot;
         ${escapeHtml(t("read.cycle"))}: ${escapeHtml(cycleLabel(result.cycle_used))}</p>
      ${png ? `<img src="${png}" alt="${escapeHtml(t("chart.title"))} ${escapeHtml(file.name)}">` : ""}
      <table class="print-points">
        <thead><tr>
          <th></th><th>Ep</th><th>Ip</th><th>${escapeHtml(t("read.method"))}</th>
          <th>${escapeHtml(t("details.maximum"))}</th>
          <th>${escapeHtml(t("details.curveAtX"))}</th>
          <th>${escapeHtml(t("details.tangents"))}</th>
          <th>${escapeHtml(t("read.baseline"))}</th>
        </tr></thead>
        <tbody>${branchRows(result)}</tbody>
      </table>
      ${warnings ? `<ul class="print-warn">${warnings}</ul>` : ""}
    </section>`);
  }
  blocks.push(`<footer class="print-foot"><p>${escapeHtml(t("report.validation"))}</p></footer>`);
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
