import { t } from "./i18n.js";

const TOOLTIP_ID = "app-tooltip";
const GAP = 8;
const EDGE = 8;
const DELAY_MS = 300;

let tooltip = null;
let anchor = null;
let described = null;
let timer = 0;
let pinned = false;

function node() {
  if (tooltip) return tooltip;
  tooltip = document.createElement("div");
  tooltip.id = TOOLTIP_ID;
  tooltip.className = "app-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  document.body.appendChild(tooltip);
  return tooltip;
}

function targetOf(eventTarget) {
  return eventTarget instanceof Element
    ? eventTarget.closest("[data-tooltip-key], [data-tooltip-text]")
    : null;
}

function describedTarget(target, eventTarget) {
  if (
    eventTarget instanceof HTMLElement &&
    eventTarget.matches("button, input, select, textarea, a[href], [tabindex]")
  ) {
    return eventTarget;
  }
  return target;
}

function setDescription(target) {
  if (!target) return;
  const ids = new Set((target.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
  ids.add(TOOLTIP_ID);
  target.setAttribute("aria-describedby", [...ids].join(" "));
}

function clearDescription() {
  if (!described) return;
  const ids = (described.getAttribute("aria-describedby") || "")
    .split(/\s+/)
    .filter((id) => id && id !== TOOLTIP_ID);
  if (ids.length) described.setAttribute("aria-describedby", ids.join(" "));
  else described.removeAttribute("aria-describedby");
  described = null;
}

function position() {
  if (!anchor || !tooltip || tooltip.hidden) return;
  const rect = anchor.getBoundingClientRect();
  const tip = tooltip.getBoundingClientRect();
  const left = Math.max(
    EDGE,
    Math.min(rect.left + rect.width / 2 - tip.width / 2, window.innerWidth - tip.width - EDGE)
  );
  const below = rect.bottom + GAP;
  const top = Math.max(EDGE, Math.min(below, window.innerHeight - tip.height - EDGE));
  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.style.top = `${Math.round(top)}px`;
}

function open(target, eventTarget, keepOpen = false) {
  window.clearTimeout(timer);
  const tip = node();
  clearDescription();
  anchor = target;
  described = describedTarget(target, eventTarget);
  pinned = keepOpen;
  // data-tooltip-text wins over the key: an explanation built from the algorithm
  // manifest is data, not a phrase the dictionary could hold.
  tip.textContent = target.dataset.tooltipText || t(target.dataset.tooltipKey);
  // An optional single link, for a tooltip that has somewhere to send the reader. It
  // is only reachable while the tooltip is pinned open by a click.
  const href = target.dataset.tooltipLinkHref;
  if (href) {
    const link = document.createElement("a");
    link.className = "app-tooltip-link";
    link.href = href;
    link.textContent = t(target.dataset.tooltipLinkKey || "common.versions");
    tip.appendChild(link);
  }
  tip.hidden = false;
  if (target.hasAttribute("data-tooltip-click")) {
    target.setAttribute("aria-expanded", keepOpen ? "true" : "false");
  }
  setDescription(described);
  requestAnimationFrame(position);
}

function schedule(target, eventTarget) {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => open(target, eventTarget, false), DELAY_MS);
}

export function hideTooltip(force = false) {
  window.clearTimeout(timer);
  if (pinned && !force) return;
  if (anchor?.hasAttribute("data-tooltip-click")) anchor.setAttribute("aria-expanded", "false");
  if (tooltip) tooltip.hidden = true;
  clearDescription();
  anchor = null;
  pinned = false;
}

export function installTooltips(root = document) {
  node();
  root.addEventListener("mouseover", (event) => {
    const target = targetOf(event.target);
    if (!target || target.contains(event.relatedTarget)) return;
    schedule(target, event.target);
  });
  root.addEventListener("mouseout", (event) => {
    const target = targetOf(event.target);
    if (!target || target.contains(event.relatedTarget)) return;
    if (anchor === target || !anchor) hideTooltip(false);
  });
  root.addEventListener("focusin", (event) => {
    const target = targetOf(event.target);
    if (target) open(target, event.target, false);
  });
  root.addEventListener("focusout", (event) => {
    const target = targetOf(event.target);
    if (target && !target.contains(event.relatedTarget)) hideTooltip(false);
  });
  root.addEventListener("click", (event) => {
    const target = targetOf(event.target);
    if (target?.hasAttribute("data-tooltip-click")) {
      event.preventDefault();
      event.stopPropagation();
      if (anchor === target && pinned) hideTooltip(true);
      else open(target, target, true);
      return;
    }
    if (pinned && tooltip && !tooltip.contains(event.target)) hideTooltip(true);
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideTooltip(true);
  });
  window.addEventListener("resize", position);
  window.addEventListener("scroll", position, true);
}
