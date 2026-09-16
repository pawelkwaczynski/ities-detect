import { t } from "./i18n.js";
import {
  baselineLabel,
  baselineWindowLabel,
  cycleLabel,
  fmtNum,
  fmtUnit,
  formatTime,
  methodLabel,
  shaShort,
  shapeLabel,
  statusNext,
  statusTone,
  statusWord,
  warningText,
} from "./format.js";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function metric(label, value, note) {
  const box = el("div", "metric");
  box.append(el("div", "metric-label", label), el("div", "metric-value tabular", value));
  if (note) box.appendChild(el("div", "metric-note", note));
  return box;
}

function kv(list, label, value) {
  if (value === undefined || value === null || value === "") return;
  list.append(el("dt", null, label), el("dd", "tabular", String(value)));
}

export function renderResultCard(host, { file, result }) {
  host.innerHTML = "";
  const card = el("section", "card result-card tone-" + statusTone(result?.status));
  const head = el("header", "result-head");
  const titles = el("div", "result-titles");
  titles.append(el("p", "result-electrode muted", file.electrode));
  titles.append(el("h2", "result-file", file.name));
  head.append(titles);
  head.append(el("p", "result-word", statusWord(result?.status)));
  card.append(head);
  card.append(el("p", "result-next muted", statusNext(result?.status)));

  const grid = el("div", "metric-grid");
  const a = result?.anodic;
  const c = result?.cathodic;
  grid.append(
    metric(t("metric.Ip_a"), fmtUnit(a?.Ip_uA, 3, "µA"), a ? methodLabel(a.method_code) : undefined),
    metric(t("metric.Ip_c"), fmtUnit(c?.Ip_uA, 3, "µA"), c ? methodLabel(c.method_code) : undefined),
    metric(t("metric.Ep_a"), fmtUnit(a?.Ep_V, 4, "V"), a ? shapeLabel(a.shape) : undefined),
    metric(t("metric.Ep_c"), fmtUnit(c?.Ep_V, 4, "V"), c ? shapeLabel(c.shape) : undefined),
    metric(t("metric.dEp"), fmtUnit(result?.dEp_mV, 1, "mV")),
    metric(t("metric.ratio"), fmtNum(result?.Ip_ratio, 3))
  );
  card.append(grid);

  if (a || c) {
    const read = el("div", "read-block");
    read.append(el("h3", "read-title", t("read.title")));
    const rows = el("div", "read-rows");
    for (const [branch, key] of [
      [a, "read.anodic"],
      [c, "read.cathodic"],
    ]) {
      if (!branch) continue;
      const row = el("div", "read-row");
      row.append(el("span", "read-branch", t(key)));
      const body = el("div", "read-body");
      body.append(el("p", null, methodLabel(branch.method_code)));
      body.append(
        el(
          "p",
          "muted",
          `${t("read.baseline")}: ${baselineLabel(branch.baseline_rule_code)}, ` +
            baselineWindowLabel(branch.baseline_window)
        )
      );
      row.append(body);
      rows.append(row);
    }
    read.append(rows);
    read.append(
      el(
        "p",
        "muted read-cycle",
        `${t("read.cycle")}: ${cycleLabel(result.cycle_used)}, ` +
          t("cycle.count", { n: result.n_cycles })
      )
    );
    card.append(read);
  }

  const warnings = result?.warnings || [];
  if (warnings.length) {
    const box = el("div", "warn-block");
    box.append(el("h3", "read-title", t("details.warnings")));
    const ul = el("ul", "warn-list");
    for (const w of warnings) ul.append(el("li", "sev-" + (w.severity || "low"), warningText(w)));
    box.append(ul);
    card.append(box);
  }
  host.append(card);
}

export function renderDetails(host, { file, result, config }) {
  host.innerHTML = "";
  if (!result) return;
  const box = el("details", "card details-card");
  box.append(el("summary", null, t("details.title")));

  const a = result.anodic;
  const c = result.cathodic;
  if (a || c) {
    box.append(el("h3", "read-title", t("details.readings")));
    const table = el("table", "readings-table tabular");
    const head = el("tr");
    head.append(
      el("th", null, ""),
      el("th", null, t("details.maximum")),
      el("th", null, t("details.curveAtX")),
      el("th", null, t("details.tangents")),
      el("th", null, t("details.reported"))
    );
    const thead = el("thead");
    thead.append(head);
    table.append(thead);
    const body = el("tbody");
    for (const [branch, key] of [
      [a, "read.anodic"],
      [c, "read.cathodic"],
    ]) {
      if (!branch) continue;
      const tr = el("tr");
      tr.append(
        el("th", null, t(key)),
        el("td", null, fmtUnit(branch.Ip_max_nA, 1, "nA")),
        el("td", null, fmtUnit(branch.Ip_curve_at_x_nA, 1, "nA")),
        el("td", null, fmtUnit(branch.Ip_tangents_nA, 1, "nA")),
        el("td", "is-reported", fmtUnit(branch.Ip_nA, 1, "nA"))
      );
      body.append(tr);
    }
    table.append(body);
    box.append(table);
  }

  const list = el("dl", "kv");
  for (const [branch, key] of [
    [a, "read.anodic"],
    [c, "read.cathodic"],
  ]) {
    if (!branch) continue;
    const prefix = t(key) + ", ";
    kv(list, prefix + t("details.onset"), fmtUnit(branch.E_onset_V, 4, "V"));
    kv(list, prefix + t("details.baselineAtPeak"), fmtUnit(branch.baseline_nA, 1, "nA"));
    kv(list, prefix + t("details.eTangents"), fmtUnit(branch.E_tangents_V, 4, "V"));
    kv(list, prefix + t("details.dropRatio"), fmtNum(branch.drop_ratio, 3));
  }
  kv(list, t("details.points"), result.n_points);
  kv(list, t("details.cycles"), result.n_cycles);
  kv(list, t("read.cycle"), cycleLabel(result.cycle_used));
  kv(list, t("details.fileSha"), file.sha256);
  kv(list, t("details.algo"), result.algo_version);
  kv(list, t("details.algoSha"), file.algoSha);
  kv(list, t("details.cellSha"), result.algo_cell_sha256);
  kv(list, t("details.analysedAt"), formatTime(file.analysedAt));
  box.append(list);

  if (config) {
    const cfg = el("details", "config-block");
    cfg.append(el("summary", null, t("report.thresholds")));
    const clist = el("dl", "kv");
    for (const [name, value] of Object.entries(config)) {
      if (name === "CSV_COLUMNS") continue;
      kv(clist, name, Array.isArray(value) ? value.join(", ") : String(value));
    }
    cfg.append(clist);
    box.append(cfg);
  }
  host.append(box);
}

export { shaShort };
