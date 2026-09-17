#!/usr/bin/env node
// PeakWise mini smoke test: the shell of version 1.1, step by step, in headless Chrome.
//
// Sibling of tools/ui_smoke.mjs, which does the same job for ITIES Detect and is far
// larger. This one only proves that the frame PeakWise borrowed from ITIES Detect 1.4 is
// wired: login, three reference files, the counters in the status bar, a filter from the
// source list, the Session menu, the logo preview, and the back arrow on the version
// history page.
//
// It starts and stops its own gunicorn on ITIES_TEST_PORT (20414 here). Ports 20412 and
// 20413 belong to other people and are never touched.
//
// Every step prints PASS or FAIL and the run exits 1 on the first FAIL, so a broken
// shell cannot pass as green. Set PW_SMOKE_BREAK to a step name to prove the test can
// fail: that step then checks for something the page does not have.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { loginInBrowser, startTestServer } from "./test_server_boot.mjs";

const require = createRequire(import.meta.url);
const WebSocket = require("ws");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CDP_PORT = Number(process.env.PW_SMOKE_CDP_PORT || 9226);
const TEST_PORT = Number(process.env.ITIES_TEST_PORT || 20414);
const HURNY = "/Users/pawelkwaczynski/Desktop/claude_brain/projekty/HURNY";
// The same source directory tools/screenshots_peakwise.mjs uses, first three scans.
const SOURCE = "SPE iterations/LEYER HEIGHT/0,24/0,24 A";
const WORK = path.join(ROOT, "screenshots", ".peakwise-smoke");
const BREAK = process.env.PW_SMOKE_BREAK || "";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const problems = [];
const results = [];

function stageFiles() {
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(WORK, { recursive: true });
  const dir = path.join(HURNY, SOURCE);
  const staged = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (staged.length === 3) break;
    const src = path.join(dir, name);
    if (!fs.statSync(src).isFile() || name.endsWith(".png")) continue;
    const dest = path.join(WORK, name.replace(/[/\\]/g, "_") + (name.endsWith(".txt") ? "" : ".txt"));
    fs.copyFileSync(src, dest);
    staged.push(dest);
  }
  if (staged.length !== 3) throw new Error("expected three reference files, staged " + staged.length);
  return staged;
}

class Cdp {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.seq = 0;
    this.pending = new Map();
  }
  async open() {
    this.ws = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.ws.once("open", resolve);
      this.ws.once("error", reject);
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
        problems.push("exception: " + (msg.params?.exceptionDetails?.text || "unknown"));
      }
      if (msg.method === "Log.entryAdded" && msg.params?.entry?.level === "error") {
        const entry = msg.params.entry;
        // The partner logos are not in this checkout (static/assets/partners is empty),
        // and shared/partners.js is built to drop a logo that does not load. That 404
        // is a missing file, not a broken page, so it does not fail the run. Every
        // other console error does.
        // /favicon.ico is asked for by the login page, which declares no icon. Neither
        // 404 belongs to PeakWise, so both are skipped by URL, never by message text.
        const url = String(entry.url || "");
        if (url.includes("/assets/partners/") || url.endsWith("/favicon.ico")) return;
        problems.push("console: " + entry.text + " " + url);
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
    try {
      this.ws.close();
    } catch (_) {
      /* already closed */
    }
  }
}

async function evaluate(cdp, expression) {
  const res = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.text);
  return res.result?.value;
}

async function goto(cdp, url) {
  await cdp.send("Page.navigate", { url });
  await sleep(900);
}

async function waitExpr(cdp, expression, timeoutMs = 90000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await evaluate(cdp, expression).catch(() => false);
    if (value) return value;
    await sleep(400);
  }
  throw new Error("timeout waiting for " + expression);
}

async function waitJson(url) {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return res.json();
    } catch (_) {
      /* chrome is still starting */
    }
    await sleep(200);
  }
  throw new Error("no answer from " + url);
}

