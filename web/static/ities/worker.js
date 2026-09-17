import {
  PYODIDE_CDN_URLS,
  stubMatplotlib,
  ANALYZE_HELPERS_PY,
} from "./algo_stub.js";

const PACKAGES = ["numpy", "scipy", "pandas"];
const LOCAL_INDEX = "/pyodide/";

let pyodide = null;
let loadedVersion = null;
let loadedSha256 = null;
let constants = null;
let originalConstants = null;
let usingCdn = false;
let queue = Promise.resolve();

function post(msg) {
  self.postMessage(msg);
}

function stage(name, detail, extra = {}) {
  post({ type: "status", stage: name, detail: detail || name, cdn: usingCdn, ...extra });
}

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function loadPyodideFrom(indexURL) {
  const mod = await import(indexURL + "pyodide.mjs");
  return mod.loadPyodide({
    indexURL,
    locateFile: (path) => indexURL + path,
  });
}

async function bootPyodide() {
  usingCdn = false;
  stage("pyodide", "pobieranie Pyodide");
  try {
    pyodide = await loadPyodideFrom(LOCAL_INDEX);
    return;
  } catch (err) {
    post({
      type: "status",
      stage: "pyodide-fallback",
      detail: "lokalne Pyodide niedostępne, próba CDN",
      error: String(err),
    });
  }
  let last = null;
  for (const url of PYODIDE_CDN_URLS) {
    try {
      pyodide = await loadPyodideFrom(url);
      usingCdn = true;
      return;
    } catch (err) {
      last = err;
    }
  }
  throw last || new Error("Pyodide failed to load from local path and CDN");
}

async function fetchVersions() {
  const res = await fetch("/api/versions", { cache: "no-store" });
  if (!res.ok) throw new Error("Nie udało się wczytać /api/versions");
  return res.json();
}

function pickEntry(manifest, version) {
  if (version) {
    const found = manifest.find((e) => e.version === version);
    if (!found) throw new Error("Nieznana wersja algorytmu: " + version);
    return found;
  }
  return manifest.find((e) => e.default) || manifest[0];
}

async function loadAlgorithm(entry) {
  stage("algorithm", "algorytm " + entry.version, { version: entry.version });
  const res = await fetch("/algo/" + entry.file, { cache: "no-store" });
  if (!res.ok) throw new Error("Nie udało się pobrać " + entry.file);
  const buf = await res.arrayBuffer();
  const sha = await sha256Hex(buf);
  if (sha !== entry.sha256) {
    throw new Error(
      "SHA-256 algorytmu nie zgadza się z versions.json (plik " +
        sha +
        ", manifest " +
        entry.sha256 +
        "). Analiza wstrzymana."
    );
  }
  const source = stubMatplotlib(new TextDecoder("utf-8").decode(buf));
  pyodide.runPython(source);
  pyodide.runPython(ANALYZE_HELPERS_PY);
  const raw = pyodide.runPython("remember_analysis_params()");
  constants = JSON.parse(raw);
  originalConstants = JSON.parse(JSON.stringify(constants));
  loadedVersion = entry.version;
  loadedSha256 = sha;
}

async function applyParams(overrides) {
  if (!pyodide || !originalConstants) throw new Error("Engine is not ready");
  pyodide.globals.set("_ities_param_overrides", overrides ? JSON.stringify(overrides) : "");
  const raw = pyodide.runPython("apply_analysis_params(_ities_param_overrides or None)");
  constants = JSON.parse(raw);
  post({
    type: "params",
    overrides: overrides || null,
    constants,
  });
}

async function init(version, { forceCdn } = {}) {
  if (forceCdn) {
    usingCdn = true;
    stage("pyodide", "pobieranie Pyodide (CDN)");
    let last = null;
    pyodide = null;
    for (const url of PYODIDE_CDN_URLS) {
      try {
        pyodide = await loadPyodideFrom(url);
        break;
      } catch (err) {
        last = err;
      }
    }
    if (!pyodide) throw last || new Error("CDN Pyodide failed");
  } else if (!pyodide) {
    await bootPyodide();
  }
  stage("packages", "pakiety numpy, scipy, pandas", { loaded: 0, total: PACKAGES.length });
  for (let index = 0; index < PACKAGES.length; index += 1) {
    await pyodide.loadPackage([PACKAGES[index]], { messageCallback: () => {} });
    stage("packages", "pakiety numpy, scipy, pandas", {
      loaded: index + 1,
      total: PACKAGES.length,
      package: PACKAGES[index],
    });
  }
  const manifest = await fetchVersions();
  const entry = pickEntry(manifest, version);
  await loadAlgorithm(entry);
  post({
    type: "ready",
    version: loadedVersion,
    sha256: loadedSha256,
    constants,
    cdn: usingCdn,
  });
}

async function analyzeMessage(msg) {
  const { id, name, bytes, manual } = msg;
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const path = "/tmp/ities_" + id;
  pyodide.FS.writeFile(path, u8);
  pyodide.globals.set("_ities_name", name);
  pyodide.globals.set("_ities_path", path);
  pyodide.globals.set("_ities_manual", manual ? JSON.stringify(manual) : "");
  try {
    const dumped = pyodide.runPython(`
import json
name = _ities_name
path = _ities_path
manual_s = _ities_manual
content = open(path, "rb").read()
manual = json.loads(manual_s) if manual_s else None
dump_analyze(name, content, manual=manual)
`);
    const result = JSON.parse(dumped);
    post({ type: "result", id, result });
    if (typeof msg.done === "number" && typeof msg.total === "number") {
      post({ type: "progress", done: msg.done, total: msg.total });
    }
  } finally {
    try {
      pyodide.FS.unlink(path);
    } catch (_) {
      /* already gone */
    }
  }
}

self.onmessage = (ev) => {
  const msg = ev.data || {};
  if (msg.type === "init") {
    queue = Promise.resolve()
      .then(() => init(msg.version, { forceCdn: msg.forceCdn }))
      .catch((err) => post({ type: "error", id: null, message: String(err && err.message ? err.message : err) }));
    return;
  }
  if (msg.type === "analyze") {
    queue = queue
      .then(() => analyzeMessage(msg))
      .catch((err) =>
        post({
          type: "error",
          id: msg.id,
          message: String(err && err.message ? err.message : err),
        })
      );
    return;
  }
  if (msg.type === "params") {
    queue = queue
      .then(() => applyParams(msg.overrides || null))
      .catch((err) =>
        post({
          type: "error",
          id: "__params__",
          message: String(err && err.message ? err.message : err),
        })
      );
    return;
  }
  if (msg.type === "progress-ack") {
    post({ type: "progress", done: msg.done, total: msg.total });
  }
};
