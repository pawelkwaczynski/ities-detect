import { locale, t } from "/shared/i18n.js";
import {
  aggregationRule,
  displayResult,
  fmtNum,
  isUnsuitable,
  matchesFilter,
  verdictInfo,
} from "./format.js";

const COLS = [
  { key: "sampleId", labelKey: "table.sample" },
  { key: "name", labelKey: "table.file" },
  { key: "quality", labelKey: "table.quality" },
  { key: "verdict", labelKey: "table.verdict" },
  { key: "delta", labelKey: "table.delta" },
  { key: "err", labelKey: "table.err" },
  { key: "ip", labelKey: "table.ip" },
  { key: "version", labelKey: "table.version" },
  { key: "mode", labelKey: "table.mode" },
  { key: "warn", labelKey: "table.warn" },
];

function rowModel(file) {
  const r = displayResult(file);
  const info = r ? verdictInfo(r.status) : null;
  const quality = !r
    ? t("state." + (file.state === "running" ? "running" : file.state === "error" ? "error" : "queued"))
    : isUnsuitable(r.status)
      ? info.word
      : t("table.qualityOk");
  return {
    file,
    sampleId: file.sampleId,
    name: file.name,
    quality,
    verdict: info ? info.word : "",
    tone: info ? info.tone : "quality",
    delta: r?.delta_Es,
    err: r?.error_mV,
    ip: r?.Ip_analyte_fwd_uA,
    version: file.algoVersion || "",
    mode: r?.mode === "manual" ? t("mode.manual") : r ? t("mode.auto") : "",
    warnings: r?.warnings || [],
    status: r?.status,
  };
}

function cmp(a, b, key) {
  const va = a[key];
  const vb = b[key];
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  if (typeof va === "number" && typeof vb === "number") return va - vb;
  return String(va).localeCompare(String(vb), locale());
}

export function renderTable(host, { files, filter, sortKey, sortDir, onSelect, onSort }) {
  host.innerHTML = "";
  const rule = document.createElement("p");
  rule.className = "agg-rule muted";
  rule.textContent = aggregationRule();
  host.appendChild(rule);

  const rows = files.filter((f) => matchesFilter(f, filter)).map(rowModel);
  rows.sort((a, b) => cmp(a, b, sortKey) * sortDir);

  const table = document.createElement("table");
  table.className = "session-table tabular";
  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  for (const col of COLS) {
    const th = document.createElement("th");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "th-sort";
    b.textContent = t(col.labelKey) + (sortKey === col.key ? (sortDir > 0 ? " ↑" : " ↓") : "");
    b.addEventListener("click", () => onSort(col.key));
    th.appendChild(b);
    trh.appendChild(th);
  }
  thead.appendChild(trh);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.tabIndex = 0;
    tr.addEventListener("click", () => onSelect(row.file.id));
    tr.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") onSelect(row.file.id);
    });
    const cells = [
      row.sampleId,
      row.name,
      row.quality,
      null,
      fmtNum(row.delta, 4),
      fmtNum(row.err, 1),
      fmtNum(row.ip, 3),
      row.version,
      row.mode,
      null,
    ];
    cells.forEach((val, idx) => {
      const td = document.createElement("td");
      if (idx === 3) {
        if (row.verdict) {
          const chip = document.createElement("span");
          chip.className = "chip " + row.tone;
          chip.textContent = row.verdict;
          td.appendChild(chip);
        }
      } else if (idx === 9) {
        if (row.warnings.length) {
          const tip = row.warnings.map((w) => w.message).join(" ");
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "warn-dot";
          btn.title = tip;
          btn.setAttribute("aria-label", tip);
          btn.textContent = String(row.warnings.length);
          td.appendChild(btn);
        }
      } else {
        td.textContent = val;
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  host.appendChild(table);
}
