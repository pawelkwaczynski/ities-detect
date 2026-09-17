// The PeakWise sidebar, built to the ITIES Detect 1.4 pattern: a 64 px header with the
// mark and the application switcher, a FILTERS source list with counts, a FILES tree of
// electrodes, and the drop zone pinned at the bottom (brief 1.4 addendum 5, points HH
// and II). The words in the filter list are PeakWise's own statuses.
import { t } from "./i18n.js";
import { appNav } from "/shared/appswitch.js";
import { wireLogoPreview } from "./logopreview.js";
import {
  bucketCounts,
  displayResult,
  electrodeAggregate,
  electrodeSummary,
  matchesFilter,
  statusTone,
  statusWord,
} from "./format.js";

// One row per bucket, the count on the right, nothing ever clipped. `tone` is the
// shared colour name, `key` the PeakWise word for the row.
const FILTERS = [
  ["all", null, null],
  ["pair", "bucket.pair", "detected"],
  ["partial", "bucket.partial", "uncertain"],
  ["none", "bucket.none", "not_detected"],
  ["unreadable", "bucket.unreadable", "quality"],
];

const LIST_ICON =
  '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">' +
  '<path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" ' +
  'd="M2.5 4h11M2.5 8h11M2.5 12h11"/></svg>';

const DROP_ICON =
  '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">' +
  '<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" ' +
  'd="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/></svg>';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

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

function head() {
  const node = el("div", "sidebar-head");
  // The mark is a button: a click opens the icon large. PeakWise ships 256 and 512 px
  // files, which covers the 48 px slot at device pixel ratio 2.
  const mark = el("button", "app-mark");
  mark.type = "button";
  mark.setAttribute("aria-label", t("tip.logoZoom"));
  const img = document.createElement("img");
  img.src = "/assets/peakwise_icon_256.png";
  img.srcset = "/assets/peakwise_icon_256.png 256w, /assets/peakwise_icon_512.png 512w";
  img.sizes = "48px";
  img.width = 48;
  img.height = 48;
  img.alt = "";
  mark.appendChild(img);
  wireLogoPreview(mark);
  const titles = el("div", "sidebar-titles");
  // One line, never two: the tagline is clipped and says the whole sentence in its
  // tooltip.
  const tagline = el("span", "muted sidebar-tagline", t("app.tagline"));
  // The shared dictionary has no PeakWise tagline, so the text goes in directly.
  tagline.dataset.tooltipText = t("app.tagline");
  titles.append(appNav("peakwise"), tagline);
  node.append(mark, titles);
  return node;
}

function filterList(ctx) {
  const counts = bucketCounts(ctx.files);
  const totals = { all: ctx.files.length, ...counts };
  const list = el("div", "filter-list");
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", t("sidebar.filters"));
  const rows = [];
  FILTERS.forEach(([id, key, tone], index) => {
    const active = ctx.filter === id || (id === "all" && !ctx.filter);
    const row = el("div", "filter-row" + (active ? " is-selected" : ""));
    row.dataset.filter = id;
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", String(active));
    row.tabIndex = active ? 0 : -1;
    if (tone) {
      row.appendChild(el("span", "filter-dot tone-" + tone));
    } else {
      const icon = el("span", "filter-icon");
      icon.innerHTML = LIST_ICON;
      row.appendChild(icon);
    }
    row.appendChild(el("span", "filter-label", key ? t(key) : t("sidebar.all")));
    row.appendChild(el("span", "filter-count tabular", String(totals[id] ?? 0)));
    row.addEventListener("click", () => ctx.onFilter(id));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        ctx.onFilter(id);
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
      if (!step) return;
      event.preventDefault();
      const next = rows[(index + step + rows.length) % rows.length];
      next.focus();
      next.click();
    });
    rows.push(row);
    list.appendChild(row);
  });
  return list;
}

// Renaming an electrode happens in place, in a field that replaces the name. The 1.0
// build used window.prompt, which blocks the page and cannot be styled or tested.
function renameField(group, onRename, restore) {
  const input = document.createElement("input");
  input.className = "tree-rename-input";
  input.value = group.id;
  input.setAttribute("aria-label", t("sidebar.renamePrompt"));
  let closed = false;
  const finish = (save) => {
    if (closed) return;
    closed = true;
    const next = input.value.trim();
    if (save && next && next !== group.id) onRename(group.id, next);
    else restore();
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") finish(true);
    if (event.key === "Escape") finish(false);
  });
  input.addEventListener("blur", () => finish(true), { once: true });
  queueMicrotask(() => {
    input.focus();
    input.select();
  });
  return input;
}

