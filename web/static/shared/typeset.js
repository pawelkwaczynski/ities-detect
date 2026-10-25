// Typesetting shared by ITIES Detect and PeakWise: symbols of quantities as MathML for the
// page and as runs for the canvas. Quantities are italic; operators, labels in subscripts
// and units stay upright, as IUPAC sets them. Each app keeps its own symbols in
// ui/symbols.js and builds them from these pieces.

const NS = "http://www.w3.org/1998/Math/MathML";

export const FONT_STACK = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif';

export function m(tag, text, attrs) {
  const node = document.createElementNS(NS, tag);
  if (text != null) node.textContent = text;
  for (const [name, value] of Object.entries(attrs || {})) node.setAttribute(name, value);
  return node;
}

export function wrap(tag, ...children) {
  const node = m(tag);
  node.append(...children);
  return node;
}

// A single letter in <mi> is italic by default; names of ions, phases and labels stay upright.
export function upright(text) {
  return m("mi", text, { mathvariant: "normal" });
}

// Runs on a canvas, which has no MathML: plain or italic text, and stacks of a
// superscript over a subscript (either may be missing).
export function runFont(size, italic) {
  return `${italic ? "italic " : ""}600 ${Math.round(size)}px ${FONT_STACK}`;
}

export function runsWidth(ctx, runs, size) {
  let width = 0;
  for (const run of runs) {
    if (run.sup != null || run.sub != null) {
      ctx.font = runFont(size * 0.7, false);
      width += Math.max(ctx.measureText(run.sup || "").width, ctx.measureText(run.sub || "").width) + size * 0.1;
    } else {
      ctx.font = runFont(size, run.italic);
      width += ctx.measureText(run.text).width;
    }
  }
  return width;
}

export function drawRuns(ctx, runs, x, y, size) {
  for (const run of runs) {
    if (run.sup != null || run.sub != null) {
      ctx.font = runFont(size * 0.7, false);
      const w = Math.max(ctx.measureText(run.sup || "").width, ctx.measureText(run.sub || "").width);
      if (run.sup) ctx.fillText(run.sup, x + size * 0.05, y - size * 0.34);
      if (run.sub) ctx.fillText(run.sub, x + size * 0.05, y + size * 0.3);
      x += w + size * 0.1;
    } else {
      ctx.font = runFont(size, run.italic);
      ctx.fillText(run.text, x, y);
      x += ctx.measureText(run.text).width;
    }
  }
}
