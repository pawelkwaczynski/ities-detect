import { Engine } from "./engine.js";
import { applyStaticText, getLang, initLang, LANGUAGES, locale, setLang, t } from "./ui/i18n.js";
import { setLang as setSharedLang, syncLangFromStorage } from "/shared/i18n.js";
import { installHubShortcut } from "/shared/appswitch.js";
import { mountPartners } from "/shared/partners.js";
import { installTooltips } from "/shared/tooltip.js";
import { createSegmented, getTheme } from "/shared/prefs.js";
import { bucketCounts, electrodeFromFile, shaShort } from "./ui/format.js";
import { renderSidebar, siblingFileId } from "./ui/sidebar.js";
import { renderResultCard, renderDetails } from "./ui/result.js";
import { CvChart, chartLegend } from "./ui/chart.js";
import { renderTable } from "./ui/table.js";
import { buildPrintReport, exportCsv, loadSession, printReport, saveSession } from "./ui/session.js";
import { APP_VERSION } from "./ui/app_version.js";

// The hub and ITIES Detect already store the theme under this key. PeakWise reads and
// writes the same one so a theme picked on any of the three pages holds for all of them.
const THEME_KEY = "ities-theme";

const $ = (id) => document.getElementById(id);

const state = {
  files: [],
  selectedId: null,
  filter: "all",
  view: "files",
  operator: "",
  versions: [],
  sessionName: "",
  savedAt: null,
  sortKey: "electrode",
  sortDir: 1,
  showTangents: true,
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

function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    saveSession({
      files: state.files.map((f) => ({
        id: f.id,
        name: f.name,
        electrode: f.electrode,
        sha256: f.sha256,
        addedAt: f.addedAt,
        analysedAt: f.analysedAt,
        algoVersion: f.algoVersion,
        algoSha: f.algoSha,
        result: f.result,
        bytes: f.bytes,
      })),
      operator: state.operator,
      filter: state.filter,
      sessionName: state.sessionName,
    })
      .then(() => {
        state.savedAt = new Date();
        paintStatusBar();
      })
      .catch(() => {});
  }, 250);
}