function electrodeNode(group, ctx) {
  const wrap = el("section", "electrode-group");
  const groupHead = el("div", "electrode-head");
  const name = el("button", "electrode-name", group.id);
  name.type = "button";
  name.dataset.tooltipText = t("sidebar.renameTitle");
  name.addEventListener("click", () => {
    const field = renameField(group, ctx.onRename, () => field.replaceWith(name));
    name.replaceWith(field);
  });
  groupHead.appendChild(name);
  const agg = electrodeAggregate(group.files);
  if (agg) {
    const chip = el("span", "chip " + statusTone(agg), electrodeSummary(group.files));
    groupHead.appendChild(chip);
  }
  wrap.appendChild(groupHead);

  const ul = el("ul", "file-list");
  for (const file of group.files) {
    const li = el("li", "file-item" + (file.id === ctx.selectedId ? " is-selected" : ""));
    li.dataset.fileId = file.id;
    const button = el("button", "file-row" + (file.id === ctx.selectedId ? " is-selected" : ""));
    button.type = "button";
    button.dataset.id = file.id;
    button.setAttribute("aria-current", file.id === ctx.selectedId ? "true" : "false");
    const text = el("span", "file-text");
    const label = el("span", "file-name", file.name);
    label.title = file.name;
    text.appendChild(label);
    button.appendChild(text);
    const result = displayResult(file);
    if (result) {
      button.appendChild(el("span", "chip " + statusTone(result.status), statusWord(result.status)));
    }
    button.addEventListener("click", () => ctx.onSelect(file.id));
    li.appendChild(button);
    ul.appendChild(li);
  }
  wrap.appendChild(ul);
  return wrap;
}

export function renderSidebar(host, ctx) {
  const visible = ctx.files.filter((file) => matchesFilter(file, ctx.filter));
  const groups = groupByElectrode(visible);
  host.innerHTML = "";

  host.appendChild(head());
  host.appendChild(el("p", "sidebar-section", t("sidebar.filtersSection")));
  host.appendChild(filterList(ctx));
  host.appendChild(el("p", "sidebar-section", t("sidebar.filesSection")));

  const list = el("div", "electrode-list");
  if (!groups.length) {
    list.appendChild(
      el("p", "muted sidebar-empty", ctx.files.length ? t("sidebar.emptyFiltered") : t("sidebar.empty"))
    );
  }
  for (const group of groups) list.appendChild(electrodeNode(group, ctx));
  host.appendChild(list);

  const drop = el("div", "sidebar-drop");
  drop.dataset.tooltipKey = "tip.sidebarDrop";
  drop.innerHTML = DROP_ICON;
  drop.append(
    el("strong", null, t("sidebar.dropTitle")),
    el("span", "muted", t("sidebar.dropHint")),
    el("span", "muted sidebar-formats", t("sidebar.dropFormats"))
  );
  const actions = el("div", "sidebar-drop-actions");
  const importButton = el("button", "primary", t("toolbar.add"));
  importButton.type = "button";
  importButton.id = "btn-add";
  importButton.dataset.tooltipKey = "tip.import";
  importButton.addEventListener("click", ctx.onImport);
  const folderButton = el("button", null, t("toolbar.addFolder"));
  folderButton.type = "button";
  folderButton.id = "btn-add-folder";
  folderButton.dataset.tooltipKey = "tip.addFolder";
  folderButton.addEventListener("click", ctx.onImportFolder);
  actions.append(importButton, folderButton);
  drop.appendChild(actions);
  host.appendChild(drop);
}

export function siblingFileId(files, selectedId, dir, filter) {
  const visible = files.filter((file) => matchesFilter(file, filter));
  const index = visible.findIndex((file) => file.id === selectedId);
  if (index < 0) return visible[0]?.id;
  const next = visible[index + dir];
  return next ? next.id : visible[index]?.id;
}
