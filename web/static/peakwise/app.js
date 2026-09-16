import { Engine } from "./engine.js";
import { applyStaticText, getLang, initLang, LANGUAGES, setLang, t } from "./ui/i18n.js";
import { electrodeFromFile, shaShort } from "./ui/format.js";
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
    }).catch(() => {});
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
  });
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

async function analyze(files) {
  if (running) return;
  running = true;
  $("btn-analyze").disabled = true;
  try {
    for (let i = 0; i < files.length; i++) {
      setEngineStatus(t("engine.analysing", { done: i + 1, total: files.length }), { loading: true });
      await analyzeOne(files[i], i + 1, files.length);
      renderAll();
    }
    setEngineStatus(readyLabel());
    persist();
  } catch (err) {
    $("live-results").textContent = String(err.message || err);
    setEngineStatus(t("engine.error"));
  } finally {
    running = false;
    $("btn-analyze").disabled = !state.files.length || !engine.ready;
  }
}

function retranslate() {
  applyStaticText();
  for (const btn of document.querySelectorAll("#lang-switch button")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.lang === getLang()));
  }
  fillVersionSelect();
  setEngineStatus(readyLabel());
  renderAll();
}

function wireUi() {
  $("btn-add").addEventListener("click", () => $("file-input").click());
  $("btn-add-folder").addEventListener("click", () => $("folder-input").click());
  for (const id of ["file-input", "folder-input"]) {
    $(id).addEventListener("change", (e) => {
      addFiles([...e.target.files]);
      e.target.value = "";
    });
  }
  $("btn-analyze").addEventListener("click", () => analyze(state.files.filter((f) => f.bytes)));
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
    $("export-menu").classList.remove("is-open");
  });
  $("operator").addEventListener("input", (e) => {
    state.operator = e.target.value;
    persist();
  });
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

  const langHost = $("lang-switch");
  for (const { code, label } of LANGUAGES) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.lang = code;
    b.textContent = label;
    b.setAttribute("aria-pressed", String(code === getLang()));
    b.addEventListener("click", () => {
      setLang(code);
      retranslate();
    });
    langHost.appendChild(b);
  }

  const theme = $("theme");
  let saved = "system";
  try {
    saved = localStorage.getItem(THEME_KEY) || "system";
  } catch (_) {
    /* default stays */
  }
  theme.value = saved;
  applyTheme(saved);
  theme.addEventListener("change", () => applyTheme(theme.value));
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (theme.value === "system") applyTheme("system");
  });
}

async function boot() {
  initLang();
  applyStaticText();
  wireUi();
  setEngineStatus(t("engine.starting"), { loading: true });
  renderEmpty();

  engine.on((ev) => {
    if (ev.type === "status") setEngineStatus(stageLabel(ev), { loading: true });
    if (ev.type === "ready") {
      setEngineStatus(readyLabel());
      fillVersionSelect();
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
      $("operator").value = state.operator;
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
