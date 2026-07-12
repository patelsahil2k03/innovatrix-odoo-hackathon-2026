"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { KpiGrid } from "@/components/ui/kpi-grid";
import { Modal } from "@/components/ui/modal";
import { TripStatusBadge } from "@/components/ui/status-badge";
import { LoadingBlock, ErrorBlock, LoadingInline, TableRowState } from "@/components/ui/async-state";
import { PlusIcon } from "@/components/icons";
import {
  api,
  ApiError,
  type TripOut,
  type VehicleOut,
  type DriverOut,
  type Suggestion,
} from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import { fmtMoney, fmtDateTime, fmtNumber } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { canWriteTrips, ROLE_LABELS } from "@/lib/roles";

async function loadTrips(statusFilter: string) {
  const [allPage, filteredPage, vehiclesPage, driversPage] = await Promise.all([
    api.trips.list({ page_size: 200, sort: "-created_at" }),
    api.trips.list({ status: statusFilter || undefined, page_size: 100, sort: "-created_at" }),
    api.vehicles.list({ page_size: 100 }),
    api.drivers.list({ page_size: 200 }),
  ]);

  const draftTrips = allPage.items.filter((t) => t.status === "draft");
  const suggestionsByTrip = new Map<string, Suggestion[]>();
  await Promise.all(
    draftTrips.map(async (t) => {
      const s = await api.trips.suggestionsForTrip(t.id, 3).catch(() => [] as Suggestion[]);
      suggestionsByTrip.set(t.id, s);
    })
  );

  return {
    allTrips: allPage.items,
    trips: filteredPage.items,
    vehicles: vehiclesPage.items,
    drivers: driversPage.items,
    draftTrips,
    suggestionsByTrip,
  };
}

interface NewTripForm {
  vehicle_id: string;
  driver_id: string;
  source_city: string;
  dest_city: string;
  cargo_weight_kg: string;
  planned_distance_km: string;
  revenue: string;
}

const BLANK_TRIP: NewTripForm = {
  vehicle_id: "",
  driver_id: "",
  source_city: "",
  dest_city: "",
  cargo_weight_kg: "",
  planned_distance_km: "",
  revenue: "",
};

