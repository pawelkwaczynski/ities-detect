#!/usr/bin/env node
// Verifies the exact in-memory parameter mechanism used by the browser worker.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { ANALYZE_HELPERS_PY, stubMatplotlib } from "../static/ities/algo_stub.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const LAB_FILE = path.resolve(
  ROOT,
  "../07_etykiety_lab_20260916/Pozytywne/93P_300ul_TPra(1).txt"
);
const MANIFEST = path.join(ROOT, "algo/versions.json");
const OUT = path.join(ROOT, "tools/_params_override_last.json");
const require = createRequire(import.meta.url);
const { loadPyodide } = require("pyodide");

function assert(condition, message, results) {
  results.assertions += 1;
  if (!condition) {
    results.failures.push(message);
    console.error("FAIL", message);
  } else {
    console.log("PASS", message);
  }
}

async function main() {
  const started = performance.now();
  const results = { assertions: 0, failures: [], file: path.basename(LAB_FILE) };
  if (!fs.existsSync(LAB_FILE)) throw new Error(`missing ${LAB_FILE}`);
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const entry = manifest.find((item) => item.default) || manifest[0];
  const algoPath = path.join(ROOT, "algo", entry.file);

  const pyodide = await loadPyodide({ packageCacheDir: path.join(ROOT, "static/pyodide") });
  await pyodide.loadPackage(["numpy", "scipy", "pandas"], { messageCallback: () => {} });
  pyodide.runPython(stubMatplotlib(fs.readFileSync(algoPath, "utf8")));
  pyodide.runPython(ANALYZE_HELPERS_PY);
  pyodide.runPython("remember_analysis_params()");
  pyodide.FS.writeFile("/tmp/params_case.txt", new Uint8Array(fs.readFileSync(LAB_FILE)));
  pyodide.globals.set("_ities_name", path.basename(LAB_FILE));

  const analyse = () => JSON.parse(pyodide.runPython(`
content = open("/tmp/params_case.txt", "rb").read()
dump_analyze(_ities_name, content, manual=None)
`));

  const initial = analyse();
  pyodide.globals.set(
    "_ities_param_overrides",
    JSON.stringify({ DETECTION_TOLERANCE_V: 0.015 })
  );
  pyodide.runPython("apply_analysis_params(_ities_param_overrides)");
  const custom = analyse();
  pyodide.runPython("apply_analysis_params(None)");
  const reset = analyse();

  assert(initial.status === "uncertain", "default status is uncertain", results);
  assert(Math.abs(initial.delta_Es - 0.36376953125) < 1e-12, "default ΔE_s is 0.36376953125 V", results);
  assert(custom.status === "detected", "15 mV detection tolerance changes status to detected", results);
  assert(Math.abs(custom.delta_Es - initial.delta_Es) < 1e-12, "override does not change ΔE_s", results);
  assert(reset.status === "uncertain", "null reset restores uncertain status", results);
  assert(Math.abs(reset.delta_Es - initial.delta_Es) < 1e-12, "reset preserves original ΔE_s", results);
  const constants = JSON.parse(pyodide.runPython("algo_constants()"));
  assert(constants.DETECTION_TOLERANCE_V === 0.01, "reset restores 10 mV detection tolerance", results);

  results.default = { status: initial.status, delta_Es: initial.delta_Es };
  results.custom = { status: custom.status, delta_Es: custom.delta_Es, detection_tolerance_mV: 15 };
  results.reset = { status: reset.status, delta_Es: reset.delta_Es };
  results.elapsed_s = +((performance.now() - started) / 1000).toFixed(2);
  results.pass = results.failures.length === 0;
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  console.log(
    `${results.pass ? "PASS" : "FAIL"} params override: ${results.assertions - results.failures.length}/${results.assertions} assertions, ${results.elapsed_s}s`
  );
  if (!results.pass) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
