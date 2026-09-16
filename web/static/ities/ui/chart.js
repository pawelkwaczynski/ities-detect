import uPlot from "/vendor/uplot/uPlot.esm.js";
import { t } from "/shared/i18n.js";
import { fmtNum, verdictInfo } from "./format.js";

// The plot follows the notebook: plot_cv_branches, style_cv_axes, finish_cv_plot and
// set_colored_plot_title from algo/ities_algo_v1.1.py, rebuilt on uPlot draw hooks so
// the chart keeps living in the page (drag handles, axis toggle, zoom, theme).
//
// Two header modes. On screen the card supplies the title, the subtitle and the legend
// as real text (headerMode "dom"), so it reads like the rest of the interface. For the
// printed report the same chart paints its own title and legend on the canvas
// (headerMode "canvas"), so the exported PNG stands on its own.

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif';

const TITLE_BAND = 30; // CSS px reserved above the plot in canvas header mode
const LEGEND_ROW = 18; // CSS px per legend row in canvas header mode
const LEGEND_PAD = 16; // CSS px between the x axis label and the first legend row

const MIN_HEIGHT = 480;
const MAX_HEIGHT = 620;
const ASPECT = 1.72;

const scratch = document.createElement("canvas").getContext("2d");

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function palette() {
  return {
    fwd: cssVar("--fwd", "#64748B"),
    bwd: cssVar("--bwd", "#7C9A86"),
    tpra: cssVar("--pt-tpra", "#2563EB"),
    analyte: cssVar("--pt-analyte", "#DC2626"),
    text: cssVar("--text", "#1D1D1F"),
    axis: cssVar("--chart-axis", "#374151"),
    grid: cssVar("--chart-grid", "#E5E7EB"),
    frame: cssVar("--chart-frame", "#D1D5DB"),
    zero: cssVar("--chart-zero", "#9CA3AF"),
    baseline: cssVar("--chart-baseline", "#111827"),
    surface: cssVar("--bg-card", "#FFFFFF"),
  };
}

export function chartHeight(width) {
  return Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, width / ASPECT)));
}

function seriesData(curve, calibrated) {
  const e = calibrated ? curve.E_cal : curve.E_raw;
  const i = curve.I_uA;
  const fwd = new Map();
  for (const idx of curve.fwd_idx) fwd.set(e[idx], i[idx]);
  const bwd = new Map();
  for (const idx of curve.bwd_idx) bwd.set(e[idx], i[idx]);
  const x = [...new Set([...fwd.keys(), ...bwd.keys()])].sort((a, b) => a - b);
  const yF = x.map((v) => (fwd.has(v) ? fwd.get(v) : null));
  const yB = x.map((v) => (bwd.has(v) ? bwd.get(v) : null));
  return { x, yF, yB };
}

export function pointE(result, key, calibrated) {
  if (calibrated) return result["E" + key];
  return result["E" + key + "_raw"] ?? result.points?.[key]?.E;
}

export function pointI(result, key) {
  const p = result.points?.[key];
  if (!p || p.I == null) return null;
  return p.I * 1e6;
}

// E5 and E6 are the branch midpoints. On the raw axis the algorithm does not report
// them, so they are rebuilt from the raw point pair rather than left out.
export function midE(result, key, calibrated) {
  if (calibrated) return result["E" + key] ?? null;
  const pair = key === "5" ? ["1", "2"] : ["3", "4"];
  const a = pointE(result, pair[0], false);
  const b = pointE(result, pair[1], false);
  if (a == null || b == null) return null;
  return (a + b) / 2;
}

export function seriesLegend() {
  const colors = palette();
  return [
    { kind: "line", color: colors.fwd, label: t("chart.legend.fwd") },
    { kind: "line", color: colors.bwd, label: t("chart.legend.bwd") },
  ];
}

// The key to everything painted on top of the two branches.
export function annotationLegend(result, calibrated) {
  const colors = palette();
  const items = [];
  for (const key of ["1", "2", "3", "4"]) {
    if (pointE(result, key, calibrated) == null || pointI(result, key) == null) continue;
    items.push({
      kind: "dot",
      color: key === "1" || key === "2" ? colors.tpra : colors.analyte,
      label: t("chart.legend.p" + key),
    });
  }
  if (midE(result, "5", calibrated) != null) {
    items.push({ kind: "dash", color: colors.tpra, label: t("chart.legend.e5") });
  }
  if (midE(result, "6", calibrated) != null) {
    items.push({ kind: "dash", color: colors.analyte, label: t("chart.legend.e6") });
  }
  if ((result.baseline_fits || {})["4"]) {
    items.push({ kind: "dash", color: colors.baseline, label: t("chart.legend.baseline") });
  }
  return items;
}

