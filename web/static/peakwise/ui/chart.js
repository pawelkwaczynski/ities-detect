import uPlot from "/vendor/uplot/uPlot.esm.js";
import { t } from "./i18n.js";
import { fmtNum } from "./format.js";

// Colours follow the notebook figure: red marks the anodic peak, blue the cathodic one.
const ANODIC = "#DC2626";
const CATHODIC = "#2563EB";
const HEIGHT = 380;

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function branchSeries(curve) {
  const E = curve.E_V;
  const I = curve.I_nA;
  const ranges = [curve.fwd_range, curve.down_range, curve.up_range];
  const maps = ranges.map(([from, to]) => {
    const m = new Map();
    for (let i = from; i < to && i < E.length; i++) m.set(E[i], I[i]);
    return m;
  });
  const x = [...new Set(E)].sort((a, b) => a - b);
  const ys = maps.map((m) => x.map((v) => (m.has(v) ? m.get(v) : null)));
  return { x, ys };
}

export class CvChart {
  constructor(host) {
    this.host = host;
    this.plot = null;
    this.result = null;
    this.showTangents = true;
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(host);
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

  _resize() {
    if (!this.plot) return;
    this.plot.setSize({ width: Math.max(320, this.host.clientWidth - 8), height: HEIGHT });
  }

  render(result, { showTangents = true } = {}) {
    this.result = result;
    this.showTangents = showTangents;
    this.host.querySelector(".uplot")?.remove();
    this.plot?.destroy();
    this.plot = null;
    const curve = result && result.curve;
    if (!curve || !curve.E_V?.length) {
      this.host.classList.add("is-empty");
      return;
    }
    this.host.classList.remove("is-empty");
    const { x, ys } = branchSeries(curve);
    // The shared token set carries chart specific colours; fall back to the text and
    // hairline tokens when an older copy of tokens.css is in place.
    const text = cssVar("--chart-axis", cssVar("--text", "#1D1D1F"));
    const hair = cssVar("--chart-grid", cssVar("--hairline", "rgba(0,0,0,0.1)"));
    const fwd = cssVar("--fwd", "#64748B");
    const bwd = cssVar("--bwd", "#7C9A86");
    const self = this;

    const opts = {
      width: Math.max(320, this.host.clientWidth - 8),
      height: HEIGHT,
      legend: { show: false },
      cursor: { drag: { x: false, y: false }, focus: { prox: 24 } },
      scales: { x: { time: false } },
      axes: [
        {
          stroke: text,
          grid: { stroke: hair },
          ticks: { stroke: hair },
          label: t("chart.axisE"),
          labelFont: "13px var(--font)",
          font: "12px var(--font)",
        },
        {
          stroke: text,
          grid: { stroke: hair },
          ticks: { stroke: hair },
          label: t("chart.axisI"),
          labelSize: 44,
          labelFont: "13px var(--font)",
          font: "12px var(--font)",
        },
      ],
      series: [
        {},
        { stroke: fwd, width: 1.7, spanGaps: true, points: { show: false } },
        { stroke: bwd, width: 1.7, spanGaps: true, points: { show: false } },
        { stroke: bwd, width: 1.1, dash: [3, 3], spanGaps: true, points: { show: false } },
      ],
      hooks: {
        draw: [(u) => self._overlay(u)],
      },
    };
    this.plot = new uPlot(opts, [x, ys[0], ys[1], ys[2]], this.host);
  }

  _overlay(u) {
    const r = this.result;
    if (!r) return;
    const ctx = u.ctx;
    ctx.save();
    const inside = (px) => px >= u.bbox.left - 1 && px <= u.bbox.left + u.bbox.width + 1;

    const line = (points, color, dash) => {
      if (!points || points.E_V.length < 2) return;
      ctx.beginPath();
      ctx.setLineDash(dash || []);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      let started = false;
      for (let i = 0; i < points.E_V.length; i++) {
        const px = u.valToPos(points.E_V[i], "x", true);
        const py = u.valToPos(points.I_nA[i], "y", true);
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const vline = (e, color, dash) => {
      if (e == null) return;
      const px = u.valToPos(e, "x", true);
      if (!inside(px)) return;
      ctx.beginPath();
      ctx.setLineDash(dash);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1;
      ctx.moveTo(px, u.bbox.top);
      ctx.lineTo(px, u.bbox.top + u.bbox.height);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    };

    const dot = (e, i, color, filled) => {
      if (e == null || i == null) return;
      const px = u.valToPos(e, "x", true);
      const py = u.valToPos(i, "y", true);
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      if (filled) {
        ctx.fillStyle = color;
        ctx.fill();
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };

    const label = (e, i, textValue, color, dy) => {
      if (e == null || i == null) return;
      const px = u.valToPos(e, "x", true);
      const py = u.valToPos(i, "y", true);
      ctx.fillStyle = color;
      ctx.font = "600 12px var(--font)";
      ctx.fillText(textValue, px + 8, py + dy);
    };

    // The Ip the app reports is the vertical distance from the baseline to the reading, so
    // draw exactly that segment rather than a decorative marker.
    const segment = (e, from, to, color) => {
      if (e == null || from == null || to == null) return;
      const px = u.valToPos(e, "x", true);
      ctx.beginPath();
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.moveTo(px, u.valToPos(from, "y", true));
      ctx.lineTo(px, u.valToPos(to, "y", true));
      ctx.stroke();
      ctx.setLineDash([]);
    };

    for (const [branch, color] of [
      [r.anodic, ANODIC],
      [r.cathodic, CATHODIC],
    ]) {
      if (!branch) continue;
      line(branch.baseline_curve, color, [5, 4]);
      vline(branch.Ep_V, color, [5, 4]);
      dot(branch.Ep_V, branch.Ip_raw_nA, color, true);
      label(
        branch.Ep_V,
        branch.Ip_raw_nA,
        `${fmtNum(branch.Ep_V, 3)} V`,
        color,
        branch === r.anodic ? -9 : 16
      );
      if (this.showTangents && branch.E_tangents_V != null) {
        vline(branch.E_tangents_V, color, [2, 3]);
        segment(branch.E_tangents_V, branch.baseline_at_x_nA, branch.curve_at_x_nA, color);
        dot(branch.E_tangents_V, branch.curve_at_x_nA, color, false);
        dot(branch.E_tangents_V, branch.tangent_at_x_nA, color, false);
      }
    }
    ctx.restore();
  }
}

export function chartLegend() {
  const items = [
    ["--fwd", "chart.forward", "line"],
    ["--bwd", "chart.reverseDown", "line"],
    ["--bwd", "chart.reverseUp", "dash"],
    [ANODIC, "chart.peakA", "dot"],
    [ANODIC, "chart.baselineA", "dash"],
    [CATHODIC, "chart.peakC", "dot"],
    [CATHODIC, "chart.baselineC", "dash"],
  ];
  const ul = document.createElement("ul");
  ul.className = "chart-legend";
  for (const [color, key, kind] of items) {
    const li = document.createElement("li");
    const sw = document.createElement("span");
    sw.className = "legend-sw legend-" + kind;
    sw.style.setProperty("--legend-color", color.startsWith("--") ? `var(${color})` : color);
    li.append(sw, document.createTextNode(t(key)));
    ul.appendChild(li);
  }
  return ul;
}

export function renderOffscreenPng(result, { width = 760 } = {}) {
  const hold = document.createElement("div");
  hold.style.cssText = `position:absolute;left:-9999px;top:0;width:${width}px;height:${HEIGHT + 20}px;`;
  document.body.appendChild(hold);
  const chart = new CvChart(hold);
  chart.render(result);
  const png = chart.toPng();
  chart.destroy();
  hold.remove();
  return png;
}
