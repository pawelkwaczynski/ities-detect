// Symbols of the PeakWise quantities, written the way electrochemistry papers write them:
// E_pa and E_pc for the anodic and cathodic peak potentials, I_pa and I_pc for the peak
// currents, ΔE_p = E_pa − E_pc for the peak separation and |I_pa/I_pc| for the ratio of
// the two currents. Quantities (E, I) are italic; the operator Δ and the subscripts
// p (peak), a (anodic) and c (cathodic) upright, as IUPAC sets them. Built as MathML from
// the pieces in shared/typeset.js, the same ones ITIES Detect uses.
//
// LaTeX of the same symbols, for a manuscript:
//   E_{\mathrm{pa}}   E_{\mathrm{pc}}   I_{\mathrm{pa}}   I_{\mathrm{pc}}
//   \Delta E_{\mathrm{p}}   \lvert I_{\mathrm{pa}}/I_{\mathrm{pc}} \rvert
// PeakWise reports no half-wave potential, so E_{1/2} has no symbol here.

import { m, upright, wrap } from "/shared/typeset.js";

// key -> quantity letter and subscript. Ep and Ip are the per-branch forms of the report.
const PARTS = {
  Ep_a: ["E", "pa"],
  Ep_c: ["E", "pc"],
  Ip_a: ["I", "pa"],
  Ip_c: ["I", "pc"],
  Ep: ["E", "p"],
  Ip: ["I", "p"],
};

function sub(key) {
  const [letter, label] = PARTS[key];
  return wrap("msub", m("mi", letter), upright(label));
}

function plain(text) {
  return m("mo", text, { stretchy: "false", lspace: "0", rspace: "0" });
}

function body(key) {
  if (key === "dEp") return wrap("mrow", upright("Δ"), sub("Ep"));
  if (key === "ratio") return wrap("mrow", plain("|"), sub("Ip_a"), plain("/"), sub("Ip_c"), plain("|"));
  return sub(key);
}

// key: "Ep_a", "Ep_c", "Ip_a", "Ip_c", "dEp", "ratio", or "Ep" and "Ip" for a branch row.
export function quantitySymbol(key) {
  const math = m("math", null, { class: "qty-symbol" });
  math.appendChild(body(key));
  return math;
}

// The same symbol as markup, for the printed report, which is built as a string.
export function quantityMarkup(key) {
  return quantitySymbol(key).outerHTML;
}

// The same symbols as runs for the canvas (shared/typeset.js drawRuns).
export function quantityRuns(key) {
  const subRuns = (k) => [{ text: PARTS[k][0], italic: true }, { sub: PARTS[k][1] }];
  if (key === "dEp") return [{ text: "Δ" }, ...subRuns("Ep")];
  if (key === "ratio") return [{ text: "|" }, ...subRuns("Ip_a"), { text: "/" }, ...subRuns("Ip_c"), { text: "|" }];
  return subRuns(key);
}

// A label that mixes words and one symbol: the dictionary text carries {q} where the
// symbol goes, so the word order stays the translator's ("{q} method", "Metoda {q}").
export function withSymbol(text, key) {
  const span = document.createElement("span");
  span.className = "qty-label";
  const [before, after = ""] = text.split("{q}");
  if (before) span.append(before);
  span.append(quantitySymbol(key));
  if (after) span.append(after);
  return span;
}
