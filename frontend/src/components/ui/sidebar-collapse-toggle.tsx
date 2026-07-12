"use client";

import { ChevronLeftIcon } from "@/components/icons";
import { applySidebarCollapsed, isSidebarCollapsed } from "@/lib/sidebar-collapse";

/** Which way the chevron points is driven entirely by CSS off [data-sidebar-collapsed] on
 * <html> (see design-system.css), not React state — the boot script sets that attribute before
 * paint, so there is nothing to read or reconcile during render/hydration. */
export function SidebarCollapseToggle() {
  function toggle() {
    applySidebarCollapsed(!isSidebarCollapsed());
  }

  return (
    <button
      className="sidebar-collapse-toggle"
      onClick={toggle}
      aria-label="Toggle sidebar width"
      title="Toggle sidebar width"
    >
      <ChevronLeftIcon className="icon" />
    </button>
  );
}
