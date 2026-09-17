#!/usr/bin/env node
// Every key the interface asks for has to exist in both languages.
//
// Static calls, t("some.key") and data-i18n="some.key", are collected from the sources.
// Keys built at runtime, t("chart.legend.p" + key), cannot be read that way, so the
// families below are listed by hand and expanded. Without them a missing Polish word
// for a verdict would pass unnoticed, which is exactly the failure this check exists
// to catch.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DICT = path.join(ROOT, "static/shared/i18n.js");
const OUT = path.join(ROOT, "tools/_i18n_check_last.json");
const SCAN = [
  path.join(ROOT, "static/ities"),
  path.join(ROOT, "static/shared"),
  path.join(ROOT, "static/index.html"),
  path.join(ROOT, "server/templates"),
];

const STATUSES = [
  "detected",
  "uncertain",
  "not_detected",
  "TPrA_ONLY",
  "NO_VALID_ANALYTE_PAIR",
  "MEASUREMENT_QUALITY_FAIL",
  "too_few_points",
  "invalid",
];

// key source -> the keys it can produce at runtime
const DYNAMIC = {
  // The project timeline on versions.html walks history.1 to history.10.
  "history.<n>.<part>": Array.from({ length: 10 }, (_, i) => i + 1).flatMap((n) => [
    `history.${n}.date`,
    `history.${n}.head`,
    `history.${n}.text`,
  ]),
  "verdict.${status}.word": STATUSES.map((s) => `verdict.${s}.word`),
  "verdict.${status}.next": STATUSES.filter((s) => s !== "MEASUREMENT_QUALITY_FAIL").map(
    (s) => `verdict.${s}.next`
  ),
  "verdict.MEASUREMENT_QUALITY_FAIL.<reason>": [
    "verdict.MEASUREMENT_QUALITY_FAIL.NO_TPRA_IN_WINDOWS",
    "verdict.MEASUREMENT_QUALITY_FAIL.NO_CANDIDATES",
    "verdict.MEASUREMENT_QUALITY_FAIL.NO_VALID_TPRA_PAIR",
    "verdict.MEASUREMENT_QUALITY_FAIL.fallback",
  ],
  'chart.legend.p" + key': ["chart.legend.p1", "chart.legend.p2", "chart.legend.p3", "chart.legend.p4"],
  'peaks.pick." + key': ["peaks.pick.1", "peaks.pick.2", "peaks.pick.3", "peaks.pick.4"],
  'state." + file.state': ["state.queued", "state.running", "state.error"],
  'details.method." + method': [
    "details.method.curve",
    "details.method.peak_max",
    "details.method.tangent_intersection",
    "details.method.peak_max_fallback",
    "details.method.tangents",
  ],
  "app.changelog.<version>": [
    "app.changelog.1_0_0",
    "app.changelog.1_1_0",
    "app.changelog.1_2_0",
    "app.changelog.1_3_0",
    "app.changelog.1_4_0",
  ],
  "login.<server error>": ["login.invalid", "login.rateLimited"],
  // shared/partners.js reads the key out of its table, so the literal call is invisible
  "partner.<institution>": ["partner.ul", "partner.ahe", "partner.airon"],
  "algo.changelog.<version>": [
    "algo.changelog.1_1.lod",
    "algo.changelog.1_1.pair",
    "algo.changelog.1_0.notebook",
  ],
};

function walk(entry, out) {
  const stat = fs.statSync(entry);
  if (stat.isFile()) {
    if (/\.(js|html)$/.test(entry)) out.push(entry);
    return out;
  }
  for (const name of fs.readdirSync(entry).sort()) {
    if (name.startsWith(".")) continue;
    walk(path.join(entry, name), out);
  }
  return out;
}

