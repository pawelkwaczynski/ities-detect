import { locale, t } from "/shared/i18n.js";

// Status codes come from the frozen algorithm. Tone and the "has a deviation scale"
// flag are UI facts; every word shown to a human comes from the i18n dictionary.
const STATUS_TONES = {
  detected: { tone: "detected", hasDelta: true, short: "detected" },
  uncertain: { tone: "uncertain", hasDelta: true, short: "uncertain" },
  not_detected: { tone: "not_detected", hasDelta: true, short: "not_detected" },
  TPrA_ONLY: { tone: "quality", hasDelta: false, short: "MEASUREMENT_QUALITY_FAIL" },
  NO_VALID_ANALYTE_PAIR: { tone: "quality", hasDelta: false, short: "MEASUREMENT_QUALITY_FAIL" },
  MEASUREMENT_QUALITY_FAIL: { tone: "quality", hasDelta: false, wrench: true, short: "MEASUREMENT_QUALITY_FAIL" },
  too_few_points: { tone: "quality", hasDelta: false, short: "MEASUREMENT_QUALITY_FAIL" },
  invalid: { tone: "quality", hasDelta: false, short: "MEASUREMENT_QUALITY_FAIL" },
};

const VALID = new Set(["detected", "uncertain", "not_detected"]);
const UNSUITABLE = new Set([
  "TPrA_ONLY",
  "NO_VALID_ANALYTE_PAIR",
  "MEASUREMENT_QUALITY_FAIL",
  "too_few_points",
  "invalid",
]);

export function sampleIdFromName(name) {
  let s = String(name).replace(/\.txt$/i, "");
  s = s.replace(/\(\d+\)\s*$/, "");
  // Lab names stack suffixes in any order: volume, standard marker (TPrA, TPrACl, the
  // TRrACl typo), another volume. Peel them until nothing changes.
  for (let pass = 0; pass < 4; pass += 1) {
    const before = s;
    s = s.replace(/[_\s]?\d+\s*u[lL]\s*$/i, "");
    s = s.replace(/[_\s]?T[PR]rA(?:Cl)?\s*$/i, "");
    s = s.replace(/[_\s]+$/g, "");
    if (s === before) break;
  }
  return s.trim() || name;
}

