import { locale, t } from "/shared/i18n.js";

// Status codes come from the frozen algorithm. Tone and the "has a deviation scale"
// flag are UI facts; every word shown to a human comes from the i18n dictionary.
export const STATUS_TONES = {
  detected: { tone: "detected", hasDelta: true },
  uncertain: { tone: "uncertain", hasDelta: true },
  not_detected: { tone: "not_detected", hasDelta: true },
  TPrA_ONLY: { tone: "quality", hasDelta: false },
  NO_VALID_ANALYTE_PAIR: { tone: "quality", hasDelta: false },
  MEASUREMENT_QUALITY_FAIL: { tone: "quality", hasDelta: false, wrench: true },
  too_few_points: { tone: "quality", hasDelta: false },
  invalid: { tone: "quality", hasDelta: false },
};

const VALID = new Set(["detected", "uncertain", "not_detected", "TPrA_ONLY", "NO_VALID_ANALYTE_PAIR"]);
const UNSUITABLE = new Set(["MEASUREMENT_QUALITY_FAIL", "too_few_points", "invalid"]);

export function sampleIdFromName(name) {
  let s = String(name).replace(/\.txt$/i, "");
  s = s.replace(/\(\d+\)\s*$/, "");
  s = s.replace(/_TPrA$/i, "");
  s = s.replace(/TRrACl_20uL$/i, "");
  s = s.replace(/[_\s]?\d+\s*u[lL]\s*$/i, "");
  s = s.replace(/_+$/g, "");
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
    return { word: status || "?", next: "", tone: "quality", hasDelta: false, wrench: false };
  }
  return {
    word: t(`verdict.${status}.word`),
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

export function sampleSummary(files) {
  const total = files.length;
  const agg = sampleAggregate(files);
  const info = verdictInfo(agg || "invalid");
  const count = files.filter((f) => displayResult(f)?.status === agg).length;
  return t("sample.summary", { count, total, word: info.word });
}

// Counts per verdict bucket, used for the folder roll-up in the sidebar.
export function bucketCounts(files) {
  const out = { detected: 0, uncertain: 0, not_detected: 0, unsuitable: 0, pending: 0 };
  for (const file of files) {
    const status = displayResult(file)?.status;
    if (!status) out.pending += 1;
    else if (status === "detected") out.detected += 1;
    else if (status === "uncertain") out.uncertain += 1;
    else if (UNSUITABLE.has(status)) out.unsuitable += 1;
    else out.not_detected += 1;
  }
  return out;
}

export function isUnsuitable(status) {
  return UNSUITABLE.has(status);
}

export function matchesFilter(file, filter) {
  const status = displayResult(file)?.status;
  if (filter === "all") return true;
  if (filter === "review") return status === "uncertain";
  if (filter === "unsuitable") return isUnsuitable(status);
  return true;
}

export function shaShort(hex) {
  if (!hex) return "";
  return hex.slice(0, 8) + "..." + hex.slice(-4);
}

export function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(locale(), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function aggregationRule() {
  return t("table.aggregation");
}
