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
export function createSegmented({ labelKey, options, value, onChange, className = "" }) {
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
      buttons[index].textContent = t(option.labelKey);
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
