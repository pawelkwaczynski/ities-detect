#!/usr/bin/env node
// Headless Chrome screenshots via CDP. Kills Chrome on exit.
// Covers both languages, both themes and the folder upload path, and reports every
// console error the pages produced, so a broken build cannot pass as a picture.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const WebSocket = require("ws");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const OUT = path.join(ROOT, "screenshots");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9222;
const BASE = "http://127.0.0.1:20412";
const LAB = path.resolve(ROOT, "../07_etykiety_lab_20260916");
const STAGE = path.join(OUT, ".files");
const FOLDER_STAGE = path.join(OUT, ".folder");

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
  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
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

async function setViewport(cdp, width, height, mobile) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: mobile ? 2 : 1,
    mobile,
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
  "!!document.querySelector('.verdict-badge') && document.querySelector('.verdict-badge').textContent.length > 2";

async function loadThreeFiles(cdp) {
  const doc = await cdp.send("DOM.getDocument", { depth: 1 });
  const q = await cdp.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "#file-input" });
  await cdp.send("DOM.setFileInputFiles", { nodeId: q.nodeId, files: FILES });
  await waitExpr(cdp, HAS_VERDICT, 180000);
  await waitExpr(cdp, ENGINE_READY, 180000);
  await sleep(500);
}

async function main() {
  const folder = stageFolder();
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${path.join(OUT, ".chrome")}`,
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  const kill = () => {
    try {
      chrome.kill("SIGTERM");
    } catch (_) {}
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

    // ---------------------------------------------------------------- hub
    await setViewport(cdp, 1440, 900, false);
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
    await waitExpr(cdp, ENGINE_READY);
    await sleep(300);
    await shot(cdp, "ities-empty-desktop-en.png");

    // ------------------------------------------------- result, both languages and themes
    await loadThreeFiles(cdp);
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

    // ---------------------------------------------------------------- table, expert
    await setPrefs(cdp, "pl", "light");
    await reload(cdp);
    await waitExpr(cdp, HAS_VERDICT, 180000);
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
         counter: document.getElementById('file-count').textContent,
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
         counter: document.getElementById('file-count').textContent,
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

    // ---------------------------------------------------------------- mobile
    await setViewport(cdp, 390, 844, true);
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
    await shot(cdp, "ities-result-mobile-pl-light.png");
    await setPrefs(cdp, "en", "dark");
    await reload(cdp);
    await waitExpr(cdp, HAS_VERDICT, 180000);
    await sleep(600);
    await shot(cdp, "ities-result-mobile-en-dark.png");
    await evaluate(cdp, "document.getElementById('view-table').click();true");
    await sleep(500);
    await shot(cdp, "ities-table-mobile-en.png");

    report.push("console errors: " + (cdp.errors.length ? cdp.errors.join(" | ") : "none"));
    cdp.close();
  } finally {
    kill();
    await sleep(300);
  }
  console.log("\n" + report.join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
