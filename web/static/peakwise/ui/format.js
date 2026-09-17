import { t, locale } from "./i18n.js";

// Tones are the same four the shared stylesheet defines. PeakWise has no verdict of guilt,
// so a complete pair is "detected" blue, a half result is amber, nothing found is grey.
export const STATUS_TONE = {
  ok: "detected",
  anodic_only: "uncertain",
  cathodic_only: "uncertain",
  no_peaks: "quality",
  too_few_points: "quality",
  invalid: "quality",
  error: "quality",
};

export function statusWord(status) {
  return t("status." + (status || "invalid"));
}

export function statusNext(status) {
  return t("status.next." + (status || "invalid"));
}

export function statusTone(status) {
  return STATUS_TONE[status] || "quality";
}

export function fmtNum(value, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return t("metric.none");
  return Number(value).toLocaleString(locale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtUnit(value, digits, unit) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return t("metric.none");
  return fmtNum(value, digits) + " " + unit;
}

export function methodLabel(code) {
  return t("method." + (code || "other"));
}

export function shapeLabel(shape) {
  return shape ? t("shape." + shape) : t("metric.none");
}

export function baselineLabel(code) {
  return t("baseline." + (code || "other"));
}

export function baselineWindowLabel(window) {
  if (!window) return t("baseline.noWindow");
  return t("baseline.window", {
    from: fmtNum(window.from_V, 3),
    to: fmtNum(window.to_V, 3),
    width: fmtNum(window.width_V, 3),
  });
}

export function cycleLabel(cycle) {
  if (!cycle) return t("metric.none");
  const key = "cycle." + cycle;
  const text = t(key);
  return text === key ? cycle : text;
}

export function warningText(w) {
  const params = { ...w };
  if (w.branch) params.branch = t("warn.branch." + w.branch);
  if (w.cycle_used) params.cycle = cycleLabel(w.cycle_used);
  if (w.n_cycles) params.n = w.n_cycles;
  const text = t("warn." + w.code, params);
  if (text === "warn." + w.code) return w.detail || w.code;
  return w.detail ? `${text} ${w.detail}` : text;
}

// Electrode identity. A folder is one electrode (the lab convention), so when the browser
// gives a relative path the parent folder wins. Otherwise the scan marker is stripped.
export function electrodeFromFile(name, relativePath) {
  if (relativePath && relativePath.includes("/")) {
    const parts = relativePath.split("/").filter(Boolean);
    if (parts.length >= 2) return parts[parts.length - 2];
  }
  let s = String(name).replace(/\.txt$/i, "");
  s = s.replace(/\s*\(\d+\)\s*$/, "");
  s = s.replace(/[\s_-]*\bba\b\s*$/i, "");
  s = s.replace(/[\s_-]+$/, "");
  return s.trim() || name;
}

export function shaShort(hex) {
  if (!hex) return "";
  return hex.slice(0, 8) + "..." + hex.slice(-4);
}

export function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(locale(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function displayResult(file) {
  return file.result || null;
}

const COMPLETE = new Set(["ok"]);

// The four buckets the sidebar list and the summary bar share. They are PeakWise's own
// reading of a scan, not the ITIES verdicts: a complete peak pair, one branch only,
// no peak on either branch, and a file the algorithm could not read at all.
export const BUCKETS = {
  pair: ["ok"],
  partial: ["anodic_only", "cathodic_only"],
  none: ["no_peaks"],
  unreadable: ["too_few_points", "invalid", "error"],
};

export function bucketOf(status) {
  if (!status) return null;
  for (const [bucket, list] of Object.entries(BUCKETS)) if (list.includes(status)) return bucket;
  return "unreadable";
}

// One pass over the files, so the bar and the list can never disagree. `pending`
// counts the files that have no result yet and therefore belong to no bucket.
export function bucketCounts(files) {
  const counts = { pair: 0, partial: 0, none: 0, unreadable: 0, pending: 0 };
  for (const file of files) {
    const bucket = bucketOf(displayResult(file)?.status);
    if (bucket) counts[bucket] += 1;
    else counts.pending += 1;
  }
  return counts;
}

export function matchesFilter(file, filter) {
  const status = displayResult(file)?.status;
  if (filter === "all" || !filter) return true;
  // "incomplete" is the 1.0 name for everything that is not a clean pair. It stays
  // understood so a session saved by the old build still opens on its own filter.
  if (filter === "incomplete") return !!status && !COMPLETE.has(status);
  return bucketOf(status) === filter;
}

export function electrodeAggregate(files) {
  const statuses = files.map((f) => displayResult(f)?.status).filter(Boolean);
  if (!statuses.length) return null;
  if (statuses.some((s) => s === "ok")) return "ok";
  if (statuses.some((s) => s === "anodic_only" || s === "cathodic_only")) return "anodic_only";
  return statuses[0];
}

export function electrodeSummary(files) {
  const agg = electrodeAggregate(files);
  if (!agg) return "";
  const count = files.filter((f) => displayResult(f)?.status === agg).length;
  return t("sidebar.summary", { count, total: files.length, word: statusWord(agg) });
}
