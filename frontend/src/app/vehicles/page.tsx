"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { KpiGrid } from "@/components/ui/kpi-grid";
import { Modal } from "@/components/ui/modal";
import { Field, FormAlert, RequiredLegend } from "@/components/ui/field";
import { VehicleStatusBadge } from "@/components/ui/status-badge";
import { LoadingBlock, ErrorBlock, TableRowState } from "@/components/ui/async-state";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { PlusIcon, SearchIcon } from "@/components/icons";
import { api, type VehicleType } from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import { fmtNumber, healthMeterClass, VEHICLE_TYPE_LABELS } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { canWriteVehicles, ROLE_LABELS } from "@/lib/roles";
import {
  fieldErrorsFrom,
  formMessageFrom,
  hasErrors,
  validateVehicle,
  type FieldErrors,
} from "@/lib/validation";

const FORM_ID = "add-vehicle-form";

interface NewVehicleForm {
  registration_number: string;
  name_model: string;
  vehicle_type: VehicleType;
  max_load_capacity_kg: string;
  odometer_km: string;
  acquisition_cost: string;
  region: string;
}

const BLANK_FORM: NewVehicleForm = {
  registration_number: "",
  name_model: "",
  vehicle_type: "truck",
  max_load_capacity_kg: "",
  odometer_km: "0",
  acquisition_cost: "",
  region: "",
};

const PAGE_SIZE = 10;

