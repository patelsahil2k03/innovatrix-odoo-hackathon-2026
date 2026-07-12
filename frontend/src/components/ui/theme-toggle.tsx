"use client";

import { SunIcon, MoonIcon } from "@/components/icons";
import { applyTheme, getStoredTheme } from "@/lib/theme";

/** Which icon is visible is driven entirely by CSS off [data-theme] on <html> (see
 * design-system.css), not React state — the boot script sets that attribute before paint, so
 * there is nothing to read or reconcile during render/hydration. The click handler reads the
 * current theme fresh from the DOM, which is fine since event handlers aren't render. */
export function ThemeToggle() {
  function toggle() {
    applyTheme(getStoredTheme() === "dark" ? "light" : "dark");
  }

  return (
    <button className="icon-btn theme-toggle" onClick={toggle} aria-label="Toggle light / dark mode" title="Toggle theme">
      <SunIcon className="icon theme-icon-sun" />
      <MoonIcon className="icon theme-icon-moon" />
    </button>
  );
}
