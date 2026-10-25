// Symbols of points 1 to 4, E5 and E6, written the way the group's papers write them:
// E with + or − for the positive or negative peak potential and the ion as subscript,
// Δ_org^aq Φ′ for the formal Galvani potential difference of the ion transfer. Built as
// MathML, which every current browser typesets without a library. Quantities (E, Φ) are
// italic, the operator Δ and the labels of ions and phases upright, as IUPAC sets them.
//
// LaTeX of the same symbols, for the manuscript (\varPhi is the italic Φ of amsmath):
//   1  E^{-}_{\mathrm{TPrA}^{+}}      3  E^{-}_{\mathrm{A}^{+}}
//   2  E^{+}_{\mathrm{TPrA}^{+}}      4  E^{+}_{\mathrm{A}^{+}}
//   E5 \Delta_{\mathrm{org}}^{\mathrm{aq}}\varPhi'_{\mathrm{TPrA}^{+}}
//   E6 \Delta_{\mathrm{org}}^{\mathrm{aq}}\varPhi'_{\mathrm{A}^{+}}
// Before calibration the axis is the instrument's, not the Galvani scale, so E5 and E6
// are shown as half-wave potentials, E^{1/2}_{\mathrm{TPrA}^{+}} and E^{1/2}_{\mathrm{A}^{+}}.

const NS = "http://www.w3.org/1998/Math/MathML";

function m(tag, text, attrs) {
  const node = document.createElementNS(NS, tag);
  if (text != null) node.textContent = text;
  for (const [name, value] of Object.entries(attrs || {})) node.setAttribute(name, value);
  return node;
}

function wrap(tag, ...children) {
  const node = m(tag);
  node.append(...children);
  return node;
}

// A single letter in <mi> is italic by default; names of ions and phases stay upright.
function upright(text) {
  return m("mi", text, { mathvariant: "normal" });
}

function ion(tone) {
  return wrap("msup", upright(tone === "tpra" ? "TPrA" : "A"), m("mo", "+"));
}

function peakPotential(sign, tone) {
  return wrap("msubsup", m("mi", "E"), ion(tone), m("mo", sign));
}

function formalPotential(tone) {
  return wrap(
    "mrow",
    wrap("msubsup", upright("Δ"), upright("org"), upright("aq")),
    wrap("msubsup", m("mi", "Φ"), ion(tone), m("mo", "′"))
  );
}

function halfWave(tone) {
  return wrap("msubsup", m("mi", "E"), ion(tone), wrap("mrow", m("mn", "1"), m("mo", "/"), m("mn", "2")));
}

// The same symbols as runs for a canvas, which has no MathML: plain text, italic text
// and stacks of a superscript over a subscript. Ion names carry a Unicode ⁺.
export function peakSymbolRuns(key, calibrated) {
  const ion = key === "1" || key === "2" || key === "E5" ? "TPrA⁺" : "A⁺";
  if (key === "1" || key === "3") return [{ text: "E", italic: true }, { sup: "−", sub: ion }];
  if (key === "2" || key === "4") return [{ text: "E", italic: true }, { sup: "+", sub: ion }];
  if (!calibrated) return [{ text: "E", italic: true }, { sup: "1/2", sub: ion }];
  return [{ text: "Δ" }, { sup: "aq", sub: "org" }, { text: "Φ", italic: true }, { sup: "′", sub: ion }];
}

// key: "1" to "4", "E5" or "E6"; calibrated decides the scale E5 and E6 are read on.
export function peakSymbol(key, calibrated) {
  let body;
  if (key === "1") body = peakPotential("−", "tpra");
  else if (key === "2") body = peakPotential("+", "tpra");
  else if (key === "3") body = peakPotential("−", "analyte");
  else if (key === "4") body = peakPotential("+", "analyte");
  else {
    const tone = key === "E5" ? "tpra" : "analyte";
    body = calibrated ? formalPotential(tone) : halfWave(tone);
  }
  const math = m("math", null, { class: "peak-symbol" });
  math.appendChild(body);
  return math;
}
