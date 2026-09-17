import uPlot from "/vendor/uplot/uPlot.esm.js";
import { t } from "/shared/i18n.js";
import { CvChart, pointE, pointI, seriesData } from "./chart.js";
import { displayResult, fmtNum, justification, pointProminenceUa, verdictInfo } from "./format.js";

// Several files at once (addendum 3, point BB). A separate module on purpose: the
// single file screen in result.js is not touched by any of this, and the selection
// lives beside the active file instead of replacing it.

const CARD_CHART_HEIGHT = 280;

// Okabe and Ito, the colour set that stays distinguishable for the common forms of
// colour blindness. Six files get six lines; beyond that the palette repeats and the
// legend still carries the name.
const COMPARE_COLORS = ["#0072B2", "#E69F00", "#009E73", "#CC79A7", "#56B4E9", "#D55E00"];

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function cssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function compareColor(index) {
  return COMPARE_COLORS[index % COMPARE_COLORS.length];
}

function selectionHeader(files, opts) {
  const head = el("header", "multi-head");
  head.appendChild(el("strong", "multi-count", t("multi.selected", { n: files.length })));
  const clear = el("button", "multi-clear", t("multi.clear"));
  clear.type = "button";
  clear.id = "multi-clear";
  clear.addEventListener("click", opts.onClearSelection);
  const compare = el("button", opts.compare ? "is-on" : "", t(opts.compare ? "multi.cards" : "multi.compare"));
  compare.type = "button";
  compare.id = "multi-compare";
  compare.setAttribute("aria-pressed", String(!!opts.compare));
  compare.addEventListener("click", () => opts.onCompare(!opts.compare));
  head.append(clear, compare);
  if (opts.expert) {
    // Pointing at a peak is a one file operation; saying so is better than letting
    // the handles appear on a screen where they cannot mean anything.
    head.appendChild(el("p", "multi-expert-note", t("multi.expertOne")));
  }
  return head;
}

function pointsFold(file, result) {
  const fold = el("details", "multi-peaks");
  fold.appendChild(el("summary", null, t("peaks.title")));
  const table = el("table", "peaks-table tabular");
  const thead = el("thead");
  const trh = el("tr");
  for (const key of ["peaks.col.n", "peaks.col.e", "peaks.col.i", "peaks.col.prom"]) {
    trh.appendChild(el("th", null, t(key)));
  }
  thead.appendChild(trh);
  const tbody = el("tbody");
  for (const key of ["1", "2", "3", "4"]) {
    const e = pointE(result, key, true);
    const i = pointI(result, key);
    const prom = pointProminenceUa(result, key);
    const tr = el("tr");
    tr.append(
      el("td", null, key),
      el("td", null, e == null ? "—" : fmtNum(e, 3)),
      el("td", null, i == null ? "—" : fmtNum(i, 1)),
      el("td", null, prom == null ? "—" : fmtNum(prom, 2))
    );
    tbody.appendChild(tr);
  }
  table.append(thead, tbody);
  fold.appendChild(table);
  return fold;
}

function compactCard(file, opts, charts) {
  const result = displayResult(file);
  const card = el("section", "card multi-card" + (file.id === opts.activeId ? " is-active" : ""));
  card.dataset.fileId = file.id;
  const head = el("header", "multi-card-head");
  const name = el("button", "multi-card-name", file.label || file.name);
  name.type = "button";
  name.addEventListener("click", () => opts.onActivate(file.id));
  head.appendChild(name);
  if (result) {
    const info = verdictInfo(result.status);
    head.appendChild(el("span", "chip " + info.tone, info.word));
  }
  card.appendChild(head);
  if (!result) {
    card.appendChild(el("p", "muted", t("multi.noResult")));
    return card;
  }
  card.appendChild(el("p", "multi-card-why", justification(result, opts.constants)));
  const host = el("div", "chart-host multi-card-chart");
  card.appendChild(host);
  card.appendChild(pointsFold(file, result));
  if (result.curve) {
    const chart = new CvChart(host, { fixedHeight: CARD_CHART_HEIGHT });
    chart.calibrated = opts.calibrated;
    chart.render(result, { expert: false, markers: opts.markers });
    charts.push(chart);
  } else {
    host.appendChild(el("p", "muted", t("empty.noChart")));
  }
  return card;
}

