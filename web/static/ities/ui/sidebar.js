import { locale, t } from "/shared/i18n.js";
import { appNav } from "/shared/appswitch.js";
import { wireLogoPreview } from "/shared/logopreview.js";
import {
  bucketCounts,
  displayResult,
  folderStatsText,
  matchesFilter,
  sampleAggregate,
  verdictInfo,
} from "./format.js";

const AUTO_OPEN_SAMPLES = 12;
const DRAG_TYPE = "application/x-ities-file-ids";

const ICONS = {
  edit:
    '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" d="m10.5 2.5 3 3-8 8-3.5.5.5-3.5z"/></svg>',
  move:
    '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" d="M1.8 4.5h4l1.2 1.4h7.2v7H1.8zM9.2 9.4h3m-1.2-1.5 1.5 1.5-1.5 1.5"/></svg>',
  remove:
    '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M3 4.5h10M6 2.5h4l.5 2H5.5l.5-2ZM4.5 4.5l.6 9h5.8l.6-9"/></svg>',
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function caret() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "tree-caret");
  svg.setAttribute("width", "10");
  svg.setAttribute("height", "10");
  svg.setAttribute("viewBox", "0 0 10 10");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "currentColor");
  path.setAttribute("d", "M3 1.5 7.5 5 3 8.5z");
  svg.appendChild(path);
  return svg;
}

function iconButton(className, icon, label) {
  const button = el("button", className);
  button.type = "button";
  button.innerHTML = icon;
  button.setAttribute("aria-label", label);
  return button;
}

function stateWord(file) {
  const result = displayResult(file);
  if (result) return { word: verdictInfo(result.status).word, tone: verdictInfo(result.status).tone };
  if (file.state === "error") return { word: t("state.error"), tone: "state-error" };
  if (file.state === "running") return { word: t("state.running"), tone: "state-running" };
  return { word: t("state.queued"), tone: "state-queued" };
}

function statusDot(file) {
  const { word, tone } = stateWord(file);
  const dot = el("span", "dot dot-" + tone);
  dot.title = word;
  dot.setAttribute("role", "img");
  dot.setAttribute("aria-label", word);
  return dot;
}

function groupBySample(files, folder = "") {
  const groups = [];
  const index = new Map();
  for (const file of files) {
    const key = file.sampleId;
    if (!index.has(key)) {
      const group = { id: key, key: `${folder}::${key}`, files: [] };
      index.set(key, group);
      groups.push(group);
    }
    index.get(key).files.push(file);
  }
  return groups;
}

function dragIds(node, ids) {
  node.draggable = true;
  node.addEventListener("dragstart", (event) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(ids));
  });
}

function moveTrigger(ids, label, ctx) {
  const button = iconButton("row-menu-trigger", ICONS.move, t("folder.move"));
  button.setAttribute("aria-haspopup", "menu");
  button.addEventListener("click", () => ctx.onMoveRequest(ids, label, button));
  return button;
}

function contextActions(node, ids, label, ctx) {
  node.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    ctx.onMoveRequest(ids, label, { x: event.clientX, y: event.clientY });
  });
  node.addEventListener("keydown", (event) => {
    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      ctx.onMoveRequest(ids, label, node);
    }
  });
}

