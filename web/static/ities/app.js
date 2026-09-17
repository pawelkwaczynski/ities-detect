import { applyStatic, locale, t } from "/shared/i18n.js";
import { mountPrefs } from "/shared/prefs.js";
import { installTooltips } from "/shared/tooltip.js";
import { installHubShortcut } from "/shared/appswitch.js";
import { mountPartners } from "/shared/partners.js";
import { Engine } from "./engine.js";
import {
  algoFirstChange,
  algoInfoText,
  belowThresholdPoints,
  bucketCounts,
  displayResult,
  fmtNum,
  formatBytes,
  matchesFilter,
  promThresholdUa,
  sampleIdFromName,
  shaShort,
  verdictInfo,
} from "./ui/format.js";
import { renderSidebar, siblingFileId } from "./ui/sidebar.js";
import { renderResult } from "./ui/result.js";
import { renderTable } from "./ui/table.js";
import { renderMulti } from "./ui/multi.js";
import {
  saveSession,
  loadSession,
  deleteSession,
  exportCsv,
  buildPrintReport,
  printReport,
  downloadDiscrepancy,
  buildSessionFile,
  createSession,
  currentSessionInfo,
  defaultSessionName,
  downloadSessionFile,
  listSessions,
  openSessionById,
  readSessionFile,
  removeSession,
  renameSession,
  SESSION_FILE_WARN_BYTES,
} from "./ui/session.js";

export const APP_VERSION = "1.4.0";
export const APP_CHANGELOG_KEYS = [
  "app.changelog.1_4_0",
  "app.changelog.1_3_0",
  "app.changelog.1_2_0",
  "app.changelog.1_1_0",
  "app.changelog.1_0_0",
];

const SUPPORTED = /\.txt$/i;
const NARROW = "(max-width: 1023px)";
const UNDO_MAX_MS = 60000;

// Hard limits for the session parameters. Outside them the Apply button stays off, so
// nobody can widen the criterion until every file reads DETECTED.
const LIMITS = {
  toleranceMv: [1, 30],
  targetV: [0.3, 0.4],
  windowV: [-1, 1],
  windowWidthV: 0.05,
};

const $ = (id) => document.getElementById(id);

const state = {
  files: [],
  folders: new Map(),
  closedSamples: new Set(),
  skipped: { count: 0, exts: "", extsSet: new Set(), extCounts: {} },
  duplicateSkipped: 0,
  selectedId: null,
  // The active file stays `selectedId`; `selectedIds` is the multi file selection on
  // top of it, never persisted (addendum 3, point BB).
  selectedIds: new Set(),
  compareView: false,
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
  paramsOverride: null,
  progress: null,
  undo: null,
  pick: null,
  manualDraft: null,
  manualPicked: new Set(),
  abort: false,
  engineProgress: { stage: "pyodide", percent: 0, indeterminate: true, version: "" },
  session: { id: null, name: "" },
  sessions: [],
};

const engine = new Engine();
let chart = null;
let persistTimer = 0;
let progressCloseTimer = 0;
let undoTimer = 0;
let confirmAction = null;
let choiceActions = null;
let undoDismiss = null;
let moveSelection = null;

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
      sampleIdManual: !!f.sampleIdManual,
        sampleIdManual: !!f.sampleIdManual,
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
        paramsOverride: f.paramsOverride || null,
        bytes: f.bytes,
      })),
      folders: [...state.folders.entries()].map(([name, meta]) => ({
        name,
        open: meta.open,
        origin: meta.origin || "import",
        skipped: meta.skipped,
        exts: meta.exts,
        extCounts: { ...(meta.extCounts || {}) },
      })),
      skipped: {
        count: state.skipped.count,
        exts: state.skipped.exts,
        extCounts: { ...(state.skipped.extCounts || {}) },
      },
      duplicateSkipped: state.duplicateSkipped,
      operator: state.operator,
      filter: state.filter,
    };
    const done = () => {
      $("session-saved").textContent = t("session.savedAt", { time: timeLabel() });
    };
    if (state.files.length || state.folders.size) saveSession(payload).then(done).catch(() => {});
    else deleteSession().then(done).catch(() => {});
  }, 250);
}

// The payload shape saveSession() writes, built on demand for a session file.
function sessionPayload() {
  return {
    files: state.files.map((f) => ({
      id: f.id,
      name: f.name,
      label: f.label,
      folder: f.folder,
      sampleId: f.sampleId,
      sampleIdManual: !!f.sampleIdManual,
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
      paramsOverride: f.paramsOverride || null,
      bytes: f.bytes,
    })),
    folders: [...state.folders.entries()].map(([name, meta]) => ({
      name,
      open: meta.open,
      origin: meta.origin || "import",
      skipped: meta.skipped,
      exts: meta.exts,
      extCounts: { ...(meta.extCounts || {}) },
    })),
    skipped: {
      count: state.skipped.count,
      exts: state.skipped.exts,
      extCounts: { ...(state.skipped.extCounts || {}) },
    },
    duplicateSkipped: state.duplicateSkipped,
    operator: state.operator,
    filter: state.filter,
  };
}

// ---------------------------------------------------------------- status bar

function setStatus(key, params, loading) {
  state.engineStatus = { key, params: params || null, loading: !!loading };
  paintStatus();
  paintProgress();
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

function updateEngineProgress(event) {
  const stage = event.stage === "pyodide-fallback" ? "pyodide" : event.stage;
  if (stage === "pyodide") {
    state.engineProgress = { stage, percent: 0, indeterminate: true, version: "" };
  } else if (stage === "packages") {
    const loaded = Number(event.loaded) || 0;
    const total = Number(event.total) || 3;
    state.engineProgress = {
      stage,
      percent: Math.round(60 + (Math.min(loaded, total) / total) * 30),
      indeterminate: false,
      version: "",
    };
  } else if (stage === "algorithm") {
    state.engineProgress = {
      stage,
      percent: 90,
      indeterminate: false,
      version: event.version || event.detail || engine.version || "",
    };
  }
  paintProgress();
}

function versionEntry(version) {
  return state.versions.find((entry) => entry.version === version) || null;
}

// The "i" next to the version picker carries the manifest, not a slogan.
function paintAlgoInfo() {
  const button = $("algo-info");
  const entry = versionEntry($("algo-version").value || engine.version);
  const text = algoInfoText(entry);
  if (text) button.dataset.tooltipText = text;
  else delete button.dataset.tooltipText;
  button.dataset.tooltipLinkHref = "/ities/versions.html";
  button.dataset.tooltipLinkKey = "common.versions";
  button.hidden = !entry;
}

function algoChangeLine(version) {
  const entry = versionEntry(version);
  const first = algoFirstChange(entry);
  return t("progress.algorithmChanged", { version }) + (entry?.date ? ` (${entry.date})` : "") +
    (first ? ": " + first : "");
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
  paintAlgoInfo();
}

// ---------------------------------------------------------------- batch progress

function beginProgress(source) {
  clearTimeout(progressCloseTimer);
  state.progress = {
    kind: "batch",
    source,
    fileIds: [],
    duplicateSkipped: 0,
    formatSkipped: 0,
    formatExts: new Set(),
    formatExtCounts: {},
    importComplete: false,
    completed: false,
    aborted: false,
  };
  state.abort = false;
  const dialog = $("batch-progress");
  if (dialog.open) dialog.close();
  dialog.show();
  state.progress.touched = false;
  paintProgress();
  return state.progress;
}

function beginEngineProgress(version = "") {
  clearTimeout(progressCloseTimer);
  state.engineProgress = { stage: "pyodide", percent: 0, indeterminate: true, version };
  state.progress = {
    kind: "engine",
    source: "",
    fileIds: [],
    duplicateSkipped: 0,
    formatSkipped: 0,
    formatExts: new Set(),
    formatExtCounts: {},
    importComplete: false,
    completed: false,
    aborted: false,
    error: "",
    touched: false,
  };
  const dialog = $("batch-progress");
  if (dialog.open) dialog.close();
  dialog.show();
  paintProgress();
}

function progressFiles() {
  if (!state.progress) return [];
  const ids = new Set(state.progress.fileIds);
  return state.files.filter((file) => ids.has(file.id));
}

function closeProgress() {
  clearTimeout(progressCloseTimer);
  if ($("batch-progress").open) $("batch-progress").close();
}

function scheduleProgressClose() {
  clearTimeout(progressCloseTimer);
  progressCloseTimer = setTimeout(() => {
    const dialog = $("batch-progress");
    if (!dialog.open) return;
    // Focus alone must not pin the dialog: show() lands focus on the close button,
    // so only a pointer or a key press from the user counts as "still reading".
    if (dialog.matches(":hover") || state.progress?.touched) return;
    dialog.close();
  }, 2500);
}

function paintProgress() {
  const batch = state.progress;
  if (!batch) return;
  const engineOnly = batch.kind === "engine";
  const files = progressFiles();
  const finishedFiles = files.filter((file) => file.state === "done" || file.state === "error");
  const counts = bucketCounts(finishedFiles);
  const done = files.filter((file) => file.state === "done" || file.state === "error").length;
  const total = files.length;
  const pending = total - done;
  const complete = engineOnly
    ? engine.ready && !batch.error
    : batch.importComplete && done === total;
  const stopped = batch.aborted && !complete && !state.pumping;
  batch.completed = complete;
  $("progress-title").textContent = batch.error
    ? t("engine.error")
    : engineOnly
      ? t(complete ? "progress.engineReady" : "progress.startingEngine")
      : t(complete ? "progress.done" : "progress.title");
  $("progress-source").textContent = engineOnly ? "" : batch.source || "";
  const progress = $("progress-bar");
  const percent = engineOnly
    ? Math.max(0, Math.min(100, complete ? 100 : state.engineProgress.percent || 0))
    : total
      ? Math.round(((complete ? total : done) / total) * 100)
      : 100;
  const indeterminate = engineOnly && state.engineProgress.indeterminate && !complete && !batch.error;
  progress.classList.toggle("is-indeterminate", indeterminate);
  $("progress-fill").style.width = `${percent}%`;
  progress.setAttribute("aria-valuemax", "100");
  if (indeterminate) progress.removeAttribute("aria-valuenow");
  else progress.setAttribute("aria-valuenow", String(percent));
  $("progress-percent").textContent = t("progress.percent", { percent });
  $("progress-value").textContent = engineOnly
    ? ""
    : total
      ? t("progress.value", { done: complete ? total : done, total })
      : t("progress.noNewFiles");
  $("progress-estimate").hidden = !engineOnly;
  const stage = state.engineProgress.stage;
  $("progress-stage").textContent = engineOnly || !engine.ready
    ? stage === "packages"
      ? t("progress.stagePackages")
      : stage === "algorithm"
        ? t("progress.stageAlgorithm", { version: state.engineProgress.version || engine.version || "" })
        : t("progress.stagePyodide")
    : t("progress.engineReady");
  $("progress-detected").textContent = String(counts.detected);
  $("progress-review").textContent = String(counts.uncertain);
  $("progress-not-detected").textContent = String(counts.not_detected);
  $("progress-unsuitable").textContent = String(counts.unsuitable);
  $("progress-errors").textContent = String(counts.error);
  const skipped = $("progress-skipped");
  const extText = Object.entries(batch.formatExtCounts || {})
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ext, count]) => `${count} ${ext}`)
    .join(", ") || [...batch.formatExts].sort().join(", ");
  skipped.hidden = !batch.duplicateSkipped && !batch.formatSkipped;
  skipped.textContent = skipped.hidden
    ? ""
    : [
        batch.duplicateSkipped ? t("toolbar.duplicates", { n: batch.duplicateSkipped }) : "",
        batch.formatSkipped
          ? t("toolbar.unsupported", { n: batch.formatSkipped, details: extText })
          : "",
      ].filter(Boolean).join(" · ");
  skipped.dataset.tooltipKey = "tip.skipped";
  // A folder dropped before the engine is up is not stuck, it is waiting. Say so.
  const engineText = !engine.ready
    ? t("progress.waitingEngine")
    : t("progress.engine", { status: t(state.engineStatus.key, state.engineStatus.params) });
  $("progress-engine").textContent = engineOnly ? "" : engineText;
  $("progress-validation").hidden = !state.paramsOverride;
  $("progress-abort").hidden = engineOnly || complete || stopped || !!batch.error;
  $("progress-note").hidden = !stopped;
  $("progress-note").textContent = stopped ? t("progress.aborted", { n: pending }) : "";
  $("progress-error").hidden = !batch.error;
  $("progress-error").textContent = batch.error || "";
  $("progress-retry").hidden = !batch.error;
  $("progress-cdn").hidden = !batch.error;
  if ((complete || stopped) && !batch.error) scheduleProgressClose();
}