// Keys of one dictionary object, read as text so the check does not import the module
// and inherit whatever the module believes about the browser.
function dictKeys(source, name) {
  const start = source.indexOf(`const ${name} = {`);
  if (start < 0) throw new Error(`dictionary ${name} not found in ${DICT}`);
  const end = source.indexOf("\n};", start);
  const body = source.slice(start, end);
  const keys = new Set();
  const duplicates = [];
  for (const match of body.matchAll(/^ {2}"([^"]+)":/gm)) {
    if (keys.has(match[1])) duplicates.push(match[1]);
    keys.add(match[1]);
  }
  return { keys, duplicates };
}

function usedKeys(files) {
  const used = new Map();
  // The closing quote has to end the argument: t("chart.legend.p" + key) is a runtime
  // key, not a literal one, and belongs to the DYNAMIC table instead.
  const patterns = [
    /\bt\(\s*"([^"${}]+)"\s*[),]/g,
    /\bt\(\s*'([^'${}]+)'\s*[),]/g,
    /data-i18n(?:-aria|-title|-doc)?="([^"]+)"/g,
    /data-tooltip-key="([^"]+)"/g,
  ];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        const key = match[1];
        if (!key.includes(".")) continue;
        if (!used.has(key)) used.set(key, new Set());
        used.get(key).add(path.relative(ROOT, file));
      }
    }
  }
  for (const [label, keys] of Object.entries(DYNAMIC)) {
    for (const key of keys) {
      if (!used.has(key)) used.set(key, new Set());
      used.get(key).add(`dynamic: ${label}`);
    }
  }
  return used;
}

function main() {
  const source = fs.readFileSync(DICT, "utf8");
  const enDictionary = dictKeys(source, "EN");
  const plDictionary = dictKeys(source, "PL");
  const en = enDictionary.keys;
  const pl = plDictionary.keys;
  const files = [];
  for (const entry of SCAN) walk(entry, files);
  const used = usedKeys(files);
  // Keys handed to t() through a variable, a loop or a table of pairs are still written
  // out somewhere in the sources; a literal search finds those, so "unused" means
  // unused and not merely "called in a way the regex cannot see".
  const sources = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");

  const missing = [];
  for (const [key, where] of [...used.entries()].sort()) {
    const gaps = [];
    if (!en.has(key)) gaps.push("en");
    if (!pl.has(key)) gaps.push("pl");
    if (gaps.length) missing.push({ key, missing: gaps, where: [...where].sort() });
  }
  const onlyEn = [...en].filter((key) => !pl.has(key)).sort();
  const onlyPl = [...pl].filter((key) => !en.has(key)).sort();
  const unused = [...en]
    .filter((key) => !used.has(key) && !sources.includes(`"${key}"`))
    .sort();

  const report = {
    files_scanned: files.length,
    keys_en: en.size,
    keys_pl: pl.size,
    keys_used: used.size,
    missing,
    only_en: onlyEn,
    only_pl: onlyPl,
    duplicate_en: enDictionary.duplicates,
    duplicate_pl: plDictionary.duplicates,
    unused_keys: unused,
    pass:
      missing.length === 0 &&
      onlyEn.length === 0 &&
      onlyPl.length === 0 &&
      enDictionary.duplicates.length === 0 &&
      plDictionary.duplicates.length === 0,
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

  for (const item of missing) {
    console.log(`FAIL ${item.key}: missing in ${item.missing.join(", ")} (${item.where.join("; ")})`);
  }
  for (const key of onlyEn) console.log(`FAIL ${key}: present in EN, absent in PL`);
  for (const key of onlyPl) console.log(`FAIL ${key}: present in PL, absent in EN`);
  for (const key of enDictionary.duplicates) console.log(`FAIL ${key}: duplicate key in EN`);
  for (const key of plDictionary.duplicates) console.log(`FAIL ${key}: duplicate key in PL`);
  if (unused.length) console.log(`note: ${unused.length} dictionary keys are not referenced: ${unused.join(", ")}`);
  console.log(
    `${report.pass ? "PASS" : "FAIL"} i18n: ${used.size} keys used, ${en.size} EN, ${pl.size} PL, ` +
      `${missing.length} missing, ${files.length} files scanned`
  );
  if (!report.pass) process.exit(1);
}

main();
