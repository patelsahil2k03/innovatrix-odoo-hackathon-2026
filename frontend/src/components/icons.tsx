import type { CSSProperties } from "react";

type IconProps = { className?: string; style?: CSSProperties };

const base = "icon";

export function DashboardIcon({ className = base, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

export function VehiclesIcon({ className = base, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24">
      <rect x="1" y="5" width="15" height="11" />
      <path d="M16 9h4l3 3v4h-7V9z" />
      <circle cx="5.5" cy="18" r="2" />
      <circle cx="18.5" cy="18" r="2" />
    </svg>
  );
}

export function DriversIcon({ className = base, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function TripsIcon({ className = base, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24">
      <circle cx="6" cy="19" r="2.2" />
      <circle cx="18" cy="5" r="2.2" />
      <path d="M8 19h7a4 4 0 0 0 4-4v-1a4 4 0 0 0-4-4H9a4 4 0 0 1-4-4v-1" />
    </svg>
  );
}

export function AnalyticsIcon({ className = base, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24">
      <path d="M3 3v18h18" />
      <rect x="7" y="12" width="3" height="6" />
      <rect x="12" y="8" width="3" height="10" />
      <rect x="17" y="5" width="3" height="13" />
    </svg>
  );
}

export function SearchIcon({ className = base, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function BellIcon({ className = base, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export function MenuIcon({ className = base, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24">
      <path d="M3 12h18M3 6h18M3 18h18" />
    </svg>
  );
}

export function PlusIcon({ className = base, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ArrowLeftIcon({ className = base, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export function SunIcon({ className = base, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function MoonIcon({ className = base, style }: IconProps) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />
    </svg>
  );
}
