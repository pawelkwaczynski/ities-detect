#!/usr/bin/env node
// ITIES Detect 1.3.0 browser smoke test through Chrome DevTools Protocol.
//
// Every step prints PASS or FAIL, a browser console error fails the run, and the exit
// code is 1 on any failure. The app is driven through its own controls: file inputs,
// buttons and real mouse events, never through internal functions.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { loginInBrowser, startTestServer, TEST_PORT } from "./test_server_boot.mjs";

const require = createRequire(import.meta.url);
const WebSocket = require("ws");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const LAB = path.resolve(ROOT, "../07_etykiety_lab_20260916");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// Filled by startTestServer(): the smoke test brings up its own gunicorn with a
// throwaway login, so it never touches the real server/auth.local.json.
let BASE = `http://127.0.0.1:${TEST_PORT}`;
const PORT = 9223;
const STAGE = path.join(ROOT, "screenshots/.ui-smoke-files");
const PROFILE = path.join(ROOT, "screenshots/.ui-smoke-chrome");
const OUT = path.join(ROOT, "tools/_ui_smoke_last.json");

const CASES = [
  ["Pozytywne/93P_300ul_TPra(1).txt", "93P_300ul_TPra(1).txt"],
  ["Negatywy/BRB pH 7 CV 50uM codeine + 50uM TPrA.txt", "BRB pH 7 CV 50uM codeine + 50uM TPrA.txt"],
  ["Neutrale/132-1_blank(2).txt", "132-1_blank(2).txt"],
];
const TPRA_ONLY = "BRB pH 10 CV 50uM codeine + 50uM TPrA 2.txt";
// A standard without an analyte pair, where a technician can point at a place that
// carries almost no prominence: the case behind the below threshold warning.
const WEAK_POINT_FILE = "4.74_1400ul_TPrA(1).txt";
// Two files the algorithm marks for review, far apart in a long list: what "Next for
// review" has to jump between, with the list following the jump.
const REVIEW_PAIR = ["6.6_500ul_TPrA(1).txt", "Komercja_52_1_3 100uL_IM20uL(1).txt"];
const FILLER_COUNT = 22;
const ENGINE_READY = "/Silnik gotowy/.test(document.getElementById('engine-status')?.textContent || '')";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    await new Promise((resolve, reject) => {
      this.ws.once("open", resolve);
      this.ws.once("error", reject);
    });
    this.ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.id && this.pending.has(msg.id)) {
        const pending = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) pending.reject(new Error(JSON.stringify(msg.error)));
        else pending.resolve(msg.result);
        return;
      }
      if (msg.method === "Runtime.exceptionThrown") {
        const detail = msg.params?.exceptionDetails;
        this.errors.push(detail?.exception?.description || detail?.text || "browser exception");
      }
      if (msg.method === "Runtime.consoleAPICalled" && msg.params?.type === "error") {
        this.errors.push(
          (msg.params.args || []).map((arg) => arg.description || arg.value || arg.type).join(" ")
        );
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

async function waitJson(url, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (_) {
      // Chrome is still starting.
    }
    await sleep(150);
  }
  throw new Error(`CDP not ready: ${url}`);
}

async function evaluate(cdp, expression) {
  const response = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  }
  return response.result?.value;
}

async function waitExpr(cdp, expression, timeoutMs = 180000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    try {
      if (await evaluate(cdp, expression)) return;
      last = null;
    } catch (error) {
      // A navigation can destroy the context under our feet; keep polling.
      last = error;
    }
    await sleep(250);
  }
  throw new Error(`timeout waiting for ${expression}${last ? ` (last error ${last.message})` : ""}`);
}

// localStorage belongs to the page origin. Reading it on about:blank throws a
// SecurityError, so nothing touches storage before the document is really there.
async function goto(cdp, url) {
  await cdp.send("Page.navigate", { url });
  await waitExpr(
    cdp,
    `location.href.startsWith(${JSON.stringify(url)}) && document.readyState !== 'loading'`,
    30000
  );
}

async function reload(cdp) {
  await cdp.send("Page.reload", { ignoreCache: false });
  await sleep(300);
  await waitExpr(cdp, "document.readyState !== 'loading'", 30000);
}

async function setFiles(cdp, selector, files) {
  const doc = await cdp.send("DOM.getDocument", { depth: 1 });
  const node = await cdp.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector });
  if (!node.nodeId) throw new Error(`missing input ${selector}`);
  await cdp.send("DOM.setFileInputFiles", { nodeId: node.nodeId, files });
}

// Chrome refuses DOM.setFileInputFiles on a webkitdirectory input, so the staged files
// go into a throwaway input and reach the app as a FileList with webkitRelativePath,
// which is exactly what a folder upload delivers.
async function createFolderProbe(cdp, files) {
  const relMap = Object.fromEntries(CASES.map(([, name]) => [name, `Referencyjne/${name}`]));
  await evaluate(
    cdp,
    `(() => {
       window.__smokeRelMap = ${JSON.stringify(relMap)};
       if (!window.__smokeRelativePathPatched) {
         Object.defineProperty(File.prototype, 'webkitRelativePath', {
           configurable: true,
           get() { return window.__smokeRelMap?.[this.name] || this.name; }
         });
         window.__smokeRelativePathPatched = true;
       }
       document.getElementById('__smokeProbe')?.remove();
       const probe = document.createElement('input');
       probe.type = 'file'; probe.multiple = true; probe.id = '__smokeProbe';
       probe.style.position = 'absolute'; probe.style.left = '-9999px';
       document.body.appendChild(probe);
       return true;
     })()`
  );
  await setFiles(cdp, "#__smokeProbe", files);
}

async function dispatchFolder(cdp) {
  await evaluate(
    cdp,
    `(() => {
      const target = document.getElementById('folder-input');
      target.files = document.getElementById('__smokeProbe').files;
      target.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`
  );
}

let currentStep = "start";

function step(name) {
  currentStep = name;
  console.log(`--- ${name}`);
}

async function openSessionMenu(cdp) {
  await evaluate(
    cdp,
    `(() => {
      const menu = document.getElementById('session-menu');
      if (!menu.classList.contains('is-open')) document.getElementById('btn-session').click();
      return true;
    })()`
  );
  await waitExpr(cdp, "document.getElementById('session-menu').classList.contains('is-open')", 15000);
  await sleep(400);
}

async function closeSessionMenu(cdp) {
  await evaluate(
    cdp,
    `(() => {
      const menu = document.getElementById('session-menu');
      menu.classList.remove('is-open');
      document.getElementById('btn-session').setAttribute('aria-expanded', 'false');
      return true;
    })()`
  );
}

