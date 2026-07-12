"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Sidebar } from "./sidebar";
import { MenuIcon, SearchIcon, BellIcon, ArrowLeftIcon } from "@/components/icons";

export function AppShell({
  eyebrow,
  title,
  backHref,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  backHref?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isNavOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (shellRef.current && !shellRef.current.contains(e.target as Node)) {
        setIsNavOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [isNavOpen]);

  return (
    <div className="app-shell" ref={shellRef}>
      <Sidebar isOpen={isNavOpen} onNavigate={() => setIsNavOpen(false)} />

      <div className="main">
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
            <button
              className="nav-toggle"
              aria-label="Toggle navigation"
              onClick={(e) => {
                e.stopPropagation();
                setIsNavOpen((v) => !v);
              }}
            >
              <MenuIcon />
            </button>
            {backHref ? (
              <Link href={backHref} className="icon-btn" aria-label="Back">
                <ArrowLeftIcon />
              </Link>
            ) : null}
            <div className="topbar-title-group">
              <div className="text-caption-uppercase topbar-eyebrow">{eyebrow}</div>
              <h1 className="text-display-md topbar-title">{title}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            {actions ?? (
              <>
                <div className="search-field topbar-search">
                  <SearchIcon />
                  <input className="input" type="text" placeholder="Search vehicles, drivers, trips…" />
                </div>
                <button className="icon-btn" aria-label="Notifications">
                  <BellIcon />
                  <span className="dot" />
                </button>
              </>
            )}
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