// ---------------------------------------------------------------- file ingest

function folderMeta(name, origin = "import") {
  if (!state.folders.has(name)) {
    state.folders.set(name, {
      open: true,
      origin,
      skipped: 0,
      exts: "",
      extsSet: new Set(),
      extCounts: {},
    });
  }
  return state.folders.get(name);
}

function extensionOf(name) {
  const m = /\.[^.]+$/.exec(name);
  return m ? m[0].toLowerCase() : t("common.none");
}

// A file we cannot read is counted, never silently dropped. Folder counts live on the
// folder node, loose ones next to the file counter in the toolbar.
function noteSkipped(name, folder, batch) {
  if (!name) return;
  if (folder) {
    const meta = folderMeta(folder);
    meta.skipped = (meta.skipped || 0) + 1;
    const ext = extensionOf(name);
    meta.extsSet.add(ext);
    meta.extCounts = meta.extCounts || {};
    meta.extCounts[ext] = (meta.extCounts[ext] || 0) + 1;
    meta.exts = [...meta.extsSet].sort().join(", ");
  } else {
    const ext = extensionOf(name);
    state.skipped.count += 1;
    state.skipped.extsSet.add(ext);
    state.skipped.extCounts = state.skipped.extCounts || {};
    state.skipped.extCounts[ext] = (state.skipped.extCounts[ext] || 0) + 1;
    state.skipped.exts = [...state.skipped.extsSet].sort().join(", ");
  }
  if (batch) {
    const ext = extensionOf(name);
    batch.formatSkipped += 1;
    batch.formatExts.add(ext);
    batch.formatExtCounts = batch.formatExtCounts || {};
    batch.formatExtCounts[ext] = (batch.formatExtCounts[ext] || 0) + 1;
  }
  if (/\.nox$/i.test(name)) {
    $("live-results").textContent = t("files.noxSkipped", { name });
  }
}

// Files arrive as {blob, path}. path is the location inside the dropped folder and
// keeps two same-named measurements in different subfolders apart.
async function addFiles(items, source) {
  const batch = beginProgress(source || t("progress.files", { n: items.length }));
  let added = 0;
  const knownHashes = new Set(state.files.map((file) => file.sha256).filter(Boolean));
  for (const item of items) {
    const blob = item.blob;
    const folder = item.folder || null;
    if (!SUPPORTED.test(blob.name)) {
      noteSkipped(blob.name, folder, batch);
      continue;
    }
    const buf = await blob.arrayBuffer();
    const sha = await sha256Hex(buf);
    if (knownHashes.has(sha)) {
      state.duplicateSkipped += 1;
      batch.duplicateSkipped += 1;
      continue;
    }
    knownHashes.add(sha);
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
    batch.fileIds.push(file.id);
    added += 1;
    if (!state.selectedId) state.selectedId = file.id;
  }
  for (const item of items) {
    if (item.folder) folderMeta(item.folder).open = true;
  }
  batch.importComplete = true;
  persist();
  renderAll();
  paintProgress();
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
  const items = [];
  const sources = [];
  for (const entry of entries) {
    if (entry.isDirectory) {
      sources.push(entry.name);
      const out = [];
      await walkEntry(entry, "", out);
      // walkEntry prefixes with the root name; strip it so paths read from the node down.
      const inside = out.map((item) => ({
        blob: item.blob,
        folder: entry.name,
        path: item.path.startsWith(entry.name + "/")
          ? item.path.slice(entry.name.length + 1)
          : item.path,
      }));
      items.push(...inside);
    } else if (entry.isFile) {
      const blob = await new Promise((resolve, reject) => entry.file(resolve, reject));
      items.push({ blob, folder: null });
    }
  }
  const source = sources.length === 1
    ? sources[0]
    : t("progress.files", { n: items.length });
  await addFiles(items, source);
}

// webkitdirectory gives every file a webkitRelativePath like "Neutrale/sub/a.txt".
async function ingestDirectoryInput(fileList) {
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
  const items = [];
  for (const [root, grouped] of byRoot) {
    items.push(...grouped.map((item) => ({ ...item, folder: root || null })));
  }
  const roots = [...byRoot.keys()].filter(Boolean);
  await addFiles(items, roots.length === 1 ? roots[0] : t("progress.files", { n: items.length }));
}

// ---------------------------------------------------------------- analysis queue

async function analyzeOne(file) {
  const started = performance.now();
  const paramsAtStart = state.paramsOverride
    ? JSON.parse(JSON.stringify(state.paramsOverride))
    : null;
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
  file.paramsOverride = paramsAtStart;
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
      // Stop after the current file: the rest stays queued and Recompute all resumes it.
      if (state.abort) {
        if (state.progress) state.progress.aborted = true;
        break;
      }
      const next = state.files.find((f) => f.state === "queued" && f.bytes);
      if (!next) break;
      next.state = "running";
      const done = state.files.filter((f) => f.state === "done" || f.state === "error").length + 1;
      setStatus("engine.analysing", { done, total: state.files.length }, true);
      renderSidebarNow();
      paintProgress();
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
      paintProgress();
      if (state.view === "table" || next.id === state.selectedId) renderContent();
    }
    readyStatus();
    persist();
    // The result on screen can depend on files other than itself, for instance on how
    // many are still waiting for review, so it is repainted once the queue is empty.
    renderContent();
  } finally {
    state.pumping = false;
    paintProgress();
  }
}

function abortQueue() {
  state.abort = true;
  if (state.progress) state.progress.aborted = true;
  paintProgress();
}

