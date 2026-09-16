import { locale, t } from "/shared/i18n.js";
import {
  bucketCounts,
  displayResult,
  matchesFilter,
  sampleAggregate,
  verdictInfo,
} from "./format.js";

// Folder, sample, file. A status dot carries the colour, its label carries the word,
// so the tree never says anything with colour alone.

const AUTO_OPEN_SAMPLES = 12;

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

function groupBySample(files) {
  const groups = [];
  const index = new Map();
  for (const file of files) {
    const key = file.sampleId;
    if (!index.has(key)) {
      const group = { id: key, files: [] };
      index.set(key, group);
      groups.push(group);
    }
    index.get(key).files.push(file);
  }
  return groups;
}

function fileRow(file, selectedId, onSelect) {
  const li = el("li");
  const button = el("button", "file-row" + (file.id === selectedId ? " is-selected" : ""));
  button.type = "button";
  button.dataset.id = file.id;
  button.setAttribute("aria-current", file.id === selectedId ? "true" : "false");
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
  button.addEventListener("click", () => onSelect(file.id));
  li.appendChild(button);
  return li;
}

function sampleNode(group, ctx, defaultOpen) {
  const open = ctx.closedSamples.has(group.id)
    ? group.files.some((f) => f.id === ctx.selectedId)
    : defaultOpen || group.files.some((f) => f.id === ctx.selectedId);
  const node = el("li", "tree-sample" + (open ? " is-open" : ""));
  const head = el("div", "tree-row tree-sample-head");
  const toggle = el("button", "tree-toggle");
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", String(open));
  toggle.appendChild(caret());
  const label = el("span", "tree-label", group.id);
  label.title = group.id;
  toggle.appendChild(label);
  toggle.addEventListener("click", () => ctx.onToggleSample(group.id));

  const agg = sampleAggregate(group.files);
  const rename = el("button", "tree-rename");
  rename.type = "button";
  rename.title = t("sidebar.renameHint");
  rename.setAttribute("aria-label", t("sidebar.renameHint"));
  rename.textContent = "✎";
  rename.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const next = window.prompt(t("sidebar.renamePrompt"), group.id);
    if (next && next.trim() && next.trim() !== group.id) ctx.onRenameSample(group.id, next.trim());
  });

  const count = el("span", "tree-count tabular", String(group.files.length));
  if (agg) {
    const info = verdictInfo(agg);
    count.classList.add("tone-" + info.tone);
    count.title = info.word;
  }
  head.append(toggle, rename, count);
  node.appendChild(head);

  if (open) {
    const ul = el("ul", "file-list");
    for (const file of group.files) ul.appendChild(fileRow(file, ctx.selectedId, ctx.onSelect));
    node.appendChild(ul);
  }
  return node;
}

// A sample with a single measurement is that measurement: grouping one file under a
// sample header would hide the row behind a caret for nothing.
function sampleOrFile(group, ctx, defaultOpen) {
  if (group.files.length === 1) {
    return fileRow(group.files[0], ctx.selectedId, ctx.onSelect);
  }
  return sampleNode(group, ctx, defaultOpen);
}

function folderCounts(files, meta) {
  const counts = bucketCounts(files);
  const row = el("div", "folder-counts");
  for (const [tone, n] of [
    ["detected", counts.detected],
    ["uncertain", counts.uncertain],
    ["not_detected", counts.not_detected],
    ["quality", counts.unsuitable],
  ]) {
    if (!n) continue;
    const key = tone === "quality" ? "MEASUREMENT_QUALITY_FAIL" : tone;
    const chip = el("span", "chip " + tone, n + " " + verdictInfo(key).word);
    row.appendChild(chip);
  }
  if (counts.pending) {
    row.appendChild(el("span", "chip state-queued", counts.pending + " " + t("state.queued")));
  }
  if (meta?.skipped) {
    row.appendChild(
      el("span", "folder-skipped muted", t("toolbar.skipped", { n: meta.skipped, exts: meta.exts }))
    );
  }
  return row;
}

