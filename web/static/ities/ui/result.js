import { locale, t } from "/shared/i18n.js";
import {
  belowThresholdPoints,
  fmtNum,
  fmtV,
  justification,
  nextSentence,
  pointProminenceUa,
  promThresholdUa,
  shaShort,
  verdictInfo,
} from "./format.js";
import { deviationScale } from "./verdict.js";
import { CvChart, annotationLegend, pointE, pointI, seriesLegend } from "./chart.js";

// The result screen: who this file is, the four numbers that decide the verdict, the
// curve at a size you can actually read, the peaks behind the verdict, and the full
// record folded away underneath.

const ICONS = {
  zoomIn:
    '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" d="M7 1.8a5.2 5.2 0 1 0 0 10.4A5.2 5.2 0 0 0 7 1.8zm3.8 8.9 3.4 3.4M4.6 7h4.8M7 4.6v4.8"/></svg>',
  zoomOut:
    '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" d="M7 1.8a5.2 5.2 0 1 0 0 10.4A5.2 5.2 0 0 0 7 1.8zm3.8 8.9 3.4 3.4M4.6 7h4.8"/></svg>',
  reset:
    '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" d="M13.2 8a5.2 5.2 0 1 1-1.6-3.7M13.4 2v3h-3"/></svg>',
  full:
    '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/></svg>',
  detect:
    '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" d="M1.5 11.5 5 6.5l2.5 3L10 4l4.5 7.5"/></svg>',
  edit:
    '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.5" d="m10.5 2.5 3 3-8 8-3.5.5.5-3.5z"/></svg>',
  trash:
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M3 4.5h10M6 2.5h4l.5 2H5.5l.5-2ZM4.5 4.5l.6 9h5.8l.6-9M6.7 7v4M9.3 7v4"/></svg>',
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function iconButton(icon, labelKey, onClick, extraClass) {
  const button = el("button", "icon-btn" + (extraClass ? " " + extraClass : ""));
  button.type = "button";
  button.innerHTML = icon;
  button.title = t(labelKey);
  button.setAttribute("aria-label", t(labelKey));
  button.addEventListener("click", onClick);
  return button;
}

function kv(dl, label, value) {
  dl.append(el("dt", null, label), el("dd", "tabular", value));
}

function fileSizeText(bytes) {
  if (bytes == null) return t("common.none");
  const kib = bytes / 1024;
  return kib < 1024
    ? `${kib.toLocaleString(locale(), { maximumFractionDigits: 1 })} KiB`
    : `${(kib / 1024).toLocaleString(locale(), { maximumFractionDigits: 2 })} MiB`;
}

function methodLabel(result) {
  const method = result.Ip_method_analyte_fwd;
  if (!method) return t("common.none");
  const key = "details.method." + method;
  const text = t(key);
  return text === key ? method : text;
}

function potentialWindow(result, calibrated) {
  const curve = result.curve;
  if (!curve) return null;
  const e = calibrated ? curve.E_cal : curve.E_raw;
  if (!e || !e.length) return null;
  let min = e[0];
  let max = e[0];
  for (const v of e) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return `${fmtV(min)} → ${fmtV(max)} V`;
}

// ---------------------------------------------------------------- breadcrumbs, head

function breadcrumbs(file) {
  const nav = el("nav", "crumbs");
  nav.setAttribute("aria-label", t("breadcrumb.label"));
  const parts = [];
  if (file.folder) parts.push(file.folder);
  if (file.sampleId && file.sampleId !== file.name) parts.push(file.sampleId);
  parts.push(file.label || file.name);
  parts.forEach((part, index) => {
    if (index) nav.appendChild(el("span", "crumb-sep", "›"));
    nav.appendChild(el("span", index === parts.length - 1 ? "crumb is-current" : "crumb", part));
  });
  return nav;
}

function paramsTitle(overrides) {
  if (!overrides) return "";
  return [
    `${t("analysisParams.detected")} ${overrides.DETECTION_TOLERANCE_V * 1000} mV`,
    `${t("analysisParams.review")} ${overrides.UNCERTAIN_TOLERANCE_V * 1000} mV`,
    `${t("analysisParams.target")} ${overrides.AMPHETAMINE_TARGET_DELTA_V} V`,
    `${t("analysisParams.forward")} ${(overrides.WIN_TPRA_POS_RAW || []).join(" → ")} V`,
    `${t("analysisParams.reverse")} ${(overrides.WIN_TPRA_NEG_RAW || []).join(" → ")} V`,
  ].join("\n");
}

function fileHead(file, result, onRemove) {
  const head = el("header", "file-head");
  const main = el("div", "file-head-main");
  const titleRow = el("div", "file-title-row");
  const title = el("h1", "file-title", file.name);
  titleRow.appendChild(title);
  if (file.paramsOverride) {
    const custom = el("span", "params-badge", t("params.custom"));
    custom.title = paramsTitle(file.paramsOverride);
    titleRow.appendChild(custom);
  }
  const meta = el("p", "file-meta muted");
  const bits = [];
  if (file.sampleId) bits.push(t("head.sample", { id: file.sampleId }));
  if (file.fileModified) {
    bits.push(new Date(file.fileModified).toLocaleString(locale()));
  }
  if (result?.n_points_total != null) {
    bits.push(
      result.n_points_used != null && result.n_points_used !== result.n_points_total
        ? t("head.pointsUsed", { used: result.n_points_used, total: result.n_points_total })
        : t("head.points", { n: result.n_points_total })
    );
  }
  if (result?.cycle_used != null) {
    bits.push(t("head.cycle", { used: result.cycle_used, total: result.n_cycles_detected ?? "?" }));
  }
  if (!result) bits.push(t("head.noAnalysis"));
  meta.textContent = bits.join(" · ");
  main.appendChild(titleRow);
  main.appendChild(meta);
  head.appendChild(main);
  if (onRemove) head.appendChild(iconButton(ICONS.trash, "session.removeFile", onRemove, "file-delete"));
  return head;
}

// ---------------------------------------------------------------- verdict card

// Who signed this reading. An expert correction never hides the automatic one, so the
// line always carries both words, exactly as SPEC 3.4 asks.
function expertLabel(result, operator) {
  const time = result._savedAtLabel || "";
  if (!time) return t("print.expert");
  return operator
    ? t("verdict.expertWho", { operator, time })
    : t("verdict.expertNoName", { time });
}

function verdictPart(label, status) {
  const info = verdictInfo(status);
  const part = el("span", "verdict-part");
  part.append(
    el("span", "verdict-part-label", label + ": "),
    el("strong", "verdict-part-word tone-" + info.tone, info.word)
  );
  return part;
}

function verdictHeadline(file, result, operator, constants) {
  const isManual = result.mode === "manual" && file.auto;
  if (!isManual) {
    const info = verdictInfo(result.status);
    return el("p", "verdict-word tone-" + info.tone, info.word);
  }
  const pair = el("div", "verdict-word verdict-word-pair");
  const automatic = verdictPart(t("verdict.auto"), file.auto.status);
  automatic.classList.add("verdict-part-auto");
  const expert = verdictPart(expertLabel(result, result._operator || operator), result.status);
  expert.classList.add("verdict-part-expert");
  // A manual point the detector would not call a peak is named right here, in amber,
  // next to the expert word it produced.
  const weak = belowThresholdPoints(result, constants);
  if (weak.length) {
    expert.appendChild(
      el("span", "verdict-below-threshold", " " + t("verdict.belowThresholdNote", { points: weak.join(", ") }))
    );
  }
  pair.append(automatic, expert);
  return pair;
}

// The card of version 1.0: the word, the number that decided it, what to do next, and
// the tolerance ruler with its legend. Nothing on this screen says the verdict twice.
function verdictCard(file, result, constants, opts) {
  const info = verdictInfo(result.status);
  const card = el("section", "card verdict-card tone-" + info.tone);
  const main = el("div", "verdict-main");
  main.append(
    verdictHeadline(file, result, opts.operator, constants),
    el("p", "verdict-why", justification(result, constants)),
    el("p", "verdict-next muted", nextSentence(result))
  );
  if (opts.onNextReview) {
    const next = el("button", "verdict-next-review");
    next.type = "button";
    next.textContent = t("verdict.nextReview");
    next.addEventListener("click", opts.onNextReview);
    main.appendChild(next);
  }
  card.appendChild(main);

  const side = el("div", "verdict-side");
  if (info.hasDelta && result.delta_Es != null && result.error_mV != null) {
    if (opts.paramsCustom) side.appendChild(el("p", "scale-custom-label", t("scale.custom")));
    side.appendChild(deviationScale(result, constants, info.tone, opts.paramsCustom));
  }
  card.appendChild(side);
  return card;
}

// ---------------------------------------------------------------- chart card

function legendList(items, className) {
  const ul = el("ul", className);
  for (const item of items) {
    const li = el("li");
    const sw = el("span", "legend-sw legend-" + item.kind);
    sw.style.setProperty("--sw", item.color);
    li.append(sw, el("span", null, item.label));
    ul.appendChild(li);
  }
  return ul;
}

function chartCard(result, opts) {
  const card = el("section", "card chart-card");
  const head = el("header", "chart-head");
  const titles = el("div");
  titles.append(
    el("h2", "chart-title", t("chart.title")),
    el(
      "p",
      "chart-subtitle muted",
      result.mode === "manual" ? t("chart.subtitleExpert") : t("chart.subtitleAuto")
    )
  );
  head.append(titles, legendList(seriesLegend(), "chart-series-legend"));
  card.appendChild(head);

  const host = el("div", "chart-host");
  card.appendChild(host);

  const foot = el("div", "chart-foot");
  const axis = el("div", "seg");
  axis.setAttribute("role", "group");
  axis.setAttribute("aria-label", t("chart.axisGroup"));
  const bCal = el("button", null, t("chart.toggleCal"));
  bCal.type = "button";
  bCal.setAttribute("aria-pressed", String(opts.calibrated));
  bCal.addEventListener("click", () => opts.onAxis(true));
  const bRaw = el("button", null, t("chart.toggleRaw"));
  bRaw.type = "button";
  bRaw.setAttribute("aria-pressed", String(!opts.calibrated));
  bRaw.addEventListener("click", () => opts.onAxis(false));
  axis.append(bCal, bRaw);

  const markers = el("label", "switch");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = opts.markers;
  checkbox.addEventListener("change", () => opts.onMarkers(checkbox.checked));
  markers.append(checkbox, el("span", "switch-track"), el("span", null, t("chart.markers")));

  const buttons = el("div", "chart-buttons");
  buttons.setAttribute("role", "group");
  buttons.setAttribute("aria-label", t("chart.controls"));
  buttons.append(
    iconButton(ICONS.zoomIn, "chart.zoomIn", () => opts.chart()?.zoom(0.7)),
    iconButton(ICONS.zoomOut, "chart.zoomOut", () => opts.chart()?.zoom(1 / 0.7)),
    iconButton(ICONS.reset, "chart.reset", () => opts.chart()?.resetView()),
    iconButton(ICONS.full, "chart.fullscreen", () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else card.requestFullscreen?.();
    })
  );

  foot.append(axis, markers, buttons);
  card.appendChild(foot);

  const annotations = annotationLegend(result, opts.calibrated);
  if (annotations.length && opts.markers) {
    card.appendChild(legendList(annotations, "chart-annotation-legend"));
  }
  return { card, host };
}