function record(report, name, ok, details) {
  const item = { name, pass: !!ok, details };
  report.steps.push(item);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${details ? `: ${details}` : ""}`);
}

// Clearing lives in the Session menu now (addendum 2, point Q), so the test walks
// the same road a person does: open the menu, then the item.
async function clearThroughUi(cdp) {
  await evaluate(cdp, "document.getElementById('btn-session').click();true");
  await evaluate(cdp, "document.getElementById('session-clear').click();true");
  await waitExpr(cdp, "document.getElementById('confirm-dialog').open");
  await evaluate(cdp, "document.getElementById('confirm-accept').click();true");
  await waitExpr(cdp, "document.querySelectorAll('.file-item').length === 0");
  await sleep(600);
}

async function importSingle(cdp, filePath) {
  await setFiles(cdp, "#file-input", [filePath]);
  await waitExpr(cdp, "document.querySelectorAll('.file-item').length === 1");
  await waitExpr(cdp, "!!document.querySelector('.verdict-word')", 180000);
}

async function setExpert(cdp, on) {
  await evaluate(
    cdp,
    `(() => {
      const box = document.getElementById('expert-mode');
      if (box.checked !== ${on}) box.click();
      return box.checked;
    })()`
  );
}

// A press on the plot area, at a fraction of its width, the way pointing mode listens.
async function clickChart(cdp, fraction) {
  return evaluate(
    cdp,
    `(() => {
      const over = document.querySelector('.chart-host .u-over');
      if (!over) return false;
      const rect = over.getBoundingClientRect();
      const x = rect.left + rect.width * ${fraction};
      const y = rect.top + rect.height * 0.5;
      over.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true }));
      return true;
    })()`
  );
}

async function main() {
  const started = performance.now();
  const report = { steps: [], console_errors: [], tPraOnlyFile: TPRA_ONLY };
  const server = await startTestServer();
  BASE = server.base;
  // A stall must end with a name, not with silence: this says which step was running.
  const watchdog = setTimeout(() => {
    console.error(`WATCHDOG: no progress for 20 minutes, last step: ${currentStep}`);
    process.exit(3);
  }, 20 * 60 * 1000);
  fs.rmSync(STAGE, { recursive: true, force: true });
  fs.rmSync(PROFILE, { recursive: true, force: true });
  fs.mkdirSync(STAGE, { recursive: true });
  const referencePaths = CASES.map(([relative, name]) => {
    const source = path.join(LAB, relative);
    const target = path.join(STAGE, name);
    fs.copyFileSync(source, target);
    return target;
  });
  const tpraPath = path.join(STAGE, TPRA_ONLY);
  fs.copyFileSync(path.join(LAB, "Negatywy", TPRA_ONLY), tpraPath);
  const weakPath = path.join(STAGE, WEAK_POINT_FILE);
  fs.copyFileSync(path.join(LAB, "Pozytywne", WEAK_POINT_FILE), weakPath);
  // A long list for the "next for review" jump: review file, fillers, review file.
  const positives = fs
    .readdirSync(path.join(LAB, "Pozytywne"))
    .filter((name) => name.toLowerCase().endsWith(".txt") && !REVIEW_PAIR.includes(name))
    .sort()
    .slice(0, FILLER_COUNT);
  const longListPaths = [REVIEW_PAIR[0], ...positives, REVIEW_PAIR[1]].map((name) => {
    const target = path.join(STAGE, name);
    fs.copyFileSync(path.join(LAB, "Pozytywne", name), target);
    return target;
  });

  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${PROFILE}`,
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  const stop = () => {
    try { chrome.kill("SIGTERM"); } catch (_) {}
    server.stop();
  };
  process.on("exit", stop);

  let cdp;
  try {
    const list = await waitJson(`http://127.0.0.1:${PORT}/json/list`);
    const page = list.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
    if (!page) throw new Error("no Chrome page target");
    cdp = new Cdp(page.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("DOM.enable");
    // Headless Chrome does not consider its window focused, so element.focus() would
    // move activeElement without firing focus events. The tooltips answer keyboard
    // focus, and this is what makes that testable.
    await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    step("o sign-in");
    // o: the application is behind the login, and the login lets the operator in.
    await cdp.send("Page.navigate", { url: `${BASE}/ities/` });
    await sleep(1200);
    const anonymousHref = await evaluate(cdp, "location.href");
    await loginInBrowser(cdp, { evaluate, goto }, server, BASE);
    await goto(cdp, `${BASE}/ities/`);
    const signedInHref = await evaluate(cdp, "location.href");
    record(
      report,
      "o sign-in guards the application",
      anonymousHref.includes("/login") && signedInHref.endsWith("/ities/"),
      `anonymous -> ${anonymousHref.replace(BASE, "")}, signed in -> ${signedInHref.replace(BASE, "")}`
    );

    await evaluate(
      cdp,
      "localStorage.setItem('analizatory-lang','pl');localStorage.setItem('ities-theme','light');true"
    );
    await reload(cdp);

    step("n starting window");
    // n: the starting window is in the middle of the viewport and leaves on its own.
    await waitExpr(cdp, "document.getElementById('batch-progress').open", 30000);
    const centred = JSON.parse(await evaluate(cdp, `JSON.stringify((() => {
      const rect = document.getElementById('batch-progress').getBoundingClientRect();
      return {
        dx: Math.round(rect.left + rect.width / 2 - innerWidth / 2),
        dy: Math.round(rect.top + rect.height / 2 - innerHeight / 2)
      };
    })())`));
    await waitExpr(cdp, ENGINE_READY, 180000);
    await waitExpr(cdp, "!document.getElementById('batch-progress').open", 30000);
    record(
      report,
      "n starting window is centred and closes itself",
      Math.abs(centred.dx) <= 40 && Math.abs(centred.dy) <= 40,
      `offset from centre dx=${centred.dx} px, dy=${centred.dy} px, closed after the engine was ready`
    );

    step("l expert tooltip");
    // l: the expert switch explains itself on keyboard focus alone.
    await evaluate(cdp, "document.getElementById('expert-info').focus();true");
    await waitExpr(cdp, "!document.getElementById('app-tooltip').hidden", 10000);
    const expertTip = await evaluate(cdp, "document.getElementById('app-tooltip').textContent");
    await evaluate(cdp, "document.getElementById('expert-info').blur();true");
    record(
      report,
      "l expert tooltip appears on focus",
      /Odblokowuje/.test(expertTip),
      `${expertTip.slice(0, 60)}...`
    );

    step("p one place to add files");
    // p: one place adds measurements, and the keyboard reaches it.
    const onePlace = JSON.parse(await evaluate(cdp, `JSON.stringify((() => {
      window.__fileInputClicks = 0;
      window.__folderInputClicks = 0;
      document.getElementById('file-input').addEventListener('click', (e) => {
        e.preventDefault();
        window.__fileInputClicks += 1;
      }, true);
      document.getElementById('folder-input').addEventListener('click', (e) => {
        e.preventDefault();
        window.__folderInputClicks += 1;
      }, true);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', metaKey: true, bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'O', metaKey: true, shiftKey: true, bubbles: true }));
      return {
        toolbarImport: !!document.querySelector('.toolbar #btn-add, .toolbar #btn-add-folder'),
        zone: !!document.querySelector('.sidebar-drop'),
        files: window.__fileInputClicks,
        folders: window.__folderInputClicks
      };
    })())`));
    record(
      report,
      "p one place adds files, shortcuts reach it",
      onePlace.toolbarImport === false && onePlace.zone === true && onePlace.files === 1 && onePlace.folders === 1,
      `toolbar import button=${onePlace.toolbarImport}, sidebar zone=${onePlace.zone}, Cmd+O=${onePlace.files}, Cmd+Shift+O=${onePlace.folders}`
    );

    step("a folder import");
    // a: folder import, progress window and the three reference outcomes.
    await createFolderProbe(cdp, referencePaths);
    await dispatchFolder(cdp);
    const opened = await evaluate(cdp, "document.getElementById('batch-progress').open");
    record(report, "a1 progress dialog opens", opened, `open=${opened}`);
    await waitExpr(cdp, "document.querySelectorAll('.file-item').length === 3");
    await waitExpr(cdp, "document.getElementById('progress-title').textContent === 'Gotowe'", 180000);
    const counters = JSON.parse(await evaluate(cdp, `JSON.stringify({
      detected: +document.getElementById('progress-detected').textContent,
      review: +document.getElementById('progress-review').textContent,
      notDetected: +document.getElementById('progress-not-detected').textContent,
      unsuitable: +document.getElementById('progress-unsuitable').textContent,
      errors: +document.getElementById('progress-errors').textContent
    })`));
    const counterSum = Object.values(counters).reduce((sum, value) => sum + value, 0);
    record(
      report,
      "a2 three reference verdicts",
      counterSum === 3 && counters.review === 1 && counters.notDetected === 1 && counters.unsuitable === 1 && counters.errors === 0,
      JSON.stringify(counters)
    );

    // b: the same folder again is all duplicates. The probe is restaged first: handing
    // its FileList to the folder input empties it, so a second dispatch would otherwise
    // deliver nothing at all.
    await createFolderProbe(cdp, referencePaths);
    await dispatchFolder(cdp);
    await waitExpr(cdp, "document.getElementById('progress-skipped').textContent.includes('3 duplikat')");
    const duplicateState = JSON.parse(await evaluate(cdp, `JSON.stringify({
      files: document.querySelectorAll('.file-item').length,
      skipped: document.getElementById('progress-skipped').textContent,
      summary: (document.getElementById('summary-bar').innerText || '').split(String.fromCharCode(10)).join(' ')
    })`));
    record(report, "b duplicate folder is skipped", duplicateState.files === 3 && /3 duplikat/.test(duplicateState.skipped), JSON.stringify(duplicateState));

    // c: remove one file and take it back.
    await evaluate(cdp, "document.querySelector('.file-remove').click();true");
    await waitExpr(cdp, "document.querySelectorAll('.file-item').length === 2");
    const toastVisible = await evaluate(cdp, "!document.getElementById('undo-toast').hidden");
    await evaluate(cdp, "document.getElementById('undo-action').click();true");
    await waitExpr(cdp, "document.querySelectorAll('.file-item').length === 3");
    record(report, "c remove and undo restores three files", toastVisible, `undo bar shown=${toastVisible}, 2 -> 3 files`);

    // d: clear the session and prove IndexedDB stays empty across a reload.
    await clearThroughUi(cdp);
    await reload(cdp);
    await waitExpr(cdp, ENGINE_READY, 180000);
    const afterReload = await evaluate(cdp, "document.querySelectorAll('.file-item').length");
    record(report, "d clear survives reload", afterReload === 0, `files=${afterReload}`);

    // e: the verdict word appears exactly once in the whole result screen.
    await createFolderProbe(cdp, referencePaths);
    await dispatchFolder(cdp);
    await waitExpr(cdp, "document.getElementById('progress-title').textContent === 'Gotowe'", 180000);
    await evaluate(cdp, `(() => {
      const name = 'BRB pH 7 CV 50uM codeine + 50uM TPrA.txt';
      [...document.querySelectorAll('.file-name')].find((node) => node.textContent.includes(name))?.closest('.file-item')?.querySelector('.file-row')?.click();
      return true;
    })()`);
    await waitExpr(cdp, "document.querySelector('.file-title')?.textContent.includes('BRB pH 7')");
    const occurrences = await evaluate(cdp, `(() => {
      const text = document.getElementById('content').textContent;
      return text.split('NIE STWIERDZONO W TYM POMIARZE').length - 1;
    })()`);
    record(report, "e verdict appears once in content", occurrences === 1, `occurrences=${occurrences}`);

    // j: a filtered PDF report carries only the filtered files. window.print is stubbed,
    // so the check reads what would be printed instead of opening a printer dialog.
    await evaluate(cdp, "window.__printed = 0; window.print = () => { window.__printed += 1; }; true");
    await evaluate(cdp, `(() => {
      document.getElementById('btn-export').click();
      document.getElementById('export-pdf-all').click();
      return true;
    })()`);
    await waitExpr(cdp, "document.querySelectorAll('#print-root .print-file').length > 0", 60000);
    const allSections = await evaluate(cdp, "document.querySelectorAll('#print-root .print-file').length");
    await evaluate(cdp, `(() => {
      document.querySelector('#sidebar .filter-row[data-filter="review"]').click();
      return true;
    })()`);
    await sleep(300);
    await evaluate(cdp, `(() => {
      document.getElementById('btn-export').click();
      document.getElementById('export-pdf-filtered').click();
      return true;
    })()`);
    await waitExpr(cdp, "document.querySelectorAll('#print-root .print-file').length === 1", 60000);
    const filteredSections = await evaluate(cdp, "document.querySelectorAll('#print-root .print-file').length");
    const footers = await evaluate(cdp, "document.querySelectorAll('#print-root .print-running-foot').length");
    record(
      report,
      "j pdf scope follows the filter",
      allSections === 3 && filteredSections === 1 && footers === 1,
      `all=${allSections}, filtered=${filteredSections}, running footer=${footers}`
    );
    await evaluate(cdp, `(() => {
      document.querySelector('#sidebar .filter-row[data-filter="all"]').click();
      document.getElementById('print-root').hidden = true;
      return true;
    })()`);

    // k: stopping a series leaves the rest queued, Recompute all finishes it. The
    // stop lands while the queue is still running, so the counter has to stay below
    // the total and the note has to name what is left.
    await evaluate(cdp, "document.getElementById('btn-analyze').click();true");
    await evaluate(cdp, "document.getElementById('progress-abort').click();true");
    await waitExpr(cdp, "!document.getElementById('progress-note').hidden", 60000);
    const stopped = JSON.parse(await evaluate(cdp, `JSON.stringify({
      note: document.getElementById('progress-note').textContent,
      value: document.getElementById('progress-value').textContent
    })`));
    const stoppedDone = Number(stopped.value.split(" z ")[0]);
    await evaluate(cdp, "document.getElementById('btn-analyze').click();true");
    await waitExpr(cdp, "document.getElementById('progress-title').textContent === 'Gotowe'", 180000);
    const resumed = JSON.parse(await evaluate(cdp, `JSON.stringify({
      value: document.getElementById('progress-value').textContent,
      note: document.getElementById('progress-note').hidden
    })`));
    record(
      report,
      "k stop leaves files queued and recompute finishes",
      stoppedDone < 3 && /w kolejce/.test(stopped.note) && resumed.value === "3 z 3" && resumed.note === true,
      `stopped at ${stopped.value} (${stopped.note.trim()}), resumed to ${resumed.value}`
    );

    // f and h: a real TPrA_ONLY case. The button starts pointing mode and nothing is
    // analysed until the technician has clicked both missing points.
    await clearThroughUi(cdp);
    await importSingle(cdp, tpraPath);
    const tpraStatus = await evaluate(cdp, "document.querySelector('.verdict-word')?.textContent || ''");
    await setExpert(cdp, true);
    await waitExpr(cdp, "!!document.querySelector('.seed-analyte')", 30000);
    await evaluate(cdp, "document.querySelector('.seed-analyte').click();true");
    await waitExpr(cdp, "!!document.querySelector('.pick-hint')", 30000);
    // The standard pair is there, so two handles are expected; the analyte pair is what
    // has to stay absent until the technician points at it.
    const beforeClicks = JSON.parse(await evaluate(cdp, `JSON.stringify({
      hint: document.querySelector('.pick-hint')?.textContent || '',
      handles: document.querySelectorAll('.pt-handle').length,
      analyteHandles: document.querySelectorAll('.pt-handle.pt-3, .pt-handle.pt-4').length,
      pair: document.querySelectorAll('.verdict-part-word').length
    })`));
    await clickChart(cdp, 0.6);
    await waitExpr(cdp, "document.querySelector('.pick-hint')?.textContent.includes('punkt 4')", 30000);
    await clickChart(cdp, 0.75);
    await waitExpr(cdp, "document.querySelectorAll('.pt-handle').length === 4", 180000);
    const afterClicks = JSON.parse(await evaluate(cdp, `JSON.stringify({
      handles: document.querySelectorAll('.pt-handle').length,
      pair: document.querySelectorAll('.verdict-part-word').length,
      saveDisabled: document.querySelector('.expert-panel button.primary').disabled
    })`));
    await evaluate(cdp, `(() => {
      const area = document.querySelector('.expert-panel textarea');
      area.value = 'pik odczytany recznie';
      area.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    const saveEnabled = await evaluate(
      cdp,
      "!document.querySelector('.expert-panel button.primary').disabled"
    );
    record(
      report,
      "f missing analyte pair is pointed at, not seeded",
      /WZORZEC BEZ ANALITU/.test(tpraStatus) &&
        beforeClicks.analyteHandles === 0 &&
        afterClicks.handles === 4,
      `${TPRA_ONLY}, analyte handles before=${beforeClicks.analyteHandles}, all handles after=${afterClicks.handles}`
    );
    record(
      report,
      "h no analysis before both clicks, save waits for a reason",
      beforeClicks.pair === 0 && afterClicks.pair === 2 && afterClicks.saveDisabled === true && saveEnabled === true,
      `verdict members before=${beforeClicks.pair}, after=${afterClicks.pair}, save disabled without reason=${afterClicks.saveDisabled}`
    );

    // g: session parameters under expert mode change the verdict, and go back.
    await clearThroughUi(cdp);
    await importSingle(cdp, referencePaths[0]);
    await setExpert(cdp, true);
    const paramsVisible = await evaluate(cdp, "!document.getElementById('analysis-params').hidden");
    await evaluate(cdp, `(() => {
      document.getElementById('analysis-params').open = true;
      const field = document.getElementById('param-detected');
      field.value = '15';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('analysis-params-form').requestSubmit();
      return true;
    })()`);
    await waitExpr(cdp, "document.querySelector('.params-badge') && document.querySelector('.verdict-word')?.textContent.includes('WYKRYTO')", 180000);
    const customStatus = await evaluate(cdp, "document.querySelector('.verdict-word').textContent");
    const customBadge = await evaluate(cdp, "document.querySelector('.params-badge').textContent");

    // i: the standing bar while the override is on, gone after a reload, badge stays.
    const barVisible = await evaluate(cdp, "!document.getElementById('params-bar').hidden");
    const hatched = await evaluate(cdp, "!!document.querySelector('.delta-scale.is-custom')");
    // The session is written to IndexedDB on a short debounce; give it that moment,
    // otherwise the reload reads the state from before the recomputation.
    await sleep(1500);
    await reload(cdp);
    await waitExpr(cdp, ENGINE_READY, 180000);
    await waitExpr(cdp, "!!document.querySelector('.verdict-word')", 60000);
    const afterReloadState = JSON.parse(await evaluate(cdp, `JSON.stringify({
      bar: !document.getElementById('params-bar').hidden,
      badge: !!document.querySelector('.params-badge'),
      verdict: document.querySelector('.verdict-word')?.textContent || ''
    })`));
    record(
      report,
      "i custom parameter bar, gone after reload, badge stays",
      barVisible && hatched && afterReloadState.bar === false && afterReloadState.badge === true,
      `bar=${barVisible}, hatched scale=${hatched}, after reload bar=${afterReloadState.bar}, badge=${afterReloadState.badge}`
    );

    await setExpert(cdp, true);
    await evaluate(cdp, `(() => {
      document.getElementById('analysis-params').open = true;
      document.getElementById('param-detected').value = '15';
      document.getElementById('param-detected').dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('analysis-params-form').requestSubmit();
      return true;
    })()`);
    await waitExpr(cdp, "!document.getElementById('params-bar').hidden", 180000);
    await evaluate(cdp, "document.getElementById('params-reset').click();true");
    await waitExpr(cdp, "document.querySelector('.verdict-word')?.textContent.includes('DO OCENY EKSPERTA') && !document.querySelector('.params-badge')", 180000);
    const resetStatus = await evaluate(cdp, "document.querySelector('.verdict-word').textContent");
    record(
      report,
      "g custom parameters and reset",
      paramsVisible && /WYKRYTO/.test(customStatus) && /parametry własne/.test(customBadge) && /DO OCENY EKSPERTA/.test(resetStatus),
      `params section under expert mode=${paramsVisible}; custom=${customStatus}; reset=${resetStatus}`
    );

    // The limits are hard: 40 mV is outside 1 to 30 and cannot be applied.
    await evaluate(cdp, `(() => {
      const field = document.getElementById('param-detected');
      field.value = '40';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    const limitState = JSON.parse(await evaluate(cdp, `JSON.stringify({
      disabled: document.getElementById('params-apply').disabled,
      reason: document.getElementById('error-detected').textContent
    })`));
    record(
      report,
      "g2 out of range tolerance cannot be applied",
      limitState.disabled === true && limitState.reason.length > 0,
      `apply disabled=${limitState.disabled}, reason=${limitState.reason}`
    );

    step("m own folder");
    // m: a session folder of one's own, a file moved into it through the menu, and
    // both still there after a reload.
    await clearThroughUi(cdp);
    await importSingle(cdp, referencePaths[0]);
    await evaluate(cdp, "document.querySelector('.new-folder-button').click();true");
    await waitExpr(cdp, "!!document.querySelector('.folder-create-input')");
    await evaluate(cdp, `(() => {
      const input = document.querySelector('.folder-create-input');
      input.value = 'Seria testowa';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      return true;
    })()`);
    await waitExpr(cdp, "!!document.querySelector('.tree-folder')");
    await evaluate(cdp, "document.querySelector('.file-item .row-menu-trigger').click();true");
    await waitExpr(cdp, "document.getElementById('move-menu').open");
    await evaluate(cdp, `(() => {
      const item = [...document.querySelectorAll('#move-menu-list button')]
        .find((button) => button.textContent === 'Seria testowa');
      item.click();
      return true;
    })()`);
    await waitExpr(cdp, "!!document.querySelector('.tree-folder .file-item')");
    const folderStats = await evaluate(cdp, "document.querySelector('.tree-folder .folder-stats').textContent");
    await sleep(1500);
    await reload(cdp);
    await waitExpr(cdp, ENGINE_READY, 180000);
    const folderAfterReload = JSON.parse(await evaluate(cdp, `JSON.stringify({
      folder: document.querySelector('.tree-folder .tree-label')?.textContent || '',
      inside: document.querySelectorAll('.tree-folder .file-item').length,
      stats: document.querySelector('.tree-folder .folder-stats')?.textContent || ''
    })`));
    record(
      report,
      "m own folder, move menu and a reload",
      /1 plik/.test(folderStats) && /KB|MB/.test(folderStats) &&
        folderAfterReload.folder === "Seria testowa" && folderAfterReload.inside === 1,
      `stats "${folderStats.trim()}", after reload folder="${folderAfterReload.folder}" with ${folderAfterReload.inside} file`
    );

    step("i2 quiet counters");
    // i2 (brief I): the counters are a quiet line, not four filled badges, and the
    // sidebar no longer hides the reason for a skipped file behind a question mark.
    // The active filter is allowed its pill (addendum 4, CC), so only the members
    // that are not pressed have to be transparent.
    const quiet = JSON.parse(await evaluate(cdp, `JSON.stringify((() => {
      const TRANSPARENT = ['transparent', 'rgba(0, 0, 0, 0)'];
      const painted = [...document.querySelectorAll('#summary-bar .stat-pill[class*="tone-"]')]
        .filter((node) => node.getAttribute('aria-pressed') !== 'true')
        .filter((node) => !TRANSPARENT.includes(getComputedStyle(node).backgroundColor)).length;
      const sidebar = document.getElementById('sidebar').textContent;
      return {
        painted,
        members: document.querySelectorAll('#summary-bar .stat-pill[class*="tone-"]').length,
        questionMarks: sidebar.split('(?)').length - 1
      };
    })())`));
    record(
      report,
      "i2 counters are a quiet line and the sidebar has no (?)",
      quiet.painted === 0 && quiet.members === 4 && quiet.questionMarks === 0,
      `filled backgrounds=${quiet.painted}, counter members=${quiet.members}, "(?)" in the sidebar=${quiet.questionMarks}`
    );

    step("r home and switcher");
    // r: the home icon leads to the hub, the tile leads back with the same list.
    await evaluate(cdp, "document.getElementById('app-home').click();true");
    await waitExpr(cdp, "location.pathname === '/'", 30000);
    const hubReached = await evaluate(cdp, "!!document.querySelector('.hub-tiles')");
    await evaluate(cdp, `(() => {
      document.querySelector('a.hub-tile[href="/ities/"]').click();
      return true;
    })()`);
    await waitExpr(cdp, "location.pathname === '/ities/'", 30000);
    await waitExpr(cdp, ENGINE_READY, 180000);
    const backFiles = await evaluate(cdp, "document.querySelectorAll('.file-item').length");
    record(
      report,
      "r home icon to the hub and the tile back",
      hubReached && backFiles === 1,
      `hub reached=${hubReached}, files after coming back=${backFiles}`
    );

    step("s session file round trip");
    // s: a session written to a file and read back, with no analysis in between.
    await evaluate(cdp, `(() => {
      window.__analyzeCalls = 0;
      if (!window.__smokePatched) {
        const post = Worker.prototype.postMessage;
        Worker.prototype.postMessage = function (message, ...rest) {
          if (message && message.type === 'analyze') window.__analyzeCalls += 1;
          return post.call(this, message, ...rest);
        };
        const create = URL.createObjectURL;
        URL.createObjectURL = function (blob) {
          window.__lastBlob = blob;
          return create.call(URL, blob);
        };
        const click = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () {
          if (this.download) return undefined;
          return click.call(this);
        };
        window.__smokePatched = true;
      }
      return true;
    })()`);
    await openSessionMenu(cdp);
    await evaluate(cdp, `(() => {
      const field = document.getElementById('session-name');
      field.value = 'Sesja A';
      field.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await sleep(500);
    await evaluate(cdp, "document.getElementById('session-save-file').click();true");
    await closeSessionMenu(cdp);
    await waitExpr(cdp, "!!window.__lastBlob", 20000);
    await evaluate(cdp, "window.__lastBlob.text().then((text) => { window.__sessionFileText = text; })");
    await waitExpr(cdp, "!!window.__sessionFileText", 20000);
    const beforeSave = JSON.parse(await evaluate(cdp, `JSON.stringify((() => {
      for (const node of document.querySelectorAll('#content details')) node.open = true;
      const text = document.getElementById('content').textContent;
      return {
        verdict: document.querySelector('.verdict-word')?.textContent || '',
        sha: (text.match(/[0-9a-f]{64}/) || [''])[0]
      };
    })())`));
    await evaluate(cdp, "window.__analyzeCalls = 0; true");
    await clearThroughUi(cdp);
    await evaluate(cdp, `(() => {
      const file = new File([window.__sessionFileText], 'Sesja A.ities.json', { type: 'application/json' });
      const data = new DataTransfer();
      data.items.add(file);
      const input = document.getElementById('session-file-input');
      input.files = data.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await waitExpr(cdp, "document.getElementById('choice-dialog').open", 20000);
    await evaluate(cdp, "document.getElementById('choice-first').click();true");
    await waitExpr(cdp, "document.querySelectorAll('.file-item').length === 1", 30000);
    await sleep(500);
    const afterLoad = JSON.parse(await evaluate(cdp, `JSON.stringify((() => {
      for (const node of document.querySelectorAll('#content details')) node.open = true;
      const text = document.getElementById('content').textContent;
      return {
        verdict: document.querySelector('.verdict-word')?.textContent || '',
        sha: (text.match(/[0-9a-f]{64}/) || [''])[0],
        analyzeCalls: window.__analyzeCalls
      };
    })())`));
    record(
      report,
      "s session to a file and back, without recomputing",
      beforeSave.verdict === afterLoad.verdict &&
        beforeSave.sha.length === 64 &&
        beforeSave.sha === afterLoad.sha &&
        afterLoad.analyzeCalls === 0,
      `${afterLoad.verdict}, SHA ${afterLoad.sha.slice(0, 10)}..., analyze calls after the load=${afterLoad.analyzeCalls}`
    );

    step("t two named sessions");
    // t: two named sessions keep their own lists.
    await openSessionMenu(cdp);
    await evaluate(cdp, "document.getElementById('session-new').click();true");
    await closeSessionMenu(cdp);
    await waitExpr(cdp, "document.querySelectorAll('.file-item').length === 0", 20000);
    await openSessionMenu(cdp);
    await evaluate(cdp, `(() => {
      const field = document.getElementById('session-name');
      field.value = 'Sesja B';
      field.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await closeSessionMenu(cdp);
    await sleep(500);
    await importSingle(cdp, referencePaths[1]);
    await sleep(1200);
    const openNamed = async (name) => {
      await openSessionMenu(cdp);
      await evaluate(
        cdp,
        `(() => {
          const row = [...document.querySelectorAll('#session-list .session-open')]
            .find((button) => button.textContent.startsWith(${JSON.stringify(name)}));
          row.click();
          return true;
        })()`
      );
      await sleep(1500);
      await closeSessionMenu(cdp);
      return evaluate(cdp, `(() => {
        const names = [...document.querySelectorAll('.file-name')].map((node) => node.textContent);
        return JSON.stringify({ n: names.length, first: names[0] || '' });
      })()`);
    };
    const inB = JSON.parse(await evaluate(cdp, `(() => {
      const names = [...document.querySelectorAll('.file-name')].map((node) => node.textContent);
      return JSON.stringify({ n: names.length, first: names[0] || '' });
    })()`));
    const inA = JSON.parse(await openNamed("Sesja A"));
    const backInB = JSON.parse(await openNamed("Sesja B"));
    record(
      report,
      "t two named sessions keep their own files",
      inA.n === 1 && backInB.n === 1 && inA.first !== backInB.first && backInB.first === inB.first,
      `Sesja A -> ${inA.first}, Sesja B -> ${backInB.first}`
    );

    step("u flipped byte refused");
    // u: one flipped byte and the whole file is refused, by name.
    const badName = await evaluate(cdp, `(() => {
      const data = JSON.parse(window.__sessionFileText);
      const encoded = data.files[0].bytesBase64;
      const replacement = encoded[10] === 'A' ? 'B' : 'A';
      data.files[0].bytesBase64 = encoded.slice(0, 10) + replacement + encoded.slice(11);
      window.__badSessionText = JSON.stringify(data);
      return data.files[0].name;
    })()`);
    await evaluate(cdp, `(() => {
      const file = new File([window.__badSessionText], 'zepsuta.ities.json', { type: 'application/json' });
      const data = new DataTransfer();
      data.items.add(file);
      const input = document.getElementById('session-file-input');
      input.files = data.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await waitExpr(cdp, "document.getElementById('choice-dialog').open", 20000);
    const refusal = JSON.parse(await evaluate(cdp, `JSON.stringify({
      title: document.getElementById('choice-title').textContent,
      message: document.getElementById('choice-message').textContent,
      actions: [document.getElementById('choice-first').hidden, document.getElementById('choice-second').hidden]
    })`));
    await evaluate(cdp, "document.getElementById('choice-dialog').close();true");
    record(
      report,
      "u a flipped byte is refused with the file name",
      refusal.message.includes(badName) && /SHA-256/.test(refusal.message) &&
        refusal.actions[0] === true && refusal.actions[1] === true,
      `${refusal.title}: ${refusal.message.slice(0, 90)}`
    );

    step("q algorithm tooltip");
    // q: the algorithm version explains itself, and the explanation follows the choice.
    await clearThroughUi(cdp);
    await evaluate(cdp, "document.getElementById('algo-info').focus();true");
    await waitExpr(cdp, "!document.getElementById('app-tooltip').hidden", 10000);
    const tip11 = await evaluate(cdp, "document.getElementById('app-tooltip').textContent");
    await evaluate(cdp, "document.getElementById('algo-info').blur();true");
    await evaluate(cdp, `(() => {
      const select = document.getElementById('algo-version');
      select.value = '1.0';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await waitExpr(cdp, ENGINE_READY, 180000);
    await evaluate(cdp, "document.getElementById('algo-info').focus();true");
    await waitExpr(cdp, "!document.getElementById('app-tooltip').hidden", 10000);
    const tip10 = await evaluate(cdp, "document.getElementById('app-tooltip').textContent");
    await evaluate(cdp, "document.getElementById('algo-info').blur();true");
    record(
      report,
      "q algorithm tooltip carries the manifest and follows the version",
      /2026-09-16/.test(tip11) && /LOD\/LOQ/.test(tip11) &&
        /2026-08-20/.test(tip10) && tip10 !== tip11,
      `1.1: ${tip11.slice(0, 60).replace(/\n/g, " | ")} || 1.0: ${tip10.slice(0, 60).replace(/\n/g, " | ")}`
    );


    step("v toolbar shape");
    // v: the toolbar carries seven top level controls and nothing else.
    await evaluate(cdp, `(() => {
      const select = document.getElementById('algo-version');
      select.value = '1.1';
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await waitExpr(cdp, ENGINE_READY, 180000);
    const toolbar = JSON.parse(await evaluate(cdp, `JSON.stringify((() => {
      const bar = document.querySelector('header.toolbar');
      const isControl = (node) =>
        node.matches('button, select') ||
        !!node.querySelector('button, select, input[type=checkbox]');
      const controls = [...bar.children].filter(isControl);
      const name = (node) => {
        const select = node.matches('select') ? node : node.querySelector('select');
        if (select) return select.getAttribute('aria-label') || 'select';
        const inner = node.matches('button') ? node : node.querySelector('button, input[type=checkbox]');
        const text = (node.innerText || node.textContent || '').trim().split(String.fromCharCode(10)).join(' / ');
        return (text || inner?.getAttribute('aria-label') || node.id || node.className).slice(0, 44);
      };
      const boxes = controls.map((node) => ({ node, rect: node.getBoundingClientRect() }));
      const shown = boxes.filter((box) => box.rect.width > 0 && box.rect.height > 0);
      return {
        count: controls.length,
        labels: controls.map(name),
        hidden: boxes.filter((box) => box.rect.width === 0).map((box) => name(box.node)),
        visible: shown.length,
        rows: new Set(shown.map((box) => Math.round(box.rect.top / 8))).size,
        height: Math.round(bar.getBoundingClientRect().height)
      };
    })())`));
    record(
      report,
      "v toolbar has eight top level controls",
      toolbar.count === 8 && toolbar.rows === 1,
      `${toolbar.count} top level controls: ${toolbar.labels.join(" | ")}; ${toolbar.visible} visible at 1440 px in ${toolbar.rows} row, ` +
        `${toolbar.height} px tall; hidden here: ${toolbar.hidden.join(", ") || "none"}`
    );

    step("w counters left the toolbar");
    // w: no counters in the toolbar; they live in the summary bar, which is its own
    // strip under the toolbar and outside the scrolling content (addendum 4, CC).
    // The three reference files come back first, because an empty session has no
    // counters to show.
    await createFolderProbe(cdp, referencePaths);
    await dispatchFolder(cdp);
    await waitExpr(cdp, "document.getElementById('progress-title').textContent === 'Gotowe'", 180000);
    await evaluate(cdp, "document.getElementById('progress-close').click();true");
    await sleep(400);
    const moved = JSON.parse(await evaluate(cdp, `JSON.stringify((() => {
      const bar = (document.querySelector('header.toolbar').innerText || '').toLowerCase();
      const summary = document.getElementById('summary-bar');
      const main = document.querySelector('main');
      const toolbar = document.querySelector('header.toolbar');
      return {
        detectedInBar: bar.includes('wykryto'),
        // The Files or Table control is allowed to say "Pliki"; a file counter is not.
        filesInBar: /[0-9]+[  ]?plik/.test(bar),
        summaryExists: !!summary,
        insideToolbar: toolbar.contains(summary),
        insideMain: main.contains(summary),
        belowToolbar: summary
          ? Math.round(summary.getBoundingClientRect().top - toolbar.getBoundingClientRect().bottom)
          : null,
        pills: summary ? summary.querySelectorAll('.stat-pill').length : 0,
        total: summary ? (summary.querySelector('.summary-total')?.textContent || '') : '',
        height: summary ? Math.round(summary.getBoundingClientRect().height) : 0,
        text: summary ? (summary.innerText || '').split(String.fromCharCode(10)).join(' ') : ''
      };
    })())`));
    record(
      report,
      "w the counters are not in the toolbar and the summary bar stays hidden (owner decision 17.09 23:50)",
      moved.detectedInBar === false && moved.filesInBar === false &&
        moved.summaryExists === true && moved.insideToolbar === false &&
        moved.insideMain === false && moved.height === 0,
      `"wykryto" in the bar=${moved.detectedInBar}, file counter in the bar=${moved.filesInBar}, ` +
        `summary bar ${moved.height} px with ${moved.pills} pills and the total "${moved.total}", ${moved.belowToolbar} px under the toolbar, ` +
        `inside the toolbar=${moved.insideToolbar}, inside main=${moved.insideMain}, "${moved.text.trim()}"`
    );

    step("x summary bar and sidebar filters agree");
    // x: a member of the summary bar filters the list and marks the same segment in
    // the sidebar; a segment in the sidebar lights the same member up here.
    const filtering = JSON.parse(await evaluate(cdp, `JSON.stringify((() => {
      const member = [...document.querySelectorAll('#summary-bar .stat-pill')]
        .find((node) => node.dataset.filter === 'review');
      const wanted = Number(member.querySelector('strong').textContent);
      const before = document.querySelectorAll('#sidebar .file-item').length;
      member.click();
      return { wanted, before };
    })())`));
    await sleep(300);
    const afterFilter = JSON.parse(await evaluate(cdp, `JSON.stringify({
      files: document.querySelectorAll('#sidebar .file-item').length,
      segment: document.querySelector('#sidebar .filter-row.is-selected')?.dataset.filter || '',
      member: document.querySelector('#summary-bar .stat-pill[aria-pressed="true"]')?.dataset.filter || ''
    })`));
    // Now the other way round: the sidebar segment drives the summary bar.
    await evaluate(cdp, `(() => {
      document.querySelector('#sidebar .filter-row[data-filter="unsuitable"]').click();
      return true;
    })()`);
    await sleep(300);
    const fromSidebar = JSON.parse(await evaluate(cdp, `JSON.stringify({
      files: document.querySelectorAll('#sidebar .file-item').length,
      member: document.querySelector('#summary-bar .stat-pill[aria-pressed="true"]')?.dataset.filter || '',
      wanted: Number(document.querySelector('#summary-bar .stat-pill[data-filter="unsuitable"] strong').textContent)
    })`));
    // A second click on the active member is the way back to the whole list.
    await evaluate(cdp, `(() => {
      document.querySelector('#summary-bar .stat-pill[aria-pressed="true"]')?.click();
      return true;
    })()`);
    await sleep(300);
    const afterSecond = await evaluate(cdp, "document.querySelectorAll('#sidebar .file-item').length");
    // The same filter from the keyboard: focus a member and press Enter.
    const wantedKeyboard = await evaluate(cdp, `(() => {
      const member = [...document.querySelectorAll('#summary-bar .stat-pill')]
        .find((node) => node.dataset.filter === 'not_detected');
      member.focus();
      return Number(member.querySelector('strong').textContent);
    })()`);
    // A real key press: Chrome only activates a button when the key event carries its
    // text, which is what makes this a keyboard test and not a synthetic click.
    for (const type of ["rawKeyDown", "char", "keyUp"]) {
      await cdp.send("Input.dispatchKeyEvent", {
        type,
        key: "Enter",
        code: "Enter",
        text: "\r",
        unmodifiedText: "\r",
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13,
      });
    }
    await sleep(400);
    const afterKeyboard = await evaluate(cdp, "document.querySelectorAll('#sidebar .file-item').length");
    await evaluate(cdp, `(() => {
      document.querySelector('#sidebar .filter-row[data-filter="all"]').click();
      return true;
    })()`);
    await sleep(300);
    record(
      report,
      "x the sidebar filters drive the list (summary bar hidden, its state still mirrors)",
      afterFilter.files === filtering.wanted && afterFilter.segment === "review" &&
        afterFilter.member === "review" && fromSidebar.member === "unsuitable" &&
        fromSidebar.files === fromSidebar.wanted && afterSecond === filtering.before,
      `bar "do oceny" (${filtering.wanted}) gives ${afterFilter.files} files, sidebar segment=${afterFilter.segment}; ` +
        `sidebar "nie do oceny" gives ${fromSidebar.files} of ${fromSidebar.wanted}, bar member=${fromSidebar.member}; ` +
        `second click back to ${afterSecond} of ${filtering.before}; Enter on "nie stwierdzono" (${wantedKeyboard}) gives ${afterKeyboard}`
    );

    step("ii sidebar filter list");
    // II and JJ: the filters are a source list with counts, nothing is clipped, the
    // old segmented control is gone and the header holds its icon.
    const sideList = JSON.parse(await evaluate(cdp, `JSON.stringify((() => {
      const list = document.querySelector('#sidebar .filter-list');
      const rows = [...document.querySelectorAll('#sidebar .filter-row')];
      const head = document.querySelector('#sidebar .sidebar-head');
      const mark = document.querySelector('#sidebar .app-mark');
      const icon = mark && mark.querySelector('img');
      const headRect = head.getBoundingClientRect();
      const markRect = mark.getBoundingClientRect();
      const sections = [...document.querySelectorAll('#sidebar .sidebar-section')].map((n) => n.textContent);
      return {
        rows: rows.length,
        role: list ? list.getAttribute('role') : '',
        clipped: rows.filter((row) => row.scrollWidth > row.clientWidth).length,
        labels: rows.map((row) => row.querySelector('.filter-label').textContent),
        counts: rows.map((row) => row.querySelector('.filter-count').textContent),
        selected: rows.filter((row) => row.getAttribute('aria-selected') === 'true').length,
        segmentedGone: !document.querySelector('#sidebar .seg.sidebar-filters'),
        sections,
        headHeight: Math.round(headRect.height),
        headClipped: head.scrollWidth > head.clientWidth,
        markSize: [Math.round(markRect.width), Math.round(markRect.height)],
        iconInside:
          markRect.top >= headRect.top - 0.5 && markRect.bottom <= headRect.bottom + 0.5 &&
          markRect.left >= headRect.left - 0.5 && markRect.right <= headRect.right + 0.5,
        iconNatural: icon ? icon.naturalWidth : 0
      };
    })())`));
    record(
      report,
      "ii the sidebar filters are a source list and nothing is clipped",
      sideList.rows === 5 && sideList.role === "listbox" && sideList.clipped === 0 &&
        sideList.selected === 1 && sideList.segmentedGone === true &&
        sideList.sections.length === 2 && sideList.headHeight === 64 &&
        sideList.headClipped === false && sideList.iconInside === true &&
        sideList.markSize[0] === 48 && sideList.markSize[1] === 48,
      `${sideList.rows} rows (${sideList.labels.join(" | ")}) with counts ${sideList.counts.join("/")}, ` +
        `clipped labels=${sideList.clipped}, sections ${sideList.sections.join(" and ")}, ` +
        `header ${sideList.headHeight} px with a ${sideList.markSize.join("x")} px icon from a ${sideList.iconNatural} px file, ` +
        `icon inside the header=${sideList.iconInside}, header clipped=${sideList.headClipped}, segmented control gone=${sideList.segmentedGone}`
    );

    step("y language and theme in the footer");
    // y: the rare settings sit in the footer, and nowhere in the toolbar.
    const prefs = JSON.parse(await evaluate(cdp, `JSON.stringify({
      toolbarLang: !!document.querySelector('header.toolbar #app-prefs .seg-lang'),
      toolbarTheme: !!document.querySelector('header.toolbar #app-prefs .seg-theme'),
      inFooter: !!document.querySelector('.status-bar .seg-lang, .status-bar .seg-theme'),
      logos: document.querySelectorAll('.status-bar .partner-logo').length
    })`));
    // Owner's decision 17.09 22:40: language and theme sit next to Files/Table, the
    // footer keeps two partner logos (UŁ and AHE).
    record(
      report,
      "y language and theme live next to Files/Table, two partner logos",
      prefs.toolbarLang && prefs.toolbarTheme && prefs.inFooter === false && prefs.logos === 2,
      `toolbar language=${prefs.toolbarLang}, toolbar theme=${prefs.toolbarTheme}, in the footer=${prefs.inFooter}, partner logos=${prefs.logos}`
    );

    step("z clear session from the menu");
    // z: clearing is only in the Session menu, and it still clears.
    const clearPlace = JSON.parse(await evaluate(cdp, `JSON.stringify({
      inMenu: !!document.querySelector('#session-menu #session-clear'),
      enabled: !document.getElementById('session-clear').disabled
    })`));
    await clearThroughUi(cdp);
    const afterClear = await evaluate(cdp, "document.querySelectorAll('.file-item').length");
    record(
      report,
      "z clear session lives in the Session menu and works",
      clearPlace.inMenu && clearPlace.enabled && afterClear === 0,
      `item in the menu=${clearPlace.inMenu}, enabled with files=${clearPlace.enabled}, files after clearing=${afterClear}`
    );

    step("cc saved session rows");
    // The rows of the Session menu stay on one line, even with a long name, and the
    // menu never scrolls sideways (addendum of 22:10).
    await openSessionMenu(cdp);
    await evaluate(cdp, `(() => {
      const field = document.getElementById('session-name');
      field.value = 'Sesja odbioru 2026-09-17, bardzo dluga nazwa do testu';
      field.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    await sleep(900);
    const sessionRows = JSON.parse(await evaluate(cdp, `JSON.stringify((() => {
      const menu = document.querySelector('#session-menu .menu-list');
      const list = document.getElementById('session-list');
      const row = list.querySelector('.session-row');
      const name = row && row.querySelector('.session-name');
      return {
        rows: list.querySelectorAll('.session-row').length,
        icons: row ? row.querySelectorAll('.session-row-actions .session-action').length : 0,
        tooltips: row
          ? [...row.querySelectorAll('.session-row-actions .session-action')]
              .filter((button) => !!button.dataset.tooltipKey).length
          : 0,
        nameHeight: name ? Math.round(name.getBoundingClientRect().height) : 0,
        nameWidth: name ? Math.round(name.getBoundingClientRect().width) : 0,
        dot: !!list.querySelector('.session-row.is-current .session-dot'),
        meta: row && row.querySelector('.session-meta') ? row.querySelector('.session-meta').textContent : '',
        metaVisible: (() => {
          const open = row && row.querySelector('.session-open');
          const meta = row && row.querySelector('.session-meta');
          if (!open || !meta) return false;
          return meta.getBoundingClientRect().bottom <= open.getBoundingClientRect().bottom + 1;
        })(),
        menuWidth: Math.round(menu.getBoundingClientRect().width),
        menuLeft: Math.round(menu.getBoundingClientRect().left),
        menuRight: Math.round(menu.getBoundingClientRect().right),
        menuOverflow: menu.scrollWidth - menu.clientWidth,
        listOverflow: list.scrollWidth - list.clientWidth
      };
    })())`));
    await closeSessionMenu(cdp);
    record(
      report,
      "cc saved session rows hold one line and the menu does not scroll sideways",
      sessionRows.rows >= 1 && sessionRows.icons === 3 && sessionRows.tooltips === 3 &&
        sessionRows.dot === true && sessionRows.nameHeight <= 24 && sessionRows.nameWidth <= 200 &&
        sessionRows.menuWidth === 340 && sessionRows.menuOverflow <= 0 && sessionRows.listOverflow <= 0 &&
        sessionRows.menuLeft >= 0 && sessionRows.menuRight <= 1440 && sessionRows.metaVisible === true,
      `menu ${sessionRows.menuWidth} px at x ${sessionRows.menuLeft} to ${sessionRows.menuRight}, ` +
        `overflow ${sessionRows.menuOverflow} px, list overflow ${sessionRows.listOverflow} px, ` +
        `name ${sessionRows.nameWidth} x ${sessionRows.nameHeight} px, ${sessionRows.icons} icon actions with ${sessionRows.tooltips} tooltips, ` +
        `current dot=${sessionRows.dot}, meta "${sessionRows.meta}" fully inside the row=${sessionRows.metaVisible}`
    );

    step("v2 one number per point in expert mode");
    // V: the canvas plate and the drag handle would show the same number twice.
    await importSingle(cdp, referencePaths[0]);
    await setExpert(cdp, false);
    await sleep(400);
    const plain = JSON.parse(await evaluate(cdp, `JSON.stringify({
      plates: Number(document.querySelector('.chart-host')?.dataset.pointPlates || -1),
      handles: document.querySelectorAll('.pt-handle').length
    })`));
    await setExpert(cdp, true);
    await sleep(600);
    const expertNumbers = JSON.parse(await evaluate(cdp, `JSON.stringify({
      plates: Number(document.querySelector('.chart-host')?.dataset.pointPlates || -1),
      handles: document.querySelectorAll('.pt-handle').length
    })`));
    record(
      report,
      "v2 expert mode draws the point number once",
      plain.plates === 4 && plain.handles === 0 &&
        expertNumbers.plates === 0 && expertNumbers.handles === 4,
      `auto: ${plain.plates} plates, ${plain.handles} handles; expert: ${expertNumbers.plates} plates, ${expertNumbers.handles} handles`
    );

    step("w2 prominence under the threshold");
    // W: a manual point where the detector would see no peak is named as such.
    await clearThroughUi(cdp);
    await importSingle(cdp, weakPath);
    await setExpert(cdp, true);
    await sleep(400);
    await evaluate(cdp, `(() => {
      const rows = [...document.querySelectorAll('.peaks-table tbody tr')];
      const setValue = (n, value) => {
        const input = rows[n - 1].querySelector('input.peak-input');
        input.value = String(value);
        input.dispatchEvent(new Event('change', { bubbles: true }));
      };
      setValue(3, 0.218);
      return true;
    })()`);
    await sleep(800);
    await evaluate(cdp, `(() => {
      const rows = [...document.querySelectorAll('.peaks-table tbody tr')];
      const input = rows[3].querySelector('input.peak-input');
      input.value = '0.281';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    // Wait for the manual result itself, not for the warning: a missing warning has to
    // show up as a failed check, not as a timeout.
    await waitExpr(cdp, "!!document.querySelector('.verdict-word-pair')", 120000);
    await sleep(400);
    const weakPoints = JSON.parse(await evaluate(cdp, `JSON.stringify((() => {
      const rows = [...document.querySelectorAll('.peaks-table tbody tr')];
      const read = (n) => {
        const cells = rows[n - 1].querySelectorAll('td');
        const cell = cells[cells.length - 1];
        return {
          prom: cell.firstChild?.textContent || '',
          flagged: !!cell.querySelector('.peak-below-threshold')
        };
      };
      return { p3: read(3), p4: read(4), note: !!document.querySelector('.verdict-below-threshold') };
    })())`));
    record(
      report,
      "w2 a manual point under the peak threshold is named",
      weakPoints.p4.flagged === true && weakPoints.p3.flagged === false &&
        Number(String(weakPoints.p3.prom).replace(",", ".")) > 1,
      `point 3 prominence ${weakPoints.p3.prom} µA flagged=${weakPoints.p3.flagged}, point 4 prominence ${weakPoints.p4.prom} µA flagged=${weakPoints.p4.flagged}, verdict note=${weakPoints.note}`
    );

    step("x2 next for review shows in the list");
    // X: the jump to the next file for review moves the highlight in the list too,
    // and scrolls it into sight, which is what the owner did not get before.
    await setExpert(cdp, false);
    await clearThroughUi(cdp);
    await setFiles(cdp, "#file-input", longListPaths);
    // Samples with more than one file fold themselves once the tree grows, so the
    // rendered rows are not one per file; the progress window is the honest signal.
    await waitExpr(cdp, "document.getElementById('progress-title').textContent === 'Gotowe'", 600000);
    await evaluate(cdp, "document.getElementById('progress-close').click();true");
    await sleep(400);
    const firstReview = await evaluate(cdp, `(() => {
      const row = [...document.querySelectorAll('#sidebar .file-item')]
        .find((item) => item.querySelector('.dot-uncertain'));
      if (!row) return "";
      row.querySelector('.file-row').click();
      return row.querySelector('.file-name').textContent;
    })()`);
    await sleep(500);
    await evaluate(cdp, "document.getElementById('sidebar').scrollTop = 0;true");
    const jumped = JSON.parse(await evaluate(cdp, `JSON.stringify((() => {
      const jump = document.querySelector('.verdict-next-review');
      if (jump) jump.click();
      return { clicked: !!jump };
    })())`));
    await sleep(600);
    const selection = JSON.parse(await evaluate(cdp, `JSON.stringify((() => {
      const item = document.querySelector('#sidebar .file-item.is-selected');
      const title = document.querySelector('.file-title')?.textContent || '';
      if (!item) return { found: false, title };
      const side = document.getElementById('sidebar').getBoundingClientRect();
      const row = item.getBoundingClientRect();
      return {
        found: true,
        title,
        name: item.querySelector('.file-name')?.textContent || '',
        inView: row.top >= side.top - 1 && row.bottom <= side.bottom + 1,
        scrollTop: Math.round(document.getElementById('sidebar').scrollTop)
      };
    })())`));
    record(
      report,
      "x2 next for review moves the highlight in the list and scrolls it into view",
      jumped.clicked && selection.found && selection.inView &&
        selection.title.includes(selection.name) && selection.name !== firstReview,
      `${longListPaths.length} files imported, from "${firstReview}" to "${selection.name}", content shows "${selection.title}", ` +
        `row inside the sidebar=${selection.inView}, list scrolled to ${selection.scrollTop} px`
    );

    step("bb many files at once");
    // BB: Cmd click, Shift click, the comparison chart and the one file rule.
    const multi = JSON.parse(await evaluate(cdp, `JSON.stringify((() => {
      const rows = [...document.querySelectorAll('#sidebar .file-item .file-row')];
      rows[0].click();
      rows[1].dispatchEvent(new MouseEvent('click', { bubbles: true, metaKey: true }));
      return { rows: rows.length };
    })())`));
    await sleep(400);
    const twoCards = await evaluate(cdp, "document.querySelectorAll('#content .multi-card').length");
    await evaluate(cdp, `(() => {
      const rows = [...document.querySelectorAll('#sidebar .file-item .file-row')];
      rows[0].click();
      rows[2].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
      return true;
    })()`);
    await sleep(500);
    const threeCards = JSON.parse(await evaluate(cdp, `JSON.stringify({
      cards: document.querySelectorAll('#content .multi-card').length,
      order: [...document.querySelectorAll('#content .multi-card .multi-card-name')].map((n) => n.textContent),
      listOrder: [...document.querySelectorAll('#sidebar .file-item .file-name')].map((n) => n.textContent)
    })`));
    await evaluate(cdp, "document.getElementById('multi-compare')?.click();true");
    await sleep(600);
    const compare = JSON.parse(await evaluate(cdp, `JSON.stringify({
      charts: document.querySelectorAll('#content .multi-compare-host .uplot').length,
      legend: document.querySelectorAll('#content .multi-legend-item').length
    })`));
    await setExpert(cdp, true);
    await sleep(400);
    const expertNote = JSON.parse(await evaluate(cdp, `JSON.stringify({
      note: !!document.querySelector('.multi-expert-note'),
      handles: document.querySelectorAll('.pt-handle').length
    })`));
    await setExpert(cdp, false);
    await evaluate(cdp, "document.getElementById('multi-clear')?.click();true");
    await sleep(300);
    const afterClearSelection = await evaluate(cdp, "document.querySelectorAll('#content .multi-card').length");
    record(
      report,
      "bb several files give several cards, one chart and one file for expert work",
      twoCards === 2 && threeCards.cards === 3 && compare.charts === 1 && compare.legend === 3 &&
        expertNote.note === true && expertNote.handles === 0 && afterClearSelection === 0 &&
        threeCards.order.join("|") === threeCards.listOrder.slice(0, 3).join("|"),
      `Cmd click: ${twoCards} cards, Shift range: ${threeCards.cards} cards in list order, comparison: ${compare.charts} chart with ${compare.legend} curves, expert with several: note=${expertNote.note}, handles=${expertNote.handles}`
    );

    step("gg logo preview");
    // GG: the logo opens large from the 1024 px file, and any click or Escape closes it.
    await evaluate(cdp, "document.querySelector('#sidebar .app-mark').click();true");
    // The preview image has to be decoded before its size means anything.
    await waitExpr(
      cdp,
      "(document.querySelector('.logo-lightbox-image')?.naturalWidth || 0) > 0",
      20000
    );
    await evaluate(cdp, `(() => {
      const dialog = document.querySelector('dialog.logo-lightbox');
      if (dialog.open) dialog.close();
      return true;
    })()`);
    await sleep(200);
    const preview = JSON.parse(await evaluate(cdp, `JSON.stringify((() => {
      const mark = document.querySelector('#sidebar .app-mark');
      const head = mark ? Math.round(mark.getBoundingClientRect().width) : 0;
      mark.click();
      const dialog = document.querySelector('dialog.logo-lightbox');
      const image = dialog && dialog.querySelector('.logo-lightbox-image');
      return {
        head,
        open: !!(dialog && dialog.open),
        natural: image ? image.naturalWidth : 0,
        shown: image ? Math.round(image.getBoundingClientRect().width) : 0,
        caption: dialog ? (dialog.innerText || '').split(String.fromCharCode(10)).join(' ') : '',
        captionParts: dialog ? dialog.querySelectorAll('figcaption > *').length : 0,
        captionGap: (() => {
          const name = dialog && dialog.querySelector('.logo-lightbox-name');
          const line = dialog && dialog.querySelector('.logo-lightbox-line');
          if (!name || !line) return -1;
          return Math.round(line.getBoundingClientRect().top - name.getBoundingClientRect().bottom);
        })(),
        centred: (() => {
          const figure = dialog && dialog.querySelector('figure');
          if (!figure) return false;
          const rect = figure.getBoundingClientRect();
          return Math.abs(Math.round(rect.left + rect.width / 2 - innerWidth / 2)) <= 2;
        })()
      };
    })())`));
    await sleep(300);
    const closedByClick = await evaluate(cdp, `(() => {
      const dialog = document.querySelector('dialog.logo-lightbox');
      dialog.click();
      return !dialog.open;
    })()`);
    await evaluate(cdp, "document.querySelector('#sidebar .app-mark').click();true");
    await sleep(200);
    for (const type of ["rawKeyDown", "keyUp"]) {
      await cdp.send("Input.dispatchKeyEvent", {
        type,
        key: "Escape",
        code: "Escape",
        windowsVirtualKeyCode: 27,
        nativeVirtualKeyCode: 27,
      });
    }
    await sleep(300);
    const closedByEscape = await evaluate(
      cdp,
      "!document.querySelector('dialog.logo-lightbox').open"
    );
    record(
      report,
      "gg the sidebar logo opens a sharp preview and closes on a click or Escape",
      preview.open === true && preview.natural >= 1024 && preview.head === 48 &&
        preview.captionParts === 2 && preview.captionGap >= 4 && preview.centred === true &&
        closedByClick === true && closedByEscape === true,
      `open=${preview.open}, header icon ${preview.head} px, preview image ${preview.shown} px from a ${preview.natural} px file, ` +
        `caption in ${preview.captionParts} parts with a ${preview.captionGap} px gap, centred=${preview.centred}, ` +
        `closed by click=${closedByClick}, closed by Escape=${closedByEscape}, caption "${preview.caption.trim().slice(0, 60)}"`
    );

    step("hh hub tile opens the application");
    // Correction to GG: on the hub a tile is a door, so a click on its icon lands in
    // the application and opens no preview.
    await goto(cdp, `${BASE}/`);
    await waitExpr(cdp, "!!document.querySelector('.hub-tiles')", 30000);
    // The tooltip is set by the page module, so wait for the module, not for the
    // markup that is already in the HTML.
    await waitExpr(
      cdp,
      `!!document.querySelector('a.hub-tile[href="/ities/"]').dataset.tooltipText`,
      20000
    );
    const tileTip = await evaluate(
      cdp,
      `document.querySelector('a.hub-tile[href="/ities/"]').dataset.tooltipText || ''`
    );
    await evaluate(cdp, `(() => {
      document.querySelector('a.hub-tile[href="/ities/"] .hub-icon img').click();
      return true;
    })()`);
    await sleep(1200);
    const tileLanding = JSON.parse(await evaluate(cdp, `JSON.stringify({
      path: location.pathname,
      dialog: !!document.querySelector('dialog.logo-lightbox[open]')
    })`));
    record(
      report,
      "hh the hub tile icon opens the application, not a preview",
      tileLanding.path === "/ities/" && tileLanding.dialog === false && /ITIES Detect/.test(tileTip),
      `tile tooltip "${tileTip}", landed on ${tileLanding.path}, preview dialog open=${tileLanding.dialog}`
    );

    step("ff project history on the versions page");
    // FF: the timeline stands above the version tables, ten entries, from 2025 to the
    // release of today.
    await goto(cdp, `${BASE}/ities/versions.html`);
    await waitExpr(cdp, "document.querySelectorAll('.timeline-item').length > 0", 30000);
    const timeline = JSON.parse(await evaluate(cdp, `JSON.stringify((() => {
      const items = [...document.querySelectorAll('.timeline-item')];
      const heading = [...document.querySelectorAll('.versions-page h2')].map((h) => h.textContent);
      const list = document.querySelector('.timeline');
      const table = document.getElementById('algo-table');
      return {
        count: items.length,
        first: items[0]?.querySelector('.timeline-date')?.textContent || '',
        last: items[items.length - 1]?.querySelector('.timeline-date')?.textContent || '',
        firstHead: items[0]?.querySelector('.timeline-head')?.textContent || '',
        headings: heading,
        aboveTables: list && table
          ? list.getBoundingClientRect().top < table.getBoundingClientRect().top
          : false,
        back: !!document.getElementById('back-to-app')
      };
    })())`));
    record(
      report,
      "ff the versions page opens with ten steps of the project history",
      timeline.count === 10 && /2025/.test(timeline.first) && timeline.last === "17.09.2026" &&
        timeline.aboveTables === true && timeline.back === true,
      `${timeline.count} entries, from "${timeline.first}" (${timeline.firstHead}) to "${timeline.last}", ` +
        `above the tables=${timeline.aboveTables}, back button=${timeline.back}, headings: ${timeline.headings.join(" | ")}`
    );

    report.console_errors = cdp.errors;
    record(report, "console errors", cdp.errors.length === 0, `count=${cdp.errors.length}${cdp.errors.length ? ": " + cdp.errors.join(" | ") : ""}`);
  } finally {
    cdp?.close();
    try {
      chrome.kill("SIGTERM");
    } catch (_) {
      /* already gone */
    }
    // Awaited, not fired and forgotten: the orphan check below has to mean something.
    await server.stopAndWait();
    await sleep(300);
    fs.rmSync(STAGE, { recursive: true, force: true });
    fs.rmSync(PROFILE, { recursive: true, force: true });
  }

  // lsof on the test port only: never a pkill by pattern, which would reach the
  // server the owner is using on 20412.
  let orphans = "";
  try {
    orphans = execFileSync("lsof", ["-nP", `-iTCP:${TEST_PORT}`], { encoding: "utf8" }).trim();
  } catch (_) {
    orphans = "";
  }
  record(
    report,
    "no server process left behind",
    orphans === "",
    orphans || `lsof finds nothing on port ${TEST_PORT}`
  );

  clearTimeout(watchdog);
  report.elapsed_s = +((performance.now() - started) / 1000).toFixed(2);
  report.pass = report.steps.every((step) => step.pass);
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`${report.pass ? "PASS" : "FAIL"} UI smoke: ${report.steps.filter((step) => step.pass).length}/${report.steps.length} checks, ${report.elapsed_s}s`);
  if (!report.pass) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
