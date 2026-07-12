"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { Meter } from "@/components/ui/meter";
import { useAuth } from "@/lib/auth-context";
import { useFetch } from "@/lib/use-fetch";
import { fmtMoney, fmtDateTime, fmtNumber } from "@/lib/format";
import { can } from "@/lib/rbac";
import { tripFormSchema, fieldErrorsFrom } from "@/lib/validation";

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
  const canWrite = can.writeTrips(user?.role);
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("");
  // Seeded once from the URL (e.g. a driver's "Assign to Trip" button linking here with
  // ?openTrip=1&driverId=...) via lazy initializers — not an effect, since this is genuinely
  // initial state derived from props/URL, not a subscription to something that changes later.
  const [isNewTripOpen, setIsNewTripOpen] = useState(() => searchParams.get("openTrip") === "1");
  const [form, setForm] = useState<NewTripForm>(() => ({
    ...BLANK_TRIP,
    driver_id: searchParams.get("driverId") ?? "",
  }));
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [rowError, setRowError] = useState<string | null>(null);
  const [busyTripId, setBusyTripId] = useState<string | null>(null);
  const [completingTrip, setCompletingTrip] = useState<TripOut | null>(null);

  const { data, loading, error, reload } = useFetch(() => loadTrips(status), [status]);

  // Re-run whenever the typed cargo weight changes so the vehicle picker only ever offers
  // vehicles that can actually take the load — was previously hardcoded to 0, which silently
  // defeated the capacity filter (docs/04_API_CONTRACT.md's `/vehicles/dispatchable?cargo_weight_kg=`).
  const cargoKg = Number(form.cargo_weight_kg) || 0;
  const { data: candidates, loading: candidatesLoading } = useFetch(
    () =>
      isNewTripOpen
        ? Promise.all([api.vehicles.dispatchable(cargoKg), api.drivers.assignable()])
        : Promise.resolve([[], []] as [VehicleOut[], DriverOut[]]),
    [isNewTripOpen, cargoKg]
  );
  const candidateVehicles = candidates?.[0] ?? [];
  const candidateDrivers = candidates?.[1] ?? [];

  // If the picked vehicle drops out of the refreshed (capacity-filtered) list — e.g. the user
  // raised the cargo weight past what it can carry — treat the selection as cleared. This is
  // derived at render time rather than synced back into `form` via an effect+setState, so the
  // <select> and the submit payload both use `effectiveVehicleId`/`selectedVehicle` instead of
  // the possibly-stale `form.vehicle_id`.
  const selectedVehicle = candidateVehicles.find((v) => v.id === form.vehicle_id);
  const effectiveVehicleId = selectedVehicle ? form.vehicle_id : "";

  const vehicleById = useMemo(() => new Map((data?.vehicles ?? []).map((v) => [v.id, v])), [data]);
  const driverById = useMemo(() => new Map((data?.drivers ?? []).map((d) => [d.id, d])), [data]);

  const rows = data?.trips ?? [];
  const allTrips = data?.allTrips ?? [];
  const draftCount = allTrips.filter((t) => t.status === "draft").length;
  const dispatchedCount = allTrips.filter((t) => t.status === "dispatched").length;
  const completedCount = allTrips.filter((t) => t.status === "completed").length;
  const totalRevenue = allTrips.filter((t) => t.status !== "cancelled").reduce((s, t) => s + t.revenue, 0);

  async function handleCreateTrip(e: React.SyntheticEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = tripFormSchema.safeParse({ ...form, vehicle_id: effectiveVehicleId });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }

    // Cross-field rule (docs/04_API_CONTRACT.md §4): cargo must not exceed the selected
    // vehicle's capacity. The dispatchable-vehicles fetch already filters by cargoKg, so this
    // should be unreachable in practice — kept as a safety net for the gap between typing and
    // the refetch settling.
    if (selectedVehicle && parsed.data.cargo_weight_kg > selectedVehicle.max_load_capacity_kg) {
      setFieldErrors({
        cargo_weight_kg: `Exceeds ${selectedVehicle.registration_number}'s capacity (${selectedVehicle.max_load_capacity_kg} kg)`,
      });
      return;
    }

    setSubmitting(true);
    try {
      await api.trips.create(parsed.data);
      setIsNewTripOpen(false);
      setForm(BLANK_TRIP);
      reload();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        if (err.fields) setFieldErrors(err.fields);
      } else {
        setFormError("Failed to create trip");
      }
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

  function closeNewTrip() {
    setIsNewTripOpen(false);
    setForm(BLANK_TRIP);
    setFormError(null);
    setFieldErrors({});
  }

  return (
    <AppShell eyebrow="Operations" title="Trips & Dispatch">
      <KpiGrid
        cells={[
          { label: "Draft (Pending Dispatch)", value: draftCount },
          { label: "Dispatched", value: dispatchedCount },
          { label: "Completed", value: completedCount },
          { label: "Total Revenue", value: fmtMoney(totalRevenue) },
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
            {canWrite && (
              <button className="btn btn-primary" onClick={() => setIsNewTripOpen(true)}>
                <PlusIcon style={{ width: 16, height: 16 }} />
                New Trip
              </button>
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
                              {!canWrite ? (
                                <span className="cell-muted text-body-sm">View only</span>
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
                            {canWrite && (
                              <button
                                className="btn btn-sm btn-primary"
                                disabled={busyTripId === trip.id}
                                onClick={() => applyPairing(trip.id, s)}
                              >
                                Use
                              </button>
                            )}
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
        onClose={closeNewTrip}
        title="Create Trip"
        footer={
          <>
            <button className="btn btn-outline-muted" onClick={closeNewTrip}>
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
            {fieldErrors.source_city && <p className="field-error">{fieldErrors.source_city}</p>}
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
            {fieldErrors.dest_city && <p className="field-error">{fieldErrors.dest_city}</p>}
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
            {selectedVehicle && cargoKg > 0 ? (
              <>
                <Meter
                  value={Math.min(100, (cargoKg / selectedVehicle.max_load_capacity_kg) * 100)}
                 
                  fillClassName={cargoKg > selectedVehicle.max_load_capacity_kg ? "is-warning" : ""}
                />
                <p className="text-caption u-muted-soft">
                  {cargoKg} / {selectedVehicle.max_load_capacity_kg} kg capacity (
                  {selectedVehicle.registration_number})
                </p>
              </>
            ) : null}
            {fieldErrors.cargo_weight_kg && (
              <p className="field-error">{fieldErrors.cargo_weight_kg}</p>
            )}
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
            {fieldErrors.planned_distance_km && (
              <p className="field-error">{fieldErrors.planned_distance_km}</p>
            )}
          </div>
          <div className="field">
            <label className="label">Vehicle</label>
            <select
              className="select"
              value={effectiveVehicleId}
              onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
              required
              disabled={candidatesLoading}
            >
              <option value="">
                {candidatesLoading
                  ? "Loading…"
                  : cargoKg > 0 && candidateVehicles.length === 0
                    ? "No vehicle fits this cargo weight"
                    : "Select a vehicle"}
              </option>
              {candidateVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registration_number} · {v.name_model} ({v.max_load_capacity_kg} kg)
                </option>
              ))}
            </select>
            {fieldErrors.vehicle_id && <p className="field-error">{fieldErrors.vehicle_id}</p>}
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
            {fieldErrors.driver_id && <p className="field-error">{fieldErrors.driver_id}</p>}
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