// One named check. `probe` returns the value, `ok` decides. A step named in
// PW_SMOKE_BREAK is asked for something that does not exist, which must turn it red.
async function step(name, probe, ok) {
  let value;
  let passed = false;
  try {
    value = await probe();
    passed = name === BREAK ? false : ok(value);
  } catch (err) {
    value = String(err.message || err);
  }
  results.push({ name, passed, value });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}  ${JSON.stringify(value).slice(0, 160)}`);
  if (!passed) throw new Error("step failed: " + name);
}

async function main() {
  const files = stageFiles();
  const server = await startTestServer({ port: TEST_PORT });
  const base = server.base;
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${CDP_PORT}`,
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${path.join(WORK, ".chrome")}`,
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  const killChrome = () => {
    try {
      chrome.kill("SIGTERM");
    } catch (_) {
      /* already gone */
    }
  };

  let failed = false;
  try {
    let page = null;
    for (let i = 0; i < 30 && !page; i += 1) {
      const list = await waitJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
      page = list.find((tab) => tab.type === "page" && tab.webSocketDebuggerUrl);
      if (!page) await sleep(150);
    }
    if (!page) throw new Error("no page target");
    const cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("DOM.enable");

    // 1. login ------------------------------------------------------------------
    await goto(cdp, `${base}/login`);
    await step(
      "login",
      () => loginInBrowser(cdp, { evaluate, goto }, server, base),
      (value) => value === true
    );

    await goto(cdp, `${base}/peakwise/`);
    await evaluate(cdp, "indexedDB.deleteDatabase('peakwise');true");
    await evaluate(cdp, "localStorage.setItem('analizatory-lang','en');true");
    await cdp.send("Page.reload", { ignoreCache: false });
    await sleep(900);
    await waitExpr(cdp, "document.getElementById('engine-status').textContent.toLowerCase().includes('ready')");

    // 2. three reference files --------------------------------------------------
    const doc = await cdp.send("DOM.getDocument", { depth: 1 });
    const input = await cdp.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "#file-input" });
    await cdp.send("DOM.setFileInputFiles", { nodeId: input.nodeId, files });
    await waitExpr(cdp, "document.querySelectorAll('.file-row').length === 3");
    await waitExpr(cdp, "!!document.querySelector('.result-word')");
    await step(
      "three files analysed",
      () =>
        evaluate(
          cdp,
          "JSON.stringify({rows: document.querySelectorAll('.file-row').length," +
            " chips: document.querySelectorAll('.file-row .chip').length})"
        ),
      (value) => {
        const data = JSON.parse(value);
        return data.rows === 3 && data.chips === 3;
      }
    );

    // 3. the status bar under the toolbar ---------------------------------------
    await step(
      "summary bar counters",
      () =>
        evaluate(
          cdp,
          "JSON.stringify({hidden: document.getElementById('summary-bar').hidden," +
            " pills: document.querySelectorAll('#summary-bar .stat-pill').length," +
            " total: document.querySelector('#summary-bar .summary-total strong').textContent," +
            " sum: [...document.querySelectorAll('#summary-bar .stat-count')]" +
            "        .reduce((a, b) => a + Number(b.textContent), 0)})"
        ),
      (value) => {
        const data = JSON.parse(value);
        return data.hidden === false && data.pills === 4 && data.total === "3" && data.sum === 3;
      }
    );

    // 4. a filter picked from the source list ------------------------------------
    await step(
      "filter from the sidebar list",
      async () => {
        const before = await evaluate(cdp, "document.querySelectorAll('.file-row').length");
        await evaluate(
          cdp,
          "document.querySelector('.filter-row[data-filter=\"unreadable\"]').click();true"
        );
        await sleep(300);
        const after = await evaluate(cdp, "document.querySelectorAll('.file-row').length");
        const selected = await evaluate(
          cdp,
          "document.querySelector('.filter-row.is-selected').dataset.filter"
        );
        await evaluate(cdp, "document.querySelector('.filter-row[data-filter=\"all\"]').click();true");
        await sleep(300);
        const back = await evaluate(cdp, "document.querySelectorAll('.file-row').length");
        return JSON.stringify({ before, after, selected, back });
      },
      (value) => {
        const data = JSON.parse(value);
        return data.before === 3 && data.after === 0 && data.selected === "unreadable" && data.back === 3;
      }
    );

    // 5. the Session menu --------------------------------------------------------
    await step(
      "session menu",
      async () => {
        await evaluate(cdp, "document.getElementById('btn-session').click();true");
        await sleep(250);
        const open = await evaluate(
          cdp,
          "JSON.stringify({open: document.getElementById('session-menu').classList.contains('is-open')," +
            " items: document.querySelectorAll('#session-menu .menu-list button[role=\"menuitem\"]').length," +
            " clearEnabled: !document.getElementById('session-clear').disabled})"
        );
        await evaluate(cdp, "document.getElementById('btn-session').click();true");
        return open;
      },
      (value) => {
        const data = JSON.parse(value);
        return data.open === true && data.items === 4 && data.clearEnabled === true;
      }
    );

    // 6. the logo preview --------------------------------------------------------
    await step(
      "logo preview",
      async () => {
        await evaluate(cdp, "document.querySelector('.sidebar-head .app-mark').click();true");
        await sleep(350);
        const state = await evaluate(
          cdp,
          "JSON.stringify({open: !!document.querySelector('dialog.logo-lightbox[open]')," +
            " src: (document.querySelector('.logo-lightbox-image') || {}).getAttribute" +
            "   ? document.querySelector('.logo-lightbox-image').getAttribute('src') : null})"
        );
        await evaluate(
          cdp,
          "const d = document.querySelector('dialog.logo-lightbox[open]'); if (d) d.close(); true"
        );
        return state;
      },
      (value) => {
        const data = JSON.parse(value);
        return data.open === true && String(data.src).includes("peakwise_icon");
      }
    );

    // 7. the back arrow on the version history page ------------------------------
    await step(
      "back arrow on versions.html",
      async () => {
        await evaluate(cdp, "document.querySelector('a[href=\"/peakwise/versions.html\"]').click();true");
        await sleep(1200);
        return evaluate(
          cdp,
          "JSON.stringify({here: location.pathname," +
            " back: (document.getElementById('back-to-app') || {}).getAttribute" +
            "   ? document.getElementById('back-to-app').getAttribute('href') : null," +
            " appRows: document.querySelectorAll('#app-table tbody tr').length," +
            " top: (document.querySelector('#app-table tbody tr td') || {}).textContent || ''})"
        );
      },
      (value) => {
        const data = JSON.parse(value);
        return (
          data.here === "/peakwise/versions.html" &&
          data.back === "/peakwise/" &&
          data.appRows >= 2 &&
          data.top.startsWith("1.1.0")
        );
      }
    );

    await step(
      "no console errors",
      () => [...new Set(problems)].join(" | "),
      (value) => value === ""
    );
    cdp.close();
  } catch (_) {
    failed = true;
  } finally {
    killChrome();
    await sleep(300);
    await server.stopAndWait();
    // Staged copies are lab data; they exist only for the run.
    fs.rmSync(WORK, { recursive: true, force: true });
  }

  const passed = results.filter((r) => r.passed).length;
  console.log(`\n${passed} of ${results.length} steps passed`);
  if (problems.length) {
    console.error("Browser problems:");
    for (const problem of [...new Set(problems)]) console.error(" -", problem);
  }
  if (failed || passed !== results.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