function applyTheme(mode) {
  if (mode === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", mode);
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch (_) {
    /* the choice just will not survive a reload */
  }
  // uPlot bakes the axis and grid colours into the canvas when it draws, so the chart has
  // to be built again after a theme change, not only restyled.
  if (chart && state.view === "files") renderFileView();
}

function setEngineStatus(text, { loading } = {}) {
  const el = $("engine-status");
  el.textContent = "";
  if (loading) {
    const bar = document.createElement("span");
    bar.className = "engine-bar";
    bar.appendChild(document.createElement("span"));
    el.appendChild(bar);
  }
  el.appendChild(document.createTextNode(text));
}

function stageLabel(ev) {
  if (ev.stage === "pyodide" || ev.stage === "pyodide-fallback") return t("engine.pyodide");
  if (ev.stage === "pyodide-cdn") return t("engine.pyodideCdn");
  if (ev.stage === "packages") return t("engine.packages");
  if (ev.stage === "algorithm") return t("engine.algorithm", { v: ev.detail });
  return ev.stage;
}

function readyLabel() {
  if (!engine.ready) return t("engine.starting");
  return t("engine.readyWith", { v: engine.version, sha: shaShort(engine.sha256) });
}

function fillVersionSelect() {
  const sel = $("algo-version");
  sel.innerHTML = "";
  for (const v of state.versions) {
    const opt = document.createElement("option");
    opt.value = v.version;
    opt.textContent = v.default
      ? t("toolbar.algoVersionDefault", { v: v.version })
      : t("toolbar.algoVersionOption", { v: v.version });
    sel.appendChild(opt);
  }
  if (engine.version) sel.value = engine.version;
}

function renderEmpty() {
  const content = $("content");
  content.innerHTML = "";
  const card = document.createElement("div");
  card.className = "empty-drop card";
  const title = document.createElement("p");
  title.textContent = t("empty.title");
  const body = document.createElement("p");
  body.className = "muted";
  body.textContent = t("empty.body");
  card.append(title, body);
  content.appendChild(card);
}

function renderEngineError(message) {
  const content = $("content");
  content.innerHTML = "";
  const card = document.createElement("div");
  card.className = "engine-error card";
  const msg = document.createElement("p");
  msg.textContent = message;
  const lead = document.createElement("p");
  lead.className = "muted";
  lead.textContent = t("engine.errorLead");
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
  actions.append(retry, cdn);
  card.append(msg, lead, actions);
  content.appendChild(card);
}

function showEngineError(err) {
  setEngineStatus(t("engine.error"));
  renderEngineError(String(err.message || err));
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
      p.textContent = t("empty.pick");
      content.appendChild(p);
    }
    return;
  }
  content.innerHTML = "";
  const resultHost = document.createElement("div");
  const chartCard = document.createElement("section");
  chartCard.className = "card chart-card";
  const bar = document.createElement("div");
  bar.className = "chart-toolbar";
  const title = document.createElement("h2");
  title.className = "chart-title";
  title.textContent = t("chart.title");
  const toggle = document.createElement("label");
  toggle.className = "chart-toggle";
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = state.showTangents;
  box.addEventListener("change", () => {
    state.showTangents = box.checked;
    renderFileView();
  });
  toggle.append(box, document.createTextNode(" " + t("chart.showTangents")));
  bar.append(title, toggle);
  const chartHost = document.createElement("div");
  chartHost.className = "chart-host";
  chartCard.append(bar, chartHost);
  const detailsHost = document.createElement("div");
  content.append(resultHost, chartCard, detailsHost);

  renderResultCard(resultHost, { file, result: file.result });
  if (chart) {
    chart.destroy();
    chart = null;
  }
  if (file.result && file.result.curve) {
    chart = new CvChart(chartHost);
    chart.render(file.result, { showTangents: state.showTangents });
    chartCard.appendChild(chartLegend());
  } else {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = t("chart.none");
    chartHost.appendChild(p);
  }
  renderDetails(detailsHost, { file, result: file.result, config: engine.config });
}

// One pill per PeakWise status, the same object the sidebar list filters by: clicking
// a pill sets the filter, clicking the active one goes back to all (addendum 4, CC).
function statPill({ labelKey, count, tone, filter }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "stat-pill tone-" + tone;
  button.setAttribute("aria-pressed", String(state.filter === filter));
  const label = t(labelKey);
  button.setAttribute("aria-label", count + " " + label);
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

  const total = document.createElement("span");
  total.className = "summary-total";
  const totalNumber = document.createElement("strong");
  totalNumber.className = "tabular";
  totalNumber.textContent = String(n);
  const totalWord = document.createElement("span");
  totalWord.className = "muted";
  totalWord.textContent = t("summary.files");
  total.append(totalNumber, totalWord);
  left.appendChild(total);

  for (const [filter, labelKey, tone] of [
    ["pair", "bucket.pair", "detected"],
    ["partial", "bucket.partial", "uncertain"],
    ["none", "bucket.none", "not_detected"],
    ["unreadable", "bucket.unreadable", "quality"],
  ]) {
    left.appendChild(statPill({ labelKey, count: counts[filter], tone, filter }));
  }
  bar.appendChild(left);
}