// ---------------------------------------------------------------- peaks panel

function pairMidpoint(result, a, b, calibrated) {
  if (calibrated) {
    const key = a === "1" ? "E5" : "E6";
    if (result[key] != null) return result[key];
  }
  const first = pointE(result, a, calibrated);
  const second = pointE(result, b, calibrated);
  return first == null || second == null ? null : (first + second) / 2;
}

// WCAG 2.2 dragging-alternative: every point 1 to 4 is also a number field, stepping
// by 1 mV, so the expert correction never depends on a mouse drag.
function peakInput(key, value, opts) {
  const input = document.createElement("input");
  input.type = "number";
  input.step = "0.001";
  input.className = "peak-input tabular";
  input.value = value == null ? "" : Number(value).toFixed(3);
  input.setAttribute("aria-label", t("peaks.eInput", { n: key }));
  input.addEventListener("change", () => {
    const parsed = Number(input.value);
    if (!input.value.trim() || !Number.isFinite(parsed)) return;
    opts.onPointInput(key, parsed);
  });
  return input;
}

// Prominence of the point, and a plain warning when it is under the threshold the
// detector uses. The expert keeps the decision, the screen keeps the fact.
function promCell(result, row, opts) {
  const cell = el("td", "peak-prom");
  if (!row.editable) {
    cell.textContent = "—";
    return cell;
  }
  const value = pointProminenceUa(result, row.key);
  if (value == null) {
    cell.textContent = "—";
    return cell;
  }
  const threshold = promThresholdUa(opts.constants);
  cell.appendChild(el("span", null, fmtNum(value, 2)));
  if (value < threshold) {
    const flag = el("span", "peak-below-threshold", t("peaks.belowThreshold"));
    flag.dataset.tooltipText = t("tip.belowThreshold", {
      value: fmtNum(value, 2),
      threshold: fmtNum(threshold, 2),
    });
    cell.appendChild(flag);
  }
  return cell;
}