function requeueAll(source) {
  if (!state.files.length) return;
  const batch = beginProgress(source || t("progress.allFiles", { n: state.files.length }));
  state.abort = false;
  for (const file of state.files) {
    if (file.bytes) {
      file.state = "queued";
      file.error = null;
      batch.fileIds.push(file.id);
    }
  }
  batch.importComplete = true;
  renderAll();
  paintProgress();
  pump();
}

// Detect again: back to the automatic reading of this one file. A saved expert
// correction is not lost, it moves into the history instead of masking the new result.
function redetect(file) {
  cancelPick(false);
  state.manualPicked.clear();
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

// ---------------------------------------------------------------- session removal and undo

function cloneFolders() {
  return new Map(
    [...state.folders.entries()].map(([name, meta]) => [
      name,
      {
        ...meta,
        extsSet: new Set(meta.extsSet || []),
        extCounts: { ...(meta.extCounts || {}) },
      },
    ])
  );
}

function folderNameExists(name, except = "") {
  const folded = name.trim().toLocaleLowerCase();
  return [...state.folders.keys()].some(
    (current) => current !== except && current.toLocaleLowerCase() === folded
  );
}

function createFolder(name) {
  const clean = name.trim();
  if (!clean || folderNameExists(clean)) return false;
  folderMeta(clean, "user");
  persist();
  renderAll();
  return true;
}

function renameFolder(oldName, newName) {
  const clean = newName.trim();
  if (!clean || folderNameExists(clean, oldName)) return false;
  const renamed = new Map();
  for (const [name, meta] of state.folders) {
    renamed.set(name === oldName ? clean : name, meta);
  }
  state.folders = renamed;
  for (const file of state.files) {
    if (file.folder === oldName) file.folder = clean;
  }
  persist();
  renderAll();
  return true;
}

function moveFilesToFolder(ids, folder) {
  const wanted = new Set(ids);
  if (folder) folderMeta(folder, "user");
  let changed = false;
  for (const file of state.files) {
    if (wanted.has(file.id) && file.folder !== folder) {
      file.folder = folder || null;
      changed = true;
    }
  }
  if (!changed) return;
  persist();
  renderAll();
}

function deleteFolder(name) {
  const files = state.files.filter((file) => file.folder === name);
  askConfirmation(
    {
      title: t("folder.deleteTitle"),
      message: t("folder.deleteMessage", { name, n: files.length }),
      accept: t("folder.deleteAccept"),
    },
    () => {
      for (const file of files) file.folder = null;
      state.folders.delete(name);
      persist();
      renderAll();
    }
  );
}

function closeMoveMenu() {
  moveSelection = null;
  if ($("move-menu").open) $("move-menu").close();
}

function openMoveMenu(ids, label, anchorOrPoint) {
  moveSelection = [...ids];
  $("move-menu-title").textContent = t("folder.moveTitle", { name: label });
  const list = $("move-menu-list");
  list.innerHTML = "";
  // A sample is a group of files, so its context menu can select the whole group.
  if (ids.length > 1) {
    const all = document.createElement("button");
    all.type = "button";
    all.setAttribute("role", "menuitem");
    all.id = "move-menu-select-all";
    all.textContent = t("sidebar.selectSample");
    all.addEventListener("click", () => {
      const chosen = [...ids];
      closeMoveMenu();
      selectFiles(chosen);
    });
    list.appendChild(all);
    list.appendChild(document.createElement("hr"));
  }
  const choices = [[null, t("folder.outside")], ...[...state.folders.keys()].map((name) => [name, name])];
  for (const [folder, text] of choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "menuitem");
    button.textContent = text;
    button.addEventListener("click", () => {
      moveFilesToFolder(moveSelection || [], folder);
      closeMoveMenu();
    });
    list.appendChild(button);
  }
  const dialog = $("move-menu");
  if (dialog.open) dialog.close();
  dialog.show();
  const point = anchorOrPoint instanceof Element
    ? (() => {
        const rect = anchorOrPoint.getBoundingClientRect();
        return { x: rect.right, y: rect.bottom };
      })()
    : anchorOrPoint;
  requestAnimationFrame(() => {
    const rect = dialog.getBoundingClientRect();
    const left = Math.max(8, Math.min(point?.x || 8, innerWidth - rect.width - 8));
    const top = Math.max(8, Math.min(point?.y || 8, innerHeight - rect.height - 8));
    dialog.style.left = `${left}px`;
    dialog.style.top = `${top}px`;
    list.querySelector("button")?.focus();
  });
}

function askConfirmation({ title, message, accept, destructive = true }, action) {
  confirmAction = action;
  $("confirm-title").textContent = title;
  $("confirm-message").textContent = message;
  $("confirm-accept").textContent = accept;
  $("confirm-accept").classList.toggle("destructive", destructive);
  $("confirm-dialog").showModal();
}

function hideUndo() {
  clearTimeout(undoTimer);
  if (undoDismiss) {
    document.removeEventListener("pointerdown", undoDismiss, true);
    document.removeEventListener("keydown", undoDismiss, true);
    undoDismiss = null;
  }
  state.undo = null;
  $("undo-toast").hidden = true;
}

// The bar waits for the next thing the operator does, not for a stopwatch, because a
// deletion noticed ten seconds later is exactly the one worth taking back. One minute
// is the ceiling, so an abandoned screen does not keep an undo alive forever.
function armUndoDismiss() {
  const dismiss = (ev) => {
    if (ev && $("undo-toast").contains(ev.target)) return;
    hideUndo();
  };
  undoDismiss = dismiss;
  setTimeout(() => {
    if (undoDismiss !== dismiss) return;
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("keydown", dismiss, true);
  }, 0);
}

function showUndo(label, removed, foldersBefore, selectedBefore) {
  hideUndo();
  state.undo = { removed, foldersBefore, selectedBefore };
  $("undo-message").textContent = removed.length === 1
    ? t("session.removed", { name: label })
    : t("session.removedMany", { n: removed.length, name: label });
  $("undo-toast").hidden = false;
  undoTimer = setTimeout(hideUndo, UNDO_MAX_MS);
  armUndoDismiss();
}

function performRemove(ids, label) {
  const wanted = new Set(ids);
  const removed = state.files
    .map((file, index) => ({ file, index }))
    .filter(({ file }) => wanted.has(file.id));
  if (!removed.length) return;
  const foldersBefore = cloneFolders();
  const selectedBefore = state.selectedId;
  const selectedIndex = state.files.findIndex((file) => file.id === state.selectedId);
  state.files = state.files.filter((file) => !wanted.has(file.id));
  if (wanted.has(state.selectedId)) {
    const nextIndex = Math.min(Math.max(selectedIndex, 0), state.files.length - 1);
    state.selectedId = nextIndex >= 0 ? state.files[nextIndex].id : null;
    state.previewExpert = null;
    cancelPick(false);
    state.manualPicked.clear();
  }
  showUndo(label, removed, foldersBefore, selectedBefore);
  persist();
  renderAll();
  paintProgress();
}

function removeFiles(ids, label) {
  if (ids.length > 1) {
    askConfirmation(
      {
        title: t("session.removeGroupTitle"),
        message: t("session.removeGroupMessage", { n: ids.length, name: label }),
        accept: t("session.removeGroupAccept"),
      },
      () => performRemove(ids, label)
    );
    return;
  }
  performRemove(ids, label);
}

function undoRemove() {
  if (!state.undo) return;
  const { removed, foldersBefore, selectedBefore } = state.undo;
  for (const entry of [...removed].sort((a, b) => a.index - b.index)) {
    state.files.splice(Math.min(entry.index, state.files.length), 0, entry.file);
  }
  state.folders = foldersBefore;
  state.selectedId = selectedBefore && state.files.some((file) => file.id === selectedBefore)
    ? selectedBefore
    : removed[0]?.file.id || state.files[0]?.id || null;
  hideUndo();
  persist();
  renderAll();
}

async function clearSession() {
  clearTimeout(persistTimer);
  clearTimeout(undoTimer);
  closeProgress();
  resetStateForPayload();
  state.progress = null;
  state.filter = "all";
  state.search = "";
  await deleteSession();
  await refreshSessions();
  renderAll();
}

function confirmClearSession() {
  const n = state.files.length;
  if (!n) return;
  askConfirmation(
    {
      title: t("session.clearTitle"),
      message: t("session.clearMessage", { n }),
      accept: t("session.clearAccept"),
    },
    () => clearSession().catch(() => {})
  );
}


// ---------------------------------------------------------------- named sessions

function showChoice({ title, message, first, second }, onFirst, onSecond) {
  choiceActions = { onFirst, onSecond };
  $("choice-title").textContent = title;
  $("choice-message").textContent = message;
  $("choice-first").textContent = first || "";
  $("choice-first").hidden = !first;
  $("choice-second").textContent = second || "";
  $("choice-second").hidden = !second;
  $("choice-cancel").textContent = first || second ? t("session.keep") : t("common.close");
  $("choice-dialog").showModal();
}

// A refusal has to be seen, not whispered into the live region, so it uses the same
// dialog with no action buttons at all.
function showNotice(title, message) {
  showChoice({ title, message, first: "", second: "" }, null, null);
}