// One plot with every selected curve on it: forward solid, reverse dashed, one colour
// per file. The points 1 to 4 belong to the active file only, otherwise the picture
// turns into confetti.
function comparisonChart(files, opts, charts) {
  const card = el("section", "card multi-compare-card");
  const host = el("div", "chart-host multi-compare-host");
  card.appendChild(host);
  const rows = files
    .map((file) => ({ file, result: displayResult(file) }))
    .filter((row) => row.result?.curve);
  if (!rows.length) {
    host.appendChild(el("p", "muted", t("empty.noChart")));
    return card;
  }
  const grid = cssVar("--chart-grid", "#E5E7EB");
  const axis = cssVar("--chart-axis", "#374151");
  const surface = cssVar("--bg-card", "#FFFFFF");
  const xs = new Set();
  const perFile = rows.map((row) => seriesData(row.result.curve, opts.calibrated));
  for (const data of perFile) for (const value of data.x) xs.add(value);
  const x = [...xs].sort((a, b) => a - b);
  const series = [{}];
  const values = [x];
  rows.forEach((row, index) => {
    const data = perFile[index];
    const lookupF = new Map(data.x.map((value, i) => [value, data.yF[i]]));
    const lookupB = new Map(data.x.map((value, i) => [value, data.yB[i]]));
    values.push(x.map((value) => (lookupF.has(value) ? lookupF.get(value) : null)));
    values.push(x.map((value) => (lookupB.has(value) ? lookupB.get(value) : null)));
    const color = compareColor(index);
    series.push({ stroke: color, width: 2, spanGaps: true, points: { show: false } });
    series.push({ stroke: color, width: 1.6, dash: [6, 4], spanGaps: true, points: { show: false } });
  });
  const width = Math.max(320, host.clientWidth - 4 || 720);
  const plot = new uPlot(
    {
      width,
      height: 420,
      legend: { show: false },
      cursor: { drag: { x: false, y: false } },
      scales: { x: { time: false } },
      axes: [
        {
          stroke: axis,
          grid: { stroke: grid, width: 1 },
          label: t(opts.calibrated ? "chart.axisCal" : "chart.axisRaw"),
          labelFont: `600 12px ${FONT_STACK}`,
          font: `11px ${FONT_STACK}`,
        },
        {
          stroke: axis,
          grid: { stroke: grid, width: 1 },
          label: t("chart.axisI"),
          labelFont: `600 12px ${FONT_STACK}`,
          font: `11px ${FONT_STACK}`,
        },
      ],
      series,
      hooks: {
        drawClear: [
          (u) => {
            u.ctx.save();
            u.ctx.fillStyle = surface;
            u.ctx.fillRect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
            u.ctx.restore();
          },
        ],
        draw: [
          (u) => {
            const active = rows.findIndex((row) => row.file.id === opts.activeId);
            if (active < 0) return;
            const result = rows[active].result;
            const ratio = uPlot.pxRatio || window.devicePixelRatio || 1;
            const ctx = u.ctx;
            ctx.save();
            for (const key of ["1", "2", "3", "4"]) {
              const e = pointE(result, key, opts.calibrated);
              const i = pointI(result, key);
              if (e == null || i == null) continue;
              const px = u.valToPos(e, "x", true);
              const py = u.valToPos(i, "y", true);
              ctx.beginPath();
              ctx.arc(px, py, 5 * ratio, 0, Math.PI * 2);
              ctx.fillStyle = compareColor(active);
              ctx.fill();
              ctx.lineWidth = 2 * ratio;
              ctx.strokeStyle = surface;
              ctx.stroke();
            }
            ctx.restore();
          },
        ],
      },
    },
    values,
    host
  );
  plot.root.setAttribute("role", "img");
  plot.root.setAttribute("aria-label", t("multi.compareAria", { n: rows.length }));
  charts.push({ destroy: () => plot.destroy() });

  const legend = el("div", "multi-legend");
  rows.forEach((row, index) => {
    const item = el("button", "multi-legend-item" + (row.file.id === opts.activeId ? " is-active" : ""));
    item.type = "button";
    item.setAttribute("aria-pressed", String(row.file.id === opts.activeId));
    const swatch = el("span", "multi-legend-swatch");
    swatch.style.background = compareColor(index);
    item.append(swatch, el("span", null, row.file.label || row.file.name));
    item.append(el("span", "muted", " " + verdictInfo(row.result.status).word));
    item.addEventListener("click", () => opts.onActivate(row.file.id));
    legend.appendChild(item);
  });
  card.appendChild(legend);
  return card;
}

// Returns the charts it created, so the caller can destroy them on the next render.
export function renderMulti(host, opts) {
  const charts = [];
  host.innerHTML = "";
  host.appendChild(selectionHeader(opts.files, opts));
  if (opts.compare) {
    host.appendChild(comparisonChart(opts.files, opts, charts));
    return charts;
  }
  for (const file of opts.files) host.appendChild(compactCard(file, opts, charts));
  return charts;
}