function fileRow(file, ctx) {
  // The selected class sits on the row and on its list item: the item is what the
  // content view scrolls into sight, so it has to be findable from the outside.
  const picked = !!ctx.selectedIds?.has(file.id);
  const li = el(
    "li",
    "file-item" + (file.id === ctx.selectedId ? " is-selected" : "") + (picked ? " is-picked" : "")
  );
  li.dataset.fileId = file.id;
  const button = el(
    "button",
    "file-row" + (file.id === ctx.selectedId ? " is-selected" : "") + (picked ? " is-picked" : "")
  );
  button.type = "button";
  button.dataset.id = file.id;
  button.setAttribute("aria-current", file.id === ctx.selectedId ? "true" : "false");
  button.setAttribute("aria-selected", String(picked));
  const text = el("span", "file-text");
  const name = el("span", "file-name", file.label || file.name);
  name.title = file.label || file.name;
  text.appendChild(name);
  if (file.fileModified) {
    text.appendChild(
      el(
        "span",
        "file-when muted",
        new Date(file.fileModified).toLocaleString(locale(), {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      )
    );
  }
  button.append(statusDot(file), text);
  // Cmd or Ctrl adds and removes one file, Shift takes the range in the visible list,
  // a plain click selects one, exactly as it did before (addendum 3, point BB).
  button.addEventListener("click", (event) =>
    ctx.onSelect(file.id, {
      toggle: event.metaKey || event.ctrlKey,
      range: event.shiftKey,
    })
  );

  const actions = el("span", "file-actions");
  const move = moveTrigger([file.id], file.name, ctx);
  const remove = iconButton("file-remove", ICONS.remove, t("session.removeFile"));
  remove.addEventListener("click", () => ctx.onRemoveFiles([file.id], file.name));
  actions.append(move, remove);
  li.append(button, actions);
  dragIds(li, [file.id]);
  contextActions(button, [file.id], file.name, ctx);
  return li;
}

function skippedText(meta) {
  const counts = meta?.extCounts || {};
  const entries = Object.entries(counts).filter(([, count]) => count > 0).sort(([a], [b]) => a.localeCompare(b));
  const details = entries.length
    ? entries.map(([ext, count]) => `${count} ${ext}`).join(", ")
    : meta?.exts || "";
  return meta?.skipped ? t("toolbar.unsupported", { n: meta.skipped, details }) : "";
}

function summaryPart(tone, count, status) {
  const info = verdictInfo(status);
  const part = el("span", "verdict-summary-part tone-" + tone);
  part.dataset.tooltipKey =
    tone === "detected"
      ? "tip.verdict.detected"
      : tone === "uncertain"
        ? "tip.verdict.uncertain"
        : tone === "not_detected"
          ? "tip.verdict.notDetected"
          : "tip.verdict.unsuitable";
  part.append(
    el("span", "verdict-summary-dot"),
    el("strong", "tabular", String(count)),
    el("span", "verdict-summary-label", info.short)
  );
  return part;
}

function verdictSummary(files, meta = null) {
  const counts = bucketCounts(files);
  const row = el("div", "folder-counts verdict-summary");
  for (const [tone, count, status] of [
    ["detected", counts.detected, "detected"],
    ["uncertain", counts.uncertain, "uncertain"],
    ["not_detected", counts.not_detected, "not_detected"],
    ["quality", counts.unsuitable, "MEASUREMENT_QUALITY_FAIL"],
  ]) {
    if (!count) continue;
    if (row.children.length) row.appendChild(el("span", "summary-sep", "·"));
    row.appendChild(summaryPart(tone, count, status));
  }
  if (counts.pending) {
    if (row.children.length) row.appendChild(el("span", "summary-sep", "·"));
    row.appendChild(el("span", "summary-pending", `${counts.pending} ${t("state.queued")}`));
  }
  const skipped = skippedText(meta);
  if (skipped) {
    if (row.children.length) row.appendChild(el("span", "summary-sep", "·"));
    const text = el("span", "folder-skipped muted", skipped);
    text.dataset.tooltipKey = "tip.skipped";
    row.appendChild(text);
  }
  return row;
}

// The filters as a source list, the way Finder and Mail do it (addendum 5, point II):
// one row per group, the count on the right, nothing ever clipped. The numbers come
// from the same bucketCounts as the status bar, the state is `state.filter`.
const FILTERS = [
  ["all", null],
  ["detected", "detected"],
  ["review", "uncertain"],
  ["not_detected", "not_detected"],
  ["unsuitable", "MEASUREMENT_QUALITY_FAIL"],
];

const LIST_ICON =
  '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">' +
  '<path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" ' +
  'd="M2.5 4h11M2.5 8h11M2.5 12h11"/></svg>';

function sentenceCase(text) {
  return text ? text.charAt(0).toLocaleUpperCase(locale()) + text.slice(1) : text;
}

function sectionHeading(key) {
  const heading = el("p", "sidebar-section", t(key));
  return heading;
}

function filterList(ctx) {
  const counts = bucketCounts(ctx.files);
  const totals = {
    all: ctx.files.length,
    detected: counts.detected,
    review: counts.uncertain,
    not_detected: counts.not_detected,
    unsuitable: counts.unsuitable,
  };
  const list = el("div", "filter-list");
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", t("sidebar.filters"));
  const rows = [];
  FILTERS.forEach(([id, status], index) => {
    const row = el("div", "filter-row" + (ctx.filter === id ? " is-selected" : ""));
    row.dataset.filter = id;
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", String(ctx.filter === id));
    row.tabIndex = ctx.filter === id ? 0 : -1;
    if (status) {
      const dot = el("span", "filter-dot tone-" + verdictInfo(status).tone);
      row.appendChild(dot);
    } else {
      const icon = el("span", "filter-icon");
      icon.innerHTML = LIST_ICON;
      row.appendChild(icon);
    }
    row.appendChild(el("span", "filter-label", status ? sentenceCase(verdictInfo(status).short) : t("sidebar.all")));
    row.appendChild(el("span", "filter-count tabular", String(totals[id])));
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

function editableName({ value, aria, onSave, onClose }) {
  const input = document.createElement("input");
  input.className = "tree-rename-input";
  input.value = value;
  input.setAttribute("aria-label", aria);
  let closed = false;
  const finish = (save) => {
    if (closed) return;
    const next = input.value.trim();
    if (save && next && onSave(next) === false) {
      input.setCustomValidity(t("folder.exists"));
      input.reportValidity();
      input.focus();
      return;
    }
    closed = true;
    onClose?.();
    input.remove();
  };
  input.addEventListener("input", () => input.setCustomValidity(""));
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

function sampleNode(group, ctx, defaultOpen, allGroupFiles) {
  const base = defaultOpen || group.files.some((file) => file.id === ctx.selectedId);
  const open = ctx.closedSamples.has(group.key) ? !base : base;
  const node = el("li", "tree-sample" + (open ? " is-open" : ""));
  const head = el("div", "tree-row tree-sample-head");
  head.tabIndex = 0;
  const toggle = el("button", "tree-toggle");
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", String(open));
  toggle.append(caret(), el("span", "tree-label", group.id));
  toggle.addEventListener("click", () => ctx.onToggleSample(group.key));

  const rename = iconButton("tree-rename", ICONS.edit, t("sidebar.renameHint"));
  rename.addEventListener("click", (event) => {
    event.stopPropagation();
    toggle.hidden = true;
    rename.hidden = true;
    const input = editableName({
      value: group.id,
      aria: t("sidebar.renamePrompt"),
      onSave: (next) => {
        if (next !== group.id) ctx.onRenameSample(group.id, next, allGroupFiles.map((file) => file.id));
      },
      onClose: () => {
        toggle.hidden = false;
        rename.hidden = false;
      },
    });
    head.insertBefore(input, head.firstChild);
  });

  const ids = allGroupFiles.map((file) => file.id);
  const move = moveTrigger(ids, group.id, ctx);
  const remove = iconButton("tree-remove", ICONS.remove, t("session.removeSample"));
  remove.addEventListener("click", () => ctx.onRemoveFiles(ids, group.id));
  // The badge counts the whole sample; under a filter it reads "shown of all", so the
  // badge and the verdict row underneath never disagree.
  const shown = group.files.length;
  const total = allGroupFiles.length;
  const count = el(
    "span",
    "tree-count tabular",
    shown === total ? String(total) : t("sidebar.shownOf", { shown, total })
  );
  const aggregate = sampleAggregate(group.files);
  if (aggregate) count.title = verdictInfo(aggregate).word;
  head.append(toggle, rename, move, remove, count);
  node.append(head, verdictSummary(allGroupFiles));
  dragIds(head, ids);
  contextActions(head, ids, group.id, ctx);

  if (open) {
    const ul = el("ul", "file-list");
    for (const file of group.files) ul.appendChild(fileRow(file, ctx));
    node.appendChild(ul);
  }
  return node;
}

function sampleOrFile(group, ctx, defaultOpen, allGroupFiles = group.files) {
  if (group.files.length === 1 && allGroupFiles.length === 1) return fileRow(group.files[0], ctx);
  return sampleNode(group, ctx, defaultOpen, allGroupFiles);
}

function folderNode(name, meta, allFiles, visibleFiles, ctx) {
  const node = el("li", "tree-folder" + (meta.open ? " is-open" : ""));
  node.dataset.folder = name;
  const head = el("div", "tree-row tree-folder-head");
  const toggle = el("button", "tree-toggle");
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", String(!!meta.open));
  toggle.append(caret(), el("span", "tree-label", name));
  toggle.addEventListener("click", () => ctx.onToggleFolder(name));

  const rename = iconButton("tree-rename", ICONS.edit, t("folder.rename"));
  rename.addEventListener("click", () => {
    toggle.hidden = true;
    rename.hidden = true;
    const input = editableName({
      value: name,
      aria: t("folder.name"),
      onSave: (next) => (next === name ? true : ctx.onRenameFolder(name, next)),
      onClose: () => {
        toggle.hidden = false;
        rename.hidden = false;
      },
    });
    head.insertBefore(input, head.firstChild);
  });
  const remove = iconButton("tree-remove", ICONS.remove, t("folder.delete"));
  remove.addEventListener("click", () => ctx.onDeleteFolder(name));
  head.append(toggle, rename, remove, el("span", "tree-count tabular", String(allFiles.length)));
  head.addEventListener("dragover", (event) => {
    if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    head.classList.add("is-drop-target");
  });
  head.addEventListener("dragleave", () => head.classList.remove("is-drop-target"));
  head.addEventListener("drop", (event) => {
    event.preventDefault();
    head.classList.remove("is-drop-target");
    try {
      const ids = JSON.parse(event.dataTransfer.getData(DRAG_TYPE));
      if (Array.isArray(ids)) ctx.onMoveFiles(ids, name);
    } catch (_) {
      /* External drops belong to the page import target, not to folder moves. */
    }
  });
  node.append(
    head,
    el("div", "folder-stats", folderStatsText(allFiles)),
    verdictSummary(allFiles, meta)
  );
  if (meta.open) {
    const ul = el("ul", "tree-children");
    const groups = groupBySample(visibleFiles, name);
    const defaultOpen = groups.length <= AUTO_OPEN_SAMPLES;
    for (const group of groups) {
      const allGroupFiles = allFiles.filter((file) => file.sampleId === group.id);
      ul.appendChild(sampleOrFile(group, ctx, defaultOpen, allGroupFiles));
    }
    if (!groups.length) ul.appendChild(el("li", "muted folder-empty", t("sidebar.emptyFilter")));
    node.appendChild(ul);
  }
  return node;
}

export function renderSidebar(host, ctx) {
  const { files, folders, filter, search, onFilter, onSearch, onToggleFolder } = ctx;
  const needle = (search || "").trim().toLowerCase();
  const visible = files.filter(
    (file) =>
      matchesFilter(file, filter) &&
      (!needle ||
        (file.sampleId || "").toLowerCase().includes(needle) ||
        (file.label || file.name).toLowerCase().includes(needle))
  );

  host.innerHTML = "";
  const head = el("div", "sidebar-head");
  // The mark is a button: a click opens the logo large (point GG). The sources go up
  // to 1024 px, so the 56 px icon stays sharp at device pixel ratio 2 and 3.
  const mark = el("button", "app-mark");
  mark.type = "button";
  mark.setAttribute("aria-label", t("tip.logoZoom"));
  const img = document.createElement("img");
  img.src = "/assets/ities_icon_256.png";
  img.srcset =
    "/assets/ities_icon_256.png 256w, /assets/ities_icon_512.png 512w, /assets/ities_icon_1024.png 1024w";
  img.sizes = "48px";
  img.width = 48;
  img.height = 48;
  img.alt = "";
  mark.appendChild(img);
  wireLogoPreview(mark);
  const titles = el("div", "sidebar-titles");
  // One line, never two: the tagline is clipped with an ellipsis and says the whole
  // sentence in its tooltip.
  const tagline = el("span", "muted sidebar-tagline", t("app.tagline"));
  tagline.dataset.tooltipKey = "app.taglineFull";
  titles.append(appNav("ities"), tagline);
  head.append(mark, titles);
  host.appendChild(head);

  const listHead = el("div", "sidebar-list-head");
  const searchWrap = el("div", "sidebar-search");
  const input = document.createElement("input");
  input.type = "search";
  input.value = search || "";
  input.placeholder = t("sidebar.searchPlaceholder");
  input.setAttribute("aria-label", t("sidebar.searchLabel"));
  input.addEventListener("input", () => onSearch(input.value));
  searchWrap.appendChild(input);
  const create = el("button", "new-folder-button", t("folder.new"));
  create.type = "button";
  create.dataset.tooltipKey = "tip.newFolder";
  create.addEventListener("click", () => {
    create.hidden = true;
    const field = editableName({
      value: "",
      aria: t("folder.name"),
      onSave: (name) => ctx.onCreateFolder(name),
      onClose: () => {
        create.hidden = false;
      },
    });
    field.classList.add("folder-create-input");
    listHead.insertBefore(field, create);
  });
  listHead.append(searchWrap, create);
  host.appendChild(listHead);
  host.appendChild(sectionHeading("sidebar.filtersSection"));
  host.appendChild(filterList(ctx));
  host.appendChild(sectionHeading("sidebar.filesSection"));

  const tree = el("ul", "tree");
  tree.setAttribute("aria-label", t("sidebar.tree"));
  const folderNames = new Set(folders ? [...folders.keys()] : []);
  for (const file of files) if (file.folder) folderNames.add(file.folder);
  if (!files.length && !folderNames.size) tree.appendChild(el("li", "muted sidebar-empty", t("sidebar.empty")));

  for (const name of folderNames) {
    const meta = folders?.get(name) || { open: true, origin: "import", skipped: 0, exts: "", extCounts: {} };
    const allFolderFiles = files.filter((file) => file.folder === name);
    const visibleFolderFiles = visible.filter((file) => file.folder === name);
    tree.appendChild(folderNode(name, meta, allFolderFiles, visibleFolderFiles, { ...ctx, onToggleFolder }));
  }

  const loose = visible.filter((file) => !file.folder);
  if (loose.length) {
    const groups = groupBySample(loose);
    const defaultOpen = groups.length <= AUTO_OPEN_SAMPLES;
    for (const group of groups) {
      const allGroupFiles = files.filter((file) => !file.folder && file.sampleId === group.id);
      tree.appendChild(sampleOrFile(group, ctx, defaultOpen, allGroupFiles));
    }
  } else if (files.length && !folderNames.size) {
    tree.appendChild(el("li", "muted sidebar-empty", needle ? t("sidebar.noMatch") : t("sidebar.emptyFilter")));
  }
  host.appendChild(tree);

  const drop = el("div", "sidebar-drop");
  drop.dataset.tooltipKey = "tip.sidebarDrop";
  drop.innerHTML =
    '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">' +
    '<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" ' +
    'd="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/></svg>';
  drop.append(
    el("strong", null, t("sidebar.dropTitle")),
    el("span", "muted", t("sidebar.dropHint")),
    el("span", "muted sidebar-formats", t("sidebar.dropFormats"))
  );
  const actions = el("div", "sidebar-drop-actions");
  const importButton = el("button", "primary", t("toolbar.import"));
  importButton.type = "button";
  importButton.dataset.tooltipKey = "tip.import";
  importButton.addEventListener("click", ctx.onImport);
  const folderButton = el("button", null, t("toolbar.addFolder"));
  folderButton.type = "button";
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
  return next ? next.id : visible[index].id;
}