function sessionRowText(entry) {
  return t("session.rowStats", {
    n: entry.files,
    size: formatBytes(entry.bytes),
    when: new Date(entry.updatedAt).toLocaleString(locale(), {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
  });
}

async function refreshSessions() {
  const [info, all] = await Promise.all([currentSessionInfo(), listSessions()]);
  state.session = { id: info.id, name: info.name };
  state.sessions = all;
  paintSessionMenu();
}

// One saved session, one line: a dot for the current one, the name clipped with an
// ellipsis, the numbers underneath, and three icon actions on the right. Text buttons
// wrapped the name onto a second line and made the menu scroll sideways.
const SESSION_ICONS = {
  open:
    '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" d="M2 4.2h4.2l1.2 1.5H14v6.6H2z"/></svg>',
  rename:
    '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" d="m10.5 2.5 3 3-8 8-3.5.5.5-3.5z"/></svg>',
  remove:
    '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M3 4.5h10M6 2.5h4l.5 2H5.5l.5-2ZM4.5 4.5l.6 9h5.8l.6-9"/></svg>',
};

function sessionActionButton(icon, labelKey, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "session-action";
  button.innerHTML = icon;
  button.setAttribute("aria-label", t(labelKey));
  button.dataset.tooltipKey = labelKey;
  button.addEventListener("click", onClick);
  return button;
}

function deleteSessionRow(entry) {
  askConfirmation(
    {
      title: t("session.deleteTitle"),
      message: t("session.deleteMessage", { name: entry.name, n: entry.files }),
      accept: t("session.deleteAccept"),
    },
    async () => {
      const wasCurrent = entry.id === state.session.id;
      await removeSession(entry.id);
      if (wasCurrent) {
        applyPayload(null);
        await refreshSessions();
        renderAll();
      } else {
        await refreshSessions();
      }
    }
  );
}

function paintSessionMenu() {
  const nameField = $("session-name");
  if (document.activeElement !== nameField) nameField.value = state.session.name || "";
  const list = $("session-list");
  list.innerHTML = "";
  for (const entry of state.sessions) {
    const isCurrent = entry.id === state.session.id;
    const row = document.createElement("div");
    row.className = "session-row" + (isCurrent ? " is-current" : "");
    const open = document.createElement("button");
    open.type = "button";
    open.setAttribute("role", "menuitem");
    open.className = "session-open";
    const nameLine = document.createElement("span");
    nameLine.className = "session-name-line";
    if (isCurrent) {
      const dot = document.createElement("span");
      dot.className = "session-dot";
      dot.setAttribute("role", "img");
      dot.setAttribute("aria-label", t("session.current"));
      nameLine.appendChild(dot);
    }
    const name = document.createElement("strong");
    name.className = "session-name";
    name.textContent = entry.name;
    name.title = entry.name;
    nameLine.appendChild(name);
    const stats = document.createElement("span");
    stats.className = "muted session-meta";
    stats.textContent = sessionRowText(entry);
    open.append(nameLine, stats);
    open.disabled = isCurrent;
    open.addEventListener("click", () => switchSession(entry.id));

    const actions = document.createElement("span");
    actions.className = "session-row-actions";
    const openAction = sessionActionButton(SESSION_ICONS.open, "session.open", () =>
      switchSession(entry.id)
    );
    openAction.disabled = isCurrent;
    const rename = sessionActionButton(SESSION_ICONS.rename, "session.rename", () =>
      startRowRename(row, open, entry)
    );
    const remove = sessionActionButton(SESSION_ICONS.remove, "session.delete", () =>
      deleteSessionRow(entry)
    );
    actions.append(openAction, rename, remove);
    row.append(open, actions);
    list.appendChild(row);
  }
}

// Renaming happens in place in the row, never through window.prompt.
function startRowRename(row, openButton, entry) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "session-rename-input";
  input.value = entry.name;
  input.setAttribute("aria-label", t("session.nameLabel"));
  let closed = false;
  const finish = async (save) => {
    if (closed) return;
    closed = true;
    const next = input.value.trim();
    input.remove();
    openButton.hidden = false;
    if (save && next && next !== entry.name) {
      await renameSession(entry.id, next);
      await refreshSessions();
    }
  };
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") finish(true);
    if (event.key === "Escape") finish(false);
  });
  input.addEventListener("blur", () => finish(true), { once: true });
  openButton.hidden = true;
  row.insertBefore(input, row.firstChild);
  queueMicrotask(() => {
    input.focus();
    input.select();
  });
}

async function switchSession(id) {
  clearTimeout(persistTimer);
  const record = await openSessionById(id);
  if (!record) return;
  applyPayload(record.payload);
  await refreshSessions();
  renderAll();
  pump();
}

async function newSession() {
  clearTimeout(persistTimer);
  await createSession(defaultSessionName());
  applyPayload(null);
  await refreshSessions();
  renderAll();
}

async function saveSessionToFile() {
  const payload = sessionPayload();
  const data = buildSessionFile({
    name: state.session.name,
    payload,
    appVersion: APP_VERSION,
    algoVersion: engine.version,
    algoSha: engine.sha256,
    paramsOverride: state.paramsOverride,
  });
  const approxBytes = payload.files.reduce(
    (sum, file) => sum + Math.ceil((Number(file.sizeBytes) || 0) * 1.37),
    0
  );
  const write = () => {
    const bytes = downloadSessionFile(data, state.session.name);
    $("live-results").textContent = t("session.fileWritten", { size: formatBytes(bytes) });
  };
  if (approxBytes > SESSION_FILE_WARN_BYTES) {
    showChoice(
      {
        title: t("session.bigTitle"),
        message: t("session.bigMessage", { size: formatBytes(approxBytes) }),
        first: t("session.bigAccept"),
      },
      write
    );
    return;
  }
  write();
}

async function loadSessionFromFile(file) {
  const text = await file.text();
  const parsed = await readSessionFile(text);
  if (!parsed.ok) {
    if (parsed.reason === "format") {
      showNotice(t("session.fileRefusedTitle"), t("session.fileBadFormat", { found: parsed.found || "?" }));
    } else {
      showNotice(
        t("session.fileRefusedTitle"),
        t("session.fileBadSha", { n: parsed.bad.length, names: parsed.bad.join(", ") })
      );
    }
    return;
  }
  const useAsCurrent = async () => {
    clearTimeout(persistTimer);
    applyPayload(parsed.payload);
    await saveSession(sessionPayload());
    await renameSession(state.session.id, parsed.name);
    await refreshSessions();
    renderAll();
  };
  const useAsNew = async () => {
    clearTimeout(persistTimer);
    await createSession(parsed.name);
    applyPayload(parsed.payload);
    await saveSession(sessionPayload());
    await refreshSessions();
    renderAll();
  };
  showChoice(
    {
      title: t("session.loadTitle"),
      message: t("session.loadMessage", { name: parsed.name, n: parsed.payload.files.length }),
      first: t("session.loadReplace"),
      second: t("session.loadAsNew"),
    },
    useAsCurrent,
    useAsNew
  );
}

// ---------------------------------------------------------------- session analysis parameters

function constantsForFile(file) {
  return {
    ...(engine.defaultConstants || engine.constants || {}),
    ...(file?.paramsOverride || {}),
  };
}

function setParamInputs(constants) {
  const c = constants || {};
  $("param-detected").value = c.DETECTION_TOLERANCE_V == null ? "" : c.DETECTION_TOLERANCE_V * 1000;
  $("param-review").value = c.UNCERTAIN_TOLERANCE_V == null ? "" : c.UNCERTAIN_TOLERANCE_V * 1000;
  $("param-target").value = c.AMPHETAMINE_TARGET_DELTA_V ?? "";
  $("param-pos-from").value = c.WIN_TPRA_POS_RAW?.[0] ?? "";
  $("param-pos-to").value = c.WIN_TPRA_POS_RAW?.[1] ?? "";
  $("param-neg-from").value = c.WIN_TPRA_NEG_RAW?.[0] ?? "";
  $("param-neg-to").value = c.WIN_TPRA_NEG_RAW?.[1] ?? "";
}

function paintParamsMode() {
  $("analysis-params-mode").textContent = t(
    state.paramsOverride ? "analysisParams.customState" : "analysisParams.defaultState"
  );
  $("params-reset").disabled = !engine.ready || !state.paramsOverride;
  paintParamsBar();
  paintParamsErrors();
}

// The section belongs to expert mode. In the ordinary mode the thresholds are what the
// loaded algorithm version says they are, and there is nothing to touch.
function paintExpertUi() {
  $("analysis-params").hidden = !state.expertMode;
  if (!state.expertMode) $("analysis-params").open = false;
}

function mvText(value) {
  return String(Math.round(Number(value) * 1000 * 10) / 10);
}

