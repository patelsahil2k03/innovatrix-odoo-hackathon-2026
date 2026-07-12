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