function peaksPanel(result, opts) {
  const aside = el("aside", "card peaks-card");
  aside.appendChild(el("h2", "panel-title", t("peaks.title")));

  const rows = [
    { key: "1", meaning: t("peaks.meaning.1"), e: pointE(result, "1", opts.calibrated), i: pointI(result, "1"), tone: "tpra", editable: true },
    { key: "2", meaning: t("peaks.meaning.2"), e: pointE(result, "2", opts.calibrated), i: pointI(result, "2"), tone: "tpra", editable: true },
    { key: "3", meaning: t("peaks.meaning.3"), e: pointE(result, "3", opts.calibrated), i: pointI(result, "3"), tone: "analyte", editable: true },
    { key: "4", meaning: t("peaks.meaning.4"), e: pointE(result, "4", opts.calibrated), i: pointI(result, "4"), tone: "analyte", editable: true },
    { key: "E5", meaning: t("peaks.meaning.5"), e: pairMidpoint(result, "1", "2", opts.calibrated), i: null, tone: "tpra" },
    { key: "E6", meaning: t("peaks.meaning.6"), e: pairMidpoint(result, "3", "4", opts.calibrated), i: null, tone: "analyte" },
  ];
  const table = el("table", "peaks-table tabular");
  const thead = el("thead");
  const trh = el("tr");
  for (const key of ["peaks.col.n", "peaks.col.meaning", "peaks.col.e", "peaks.col.i", "peaks.col.prom"]) {
    trh.appendChild(el("th", null, t(key)));
  }
  thead.appendChild(trh);
  const tbody = el("tbody");
  for (const row of rows) {
    const tr = el("tr");
    const first = el("td", "peak-n");
    const dot = el("span", "peak-dot " + row.tone);
    first.append(dot, el("span", null, row.key));
    const eCell = el("td");
    const shown = row.editable && opts.draft?.[row.key] != null ? opts.draft[row.key] : row.e;
    if (row.editable && opts.expert) eCell.appendChild(peakInput(row.key, shown, opts));
    else eCell.textContent = shown == null ? "—" : fmtNum(shown, 3);
    tr.append(
      first,
      el("td", "peak-type", row.meaning),
      eCell,
      el("td", null, row.i == null ? "—" : fmtNum(row.i, 1)),
      promCell(result, row, opts)
    );
    tbody.appendChild(tr);
  }
  table.append(thead, tbody);
  aside.appendChild(table);

  const actions = el("div", "peaks-actions");
  const missingAnalyte =
    (result.E3_raw == null || result.E4_raw == null) &&
    ["TPrA_ONLY", "NO_VALID_ANALYTE_PAIR", "not_detected"].includes(result.status);
  const missingStandard =
    (result.E1_raw == null || result.E2_raw == null) &&
    result.status === "MEASUREMENT_QUALITY_FAIL" &&
    ["NO_TPRA_IN_WINDOWS", "NO_VALID_TPRA_PAIR"].includes(result.internal_reason);
  if (missingAnalyte || missingStandard) {
    const kind = missingAnalyte ? "analyte" : "standard";
    const pick = el("button", "primary " + (missingAnalyte ? "seed-analyte" : "seed-standard"));
    pick.type = "button";
    pick.textContent = t(missingAnalyte ? "peaks.addAnalyte" : "peaks.addStandard");
    pick.dataset.tooltipKey = missingAnalyte ? "tip.addAnalyte" : "tip.addStandard";
    pick.setAttribute("aria-pressed", String(opts.pick?.kind === kind));
    pick.addEventListener("click", () => opts.onPick(kind));
    actions.appendChild(pick);
  }
  const again = el("button", "primary");
  again.type = "button";
  again.classList.add("peaks-redetect");
  again.dataset.tooltipKey = "tip.redetect";
  again.innerHTML = ICONS.detect;
  again.append(document.createTextNode(" " + t("peaks.redetect")));
  again.addEventListener("click", opts.onRedetect);
  const edit = el("button", opts.expert ? "is-on" : "");
  edit.type = "button";
  edit.innerHTML = ICONS.edit;
  edit.append(document.createTextNode(" " + t(opts.expert ? "peaks.editOff" : "peaks.edit")));
  edit.setAttribute("aria-pressed", String(!!opts.expert));
  edit.addEventListener("click", opts.onEdit);
  actions.append(again, edit);
  aside.appendChild(actions);
  return aside;
}

