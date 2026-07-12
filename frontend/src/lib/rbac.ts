/* Frontend RBAC — mirrors backend/src/transitops/core/rbac.py's write-capability aliases
   exactly, so a button is only ever shown to a role that the API will actually let through.
   All roles can read everything (backend gates writes only), so this module has no "hide nav
   item" concept — only "can this role perform this write action". */

export type Role = "fleet_manager" | "dispatcher" | "safety_officer" | "financial_analyst";

function has(role: string | undefined, allowed: Role[]): boolean {
  return !!role && (allowed as string[]).includes(role);
}

export const can = {
  writeVehicles: (role?: string) => has(role, ["fleet_manager"]),
  writeMaintenance: (role?: string) => has(role, ["fleet_manager"]),
  writeDrivers: (role?: string) => has(role, ["safety_officer"]),
  writeTrips: (role?: string) => has(role, ["dispatcher"]),
  writeCosts: (role?: string) => has(role, ["dispatcher", "financial_analyst"]),
  writeCompliance: (role?: string) => has(role, ["safety_officer", "fleet_manager"]),
  admin: (role?: string) => has(role, ["fleet_manager"]),
};

export const ROLE_LABELS: Record<string, string> = {
  fleet_manager: "Fleet Manager",
  dispatcher: "Dispatcher",
  safety_officer: "Safety Officer",
  financial_analyst: "Financial Analyst",
};
