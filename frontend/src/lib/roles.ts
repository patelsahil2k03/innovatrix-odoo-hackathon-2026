/* Mirrors backend/src/transitops/core/rbac.py's write-capability aliases exactly, so the UI can
 * hide/disable actions a role can't perform instead of surfacing a raw 403 from the API. */

export type Role = "fleet_manager" | "dispatcher" | "safety_officer" | "financial_analyst";

export const ROLE_LABELS: Record<string, string> = {
  fleet_manager: "Fleet Manager",
  dispatcher: "Dispatcher",
  safety_officer: "Safety Officer",
  financial_analyst: "Financial Analyst",
};

export const canWriteVehicles = (role?: string | null) => role === "fleet_manager";
export const canWriteMaintenance = (role?: string | null) => role === "fleet_manager";
export const canWriteDrivers = (role?: string | null) => role === "safety_officer";
export const canWriteTrips = (role?: string | null) => role === "dispatcher";
export const canWriteCosts = (role?: string | null) => role === "dispatcher" || role === "financial_analyst";
export const canWriteCompliance = (role?: string | null) => role === "safety_officer" || role === "fleet_manager";

/** Nav items each role actually owns/uses day-to-day. This is a UX/decluttering decision, not a
 * security boundary — the backend still permits reads for any authenticated role, so a hidden
 * page is still reachable by direct URL. Financial Analyst has no CRUD anywhere (only
 * canWriteCosts, which has no dedicated UI yet), so it only gets Dashboard + Analytics. */
export const NAV_VISIBILITY_BY_ROLE: Record<Role, { vehicles: boolean; drivers: boolean; trips: boolean }> = {
  fleet_manager: { vehicles: true, drivers: true, trips: true },
  dispatcher: { vehicles: false, drivers: false, trips: true },
  safety_officer: { vehicles: false, drivers: true, trips: false },
  financial_analyst: { vehicles: false, drivers: false, trips: false },
};

export const DASHBOARD_TITLE_BY_ROLE: Record<Role, string> = {
  fleet_manager: "Fleet Overview",
  dispatcher: "Dispatch Console",
  safety_officer: "Safety & Compliance",
  financial_analyst: "Financial Overview",
};