export function renderSidebar(el_, ctx) {
  const {
    files,
    folders,
    filter,
    search,
    onFilter,
    onSearch,
    onToggleFolder,
  } = ctx;
  const needle = (search || "").trim().toLowerCase();
  const visible = files.filter(
    (f) =>
      matchesFilter(f, filter) &&
      (!needle ||
        (f.sampleId || "").toLowerCase().includes(needle) ||
        (f.label || f.name).toLowerCase().includes(needle))
  );

  el_.innerHTML = "";

  const head = el("div", "sidebar-head");
  const mark = el("span", "app-mark");
  const img = document.createElement("img");
  img.src = "/assets/ities_icon_256.png";
  img.width = 32;
  img.height = 32;
  img.alt = "";
  mark.appendChild(img);
  const titles = el("div", "sidebar-titles");
  titles.append(el("strong", null, t("app.name")), el("span", "muted", t("app.tagline")));
  head.append(mark, titles);
  el_.appendChild(head);

  const searchWrap = el("div", "sidebar-search");
  const input = document.createElement("input");
  input.type = "search";
  input.value = search || "";
  input.placeholder = t("sidebar.searchPlaceholder");
  input.setAttribute("aria-label", t("sidebar.searchLabel"));
  input.addEventListener("input", () => onSearch(input.value));
  searchWrap.appendChild(input);
  el_.appendChild(searchWrap);

  const filters = el("div", "seg sidebar-filters");
  filters.setAttribute("role", "group");
  filters.setAttribute("aria-label", t("sidebar.filters"));
  for (const [id, key] of [
    ["all", "sidebar.all"],
    ["review", "sidebar.review"],
    ["unsuitable", "sidebar.unsuitable"],
  ]) {
    const b = el("button", null, t(key));
    b.type = "button";
    b.setAttribute("aria-pressed", String(filter === id));
    b.addEventListener("click", () => onFilter(id));
    filters.appendChild(b);
  }
  el_.appendChild(filters);

  const tree = el("ul", "tree");
  tree.setAttribute("aria-label", t("sidebar.tree"));

  const loose = visible.filter((f) => !f.folder);
  const byFolder = new Map();
  for (const file of visible) {
    if (!file.folder) continue;
    if (!byFolder.has(file.folder)) byFolder.set(file.folder, []);
    byFolder.get(file.folder).push(file);
  }

  if (!loose.length && !byFolder.size) {
    const empty = el(
      "li",
      "muted sidebar-empty",
      files.length ? (needle ? t("sidebar.noMatch") : t("sidebar.emptyFilter")) : t("sidebar.empty")
    );
    tree.appendChild(empty);
  }

  for (const [name, folderFiles] of byFolder) {
    const meta = folders?.get(name) || { open: true, skipped: 0, exts: "" };
    const node = el("li", "tree-folder" + (meta.open ? " is-open" : ""));
    const head2 = el("div", "tree-row tree-folder-head");
    const toggle = el("button", "tree-toggle");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", String(!!meta.open));
    toggle.appendChild(caret());
    const label = el("span", "tree-label", name);
    label.title = name;
    toggle.appendChild(label);
    toggle.addEventListener("click", () => onToggleFolder(name));
    head2.append(toggle, el("span", "tree-count tabular", String(folderFiles.length)));
    node.append(head2, folderCounts(folderFiles, meta));
    if (meta.open) {
      const groups = groupBySample(folderFiles);
      const ul = el("ul", "tree-children");
      const defaultOpen = groups.length <= AUTO_OPEN_SAMPLES;
      for (const group of groups) ul.appendChild(sampleOrFile(group, ctx, defaultOpen));
      node.appendChild(ul);
    }
    tree.appendChild(node);
  }

  if (loose.length) {
    const groups = groupBySample(loose);
    const defaultOpen = groups.length <= AUTO_OPEN_SAMPLES;
    for (const group of groups) tree.appendChild(sampleOrFile(group, ctx, defaultOpen));
  }

  el_.appendChild(tree);

  const drop = el("div", "sidebar-drop");
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
  const importBtn = el("button", "primary", t("toolbar.import"));
  importBtn.type = "button";
  importBtn.addEventListener("click", ctx.onImport);
  const folderBtn = el("button", null, t("toolbar.addFolder"));
  folderBtn.type = "button";
  folderBtn.addEventListener("click", ctx.onImportFolder);
  actions.append(importBtn, folderBtn);
  drop.appendChild(actions);
  el_.appendChild(drop);
}

export function siblingFileId(files, selectedId, dir, filter) {
  const visible = files.filter((f) => matchesFilter(f, filter));
  const idx = visible.findIndex((f) => f.id === selectedId);
  if (idx < 0) return visible[0]?.id;
  const next = visible[idx + dir];
  return next ? next.id : visible[idx].id;
}