// The left half of the footer: a coloured dot for the engine, how many files carry a
// result, and when the session last reached IndexedDB.
function paintStatusBar() {
  const dot = $("status-dot");
  dot.className = "status-dot " + (engine.failed ? "is-error" : engine.ready ? "is-ready" : "is-busy");
  const done = state.files.filter((f) => f.result).length;
  $("analysis-status").textContent = state.files.length
    ? t("status.analysed", { done, total: state.files.length })
    : "";
  $("session-saved").textContent = state.savedAt
    ? " · " + t("session.saved", { time: state.savedAt.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" }) })
    : "";
  $("session-clear").disabled = !state.files.length;
}

function renderAll() {
  renderSidebar($("sidebar"), {
    files: state.files,
    selectedId: state.selectedId,
    filter: state.filter,
    onSelect: (id) => {
      state.selectedId = id;
      renderAll();
    },
    onFilter: (f) => {
      state.filter = f;
      renderAll();
    },
    onRename: (oldId, next) => {
      for (const file of state.files) if (file.electrode === oldId) file.electrode = next;
      persist();
      renderAll();
    },
    onImport: () => $("file-input").click(),
    onImportFolder: () => $("folder-input").click(),
  });
  paintSummaryBar();
  paintStatusBar();
  paintAlgoInfo();
  $("btn-analyze").disabled = !state.files.length || !engine.ready;
  $("app-ver").textContent = t("app.version", { v: APP_VERSION });
  if (state.view === "table") {
    const content = $("content");
    content.innerHTML = "";
    const host = document.createElement("div");
    content.appendChild(host);
    renderTable(host, {
      files: state.files,
      filter: state.filter,
      sortKey: state.sortKey,
      sortDir: state.sortDir,
      onSort: (key) => {
        if (state.sortKey === key) state.sortDir *= -1;
        else {
          state.sortKey = key;
          state.sortDir = 1;
        }
        renderAll();
      },
      onSelect: (id) => {
        state.selectedId = id;
        setView("files");
      },
    });
    return;
  }
  if (!state.files.length) renderEmpty();
  else renderFileView();
}

function setView(view) {
  state.view = view;
  $("view-files").setAttribute("aria-pressed", String(view === "files"));
  $("view-table").setAttribute("aria-pressed", String(view === "table"));
  renderAll();
}

async function addFiles(fileList) {
  const added = [];
  for (const blob of fileList) {
    const buf = await blob.arrayBuffer();
    const file = {
      id: uid(),
      name: blob.name,
      electrode: electrodeFromFile(blob.name, blob.webkitRelativePath),
      bytes: new Uint8Array(buf),
      sha256: await sha256Hex(buf),
      addedAt: new Date().toISOString(),
      result: null,
    };
    state.files.push(file);
    added.push(file);
    if (!state.selectedId) state.selectedId = file.id;
  }
  persist();
  renderAll();
  // Files are analysed as soon as they arrive, so the first result is on screen without
  // a second click. Adding more files while a run is going simply queues them.
  if (added.length && engine.ready) await analyze(added);
}

async function analyzeOne(file, index, total) {
  const result = await engine.analyze({
    id: file.id,
    name: file.name,
    bytes: file.bytes,
    done: index,
    total,
  });
  file.result = result;
  file.algoVersion = engine.version;
  file.algoSha = engine.sha256;
  file.analysedAt = new Date().toISOString();
  $("live-results").textContent = file.name + ": " + (result.status || "");
}

let running = false;
let aborted = false;

// The progress window is centred, shows the percentage large and the four PeakWise
// counters underneath (brief 1.4, point I). It only opens for a real series: one file
// is done before a dialog would finish animating.
const PROGRESS_MIN = 2;

function openProgress(total) {
  if (total < PROGRESS_MIN) return;
  const dialog = $("batch-progress");
  $("progress-source").textContent = t("progress.of", { done: 0, total });
  $("progress-error").hidden = true;
  $("progress-engine").textContent = readyLabel();
  aborted = false;
  if (!dialog.open) dialog.showModal();
}

function updateProgress(done, total) {
  const dialog = $("batch-progress");
  if (!dialog.open) return;
  const percent = total ? Math.round((done / total) * 100) : 0;
  $("progress-percent").textContent = percent + " %";
  $("progress-value").textContent = t("progress.of", { done, total });
  $("progress-source").textContent = t("progress.of", { done, total });
  const track = $("progress-bar");
  track.setAttribute("aria-valuenow", String(percent));
  $("progress-fill").style.width = percent + "%";
  const counts = bucketCounts(state.files);
  $("progress-pair").textContent = String(counts.pair);
  $("progress-partial").textContent = String(counts.partial);
  $("progress-none").textContent = String(counts.none);
  $("progress-unreadable").textContent = String(counts.unreadable);
}

function closeProgress() {
  const dialog = $("batch-progress");
  if (dialog.open) dialog.close();
}

async function analyze(files) {
  if (running) return;
  running = true;
  $("btn-analyze").disabled = true;
  openProgress(files.length);
  updateProgress(0, files.length);
  try {
    for (let i = 0; i < files.length; i++) {
      if (aborted) break;
      setEngineStatus(t("engine.analysing", { done: i + 1, total: files.length }), { loading: true });
      await analyzeOne(files[i], i + 1, files.length);
      updateProgress(i + 1, files.length);
      renderAll();
    }
    setEngineStatus(readyLabel());
    persist();
  } catch (err) {
    $("live-results").textContent = String(err.message || err);
    setEngineStatus(t("engine.error"));
    const box = $("progress-error");
    box.textContent = String(err.message || err);
    box.hidden = false;
  } finally {
    running = false;
    closeProgress();
    $("btn-analyze").disabled = !state.files.length || !engine.ready;
    paintStatusBar();
  }
}

// The ⓘ next to the version picker says which algorithm produced what is on screen.
function paintAlgoInfo() {
  const info = $("algo-info");
  if (!info) return;
  info.dataset.tooltipText = engine.ready
    ? t("algo.info.text", { v: engine.version, sha: shaShort(engine.sha256) })
    : t("engine.starting");
}

let prefs = null;

function retranslate() {
  applyStaticText();
  prefs?.relabel();
  fillVersionSelect();
  setEngineStatus(readyLabel());
  renderAll();
}

// A named question in the page, never window.confirm: the dialog is styled, testable
// and does not block the browser.
function askConfirm({ title, message, confirmLabel }) {
  return new Promise((resolve) => {
    const dialog = $("confirm-dialog");
    $("confirm-title").textContent = title;
    $("confirm-message").textContent = message;
    const accept = $("confirm-accept");
    accept.textContent = confirmLabel;
    const done = (answer) => {
      accept.removeEventListener("click", onAccept);
      dialog.removeEventListener("close", onClose);
      if (dialog.open) dialog.close();
      resolve(answer);
    };
    const onAccept = () => done(true);
    const onClose = () => done(false);
    accept.addEventListener("click", onAccept);
    dialog.addEventListener("close", onClose);
    dialog.showModal();
  });
}

function defaultSessionName() {
  return new Date().toLocaleString(locale(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// A session file holds the results and the electrode names, not the raw bytes: it is
// a record of a run, small enough to mail, and it reopens on any machine.
function sessionToJson() {
  return JSON.stringify(
    {
      app: "peakwise",
      version: APP_VERSION,
      savedAt: new Date().toISOString(),
      name: state.sessionName || defaultSessionName(),
      operator: state.operator,
      files: state.files.map((f) => ({
        id: f.id,
        name: f.name,
        electrode: f.electrode,
        sha256: f.sha256,
        addedAt: f.addedAt,
        analysedAt: f.analysedAt,
        algoVersion: f.algoVersion,
        algoSha: f.algoSha,
        result: f.result,
      })),
    },
    null,
    2
  );
}

function closeMenus() {
  for (const id of ["export-menu", "session-menu"]) {
    const menu = $(id);
    menu.classList.remove("is-open");
    menu.querySelector("button[aria-haspopup]")?.setAttribute("aria-expanded", "false");
  }
}

function toggleMenu(id) {
  const menu = $(id);
  const open = !menu.classList.contains("is-open");
  closeMenus();
  menu.classList.toggle("is-open", open);
  menu.querySelector("button[aria-haspopup]")?.setAttribute("aria-expanded", String(open));
}

function clearSessionState() {
  state.files = [];
  state.selectedId = null;
  state.filter = "all";
  state.savedAt = null;
  if (chart) {
    chart.destroy();
    chart = null;
  }
  persist();
  renderAll();
}

function wireSessionMenu() {
  $("btn-session").addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMenu("session-menu");
  });
  const name = $("session-name");
  name.placeholder = defaultSessionName();
  name.addEventListener("input", () => {
    state.sessionName = name.value;
    persist();
  });
  $("session-new").addEventListener("click", async () => {
    closeMenus();
    if (
      state.files.length &&
      !(await askConfirm({
        title: t("session.clearTitle"),
        message: t("session.clearBody", { n: state.files.length }),
        confirmLabel: t("session.clearConfirm"),
      }))
    ) {
      return;
    }
    state.sessionName = "";
    name.value = "";
    clearSessionState();
  });
  $("session-save-file").addEventListener("click", () => {
    closeMenus();
    const label = (state.sessionName || defaultSessionName()).replace(/[^\w.-]+/g, "_");
    download("peakwise_" + label + ".json", sessionToJson(), "application/json");
  });
  $("session-load-file").addEventListener("click", () => {
    closeMenus();
    $("session-file-input").click();
  });
  $("session-file-input").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== "peakwise" || !Array.isArray(data.files)) throw new Error("shape");
      state.files = data.files;
      state.operator = data.operator || "";
      state.sessionName = data.name || "";
      name.value = state.sessionName;
      $("operator").value = state.operator;
      state.selectedId = state.files[0]?.id || null;
      persist();
      renderAll();
    } catch (_) {
      $("live-results").textContent = t("session.loadFailed");
      const box = $("progress-error");
      box.textContent = t("session.loadFailed");
      box.hidden = false;
    }
  });
  $("session-clear").addEventListener("click", async () => {
    closeMenus();
    if (
      await askConfirm({
        title: t("session.clearTitle"),
        message: t("session.clearBody", { n: state.files.length }),
        confirmLabel: t("session.clearConfirm"),
      })
    ) {
      clearSessionState();
    }
  });
}

