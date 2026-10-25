#!/usr/bin/env node
import assert from "node:assert/strict";
import { csvColumns, csvText } from "../static/peakwise/ui/csv_columns.js";

const oldColumns = Array.from({ length: 21 }, (_, i) => `column_${i + 1}`);
const newColumns = ["bl_a_regula", "bl_c_regula", "pik_a_na_krawedzi", "korekta_reczna", "ostrzezenia"];
const oldRow = Object.fromEntries(oldColumns.map((key, i) => [key, `old_${i + 1}`]));
const newRow = Object.fromEntries(oldColumns.concat(newColumns).map((key, i) => [key, `new_${i + 1}`]));

function csv(rows) {
  const files = rows.map((row) => ({ result: { result_row: row } }));
  const keys = csvColumns(files);
  return [keys, ...rows.map((row) => keys.map((key) => row[key] ?? ""))];
}

function check(name, run) {
  try {
    run();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}: expected ${error.expected}, got ${error.actual}`);
    process.exitCode = 1;
  }
}

check("uniform 1.0 header matches the old export", () => {
  assert.deepEqual(csv([oldRow, oldRow])[0], oldColumns);
});

check("uniform 1.1 header matches the old export", () => {
  assert.deepEqual(csv([newRow, newRow])[0], oldColumns.concat(newColumns));
});

check("mixed 1.0+1.1 export has 26 result columns and empty 1.0 cells", () => {
  const mixed = csv([oldRow, newRow]);
  assert.equal(mixed[0].length, 26);
  assert.deepEqual(mixed[0], oldColumns.concat(newColumns));
  assert.deepEqual(mixed[1].slice(21, 26), ["", "", "", "", ""]);
  assert.deepEqual(mixed[2].slice(21, 26), newColumns.map((_, i) => `new_${i + 22}`));
});

check("CSV text keeps mixed-version columns and per-file provenance", () => {
  const files = [
    { result: { result_row: oldRow }, electrode: "A", algoVersion: "1.0", algoSha: "sha-10" },
    { result: { result_row: newRow }, electrode: "B", algoVersion: "1.1", algoSha: "sha-11" },
  ];
  const lines = csvText(files, { operator: 'Name, "Lab"' }).trimEnd().split("\n");
  assert.equal(lines.length, 3);
  assert.equal(lines[0], oldColumns.concat(newColumns, ["elektroda", "file_sha256", "algo_version", "algo_sha256", "analysed_at", "operator"]).join(","));
  assert.equal(lines[1], oldColumns.map((_, i) => `old_${i + 1}`).concat(["", "", "", "", "", "A", "", "1.0", "sha-10", "", '"Name, ""Lab"""']).join(","));
  assert.equal(lines[2], oldColumns.concat(newColumns).map((_, i) => `new_${i + 1}`).concat(["B", "", "1.1", "sha-11", "", '"Name, ""Lab"""']).join(","));
});

check("CSV uses result provenance when file metadata is absent", () => {
  const file = {
    result: {
      result_row: { value: 7 },
      algo_version: "1.0",
    },
  };
  const lines = csvText([file]).trimEnd().split("\n");
  assert.equal(lines[1], "7,,,1.0,,,");
});