// ---------------------------------------------------------------- folded sections

function foldSection(titleKey, build, open) {
  const details = el("details", "card fold");
  details.open = !!open;
  const summary = el("summary");
  summary.append(el("span", "fold-title", t(titleKey)));
  details.appendChild(summary);
  const body = el("div", "fold-body");
  build(body);
  details.appendChild(body);
  return details;
}

function paramsSection(result, constants, calibrated) {
  return foldSection("section.params", (body) => {
    const dl = el("dl", "kv");
    const none = t("common.none");
    kv(dl, t("analysis.window"), potentialWindow(result, calibrated) || none);
    kv(dl, t("params.detectionMethod"), methodLabel(result));
    kv(dl, t("details.ipTpraFwd"), fmtNum(result.Ip_TPrA_fwd_uA, 3) + " µA");
    kv(dl, t("details.ipTpraBwd"), fmtNum(result.Ip_TPrA_bwd_uA, 3) + " µA");
    kv(
      dl,
      t("details.ipAnalyteFwd"),
      t("details.ipWithMethod", {
        value: fmtNum(result.Ip_analyte_fwd_uA, 3),
        method: methodLabel(result),
      })
    );
    kv(dl, t("details.ipAnalyteBwd"), fmtNum(result.Ip_analyte_bwd_uA, 3) + " µA");
    kv(
      dl,
      t("details.concentration"),
      result.c_analyte_uM == null
        ? none
        : t("details.concentrationValue", {
            value: fmtNum(result.c_analyte_uM, 1),
            calibration: result.calibration || constants?.KALIBRACJA_AKTYWNA || none,
          })
    );
    kv(
      dl,
      t("details.purity"),
      result.purity_pct == null ? none : `${fmtNum(result.purity_pct, 1)} %`
    );
    kv(dl, t("details.lodLoq"), `${fmtNum(result.LOD_uM, 2)} / ${fmtNum(result.LOQ_uM, 2)} µM`);
    kv(dl, t("details.shift"), result.shift == null ? none : `${fmtV(result.shift)} V`);
    kv(
      dl,
      t("params.points"),
      result.n_points_total == null
        ? none
        : t("head.pointsUsed", {
            used: result.n_points_used ?? result.n_points_total,
            total: result.n_points_total,
          })
    );
    kv(
      dl,
      t("params.cycles"),
      t("details.cyclesValue", {
        total: result.n_cycles_detected ?? none,
        used: result.cycle_used ?? none,
      })
    );
    body.appendChild(dl);

    const thresholds = el("dl", "kv");
    const c = constants || {};
    kv(dl, t("details.statusCode"), result.status + (result.internal_reason ? " / " + result.internal_reason : ""));
    kv(thresholds, t("params.tpraTarget"), c.TPRA_TARGET_V == null ? none : `${c.TPRA_TARGET_V} V`);
    kv(
      thresholds,
      t("params.amphTarget"),
      c.AMPHETAMINE_TARGET_DELTA_V == null ? none : `${c.AMPHETAMINE_TARGET_DELTA_V} V`
    );
    kv(
      thresholds,
      t("params.tolerance"),
      c.DETECTION_TOLERANCE_V == null
        ? none
        : `${c.DETECTION_TOLERANCE_V} V / ${c.UNCERTAIN_TOLERANCE_V} V`
    );
    kv(
      thresholds,
      t("params.prominence"),
      c.PEAK_PROMINENCE_A == null ? none : `${c.PEAK_PROMINENCE_A} A`
    );
    kv(thresholds, t("params.calibration"), c.KALIBRACJA_AKTYWNA || none);
    kv(
      thresholds,
      t("params.weak"),
      c.WEAK_PEAK_CANDIDATES == null ? none : c.WEAK_PEAK_CANDIDATES ? t("common.yes") : t("common.no")
    );
    body.append(el("h3", "fold-subtitle", t("params.thresholds")), thresholds);

    const warnings = result.warnings || [];
    if (warnings.length) {
      const ul = el("ul", "warn-list");
      for (const w of warnings) ul.appendChild(el("li", null, w.message || w.code));
      body.appendChild(ul);
    }
  });
}