function wireUi() {
  wireSessionMenu();
  for (const id of ["file-input", "folder-input"]) {
    $(id).addEventListener("change", (e) => {
      addFiles([...e.target.files]);
      e.target.value = "";
    });
  }
  $("btn-analyze").addEventListener("click", () => analyze(state.files.filter((f) => f.bytes)));
  $("view-files").addEventListener("click", () => setView("files"));
  $("view-table").addEventListener("click", () => setView("table"));
  $("btn-export").addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMenu("export-menu");
  });
  document.addEventListener("click", (e) => {
    if (!$("export-menu").contains(e.target) && !$("session-menu").contains(e.target)) closeMenus();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenus();
  });
  $("export-csv").addEventListener("click", () => {
    exportCsv(state.files, {
      operator: state.operator,
      algoVersion: engine.version,
      algoSha: engine.sha256,
    });
    closeMenus();
  });
  $("export-print").addEventListener("click", () => {
    printReport(
      buildPrintReport({
        files: state.files,
        operator: state.operator,
        config: engine.config,
        algoVersion: engine.version,
        algoSha: engine.sha256,
      })
    );
    closeMenus();
  });
  $("operator").addEventListener("input", (e) => {
    state.operator = e.target.value;
    persist();
  });
  $("progress-abort").addEventListener("click", () => {
    aborted = true;
    closeProgress();
  });
  $("progress-close").addEventListener("click", () => closeProgress());
  $("algo-version").addEventListener("change", async (e) => {
    const v = e.target.value;
    setEngineStatus(t("engine.loadingAlgo", { v }), { loading: true });
    try {
      await engine.switchVersion(v);
      setEngineStatus(readyLabel());
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
    addFiles([...e.dataTransfer.files]);
  });

  $("drawer-btn").addEventListener("click", () => {
    $("sidebar").classList.add("is-open");
    $("backdrop").hidden = false;
  });
  $("backdrop").addEventListener("click", () => {
    $("sidebar").classList.remove("is-open");
    $("backdrop").hidden = true;
  });
  document.addEventListener("keydown", (e) => {
    if (state.view !== "files") return;
    if (e.target.matches("input, textarea, select")) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const id = siblingFileId(state.files, state.selectedId, e.key === "ArrowDown" ? 1 : -1, state.filter);
      if (id) {
        state.selectedId = id;
        renderAll();
      }
    }
  });

  mountPrefs();
}

