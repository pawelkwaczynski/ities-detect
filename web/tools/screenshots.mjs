#!/usr/bin/env node
// Headless Chrome screenshots via CDP. Kills Chrome on exit.
// Covers both languages, both themes and the folder upload path, and reports every
// console error the pages produced, so a broken build cannot pass as a picture.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { loginInBrowser, startTestServer, TEST_PORT } from "./test_server_boot.mjs";

const require = createRequire(import.meta.url);
const WebSocket = require("ws");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const OUT = path.join(ROOT, "screenshots");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9222;
// Set by startTestServer(): the screenshots run against their own gunicorn with a
// throwaway login, never against the real server/auth.local.json.
let BASE = `http://127.0.0.1:${TEST_PORT}`;
const LAB = path.resolve(ROOT, "../07_etykiety_lab_20260916");
const STAGE = path.join(OUT, ".files");
const FOLDER_STAGE = path.join(OUT, ".folder");
const CHROME_PROFILE = path.join(OUT, ".chrome");
let screenshotCount = 0;

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(STAGE, { recursive: true });

const FILES = [
  ["Pozytywne/93P_300ul_TPra(1).txt", "93P_300ul_TPra(1).txt"],
  ["Negatywy/BRB pH 7 CV 50uM codeine + 50uM TPrA.txt", "BRB_codeine_TPrA.txt"],
  ["Neutrale/132-1_blank(2).txt", "132-1_blank(2).txt"],
].map(([rel, name]) => {
  const dest = path.join(STAGE, name);
  fs.copyFileSync(path.join(LAB, rel), dest);
  return dest;
});

const TPRA_ONLY_FILE = (() => {
  const name = "BRB pH 10 CV 50uM codeine + 50uM TPrA 2.txt";
  const dest = path.join(STAGE, name);
  fs.copyFileSync(path.join(LAB, "Negatywy", name), dest);
  return dest;
})();

