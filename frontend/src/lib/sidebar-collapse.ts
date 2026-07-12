const STORAGE_KEY = "transitops-sidebar-collapsed";

/** Only ever called from an event handler — never during render. */
export function applySidebarCollapsed(collapsed: boolean): void {
  document.documentElement.dataset.sidebarCollapsed = String(collapsed);
  localStorage.setItem(STORAGE_KEY, String(collapsed));
}

export function isSidebarCollapsed(): boolean {
  return document.documentElement.dataset.sidebarCollapsed === "true";
}

/** Inlined into <head> so the collapsed state is set before first paint — no flash of the
 * wrong width, and no effect-driven setState is needed on mount (react-hooks/set-state-in-effect). */
export const SIDEBAR_COLLAPSE_BOOT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("${STORAGE_KEY}");
    document.documentElement.dataset.sidebarCollapsed = stored === "true" ? "true" : "false";
  } catch (e) {}
})();
`;
