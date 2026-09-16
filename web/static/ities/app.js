import { applyStatic, locale, t } from "/shared/i18n.js";
import { mountPrefs } from "/shared/prefs.js";
import { Engine } from "./engine.js";
import { sampleIdFromName, shaShort, verdictInfo } from "./ui/format.js";
import { renderSidebar, siblingFileId } from "./ui/sidebar.js";
import { renderResult } from "./ui/result.js";
import { renderTable } from "./ui/table.js";
import {
  saveSession,
  loadSession,
  exportCsv,
  buildPrintReport,
  printReport,
  downloadDiscrepancy,
} from "./ui/session.js";

export const APP_VERSION = "1.2.0";
export const APP_CHANGELOG_KEYS = [
  "app.changelog.1_2_0",
  "app.changelog.1_1_0",
  "app.changelog.1_0_0",
];

const SUPPORTED = /\.txt$/i;
const NARROW = "(max-width: 1023px)";

const $ = (id) => document.getElementById(id);

const state = {
  files: [],
  folders: new Map(),
  closedSamples: new Set(),
  skipped: { count: 0, exts: "", extsSet: new Set() },
  selectedId: null,
  filter: "all",
  search: "",
  view: "files",
  expertMode: false,
  markers: true,
  operator: "",
  versions: [],
  sortKey: "name",
  sortDir: 1,
  previewExpert: null,
  reason: "",
  calibrated: true,
  pumping: false,
  engineStatus: { key: "engine.starting", params: null, loading: false },
};

const engine = new Engine();
let chart = null;
let persistTimer = 0;

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
}

function selectedFile() {
  return state.files.find((f) => f.id === state.selectedId) || null;
}

function timeLabel() {
  return new Date().toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
}

function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const payload = {
      files: state.files.map((f) => ({
        id: f.id,
        name: f.name,
        label: f.label,
        folder: f.folder,
        sampleId: f.sampleId,
        sha256: f.sha256,
        sizeBytes: f.sizeBytes,
        fileModified: f.fileModified,
        addedAt: f.addedAt,
        analysedAt: f.analysedAt,
        durationMs: f.durationMs,
        algoVersion: f.algoVersion,
        algoSha: f.algoSha,
        state: f.state,
        auto: f.auto,
        expert: f.expert,
        revisions: f.revisions,
        bytes: f.bytes,
      })),
      folders: [...state.folders.entries()].map(([name, meta]) => ({
        name,
        open: meta.open,
        skipped: meta.skipped,
        exts: meta.exts,
      })),
      skipped: { count: state.skipped.count, exts: state.skipped.exts },
      operator: state.operator,
      filter: state.filter,
    };
    saveSession(payload).catch(() => {});
  }, 250);
}

// ---------------------------------------------------------------- status bar

function setStatus(key, params, loading) {
  state.engineStatus = { key, params: params || null, loading: !!loading };
  paintStatus();
}

function paintStatus() {
  const el = $("engine-status");
  const { key, params, loading } = state.engineStatus;
  el.textContent = "";
  if (loading) {
    const bar = document.createElement("span");
    bar.className = "engine-bar";
    bar.appendChild(document.createElement("span"));
    el.appendChild(bar);
  }
  el.appendChild(document.createTextNode(t(key, params)));
  const dot = $("status-dot");
  dot.className =
    "status-dot " + (key === "engine.error" ? "is-error" : loading ? "is-busy" : "is-ready");
  paintAnalysisStatus();
}

function paintAnalysisStatus() {
  const el = $("analysis-status");
  const file = selectedFile();
  if (!file) {
    el.textContent = state.files.length ? t("statusbar.idle") : "";
    return;
  }
  if (file.state === "running") {
    el.textContent = t("statusbar.running");
    return;
  }
  if (!file.auto && !file.expert) {
    el.textContent = t("statusbar.pending");
    return;
  }
  const seconds = file.durationMs != null ? (file.durationMs / 1000).toFixed(2) : null;
  el.textContent =
    t("statusbar.done") +
    (seconds ? " · " + t("statusbar.time", { seconds: seconds.replace(".", locale() === "pl-PL" ? "," : ".") }) : "");
}

