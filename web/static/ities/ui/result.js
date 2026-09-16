import { locale, t } from "/shared/i18n.js";
import {
  fmtNum,
  fmtV,
  justification,
  nextSentence,
  shaShort,
  verdictInfo,
} from "./format.js";
import { deviationScale, signedDeviationMv, signedMvText, verdictBadge } from "./verdict.js";
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

function fileHead(file, result) {
  const head = el("header", "file-head");
  const main = el("div", "file-head-main");
  const title = el("h1", "file-title", file.name);
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
  main.append(title, meta);
  head.appendChild(main);
  if (result) head.appendChild(verdictBadge(result.status));
  return head;
}

// ---------------------------------------------------------------- KPI row

function kpiCard(labelKey, value, tone, accent) {
  const card = el("div", "kpi" + (tone ? " tone-" + tone : "") + (accent ? " is-accent" : ""));
  card.append(el("span", "kpi-label", t(labelKey)), el("strong", "kpi-value tabular", value));
  return card;
}

function kpiRow(result, constants) {
  const section = el("section", "kpi-row");
  const info = verdictInfo(result.status);
  const target = constants?.AMPHETAMINE_TARGET_DELTA_V;
  const none = t("common.none");
  section.append(
    kpiCard("kpi.delta", result.delta_Es == null ? none : fmtV(result.delta_Es) + " V"),
    kpiCard("kpi.reference", target == null ? none : fmtV(target) + " V"),
    kpiCard(
      "kpi.deviation",
      result.delta_Es == null ? none : signedMvText(signedDeviationMv(result, constants)),
      info.tone,
      true
    ),
    kpiCard("kpi.status", info.word, info.tone)
  );
  const scaleCell = el("div", "kpi kpi-scale");
  scaleCell.appendChild(el("span", "kpi-label", t("kpi.tolerance")));
  if (info.hasDelta && result.delta_Es != null && result.error_mV != null) {
    scaleCell.appendChild(deviationScale(result, constants, info.tone));
  } else {
    // No deviation to place: say why and what to do instead of drawing an empty ruler.
    scaleCell.appendChild(el("p", "kpi-repair", nextSentence(result)));
  }
  section.appendChild(scaleCell);
  return section;
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

function peaksPanel(result, constants, opts) {
  const aside = el("aside", "card peaks-card");
  aside.appendChild(el("h2", "panel-title", t("peaks.title")));

  const rows = ["1", "2", "3", "4"]
    .map((key) => ({
      key,
      e: pointE(result, key, opts.calibrated),
      i: pointI(result, key),
    }))
    .filter((row) => row.e != null && row.i != null);

  if (!rows.length) {
    aside.appendChild(el("p", "muted panel-empty", t("peaks.empty")));
  } else {
    const table = el("table", "peaks-table tabular");
    const thead = el("thead");
    const trh = el("tr");
    for (const key of ["peaks.col.n", "peaks.col.e", "peaks.col.i", "peaks.col.type"]) {
      trh.appendChild(el("th", null, t(key)));
    }
    thead.appendChild(trh);
    const tbody = el("tbody");
    for (const row of rows) {
      const tr = el("tr");
      const first = el("td", "peak-n");
      const dot = el("span", "peak-dot " + (row.key === "1" || row.key === "2" ? "tpra" : "analyte"));
      first.append(dot, el("span", null, row.key));
      tr.append(
        first,
        el("td", null, fmtNum(row.e, 3)),
        el("td", null, fmtNum(row.i, 1)),
        el("td", "peak-type", t("peaks.type." + row.key))
      );
      tbody.appendChild(tr);
    }
    table.append(thead, tbody);
    aside.appendChild(table);
  }

  const actions = el("div", "peaks-actions");
  const again = el("button", "primary");
  again.type = "button";
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

  const analysis = el("div", "analysis-block");
  analysis.appendChild(el("h3", "panel-subtitle", t("analysis.title")));
  const dl = el("dl", "kv kv-tight");
  const window = potentialWindow(result, opts.calibrated);
  if (window) kv(dl, t("analysis.window"), window);
  const target = constants?.AMPHETAMINE_TARGET_DELTA_V;
  kv(dl, t("analysis.reference"), target == null ? t("common.none") : fmtV(target) + " V");
  kv(
    dl,
    t("analysis.delta"),
    result.delta_Es == null ? t("common.none") : fmtV(result.delta_Es) + " V"
  );
  const info = verdictInfo(result.status);
  const devDt = el("dt", null, t("analysis.deviation"));
  const devDd = el(
    "dd",
    "tabular kv-accent tone-" + info.tone,
    result.delta_Es == null ? t("common.none") : signedMvText(signedDeviationMv(result, constants))
  );
  dl.append(devDt, devDd);
  analysis.appendChild(dl);
  analysis.appendChild(el("p", "analysis-why", justification(result, constants)));
  analysis.appendChild(el("p", "analysis-next muted", nextSentence(result)));
  aside.appendChild(analysis);
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

function paramsSection(result, constants) {
  return foldSection("section.params", (body) => {
    const dl = el("dl", "kv");
    const none = t("common.none");
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
        el("span", "muted", " · v" + (entry.version || "?")),
        el("span", "muted", " · " + verdictInfo(entry.status).word)
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

export function renderResult(host, opts) {
  const { file, result, constants, algoVersion, algoSha } = opts;
  host.innerHTML = "";
  host.appendChild(breadcrumbs(file));
  host.appendChild(fileHead(file, result));

  if (!result) {
    const waiting = el("div", "card empty-drop");
    waiting.appendChild(
      el("p", null, file.state === "running" ? t("state.running") : t("empty.noChart"))
    );
    host.appendChild(waiting);
    return null;
  }

  host.appendChild(kpiRow(result, constants));

  const grid = el("div", "result-grid");
  let chart = null;
  const { card, host: chartHost } = chartCard(result, {
    calibrated: opts.calibrated,
    markers: opts.markers,
    chart: () => chart,
    onAxis: opts.onAxis,
    onMarkers: opts.onMarkers,
  });
  grid.appendChild(card);
  grid.appendChild(
    peaksPanel(result, constants, {
      calibrated: opts.calibrated,
      expert: opts.expert,
      onRedetect: opts.onRedetect,
      onEdit: opts.onEdit,
    })
  );
  host.appendChild(grid);

  if (opts.expertPanel) host.appendChild(opts.expertPanel);

  host.appendChild(paramsSection(result, constants));
  host.appendChild(historySection(file, result));
  host.appendChild(metadataSection(file, result, algoVersion, algoSha));

  if (result.curve) {
    chart = new CvChart(chartHost);
    chart.calibrated = opts.calibrated;
    chart.render(result, {
      expert: opts.expert,
      markers: opts.markers,
      onManual: opts.onManual,
    });
  } else {
    chartHost.appendChild(el("p", "muted", t("empty.noChart")));
  }
  return chart;
}