function historySection(file, result) {
  return foldSection("section.history", (body) => {
    const list = el("ol", "history-list");
    const entries = [];
    for (const rev of file.revisions || []) {
      entries.push({
        at: rev.at,
        mode: rev.mode,
        version: rev.version,
        status: rev.status,
        current: false,
      });
    }
    if (result) {
      entries.push({
        at: file.analysedAt,
        mode: result.mode,
        version: file.algoVersion,
        status: result.status,
        current: true,
      });
    }
    if (!entries.length) {
      body.appendChild(el("p", "muted", t("history.none")));
      return;
    }
    for (const entry of entries.reverse()) {
      const li = el("li", "history-entry");
      const line = el("div", "history-line");
      line.append(
        el("strong", null, entry.mode === "manual" ? t("history.expert") : t("history.auto")),
        el("span", "muted", " · v" + (entry.version || "?"))
      );
      const when = el(
        "div",
        "muted history-when",
        (entry.at ? new Date(entry.at).toLocaleString(locale()) : "") +
          (entry.current ? " · " + t("history.current") : "")
      );
      li.append(line, when);
      list.appendChild(li);
    }
    body.appendChild(list);
    if (entries.length === 1) body.appendChild(el("p", "muted", t("history.none")));
  });
}

function metadataSection(file, result, algoVersion, algoSha) {
  return foldSection("section.metadata", (body) => {
    const dl = el("dl", "kv");
    const none = t("common.none");
    kv(dl, t("meta.fileName"), file.name);
    if (file.folder) kv(dl, t("meta.folder"), file.label ? file.folder + "/" + file.label : file.folder);
    kv(dl, t("meta.size"), fileSizeText(file.sizeBytes));
    kv(
      dl,
      t("meta.modified"),
      file.fileModified ? new Date(file.fileModified).toLocaleString(locale()) : none
    );
    kv(dl, t("details.fileSha"), file.sha256 || none);
    kv(dl, t("details.algo"), `v${algoVersion} ${shaShort(algoSha)}`);
    kv(dl, t("details.algoSha"), algoSha || none);
    kv(
      dl,
      t("details.analysedAt"),
      file.analysedAt ? new Date(file.analysedAt).toLocaleString(locale()) : none
    );
    kv(dl, t("details.mode"), result?.mode === "manual" ? t("mode.manual") : t("mode.auto"));
    if (result?.E_column) kv(dl, "E column", result.E_column);
    if (result?.I_column) kv(dl, "I column", result.I_column);
    body.appendChild(dl);
  });
}