// Pack the legend into centred rows, the way finish_cv_plot lays it out under the axes.
// Widths are device pixels because uPlot draws on an unscaled canvas.
function packLegend(items, maxWidth, ratio) {
  const swatch = 20 * ratio;
  const gap = 6 * ratio;
  const itemGap = 18 * ratio;
  scratch.font = `600 ${Math.round(11 * ratio)}px ${FONT_STACK}`;
  const measured = items.map((item) => ({
    ...item,
    width: swatch + gap + scratch.measureText(item.label).width,
  }));
  const rows = [];
  let row = [];
  let rowWidth = 0;
  for (const item of measured) {
    const add = (row.length ? itemGap : 0) + item.width;
    if (row.length && rowWidth + add > maxWidth) {
      rows.push({ items: row, width: rowWidth });
      row = [];
      rowWidth = 0;
    }
    rowWidth += (row.length ? itemGap : 0) + item.width;
    row.push(item);
  }
  if (row.length) rows.push({ items: row, width: rowWidth });
  return { rows, swatch, gap, itemGap };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// A number or short caption on a filled plate, the canvas answer to the notebook's
// white path-effect stroke: readable over the curve in both themes.
function plate(ctx, text, cx, cy, color, colors, ratio) {
  ctx.font = `700 ${Math.round(12 * ratio)}px ${FONT_STACK}`;
  const w = ctx.measureText(text).width + 9 * ratio;
  const h = 17 * ratio;
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 5 * ratio);
  ctx.fillStyle = colors.surface;
  ctx.globalAlpha = 0.94;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = Math.max(1, ratio);
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy + 0.5 * ratio);
}

export class CvChart {
  constructor(host, { headerMode = "dom" } = {}) {
    this.host = host;
    this.headerMode = headerMode;
    this.plot = null;
    this.result = null;
    this.calibrated = true;
    this.expert = false;
    this.markers = true;
    this.onManual = null;
    this._rows = 2;
    this._dataMin = null;
    this._dataMax = null;
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(host);
    this.handles = document.createElement("div");
    this.handles.className = "chart-handles";
    this.host.appendChild(this.handles);
  }

  destroy() {
    this._ro.disconnect();
    this.plot?.destroy();
    this.plot = null;
  }

  toPng() {
    if (!this.plot) return null;
    return this.plot.ctx.canvas.toDataURL("image/png");
  }

  setMarkers(on) {
    this.markers = !!on;
    this.plot?.redraw();
    this._layoutHandles();
  }

  zoom(factor) {
    const u = this.plot;
    if (!u || this._dataMin == null) return;
    const min = u.scales.x.min;
    const max = u.scales.x.max;
    const mid = (min + max) / 2;
    const span = (max - min) * factor;
    const full = this._dataMax - this._dataMin;
    if (span >= full) return this.resetView();
    if (span < full * 0.02) return;
    let lo = mid - span / 2;
    let hi = mid + span / 2;
    if (lo < this._dataMin) {
      hi += this._dataMin - lo;
      lo = this._dataMin;
    }
    if (hi > this._dataMax) {
      lo -= hi - this._dataMax;
      hi = this._dataMax;
    }
    u.setScale("x", { min: Math.max(lo, this._dataMin), max: Math.min(hi, this._dataMax) });
  }

  resetView() {
    if (!this.plot || this._dataMin == null) return;
    this.plot.setScale("x", { min: this._dataMin, max: this._dataMax });
  }

  _width() {
    return Math.max(320, this.host.clientWidth - 4);
  }

  _height(width) {
    const full = document.fullscreenElement;
    if (full && full.contains(this.host) && this.host.clientHeight > MIN_HEIGHT) {
      return this.host.clientHeight;
    }
    return chartHeight(width);
  }

  _resize() {
    if (!this.plot) return;
    const width = this._width();
    this.plot.setSize({ width, height: this._height(width) });
    this._layoutHandles();
  }