// A folder shaped like a real session: a root, a subfolder, and one file the app
// cannot read, so the skip counter has something to count.
function stageFolder() {
  fs.rmSync(FOLDER_STAGE, { recursive: true, force: true });
  const root = path.join(FOLDER_STAGE, "Neutrale");
  const sub = path.join(root, "seria_2");
  fs.mkdirSync(sub, { recursive: true });
  const src = path.join(LAB, "Neutrale");
  const names = fs.readdirSync(src).filter((n) => n.toLowerCase().endsWith(".txt")).sort();
  const map = {};
  names.forEach((name, index) => {
    const inSub = index >= names.length - 5;
    const dest = inSub ? path.join(sub, name) : path.join(root, name);
    fs.copyFileSync(path.join(src, name), dest);
    map[name] = (inSub ? "Neutrale/seria_2/" : "Neutrale/") + name;
  });
  const nox = path.join(root, "pomiar_surowy.nox");
  fs.writeFileSync(nox, "binary placeholder, not a readable export");
  map["pomiar_surowy.nox"] = "Neutrale/pomiar_surowy.nox";
  const paths = Object.keys(map).map((name) =>
    map[name].includes("/seria_2/") ? path.join(sub, name) : path.join(root, name)
  );
  return { paths, map, txtCount: names.length };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class Cdp {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.seq = 0;
    this.pending = new Map();
    this.errors = [];
  }
  async open() {
    this.ws = new WebSocket(this.url);
    await new Promise((res, rej) => {
      this.ws.once("open", res);
      this.ws.once("error", rej);
    });
    this.ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
        return;
      }
      if (msg.method === "Runtime.exceptionThrown") {
        const d = msg.params?.exceptionDetails;
        this.errors.push("exception: " + (d?.exception?.description || d?.text || "unknown"));
      }
      if (msg.method === "Runtime.consoleAPICalled" && msg.params?.type === "error") {
        const text = (msg.params.args || [])
          .map((a) => a.description || a.value || a.type)
          .join(" ");
        this.errors.push("console.error: " + text);
      }
    });
  }
  // A command that never answers must not stop the run for ever: without a deadline a
  // single stuck evaluation hangs the whole test with no output at all.
  send(method, params = {}, timeoutMs = 60000) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP ${method} did not answer in ${timeoutMs} ms`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    this.ws?.close();
  }
}

async function waitJson(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return r.json();
    } catch (_) {
      /* retry */
    }
    await sleep(150);
  }
  throw new Error("CDP not ready: " + url);
}

async function shot(cdp, name) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  const dest = path.join(OUT, name);
  fs.writeFileSync(dest, Buffer.from(data, "base64"));
  screenshotCount += 1;
  console.log("wrote", path.basename(dest));
}

async function evaluate(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return r.result?.value;
}

async function waitExpr(cdp, expression, timeoutMs = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = await evaluate(cdp, expression);
    if (v) return v;
    await sleep(400);
  }
  throw new Error("timeout waiting for " + expression);
}

// Chrome's mobile emulation lays the page out at its own visual viewport width while
// the capture surface stays at the requested size, which produced shifted, clipped
// phone screenshots. A plain narrow viewport at scale 1 matches what the CSS sees.
async function setViewport(cdp, width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
}

async function setPrefs(cdp, lang, theme) {
  await evaluate(
    cdp,
    `localStorage.setItem('analizatory-lang', '${lang}');` +
      `localStorage.setItem('ities-theme', '${theme}');true`
  );
}

async function go(cdp, url) {
  await cdp.send("Page.navigate", { url });
  await sleep(700);
}

async function reload(cdp) {
  await cdp.send("Page.reload", { ignoreCache: false });
  await sleep(700);
}

const ENGINE_READY =
  "!!document.getElementById('engine-status') && " +
  "/Engine ready|Silnik gotowy/.test(document.getElementById('engine-status').textContent)";
const HAS_VERDICT =
  "!!document.querySelector('.verdict-word') && document.querySelector('.verdict-word').textContent.length > 2";

async function setInputFiles(cdp, files) {
  const doc = await cdp.send("DOM.getDocument", { depth: 1 });
  const q = await cdp.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "#file-input" });
  await cdp.send("DOM.setFileInputFiles", { nodeId: q.nodeId, files });
}

async function loadThreeFiles(cdp, progressShot) {
  await setInputFiles(cdp, FILES);
  if (progressShot) {
    await waitExpr(cdp, "document.getElementById('batch-progress').open", 30000);
    await shot(cdp, progressShot);
  }
  await waitExpr(cdp, HAS_VERDICT, 180000);
  await waitExpr(cdp, ENGINE_READY, 180000);
  await sleep(500);
}

async function clearThroughUi(cdp) {
  await evaluate(cdp, "(() => { document.getElementById('btn-session').click(); document.getElementById('session-clear').click(); return true; })()");
  await waitExpr(cdp, "document.getElementById('confirm-dialog').open", 10000);
  await evaluate(cdp, "document.getElementById('confirm-accept').click();true");
  await waitExpr(cdp, "document.querySelectorAll('.file-row').length === 0", 10000);
}

async function main() {
  const folder = stageFolder();
  const server = await startTestServer();
  BASE = server.base;
  fs.rmSync(CHROME_PROFILE, { recursive: true, force: true });
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${CHROME_PROFILE}`,
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  const kill = () => {
    try {
      chrome.kill("SIGTERM");
    } catch (_) {}
    server.stop();
  };
  process.on("exit", kill);
  process.on("SIGINT", () => {
    kill();
    process.exit(1);
  });

  const report = [];
  try {
    let page = null;
    for (let i = 0; i < 30 && !page; i++) {
      const list = await waitJson(`http://127.0.0.1:${PORT}/json/list`);
      page =
        list.find((t) => t.type === "page" && t.webSocketDebuggerUrl) ||
        list.find((t) => t.webSocketDebuggerUrl);
      if (!page) await sleep(150);
    }
    if (!page?.webSocketDebuggerUrl) throw new Error("no page target");
    const cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("DOM.enable");
    // Headless Chrome does not consider its window focused, so element.focus() would
    // move activeElement without firing focus events. The tooltips answer keyboard
    // focus, and this is what makes that testable.
    await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });

    // ---------------------------------------------------------------- login
    await setViewport(cdp, 1440, 900);
    for (const lang of ["pl", "en"]) {
      await go(cdp, `${BASE}/login?lang=${lang}`);
      await sleep(500);
      await shot(cdp, `login-desktop-${lang}.png`);
    }
    await loginInBrowser(cdp, { evaluate, goto: go }, server, BASE);

    // ---------------------------------------------------------------- hub
    await go(cdp, BASE + "/");
    for (const lang of ["en", "pl"]) {
      await setPrefs(cdp, lang, "light");
      await reload(cdp);
      await shot(cdp, `hub-desktop-${lang}.png`);
    }

    // ---------------------------------------------------------------- empty state
    await go(cdp, BASE + "/ities/");
    await evaluate(cdp, "indexedDB.deleteDatabase('ities-detect');true");
    await setPrefs(cdp, "en", "light");
    await reload(cdp);
    await waitExpr(cdp, "document.getElementById('batch-progress').open", 30000);
    await sleep(400);
    await shot(cdp, "ities-engine-start-desktop-en.png");
    await waitExpr(cdp, ENGINE_READY);
    await waitExpr(cdp, "!document.getElementById('batch-progress').open", 30000);
    await sleep(300);
    await shot(cdp, "ities-empty-desktop-en.png");

    // ------------------------------------------------- result, both languages and themes
    // The progress window is caught while it still counts, not after it closes.
    await loadThreeFiles(cdp, "ities-progress-desktop-en.png");
    await shot(cdp, "ities-result-desktop-en-light.png");
    for (const [lang, theme] of [
      ["en", "dark"],
      ["pl", "light"],
      ["pl", "dark"],
    ]) {
      await setPrefs(cdp, lang, theme);
      await reload(cdp);
      await waitExpr(cdp, HAS_VERDICT, 180000);
      await waitExpr(cdp, ENGINE_READY, 180000);
      await sleep(600);
      await shot(cdp, `ities-result-desktop-${lang}-${theme}.png`);
    }

    // ------------------------------------------- toolbar, list summary, many files
    // The shape of the interface after addendum 2 and 3: seven controls in the bar,
    // the counters in the list, several files as cards and as one chart.
    await setPrefs(cdp, "pl", "light");
    await reload(cdp);
    await waitExpr(cdp, HAS_VERDICT, 180000);
    await waitExpr(cdp, ENGINE_READY, 180000);
    await sleep(500);
    await shot(cdp, "ities-toolbar-desktop-pl.png");
    await evaluate(cdp, `(() => {
      document.querySelector('#summary-bar .stat-pill[data-filter="review"]')?.click();
      return true;
    })()`);
    await sleep(500);
    await shot(cdp, "ities-summary-filter-desktop-pl.png");
    await evaluate(cdp, `(() => {
      document.querySelector('#sidebar .filter-row[data-filter="all"]')?.click();
      return true;
    })()`);
    await sleep(400);
    await evaluate(cdp, `(() => {
      const rows = [...document.querySelectorAll('#sidebar .file-item .file-row')];
      rows[0].click();
      rows[1].dispatchEvent(new MouseEvent('click', { bubbles: true, metaKey: true }));
      return true;
    })()`);
    await sleep(1200);
    await shot(cdp, "ities-multi-cards-desktop-pl.png");
    await evaluate(cdp, "document.getElementById('multi-compare')?.click();true");
    await sleep(1200);
    await shot(cdp, "ities-multi-compare-desktop-pl.png");
    await evaluate(cdp, "document.getElementById('multi-clear')?.click();true");
    await sleep(500);

    await setPrefs(cdp, "pl", "dark");
    await reload(cdp);
    await waitExpr(cdp, HAS_VERDICT, 180000);
    await sleep(600);
    await shot(cdp, "ities-sidebar-sections-desktop-pl-dark.png");
    await setPrefs(cdp, "pl", "light");
    await reload(cdp);
    await waitExpr(cdp, HAS_VERDICT, 180000);
    await sleep(400);
    await shot(cdp, "ities-sidebar-sections-desktop-pl-light.png");

    // ---------------------------------------------------------------- table, expert
    await setPrefs(cdp, "pl", "light");
    await reload(cdp);
    await waitExpr(cdp, HAS_VERDICT, 180000);
    // The thresholds only exist once the worker reports them, so wait for the engine
    // before shooting a screen that displays them.
    await waitExpr(cdp, ENGINE_READY, 180000);
    await evaluate(cdp, "document.getElementById('view-table').click();true");
    await sleep(500);
    await shot(cdp, "ities-table-desktop-pl.png");
    await evaluate(
      cdp,
      "document.getElementById('view-files').click();" +
        "document.getElementById('expert-mode').click();true"
    );
    await sleep(700);
    await shot(cdp, "ities-expert-desktop-pl.png");

    // Session parameters live under expert mode, so this shot belongs right here.
    await evaluate(cdp, "document.getElementById('analysis-params').open = true;true");
    await sleep(400);
    await shot(cdp, "ities-params-desktop-pl.png");
    await evaluate(
      cdp,
      "document.getElementById('analysis-params').open = false;" +
        "document.getElementById('expert-mode').click();true"
    );

    // The confirmation that a session is about to be thrown away.
    await evaluate(cdp, "(() => { document.getElementById('btn-session').click(); document.getElementById('session-clear').click(); return true; })()");
    await waitExpr(cdp, "document.getElementById('confirm-dialog').open", 10000);
    await sleep(300);
    await shot(cdp, "ities-clear-dialog-desktop-pl.png");
    await evaluate(cdp, "document.getElementById('confirm-cancel').click();true");
    await sleep(300);

    // ---------------------------------------------------------------- 1.4.0 surfaces
    // The explanation the expert switch carries, on focus alone.
    await evaluate(cdp, "document.getElementById('expert-info').focus();true");
    await waitExpr(cdp, "!document.getElementById('app-tooltip').hidden", 10000);
    await sleep(300);
    await shot(cdp, "ities-tooltip-expert-desktop-pl.png");
    await evaluate(cdp, "document.getElementById('expert-info').blur();true");

    // The algorithm version, explained from the manifest.
    await evaluate(cdp, "document.getElementById('algo-info').focus();true");
    await waitExpr(cdp, "!document.getElementById('app-tooltip').hidden", 10000);
    await sleep(300);
    await shot(cdp, "ities-tooltip-algo-desktop-pl.png");
    await evaluate(cdp, "document.getElementById('algo-info').blur();true");
    await sleep(200);

    // The session menu with its name field and the saved sessions.
    await evaluate(cdp, "document.getElementById('btn-session').click();true");
    await waitExpr(cdp, "document.getElementById('session-menu').classList.contains('is-open')", 10000);
    await sleep(400);
    await shot(cdp, "ities-session-menu-desktop-pl.png");
    await evaluate(cdp, "document.getElementById('btn-session').click();true");
    await sleep(200);

    // A folder of one's own with its statistics row.
    await evaluate(cdp, "document.querySelector('.new-folder-button').click();true");
    await waitExpr(cdp, "!!document.querySelector('.folder-create-input')", 10000);
    await evaluate(cdp, `(() => {
      const input = document.querySelector('.folder-create-input');
      input.value = 'Seria 17.09';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      return true;
    })()`);
    await waitExpr(cdp, "!!document.querySelector('.tree-folder')", 10000);
    await evaluate(cdp, "document.querySelector('.file-item .row-menu-trigger').click();true");
    await waitExpr(cdp, "document.getElementById('move-menu').open", 10000);
    await evaluate(cdp, `(() => {
      const item = [...document.querySelectorAll('#move-menu-list button')]
        .find((button) => button.textContent === 'Seria 17.09');
      item.click();
      return true;
    })()`);
    await waitExpr(cdp, "!!document.querySelector('.tree-folder .file-item')", 10000);
    await sleep(400);
    await shot(cdp, "ities-user-folder-desktop-pl.png");

    // The footer with the partner logos, in both themes. Whole window, because a
    // clipped capture of the bar came back empty and a picture has to be checkable.
    await shot(cdp, "ities-footer-desktop-pl-light.png");
    await setPrefs(cdp, "pl", "dark");
    await reload(cdp);
    await waitExpr(cdp, ENGINE_READY, 180000);
    await sleep(600);
    await shot(cdp, "ities-footer-desktop-pl-dark.png");
    await setPrefs(cdp, "pl", "light");
    await reload(cdp);
    await waitExpr(cdp, ENGINE_READY, 180000);
    await sleep(400);

    // ---------------------------------------------------------------- peaks, pointing mode
    // A measurement with the standard but no analyte pair: the panel that offers to
    // point at the missing peaks.
    await clearThroughUi(cdp);
    await setInputFiles(cdp, [TPRA_ONLY_FILE]);
    await waitExpr(cdp, HAS_VERDICT, 180000);
    await waitExpr(cdp, ENGINE_READY, 180000);
    // The progress window would sit on top of the panel this shot is about.
    await evaluate(cdp, "document.getElementById('progress-close').click();true");
    await sleep(300);
    await evaluate(cdp, "document.getElementById('expert-mode').click();true");
    await sleep(500);
    await shot(cdp, "ities-peaks-desktop-pl.png");
    await evaluate(cdp, "document.querySelector('.seed-analyte')?.click();true");
    await sleep(500);
    await shot(cdp, "ities-pick-desktop-pl.png");
    await evaluate(cdp, "document.getElementById('expert-mode').click();true");
    await clearThroughUi(cdp);

    // ---------------------------------------------------------------- folder upload
    // Chrome refuses DOM.setFileInputFiles on a webkitdirectory input, so the staged
    // files are loaded into a throwaway input and handed to the app exactly the way a
    // browser would: once as a FileList with webkitRelativePath, once as dropped
    // FileSystemEntry objects. Both are the app's own code paths, not a shortcut.
    await evaluate(cdp, "indexedDB.deleteDatabase('ities-detect');true");
    await setPrefs(cdp, "pl", "light");
    await reload(cdp);
    await waitExpr(cdp, ENGINE_READY);
    await evaluate(
      cdp,
      `window.__relmap = ${JSON.stringify(folder.map)};
       Object.defineProperty(File.prototype, 'webkitRelativePath', {
         configurable: true,
         get() { return window.__relmap[this.name] || this.name; }
       });
       const probe = document.createElement('input');
       probe.type = 'file';
       probe.id = '__probe';
       probe.multiple = true;
       probe.style.position = 'absolute';
       probe.style.left = '-9999px';
       document.body.appendChild(probe);
       true`
    );
    const doc = await cdp.send("DOM.getDocument", { depth: 1 });
    const probe = await cdp.send("DOM.querySelector", {
      nodeId: doc.root.nodeId,
      selector: "#__probe",
    });
    await cdp.send("DOM.setFileInputFiles", { nodeId: probe.nodeId, files: folder.paths });
    await evaluate(
      cdp,
      `const input = document.getElementById('folder-input');
       input.files = document.getElementById('__probe').files;
       input.dispatchEvent(new Event('change', { bubbles: true }));
       true`
    );
    await waitExpr(
      cdp,
      "!!document.querySelector('.tree-folder') && " +
        "document.querySelectorAll('.file-row').length > 40",
      60000
    );
    await waitExpr(cdp, ENGINE_READY, 600000);
    await sleep(700);
    await shot(cdp, "ities-folder-desktop-pl.png");
    const folderStats = await evaluate(
      cdp,
      `JSON.stringify({
         files: document.querySelectorAll('.file-row').length,
         counter: document.querySelector('#sidebar .list-summary-top').textContent,
         folder: document.querySelector('.tree-folder-head') && document.querySelector('.tree-folder-head').textContent,
         rollup: document.querySelector('.folder-counts') && document.querySelector('.folder-counts').textContent,
         subfolderFiles: [...document.querySelectorAll('.file-name')].filter(n => n.textContent.includes('seria_2')).length
       })`
    );
    report.push("folder via input: " + folderStats);

    // The drop path: fabricated FileSystemEntry objects over the same real files.
    await evaluate(cdp, "indexedDB.deleteDatabase('ities-detect');true");
    await reload(cdp);
    await waitExpr(cdp, ENGINE_READY);
    await evaluate(
      cdp,
      `window.__relmap = ${JSON.stringify(folder.map)};
       const probe = document.createElement('input');
       probe.type = 'file';
       probe.id = '__probe';
       probe.multiple = true;
       probe.style.position = 'absolute';
       probe.style.left = '-9999px';
       document.body.appendChild(probe);
       true`
    );
    const doc2 = await cdp.send("DOM.getDocument", { depth: 1 });
    const probe2 = await cdp.send("DOM.querySelector", {
      nodeId: doc2.root.nodeId,
      selector: "#__probe",
    });
    await cdp.send("DOM.setFileInputFiles", { nodeId: probe2.nodeId, files: folder.paths });
    const dropped = await evaluate(
      cdp,
      `(() => {
         const files = [...document.getElementById('__probe').files];
         const fileEntry = (file, name) => ({
           isFile: true, isDirectory: false, name,
           file: (cb) => cb(file),
         });
         const dirEntry = (name, children) => ({
           isFile: false, isDirectory: true, name,
           createReader() {
             let sent = false;
             return { readEntries(cb) { cb(sent ? [] : children); sent = true; } };
           },
         });
         const rootFiles = [];
         const subFiles = [];
         for (const file of files) {
           const rel = window.__relmap[file.name] || file.name;
           (rel.includes('/seria_2/') ? subFiles : rootFiles).push(fileEntry(file, file.name));
         }
         const root = dirEntry('Neutrale', rootFiles.concat([dirEntry('seria_2', subFiles)]));
         const event = new Event('drop', { bubbles: true, cancelable: true });
         Object.defineProperty(event, 'dataTransfer', {
           value: { items: [{ webkitGetAsEntry: () => root }], files: [] },
         });
         document.getElementById('content').dispatchEvent(event);
         return rootFiles.length + '+' + subFiles.length;
       })()`
    );
    await waitExpr(
      cdp,
      "!!document.querySelector('.tree-folder') && " +
        "document.querySelectorAll('.file-row').length > 40",
      60000
    );
    await waitExpr(cdp, ENGINE_READY, 600000);
    const dropStats = await evaluate(
      cdp,
      `JSON.stringify({
         files: document.querySelectorAll('.file-row').length,
         counter: document.querySelector('#sidebar .list-summary-top').textContent,
         rollup: document.querySelector('.folder-counts') && document.querySelector('.folder-counts').textContent,
         subfolderFiles: [...document.querySelectorAll('.file-name')].filter(n => n.textContent.includes('seria_2')).length
       })`
    );
    report.push("folder via drop (" + dropped + " entries): " + dropStats);

    // ---------------------------------------------------------------- versions
    for (const lang of ["en", "pl"]) {
      await setPrefs(cdp, lang, "light");
      await go(cdp, BASE + "/ities/versions.html");
      await sleep(800);
      await shot(cdp, `versions-desktop-${lang}.png`);
    }

    // The logo preview, opened from the sidebar header.
    await evaluate(cdp, "document.querySelector('#sidebar .app-mark')?.click();true");
    await sleep(700);
    await shot(cdp, "ities-logo-preview-desktop-pl.png");
    await evaluate(cdp, "document.querySelector('dialog.logo-lightbox')?.close();true");
    await sleep(300);

    // ------------------------------------------- the way back from a versions page
    // Reached the way a person reaches it, from the application, so the page has a
    // referrer and can offer the button back (addendum AA).
    await setPrefs(cdp, "pl", "light");
    await go(cdp, BASE + "/ities/");
    await waitExpr(cdp, ENGINE_READY, 180000);
    await evaluate(cdp, `(() => {
      document.querySelector('.status-right a[href="/ities/versions.html"]').click();
      return true;
    })()`);
    await sleep(1500);
    await shot(cdp, "ities-versions-back-desktop-pl.png");
    const itiesBack = await evaluate(
      cdp,
      "JSON.stringify({ back: !!document.getElementById('back-to-app'), href: document.getElementById('back-to-app')?.getAttribute('href') })"
    );
    report.push("ITIES versions back link: " + itiesBack);

    await go(cdp, BASE + "/peakwise/");
    await sleep(1500);
    await shot(cdp, "peakwise-desktop-pl.png");
    await evaluate(cdp, `(() => {
      document.querySelector('a[href="/peakwise/versions.html"]').click();
      return true;
    })()`);
    await sleep(1500);
    await shot(cdp, "peakwise-versions-back-desktop-pl.png");
    const peakwiseBack = await evaluate(
      cdp,
      "JSON.stringify({ back: !!document.getElementById('back-to-app'), href: document.getElementById('back-to-app')?.getAttribute('href') })"
    );
    report.push("PeakWise versions back link: " + peakwiseBack);

    // ---------------------------------------------------------------- mobile
    await setViewport(cdp, 390, 844);
    for (const lang of ["en", "pl"]) {
      await setPrefs(cdp, lang, "light");
      await go(cdp, BASE + "/");
      await sleep(600);
      await shot(cdp, `hub-mobile-${lang}.png`);
    }
    await go(cdp, BASE + "/ities/");
    await evaluate(cdp, "indexedDB.deleteDatabase('ities-detect');true");
    await setPrefs(cdp, "pl", "light");
    await reload(cdp);
    await waitExpr(cdp, ENGINE_READY);
    await sleep(300);
    await shot(cdp, "ities-empty-mobile-pl.png");
    await loadThreeFiles(cdp);
    // On a narrow screen the drawer opens itself after an upload; close it so the shot
    // shows the result rather than the list that was just filled.
    await evaluate(cdp, "document.getElementById('backdrop').click();true");
    await sleep(400);
    await shot(cdp, "ities-result-mobile-pl-light.png");
    await setPrefs(cdp, "en", "dark");
    await reload(cdp);
    await waitExpr(cdp, HAS_VERDICT, 180000);
    await sleep(600);
    await shot(cdp, "ities-result-mobile-en-dark.png");
    await evaluate(cdp, "document.getElementById('view-table').click();true");
    await sleep(500);
    await shot(cdp, "ities-table-mobile-en.png");
    // The toolbar at 390 px: the list and home icons plus the menus, no sideways scroll.
    await setPrefs(cdp, "pl", "light");
    await evaluate(cdp, "document.getElementById('view-files').click();true");
    await reload(cdp);
    await waitExpr(cdp, HAS_VERDICT, 180000);
    await sleep(600);
    await shot(cdp, "ities-toolbar-mobile-pl.png");
    const mobileOverflow = await evaluate(
      cdp,
      "JSON.stringify({ scrollWidth: document.documentElement.scrollWidth, inner: window.innerWidth })"
    );
    report.push("mobile horizontal overflow check: " + mobileOverflow);

    report.push("console errors: " + (cdp.errors.length ? cdp.errors.join(" | ") : "none"));
    cdp.close();
  } finally {
    try {
      chrome.kill("SIGTERM");
    } catch (_) {
      /* already gone */
    }
    await server.stopAndWait();
    await sleep(300);
    // The 45 staged copies are lab data; they exist only for the run.
    fs.rmSync(FOLDER_STAGE, { recursive: true, force: true });
  }
  // Only the test port is inspected, and only with lsof: the owner's 20412 is never
  // touched by these runs.
  let orphans = "";
  try {
    orphans = execFileSync("lsof", ["-nP", `-iTCP:${TEST_PORT}`], { encoding: "utf8" }).trim();
  } catch (_) {
    orphans = "";
  }
  report.push("screenshots written: " + screenshotCount);
  report.push("gunicorn left running: " + (orphans || "none"));
  console.log("\n" + report.join("\n"));
  if (orphans) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