function readyStatus() {
  setStatus("engine.readyWith", {
    version: engine.version,
    sha: shaShort(engine.sha256),
  });
}

function stageKey(stage) {
  if (stage === "pyodide" || stage === "pyodide-fallback") return "engine.stage.pyodide";
  if (stage === "packages") return "engine.stage.packages";
  if (stage === "algorithm") return "engine.stage.algorithm";
  return "engine.ready";
}

function fillVersionSelect() {
  const sel = $("algo-version");
  sel.innerHTML = "";
  for (const v of state.versions) {
    const opt = document.createElement("option");
    opt.value = v.version;
    opt.textContent = v.default
      ? t("toolbar.algorithmDefault", { version: v.version })
      : t("toolbar.algorithm", { version: v.version });
    sel.appendChild(opt);
  }
  if (engine.version) sel.value = engine.version;
}

// ---------------------------------------------------------------- file ingest

function folderMeta(name) {
  if (!state.folders.has(name)) {
    state.folders.set(name, { open: true, skipped: 0, exts: "", extsSet: new Set() });
  }
  return state.folders.get(name);
}

function extensionOf(name) {
  const m = /\.[^.]+$/.exec(name);
  return m ? m[0].toLowerCase() : "?";
}

// A file we cannot read is counted, never silently dropped. Folder counts live on the
// folder node, loose ones next to the file counter in the toolbar.
function noteSkipped(name, folder) {
  if (!name) return;
  if (folder) {
    const meta = folderMeta(folder);
    meta.skipped = (meta.skipped || 0) + 1;
    meta.extsSet.add(extensionOf(name));
    meta.exts = [...meta.extsSet].sort().join(", ");
  } else {
    state.skipped.count += 1;
    state.skipped.extsSet.add(extensionOf(name));
    state.skipped.exts = [...state.skipped.extsSet].sort().join(", ");
  }
  if (/\.nox$/i.test(name)) {
    $("live-results").textContent = t("files.noxSkipped", { name });
  }
}

// Files arrive as {blob, path}. path is the location inside the dropped folder and
// keeps two same-named measurements in different subfolders apart.
async function addFiles(items, folder) {
  let added = 0;
  for (const item of items) {
    const blob = item.blob;
    if (!SUPPORTED.test(blob.name)) {
      noteSkipped(blob.name, folder);
      continue;
    }
    const buf = await blob.arrayBuffer();
    const sha = await sha256Hex(buf);
    const relPath = item.path || blob.name;
    const file = {
      id: uid(),
      name: blob.name,
      label: relPath.includes("/") ? relPath : blob.name,
      folder: folder || null,
      sampleId: sampleIdFromName(blob.name),
      bytes: new Uint8Array(buf),
      sha256: sha,
      sizeBytes: blob.size,
      fileModified: blob.lastModified || null,
      addedAt: new Date().toISOString(),
      state: "queued",
      auto: null,
      expert: null,
      revisions: [],
    };
    state.files.push(file);
    added += 1;
    if (!state.selectedId) state.selectedId = file.id;
  }
  if (folder) folderMeta(folder).open = true;
  persist();
  renderAll();
  if (added && window.matchMedia(NARROW).matches) openDrawer();
  pump();
}