export default function TripsPage() {
  const { user } = useAuth();
  const canDispatch = canWriteTrips(user?.role);
  const [status, setStatus] = useState("");
  const [isNewTripOpen, setIsNewTripOpen] = useState(false);
  const [form, setForm] = useState<NewTripForm>(BLANK_TRIP);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [rowError, setRowError] = useState<string | null>(null);
  const [busyTripId, setBusyTripId] = useState<string | null>(null);
  const [completingTrip, setCompletingTrip] = useState<TripOut | null>(null);

  const { data, loading, error, reload } = useFetch(() => loadTrips(status), [status]);

  const { data: candidates, loading: candidatesLoading } = useFetch(
    () => (isNewTripOpen ? Promise.all([api.vehicles.dispatchable(0), api.drivers.assignable()]) : Promise.resolve([[], []] as [VehicleOut[], DriverOut[]])),
    [isNewTripOpen]
  );
  const candidateVehicles = candidates?.[0] ?? [];
  const candidateDrivers = candidates?.[1] ?? [];

  const vehicleById = useMemo(() => new Map((data?.vehicles ?? []).map((v) => [v.id, v])), [data]);
  const driverById = useMemo(() => new Map((data?.drivers ?? []).map((d) => [d.id, d])), [data]);

  const rows = data?.trips ?? [];
  const allTrips = data?.allTrips ?? [];
  const draftCount = allTrips.filter((t) => t.status === "draft").length;
  const dispatchedCount = allTrips.filter((t) => t.status === "dispatched").length;
  const completedCount = allTrips.filter((t) => t.status === "completed").length;
  // Completed trips only — matches kpis.total_revenue on Dashboard/Analytics. Draft/dispatched
  // trips carry a planned revenue figure that isn't earned yet, so it must not be counted here.
  const totalRevenue = allTrips.filter((t) => t.status === "completed").reduce((s, t) => s + t.revenue, 0);

  async function handleCreateTrip(e: React.SyntheticEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.trips.create({
        vehicle_id: form.vehicle_id,
        driver_id: form.driver_id,
        source_city: form.source_city,
        dest_city: form.dest_city,
        cargo_weight_kg: Number(form.cargo_weight_kg),
        planned_distance_km: form.planned_distance_km ? Number(form.planned_distance_km) : undefined,
        revenue: form.revenue ? Number(form.revenue) : undefined,
      });
      setIsNewTripOpen(false);
      setForm(BLANK_TRIP);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to create trip");
    } finally {
      setSubmitting(false);
    }
  }

  async function runAction(tripId: string, action: () => Promise<unknown>) {
    setRowError(null);
    setBusyTripId(tripId);
    try {
      await action();
      reload();
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setBusyTripId(null);
    }
  }

  async function applyPairing(tripId: string, s: Suggestion) {
    await runAction(tripId, () =>
      api.trips.update(tripId, { vehicle_id: s.vehicle.id, driver_id: s.driver.id })
    );
  }

  return (
    <AppShell eyebrow="Operations" title="Trips & Dispatch">
      <KpiGrid
        cells={[
          { label: "Draft (Pending Dispatch)", value: draftCount },
          { label: "Dispatched", value: dispatchedCount },
          { label: "Completed", value: completedCount },
          { label: "Total Revenue", value: fmtMoney(totalRevenue), sub: "completed trips" },
        ]}
      />

      <div className="grid-2">
        <div>
          <div className="table-toolbar">
            <div className="table-filters">
              <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="dispatched">Dispatched</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            {canDispatch ? (
              <button className="btn btn-primary" onClick={() => setIsNewTripOpen(true)}>
                <PlusIcon style={{ width: 16, height: 16 }} />
                New Trip
              </button>
            ) : (
              <span className="text-body-sm u-muted-soft">
                Only Dispatchers can create or manage trips (you&apos;re signed in as {ROLE_LABELS[user?.role ?? ""] ?? user?.role}).
              </span>
            )}
          </div>

          {rowError ? (
            <p className="text-body-sm u-warning" style={{ marginBottom: "var(--space-xxs)" }}>
              {rowError}
            </p>
          ) : null}

          {loading && !data ? (
            <LoadingBlock label="Loading trips…" />
          ) : error ? (
            <ErrorBlock message={error} onRetry={reload} />
          ) : (
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
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <TableRowState colSpan={8}>No trips match this filter.</TableRowState>
                  ) : (
                    rows.map((t) => {
                      const vehicle = vehicleById.get(t.vehicle_id);
                      const driver = driverById.get(t.driver_id);
                      const busy = busyTripId === t.id;
                      return (
                        <tr key={t.id}>
                          <td className="cell-strong">
                            {t.source_city} → {t.dest_city}
                          </td>
                          <td>{vehicle?.registration_number ?? "—"}</td>
                          <td>{driver?.name ?? "—"}</td>
                          <td className="cell-muted">{fmtNumber(t.cargo_weight_kg)} kg</td>
                          <td>{fmtMoney(t.revenue)}</td>
                          <td>
                            <TripStatusBadge status={t.status} />
                          </td>
                          <td className="cell-muted">{fmtDateTime(t.dispatched_at)}</td>
                          <td>
                            <div style={{ display: "flex", gap: 4 }}>
                              {!canDispatch ? (
                                <span className="cell-muted text-caption">—</span>
                              ) : t.status === "draft" ? (
                                <>
                                  <button
                                    className="btn btn-sm btn-primary"
                                    disabled={busy}
                                    onClick={() => runAction(t.id, () => api.trips.dispatch(t.id))}
                                  >
                                    Dispatch
                                  </button>
                                  <button
                                    className="btn btn-sm btn-outline-muted"
                                    disabled={busy}
                                    onClick={() => runAction(t.id, () => api.trips.cancel(t.id))}
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : t.status === "dispatched" ? (
                                <>
                                  <button
                                    className="btn btn-sm btn-primary"
                                    disabled={busy}
                                    onClick={() => setCompletingTrip(t)}
                                  >
                                    Complete
                                  </button>
                                  <button
                                    className="btn btn-sm btn-outline-muted"
                                    disabled={busy}
                                    onClick={() => runAction(t.id, () => api.trips.cancel(t.id))}
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2 className="text-title-md" style={{ margin: 0 }}>
                  AI Dispatch Suggestions
                </h2>
                <p className="text-body-sm u-muted" style={{ margin: "4px 0 0" }}>
                  Ranked alternative vehicle + driver matches for draft trips
                </p>
              </div>
            </div>
            <div className="panel-body">
              {!data ? (
                <LoadingInline />
              ) : data.draftTrips.length === 0 ? (
                <p className="u-muted text-body-sm">No draft trips need dispatch right now.</p>
              ) : (
                data.draftTrips.map((trip) => {
                  const suggestions = data.suggestionsByTrip.get(trip.id) ?? [];
                  return (
                    <div className="mb-md" key={trip.id}>
                      <div className="text-body-md cell-strong mb-xs">
                        {trip.source_city} → {trip.dest_city}{" "}
                        <span className="u-muted-soft text-body-sm">
                          ({fmtNumber(trip.cargo_weight_kg)}kg · {fmtNumber(trip.planned_distance_km)}km)
                        </span>
                      </div>
                      {suggestions.length === 0 ? (
                        <p className="u-muted text-body-sm">No alternative pairings found.</p>
                      ) : (
                        suggestions.map((s) => (
                          <div className="match-card" key={s.vehicle.id + s.driver.id}>
                            <div className="match-score">
                              <span className="num text-number-display">{Math.round(s.score)}</span>
                              <span className="text-caption-uppercase u-muted-soft">Match</span>
                            </div>
                            <div className="match-body">
                              <div className="text-body-sm cell-strong">
                                {s.vehicle.registration_number} · {s.driver.name}
                              </div>
                              <div className="text-caption match-reason">{s.reasons.join(" · ")}</div>
                            </div>
                            {canDispatch ? (
                              <button
                                className="btn btn-sm btn-primary"
                                disabled={busyTripId === trip.id}
                                onClick={() => applyPairing(trip.id, s)}
                              >
                                Use
                              </button>
                            ) : null}
                          </div>
                        ))
                      )}
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
            <button className="btn btn-primary" onClick={handleCreateTrip} disabled={submitting || candidatesLoading}>
              {submitting ? "Creating…" : "Create Trip"}
            </button>
          </>
        }
      >
        <form className="form-grid" onSubmit={handleCreateTrip}>
          <div className="field">
            <label className="label">Source City</label>
            <input
              className="input"
              placeholder="Ahmedabad"
              value={form.source_city}
              onChange={(e) => setForm({ ...form, source_city: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label className="label">Destination City</label>
            <input
              className="input"
              placeholder="Mumbai"
              value={form.dest_city}
              onChange={(e) => setForm({ ...form, dest_city: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label className="label">Cargo Weight (kg)</label>
            <input
              className="input"
              type="number"
              placeholder="16200"
              value={form.cargo_weight_kg}
              onChange={(e) => setForm({ ...form, cargo_weight_kg: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label className="label">Planned Distance (km, optional)</label>
            <input
              className="input"
              type="number"
              placeholder="Auto-computed if left blank"
              value={form.planned_distance_km}
              onChange={(e) => setForm({ ...form, planned_distance_km: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="label">Vehicle</label>
            <select
              className="select"
              value={form.vehicle_id}
              onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
              required
              disabled={candidatesLoading}
            >
              <option value="">{candidatesLoading ? "Loading…" : "Select a vehicle"}</option>
              {candidateVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registration_number} · {v.name_model}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">Driver</label>
            <select
              className="select"
              value={form.driver_id}
              onChange={(e) => setForm({ ...form, driver_id: e.target.value })}
              required
              disabled={candidatesLoading}
            >
              <option value="">{candidatesLoading ? "Loading…" : "Select a driver"}</option>
              {candidateDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {d.license_category}
                </option>
              ))}
            </select>
          </div>
          <div className="field span-2">
            <label className="label">Revenue (₹, optional)</label>
            <input
              className="input"
              type="number"
              placeholder="68000"
              value={form.revenue}
              onChange={(e) => setForm({ ...form, revenue: e.target.value })}
            />
          </div>
          {formError ? (
            <p className="text-body-sm u-warning" style={{ gridColumn: "span 2" }}>
              {formError}
            </p>
          ) : null}
        </form>
      </Modal>

      <CompleteTripModal
        key={completingTrip?.id ?? "none"}
        trip={completingTrip}
        onClose={() => setCompletingTrip(null)}
        onDone={() => {
          setCompletingTrip(null);
          reload();
        }}
      />
    </AppShell>
  );
}

function CompleteTripModal({
  trip,
  onClose,
  onDone,
}: {
  trip: TripOut | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [actualDistance, setActualDistance] = useState("");
  const [finalOdometer, setFinalOdometer] = useState("");
  const [liters, setLiters] = useState("");
  const [fuelCost, setFuelCost] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!trip) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.trips.complete(trip.id, {
        actual_distance_km: Number(actualDistance),
        final_odometer_km: Number(finalOdometer),
        fuel: liters && fuelCost ? { liters: Number(liters), cost: Number(fuelCost) } : undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to complete trip");
    } finally {
      setSubmitting(false);
    }
  }

  if (!trip) return null;

  return (
    <Modal
      isOpen={!!trip}
      onClose={onClose}
      title={`Complete Trip — ${trip.source_city} → ${trip.dest_city}`}
      footer={
        <>
          <button className="btn btn-outline-muted" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving…" : "Mark Completed"}
          </button>
        </>
      }
    >
      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="field">
          <label className="label">Actual Distance (km)</label>
          <input
            className="input"
            type="number"
            placeholder={String(trip.planned_distance_km)}
            value={actualDistance}
            onChange={(e) => setActualDistance(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label className="label">Final Odometer (km)</label>
          <input
            className="input"
            type="number"
            value={finalOdometer}
            onChange={(e) => setFinalOdometer(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label className="label">Fuel Liters (optional)</label>
          <input className="input" type="number" value={liters} onChange={(e) => setLiters(e.target.value)} />
        </div>
        <div className="field">
          <label className="label">Fuel Cost ₹ (optional)</label>
          <input className="input" type="number" value={fuelCost} onChange={(e) => setFuelCost(e.target.value)} />
        </div>
        {error ? (
          <p className="text-body-sm u-warning" style={{ gridColumn: "span 2" }}>
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
