export type Theme = "dark" | "light";

const STORAGE_KEY = "transitops-theme";

/** Only ever called from an event handler or effect — never during render. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
}

export function getStoredTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/** Inlined into <head> so the theme is set before first paint — no flash of the wrong theme,
 * and no effect-driven setState is needed on mount (react-hooks/set-state-in-effect). */
export const THEME_BOOT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("${STORAGE_KEY}");
    document.documentElement.dataset.theme = stored === "light" ? "light" : "dark";
  } catch (e) {}
})();
`;