function readEntries(reader) {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

async function walkEntry(entry, prefix, out) {
  if (entry.isFile) {
    const blob = await new Promise((resolve, reject) => entry.file(resolve, reject));
    out.push({ blob, path: prefix ? prefix + "/" + entry.name : entry.name });
    return;
  }
  if (!entry.isDirectory) return;
  const reader = entry.createReader();
  let batch = await readEntries(reader);
  while (batch.length) {
    for (const child of batch) {
      await walkEntry(child, prefix ? prefix + "/" + entry.name : entry.name, out);
    }
    batch = await readEntries(reader);
  }
}

async function ingestEntries(entries) {
  for (const entry of entries) {
    if (entry.isDirectory) {
      const out = [];
      await walkEntry(entry, "", out);
      // walkEntry prefixes with the root name; strip it so paths read from the node down.
      const inside = out.map((item) => ({
        blob: item.blob,
        path: item.path.startsWith(entry.name + "/")
          ? item.path.slice(entry.name.length + 1)
          : item.path,
      }));
      await addFiles(inside, entry.name);
    } else if (entry.isFile) {
      const blob = await new Promise((resolve, reject) => entry.file(resolve, reject));
      await addFiles([{ blob }], null);
    }
  }
}

// webkitdirectory gives every file a webkitRelativePath like "Neutrale/sub/a.txt".
function ingestDirectoryInput(fileList) {
  const list = [...fileList];
  if (!list.length) return;
  const byRoot = new Map();
  for (const blob of list) {
    const rel = blob.webkitRelativePath || blob.name;
    const parts = rel.split("/");
    const root = parts.length > 1 ? parts[0] : "";
    const path = parts.length > 1 ? parts.slice(1).join("/") : blob.name;
    if (!byRoot.has(root)) byRoot.set(root, []);
    byRoot.get(root).push({ blob, path });
  }
  for (const [root, items] of byRoot) addFiles(items, root || null);
}

// ---------------------------------------------------------------- analysis queue

async function analyzeOne(file) {
  const started = performance.now();
  const result = await engine.analyze({
    id: file.id,
    name: file.name,
    bytes: file.bytes,
  });
  if (file.auto && file.algoVersion && file.algoVersion !== engine.version) {
    file.revisions = file.revisions || [];
    file.revisions.push({
      at: file.analysedAt,
      mode: "auto",
      version: file.algoVersion,
      status: file.auto.status,
    });
  }
  file.auto = result;
  file.algoVersion = engine.version;
  file.algoSha = engine.sha256;
  file.analysedAt = new Date().toISOString();
  file.durationMs = performance.now() - started;
  $("live-results").textContent = file.name + ": " + verdictInfo(result.status).word;
}

// The queue runs itself: files added before the engine is up simply wait here and
// start the moment the worker reports ready.
async function pump() {
  if (state.pumping || !engine.ready) return;
  state.pumping = true;
  try {
    while (true) {
      const next = state.files.find((f) => f.state === "queued" && f.bytes);
      if (!next) break;
      next.state = "running";
      const done = state.files.filter((f) => f.state === "done" || f.state === "error").length + 1;
      setStatus("engine.analysing", { done, total: state.files.length }, true);
      renderSidebarNow();
      try {
        await analyzeOne(next);
        next.state = "done";
      } catch (err) {
        next.state = "error";
        next.error = err.message;
        $("live-results").textContent = t("engine.analysisError", { message: err.message });
      }
      renderSidebarNow();
      updateToolbar();
      if (state.view === "table" || next.id === state.selectedId) renderContent();
    }
    readyStatus();
    persist();
  } finally {
    state.pumping = false;
  }
}

function requeueAll() {
  for (const file of state.files) {
    if (file.bytes) file.state = "queued";
  }
  renderAll();
  pump();
}

// Detect again: back to the automatic reading of this one file. A saved expert
// correction is not lost, it moves into the history instead of masking the new result.
function redetect(file) {
  if (file.expert) {
    file.revisions = file.revisions || [];
    file.revisions.push({
      at: new Date().toISOString(),
      mode: "manual",
      version: file.algoVersion,
      status: file.expert.status,
    });
    file.expert = null;
  }
  state.previewExpert = null;
  file.state = "queued";
  renderAll();
  pump();
}

// ---------------------------------------------------------------- rendering

function openDrawer() {
  $("sidebar").classList.add("is-open");
  $("backdrop").hidden = false;
}

function closeDrawer() {
  $("sidebar").classList.remove("is-open");
  $("backdrop").hidden = true;
}

function renderSidebarNow() {
  renderSidebar($("sidebar"), {
    files: state.files,
    folders: state.folders,
    closedSamples: state.closedSamples,
    selectedId: state.selectedId,
    filter: state.filter,
    search: state.search,
    onSelect: (id) => {
      state.selectedId = id;
      state.previewExpert = null;
      if (window.matchMedia(NARROW).matches) closeDrawer();
      renderAll();
    },
    onFilter: (f) => {
      state.filter = f;
      renderAll();
    },
    onSearch: (value) => {
      state.search = value;
      renderSidebarNow();
      const input = $("sidebar").querySelector('input[type="search"]');
      input?.focus();
      input?.setSelectionRange(value.length, value.length);
    },
    onRenameSample: (oldId, next) => {
      for (const file of state.files) {
        if (file.sampleId === oldId) file.sampleId = next;
      }
      persist();
      renderAll();
    },
    onToggleFolder: (name) => {
      const meta = folderMeta(name);
      meta.open = !meta.open;
      persist();
      renderSidebarNow();
    },
    onToggleSample: (id) => {
      if (state.closedSamples.has(id)) state.closedSamples.delete(id);
      else state.closedSamples.add(id);
      renderSidebarNow();
    },
    onImport: () => $("file-input").click(),
    onImportFolder: () => $("folder-input").click(),
  });
}

function updateToolbar() {
  const n = state.files.length;
  const el = $("file-count");
  el.hidden = n === 0;
  el.textContent = "";
  if (n) {
    el.appendChild(document.createTextNode(t("toolbar.count", { n })));
    if (state.skipped.count) {
      const skip = document.createElement("span");
      skip.className = "muted";
      skip.textContent = " · " + t("toolbar.skipped", {
        n: state.skipped.count,
        exts: state.skipped.exts,
      });
      el.appendChild(skip);
    }
  }
  $("btn-analyze").disabled = !n || !engine.ready;
  $("app-ver").textContent = "v" + APP_VERSION;
  paintAnalysisStatus();
}

function renderEmpty() {
  const content = $("content");
  content.innerHTML = "";
  const card = document.createElement("div");
  card.className = "empty-drop card";
  const p1 = document.createElement("p");
  p1.textContent = t("empty.drop");
  const p2 = document.createElement("p");
  p2.className = "muted";
  p2.textContent = t("empty.formats");
  card.append(p1, p2);
  content.appendChild(card);
}

function renderEngineError(message) {
  const content = $("content");
  content.innerHTML = "";
  const card = document.createElement("div");
  card.className = "engine-error card";
  const p1 = document.createElement("p");
  p1.textContent = message;
  const p2 = document.createElement("p");
  p2.className = "muted";
  p2.textContent = t("engine.errorBody");
  const actions = document.createElement("p");
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "primary";
  retry.textContent = t("engine.retry");
  retry.addEventListener("click", () => engine.retry({ useCdn: false }).catch(showEngineError));
  const cdn = document.createElement("button");
  cdn.type = "button";
  cdn.textContent = t("engine.useCdn");
  cdn.addEventListener("click", () => engine.retry({ useCdn: true }).catch(showEngineError));
  actions.append(retry, document.createTextNode(" "), cdn);
  card.append(p1, p2, actions);
  content.appendChild(card);
}

function showEngineError(err) {
  setStatus("engine.error", null, false);
  renderEngineError(String(err.message || err));
}

async function runManual(manual) {
  const file = selectedFile();
  if (!file || !engine.ready) return;
  try {
    const result = await engine.analyze({
      id: file.id + "-manual",
      name: file.name,
      bytes: file.bytes,
      manual,
    });
    result._savedAtLabel = timeLabel();
    state.previewExpert = result;
    renderContent();
  } catch (err) {
    $("live-results").textContent = t("expert.error", { message: err.message });
  }
}

function expertPanel(file) {
  const host = document.createElement("section");
  host.className = "card expert-panel";
  const hint = document.createElement("p");
  hint.className = "muted";
  hint.textContent = t("expert.hint");
  const label = document.createElement("label");
  const span = document.createElement("span");
  span.textContent = t("expert.reason");
  const area = document.createElement("textarea");
  area.rows = 2;
  area.required = true;
  area.value = state.reason;
  area.addEventListener("input", (e) => {
    state.reason = e.target.value;
  });
  label.append(span, area);
  const actions = document.createElement("div");
  actions.className = "expert-actions";
  const save = document.createElement("button");
  save.type = "button";
  save.className = "primary";
  save.textContent = t("expert.save");
  save.addEventListener("click", () => {
    if (!state.reason.trim()) {
      $("live-results").textContent = t("expert.needReason");
      return;
    }
    if (!state.previewExpert && !file.expert) {
      $("live-results").textContent = t("expert.needPoints");
      return;
    }
    const saved = state.previewExpert || file.expert;
    saved.mode = "manual";
    saved._reason = state.reason.trim();
    saved._savedAtLabel = timeLabel();
    file.expert = saved;
    file.revisions = file.revisions || [];
    file.revisions.push({
      at: new Date().toISOString(),
      mode: "manual",
      version: engine.version,
      status: saved.status,
    });
    state.previewExpert = null;
    persist();
    renderAll();
  });
  const report = document.createElement("button");
  report.type = "button";
  report.textContent = t("expert.report");
  report.addEventListener("click", () => {
    if (!state.reason.trim()) {
      $("live-results").textContent = t("expert.needReasonReport");
      return;
    }
    downloadDiscrepancy({
      file,
      auto: file.auto,
      expert: state.previewExpert || file.expert,
      reason: state.reason.trim(),
      version: engine.version,
      sha256: engine.sha256,
      operator: state.operator,
    });
  });
  actions.append(save, report);
  host.append(hint, label, actions);
  return host;
}

function renderFileView() {
  const content = $("content");
  const file = selectedFile();
  if (!file) {
    if (!state.files.length) renderEmpty();
    else {
      content.innerHTML = "";
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = t("empty.pickFile");
      content.appendChild(p);
    }
    return;
  }
  if (chart) {
    chart.destroy();
    chart = null;
  }
  chart = renderResult(content, {
    file,
    result: state.previewExpert || file.expert || file.auto,
    constants: engine.constants,
    algoVersion: file.algoVersion || engine.version,
    algoSha: file.algoSha || engine.sha256,
    calibrated: state.calibrated,
    markers: state.markers,
    expert: state.expertMode,
    expertPanel: state.expertMode ? expertPanel(file) : null,
    onAxis: (on) => {
      state.calibrated = on;
      renderContent();
    },
    onMarkers: (on) => {
      state.markers = on;
      renderContent();
    },
    onRedetect: () => redetect(file),
    onEdit: () => {
      state.expertMode = !state.expertMode;
      $("expert-mode").checked = state.expertMode;
      renderContent();
    },
    onManual: (manual) => runManual(manual),
  });
}

function renderContent() {
  if (state.view === "table") {
    if (chart) {
      chart.destroy();
      chart = null;
    }
    const content = $("content");
    content.innerHTML = "";
    const host = document.createElement("div");
    content.appendChild(host);
    renderTable(host, {
      files: state.files,
      filter: state.filter,
      sortKey: state.sortKey,
      sortDir: state.sortDir,
      onSelect: (id) => {
        state.selectedId = id;
        setView("files");
      },
      onSort: (key) => {
        if (state.sortKey === key) state.sortDir *= -1;
        else {
          state.sortKey = key;
          state.sortDir = 1;
        }
        renderContent();
      },
    });
    paintAnalysisStatus();
    return;
  }
  if (!state.files.length) renderEmpty();
  else renderFileView();
  paintAnalysisStatus();
}

function renderAll() {
  renderSidebarNow();
  updateToolbar();
  renderContent();
}

function setView(view) {
  state.view = view;
  $("view-files").setAttribute("aria-pressed", String(view === "files"));
  $("view-table").setAttribute("aria-pressed", String(view === "table"));
  renderContent();
}

// ---------------------------------------------------------------- wiring

function wireUi() {
  mountPrefs($("app-prefs"), {
    onLang: () => {
      paintStatus();
      fillVersionSelect();
      renderAll();
    },
  });

  $("btn-add").addEventListener("click", () => $("file-input").click());
  $("btn-add-folder").addEventListener("click", () => $("folder-input").click());
  $("file-input").addEventListener("change", (e) => {
    addFiles([...e.target.files].map((blob) => ({ blob })), null);
    e.target.value = "";
  });
  $("folder-input").addEventListener("change", (e) => {
    ingestDirectoryInput(e.target.files);
    e.target.value = "";
  });
  $("btn-analyze").addEventListener("click", requeueAll);
  $("expert-mode").addEventListener("change", (e) => {
    state.expertMode = e.target.checked;
    renderContent();
  });
  $("view-files").addEventListener("click", () => setView("files"));
  $("view-table").addEventListener("click", () => setView("table"));
  $("btn-export").addEventListener("click", () => {
    const menu = $("export-menu");
    const open = !menu.classList.contains("is-open");
    menu.classList.toggle("is-open", open);
    $("btn-export").setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", (e) => {
    if (!$("export-menu").contains(e.target)) $("export-menu").classList.remove("is-open");
  });
  $("export-csv").addEventListener("click", () => {
    exportCsv(state.files, {
      operator: state.operator,
      algoVersion: engine.version,
      algoSha: engine.sha256,
    });
    $("export-menu").classList.remove("is-open");
  });
  $("export-pdf").addEventListener("click", () => {
    const html = buildPrintReport({
      files: state.files,
      operator: state.operator,
      constants: engine.constants,
      algoVersion: engine.version,
      algoSha: engine.sha256,
    });
    printReport(html);
    $("export-menu").classList.remove("is-open");
  });
  $("operator").addEventListener("input", (e) => {
    state.operator = e.target.value;
    persist();
  });
  $("algo-version").addEventListener("change", async (e) => {
    const version = e.target.value;
    setStatus("engine.loadingAlgo", { version }, true);
    try {
      await engine.switchVersion(version);
      requeueAll();
    } catch (err) {
      showEngineError(err);
    }
  });

  const content = $("content");
  content.addEventListener("dragover", (e) => {
    e.preventDefault();
    content.classList.add("is-over");
  });
  content.addEventListener("dragleave", () => content.classList.remove("is-over"));
  content.addEventListener("drop", (e) => {
    e.preventDefault();
    content.classList.remove("is-over");
    const dt = e.dataTransfer;
    const entries = [];
    if (dt.items) {
      for (const item of dt.items) {
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
        if (entry) entries.push(entry);
      }
    }
    if (entries.length) ingestEntries(entries);
    else addFiles([...dt.files].map((blob) => ({ blob })), null);
  });

  $("drawer-btn").addEventListener("click", openDrawer);
  $("backdrop").addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => {
    if (state.view !== "files") return;
    if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const id = siblingFileId(state.files, state.selectedId, e.key === "ArrowDown" ? 1 : -1, state.filter);
      if (id) {
        state.selectedId = id;
        state.previewExpert = null;
        renderAll();
      }
    }
  });
  document.addEventListener("fullscreenchange", () => {
    document.body.classList.toggle("is-fullscreen", !!document.fullscreenElement);
  });
}

