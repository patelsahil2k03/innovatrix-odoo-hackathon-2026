"use client";

import { useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { KpiGrid } from "@/components/ui/kpi-grid";
import { Modal } from "@/components/ui/modal";
import { TripStatusBadge } from "@/components/ui/status-badge";
import { PlusIcon } from "@/components/icons";
import {
  trips as initialTrips,
  aiDispatchSuggestions as initialSuggestions,
  getVehicle,
  getDriver,
  fmtMoney,
  fmtDateTime,
  type Trip,
  type AIDispatchSuggestion,
} from "@/lib/mock-data";

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>(initialTrips);
  const [suggestions, setSuggestions] = useState<Record<string, AIDispatchSuggestion[]>>(initialSuggestions);
  const [status, setStatus] = useState("");
  const [isNewTripOpen, setIsNewTripOpen] = useState(false);

  const rows = trips.filter((t) => !status || t.status === status);

  const totalRevenue = trips.filter((t) => t.status !== "cancelled").reduce((s, t) => s + t.revenue, 0);

  function assignTrip(tripId: string, vehicleId: string, driverId: string) {
    setTrips((prev) =>
      prev.map((t) =>
        t.id === tripId
          ? { ...t, vehicle_id: vehicleId, driver_id: driverId, status: "dispatched", dispatched_at: new Date().toISOString() }
          : t
      )
    );
    setSuggestions((prev) => {
      const next = { ...prev };
      delete next[tripId];
      return next;
    });
  }

  const pendingTripIds = Object.keys(suggestions);

  return (
    <AppShell eyebrow="Operations" title="Trips & Dispatch">
      <KpiGrid
        cells={[
          { label: "Pending Dispatch", value: trips.filter((t) => t.status === "pending").length },
          { label: "In Transit", value: trips.filter((t) => t.status === "in_transit").length },
          { label: "Completed", value: trips.filter((t) => t.status === "completed").length },
          { label: "Total Revenue", value: fmtMoney(totalRevenue) },
        ]}
      />

      <div className="grid-2">
        <div>
          <div className="table-toolbar">
            <div className="table-filters">
              <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="dispatched">Dispatched</option>
                <option value="in_transit">In Transit</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={() => setIsNewTripOpen(true)}>
              <PlusIcon style={{ width: 16, height: 16 }} />
              New Trip
            </button>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Route</th>
                  <th>Vehicle</th>
                  <th>Driver</th>
                  <th>Cargo</th>
                  <th>Revenue</th>
                  <th>Status</th>
                  <th>Dispatched</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="cell-muted" style={{ textAlign: "center", padding: "var(--space-md)" }}>
                      No trips match this filter.
                    </td>
                  </tr>
                ) : (
                  rows.map((t) => {
                    const vehicle = getVehicle(t.vehicle_id);
                    const driver = t.driver_id ? getDriver(t.driver_id) : null;
                    return (
                      <tr key={t.id}>
                        <td className="cell-strong">
                          {t.source_location} → {t.destination_location}
                        </td>
                        <td>{vehicle?.registration_number}</td>
                        <td>{driver ? driver.name : <span className="cell-muted">Unassigned</span>}</td>
                        <td className="cell-muted">{t.cargo_weight} t</td>
                        <td>{fmtMoney(t.revenue)}</td>
                        <td>
                          <TripStatusBadge status={t.status} />
                        </td>
                        <td className="cell-muted">{fmtDateTime(t.dispatched_at)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2 className="text-title-md" style={{ margin: 0 }}>
                  AI Dispatch Suggestions
                </h2>
                <p className="text-body-sm u-muted" style={{ margin: "4px 0 0" }}>
                  Ranked vehicle + driver matches for pending trips
                </p>
              </div>
            </div>
            <div className="panel-body">
              {pendingTripIds.length === 0 ? (
                <p className="u-muted text-body-sm">No pending trips need dispatch right now.</p>
              ) : (
                pendingTripIds.map((tripId) => {
                  const trip = trips.find((t) => t.id === tripId);
                  if (!trip || trip.status !== "pending") return null;
                  const tripSuggestions = suggestions[tripId];
                  return (
                    <div className="mb-md" key={tripId}>
                      <div className="text-body-md cell-strong mb-xs">
                        {trip.source_location} → {trip.destination_location}{" "}
                        <span className="u-muted-soft text-body-sm">
                          ({trip.cargo_weight}t · {trip.planned_distance}km)
                        </span>
                      </div>
                      {tripSuggestions.map((s) => {
                        const vehicle = getVehicle(s.vehicle_id);
                        const driver = getDriver(s.driver_id);
                        return (
                          <div className="match-card" key={s.vehicle_id + s.driver_id}>
                            <div className="match-score">
                              <span className="num text-number-display">{s.score}</span>
                              <span className="text-caption-uppercase u-muted-soft">Match</span>
                            </div>
                            <div className="match-body">
                              <div className="text-body-sm cell-strong">
                                {vehicle?.registration_number} · {driver?.name}
                              </div>
                              <div className="text-caption match-reason">{s.reason}</div>
                            </div>
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => assignTrip(trip.id, s.vehicle_id, s.driver_id)}
                            >
                              Assign
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isNewTripOpen}
        onClose={() => setIsNewTripOpen(false)}
        title="Create Trip"
        footer={
          <>
            <button className="btn btn-outline-muted" onClick={() => setIsNewTripOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => setIsNewTripOpen(false)}>
              Create Trip
            </button>
          </>
        }
      >
        <form className="form-grid">
          <div className="field">
            <label className="label">Source Location</label>
            <input className="input" placeholder="Ahmedabad" />
          </div>
          <div className="field">
            <label className="label">Destination Location</label>
            <input className="input" placeholder="Mumbai" />
          </div>
          <div className="field">
            <label className="label">Cargo Weight (t)</label>
            <input className="input" type="number" placeholder="16.2" />
          </div>
          <div className="field">
            <label className="label">Planned Distance (km)</label>
            <input className="input" type="number" placeholder="524" />
          </div>
          <div className="field span-2">
            <label className="label">Revenue (₹)</label>
            <input className="input" type="number" placeholder="68000" />
          </div>
        </form>
        <p className="text-body-sm u-muted-soft" style={{ marginTop: "var(--space-xs)" }}>
          Vehicle and driver assignment happens after creation via AI Dispatch Suggestions.
        </p>
      </Modal>
    </AppShell>
  );
}
