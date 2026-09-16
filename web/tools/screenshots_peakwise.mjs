#!/usr/bin/env node
// Headless Chrome screenshots over CDP for the hub after the PeakWise tile went live, and
// for PeakWise itself served from this deployment. A smoke test at the same time: every
// console error and every uncaught exception is collected and printed at the end.
//
// tools/screenshots.mjs covers the hub and ITIES Detect in full and takes minutes, because
// it walks the folder-upload path over 45 lab files. This one only re-shoots what the
// PeakWise integration changed: the four hub pictures, which still showed a "soon" badge,
// and the PeakWise screens, which had never been shot from this server.
//
// The server has to be running:  server/start.sh   (http://127.0.0.1:20412)
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
const PORT = 9224;
const BASE = "http://127.0.0.1:20412";
const HURNY = path.resolve(ROOT, "../../../HURNY");
// Its own staging directory: screenshots/.files belongs to tools/screenshots.mjs.
const STAGE = path.join(OUT, ".peakwise-files");

// Two electrodes, four scans each, so the list shows grouping and the table has rows.
const SOURCES = ["SPE iterations/LEYER HEIGHT/0,24/0,24 A", "SPE iterations/WE/4mm/4 mm A"];

const ENGINE_READY_EN = "document.getElementById('engine-status').textContent.toLowerCase().includes('ready')";
const HAS_RESULT =
  "!!document.querySelector('.result-word') && document.querySelector('.result-word').textContent.length > 2";

fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(STAGE, { recursive: true, force: true });
fs.mkdirSync(STAGE, { recursive: true });

const FILES = [];
for (const rel of SOURCES) {
  const dir = path.join(HURNY, rel);
  for (const name of fs.readdirSync(dir)) {
    const src = path.join(dir, name);
    if (!fs.statSync(src).isFile() || name.endsWith(".png")) continue;
    const dest = path.join(STAGE, name.replace(/[/\\]/g, "_") + (name.endsWith(".txt") ? "" : ".txt"));
    fs.copyFileSync(src, dest);
    FILES.push(dest);
  }
}
if (!FILES.length) throw new Error("no sample files staged");

const problems = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.seq = 0;
    this.pending = new Map();
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
        problems.push("exception: " + (d?.exception?.description || d?.text || "unknown"));
      }
      if (msg.method === "Runtime.consoleAPICalled" && msg.params?.type === "error") {
        problems.push("console.error: " + (msg.params.args || []).map((a) => a.value ?? a.description).join(" "));
      }
      if (msg.method === "Log.entryAdded" && msg.params?.entry?.level === "error") {
        problems.push("log: " + msg.params.entry.text + " " + (msg.params.entry.url || ""));
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
  fs.writeFileSync(path.join(OUT, name), Buffer.from(data, "base64"));
  console.log("wrote", name);
}

async function evaluate(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return r.result?.value;
}

async function waitExpr(cdp, expr, timeoutMs = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await cdp.send("Runtime.evaluate", { expression: expr, returnByValue: true });
    if (r.result?.value) return r.result.value;
    await sleep(400);
  }
  throw new Error("timeout waiting for " + expr);
}

async function setViewport(cdp, width, height, mobile) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: mobile ? 2 : 1,
    mobile,
  });
}

async function uploadAndAnalyse(cdp) {
  const doc = await cdp.send("DOM.getDocument", { depth: 1 });
  const q = await cdp.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "#file-input" });
  await cdp.send("DOM.setFileInputFiles", { nodeId: q.nodeId, files: FILES });
  await waitExpr(cdp, HAS_RESULT);
  await waitExpr(cdp, ENGINE_READY_EN);
  await sleep(700);
}