  render(result, { expert = false, onManual, markers } = {}) {
    this.result = result;
    this.expert = expert;
    this.onManual = onManual;
    if (markers !== undefined) this.markers = !!markers;
    const curve = result.curve;
    this.host.querySelector(".uplot")?.remove();
    this.plot?.destroy();
    this.plot = null;
    this.handles.innerHTML = "";
    if (!curve || !curve.E_raw?.length) {
      this.host.classList.add("is-empty");
      return;
    }
    this.host.classList.remove("is-empty");

    const colors = palette();
    const calibrated = this.calibrated;
    const { x, yF, yB } = seriesData(curve, calibrated);
    this._dataMin = x[0];
    this._dataMax = x[x.length - 1];
    const width = this._width();
    const height = this._height(width);
    const ratio = uPlot.pxRatio || window.devicePixelRatio || 1;
    const canvasHeader = this.headerMode === "canvas";
    const items = canvasHeader
      ? seriesLegend().concat(annotationLegend(result, calibrated))
      : [];
    if (canvasHeader) {
      this._rows = packLegend(items, Math.max(120, (width - 90) * ratio), ratio).rows.length;
    }

    const axisLabel = calibrated ? t("chart.axisCal") : t("chart.axisRaw");
    const info = verdictInfo(result.status);
    const verdictColor = cssVar("--verdict-" + info.tone.replace(/_/g, "-"), colors.text);
    const self = this;

    const opts = {
      width,
      height,
      padding: [
        () => (canvasHeader ? TITLE_BAND : 12),
        () => 18,
        () => (canvasHeader ? LEGEND_PAD + self._rows * LEGEND_ROW : 10),
        () => 6,
      ],
      legend: { show: false },
      cursor: { drag: { x: false, y: false }, focus: { prox: 24 } },
      scales: { x: { time: false } },
      axes: [
        {
          stroke: colors.axis,
          grid: { stroke: colors.grid, width: 1 },
          ticks: { stroke: colors.grid, width: 1, size: 5 },
          label: axisLabel,
          labelFont: `600 12px ${FONT_STACK}`,
          font: `11px ${FONT_STACK}`,
          labelGap: 4,
        },
        {
          stroke: colors.axis,
          grid: { stroke: colors.grid, width: 1 },
          ticks: { stroke: colors.grid, width: 1, size: 5 },
          label: t("chart.axisI"),
          labelFont: `600 12px ${FONT_STACK}`,
          font: `11px ${FONT_STACK}`,
          labelGap: 4,
        },
      ],
      series: [
        {},
        { stroke: colors.fwd, width: 2.2, spanGaps: true, points: { show: false } },
        { stroke: colors.bwd, width: 2.2, spanGaps: true, points: { show: false } },
      ],
      hooks: {
        drawClear: [
          (u) => {
            const ctx = u.ctx;
            ctx.save();
            ctx.fillStyle = colors.surface;
            ctx.fillRect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
            ctx.restore();
          },
        ],
        draw: [(u) => self._annotate(u, result, colors, verdictColor, items)],
        setScale: [() => self._layoutHandles()],
        setSize: [() => self._layoutHandles()],
      },
    };
    this.plot = new uPlot(opts, [x, yF, yB], this.host);
    this.plot.root.setAttribute("role", "img");
    this.plot.root.setAttribute(
      "aria-label",
      t("chart.aria", { name: result.file_name || "", verdict: info.word })
    );
    this._layoutHandles();
  }