// A standing bar, not a badge that scrolls away: while custom parameters are in force
// every screen says so, and offers the way back.
function paintParamsBar() {
  const bar = $("params-bar");
  const overrides = state.paramsOverride;
  bar.hidden = !overrides;
  if (!overrides) return;
  $("params-bar-text").textContent = t("params.bar", {
    detected: mvText(overrides.DETECTION_TOLERANCE_V),
    review: mvText(overrides.UNCERTAIN_TOLERANCE_V),
    target: Number(overrides.AMPHETAMINE_TARGET_DELTA_V).toLocaleString(locale(), {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }),
  });
  bar.setAttribute("aria-label", t("params.barLabel"));
}

const PARAM_IDS = [
  "param-detected",
  "param-review",
  "param-target",
  "param-pos-from",
  "param-pos-to",
  "param-neg-from",
  "param-neg-to",
];

function numberOf(id) {
  const raw = $(id).value.trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

// Hard limits, with the reason under the field that broke them. Nothing is applied
// until every field is inside its range.
function validateParams() {
  const errors = { detected: "", review: "", target: "", pos: "", neg: "" };
  const values = {
    detected: numberOf("param-detected"),
    review: numberOf("param-review"),
    target: numberOf("param-target"),
    posFrom: numberOf("param-pos-from"),
    posTo: numberOf("param-pos-to"),
    negFrom: numberOf("param-neg-from"),
    negTo: numberOf("param-neg-to"),
  };
  const missing = Object.values(values).some((value) => value == null);
  const [tolMin, tolMax] = LIMITS.toleranceMv;
  const [targetMin, targetMax] = LIMITS.targetV;
  const [winMin, winMax] = LIMITS.windowV;
  if (values.detected != null && (values.detected < tolMin || values.detected > tolMax)) {
    errors.detected = t("analysisParams.errorDetectedRange");
  }
  if (
    values.review != null &&
    (values.review > tolMax || (values.detected != null && values.review < values.detected))
  ) {
    errors.review = t("analysisParams.errorReviewRange");
  }
  if (values.target != null && (values.target < targetMin || values.target > targetMax)) {
    errors.target = t("analysisParams.errorTargetRange");
  }
  for (const [key, from, to] of [["pos", values.posFrom, values.posTo], ["neg", values.negFrom, values.negTo]]) {
    if (from == null || to == null) continue;
    if (from < winMin || from > winMax || to < winMin || to > winMax) {
      errors[key] = t("analysisParams.errorWindowRange");
    } else if (from >= to) {
      errors[key] = t("analysisParams.errorWindows");
    } else if (to - from < LIMITS.windowWidthV) {
      errors[key] = t("analysisParams.errorWindowWidth");
    }
  }
  const ok = !missing && Object.values(errors).every((message) => !message);
  return { values, errors, ok, missing };
}

function paintParamsErrors() {
  const { errors, ok, missing } = validateParams();
  $("error-detected").textContent = errors.detected;
  $("error-review").textContent = errors.review;
  $("error-target").textContent = errors.target;
  $("error-pos").textContent = errors.pos;
  $("error-neg").textContent = errors.neg;
  $("params-apply").disabled = !engine.ready || !ok;
  for (const id of PARAM_IDS) {
    const field = $(id);
    const group = id.startsWith("param-pos") ? "pos" : id.startsWith("param-neg") ? "neg" : id.replace("param-", "");
    field.setAttribute("aria-invalid", errors[group] ? "true" : "false");
  }
}

function overridesFromForm(values) {
  return {
    DETECTION_TOLERANCE_V: values.detected / 1000,
    UNCERTAIN_TOLERANCE_V: values.review / 1000,
    AMPHETAMINE_TARGET_DELTA_V: values.target,
    WIN_TPRA_POS_RAW: [values.posFrom, values.posTo],
    WIN_TPRA_NEG_RAW: [values.negFrom, values.negTo],
  };
}

async function applyParams() {
  const { values, ok } = validateParams();
  if (!ok) {
    $("params-error").textContent = t("analysisParams.errorNumbers");
    paintParamsErrors();
    return;
  }
  try {
    const overrides = overridesFromForm(values);
    $("params-error").textContent = "";
    await engine.setParams(overrides);
    state.paramsOverride = JSON.parse(JSON.stringify(overrides));
    paintParamsMode();
    renderContent();
    requeueAll(t("progress.parametersChanged"));
  } catch (err) {
    $("params-error").textContent = err.message || String(err);
  }
}

async function resetParams() {
  try {
    $("params-error").textContent = "";
    await engine.setParams(null);
    state.paramsOverride = null;
    setParamInputs(engine.defaultConstants);
    paintParamsMode();
    renderContent();
    requeueAll(t("progress.parametersReset"));
  } catch (err) {
    $("params-error").textContent = err.message || String(err);
  }
}

// ---------------------------------------------------------------- manual points

function currentResult(file) {
  return state.previewExpert || file?.expert || file?.auto || null;
}

function rawPoint(result, key) {
  const value = result["E" + key + "_raw"] ?? result.points?.[key]?.E;
  return value == null ? null : Number(value);
}

function pointsFromResult(result) {
  const out = {};
  for (const key of ["1", "2", "3", "4"]) {
    const raw = rawPoint(result, key);
    if (raw != null) out["E" + key] = raw;
  }
  return out;
}

// Pointing mode. The program never guesses where a missing peak is: the technician
// clicks it on the curve or types its potential, and only then does the analysis run.
function beginPick(kind) {
  const file = selectedFile();
  const result = file && currentResult(file);
  if (!file || !result || !engine.ready) return;
  if (!state.expertMode) {
    state.expertMode = true;
    $("expert-mode").checked = true;
    paintExpertUi();
  }
  const queue = kind === "standard" ? ["1", "2", "3", "4"] : ["3", "4"];
  state.manualDraft = { ...pointsFromResult(result) };
  for (const key of queue) delete state.manualDraft["E" + key];
  state.pick = { kind, queue, index: 0, key: queue[0] };
  renderContent();
}

function cancelPick(announce) {
  if (!state.pick) return;
  state.pick = null;
  state.manualDraft = null;
  if (announce) $("live-results").textContent = t("peaks.pickCancelled");
  renderContent();
}

function completeManual(manual) {
  if (["1", "2", "3", "4"].every((key) => manual["E" + key] != null)) {
    state.manualDraft = null;
    runManual(manual);
    return;
  }
  state.manualDraft = manual;
  renderContent();
}

function pickPoint(rawValue) {
  const pick = state.pick;
  if (!pick) return;
  const key = pick.key;
  const draft = { ...(state.manualDraft || {}) };
  draft["E" + key] = rawValue;
  state.manualPicked.add(key);
  state.manualDraft = draft;
  $("live-results").textContent = t("peaks.pickDone", { n: key, value: rawValue.toFixed(3) });
  const nextIndex = pick.index + 1;
  if (nextIndex < pick.queue.length) {
    state.pick = { ...pick, index: nextIndex, key: pick.queue[nextIndex] };
    renderContent();
    return;
  }
  state.pick = null;
  completeManual(draft);
}

// The number field is the keyboard road to the same place as a drag (WCAG 2.2).
function setPointValue(key, displayValue) {
  const file = selectedFile();
  const result = file && currentResult(file);
  if (!file || !result || !engine.ready) return;
  const shift = state.calibrated ? Number(result.shift) || 0 : 0;
  const manual = { ...pointsFromResult(result), ...(state.manualDraft || {}) };
  manual["E" + key] = displayValue - shift;
  state.manualPicked.add(key);
  completeManual(manual);
}

// A point the algorithm never found and the technician never pointed at cannot be
// saved as an expert reading.
function manualGap(file, result) {
  for (const key of ["1", "2", "3", "4"]) {
    if (rawPoint(result, key) == null) return key;
    const fromAlgorithm = file.auto && rawPoint(file.auto, key) != null;
    if (!fromAlgorithm && !state.manualPicked.has(key)) return key;
  }
  return null;
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
    selectedIds: state.selectedIds,
    onSelect: (id, mods) => {
      if (window.matchMedia(NARROW).matches && !mods?.toggle && !mods?.range) closeDrawer();
      selectFile(id, mods);
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
    onRenameSample: (oldId, next, ids = []) => {
      const wanted = new Set(ids);
      for (const file of state.files) {
        if ((wanted.size ? wanted.has(file.id) : file.sampleId === oldId)) {
          file.sampleId = next;
          file.sampleIdManual = true;
        }
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
    onRemoveFiles: (ids, label) => removeFiles(ids, label),
    onCreateFolder: createFolder,
    onRenameFolder: renameFolder,
    onDeleteFolder: deleteFolder,
    onMoveFiles: moveFilesToFolder,
    onMoveRequest: openMoveMenu,
    onImport: () => $("file-input").click(),
    onImportFolder: () => $("folder-input").click(),
  });
}

// What the import left out, as one sentence: how many files and in which formats.
// The counters themselves now live in the sidebar summary (addendum 2, point R).
function skippedSummaryText() {
  const formatSkipped = state.skipped.count + [...state.folders.values()]
    .reduce((sum, meta) => sum + (meta.skipped || 0), 0);
  const extCounts = {};
  for (const source of [state.skipped, ...state.folders.values()]) {
    for (const [ext, count] of Object.entries(source.extCounts || {})) {
      extCounts[ext] = (extCounts[ext] || 0) + count;
    }
  }
  const details = Object.entries(extCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ext, count]) => `${count} ${ext}`)
    .join(", ");
  const parts = [];
  if (state.duplicateSkipped) parts.push(t("toolbar.duplicates", { n: state.duplicateSkipped }));
  if (formatSkipped) parts.push(t("toolbar.unsupported", { n: formatSkipped, details }));
  return parts.join(" · ");
}