// Language and theme, the same two segmented controls ITIES Detect puts in its toolbar
// (shared/prefs.js, point Q): the theme is three icons, the language two letters. The
// shared module is used through createSegmented, because PeakWise has to relabel with
// its own dictionary and its own re-render.
const THEME_ICONS = {
  system:
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="12" height="8" rx="1.5"/><path d="M6 13.5h4M8 11v2.5"/></svg>',
  light:
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M3.4 12.6l1.3-1.3M11.3 4.7l1.3-1.3"/></svg>',
  dark:
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M13.5 10.2A6 6 0 0 1 5.8 2.5a6 6 0 1 0 7.7 7.7z"/></svg>',
};

function mountPrefs() {
  const host = $("app-prefs");
  const lang = createSegmented({
    labelKey: "prefs.language",
    className: "seg-lang",
    options: LANGUAGES.map(({ code }) => ({ value: code, labelKey: "lang." + code })),
    value: getLang(),
    onChange: (code) => {
      setLang(code);
      setSharedLang(code);
      syncLangFromStorage();
      retranslate();
    },
  });
  const current = getTheme();
  applyTheme(current);
  const theme = createSegmented({
    labelKey: "prefs.theme",
    className: "seg-theme",
    options: ["system", "light", "dark"].map((mode) => ({
      value: mode,
      labelKey: "prefs.theme." + mode,
    })),
    value: current,
    onChange: applyTheme,
    icons: THEME_ICONS,
  });
  host.append(lang, theme);
  prefs = {
    relabel: () => {
      lang.relabel();
      theme.relabel();
    },
  };
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getTheme() === "system") applyTheme("system");
  });
}