async function boot() {
  applyStatic(document);
  wireUi();
  paintStatus();
  renderEmpty();
  engine.on((ev) => {
    if (ev.type === "status") setStatus(stageKey(ev.stage), null, true);
    if (ev.type === "ready") {
      readyStatus();
      fillVersionSelect();
      updateToolbar();
      // A restored session paints before the worker reports its constants, so the
      // thresholds on screen would stay empty without this repaint.
      renderContent();
      pump();
    }
    if (ev.type === "error" && ev.id == null) showEngineError(ev);
  });
  try {
    const saved = await loadSession();
    if (saved?.files?.length) {
      state.files = saved.files.map((f) => ({
        ...f,
        state: f.auto || f.expert ? "done" : "queued",
        revisions: f.revisions || [],
      }));
      state.operator = saved.operator || "";
      $("operator").value = state.operator;
      state.filter = saved.filter || "all";
      state.selectedId = state.files[0].id;
      for (const meta of saved.folders || []) {
        state.folders.set(meta.name, {
          open: meta.open !== false,
          skipped: meta.skipped || 0,
          exts: meta.exts || "",
          extsSet: new Set((meta.exts || "").split(", ").filter(Boolean)),
        });
      }
      if (saved.skipped) {
        state.skipped = {
          count: saved.skipped.count || 0,
          exts: saved.skipped.exts || "",
          extsSet: new Set((saved.skipped.exts || "").split(", ").filter(Boolean)),
        };
      }
    }
  } catch (_) {
    /* first run */
  }
  try {
    const res = await fetch("/api/versions", { cache: "no-store" });
    state.versions = await res.json();
    fillVersionSelect();
  } catch (_) {
    state.versions = [];
  }
  renderAll();
  try {
    const wanted = new URLSearchParams(location.search).get("algo");
    await engine.init(wanted || undefined);
  } catch (err) {
    showEngineError(err);
  }
}

if (document.getElementById("content")) boot();
