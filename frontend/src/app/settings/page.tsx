"use client";

import { AppShell } from "@/components/shell/app-shell";
import { useAuth } from "@/lib/auth-context";
import { initials } from "@/lib/format";
import { ROLE_LABELS, type Role } from "@/lib/rbac";

const ROLES: Role[] = ["fleet_manager", "dispatcher", "safety_officer", "financial_analyst"];

// Mirrors backend/src/transitops/core/rbac.py's write-capability aliases exactly (docs/02 §3).
const CAPABILITIES: { label: string; allowed: Role[] }[] = [
  { label: "Vehicles — create / edit", allowed: ["fleet_manager"] },
  { label: "Maintenance — open / close", allowed: ["fleet_manager"] },
  { label: "Drivers — create / edit", allowed: ["safety_officer"] },
  { label: "Trips — create / dispatch / complete / cancel", allowed: ["dispatcher"] },
  { label: "Fuel & expenses — log", allowed: ["dispatcher", "financial_analyst"] },
  { label: "Compliance — acknowledge alerts", allowed: ["safety_officer", "fleet_manager"] },
  { label: "Audit log — view", allowed: ["fleet_manager"] },
];

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <AppShell eyebrow="Account" title="Settings">
      <div className="grid-2col-even">
        <div className="panel">
          <div className="panel-header">
            <h2 className="text-title-md" style={{ margin: 0 }}>
              Profile
            </h2>
          </div>
          <div className="panel-body stack-sm">
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
              <div className="sidebar-user-avatar">{user ? initials(user.full_name) : "—"}</div>
              <div>
                <div className="cell-strong">{user?.full_name ?? "—"}</div>
                <div className="text-body-sm u-muted-soft">{user?.email ?? "—"}</div>
              </div>
            </div>
            <div className="health-row">
              <div className="health-meta text-body-sm u-muted-soft">Role</div>
              <div className="cell-strong">
                {user ? ROLE_LABELS[user.role] ?? user.role : "—"}
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2 className="text-title-md" style={{ margin: 0 }}>
              About TransitOps
            </h2>
          </div>
          <div className="panel-body stack-sm">
            <p className="text-body-sm u-muted-soft" style={{ margin: 0 }}>
              Smart transport operations platform — fleet, driver, dispatch, maintenance, and
              expense management with enforced business rules.
            </p>
            <p className="text-caption u-muted-soft" style={{ margin: 0 }}>
              Odoo Hackathon 2026 — Team Innovatrix
            </p>
          </div>
        </div>
      </div>

      <div className="panel mt-md">
        <div className="panel-header">
          <h2 className="text-title-md" style={{ margin: 0 }}>
            Role Capability Matrix
          </h2>
          <p className="text-body-sm u-muted-soft" style={{ margin: "4px 0 0" }}>
            What each role can write — reads are open to every authenticated role; this table is
            enforced server-side, not just hidden in the UI.
          </p>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Capability</th>
                {ROLES.map((r) => (
                  <th key={r} className={r === user?.role ? "cell-strong" : ""}>
                    {ROLE_LABELS[r]}
                    {r === user?.role ? " (you)" : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CAPABILITIES.map((cap) => (
                <tr key={cap.label}>
                  <td className="cell-strong">{cap.label}</td>
                  {ROLES.map((r) => (
                    <td key={r}>{cap.allowed.includes(r) ? "✓" : "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
