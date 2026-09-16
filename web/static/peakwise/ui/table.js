import { t } from "./i18n.js";
import {
  displayResult,
  fmtNum,
  matchesFilter,
  methodLabel,
  statusTone,
  statusWord,
  warningText,
} from "./format.js";

const COLUMNS = [
  { key: "electrode", label: "table.electrode", get: (f) => f.electrode, type: "text" },
  { key: "name", label: "table.file", get: (f) => f.name, type: "text" },
  { key: "status", label: "table.status", get: (f) => displayResult(f)?.status || "", type: "status" },
  { key: "Ip_a", label: "table.Ip_a", get: (f) => displayResult(f)?.Ip_a_uA, type: "num", digits: 3 },
  { key: "Ip_c", label: "table.Ip_c", get: (f) => displayResult(f)?.Ip_c_uA, type: "num", digits: 3 },
  { key: "Ep_a", label: "table.Ep_a", get: (f) => displayResult(f)?.Ep_a_V, type: "num", digits: 4 },
  { key: "Ep_c", label: "table.Ep_c", get: (f) => displayResult(f)?.Ep_c_V, type: "num", digits: 4 },
  { key: "dEp", label: "table.dEp", get: (f) => displayResult(f)?.dEp_mV, type: "num", digits: 1 },
  {
    key: "methodA",
    label: "table.methodA",
    get: (f) => displayResult(f)?.anodic?.method_code || "",
    type: "method",
  },
  {
    key: "methodC",
    label: "table.methodC",
    get: (f) => displayResult(f)?.cathodic?.method_code || "",
    type: "method",
  },
  { key: "version", label: "table.version", get: (f) => f.algoVersion || "", type: "text" },
];

function cellText(col, file) {
  const value = col.get(file);
  if (col.type === "num") return value == null ? "" : fmtNum(value, col.digits);
  if (col.type === "status") return value ? statusWord(value) : "";
  if (col.type === "method") return value ? methodLabel(value) : "";
  return value == null ? "" : String(value);
}

function sortValue(col, file) {
  const value = col.get(file);
  if (col.type === "num") return value == null ? Number.NEGATIVE_INFINITY : Number(value);
  return String(value ?? "").toLowerCase();
}

export function renderTable(host, { files, filter, sortKey, sortDir, onSort, onSelect }) {
  host.innerHTML = "";
  const rows = files.filter((f) => matchesFilter(f, filter));
  const heading = document.createElement("h2");
  heading.className = "table-title";
  heading.textContent = t("table.title");
  const rule = document.createElement("p");
  rule.className = "muted agg-rule";
  rule.textContent = t("table.rule");
  host.append(heading, rule);

  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = t("table.empty");
    host.appendChild(empty);
    return;
  }

  const col = COLUMNS.find((c) => c.key === sortKey) || COLUMNS[0];
  const sorted = [...rows].sort((a, b) => {
    const va = sortValue(col, a);
    const vb = sortValue(col, b);
    if (va < vb) return -1 * sortDir;
    if (va > vb) return 1 * sortDir;
    return 0;
  });

  const table = document.createElement("table");
  table.className = "session-table tabular";
  const thead = document.createElement("thead");
  const tr = document.createElement("tr");
  for (const c of COLUMNS) {
    const th = document.createElement("th");
    th.scope = "col";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "th-sort";
    btn.textContent = t(c.label) + (sortKey === c.key ? (sortDir > 0 ? " ↑" : " ↓") : "");
    btn.addEventListener("click", () => onSort(c.key));
    th.appendChild(btn);
    if (sortKey === c.key) th.setAttribute("aria-sort", sortDir > 0 ? "ascending" : "descending");
    tr.appendChild(th);
  }
  const thNotes = document.createElement("th");
  thNotes.scope = "col";
  thNotes.textContent = t("table.notes");
  tr.appendChild(thNotes);
  thead.appendChild(tr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const file of sorted) {
    const row = document.createElement("tr");
    row.tabIndex = 0;
    row.addEventListener("click", () => onSelect(file.id));
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(file.id);
      }
    });
    for (const c of COLUMNS) {
      const td = document.createElement("td");
      if (c.type === "status") {
        const status = c.get(file);
        if (status) {
          const chip = document.createElement("span");
          chip.className = "chip " + statusTone(status);
          chip.textContent = statusWord(status);
          td.appendChild(chip);
        }
      } else {
        td.textContent = cellText(c, file);
      }
      row.appendChild(td);
    }
    const notes = document.createElement("td");
    const list = displayResult(file)?.warnings || [];
    if (list.length) {
      notes.textContent = String(list.length);
      notes.title = list.map(warningText).join("\n");
      notes.className = "warn-dot";
    }
    row.appendChild(notes);
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  host.appendChild(table);
}
