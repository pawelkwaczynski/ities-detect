// "Back to the application" for every page an analyser sends the operator to.
//
// Leaving ITIES Detect for the versions page or the hub reloads the application on the
// way back, engine and all, which reads as a lost session even though IndexedDB keeps
// everything. A named way back removes the guesswork: it returns to the application the
// visitor came from, and falls back to the page's own analyser when the referrer is
// gone or foreign.
import { onLangChange, t } from "./i18n.js";

const APP_NAMES = { "/ities/": "ITIES Detect", "/peakwise/": "PeakWise" };

// The referrer is trusted only when it is this very origin and one of the two
// analysers. Anything else (a bookmark, a search engine, another site) is ignored.
export function refererApp() {
  try {
    if (!document.referrer) return null;
    const url = new URL(document.referrer);
    if (url.origin !== location.origin) return null;
    for (const path of Object.keys(APP_NAMES)) {
      if (url.pathname.startsWith(path)) return path;
    }
  } catch (_) {
    /* a malformed referrer is no referrer */
  }
  return null;
}

const ARROW =
  '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">' +
  '<path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" ' +
  'stroke-linejoin="round" d="M9.5 3.5 5 8l4.5 4.5M5 8h7"/></svg>';

// `fallback` is the analyser this page belongs to, or null on the hub, where the
// button appears only for someone who arrived from an analyser.
export function mountBackLink(host, { fallback = null } = {}) {
  if (!host) return null;
  const target = refererApp() || fallback;
  if (!target) return null;
  const link = document.createElement("a");
  link.className = "back-link";
  link.id = "back-to-app";
  link.href = target;
  const label = document.createElement("span");
  const paint = () => {
    label.textContent = t("common.backTo", { app: APP_NAMES[target] });
    link.setAttribute("aria-label", label.textContent);
  };
  link.innerHTML = ARROW;
  link.appendChild(label);
  paint();
  onLangChange(paint);
  host.appendChild(link);
  return link;
}