// ---------------------------------------------------------------- entry point

// While the worker chews on this file the screen keeps its shape: a grey verdict card
// and a grey chart, marked busy, instead of an empty page that looks broken.
function skeleton() {
  const wrap = el("div", "skeleton");
  wrap.setAttribute("aria-busy", "true");
  const card = el("div", "card skeleton-verdict");
  card.append(el("span", "skeleton-bar w-l"), el("span", "skeleton-bar w-m"), el("span", "skeleton-bar w-s"));
  const chart = el("div", "card skeleton-chart");
  wrap.append(card, chart);
  wrap.appendChild(el("p", "muted", t("state.running")));
  return wrap;
}

export function renderResult(host, opts) {
  const { file, result, constants, algoVersion, algoSha } = opts;
  host.innerHTML = "";
  host.appendChild(breadcrumbs(file));
  host.appendChild(fileHead(file, result, opts.onRemove));

  if (!result) {
    if (file.state === "running") {
      host.appendChild(skeleton());
      return null;
    }
    const waiting = el("div", "card empty-drop");
    waiting.appendChild(el("p", null, t("empty.noChart")));
    host.appendChild(waiting);
    return null;
  }

  host.appendChild(verdictCard(file, result, constants, opts));

  const grid = el("div", "result-grid");
  let chart = null;
  const { card, host: chartHost } = chartCard(result, {
    calibrated: opts.calibrated,
    markers: opts.markers,
    chart: () => chart,
    onAxis: opts.onAxis,
    onMarkers: opts.onMarkers,
  });
  if (opts.pick) {
    const hint = el("p", "pick-hint");
    hint.append(
      el("strong", null, t("peaks.pick." + opts.pick.key)),
      el("span", "muted", " " + t("peaks.pickEscape"))
    );
    card.insertBefore(hint, chartHost);
  }
  grid.appendChild(card);
  grid.appendChild(
    peaksPanel(result, {
      calibrated: opts.calibrated,
      constants,
      expert: opts.expert,
      pick: opts.pick,
      draft: opts.draft,
      onRedetect: opts.onRedetect,
      onEdit: opts.onEdit,
      onPick: opts.onPick,
      onPointInput: opts.onPointInput,
    })
  );
  host.appendChild(grid);

  if (opts.expertPanel) host.appendChild(opts.expertPanel);

  host.appendChild(paramsSection(result, constants, opts.calibrated));
  host.appendChild(historySection(file, result));
  host.appendChild(metadataSection(file, result, algoVersion, algoSha));

  if (result.curve) {
    chart = new CvChart(chartHost);
    chart.calibrated = opts.calibrated;
    chart.render(result, {
      expert: opts.expert,
      markers: opts.markers,
      pick: opts.pick,
      onManual: opts.onManual,
      onPickPoint: opts.onPickPoint,
    });
  } else {
    chartHost.appendChild(el("p", "muted", t("empty.noChart")));
  }
  return chart;
}