async function boot() {
  initLang();
  syncLangFromStorage();
  applyStaticText();
  wireUi();
  installTooltips();
  installHubShortcut();
  mountPartners(document.getElementById("partner-logos"));
  setEngineStatus(t("engine.starting"), { loading: true });
  renderEmpty();

  engine.on((ev) => {
    if (ev.type === "status") setEngineStatus(stageLabel(ev), { loading: true });
    if (ev.type === "ready") {
      setEngineStatus(readyLabel());
      fillVersionSelect();
      paintAlgoInfo();
      paintStatusBar();
      $("btn-analyze").disabled = !state.files.length;
      const pending = state.files.filter((f) => f.bytes && !f.result);
      if (pending.length) analyze(pending);
    }
    if (ev.type === "progress" && ev.done >= ev.total) setEngineStatus(readyLabel());
    if (ev.type === "error" && ev.id == null) showEngineError(ev);
  });

  try {
    const saved = await loadSession();
    if (saved?.files?.length) {
      state.files = saved.files;
      state.operator = saved.operator || "";
      state.sessionName = saved.sessionName || "";
      $("session-name").value = state.sessionName;
      $("operator").value = state.operator;
      if (saved.filter) state.filter = saved.filter;
      state.selectedId = state.files[0].id;
    }
  } catch (_) {
    /* first run */
  }
  try {
    const res = await fetch("/algo/peakwise_versions.json", { cache: "no-store" });
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