export default function VehiclesPage() {
  const { user } = useAuth();
  const canAdd = canWriteVehicles(user?.role);
  const [status, setStatus] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [region, setRegion] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("registration_number");
  const [page, setPage] = useState(1);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState<NewVehicleForm>(BLANK_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  function toggleSort(field: string) {
    setSort((prev) => (prev === field ? `-${field}` : field));
    setPage(1);
  }

  const { data, loading, error, reload } = useFetch(
    () =>
      Promise.all([
        api.vehicles.list({
          status: status || undefined,
          vehicle_type: vehicleType || undefined,
          region: region || undefined,
          q: search || undefined,
          sort,
          page,
          page_size: PAGE_SIZE,
        }),
        api.analytics.fleet(),
      ]),
    [status, vehicleType, region, search, sort, page]
  );

  const [vehiclesPage, fleet] = data ?? [null, null];
  const healthByVehicleId = useMemo(
    () => new Map((fleet ?? []).map((f) => [f.vehicle_id, f])),
    [fleet]
  );
  const regions = useMemo(
    () => [...new Set((fleet ?? []).map((f) => f.region).filter((r): r is string => !!r))].sort(),
    [fleet]
  );

  const rows = vehiclesPage?.items ?? [];
  const totalVehicles = fleet?.length ?? 0;
  const activeCount = (fleet ?? []).filter((f) => f.status === "available" || f.status === "on_trip").length;
  const inShopCount = (fleet ?? []).filter((f) => f.status === "in_shop").length;
  const avgHealth = fleet && fleet.length
    ? Math.round(fleet.reduce((s, f) => s + f.health_score, 0) / fleet.length)
    : 0;

  // Editing a field clears its error, so the form stops shouting the moment it's fixed.
  function update(patch: Partial<NewVehicleForm>) {
    setForm((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  }

  function closeAdd() {
    setIsAddOpen(false);
    setForm(BLANK_FORM);
    setErrors({});
    setFormError(null);
  }

  async function handleAddVehicle(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const found = validateVehicle(form);
    if (hasErrors(found)) {
      // Nothing is sent — the user is told at each field instead of via a round-trip.
      setErrors(found);
      setFormError("Some details need fixing.");
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      await api.vehicles.create({
        registration_number: form.registration_number.trim().toUpperCase(),
        name_model: form.name_model.trim(),
        vehicle_type: form.vehicle_type,
        max_load_capacity_kg: Number(form.max_load_capacity_kg),
        odometer_km: Number(form.odometer_km || 0),
        acquisition_cost: Number(form.acquisition_cost),
        region: form.region.trim() || undefined,
      });
      closeAdd();
      reload();
    } catch (err) {
      // A server-side rejection (duplicate plate, say) lands on the same field it belongs to.
      setErrors(fieldErrorsFrom(err));
      setFormError(formMessageFrom(err, "Failed to add vehicle"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell eyebrow="Fleet" title="Vehicles">
      <KpiGrid
        cells={[
          { label: "Total Vehicles", value: totalVehicles },
          { label: "Active", value: activeCount },
          { label: "In Maintenance", value: inShopCount },
          { label: "Avg Health Score", value: avgHealth },
        ]}
      />

      <div className="table-toolbar">
        <div className="table-filters">
          <select className="select select-sm" value={status} onChange={(e) => updateFilter(setStatus, e.target.value)}>
            <option value="">All Statuses</option>
            <option value="available">Available</option>
            <option value="on_trip">On Trip</option>
            <option value="in_shop">In Shop</option>
            <option value="retired">Retired</option>
          </select>
          <select className="select select-sm" value={vehicleType} onChange={(e) => updateFilter(setVehicleType, e.target.value)}>
            <option value="">All Types</option>
            {Object.entries(VEHICLE_TYPE_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
          <select className="select select-sm" value={region} onChange={(e) => updateFilter(setRegion, e.target.value)}>
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
              onChange={(e) => updateFilter(setSearch, e.target.value)}
            />
          </div>
        </div>
        {canAdd ? (
          <button className="btn btn-primary" onClick={() => setIsAddOpen(true)}>
            <PlusIcon className="icon" style={{ width: 16, height: 16 }} />
            Add Vehicle
          </button>
        ) : (
          <span className="text-body-sm u-muted-soft">
            Only Fleet Managers can add vehicles (you&apos;re signed in as {ROLE_LABELS[user?.role ?? ""] ?? user?.role}).
          </span>
        )}
      </div>

      {loading && !data ? (
        <LoadingBlock label="Loading vehicles…" />
      ) : error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : (
        <div className="table-wrap">
          <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <SortableTh label="Registration" field="registration_number" sort={sort} onSort={toggleSort} />
                <SortableTh label="Model" field="name_model" sort={sort} onSort={toggleSort} />
                <SortableTh label="Type" field="vehicle_type" sort={sort} onSort={toggleSort} />
                <SortableTh label="Region" field="region" sort={sort} onSort={toggleSort} />
                <SortableTh label="Odometer" field="odometer_km" sort={sort} onSort={toggleSort} />
                <th>Health</th>
                <th>Utilization</th>
                <SortableTh label="Status" field="status" sort={sort} onSort={toggleSort} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <TableRowState colSpan={9}>No vehicles match these filters.</TableRowState>
              ) : (
                rows.map((v) => {
                  const health = healthByVehicleId.get(v.id);
                  return (
                    <tr key={v.id}>
                      <td>
                        <Link className="cell-strong" href={`/vehicles/${v.id}`}>
                          {v.registration_number}
                        </Link>
                      </td>
                      <td>{v.name_model}</td>
                      <td className="cell-muted">{VEHICLE_TYPE_LABELS[v.vehicle_type]}</td>
                      <td className="cell-muted">{v.region ?? "—"}</td>
                      <td className="cell-muted">{fmtNumber(v.odometer_km)} km</td>
                      <td>
                        {health ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div className="meter" style={{ width: 64 }}>
                              <div
                                className={`meter-fill ${healthMeterClass(health.health_score)}`}
                                style={{ width: `${health.health_score}%` }}
                              />
                            </div>
                            <span className="text-body-sm">{health.health_score}</span>
                          </div>
                        ) : (
                          <span className="cell-muted">—</span>
                        )}
                      </td>
                      <td className="cell-muted">{health ? `${health.utilization_pct}%` : "—"}</td>
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
          <Pagination
            page={vehiclesPage?.page ?? 1}
            pageSize={PAGE_SIZE}
            total={vehiclesPage?.total ?? 0}
            onPageChange={setPage}
          />
        </div>
      )}

      <Modal
        isOpen={isAddOpen}
        onClose={closeAdd}
        title="Add Vehicle"
        footer={
          <>
            <button className="btn btn-outline-muted" onClick={closeAdd}>
              Cancel
            </button>
            {/* The footer sits outside <form>, so `form=` associates the button with it —
                without this the submit handler (and every validation) never runs. */}
            <button className="btn btn-primary" type="submit" form={FORM_ID} disabled={submitting}>
              {submitting ? "Saving…" : "Save Vehicle"}
            </button>
          </>
        }
      >
        <form className="form-grid" id={FORM_ID} onSubmit={handleAddVehicle} noValidate>
          <RequiredLegend />

          {formError ? <FormAlert message={formError} count={Object.keys(errors).length} /> : null}

          <Field
            id="registration_number"
            label="Registration Number"
            required
            error={errors.registration_number}
            hint="Indian plate format, e.g. GJ-01-AB-1234"
          >
            <input
              className="input"
              placeholder="GJ-01-AB-1234"
              value={form.registration_number}
              onChange={(e) => update({ registration_number: e.target.value })}
            />
          </Field>

          <Field id="name_model" label="Model" required error={errors.name_model}>
            <input
              className="input"
              placeholder="Tata Prima 4928"
              value={form.name_model}
              onChange={(e) => update({ name_model: e.target.value })}
            />
          </Field>

          <Field id="vehicle_type" label="Vehicle Type" required error={errors.vehicle_type}>
            <select
              className="select"
              value={form.vehicle_type}
              onChange={(e) => update({ vehicle_type: e.target.value as VehicleType })}
            >
              {Object.entries(VEHICLE_TYPE_LABELS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            id="max_load_capacity_kg"
            label="Max Load Capacity (kg)"
            required
            error={errors.max_load_capacity_kg}
          >
            <input
              className="input"
              type="number"
              min="1"
              placeholder="18500"
              value={form.max_load_capacity_kg}
              onChange={(e) => update({ max_load_capacity_kg: e.target.value })}
            />
          </Field>

          <Field
            id="acquisition_cost"
            label="Acquisition Cost (₹)"
            required
            error={errors.acquisition_cost}
          >
            <input
              className="input"
              type="number"
              min="1"
              placeholder="4200000"
              value={form.acquisition_cost}
              onChange={(e) => update({ acquisition_cost: e.target.value })}
            />
          </Field>

          <Field id="region" label="Region" error={errors.region}>
            <input
              className="input"
              placeholder="Gujarat"
              value={form.region}
              onChange={(e) => update({ region: e.target.value })}
            />
          </Field>

          <Field
            id="odometer_km"
            label="Odometer (km)"
            error={errors.odometer_km}
            hint="Defaults to 0 for a brand-new vehicle."
            span2
          >
            <input
              className="input"
              type="number"
              min="0"
              placeholder="0"
              value={form.odometer_km}
              onChange={(e) => update({ odometer_km: e.target.value })}
            />
          </Field>
        </form>
      </Modal>
    </AppShell>
  );
}
