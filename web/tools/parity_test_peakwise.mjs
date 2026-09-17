#!/usr/bin/env node
// Release gate for PeakWise, run against the copy of the module that ships from this
// directory: algo/peakwise_algo_v1.0.py in Pyodide must return exactly what the same file
// returns in CPython, on every file of the lab set. Field by field, including the sampled
// baseline points.
//
// Sibling of tools/parity_test.mjs, which does the same job for ITIES Detect. Two scripts
// rather than one because the two gates compare different things: ITIES compares three
// columns against a CSV, PeakWise compares whole result dictionaries against a JSONL.
//
// The CPython baseline and the notebook agreement are measurements, not code, and they were
// produced in 10_peakwise_web_20260916. They are read from there instead of being copied, so
// there is one of each. Neither travels in the deploy bundle; tools/ does not ship.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { stubMatplotlib, ANALYZE_HELPERS_PY } from "../static/peakwise/algo_stub.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const HURNY = "/Users/pawelkwaczynski/Desktop/claude_brain/projekty/HURNY";
const DATA_DIRS = ["SPE iterations", "Python"];
const SKIP_EXT = new Set([".png", ".jpg", ".jpeg", ".xlsx", ".opju", ".md"]);
const PW_MEASUREMENTS = path.resolve(ROOT, "../10_peakwise_web_20260916/wyniki");
const BASELINE = path.join(PW_MEASUREMENTS, "baseline_cpython.jsonl");
const NOTEBOOK_AGREEMENT = path.join(PW_MEASUREMENTS, "notebook_agreement.txt");
const ALGO_DIR = path.join(ROOT, "algo");
const VERSIONS = path.join(ALGO_DIR, "peakwise_versions.json");
const OUT = path.join(ROOT, "RELEASE_CHECK_PEAKWISE.md");
const ABS_TOL = 1e-9;
const REL_TOL = 1e-12;
// A peak index can legitimately land on the neighbouring sample when two adjacent smoothed
// currents are equal to the last bits and the two scipy builds (native and WASM) round
// savgol_filter differently. That is a tie, not a logic difference, so it is allowed only
// inside a hard bound: one branch, at most two sample steps of Ep, and a relative Ip move
// below TIE_IP_REL. Anything larger fails the gate.
const TIE_EP_MAX_V = 0.005;
const TIE_IP_REL = 1e-3;
// Negative test: report Ip from the tangent intersection instead of the curve. One line,
// and it must move numbers on most files. If it does not, the gate is not wired to anything.
const NEGATIVE_MUTATION = "IP_DEFINICJA = 'styczne'";

const require = createRequire(import.meta.url);
const { loadPyodide } = require("pyodide");

const rssMB = () => +(process.memoryUsage().rss / 1048576).toFixed(1);
const nowS = () => performance.now() / 1000;
const log = (m) => console.error(`[${nowS().toFixed(1)}s rss=${rssMB()}MB] ${m}`);

function listLabFiles() {
  const files = [];
  const walk = (dir, base) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, base);
        continue;
      }
      if (!entry.isFile()) continue;
      if (SKIP_EXT.has(path.extname(entry.name).toLowerCase())) continue;
      files.push({ key: path.relative(HURNY, full), path: full });
    }
  };
  for (const d of DATA_DIRS) walk(path.join(HURNY, d), d);
  files.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return files;
}

function readBaseline() {
  const map = new Map();
  const text = fs.readFileSync(BASELINE, "utf8");
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const item = JSON.parse(line);
    map.set(item.key, item.result);
  }
  return map;
}

const deviation = { abs: 0, rel: 0, at: null };

function numbersClose(a, b, where) {
  if (a === b) return true;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const abs = Math.abs(a - b);
  const rel = abs / Math.max(Math.abs(a), Math.abs(b), Number.MIN_VALUE);
  if (abs > deviation.abs) {
    deviation.abs = abs;
    deviation.rel = rel;
    deviation.at = where;
  }
  return abs <= ABS_TOL || rel <= REL_TOL;
}