export function fmtNum(value, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return t("common.none");
  const n = Number(value);
  return n.toLocaleString(locale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtV(value) {
  return fmtNum(value, 3);
}

export function verdictInfo(status) {
  const meta = STATUS_TONES[status];
  if (!meta) {
    return { word: status || "?", short: status || "?", next: "", tone: "quality", hasDelta: false, wrench: false };
  }
  return {
    word: t(`verdict.${status}.word`),
    short: t(`verdict.${meta.short}.short`),
    next: status === "MEASUREMENT_QUALITY_FAIL" ? "" : t(`verdict.${status}.next`),
    tone: meta.tone,
    hasDelta: meta.hasDelta,
    wrench: !!meta.wrench,
  };
}

export function nextSentence(result) {
  if (result.status === "MEASUREMENT_QUALITY_FAIL") {
    const key = `verdict.MEASUREMENT_QUALITY_FAIL.${result.internal_reason}`;
    const text = t(key);
    return text === key ? t("verdict.MEASUREMENT_QUALITY_FAIL.fallback") : text;
  }
  return verdictInfo(result.status).next;
}

export function justification(result, constants) {
  const target = constants?.AMPHETAMINE_TARGET_DELTA_V ?? 0.35;
  if (result.delta_Es == null) {
    const w = result.warnings && result.warnings[0];
    return (w && w.message) || result.warning || t("verdict.noDelta");
  }
  const errMv = result.error_mV != null
    ? Math.abs(Number(result.error_mV))
    : Math.abs(Number(result.delta_Es) - target) * 1000;
  return t("verdict.justification", {
    value: fmtV(result.delta_Es),
    mv: Math.round(errMv),
    target: fmtV(target),
  });
}

export function displayResult(file) {
  return file.expert || file.auto || null;
}

export function sampleAggregate(files) {
  const statuses = files.map((f) => displayResult(f)?.status).filter(Boolean);
  if (statuses.some((s) => s === "detected")) return "detected";
  if (statuses.some((s) => s === "uncertain")) return "uncertain";
  if (statuses.some((s) => VALID.has(s))) return "not_detected";
  if (statuses.length) return "MEASUREMENT_QUALITY_FAIL";
  return null;
}

// Counts per verdict bucket, used for the folder roll-up in the sidebar.
export function bucketCounts(files) {
  const out = { detected: 0, uncertain: 0, not_detected: 0, unsuitable: 0, error: 0, pending: 0 };
  for (const file of files) {
    const status = displayResult(file)?.status;
    if (file.state === "error") out.error += 1;
    else if (!status) out.pending += 1;
    else if (status === "detected") out.detected += 1;
    else if (status === "uncertain") out.uncertain += 1;
    else if (status === "not_detected") out.not_detected += 1;
    else if (UNSUITABLE.has(status)) out.unsuitable += 1;
  }
  return out;
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1000000) {
    return `${(value / 1000).toLocaleString(locale(), { maximumFractionDigits: 1 })} KB`;
  }
  return `${(value / 1000000).toLocaleString(locale(), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} MB`;
}

export function folderStats(files) {
  const counts = bucketCounts(files);
  const analysed = counts.detected + counts.uncertain + counts.not_detected + counts.unsuitable;
  return {
    files: files.length,
    bytes: files.reduce((sum, file) => sum + (Number(file.sizeBytes) || 0), 0),
    detected: counts.detected,
    analysed,
    percent: analysed ? Math.round((counts.detected / analysed) * 100) : null,
  };
}

export function folderStatsText(files) {
  const stats = folderStats(files);
  const params = { n: stats.files, size: formatBytes(stats.bytes) };
  if (stats.percent == null) return t("folder.statsQueued", params);
  return t("folder.stats", {
    ...params,
    detected: stats.detected,
    percent: stats.percent,
  });
}

export function isUnsuitable(status) {
  return UNSUITABLE.has(status);
}

export function matchesFilter(file, filter) {
  const status = displayResult(file)?.status;
  if (filter === "all") return true;
  if (filter === "detected") return status === "detected";
  if (filter === "review") return status === "uncertain";
  if (filter === "not_detected") return status === "not_detected";
  if (filter === "unsuitable") return isUnsuitable(status);
  return true;
}

// ---------------------------------------------------------------- peak prominence

export const DEFAULT_PEAK_PROMINENCE_A = 1.5e-7;

export function promThresholdUa(constants) {
  const value = constants?.PEAK_PROMINENCE_A;
  return (Number.isFinite(Number(value)) ? Number(value) : DEFAULT_PEAK_PROMINENCE_A) * 1e6;
}

// Prominence of point 1 to 4 in µA: from the detector for a peak it found itself,
// from the manual measurement attached by the worker for a point somebody indicated.
export function pointProminenceUa(result, key) {
  const own = result?.points?.[key]?.prom;
  const measured = result?.manual_prominence?.[key];
  const value = own == null ? measured : own;
  return value == null ? null : Number(value) * 1e6;
}

// Which manual points sit under the detector threshold. A saved expert result keeps
// its verdict, but every screen that shows it says which point the algorithm would
// not have read as a peak.
export function belowThresholdPoints(result, constants) {
  if (!result || result.mode !== "manual") return [];
  const threshold = promThresholdUa(constants);
  const out = [];
  for (const key of ["1", "2", "3", "4"]) {
    const value = pointProminenceUa(result, key);
    if (value != null && value < threshold) out.push(key);
  }
  return out;
}

export function belowThresholdSentence(result, constants) {
  const points = belowThresholdPoints(result, constants);
  if (!points.length) return "";
  return t("result.belowThresholdSentence", {
    points: points.join(", "),
    threshold: fmtNum(promThresholdUa(constants), 2),
  });
}

export function shaShort(hex) {
  if (!hex) return "";
  return hex.slice(0, 8) + "..." + hex.slice(-4);
}

export function aggregationRule() {
  return t("table.aggregation");
}

// ---------------------------------------------------------------- algorithm manifest

// The manifest changelog is written in the lab's Polish. The dictionary carries the
// translation, keyed by version; anything the dictionary does not know falls back to
// the manifest text, so a new version is never shown as an empty list.
const ALGO_CHANGELOG_KEYS = {
  "1.1": ["algo.changelog.1_1.lod", "algo.changelog.1_1.pair"],
  "1.0": ["algo.changelog.1_0.notebook"],
};

export function algoChangelog(entry) {
  const keys = ALGO_CHANGELOG_KEYS[entry?.version];
  if (keys && keys.length) return keys.map((key) => t(key));
  return entry?.changelog || [];
}

// One paragraph that says what this algorithm version is: when it was frozen, what it
// changed, what it measured on the lab data and which file it is. Numbers come from
// algo/versions.json, never from the interface.
export function algoInfoText(entry) {
  if (!entry) return "";
  const lines = [t("algo.info.version", { version: entry.version, date: entry.date || "" })];
  for (const item of algoChangelog(entry)) lines.push("- " + item);
  const measured = entry.measured || {};
  if (measured.positives_detected) {
    lines.push(
      t("algo.info.measured", {
        positives: measured.positives_detected,
        negatives: measured.false_positives_negatives || "",
        neutrals: measured.false_positives_neutrals || "",
        date: measured.date || "",
      })
    );
  }
  if (entry.sha256) lines.push(t("algo.info.sha", { sha: shaShort(entry.sha256) }));
  return lines.join("\n");
}

// The first changelog line, for the progress window after a version change.
export function algoFirstChange(entry) {
  const list = algoChangelog(entry);
  return list.length ? list[0] : "";
}
