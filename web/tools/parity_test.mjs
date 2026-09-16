#!/usr/bin/env node
// Parity gate: Pyodide vs CPython baseline on the 485 labelled lab files.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { stubMatplotlib, ANALYZE_HELPERS_PY } from "../static/ities/algo_stub.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const LAB = path.resolve(ROOT, "../07_etykiety_lab_20260916");
const GROUPS = ["Pozytywne", "Negatywy", "Neutrale"];
const BASELINE = path.resolve(ROOT, "../wyniki_analizy/eval_etykiety_20260916_baseline.csv");
const ALGO_DIR = path.join(ROOT, "algo");
const VERSIONS = path.join(ALGO_DIR, "versions.json");
const OUT = path.join(ROOT, "RELEASE_CHECK.md");
const TOL = 1e-9;
const NEGATIVE_DELTA = 0.356;
const COLS = ["status", "delta_Es", "Ip_analyte_fwd_uA"];

const require = createRequire(import.meta.url);
const { loadPyodide } = require("pyodide");

const rssMB = () => +(process.memoryUsage().rss / 1048576).toFixed(1);
const nowS = () => performance.now() / 1000;
const log = (m) => console.error(`[${nowS().toFixed(1)}s rss=${rssMB()}MB] ${m}`);

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.length);
  const header = splitCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const row = {};
    header.forEach((h, idx) => {
      row[h] = cells[idx] === undefined ? "" : cells[idx];
    });
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += ch;
    } else if (ch === '"') {
      q = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function listLabFiles() {
  const files = [];
  for (const group of GROUPS) {
    const dir = path.join(LAB, group);
    if (!fs.existsSync(dir)) throw new Error("missing lab dir " + dir);
    for (const name of fs.readdirSync(dir)) {
      const fp = path.join(dir, name);
      if (fs.statSync(fp).isFile()) files.push({ group, name, path: fp });
    }
  }
  files.sort((a, b) => a.name.localeCompare(b.name));
  return files;
}

function numOrNull(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s || s === "None" || s === "nan" || s === "NaN") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function closeNum(a, b) {
  const x = numOrNull(a);
  const y = numOrNull(b);
  if (x === null && y === null) return true;
  if (x === null || y === null) return false;
  return Math.abs(x - y) <= TOL;
}

function diffRow(got, exp, fileName) {
  const diffs = [];
  if (String(got.status ?? "") !== String(exp.status ?? "")) {
    diffs.push({ col: "status", got: got.status, exp: exp.status });
  }
  for (const col of ["delta_Es", "Ip_analyte_fwd_uA"]) {
    if (!closeNum(got[col], exp[col])) {
      diffs.push({ col, got: got[col], exp: exp[col] });
    }
  }
  return diffs.length ? { file: fileName, diffs } : null;
}

function pickDefaultAlgo(manifest) {
  return manifest.find((e) => e.default) || manifest[0];
}

async function sha256File(fp) {
  const buf = fs.readFileSync(fp);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function writeReleaseCheck(data) {
  const lines = [];
  lines.push("# RELEASE_CHECK");
  lines.push("");
  lines.push("Parity test of the frozen algorithm in Pyodide (Node) against the CPython baseline.");
  lines.push("");
  lines.push("## Environment");
  lines.push("");
  lines.push(`- date: ${data.date}`);
  lines.push(`- pyodide: ${data.pyodide_version}`);
  lines.push(`- python (wasm): ${data.python}`);
  lines.push(`- numpy ${data.numpy}, scipy ${data.scipy}, pandas ${data.pandas}`);
  lines.push(`- algo ${data.algo_version}  sha256 ${data.algo_sha256}`);
  lines.push(`- files on disk: ${data.n_files}`);
  lines.push(`- baseline rows: ${data.n_baseline}`);
  lines.push(`- load pyodide: ${data.t_load_s.toFixed(2)} s`);
  lines.push(`- load packages: ${data.t_packages_s.toFixed(2)} s`);
  lines.push(`- analyze wall: ${data.t_analyze_s.toFixed(2)} s`);
  lines.push(`- rss end: ${data.rss_end_MB} MB`);
  lines.push("");
  lines.push("## Gate: 0 differences on status, delta_Es, Ip_analyte_fwd_uA (tol 1e-9)");
  lines.push("");
  lines.push(`- compared: ${data.n_compared}`);
  lines.push(`- differences: **${data.n_diffs}**`);
  lines.push(`- missing on disk: ${data.missing_disk}`);
  lines.push(`- missing in baseline: ${data.missing_baseline}`);
  lines.push("");
  if (data.n_diffs === 0) {
    lines.push("PASS: Pyodide matches CPython on all compared files.");
  } else {
    lines.push("FAIL: differences follow.");
    lines.push("");
    for (const d of data.diff_examples) {
      lines.push(`- \`${d.file}\`: ${d.diffs.map((x) => `${x.col} got ${x.got} exp ${x.exp}`).join("; ")}`);
    }
    if (data.n_diffs > data.diff_examples.length) {
      lines.push(`- … ${data.n_diffs - data.diff_examples.length} more`);
    }
  }
  lines.push("");
  lines.push("## Negative test (AMPHETAMINE_TARGET_DELTA_V = 0.356 in memory)");
  lines.push("");
  lines.push(`- files re-analysed: ${data.neg_n}`);
  lines.push(`- differences vs baseline: **${data.neg_diffs}**`);
  lines.push(`- wall: ${data.t_negative_s.toFixed(2)} s`);
  if (data.neg_diffs > 0) {
    lines.push("PASS: the parity test reports differences when the threshold is wrong. The test can fail.");
  } else {
    lines.push("FAIL: mutating the threshold did not produce differences. The test is not wired.");
  }
  lines.push("");
  lines.push("## Verdict");
  lines.push("");
  lines.push(data.gate_pass ? "RELEASE GATE PASS" : "RELEASE GATE FAIL");
  lines.push("");
  fs.writeFileSync(OUT, lines.join("\n"));
}

async function main() {
  const t0 = nowS();
  if (!fs.existsSync(BASELINE)) throw new Error("missing baseline " + BASELINE);
  const files = listLabFiles();
  const baselineRows = parseCsv(fs.readFileSync(BASELINE, "utf8"));
  const byName = new Map(baselineRows.map((r) => [r.plik, r]));
  const manifest = JSON.parse(fs.readFileSync(VERSIONS, "utf8"));
  const entry = pickDefaultAlgo(manifest);
  const algoPath = path.join(ALGO_DIR, entry.file);
  const algoSha = await sha256File(algoPath);
  if (algoSha !== entry.sha256) {
    throw new Error(`algo sha256 mismatch: file ${algoSha} manifest ${entry.sha256}`);
  }

  log(`files=${files.length} baseline=${baselineRows.length} algo=${entry.version}`);
  let t = nowS();
  const cacheDir = path.join(ROOT, "static/pyodide");
  const pyodide = await loadPyodide({
    packageCacheDir: cacheDir,
  });
  const tLoad = nowS() - t;
  log(`loadPyodide ${tLoad.toFixed(2)}s pyodide=${pyodide.version}`);

  t = nowS();
  await pyodide.loadPackage(["numpy", "scipy", "pandas"], { messageCallback: () => {} });
  const tPkg = nowS() - t;
  log(`loadPackage ${tPkg.toFixed(2)}s`);

  const src = stubMatplotlib(fs.readFileSync(algoPath, "utf8"));
  pyodide.runPython(src);
  pyodide.runPython(ANALYZE_HELPERS_PY);
  const versions = JSON.parse(pyodide.runPython(`
import json, sys, numpy, scipy, pandas
json.dumps({"python": sys.version.split()[0], "numpy": numpy.__version__,
            "scipy": scipy.__version__, "pandas": pandas.__version__,
            "algo": ALGO_VERSION})
`));
  log(`module ${versions.algo} py=${versions.python}`);

  pyodide.FS.mkdirTree("/data");
  const results = [];
  t = nowS();
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const vpath = "/data/" + f.name;
    pyodide.FS.writeFile(vpath, new Uint8Array(fs.readFileSync(f.path)));
    pyodide.globals.set("_ities_name", f.name);
    pyodide.globals.set("_ities_path", vpath);
    const dumped = pyodide.runPython(`
content = open(_ities_path, "rb").read()
dump_analyze(_ities_name, content, manual=None)
`);
    const row = JSON.parse(dumped);
    results.push(row);
    if ((i + 1) % 50 === 0 || i === 0 || i + 1 === files.length) {
      log(`analyze ${i + 1}/${files.length} last=${row.status} dE=${row.delta_Es}`);
    }
  }
  const tAnalyze = nowS() - t;

  const diffs = [];
  let missingDisk = 0;
  let missingBaseline = 0;
  const seen = new Set();
  for (const row of results) {
    seen.add(row.file_name);
    const exp = byName.get(row.file_name);
    if (!exp) {
      missingBaseline++;
      diffs.push({ file: row.file_name, diffs: [{ col: "plik", got: row.file_name, exp: "missing in baseline" }] });
      continue;
    }
    const d = diffRow(row, exp, row.file_name);
    if (d) diffs.push(d);
  }
  for (const r of baselineRows) {
    if (!seen.has(r.plik)) {
      missingDisk++;
      diffs.push({ file: r.plik, diffs: [{ col: "plik", got: "missing on disk", exp: r.plik }] });
    }
  }

  log(`parity diffs=${diffs.length} missingDisk=${missingDisk} missingBaseline=${missingBaseline}`);

  t = nowS();
  pyodide.runPython(`AMPHETAMINE_TARGET_DELTA_V = ${NEGATIVE_DELTA}`);
  const negFiles = results.filter((r) => r.delta_Es != null);
  let negDiffs = 0;
  const negExamples = [];
  for (const prev of negFiles) {
    const f = files.find((x) => x.name === prev.file_name);
    if (!f) continue;
    const vpath = "/data/" + f.name;
    pyodide.globals.set("_ities_name", f.name);
    pyodide.globals.set("_ities_path", vpath);
    const dumped = pyodide.runPython(`
content = open(_ities_path, "rb").read()
dump_analyze(_ities_name, content, manual=None)
`);
    const row = JSON.parse(dumped);
    const exp = byName.get(row.file_name);
    if (!exp) continue;
    const d = diffRow(row, exp, row.file_name);
    if (d) {
      negDiffs++;
      if (negExamples.length < 5) negExamples.push(d);
    }
  }
  const tNeg = nowS() - t;
  log(`negative diffs=${negDiffs}/${negFiles.length} in ${tNeg.toFixed(1)}s`);

  const gatePass = diffs.length === 0 && missingDisk === 0 && missingBaseline === 0 && negDiffs > 0;
  const payload = {
    date: new Date().toISOString(),
    pyodide_version: pyodide.version,
    python: versions.python,
    numpy: versions.numpy,
    scipy: versions.scipy,
    pandas: versions.pandas,
    algo_version: entry.version,
    algo_sha256: algoSha,
    n_files: files.length,
    n_baseline: baselineRows.length,
    n_compared: results.length,
    n_diffs: diffs.length,
    missing_disk: missingDisk,
    missing_baseline: missingBaseline,
    diff_examples: diffs.slice(0, 12),
    t_load_s: tLoad,
    t_packages_s: tPkg,
    t_analyze_s: tAnalyze,
    t_negative_s: tNeg,
    neg_n: negFiles.length,
    neg_diffs: negDiffs,
    neg_examples: negExamples,
    rss_end_MB: rssMB(),
    gate_pass: gatePass,
    elapsed_s: nowS() - t0,
  };
  writeReleaseCheck(payload);
  fs.writeFileSync(path.join(ROOT, "tools/_parity_last.json"), JSON.stringify(payload, null, 2));
  log(`wrote ${OUT} gate=${gatePass ? "PASS" : "FAIL"}`);
  if (!gatePass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
