"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  DashboardIcon,
  VehiclesIcon,
  DriversIcon,
  TripsIcon,
  AnalyticsIcon,
  SettingsIcon,
  LogoutIcon,
} from "@/components/icons";
import { useAuth } from "@/lib/auth-context";
import { initials } from "@/lib/format";
import { ROLE_LABELS, NAV_VISIBILITY_BY_ROLE, type Role } from "@/lib/roles";
import { SidebarCollapseToggle } from "@/components/ui/sidebar-collapse-toggle";

interface NavItem {
  href: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  /** Key into NAV_VISIBILITY_BY_ROLE — omit for items every role always sees. */
  visibilityKey?: "vehicles" | "drivers" | "trips";
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  { label: "Overview", items: [{ href: "/", label: "Dashboard", Icon: DashboardIcon }] },
  {
    label: "Fleet",
    items: [
      { href: "/vehicles", label: "Vehicles", Icon: VehiclesIcon, visibilityKey: "vehicles" },
      { href: "/drivers", label: "Drivers", Icon: DriversIcon, visibilityKey: "drivers" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/trips", label: "Trips & Dispatch", Icon: TripsIcon, visibilityKey: "trips" },
      { href: "/analytics", label: "Fleet Map & Analytics", Icon: AnalyticsIcon },
    ],
  },
  { label: "Account", items: [{ href: "/settings", label: "Settings", Icon: SettingsIcon }] },
];

export function Sidebar({ isOpen, onNavigate }: { isOpen: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const visibility = user ? NAV_VISIBILITY_BY_ROLE[user.role as Role] : undefined;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
  const isVisible = (item: NavItem) => !item.visibilityKey || !visibility || visibility[item.visibilityKey];

  return (
    <aside className={`sidebar ${isOpen ? "is-open" : ""}`} data-sidebar>
      <SidebarCollapseToggle />
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">T</div>
        <div className="sidebar-brand-text">
          <div className="sidebar-brand-name">TransitOps</div>
          <div className="sidebar-brand-sub">
            {user ? ROLE_LABELS[user.role] ?? user.role : "Fleet Ops"}
          </div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter(isVisible);
          if (items.length === 0) return null;
          return (
            <div className="sidebar-group" key={group.label}>
              <div className="sidebar-group-label">{group.label}</div>
              {items.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`sidebar-link ${isActive(href) ? "is-active" : ""}`}
                  onClick={onNavigate}
                  title={label}
                >
                  <Icon className="icon" />
                  <span className="sidebar-link-label">{label}</span>
                </Link>
              ))}
            </div>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{user ? initials(user.full_name) : "—"}</div>
          <div className="sidebar-user-meta">
            <div className="sidebar-user-name">{user?.full_name ?? "—"}</div>
            <div className="sidebar-user-role">{user ? ROLE_LABELS[user.role] ?? user.role : ""}</div>
          </div>
          <button
            className="sidebar-signout-btn"
            onClick={logout}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogoutIcon className="icon" />
            <span className="sidebar-logout-label">Sign out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
