import { t } from "/shared/i18n.js";

// The guide outlines the six regions of the screen with the names used in the
// manuscript figure. It only draws on top: nothing underneath moves, and clicks pass
// through to the application. A region that is not on screen is simply skipped.
const REGIONS = [
  { key: "guide.cumulative", selector: "#sidebar .filter-list" },
  { key: "guide.inventory", selector: "#sidebar .tree" },
  { key: "guide.display", selector: "header.toolbar" },
  { key: "guide.data", selector: "#content .chart-card" },
  { key: "guide.tolerance", selector: "#content .delta-scale" },
  { key: "guide.numerical", selector: "#content .peaks-card" },
];
const WATCHED = ["#sidebar", "#content", "header.toolbar"];
const SEEN_KEY = "ities-guide-seen";
const PAD = 5;

let layer = null;
let closeButton = null;
let observer = null;
let frame = 0;
let onChange = null;

function draw() {
  frame = 0;
  if (!layer) return;
  layer.querySelectorAll(".guide-box").forEach((node) => node.remove());
  closeButton.textContent = t("guide.close");
  for (const region of REGIONS) {
    const node = document.querySelector(region.selector);
    if (!node) continue;
    // A region taller than its scrolling panel is framed only where it is visible.
    const full = node.getBoundingClientRect();
    const panel = node.closest("#content, #sidebar");
    const clip = panel ? panel.getBoundingClientRect() : null;
    const top = clip ? Math.max(full.top, clip.top) : full.top;
    const bottom = clip ? Math.min(full.bottom, clip.bottom) : full.bottom;
    const rect = { left: full.left, top, width: full.width, height: bottom - top };
    if (rect.width <= 0 || rect.height <= 0) continue;
    // A closed drawer on a phone keeps its size but sits outside the window.
    if (full.right <= 0 || full.left >= window.innerWidth || bottom <= 0 || top >= window.innerHeight) continue;
    const box = document.createElement("div");
    box.className = "guide-box";
    // A region at the very top of the window gets its label under the frame.
    if (rect.top < 16) box.classList.add("label-below");
    box.style.left = `${Math.round(rect.left - PAD)}px`;
    box.style.top = `${Math.round(rect.top - PAD)}px`;
    box.style.width = `${Math.round(rect.width + 2 * PAD)}px`;
    box.style.height = `${Math.round(rect.height + 2 * PAD)}px`;
    const label = document.createElement("span");
    label.className = "guide-label";
    label.textContent = t(region.key);
    box.appendChild(label);
    layer.appendChild(box);
  }
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(draw);
}

// While the guide is open, Escape belongs to it alone: it is caught before the
// application's own handlers, so one key press does not also cancel a pick or a menu.
function onKey(event) {
  if (event.key !== "Escape") return;
  event.stopPropagation();
  closeGuide();
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Storage can be blocked; the guide then simply opens again next time.
  }
}

// When storage cannot be read, behave as if the guide was seen, so it never nags.
export function guideSeen() {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function isGuideOpen() {
  return !!layer;
}

export function openGuide() {
  if (layer) return;
  layer = document.createElement("div");
  layer.className = "guide-layer";
  closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "guide-close";
  closeButton.addEventListener("click", closeGuide);
  layer.appendChild(closeButton);
  document.body.appendChild(layer);
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  document.addEventListener("transitionend", schedule, true);
  window.addEventListener("keydown", onKey, true);
  observer = new MutationObserver(schedule);
  for (const selector of WATCHED) {
    const root = document.querySelector(selector);
    if (root) observer.observe(root, { childList: true, subtree: true });
  }
  markSeen();
  draw();
  onChange?.(true);
}

export function closeGuide() {
  if (!layer) return;
  window.removeEventListener("resize", schedule);
  window.removeEventListener("scroll", schedule, true);
  document.removeEventListener("transitionend", schedule, true);
  window.removeEventListener("keydown", onKey, true);
  observer?.disconnect();
  observer = null;
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  layer.remove();
  layer = null;
  closeButton = null;
  onChange?.(false);
}

export function installGuide(button) {
  onChange = (open) => {
    button.setAttribute("aria-pressed", String(open));
    button.classList.toggle("is-on", open);
  };
  button.addEventListener("click", () => (layer ? closeGuide() : openGuide()));
}
