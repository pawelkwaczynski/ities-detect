// Home icon and application switcher, shared by ITIES Detect and PeakWise.
//
// Both analysers keep their own files in their own IndexedDB, so moving between them
// loses nothing; the tooltip says exactly that. The names are proper nouns and stay
// untranslated, everything else comes from the shared dictionary.
import { t } from "./i18n.js";

export const APPS = [
  { id: "ities", name: "ITIES Detect", href: "/ities/" },
  { id: "peakwise", name: "PeakWise", href: "/peakwise/" },
];

const HOME_ICON =
  '<svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">' +
  '<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" ' +
  'd="M2.5 7.8 9 2.5l6.5 5.3V15a.5.5 0 0 1-.5.5h-3.5v-4.2h-5v4.2H3a.5.5 0 0 1-.5-.5z"/></svg>';

function homeLink() {
  const link = document.createElement("a");
  link.className = "icon-link app-home";
  link.href = "/";
  link.id = "app-home";
  link.innerHTML = HOME_ICON;
  link.dataset.tooltipKey = "tip.home";
  link.setAttribute("aria-label", t("tip.homeLabel"));
  return link;
}

function switcher(currentId) {
  const menu = document.createElement("div");
  menu.className = "menu app-switch";
  menu.id = "app-switch";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.id = "app-switch-trigger";
  trigger.className = "app-switch-trigger";
  trigger.setAttribute("aria-haspopup", "true");
  trigger.setAttribute("aria-expanded", "false");
  trigger.dataset.tooltipKey = "tip.appSwitch";
  trigger.textContent = APPS.find((entry) => entry.id === currentId)?.name || APPS[0].name;
  const list = document.createElement("div");
  list.className = "menu-list";
  list.setAttribute("role", "menu");
  for (const entry of APPS) {
    const item = document.createElement("a");
    item.setAttribute("role", "menuitem");
    item.href = entry.href;
    item.textContent = entry.name;
    if (entry.id === currentId) {
      item.setAttribute("aria-current", "true");
      item.className = "is-current";
    }
    list.appendChild(item);
  }
  menu.append(trigger, list);
  const close = () => {
    menu.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
  };
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = !menu.classList.contains("is-open");
    menu.classList.toggle("is-open", open);
    trigger.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", (event) => {
    if (!menu.contains(event.target)) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  return menu;
}

// One node with the home icon and the switcher, ready to drop into a header.
export function appNav(currentId) {
  const nav = document.createElement("div");
  nav.className = "app-nav";
  nav.append(homeLink(), switcher(currentId));
  return nav;
}

// Cmd/Ctrl+Shift+H goes to the hub from anywhere in either application.
export function installHubShortcut() {
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "h") {
      event.preventDefault();
      location.href = "/";
    }
  });
}
