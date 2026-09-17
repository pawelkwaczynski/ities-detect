// Visible, remembered user preferences: interface language and theme.
// Both render as segmented controls, both live in the toolbar, both persist.

import { LANGS, applyStatic, getLang, onLangChange, setLang, t } from "./i18n.js";

const THEME_KEY = "ities-theme";
const THEMES = ["system", "light", "dark"];

export function getTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved && THEMES.includes(saved)) return saved;
  } catch (_) {
    /* private mode */
  }
  return "system";
}

export function applyTheme(mode) {
  if (mode === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", mode);
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch (_) {
    /* private mode */
  }
}

// One segmented control. Options carry a label key so a language switch can relabel
// them in place without rebuilding the DOM.
// Theme icons: monitor for "system", sun for "light", moon for "dark". Drawn inline so
// the control stays a 3-button strip 96 px wide; the words move into the tooltip.
const THEME_ICONS = {
  system:
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="12" height="8" rx="1.5"/><path d="M6 13.5h4M8 11v2.5"/></svg>',
  light:
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M3.4 12.6l1.3-1.3M11.3 4.7l1.3-1.3"/></svg>',
  dark:
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M13.5 10.2A6 6 0 0 1 5.8 2.5a6 6 0 1 0 7.7 7.7z"/></svg>',
};

export function createSegmented({ labelKey, options, value, onChange, className = "", icons = null }) {
  const wrap = document.createElement("div");
  wrap.className = ("seg" + (className ? " " + className : "")).trim();
  wrap.setAttribute("role", "group");
  const buttons = [];
  for (const option of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.value = option.value;
    button.setAttribute("aria-pressed", String(option.value === value));
    button.addEventListener("click", () => {
      for (const other of buttons) {
        other.setAttribute("aria-pressed", String(other.dataset.value === option.value));
      }
      onChange(option.value);
    });
    buttons.push(button);
    wrap.appendChild(button);
  }
  const relabel = () => {
    wrap.setAttribute("aria-label", t(labelKey));
    options.forEach((option, index) => {
      const label = t(option.labelKey);
      if (icons && icons[option.value]) {
        buttons[index].innerHTML = icons[option.value];
        buttons[index].setAttribute("aria-label", label);
        buttons[index].title = label;
        buttons[index].classList.add("seg-icon");
      } else {
        buttons[index].textContent = label;
      }
    });
  };
  relabel();
  wrap.relabel = relabel;
  return wrap;
}

export function createLangSwitch(onChange) {
  return createSegmented({
    labelKey: "prefs.language",
    className: "seg-lang",
    options: LANGS.map((lang) => ({ value: lang, labelKey: "lang." + lang })),
    value: getLang(),
    onChange: (lang) => {
      setLang(lang);
      onChange?.(lang);
    },
  });
}

export function createThemeSwitch() {
  const current = getTheme();
  applyTheme(current);
  return createSegmented({
    labelKey: "prefs.theme",
    className: "seg-theme",
    options: THEMES.map((mode) => ({ value: mode, labelKey: "prefs.theme." + mode })),
    value: current,
    onChange: applyTheme,
    icons: THEME_ICONS,
  });
}

// The pair of controls plus the wiring that relabels the whole page on a language
// switch. Pass extra work as `onLang` when a page has to re-render its own content.
export function mountPrefs(host, { onLang } = {}) {
  const lang = createLangSwitch();
  const theme = createThemeSwitch();
  host.append(lang, theme);
  const refresh = () => {
    applyStatic(document);
    lang.relabel();
    theme.relabel();
    onLang?.();
  };
  onLangChange(refresh);
  applyStatic(document);
  return { lang, theme, refresh };
}
