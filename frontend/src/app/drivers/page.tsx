"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { KpiGrid } from "@/components/ui/kpi-grid";
import { Modal } from "@/components/ui/modal";
import { DriverStatusBadge } from "@/components/ui/status-badge";
import { PlusIcon, SearchIcon } from "@/components/icons";
import { drivers, driverPerformance, fmtDate, healthMeterClass, initials, NOW } from "@/lib/mock-data";

export default function DriversPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  const avgSafety = Math.round(drivers.reduce((s, d) => s + d.safety_score, 0) / drivers.length);

  const rows = drivers.filter((d) => {
    if (status && d.status !== status) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!d.name.toLowerCase().includes(q) && !d.license_number.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <AppShell eyebrow="Fleet" title="Drivers">
      <KpiGrid
        cells={[
          { label: "Total Drivers", value: drivers.length },
          { label: "Available", value: drivers.filter((d) => d.status === "available").length },
          { label: "On Trip", value: drivers.filter((d) => d.status === "on_trip").length },
          { label: "Avg Safety Score", value: avgSafety },
        ]}
      />

      <div className="table-toolbar">
        <div className="table-filters">
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="available">Available</option>
            <option value="on_trip">On Trip</option>
            <option value="suspended">Suspended</option>
          </select>
          <div className="search-field">
            <SearchIcon />
            <input
              className="input"
              type="text"
              placeholder="Search name or license number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setIsAddOpen(true)}>
          <PlusIcon style={{ width: 16, height: 16 }} />
          Add Driver
        </button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Driver</th>
              <th>License No.</th>
              <th>Category</th>
              <th>License Expiry</th>
              <th>Safety Score</th>
              <th>Rating</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="cell-muted" style={{ textAlign: "center", padding: "var(--space-md)" }}>
                  No drivers match these filters.
                </td>
              </tr>
            ) : (
              rows.map((d) => {
                const perf = driverPerformance[d.id];
                const expSoon = new Date(d.license_expiry_date).getTime() - NOW < 1000 * 60 * 60 * 24 * 30;
                return (
                  <tr key={d.id}>
                    <td>
                      <div className="row-link">
                        <div className="row-avatar">{initials(d.name)}</div>
                        <Link className="cell-strong" href={`/drivers/${d.id}`}>
                          {d.name}
                        </Link>
                      </div>
                    </td>
                    <td className="cell-muted">{d.license_number}</td>
                    <td className="cell-muted">{d.license_category}</td>
                    <td className={expSoon ? "u-warning" : "cell-muted"}>{fmtDate(d.license_expiry_date)}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="meter" style={{ width: 64 }}>
                          <div
                            className={`meter-fill ${healthMeterClass(d.safety_score)}`}
                            style={{ width: `${d.safety_score}%` }}
                          />
                        </div>
                        <span className="text-body-sm">{d.safety_score}</span>
                      </div>
                    </td>
                    <td className="cell-muted">{perf.rating.toFixed(1)} ★</td>
                    <td>
                      <DriverStatusBadge status={d.status} />
                    </td>
                    <td>
                      <Link href={`/drivers/${d.id}`} className="btn btn-sm btn-outline-muted">
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
        title="Add Driver"
        footer={
          <>
            <button className="btn btn-outline-muted" onClick={() => setIsAddOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => setIsAddOpen(false)}>
              Save Driver
            </button>
          </>
        }
      >
        <form className="form-grid">
          <div className="field span-2">
            <label className="label">Full Name</label>
            <input className="input" placeholder="Raj Mehta" />
          </div>
          <div className="field">
            <label className="label">License Number</label>
            <input className="input" placeholder="GJ0120220041233" />
          </div>
          <div className="field">
            <label className="label">License Category</label>
            <select className="select">
              <option>HMV</option>
              <option>LMV</option>
              <option>LMV+HMV</option>
            </select>
          </div>
          <div className="field">
            <label className="label">License Expiry Date</label>
            <input className="input" type="date" />
          </div>
          <div className="field">
            <label className="label">Phone</label>
            <input className="input" placeholder="+91 98250 11223" />
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
