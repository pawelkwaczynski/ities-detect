import { t, locale } from "./i18n.js";
import {
  baselineText,
  cycleLabel,
  fmtNum,
  fmtUnit,
  methodLabel,
  statusNext,
  statusWord,
  warningText,
} from "./format.js";
import { renderOffscreenPng } from "./chart.js";
import { quantityMarkup } from "./symbols.js";
import { csvText } from "./csv_columns.js";

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

export function exportCsv(files, { operator } = {}) {
  const content = csvText(files, { operator });
  if (content == null) return null;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
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
      <td>${escapeHtml(baselineText(branch))}</td>
    </tr>`);
  }
  return out.join("");
}

export function buildPrintReport({ files, operator, config, algoVersion, algoSha }) {
  const now = new Date();
  const blocks = [];
  const versions = [...new Set(files.filter((file) => file.result).map((file) =>
    `v${file.algoVersion || file.result.algo_version || t("report.unknownVersion")} · SHA-256 ${file.algoSha || t("report.unknownVersion")}`
  ))];
  const cfg = Object.entries(config || {})
    .filter(([k]) => k !== "CSV_COLUMNS")
    .map(([k, v]) => `${k} = ${Array.isArray(v) ? v.join(", ") : v}`)
    .join("; ");
  blocks.push(`<header class="print-head">
    <h1>${escapeHtml(t("report.title"))}</h1>
    <p>${escapeHtml(now.toLocaleString(locale()))} &middot; ${escapeHtml(t("report.operator"))}: ${escapeHtml(operator || t("report.notGiven"))}</p>
    <p>${escapeHtml(t("report.versions"))}: ${escapeHtml(versions.join("; "))}</p>
    <p class="print-config">${escapeHtml(t("report.currentThresholds", { v: algoVersion, sha: algoSha }))}: ${escapeHtml(cfg)}</p>
  </header>`);

  for (const file of files) {
    const result = file.result;
    if (!result) continue;
    const png = result.curve ? renderOffscreenPng(result) : null;
    const warnings = (result.warnings || []).map((w) => `<li>${escapeHtml(warningText(w))}</li>`).join("");
    blocks.push(`<section class="print-file">
      <h2>${escapeHtml(file.electrode)} &middot; ${escapeHtml(file.name)}</h2>
      <p>${escapeHtml(t("details.algo"))} v${escapeHtml(file.algoVersion || result.algo_version || t("report.unknownVersion"))} &middot; SHA-256 ${escapeHtml(file.algoSha || t("report.unknownVersion"))}</p>
      <p class="print-verdict">${escapeHtml(statusWord(result.status))}</p>
      <p>${escapeHtml(statusNext(result.status))}</p>
      <p class="print-meta">${escapeHtml(t("details.fileSha"))}: ${escapeHtml(file.sha256 || "")}<br>
         ${quantityMarkup("dEp")}: ${escapeHtml(fmtUnit(result.dEp_mV, 1, "mV"))} &middot;
         ${quantityMarkup("ratio")}: ${escapeHtml(fmtNum(result.Ip_ratio, 3))} &middot;
         ${escapeHtml(t("read.cycle"))}: ${escapeHtml(cycleLabel(result.cycle_used))}</p>
      ${png ? `<img src="${png}" alt="${escapeHtml(t("chart.title"))} ${escapeHtml(file.name)}">` : ""}
      <table class="print-points">
        <thead><tr>
          <th></th><th>${quantityMarkup("Ep")}</th><th>${quantityMarkup("Ip")}</th><th>${escapeHtml(t("read.method"))}</th>
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
