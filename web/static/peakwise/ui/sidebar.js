import { t } from "./i18n.js";
import {
  displayResult,
  electrodeAggregate,
  electrodeSummary,
  matchesFilter,
  statusTone,
  statusWord,
} from "./format.js";

export function groupByElectrode(files) {
  const groups = [];
  const index = new Map();
  for (const file of files) {
    if (!index.has(file.electrode)) {
      const group = { id: file.electrode, files: [] };
      index.set(file.electrode, group);
      groups.push(group);
    }
    index.get(file.electrode).files.push(file);
  }
  return groups;
}

export function renderSidebar(el, { files, selectedId, filter, onSelect, onFilter, onRename }) {
  const visible = files.filter((f) => matchesFilter(f, filter));
  const groups = groupByElectrode(visible);
  el.innerHTML = "";

  const filters = document.createElement("div");
  filters.className = "seg sidebar-filters";
  filters.setAttribute("role", "group");
  filters.setAttribute("aria-label", t("sidebar.all"));
  for (const [id, key] of [
    ["all", "sidebar.all"],
    ["pair", "sidebar.withPair"],
    ["incomplete", "sidebar.incomplete"],
  ]) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = t(key);
    b.setAttribute("aria-pressed", String(filter === id));
    b.addEventListener("click", () => onFilter(id));
    filters.appendChild(b);
  }
  el.appendChild(filters);

  const list = document.createElement("div");
  list.className = "electrode-list";
  if (!groups.length) {
    const empty = document.createElement("p");
    empty.className = "muted sidebar-empty";
    empty.textContent = files.length ? t("sidebar.emptyFiltered") : t("sidebar.empty");
    list.appendChild(empty);
  }
  for (const group of groups) {
    const wrap = document.createElement("section");
    wrap.className = "electrode-group";
    const head = document.createElement("div");
    head.className = "electrode-head";
    const name = document.createElement("button");
    name.type = "button";
    name.className = "electrode-name";
    name.textContent = group.id;
    name.title = t("sidebar.renameTitle");
    name.addEventListener("click", () => {
      const next = window.prompt(t("sidebar.renamePrompt"), group.id);
      if (next && next.trim() && next.trim() !== group.id) onRename(group.id, next.trim());
    });
    head.appendChild(name);
    const agg = electrodeAggregate(group.files);
    if (agg) {
      const chip = document.createElement("span");
      chip.className = "chip " + statusTone(agg);
      chip.textContent = electrodeSummary(group.files);
      head.appendChild(chip);
    }
    wrap.appendChild(head);

    const ul = document.createElement("ul");
    ul.className = "file-list";
    for (const file of group.files) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "file-row" + (file.id === selectedId ? " is-selected" : "");
      btn.dataset.id = file.id;
      btn.setAttribute("aria-current", file.id === selectedId ? "true" : "false");
      const label = document.createElement("span");
      label.className = "file-name";
      label.textContent = file.name;
      label.title = file.name;
      btn.appendChild(label);
      const result = displayResult(file);
      if (result) {
        const chip = document.createElement("span");
        chip.className = "chip " + statusTone(result.status);
        chip.textContent = statusWord(result.status);
        btn.appendChild(chip);
      }
      btn.addEventListener("click", () => onSelect(file.id));
      li.appendChild(btn);
      ul.appendChild(li);
    }
    wrap.appendChild(ul);
    list.appendChild(wrap);
  }
  el.appendChild(list);
}

export function siblingFileId(files, selectedId, dir, filter) {
  const visible = files.filter((f) => matchesFilter(f, filter));
  const idx = visible.findIndex((f) => f.id === selectedId);
  if (idx < 0) return visible[0]?.id;
  const next = visible[idx + dir];
  return next ? next.id : visible[idx]?.id;
}
