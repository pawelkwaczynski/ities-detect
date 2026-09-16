import { PYODIDE_CDN_URLS, stubMatplotlib, ANALYZE_HELPERS_PY } from "./algo_stub.js";

const PACKAGES = ["numpy", "scipy", "pandas"];
const LOCAL_INDEX = "/pyodide/";
// The manifest lives next to the algorithm files and is served by the same /algo/ route,
// so PeakWise needs no server change when it is copied into the ITIES Detect deployment.
const MANIFEST_URL = "/algo/peakwise_versions.json";

let pyodide = null;
let loadedVersion = null;
let loadedSha256 = null;
let config = null;
let usingCdn = false;
let queue = Promise.resolve();

function post(msg) {
  self.postMessage(msg);
}

function stage(name, detail) {
  post({ type: "status", stage: name, detail: detail || name, cdn: usingCdn });
}

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function loadPyodideFrom(indexURL) {
  const mod = await import(indexURL + "pyodide.mjs");
  return mod.loadPyodide({ indexURL, locateFile: (p) => indexURL + p });
}

async function bootPyodide() {
  usingCdn = false;
  stage("pyodide");
  try {
    pyodide = await loadPyodideFrom(LOCAL_INDEX);
    return;
  } catch (err) {
    post({ type: "status", stage: "pyodide-fallback", error: String(err) });
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
  throw last || new Error("Pyodide failed to load from the local path and from the CDN");
}

async function fetchManifest() {
  const res = await fetch(MANIFEST_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not read " + MANIFEST_URL);
  return res.json();
}

function pickEntry(manifest, version) {
  if (version) {
    const found = manifest.find((e) => e.version === version);
    if (!found) throw new Error("Unknown algorithm version: " + version);
    return found;
  }
  return manifest.find((e) => e.default) || manifest[0];
}

async function loadAlgorithm(entry) {
  stage("algorithm", entry.version);
  const res = await fetch("/algo/" + entry.file, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not fetch " + entry.file);
  const buf = await res.arrayBuffer();
  const sha = await sha256Hex(buf);
  if (sha !== entry.sha256) {
    throw new Error(
      "Algorithm SHA-256 does not match the manifest (file " +
        sha +
        ", manifest " +
        entry.sha256 +
        "). Analysis stopped."
    );
  }
  pyodide.runPython(stubMatplotlib(new TextDecoder("utf-8").decode(buf)));
  pyodide.runPython(ANALYZE_HELPERS_PY);
  config = JSON.parse(pyodide.runPython("dump_config()"));
  loadedVersion = entry.version;
  loadedSha256 = sha;
}

async function init(version, { forceCdn } = {}) {
  if (forceCdn) {
    usingCdn = true;
    stage("pyodide-cdn");
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
  stage("packages");
  await pyodide.loadPackage(PACKAGES, { messageCallback: () => {} });
  const entry = pickEntry(await fetchManifest(), version);
  await loadAlgorithm(entry);
  post({
    type: "ready",
    version: loadedVersion,
    sha256: loadedSha256,
    config,
    cdn: usingCdn,
  });
}

async function analyzeMessage(msg) {
  const { id, name, bytes } = msg;
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const path = "/tmp/peakwise_" + id;
  pyodide.FS.writeFile(path, u8);
  pyodide.globals.set("_pw_name", name);
  pyodide.globals.set("_pw_path", path);
  try {
    const dumped = pyodide.runPython(`
content = open(_pw_path, "rb").read()
dump_analyze(_pw_name, content)
`);
    post({ type: "result", id, result: JSON.parse(dumped) });
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
      .catch((err) =>
        post({ type: "error", id: null, message: String(err && err.message ? err.message : err) })
      );
    return;
  }
  if (msg.type === "analyze") {
    queue = queue
      .then(() => analyzeMessage(msg))
      .catch((err) =>
        post({ type: "error", id: msg.id, message: String(err && err.message ? err.message : err) })
      );
  }
};
