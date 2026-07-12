"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { KpiGrid } from "@/components/ui/kpi-grid";
import { Modal } from "@/components/ui/modal";
import { Field, FormAlert, RequiredLegend } from "@/components/ui/field";
import { Meter } from "@/components/ui/meter";
import { TripStatusBadge } from "@/components/ui/status-badge";
import { LoadingBlock, ErrorBlock, LoadingInline, TableRowState } from "@/components/ui/async-state";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { PlusIcon, SearchIcon } from "@/components/icons";
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
import {
  fieldErrorsFrom,
  formMessageFrom,
  hasErrors,
  validateCompleteTrip,
  validateTrip,
  type CompleteTripFormValues,
  type FieldErrors,
} from "@/lib/validation";

const TRIP_FORM_ID = "create-trip-form";
const COMPLETE_FORM_ID = "complete-trip-form";

const PAGE_SIZE = 10;

async function loadTrips(statusFilter: string, search: string, sort: string, page: number) {
  const [allPage, filteredPage, vehiclesPage, driversPage] = await Promise.all([
    api.trips.list({ page_size: 200, sort: "-created_at" }),
    api.trips.list({
      status: statusFilter || undefined,
      q: search || undefined,
      sort,
      page,
      page_size: PAGE_SIZE,
    }),
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
    tripsTotal: filteredPage.total,
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
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("-created_at");
  const [page, setPage] = useState(1);
  // Seeded once from the URL (a driver's "Assign to Trip" button links here with
  // ?openTrip=1&driverId=...) via lazy initializers — genuinely initial state derived from the
  // URL, not a subscription to something that changes later, so no effect is needed.
  const [isNewTripOpen, setIsNewTripOpen] = useState(() => searchParams.get("openTrip") === "1");
  const [form, setForm] = useState<NewTripForm>(() => ({
    ...BLANK_TRIP,
    driver_id: searchParams.get("driverId") ?? "",
  }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [rowError, setRowError] = useState<string | null>(null);
  const [busyTripId, setBusyTripId] = useState<string | null>(null);
  const [completingTrip, setCompletingTrip] = useState<TripOut | null>(null);

  const { data, loading, error, reload } = useFetch(
    () => loadTrips(status, search, sort, page),
    [status, search, sort, page]
  );

  function toggleSort(field: string) {
    setSort((prev) => (prev === field ? `-${field}` : field));
    setPage(1);
  }

  // Re-run whenever the typed cargo weight changes so the vehicle picker only ever offers
  // vehicles that can actually take the load — a hardcoded dispatchable(0) here would silently
  // defeat the capacity filter (docs/04_API_CONTRACT.md's `/vehicles/dispatchable?cargo_weight_kg=`).
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
  // raised the cargo weight past what it can carry — treat the selection as cleared. Derived at
  // render time rather than synced back via an effect+setState.
  const selectedVehicle = candidateVehicles.find((v) => v.id === form.vehicle_id);
  const effectiveVehicleId = selectedVehicle ? form.vehicle_id : "";
  const selectedCapacityKg = selectedVehicle?.max_load_capacity_kg;

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

  function update(patch: Partial<NewTripForm>) {
    setForm((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) delete next[key];
      // Swapping the vehicle can make an already-typed cargo weight legal (or not), so the
      // stale capacity error must go with it.
      if ("vehicle_id" in patch) delete next.cargo_weight_kg;
      return next;
    });
  }

  function closeNewTrip() {
    setIsNewTripOpen(false);
    setForm(BLANK_TRIP);
    setErrors({});
    setFormError(null);
  }

  async function handleCreateTrip(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const found = validateTrip({ ...form, vehicle_id: effectiveVehicleId }, selectedCapacityKg);
    if (hasErrors(found)) {
      setErrors(found);
      setFormError("Some details need fixing.");
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      await api.trips.create({
        vehicle_id: effectiveVehicleId,
        driver_id: form.driver_id,
        source_city: form.source_city.trim(),
        dest_city: form.dest_city.trim(),
        cargo_weight_kg: Number(form.cargo_weight_kg),
        planned_distance_km: form.planned_distance_km ? Number(form.planned_distance_km) : undefined,
        revenue: form.revenue ? Number(form.revenue) : undefined,
      });
      closeNewTrip();
      reload();
    } catch (err) {
      // e.g. CARGO_EXCEEDS_CAPACITY or UNKNOWN_CITY — both arrive keyed by field.
      setErrors(fieldErrorsFrom(err));
      setFormError(formMessageFrom(err, "Failed to create trip"));
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
              <select
                className="select select-sm"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="dispatched">Dispatched</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <div className="search-field">
                <SearchIcon />
                <input
                  className="input"
                  type="text"
                  placeholder="Search source or destination city…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
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
              <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortableTh label="Route" field="source_city" sort={sort} onSort={toggleSort} />
                    <th>Vehicle</th>
                    <th>Driver</th>
                    <SortableTh label="Cargo" field="cargo_weight_kg" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Revenue" field="revenue" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Status" field="status" sort={sort} onSort={toggleSort} />
                    <SortableTh label="Dispatched" field="dispatched_at" sort={sort} onSort={toggleSort} />
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
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={data?.tripsTotal ?? 0}
                onPageChange={setPage}
              />
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
            <div className="panel-body panel-body-scroll">
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
        onClose={closeNewTrip}
        title="Create Trip"
        footer={
          <>
            <button className="btn btn-outline-muted" onClick={closeNewTrip}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              type="submit"
              form={TRIP_FORM_ID}
              disabled={submitting || candidatesLoading}
            >
              {submitting ? "Creating…" : "Create Trip"}
            </button>
          </>
        }
      >
        <form className="form-grid" id={TRIP_FORM_ID} onSubmit={handleCreateTrip} noValidate>
          <RequiredLegend />

          {formError ? <FormAlert message={formError} count={Object.keys(errors).length} /> : null}

          <Field id="source_city" label="Source City" required error={errors.source_city}>
            <input
              className="input"
              placeholder="Ahmedabad"
              value={form.source_city}
              onChange={(e) => update({ source_city: e.target.value })}
            />
          </Field>

          <Field id="dest_city" label="Destination City" required error={errors.dest_city}>
            <input
              className="input"
              placeholder="Mumbai"
              value={form.dest_city}
              onChange={(e) => update({ dest_city: e.target.value })}
            />
          </Field>

          <Field id="vehicle_id" label="Vehicle" required error={errors.vehicle_id}>
            <select
              className="select"
              value={effectiveVehicleId}
              onChange={(e) => update({ vehicle_id: e.target.value })}
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
                  {v.registration_number} · {v.name_model} · {fmtNumber(v.max_load_capacity_kg)} kg
                </option>
              ))}
            </select>
          </Field>

          <Field id="driver_id" label="Driver" required error={errors.driver_id}>
            <select
              className="select"
              value={form.driver_id}
              onChange={(e) => update({ driver_id: e.target.value })}
              disabled={candidatesLoading}
            >
              <option value="">{candidatesLoading ? "Loading…" : "Select a driver"}</option>
              {candidateDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {d.license_category}
                </option>
              ))}
            </select>
          </Field>

          <Field
            id="cargo_weight_kg"
            label="Cargo Weight (kg)"
            required
            error={errors.cargo_weight_kg}
            hint={
              selectedCapacityKg ? (
                <>
                  <Meter
                    value={Math.min(100, (cargoKg / selectedCapacityKg) * 100)}
                    className="mb-xxs"
                    fillClassName={cargoKg > selectedCapacityKg ? "is-warning" : ""}
                  />
                  {fmtNumber(cargoKg)} / {fmtNumber(selectedCapacityKg)} kg for the selected vehicle
                </>
              ) : (
                "Pick a vehicle to see its capacity limit."
              )
            }
          >
            <input
              className="input"
              type="number"
              min="1"
              max={selectedCapacityKg}
              placeholder="16200"
              value={form.cargo_weight_kg}
              onChange={(e) => update({ cargo_weight_kg: e.target.value })}
            />
          </Field>

          <Field
            id="planned_distance_km"
            label="Planned Distance (km)"
            error={errors.planned_distance_km}
            hint="Auto-computed from the two cities if left blank."
          >
            <input
              className="input"
              type="number"
              min="1"
              placeholder="Auto-computed"
              value={form.planned_distance_km}
              onChange={(e) => update({ planned_distance_km: e.target.value })}
            />
          </Field>

          <Field id="revenue" label="Revenue (₹)" error={errors.revenue} span2>
            <input
              className="input"
              type="number"
              min="0"
              placeholder="68000"
              value={form.revenue}
              onChange={(e) => update({ revenue: e.target.value })}
            />
          </Field>
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
  const [values, setValues] = useState<CompleteTripFormValues>({
    actual_distance_km: "",
    final_odometer_km: "",
    liters: "",
    fuel_cost: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stale, setStale] = useState(false);

  function update(patch: Partial<CompleteTripFormValues>) {
    setValues((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) delete next[key];
      // Litres and cost are validated as a pair, so clear both when either changes.
      if ("liters" in patch || "fuel_cost" in patch) {
        delete next.liters;
        delete next.fuel_cost;
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trip) return;
    setError(null);

    const found = validateCompleteTrip(values);
    if (hasErrors(found)) {
      setErrors(found);
      setError("Some details need fixing.");
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      await api.trips.complete(trip.id, {
        actual_distance_km: Number(values.actual_distance_km),
        final_odometer_km: Number(values.final_odometer_km),
        fuel:
          values.liters && values.fuel_cost
            ? { liters: Number(values.liters), cost: Number(values.fuel_cost) }
            : undefined,
      });
      onDone();
    } catch (err) {
      // TRIP_ALREADY_COMPLETED / TRIP_NOT_DISPATCHED mean the trip moved on server-side while
      // this dialog was open (the live simulator advances/completes dispatched trips on its own
      // tick) — their "fields.status" isn't a real field on this form, so there's nothing to
      // highlight, only the list to refresh.
      if (
        err instanceof ApiError &&
        (err.code === "TRIP_ALREADY_COMPLETED" || err.code === "TRIP_NOT_DISPATCHED")
      ) {
        setErrors({});
        setError(`${err.message} — likely the live simulation moved it on. Close to refresh.`);
        setStale(true);
        return;
      }
      // ODOMETER_REGRESSION comes back keyed to final_odometer_km.
      setErrors(fieldErrorsFrom(err));
      setError(formMessageFrom(err, "Failed to complete trip"));
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (stale) onDone();
    else onClose();
  }

  if (!trip) return null;

  return (
    <Modal
      isOpen={!!trip}
      onClose={handleClose}
      title={`Complete Trip — ${trip.source_city} → ${trip.dest_city}`}
      footer={
        <>
          <button className="btn btn-outline-muted" onClick={handleClose}>
            {stale ? "Close & Refresh" : "Cancel"}
          </button>
          {stale ? null : (
            <button
              className="btn btn-primary"
              type="submit"
              form={COMPLETE_FORM_ID}
              disabled={submitting}
            >
              {submitting ? "Saving…" : "Mark Completed"}
            </button>
          )}
        </>
      }
    >
      <form className="form-grid" id={COMPLETE_FORM_ID} onSubmit={handleSubmit} noValidate>
        <RequiredLegend />

        {error ? <FormAlert message={error} count={Object.keys(errors).length} /> : null}

        <Field
          id="actual_distance_km"
          label="Actual Distance (km)"
          required
          error={errors.actual_distance_km}
          hint={`Planned: ${fmtNumber(trip.planned_distance_km)} km`}
        >
          <input
            className="input"
            type="number"
            min="1"
            placeholder={String(trip.planned_distance_km)}
            value={values.actual_distance_km}
            onChange={(e) => update({ actual_distance_km: e.target.value })}
          />
        </Field>

        <Field
          id="final_odometer_km"
          label="Final Odometer (km)"
          required
          error={errors.final_odometer_km}
          hint="Cannot be lower than the vehicle's current reading."
        >
          <input
            className="input"
            type="number"
            min="1"
            value={values.final_odometer_km}
            onChange={(e) => update({ final_odometer_km: e.target.value })}
          />
        </Field>

        <Field
          id="liters"
          label="Fuel Litres"
          error={errors.liters}
          hint="Leave both fuel boxes blank to skip the fuel log."
        >
          <input
            className="input"
            type="number"
            min="1"
            value={values.liters}
            onChange={(e) => update({ liters: e.target.value })}
          />
        </Field>

        <Field id="fuel_cost" label="Fuel Cost (₹)" error={errors.fuel_cost}>
          <input
            className="input"
            type="number"
            min="1"
            value={values.fuel_cost}
            onChange={(e) => update({ fuel_cost: e.target.value })}
          />
        </Field>
      </form>
    </Modal>
  );
}
