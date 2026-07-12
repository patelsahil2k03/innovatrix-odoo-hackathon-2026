"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { KpiGrid } from "@/components/ui/kpi-grid";
import { Modal } from "@/components/ui/modal";
import { VehicleStatusBadge } from "@/components/ui/status-badge";
import { PlusIcon, SearchIcon } from "@/components/icons";
import { vehicles, vehicleHealth, vehicleAnalytics, healthMeterClass } from "@/lib/mock-data";

export default function VehiclesPage() {
  const [status, setStatus] = useState("");
  const [region, setRegion] = useState("");
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  const regions = useMemo(() => [...new Set(vehicles.map((v) => v.region))].sort(), []);

  const avgHealth = Math.round(
    Object.values(vehicleHealth).reduce((s, h) => s + h.health_score, 0) / Object.keys(vehicleHealth).length
  );

  const rows = vehicles.filter((v) => {
    if (status && v.status !== status) return false;
    if (region && v.region !== region) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!v.registration_number.toLowerCase().includes(q) && !v.model.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <AppShell eyebrow="Fleet" title="Vehicles">
      <KpiGrid
        cells={[
          { label: "Total Vehicles", value: vehicles.length },
          { label: "Active", value: vehicles.filter((v) => v.status === "active").length },
          { label: "In Maintenance", value: vehicles.filter((v) => v.status === "maintenance").length },
          { label: "Avg Health Score", value: avgHealth },
        ]}
      />

      <div className="table-toolbar">
        <div className="table-filters">
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="idle">Idle</option>
            <option value="maintenance">Maintenance</option>
            <option value="retired">Retired</option>
          </select>
          <select className="select" value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">All Regions</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div className="search-field">
            <SearchIcon />
            <input
              className="input"
              type="text"
              placeholder="Search registration or model…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setIsAddOpen(true)}>
          <PlusIcon className="icon" style={{ width: 16, height: 16 }} />
          Add Vehicle
        </button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Registration</th>
              <th>Model</th>
              <th>Type</th>
              <th>Region</th>
              <th>Odometer</th>
              <th>Health</th>
              <th>Utilization</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="cell-muted" style={{ textAlign: "center", padding: "var(--space-md)" }}>
                  No vehicles match these filters.
                </td>
              </tr>
            ) : (
              rows.map((v) => {
                const health = vehicleHealth[v.id];
                const analytics = vehicleAnalytics[v.id];
                return (
                  <tr key={v.id}>
                    <td>
                      <Link className="cell-strong" href={`/vehicles/${v.id}`}>
                        {v.registration_number}
                      </Link>
                    </td>
                    <td>{v.model}</td>
                    <td className="cell-muted">{v.vehicle_type}</td>
                    <td className="cell-muted">{v.region}</td>
                    <td className="cell-muted">{v.odometer.toLocaleString("en-IN")} km</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="meter" style={{ width: 64 }}>
                          <div
                            className={`meter-fill ${healthMeterClass(health.health_score)}`}
                            style={{ width: `${health.health_score}%` }}
                          />
                        </div>
                        <span className="text-body-sm">{health.health_score}</span>
                      </div>
                    </td>
                    <td className="cell-muted">{analytics.utilization_percent}%</td>
                    <td>
                      <VehicleStatusBadge status={v.status} />
                    </td>
                    <td>
                      <Link href={`/vehicles/${v.id}`} className="btn btn-sm btn-outline-muted">
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add Vehicle"
        footer={
          <>
            <button className="btn btn-outline-muted" onClick={() => setIsAddOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => setIsAddOpen(false)}>
              Save Vehicle
            </button>
          </>
        }
      >
        <form className="form-grid">
          <div className="field">
            <label className="label">Registration Number</label>
            <input className="input" placeholder="GJ-01-AB-1234" />
          </div>
          <div className="field">
            <label className="label">Model</label>
            <input className="input" placeholder="Tata Prima 4928" />
          </div>
          <div className="field">
            <label className="label">Vehicle Type</label>
            <select className="select">
              <option>Heavy Truck</option>
              <option>Medium Truck</option>
              <option>Mini Truck</option>
            </select>
          </div>
          <div className="field">
            <label className="label">Max Load Capacity (t)</label>
            <input className="input" type="number" placeholder="18.5" />
          </div>
          <div className="field">
            <label className="label">Region</label>
            <input className="input" placeholder="Ahmedabad" />
          </div>
          <div className="field">
            <label className="label">Acquisition Cost (₹)</label>
            <input className="input" type="number" placeholder="4200000" />
          </div>
          <div className="field span-2">
            <label className="label">Status</label>
            <select className="select">
              <option value="active">Active</option>
              <option value="idle">Idle</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