// The status bar under the toolbar (addendum 5, point HH): the file total on the
// left, four stat pills, the skipped note on the right. Every pill is a filter and
// shares `state.filter` with the filter list in the sidebar.
function statPill({ label, count, tone, tipKey, filter, fullWord }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "stat-pill tone-" + tone;
  button.dataset.filter = filter;
  button.dataset.tooltipKey = tipKey;
  button.setAttribute("aria-pressed", String(state.filter === filter));
  // Below 900 px the label is hidden, so the accessible name carries the whole word.
  button.setAttribute("aria-label", `${count} ${fullWord}`);
  const dot = document.createElement("span");
  dot.className = "stat-dot";
  const number = document.createElement("strong");
  number.className = "stat-count tabular";
  number.textContent = String(count);
  const text = document.createElement("span");
  text.className = "stat-label";
  text.textContent = label;
  button.append(dot, number, text);
  button.addEventListener("click", () => {
    state.filter = state.filter === filter ? "all" : filter;
    renderAll();
  });
  return button;
}

function paintSummaryBar() {
  const bar = $("summary-bar");
  const n = state.files.length;
  bar.innerHTML = "";
  bar.hidden = n === 0;
  if (!n) return;
  const counts = bucketCounts(state.files);
  const left = document.createElement("div");
  left.className = "summary-bar-left";

  const filesText = t("toolbar.files", { n });
  const filesWord = filesText.startsWith(String(n))
    ? filesText.slice(String(n).length).trim()
    : filesText;
  const total = document.createElement("span");
  total.className = "summary-total";
  const totalNumber = document.createElement("strong");
  totalNumber.className = "tabular";
  totalNumber.textContent = String(n);
  const totalWord = document.createElement("span");
  totalWord.className = "muted";
  totalWord.textContent = filesWord;
  total.append(totalNumber, totalWord);
  left.appendChild(total);

  for (const [filter, status, count, tone, tip] of [
    ["detected", "detected", counts.detected, "detected", "tip.verdict.detected"],
    ["review", "uncertain", counts.uncertain, "uncertain", "tip.verdict.uncertain"],
    ["not_detected", "not_detected", counts.not_detected, "not_detected", "tip.verdict.notDetected"],
    ["unsuitable", "MEASUREMENT_QUALITY_FAIL", counts.unsuitable, "quality", "tip.verdict.unsuitable"],
  ]) {
    left.appendChild(
      statPill({
        label: verdictInfo(status).short,
        fullWord: verdictInfo(status).word,
        count,
        tone,
        tipKey: tip,
        filter,
      })
    );
  }
  bar.appendChild(left);

  const skipped = skippedSummaryText();
  if (skipped) {
    const note = document.createElement("span");
    note.className = "summary-skipped muted";
    note.dataset.tooltipKey = "tip.skipped";
    note.textContent = skipped;
    bar.appendChild(note);
  }
}

function updateToolbar() {
  const n = state.files.length;
  paintSummaryBar();
  $("btn-analyze").disabled = !n || !engine.ready;
  $("session-clear").disabled = !n;
  $("app-ver").textContent = "v" + APP_VERSION;
  paintParamsMode();
  paintAnalysisStatus();
}

function renderEmpty() {
  if (chart) {
    chart.destroy();
    chart = null;
  }
  const content = $("content");
  content.innerHTML = "";
  const card = document.createElement("div");
  card.className = "empty-drop card";
  const p1 = document.createElement("p");
  p1.textContent = t("empty.drop");
  const actions = document.createElement("div");
  actions.className = "empty-actions";
  const files = document.createElement("button");
  files.type = "button";
  files.className = "primary empty-action";
  files.textContent = t("toolbar.addFiles");
  files.addEventListener("click", () => $("file-input").click());
  const folder = document.createElement("button");
  folder.type = "button";
  folder.className = "empty-action";
  folder.textContent = t("toolbar.addFolder");
  folder.addEventListener("click", () => $("folder-input").click());
  actions.append(files, folder);
  card.append(p1, actions);
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
  const message = String(err.message || err);
  if (!state.progress) beginEngineProgress(engine.version || "");
  state.progress.error = message;
  const dialog = $("batch-progress");
  if (!dialog.open) dialog.show();
  paintProgress();
}