// Deep compare, collecting every path that differs.
function compare(got, exp, where, diffs) {
  if (exp === null || exp === undefined) {
    if (got !== null && got !== undefined) diffs.push({ where, got, exp });
    return;
  }
  if (typeof exp === "number") {
    if (typeof got !== "number" || !numbersClose(got, exp, where)) {
      diffs.push({ where, got, exp });
    }
    return;
  }
  if (typeof exp === "string" || typeof exp === "boolean") {
    if (got !== exp) diffs.push({ where, got, exp });
    return;
  }
  if (Array.isArray(exp)) {
    if (!Array.isArray(got) || got.length !== exp.length) {
      diffs.push({ where, got: Array.isArray(got) ? `len ${got.length}` : got, exp: `len ${exp.length}` });
      return;
    }
    for (let i = 0; i < exp.length; i++) compare(got[i], exp[i], `${where}[${i}]`, diffs);
    return;
  }
  if (typeof exp === "object") {
    if (typeof got !== "object" || got === null) {
      diffs.push({ where, got, exp: "object" });
      return;
    }
    const keys = new Set([...Object.keys(exp), ...Object.keys(got)]);
    for (const k of keys) compare(got[k], exp[k], where ? `${where}.${k}` : k, diffs);
    return;
  }
  if (got !== exp) diffs.push({ where, got, exp });
}

