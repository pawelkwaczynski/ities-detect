import { locale, t } from "/shared/i18n.js";
import { verdictInfo } from "./format.js";

const SCALE_MIN_MV = -30;
const SCALE_MAX_MV = 30;
const TICK_STEP_MV = 10;

// Deviation in mV, signed. The engine reports error_mV as an absolute value, so the
// sign is recovered here from delta_Es and the target constant. Thresholds are untouched.
export function signedDeviationMv(result, constants) {
  const target = constants?.AMPHETAMINE_TARGET_DELTA_V;
  if (result.delta_Es != null && target != null) {
    return (Number(result.delta_Es) - Number(target)) * 1000;
  }
  return Number(result.error_mV);
}

function mvText(value) {
  return Number(value).toLocaleString(locale(), { maximumFractionDigits: 1 });
}

export function signedMvText(value) {
  const rounded = Math.round(Number(value));
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded} mV`;
}

function pctFor(mv) {
  return ((mv - SCALE_MIN_MV) / (SCALE_MAX_MV - SCALE_MIN_MV)) * 100;
}

// Keep a label anchored inside the track instead of bleeding past either end.
function anchorFor(pct) {
  if (pct <= 6) return "translateX(0)";
  if (pct >= 94) return "translateX(-100%)";
  return "translateX(-50%)";
}

// The tolerance ruler: where this measurement sits against the two thresholds the
// loaded algorithm version declares. Values come from the module, never from the UI.
// With session parameters in force the bands are hatched, so a ruler drawn against
// custom thresholds can never be mistaken for the validated one.
export function deviationScale(result, constants, tone, custom) {
  const det = (constants?.DETECTION_TOLERANCE_V ?? 0.01) * 1000;
  const unc = (constants?.UNCERTAIN_TOLERANCE_V ?? 0.015) * 1000;
  const dev = signedDeviationMv(result, constants);
  const clamped = Math.max(SCALE_MIN_MV, Math.min(SCALE_MAX_MV, dev));
  const markPct = Math.max(2, Math.min(98, pctFor(clamped)));
  const okPct = (det / (SCALE_MAX_MV - SCALE_MIN_MV)) * 100;
  const warnPct = (unc / (SCALE_MAX_MV - SCALE_MIN_MV)) * 100;

  const ticks = [];
  for (let mv = SCALE_MIN_MV; mv <= SCALE_MAX_MV; mv += TICK_STEP_MV) ticks.push(mv);

  const wrap = document.createElement("div");
  wrap.className = "delta-scale" + (tone ? " tone-" + tone : "") + (custom ? " is-custom" : "");
  wrap.setAttribute("role", "img");
  wrap.setAttribute(
    "aria-label",
    t("scale.aria", {
      dev: signedMvText(dev),
      ok: mvText(det),
      warn: mvText(unc),
      min: SCALE_MIN_MV,
      max: SCALE_MAX_MV,
    })
  );

  const tickMarks = ticks
    .filter((mv) => mv !== 0)
    .map((mv) => `<span class="delta-tick" style="left:${pctFor(mv)}%"></span>`)
    .join("");
  const tickLabels = ticks
    .map((mv) => {
      const pct = pctFor(mv);
      const text = mv === 0 ? "0" : signedMvText(mv).replace(" mV", "");
      return `<span style="left:${pct}%; transform:${anchorFor(pct)}">${text}</span>`;
    })
    .join("");

  wrap.innerHTML = `
    <div class="delta-readout">
      <span class="delta-value tabular" style="left:${markPct}%; transform:${anchorFor(markPct)}">${signedMvText(dev)}</span>
    </div>
    <div class="delta-track">
      <span class="delta-zone warn" style="left:${50 - warnPct}%; width:${warnPct * 2}%"></span>
      <span class="delta-zone ok" style="left:${50 - okPct}%; width:${okPct * 2}%"></span>
      ${tickMarks}
      <span class="delta-zero"></span>
      <span class="delta-mark" style="left:${markPct}%"></span>
    </div>
    <div class="delta-ticks muted tabular">${tickLabels}</div>
    <ul class="delta-legend">
      <li><span class="delta-sw ok"></span>${t("scale.ok", { mv: mvText(det) })}</li>
      <li><span class="delta-sw warn"></span>${t("scale.warn", { mv: mvText(unc) })}</li>
      <li><span class="delta-sw out"></span>${t("scale.out")}</li>
    </ul>`;
  return wrap;
}