async function retryEngine(useCdn) {
  const wanted = engine.version || new URLSearchParams(location.search).get("algo") || undefined;
  beginEngineProgress(wanted || "");
  try {
    await engine.retry({ useCdn });
  } catch (error) {
    showEngineError(error);
  }
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
    result._paramsOverride = state.paramsOverride
      ? JSON.parse(JSON.stringify(state.paramsOverride))
      : null;
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
  label.append(span, area);
  const actions = document.createElement("div");
  actions.className = "expert-actions";
  const save = document.createElement("button");
  save.type = "button";
  save.className = "primary";
  save.textContent = t("expert.save");
  // Saving needs a reason and a complete set of points that the algorithm found or the
  // technician pointed at. Until then the button says so by staying off.
  const refreshSave = () => {
    const candidate = state.previewExpert || file.expert;
    save.disabled = !state.reason.trim() || !candidate || !!manualGap(file, candidate);
  };
  area.addEventListener("input", (event) => {
    state.reason = event.target.value;
    refreshSave();
  });
  save.addEventListener("click", () => {
    if (!state.reason.trim()) {
      $("live-results").textContent = t("expert.needReason");
      return;
    }
    if (!state.previewExpert && !file.expert) {
      $("live-results").textContent = t("expert.needPoints");
      return;
    }
    const candidate = state.previewExpert || file.expert;
    const gap = manualGap(file, candidate);
    if (gap) {
      $("live-results").textContent = t("expert.needPicked", { n: gap });
      return;
    }
    const saved = candidate;
    const commit = () => {
      saved.mode = "manual";
      saved._reason = state.reason.trim();
      saved._operator = state.operator;
      saved._savedAtLabel = timeLabel();
      file.expert = saved;
      file.paramsOverride = saved._paramsOverride || null;
      file.revisions = file.revisions || [];
      file.revisions.push({
        at: new Date().toISOString(),
        mode: "manual",
        version: engine.version,
        status: saved.status,
      });
      state.previewExpert = null;
      state.manualPicked.clear();
      persist();
      renderAll();
    };
    // A point under the detector threshold does not block the expert, it is said out
    // loud before the correction is written.
    const constants = constantsForFile(file);
    const weak = belowThresholdPoints({ ...saved, mode: "manual" }, constants);
    if (weak.length) {
      askConfirmation(
        {
          title: t("expert.belowThresholdTitle"),
          message: t("expert.belowThresholdSave", {
            points: weak.join(", "),
            threshold: fmtNum(promThresholdUa(constants), 2),
          }),
          accept: t("expert.belowThresholdAccept"),
          destructive: false,
        },
        commit
      );
      return;
    }
    commit();
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
  refreshSave();
  return host;
}

// The next file still waiting for a human eye, in list order.
function nextReviewId(file) {
  const queue = state.files.filter((f) => displayResult(f)?.status === "uncertain");
  if (queue.length < 2) return null;
  const index = queue.findIndex((f) => f.id === file.id);
  const next = index < 0 ? queue[0] : queue[(index + 1) % queue.length];
  return next && next.id !== file.id ? next.id : null;
}

// Selecting a file from anywhere (the list, the arrows, the table, Next for review)
// has to show it in the list as well: the folder opens, the sample unfolds and the
// row scrolls into sight, so the highlight never stays on the file you left.
function revealSelected() {
  const file = selectedFile();
  if (!file) return;
  if (file.folder) {
    const meta = folderMeta(file.folder);
    if (!meta.open) meta.open = true;
  }
  state.closedSamples.delete(`${file.folder || ""}::${file.sampleId}`);
}

function scrollSelectedIntoView() {
  const row = $("sidebar").querySelector(".file-item.is-selected");
  if (row) row.scrollIntoView({ block: "nearest" });
}

// The order the list shows right now, which is what a Shift range means to a human.
function visibleFileIds() {
  return [...$("sidebar").querySelectorAll(".file-item")].map((node) => node.dataset.fileId);
}

function applySelection(id, { toggle = false, range = false } = {}) {
  if (toggle) {
    const next = new Set(state.selectedIds);
    if (next.has(id) && next.size > 1) next.delete(id);
    else next.add(id);
    state.selectedIds = next;
    if (!next.has(state.selectedId)) state.selectedId = [...next][0] || id;
    else if (next.has(id)) state.selectedId = id;
    return;
  }
  if (range && state.selectedId && state.selectedId !== id) {
    const order = visibleFileIds();
    const from = order.indexOf(state.selectedId);
    const to = order.indexOf(id);
    if (from >= 0 && to >= 0) {
      const [lo, hi] = from < to ? [from, to] : [to, from];
      state.selectedIds = new Set(order.slice(lo, hi + 1));
      state.selectedId = id;
      return;
    }
  }
  state.selectedIds = new Set([id]);
  state.selectedId = id;
}

function selectFile(id, mods) {
  applySelection(id, mods);
  state.previewExpert = null;
  cancelPick(false);
  state.manualPicked.clear();
  revealSelected();
  renderAll();
  scrollSelectedIntoView();
}

// Selecting a whole sample from its context menu.
function selectFiles(ids) {
  if (!ids.length) return;
  state.selectedIds = new Set(ids);
  if (!state.selectedIds.has(state.selectedId)) state.selectedId = ids[0];
  state.previewExpert = null;
  cancelPick(false);
  state.manualPicked.clear();
  revealSelected();
  renderAll();
  scrollSelectedIntoView();
}

function selectedFiles() {
  const chosen = state.files.filter((file) => state.selectedIds.has(file.id));
  return chosen.length ? chosen : state.files.filter((file) => file.id === state.selectedId);
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
  const shown = currentResult(file);
  const shift = shown && state.calibrated ? Number(shown.shift) || 0 : 0;
  const draft = state.manualDraft
    ? Object.fromEntries(
        ["1", "2", "3", "4"].map((key) => [
          key,
          state.manualDraft["E" + key] == null ? null : state.manualDraft["E" + key] + shift,
        ])
      )
    : null;
  const nextId = shown ? nextReviewId(file) : null;
  chart = renderResult(content, {
    file,
    result: shown,
    constants: constantsForFile(file),
    algoVersion: file.algoVersion || engine.version,
    algoSha: file.algoSha || engine.sha256,
    calibrated: state.calibrated,
    markers: state.markers,
    expert: state.expertMode,
    operator: state.operator,
    paramsCustom: !!file.paramsOverride,
    pick: state.pick,
    draft,
    onNextReview: nextId ? () => selectFile(nextId) : null,
    onPick: (kind) => beginPick(kind),
    onPickPoint: (raw) => pickPoint(raw),
    onPointInput: (key, value) => setPointValue(key, value),
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
    onRemove: () => removeFiles([file.id], file.name),
    onEdit: () => {
      state.expertMode = !state.expertMode;
      $("expert-mode").checked = state.expertMode;
      if (!state.expertMode) cancelPick(false);
      paintExpertUi();
      renderContent();
    },
    onManual: (manual) => runManual(manual),
  });
}

// Several files at once. The compact cards and the comparison chart live in
// ui/multi.js; this only feeds them state and keeps their charts destroyable.
let multiCharts = [];

function destroyMultiCharts() {
  for (const chart of multiCharts) chart.destroy();
  multiCharts = [];
}

function renderMultiView() {
  if (chart) {
    chart.destroy();
    chart = null;
  }
  const files = state.files.filter((file) => state.selectedIds.has(file.id));
  multiCharts = renderMulti($("content"), {
    files,
    activeId: state.selectedId,
    constants: constantsForFile(selectedFile()),
    calibrated: state.calibrated,
    markers: state.markers,
    compare: state.compareView,
    expert: state.expertMode,
    onCompare: (on) => {
      state.compareView = on;
      renderContent();
    },
    onActivate: (id) => {
      state.selectedId = id;
      revealSelected();
      renderAll();
      scrollSelectedIntoView();
    },
    onClearSelection: () => {
      state.selectedIds = new Set(state.selectedId ? [state.selectedId] : []);
      state.compareView = false;
      renderAll();
    },
  });
}

function renderContent() {
  destroyMultiCharts();
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
      constants: engine.defaultConstants || engine.constants,
      sortKey: state.sortKey,
      sortDir: state.sortDir,
      onSelect: (id) => {
        selectFile(id);
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
  else if (state.selectedIds.size > 1) renderMultiView();
  else renderFileView();
  paintAnalysisStatus();
}

// The selection follows the files: anything removed leaves it, and a single active
// file is always its own one element selection, whoever changed it.
function normaliseSelection() {
  const known = new Set(state.files.map((file) => file.id));
  for (const id of [...state.selectedIds]) if (!known.has(id)) state.selectedIds.delete(id);
  if (!state.selectedId) state.selectedIds = new Set();
  else if (state.selectedIds.size <= 1) state.selectedIds = new Set([state.selectedId]);
  if (state.selectedIds.size < 2) state.compareView = false;
}

function renderAll() {
  normaliseSelection();
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

// ---------------------------------------------------------------- export

const PDF_SCOPES = [
  ["all", "export-pdf-all", "export.scopeAll"],
  ["filtered", "export-pdf-filtered", "export.scopeFiltered"],
  ["selected", "export-pdf-selected", "export.scopeSelected"],
  ["sample", "export-pdf-sample", "export.scopeSample"],
];

function scopeFiles(scope) {
  const file = selectedFile();
  if (scope === "filtered") return state.files.filter((f) => matchesFilter(f, state.filter));
  if (scope === "selected") return selectedFiles();
  if (scope === "sample") {
    return file ? state.files.filter((f) => f.sampleId === file.sampleId) : [];
  }
  return state.files;
}

function analysedIn(scope) {
  return scopeFiles(scope).filter((f) => f.auto || f.expert);
}

function paintExportMenu() {
  for (const [scope, id, key] of PDF_SCOPES) {
    const count = analysedIn(scope).length;
    const button = $(id);
    button.textContent = t(key, { n: count });
    button.disabled = !count;
  }
  const selected = analysedIn("selected").length;
  const csvSelected = $("export-csv-selected");
  csvSelected.textContent = t("export.csvSelected", { n: selected });
  csvSelected.disabled = !selected;
}

function runPrint(files, scopeText) {
  const html = buildPrintReport({
    files,
    operator: state.operator,
    constants: engine.constants,
    algoVersion: engine.version,
    algoSha: engine.sha256,
    appVersion: APP_VERSION,
    scopeText,
    sessionName: state.session.name,
  });
  printReport(html);
}

// A report of three files and a report of four hundred are different objects. The
// scope is chosen before printing, and a large one says how large.
function exportPdf(scope) {
  const files = analysedIn(scope);
  $("export-menu").classList.remove("is-open");
  $("btn-export").setAttribute("aria-expanded", "false");
  if (!files.length) {
    $("live-results").textContent = t("export.empty");
    return;
  }
  const scopeText = t(PDF_SCOPES.find(([name]) => name === scope)[2], { n: files.length });
  const run = () => runPrint(files, scopeText);
  if (files.length > 50) {
    askConfirmation(
      {
        title: t("export.bigTitle"),
        message: t("export.bigMessage", { n: files.length, pages: files.length + 1 }),
        accept: t("export.bigAccept"),
        destructive: false,
      },
      run
    );
    return;
  }
  run();
}

// ---------------------------------------------------------------- wiring

function wireUi() {
  installTooltips();
  mountPrefs($("app-prefs"), {
    onLang: () => {
      paintStatus();
      fillVersionSelect();
      paintSessionMenu();
      renderAll();
      paintProgress();
    },
  });

  for (const type of ["pointerdown", "keydown"]) {
    $("batch-progress").addEventListener(type, () => {
      if (state.progress) state.progress.touched = true;
    });
  }
  $("file-input").addEventListener("change", (e) => {
    const blobs = [...e.target.files];
    addFiles(
      blobs.map((blob) => ({ blob, folder: null })),
      t("progress.files", { n: blobs.length })
    );
    e.target.value = "";
  });
  $("folder-input").addEventListener("change", (e) => {
    ingestDirectoryInput(e.target.files);
    e.target.value = "";
  });
  $("btn-analyze").addEventListener("click", () => requeueAll());
  // Clearing the session lives in the Session menu now, nowhere else.
  $("session-clear").addEventListener("click", () => {
    $("session-menu").classList.remove("is-open");
    $("btn-session").setAttribute("aria-expanded", "false");
    confirmClearSession();
  });
  $("progress-abort").addEventListener("click", abortQueue);
  $("progress-retry").addEventListener("click", () => retryEngine(false));
  $("progress-cdn").addEventListener("click", () => retryEngine(true));
  $("move-menu-close").addEventListener("click", closeMoveMenu);
  $("expert-mode").addEventListener("change", (e) => {
    state.expertMode = e.target.checked;
    if (!state.expertMode) cancelPick(false);
    paintExpertUi();
    renderContent();
  });
  $("view-files").addEventListener("click", () => setView("files"));
  $("view-table").addEventListener("click", () => setView("table"));
  $("btn-export").addEventListener("click", () => {
    const menu = $("export-menu");
    const open = !menu.classList.contains("is-open");
    if (open) paintExportMenu();
    menu.classList.toggle("is-open", open);
    $("btn-export").setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", (e) => {
    if (!$("export-menu").contains(e.target)) {
      $("export-menu").classList.remove("is-open");
      $("btn-export").setAttribute("aria-expanded", "false");
    }
  });
  $("export-csv-selected").addEventListener("click", () => {
    exportCsv(selectedFiles(), {
      operator: state.operator,
      algoVersion: engine.version,
      algoSha: engine.sha256,
      defaultConstants: engine.defaultConstants,
    });
    $("export-menu").classList.remove("is-open");
  });
  $("export-csv").addEventListener("click", () => {
    exportCsv(state.files, {
      operator: state.operator,
      algoVersion: engine.version,
      algoSha: engine.sha256,
      defaultConstants: engine.defaultConstants,
    });
    $("export-menu").classList.remove("is-open");
  });
  for (const [scope, id] of PDF_SCOPES) {
    $(id).addEventListener("click", () => exportPdf(scope));
  }
  $("operator").addEventListener("input", (e) => {
    state.operator = e.target.value;
    persist();
  });
  $("algo-version").addEventListener("change", async (e) => {
    const version = e.target.value;
    setStatus("engine.loadingAlgo", { version }, true);
    beginEngineProgress(version);
    paintAlgoInfo();
    try {
      state.paramsOverride = null;
      await engine.switchVersion(version);
      setParamInputs(engine.defaultConstants);
      paintParamsMode();
      // Say which version just ran over the list, and what it changed.
      requeueAll(algoChangeLine(version));
    } catch (err) {
      showEngineError(err);
    }
  });

  // --- P: the session menu behaves like the export menu, one open menu at a time.
  $("btn-session").addEventListener("click", () => {
    const menu = $("session-menu");
    const open = !menu.classList.contains("is-open");
    if (open) refreshSessions();
    menu.classList.toggle("is-open", open);
    $("btn-session").setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", (e) => {
    if (!$("session-menu").contains(e.target)) {
      $("session-menu").classList.remove("is-open");
      $("btn-session").setAttribute("aria-expanded", "false");
    }
  });
  $("session-name").addEventListener("change", async (e) => {
    const next = e.target.value.trim();
    if (!next || next === state.session.name) return;
    await renameSession(state.session.id, next);
    await refreshSessions();
  });
  $("session-new").addEventListener("click", () => newSession());
  $("session-save-file").addEventListener("click", () => saveSessionToFile());
  $("session-load-file").addEventListener("click", () => $("session-file-input").click());
  $("session-file-input").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) loadSessionFromFile(file);
  });
  for (const [id, pick] of [["choice-first", "onFirst"], ["choice-second", "onSecond"]]) {
    $(id).addEventListener("click", () => {
      const action = choiceActions?.[pick];
      choiceActions = null;
      $("choice-dialog").close();
      action?.();
    });
  }
  $("choice-dialog").addEventListener("close", () => {
    choiceActions = null;
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
    else {
      const blobs = [...dt.files];
      addFiles(
        blobs.map((blob) => ({ blob, folder: null })),
        t("progress.files", { n: blobs.length })
      );
    }
  });

  $("progress-close").addEventListener("click", closeProgress);
  $("analysis-params-form").addEventListener("submit", (event) => {
    event.preventDefault();
    applyParams();
  });
  $("analysis-params-form").addEventListener("input", paintParamsErrors);
  $("params-reset").addEventListener("click", resetParams);
  $("params-bar-reset").addEventListener("click", resetParams);
  $("confirm-accept").addEventListener("click", () => {
    const action = confirmAction;
    confirmAction = null;
    $("confirm-dialog").close();
    action?.();
  });
  $("confirm-dialog").addEventListener("close", () => {
    confirmAction = null;
  });
  $("undo-action").addEventListener("click", undoRemove);

  // Cmd/Ctrl+O opens files, with Shift a folder. Both reach the same inputs the
  // sidebar zone uses, so there is still one place that adds measurements.
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "o") {
      e.preventDefault();
      $(e.shiftKey ? "folder-input" : "file-input").click();
    }
  });
  installHubShortcut();

  $("drawer-btn").addEventListener("click", openDrawer);
  $("backdrop").addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      cancelPick(true);
      closeProgress();
      closeMoveMenu();
      $("export-menu").classList.remove("is-open");
      $("btn-export").setAttribute("aria-expanded", "false");
      $("session-menu").classList.remove("is-open");
      $("btn-session").setAttribute("aria-expanded", "false");
    }
    const editing =
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement ||
      e.target?.isContentEditable;
    if (editing || state.view !== "files") return;
    // Delete removes, Backspace never does: on a laptop keyboard Backspace is pressed
    // by reflex, and a measurement is not a typo.
    const inFileArea =
      $("sidebar").contains(document.activeElement) || $("content").contains(document.activeElement);
    if (e.key === "Delete" && state.selectedId && inFileArea) {
      e.preventDefault();
      const file = selectedFile();
      if (file) removeFiles([file.id], file.name);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      // With several files selected the arrows walk the selection, not the list.
      if (state.selectedIds.size > 1) {
        const ids = state.files.filter((f) => state.selectedIds.has(f.id)).map((f) => f.id);
        const index = ids.indexOf(state.selectedId);
        const next = ids[Math.min(ids.length - 1, Math.max(0, index + step))];
        if (next && next !== state.selectedId) {
          state.selectedId = next;
          revealSelected();
          renderAll();
          scrollSelectedIntoView();
        }
        return;
      }
      const id = siblingFileId(state.files, state.selectedId, step, state.filter);
      if (id) selectFile(id);
    }
  });
  document.addEventListener("fullscreenchange", () => {
    document.body.classList.toggle("is-fullscreen", !!document.fullscreenElement);
  });
}