  _annotate(u, result, colors, verdictColor, items) {
    const ctx = u.ctx;
    const ratio = uPlot.pxRatio || window.devicePixelRatio || 1;
    const calibrated = this.calibrated;
    const left = u.bbox.left;
    const top = u.bbox.top;
    const right = left + u.bbox.width;
    const bottom = top + u.bbox.height;
    ctx.save();

    if (this.markers) {
      // Baseline of the analyte peak, spanning the full axis like the notebook screen.
      const fit = (result.baseline_fits || {})["4"];
      if (fit && fit.a != null && fit.b != null) {
        const shift = calibrated ? Number(result.shift) || 0 : 0;
        const x0 = u.posToVal(left, "x", true);
        const x1 = u.posToVal(right, "x", true);
        ctx.beginPath();
        ctx.setLineDash([7 * ratio, 4 * ratio]);
        ctx.strokeStyle = colors.baseline;
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 1.3 * ratio;
        ctx.moveTo(left, u.valToPos((fit.a * (x0 - shift) + fit.b) * 1e6, "y", true));
        ctx.lineTo(right, u.valToPos((fit.a * (x1 - shift) + fit.b) * 1e6, "y", true));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }

    // Zero current, the quiet reference line from style_cv_axes.
    const zeroY = u.valToPos(0, "y", true);
    if (zeroY > top && zeroY < bottom) {
      ctx.beginPath();
      ctx.strokeStyle = colors.zero;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = Math.max(1, 0.8 * ratio);
      ctx.moveTo(left, zeroY);
      ctx.lineTo(right, zeroY);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (this.markers) {
      // E5 (TPrA) and E6 (analyte), dashed, each with its caption at the top.
      for (const [key, color] of [["5", colors.tpra], ["6", colors.analyte]]) {
        const e = midE(result, key, calibrated);
        if (e == null) continue;
        const px = u.valToPos(e, "x", true);
        if (px < left - 1 || px > right + 1) continue;
        ctx.beginPath();
        ctx.setLineDash([6 * ratio, 4 * ratio]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.8 * ratio;
        ctx.moveTo(px, top);
        ctx.lineTo(px, bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        const cx = Math.min(right - 18 * ratio, Math.max(left + 18 * ratio, px));
        plate(ctx, "E" + key, cx, top + 13 * ratio, color, colors, ratio);
      }

      // The span that decides the verdict.
      const e5 = midE(result, "5", calibrated);
      const e6 = midE(result, "6", calibrated);
      if (result.delta_Es != null && e5 != null && e6 != null) {
        const x5 = u.valToPos(e5, "x", true);
        const x6 = u.valToPos(e6, "x", true);
        const y = top + u.bbox.height * 0.16;
        const head = 5 * ratio;
        ctx.beginPath();
        ctx.strokeStyle = colors.text;
        ctx.lineWidth = 1.6 * ratio;
        ctx.moveTo(x5, y);
        ctx.lineTo(x6, y);
        for (const [x, dir] of [[x5, 1], [x6, -1]]) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + dir * head, y - head * 0.8);
          ctx.moveTo(x, y);
          ctx.lineTo(x + dir * head, y + head * 0.8);
        }
        ctx.stroke();
        plate(
          ctx,
          t("chart.delta", { value: fmtNum(result.delta_Es, 3) }),
          (x5 + x6) / 2,
          y - 13 * ratio,
          colors.text,
          colors,
          ratio
        );
      }

      // Points 1 to 4: a marker you can see plus a numbered label on a plate.
      for (const key of ["1", "2", "3", "4"]) {
        const e = pointE(result, key, calibrated);
        const i = pointI(result, key);
        if (e == null || i == null) continue;
        const px = u.valToPos(e, "x", true);
        const py = u.valToPos(i, "y", true);
        if (px < left || px > right) continue;
        const color = key === "1" || key === "2" ? colors.tpra : colors.analyte;
        ctx.beginPath();
        ctx.arc(px, py, 5.5 * ratio, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 2 * ratio;
        ctx.strokeStyle = colors.surface;
        ctx.stroke();
        const up = key === "2" || key === "4";
        let lx = px + 15 * ratio;
        let ly = py + (up ? -16 : 16) * ratio;
        if (lx > right - 16 * ratio) lx = px - 15 * ratio;
        if (ly < top + 12 * ratio) ly = py + 16 * ratio;
        if (ly > bottom - 12 * ratio) ly = py - 16 * ratio;
        plate(ctx, key, lx, ly, color, colors, ratio);
      }
    }

    // Frame, so the plot reads as a figure and not as floating ink.
    ctx.beginPath();
    ctx.strokeStyle = colors.frame;
    ctx.lineWidth = Math.max(1, ratio);
    ctx.strokeRect(left + 0.5, top + 0.5, u.bbox.width - 1, u.bbox.height - 1);

    if (this.headerMode === "canvas") {
      this._drawTitle(u, result, colors, verdictColor, ratio);
      this._drawLegend(u, items, colors, ratio);
    }
    ctx.restore();
  }

  // File name in the text colour, verdict word in the verdict colour, centred over
  // the plot, exactly what set_colored_plot_title does in the notebook.
  _drawTitle(u, result, colors, verdictColor, ratio) {
    const ctx = u.ctx;
    const info = verdictInfo(result.status);
    const size = Math.round(14 * ratio);
    ctx.font = `600 ${size}px ${FONT_STACK}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const sep = "  |  ";
    const verdict = info.word;
    const maxWidth = u.bbox.width;
    let name = result.file_name || "";
    let prefix = name + sep;
    const verdictWidth = ctx.measureText(verdict).width;
    while (name.length > 4 && ctx.measureText(prefix).width + verdictWidth > maxWidth) {
      name = name.slice(0, -2);
      prefix = name + "…" + sep;
    }
    const prefixWidth = ctx.measureText(prefix).width;
    const startX = u.bbox.left + (maxWidth - prefixWidth - verdictWidth) / 2;
    const y = u.bbox.top - TITLE_BAND * ratio * 0.5;
    ctx.fillStyle = colors.text;
    ctx.fillText(prefix, startX, y);
    ctx.fillStyle = verdictColor;
    ctx.fillText(verdict, startX + prefixWidth, y);
  }

  _drawLegend(u, items, colors, ratio) {
    const ctx = u.ctx;
    const { rows, swatch, gap, itemGap } = packLegend(items, u.bbox.width, ratio);
    this._rows = rows.length;
    // The legend owns the bottom band of the canvas, measured from the canvas edge so
    // it can never land on the x axis label.
    const baseY = u.ctx.canvas.height - (rows.length * LEGEND_ROW + 2) * ratio;
    ctx.font = `600 ${Math.round(11 * ratio)}px ${FONT_STACK}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    rows.forEach((row, rowIndex) => {
      let x = u.bbox.left + (u.bbox.width - row.width) / 2;
      const y = baseY + rowIndex * LEGEND_ROW * ratio + LEGEND_ROW * ratio * 0.5;
      for (const item of row.items) {
        ctx.strokeStyle = item.color;
        ctx.fillStyle = item.color;
        if (item.kind === "dot") {
          ctx.beginPath();
          ctx.arc(x + swatch / 2, y, 4.5 * ratio, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 1.5 * ratio;
          ctx.strokeStyle = colors.surface;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.lineWidth = 2.4 * ratio;
          if (item.kind === "dash") ctx.setLineDash([5 * ratio, 3 * ratio]);
          ctx.moveTo(x, y);
          ctx.lineTo(x + swatch, y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.fillStyle = colors.axis;
        ctx.fillText(item.label, x + swatch + gap, y);
        x += item.width + itemGap;
      }
    });
  }

  _layoutHandles() {
    this.handles.innerHTML = "";
    if (!this.expert || !this.plot || !this.result) return;
    const u = this.plot;
    const rect = u.over.getBoundingClientRect();
    const hostRect = this.host.getBoundingClientRect();
    for (const key of ["1", "2", "3", "4"]) {
      const e = pointE(this.result, key, this.calibrated);
      const i = pointI(this.result, key);
      if (e == null || i == null) continue;
      const left = u.valToPos(e, "x", false);
      const top = u.valToPos(i, "y", false);
      const h = document.createElement("button");
      h.type = "button";
      h.className = "pt-handle pt-" + key;
      h.textContent = key;
      h.style.left = (rect.left - hostRect.left + left - 11) + "px";
      h.style.top = (rect.top - hostRect.top + top - 11) + "px";
      h.addEventListener("pointerdown", (ev) => this._drag(ev, key, h));
      this.handles.appendChild(h);
    }
  }

  _drag(ev, key, handle) {
    ev.preventDefault();
    handle.setPointerCapture(ev.pointerId);
    const u = this.plot;
    const move = (e) => {
      const r = u.over.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      handle.style.left = (handle.offsetLeft + e.movementX) + "px";
      handle.style.top = (handle.offsetTop + e.movementY) + "px";
      handle.dataset.e = String(u.posToVal(x, "x"));
      handle.dataset.i = String(u.posToVal(y, "y"));
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      const eVal = Number(handle.dataset.e);
      if (!Number.isFinite(eVal) || !this.onManual) return;
      // nearest_on_branch expects raw E, so every point travels raw and the dragged
      // one is converted back from the calibrated axis when that axis is showing.
      const manual = {};
      for (const k of ["1", "2", "3", "4"]) {
        const raw = this.result["E" + k + "_raw"] ?? this.result.points?.[k]?.E;
        if (raw != null) manual["E" + k] = raw;
      }
      const shift = this.calibrated ? Number(this.result.shift) || 0 : 0;
      manual["E" + key] = eVal - shift;
      this.onManual(manual);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  }
}

export function renderOffscreenPng(result, { width = 800, calibrated = true } = {}) {
  const hold = document.createElement("div");
  hold.style.cssText =
    "position:absolute;left:-9999px;top:0;width:" + width + "px;height:" + chartHeight(width) + "px;";
  document.body.appendChild(hold);
  const chart = new CvChart(hold, { headerMode: "canvas" });
  chart.calibrated = calibrated;
  chart.render(result);
  const png = chart.toPng();
  chart.destroy();
  hold.remove();
  return png;
}