async function main() {
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${path.join(OUT, ".chrome-peakwise")}`,
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  const kill = () => {
    try {
      chrome.kill("SIGTERM");
    } catch (_) {
      /* already gone */
    }
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
      page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl) || list.find((t) => t.webSocketDebuggerUrl);
      if (!page) await sleep(150);
    }
    if (!page?.webSocketDebuggerUrl) throw new Error("no page target");
    const cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("DOM.enable");

    const go = async (url) => {
      await cdp.send("Page.navigate", { url });
      await sleep(900);
    };
    const setPrefs = async (lang, theme) =>
      evaluate(
        cdp,
        `localStorage.setItem('analizatory-lang','${lang}');localStorage.setItem('ities-theme','${theme}');true`
      );
    const reload = async () => {
      await cdp.send("Page.reload", { ignoreCache: false });
      await sleep(900);
    };

    // ------------------------------------------------------------------ hub, desktop
    await setViewport(cdp, 1440, 900, false);
    await go(BASE + "/");
    for (const lang of ["en", "pl"]) {
      await setPrefs(lang, "light");
      await reload();
      await sleep(400);
      await shot(cdp, `hub-desktop-${lang}.png`);
    }
    // The badge has to come from the manifest, not from the fallback text in the markup.
    report.push(
      "hub tile: " +
        (await evaluate(
          cdp,
          `JSON.stringify({
             href: document.querySelector('.hub-tiles a[href="/peakwise/"]') &&
                   document.querySelector('.hub-tiles a[href="/peakwise/"]').getAttribute('href'),
             badge: document.getElementById('peakwise-ver').textContent,
             desc: document.querySelector('[data-i18n="hub.peakwise.desc"]').textContent,
             soon: document.querySelectorAll('.is-soon').length
           })`
        ))
    );

    // ------------------------------------------------------------- PeakWise, desktop
    await go(BASE + "/peakwise/");
    await evaluate(cdp, "indexedDB.deleteDatabase('peakwise');true");
    await setPrefs("en", "light");
    await reload();
    await waitExpr(cdp, ENGINE_READY_EN);
    await sleep(500);
    await shot(cdp, "peakwise-empty-desktop-en.png");

    await uploadAndAnalyse(cdp);
    await shot(cdp, "peakwise-result-desktop-en-light.png");
    report.push("engine status: " + (await evaluate(cdp, "document.getElementById('engine-status').textContent")));

    // Polish and dark come from the keys the hub writes, so this shot is the proof that
    // one language and one theme really carry across the two apps.
    await setPrefs("pl", "dark");
    await reload();
    await waitExpr(cdp, HAS_RESULT);
    await sleep(800);
    await shot(cdp, "peakwise-result-desktop-pl-dark.png");
    report.push(
      "prefs carried over: " +
        (await evaluate(
          cdp,
          `JSON.stringify({
             theme: document.documentElement.getAttribute('data-theme'),
             lang: localStorage.getItem('analizatory-lang'),
             addButton: document.getElementById('btn-add').textContent
           })`
        ))
    );

    await evaluate(cdp, "document.getElementById('view-table').click();true");
    await sleep(500);
    await shot(cdp, "peakwise-table-desktop-pl-dark.png");

    // ------------------------------------------------------------------- mobile
    await setViewport(cdp, 390, 844, true);
    for (const lang of ["en", "pl"]) {
      await setPrefs(lang, "light");
      await go(BASE + "/");
      await sleep(600);
      await shot(cdp, `hub-mobile-${lang}.png`);
    }

    await setPrefs("en", "light");
    await go(BASE + "/peakwise/");
    await waitExpr(cdp, HAS_RESULT);
    await waitExpr(cdp, ENGINE_READY_EN);
    // On a narrow screen the drawer opens over the result; close it so the shot shows
    // the card rather than the file list.
    await evaluate(cdp, "const b = document.getElementById('backdrop'); if (b && !b.hidden) b.click(); true");
    await sleep(600);
    await shot(cdp, "peakwise-result-mobile-en-light.png");

    report.push("console errors: " + (problems.length ? [...new Set(problems)].join(" | ") : "none"));
    cdp.close();
  } finally {
    kill();
    await sleep(300);
    // The staged copies are lab data; they exist only for the run.
    fs.rmSync(STAGE, { recursive: true, force: true });
  }

  console.log();
  for (const line of report) console.log(line);
  if (problems.length) {
    console.error("\nBrowser problems:");
    for (const p of [...new Set(problems)]) console.error(" -", p);
    process.exit(1);
  }
  console.log("\nno console errors, no uncaught exceptions");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