// ---------------------------------------------------------------- session payload

function resetStateForPayload() {
  state.files = [];
  state.folders = new Map();
  state.closedSamples = new Set();
  state.skipped = { count: 0, exts: "", extsSet: new Set(), extCounts: {} };
  state.duplicateSkipped = 0;
  state.selectedId = null;
  state.selectedIds = new Set();
  state.compareView = false;
  state.previewExpert = null;
  cancelPick(false);
  state.manualPicked.clear();
  hideUndo();
}

function applyPayload(saved) {
  resetStateForPayload();
  if (!saved) {
    state.operator = "";
    $("operator").value = "";
    state.filter = "all";
    return;
  }
  // Sample IDs derived from file names follow the current rule unless the operator
  // renamed the sample by hand; older sessions regroup themselves on load.
  state.files = (saved.files || []).map((f) => ({
    ...f,
    sampleId: f.sampleIdManual ? f.sampleId : sampleIdFromName(f.name),
    state: f.auto || f.expert ? "done" : "queued",
    revisions: f.revisions || [],
  }));
  state.operator = saved.operator || "";
  $("operator").value = state.operator;
  state.filter = saved.filter || "all";
  state.selectedId = state.files[0]?.id || null;
  for (const meta of saved.folders || []) {
    const extCounts = { ...(meta.extCounts || {}) };
    const legacyExts = (meta.exts || "").split(", ").filter(Boolean);
    if (!Object.keys(extCounts).length && legacyExts.length === 1 && meta.skipped) {
      extCounts[legacyExts[0]] = meta.skipped;
    }
    state.folders.set(meta.name, {
      open: meta.open !== false,
      origin: meta.origin === "user" ? "user" : "import",
      skipped: meta.skipped || 0,
      exts: meta.exts || "",
      extsSet: new Set(legacyExts),
      extCounts,
    });
  }
  if (saved.skipped) {
    const legacyExts = (saved.skipped.exts || "").split(", ").filter(Boolean);
    const extCounts = { ...(saved.skipped.extCounts || {}) };
    if (!Object.keys(extCounts).length && legacyExts.length === 1 && saved.skipped.count) {
      extCounts[legacyExts[0]] = saved.skipped.count;
    }
    state.skipped = {
      count: saved.skipped.count || 0,
      exts: saved.skipped.exts || "",
      extsSet: new Set(legacyExts),
      extCounts,
    };
  }
  state.duplicateSkipped = saved.duplicateSkipped || 0;
}

async function boot() {
  applyStatic(document);
  wireUi();
  mountPartners($("partner-logos"));
  beginEngineProgress(new URLSearchParams(location.search).get("algo") || "");
  paintExpertUi();
  paintStatus();
  renderEmpty();
  engine.on((ev) => {
    if (ev.type === "status") {
      setStatus(stageKey(ev.stage), null, true);
      updateEngineProgress(ev);
    }
    if (ev.type === "ready") {
      state.engineProgress = {
        stage: "algorithm",
        percent: 100,
        indeterminate: false,
        version: ev.version,
      };
      if (state.progress?.kind === "engine") {
        state.progress.error = "";
        state.progress.importComplete = true;
      }
      readyStatus();
      fillVersionSelect();
      if (!state.paramsOverride) setParamInputs(engine.defaultConstants);
      paintParamsMode();
      updateToolbar();
      // A restored session paints before the worker reports its constants, so the
      // thresholds on screen would stay empty without this repaint.
      renderContent();
      pump();
      paintProgress();
    }
    if (ev.type === "error" && ev.id == null) showEngineError(ev);
  });
  try {
    applyPayload(await loadSession());
    await refreshSessions();
  } catch (_) {
    /* first run */
  }
  try {
    const res = await fetch("/api/versions", { cache: "no-store" });
    state.versions = await res.json();
    fillVersionSelect();
  } catch (_) {
    state.versions = [];
    paintAlgoInfo();
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