async function sha256File(fp) {
  const buf = fs.readFileSync(fp);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fmtDiff(d) {
  return `${d.where}: got ${JSON.stringify(d.got)} exp ${JSON.stringify(d.exp)}`;
}

// Classify one file's differences. Returns null when they stay inside the tie bound.
function tieReason(got, exp, diffs) {
  const branches = new Set();
  for (const d of diffs) {
    const m = /^(anodic|cathodic)\./.exec(d.where);
    if (m) branches.add(m[1]);
    else if (/^Ep_a_V$|^Ip_a_nA$|^Ip_a_uA$/.test(d.where)) branches.add("anodic");
    else if (/^Ep_c_V$|^Ip_c_nA$|^Ip_c_uA$/.test(d.where)) branches.add("cathodic");
    else if (/^dEp|^Ip_ratio$|^result_row\./.test(d.where)) {
      /* derived from the branches, no information of its own */
    } else return `field outside a peak branch: ${d.where}`;
  }
  if (branches.size !== 1) return `differences on ${branches.size} branches`;
  const branch = [...branches][0];
  const tag = branch === "anodic" ? "a" : "c";
  const dEp = Math.abs((got[`Ep_${tag}_V`] ?? 0) - (exp[`Ep_${tag}_V`] ?? 0));
  const ipGot = got[`Ip_${tag}_nA`];
  const ipExp = exp[`Ip_${tag}_nA`];
  if (!Number.isFinite(ipGot) || !Number.isFinite(ipExp)) return "Ip missing on one side";
  const rel = Math.abs(ipGot - ipExp) / Math.max(Math.abs(ipExp), Number.MIN_VALUE);
  if (dEp > TIE_EP_MAX_V) return `Ep moved ${(dEp * 1000).toFixed(2)} mV, over the bound`;
  if (rel > TIE_IP_REL) return `Ip moved ${(rel * 100).toFixed(3)} %, over the bound`;
  if (got.status !== exp.status) return "status changed";
  return null;
}

function writeReleaseCheck(data) {
  const L = [];
  L.push("# RELEASE_CHECK, PeakWise");
  L.push("");
  L.push("Parity gate: the frozen module running in Pyodide against the same module running in");
  L.push("CPython, compared field by field on the whole result dictionary (peaks, baselines,");
  L.push("methods, warnings, CSV row and the 50 sampled baseline points per branch).");
  L.push("");
  L.push("## Environment");
  L.push("");
  L.push(`- date: ${data.date}`);
  L.push(`- pyodide: ${data.pyodide_version}`);
  L.push(`- python (wasm): ${data.python_wasm}, numpy ${data.numpy}, scipy ${data.scipy}, pandas ${data.pandas}`);
  L.push(`- python (cpython baseline): ${data.python_host}`);
  L.push(`- algo ${data.algo_version}, file sha256 ${data.algo_sha256}`);
  L.push(`- notebook cell sha256 ${data.cell_sha256}`);
  L.push(`- files on disk: ${data.n_files}, baseline records: ${data.n_baseline}`);
  L.push(`- load pyodide ${data.t_load_s.toFixed(2)} s, packages ${data.t_packages_s.toFixed(2)} s, analyze ${data.t_analyze_s.toFixed(2)} s`);
  L.push(`- rss at end: ${data.rss_end_MB} MB`);
  L.push("");
  L.push(`## Gate (abs tol ${ABS_TOL}, rel tol ${REL_TOL})`);
  L.push("");
  L.push(`- compared files: ${data.n_compared}`);
  L.push(`- identical on every field: **${data.n_identical} of ${data.n_compared}**`);
  L.push(`- inside the documented tie bound: ${data.n_tie}`);
  L.push(`- real differences: **${data.n_diff_files}**`);
  L.push(`- total differing fields: ${data.n_diff_fields}`);
  L.push(`- missing on disk: ${data.missing_disk}, missing in baseline: ${data.missing_baseline}`);
  L.push(
    `- largest numeric deviation seen anywhere in the parity phase, the tie file included: ` +
      `${data.max_abs.toExponential(3)} absolute ` +
      `(${data.max_rel.toExponential(3)} relative) at ${data.max_at || "none"}`
  );
  L.push("");
  if (data.strict_pass) {
    L.push("STRICT PASS: Pyodide matches CPython on every field of every file.");
  } else if (data.n_diff_files === 0) {
    L.push(
      `PASS WITH ${data.n_tie} TIE: every file matches except peak indices that landed on the ` +
        "neighbouring sample. The strict zero-difference goal is NOT met; the files below are " +
        `inside the bound (Ep at most ${1000 * data.tie_ep_max_V} mV, Ip at most ` +
        `${100 * data.tie_ip_rel} % apart, same status, one branch).`
    );
  } else {
    L.push("FAIL: real differences follow.");
    L.push("");
    for (const d of data.diff_examples) L.push(`- \`${d.file}\`: ${d.reason || ""} ${d.fields.join("; ")}`);
    if (data.n_diff_files > data.diff_examples.length) {
      L.push(`- and ${data.n_diff_files - data.diff_examples.length} more files`);
    }
  }
  if (data.n_tie) {
    L.push("");
    L.push("### Ties");
    L.push("");
    for (const d of data.tie_examples) {
      L.push(`- \`${d.file}\` (${d.n_fields} fields): ${d.fields.slice(0, 4).join("; ")}`);
    }
    L.push("");
    L.push(
      "Cause, measured with tools/diagnose_file.mjs: the parsed E and I arrays are byte " +
        "identical in both runtimes; the Savitzky-Golay output is not, because the WASM build of " +
        "scipy rounds the filter differently in the last bits. Where two adjacent smoothed " +
        "samples are equal to 14 significant digits, find_peaks picks a different one of the two."
    );
  }
  L.push("");
  L.push(`## Negative test (\`${NEGATIVE_MUTATION}\` in memory)`);
  L.push("");
  L.push(`- files re-analysed: ${data.neg_n}`);
  L.push(`- files that now differ from the baseline: **${data.neg_diff_files}**`);
  L.push(`- wall: ${data.t_negative_s.toFixed(2)} s`);
  L.push(
    data.neg_diff_files > 0
      ? "PASS: the gate reports differences when the Ip definition is changed, so it can fail."
      : "FAIL: mutating the Ip definition changed nothing, the gate is not comparing anything."
  );
  L.push("");
  L.push("## Notebook agreement");
  L.push("");
  for (const line of data.notebook_lines) L.push(`- ${line}`);
  L.push("");
  L.push("## Verdict");
  L.push("");
  if (!data.gate_pass) L.push("RELEASE GATE FAIL");
  else if (data.strict_pass) L.push("RELEASE GATE PASS, strict zero differences");
  else L.push(`RELEASE GATE PASS with ${data.n_tie} documented tie, strict zero differences NOT reached`);
  L.push("");
  fs.writeFileSync(OUT, L.join("\n"));
}

async function main() {
  const t0 = nowS();
  if (!fs.existsSync(BASELINE)) throw new Error("missing baseline " + BASELINE);
  const files = listLabFiles();
  const baseline = readBaseline();
  const manifest = JSON.parse(fs.readFileSync(VERSIONS, "utf8"));
  const entry = manifest.find((e) => e.default) || manifest[0];
  const algoPath = path.join(ALGO_DIR, entry.file);
  const algoSha = await sha256File(algoPath);
  if (algoSha !== entry.sha256) {
    throw new Error(`algo sha256 mismatch: file ${algoSha} manifest ${entry.sha256}`);
  }
  log(`files=${files.length} baseline=${baseline.size} algo=${entry.version}`);

  let t = nowS();
  const pyodide = await loadPyodide({ packageCacheDir: path.join(ROOT, "static/pyodide") });
  const tLoad = nowS() - t;
  log(`loadPyodide ${tLoad.toFixed(2)}s pyodide=${pyodide.version}`);

  t = nowS();
  await pyodide.loadPackage(["numpy", "scipy", "pandas"], { messageCallback: () => {} });
  const tPkg = nowS() - t;
  log(`loadPackage ${tPkg.toFixed(2)}s`);

  const src = stubMatplotlib(fs.readFileSync(algoPath, "utf8"));
  pyodide.runPython(src);
  pyodide.runPython(ANALYZE_HELPERS_PY);
  const env = JSON.parse(pyodide.runPython(`
import json, sys, numpy, scipy, pandas
json.dumps({"python": sys.version.split()[0], "numpy": numpy.__version__,
            "scipy": scipy.__version__, "pandas": pandas.__version__,
            "algo": ALGO_VERSION, "cell": ALGO_CELL_SHA256})
`));
  log(`module ${env.algo} python=${env.python} numpy=${env.numpy} scipy=${env.scipy}`);

  pyodide.FS.mkdirTree("/data");
  const results = new Map();
  t = nowS();
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const vpath = "/data/f" + i;
    pyodide.FS.writeFile(vpath, new Uint8Array(fs.readFileSync(f.path)));
    pyodide.globals.set("_pw_name", path.basename(f.path));
    pyodide.globals.set("_pw_path", vpath);
    const dumped = pyodide.runPython(`
content = open(_pw_path, "rb").read()
dump_analyze(_pw_name, content, with_curve=False)
`);
    results.set(f.key, JSON.parse(dumped));
    pyodide.FS.unlink(vpath);
    if ((i + 1) % 50 === 0 || i === 0 || i + 1 === files.length) {
      log(`analyze ${i + 1}/${files.length}`);
    }
  }
  const tAnalyze = nowS() - t;

  let nDiffFields = 0;
  let missingBaseline = 0;
  let missingDisk = 0;
  const hardDiffs = [];
  const tieDiffs = [];
  for (const [key, got] of results) {
    const exp = baseline.get(key);
    if (!exp) {
      missingBaseline++;
      hardDiffs.push({ file: key, fields: ["missing in the CPython baseline"] });
      continue;
    }
    const diffs = [];
    compare(got, exp, "", diffs);
    if (!diffs.length) continue;
    nDiffFields += diffs.length;
    const reason = tieReason(got, exp, diffs);
    const record = {
      file: key,
      n_fields: diffs.length,
      fields: diffs.slice(0, 8).map(fmtDiff),
      reason,
    };
    if (reason) hardDiffs.push(record);
    else tieDiffs.push(record);
  }
  for (const key of baseline.keys()) {
    if (!results.has(key)) {
      missingDisk++;
      hardDiffs.push({ file: key, fields: ["in the baseline, not on disk"] });
    }
  }
  const parityDeviation = { ...deviation };
  log(
    `parity hard=${hardDiffs.length} tie=${tieDiffs.length} fields=${nDiffFields} ` +
      `maxAbs=${parityDeviation.abs.toExponential(2)} at ${parityDeviation.at}`
  );

  // Negative test. It runs after the deviation snapshot so it cannot pollute the numbers above.
  deviation.abs = 0;
  deviation.rel = 0;
  deviation.at = null;
  t = nowS();
  pyodide.runPython(NEGATIVE_MUTATION);
  let negDiffFiles = 0;
  let negN = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const exp = baseline.get(f.key);
    if (!exp) continue;
    negN++;
    const vpath = "/data/n" + i;
    pyodide.FS.writeFile(vpath, new Uint8Array(fs.readFileSync(f.path)));
    pyodide.globals.set("_pw_name", path.basename(f.path));
    pyodide.globals.set("_pw_path", vpath);
    const dumped = pyodide.runPython(`
content = open(_pw_path, "rb").read()
dump_analyze(_pw_name, content, with_curve=False)
`);
    pyodide.FS.unlink(vpath);
    const diffs = [];
    compare(JSON.parse(dumped), exp, "", diffs);
    if (diffs.length) negDiffFiles++;
  }
  const tNeg = nowS() - t;
  log(`negative diffFiles=${negDiffFiles}/${negN} in ${tNeg.toFixed(1)}s`);

  const notebookLines = fs.existsSync(NOTEBOOK_AGREEMENT)
    ? fs.readFileSync(NOTEBOOK_AGREEMENT, "utf8").trim().split("\n")
    : ["not run"];

  const strictPass = hardDiffs.length === 0 && tieDiffs.length === 0;
  const gatePass =
    hardDiffs.length === 0 && missingDisk === 0 && missingBaseline === 0 && negDiffFiles > 0;
  writeReleaseCheck({
    strict_pass: strictPass,
    n_identical: results.size - hardDiffs.length - tieDiffs.length,
    n_tie: tieDiffs.length,
    tie_examples: tieDiffs,
    tie_ep_max_V: TIE_EP_MAX_V,
    tie_ip_rel: TIE_IP_REL,
    date: new Date().toISOString(),
    pyodide_version: pyodide.version,
    python_wasm: env.python,
    python_host: process.env.PW_HOST_PYTHON || "see BUILD_REPORT.md",
    numpy: env.numpy,
    scipy: env.scipy,
    pandas: env.pandas,
    algo_version: entry.version,
    algo_sha256: algoSha,
    cell_sha256: env.cell,
    n_files: files.length,
    n_baseline: baseline.size,
    n_compared: results.size,
    n_diff_files: hardDiffs.length,
    n_diff_fields: nDiffFields,
    missing_disk: missingDisk,
    missing_baseline: missingBaseline,
    diff_examples: hardDiffs.slice(0, 12),
    max_abs: parityDeviation.abs,
    max_rel: parityDeviation.rel,
    max_at: parityDeviation.at,
    t_load_s: tLoad,
    t_packages_s: tPkg,
    t_analyze_s: tAnalyze,
    t_negative_s: tNeg,
    neg_n: negN,
    neg_diff_files: negDiffFiles,
    notebook_lines: notebookLines,
    rss_end_MB: rssMB(),
    gate_pass: gatePass,
    elapsed_s: nowS() - t0,
  });
  fs.writeFileSync(
    path.join(ROOT, "tools/_parity_last_peakwise.json"),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        n_files: files.length,
        n_identical: results.size - hardDiffs.length - tieDiffs.length,
        n_tie_files: tieDiffs.length,
        tie_files: tieDiffs.map((d) => d.file),
        n_diff_files: hardDiffs.length,
        n_diff_fields: nDiffFields,
        max_abs: parityDeviation.abs,
        max_rel: parityDeviation.rel,
        max_at: parityDeviation.at,
        neg_diff_files: negDiffFiles,
        neg_n: negN,
        t_analyze_s: tAnalyze,
        strict_pass: strictPass,
        gate_pass: gatePass,
      },
      null,
      2
    ) + "\n"
  );
  log(`wrote ${OUT} gate=${gatePass ? "PASS" : "FAIL"}`);
  if (!gatePass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
