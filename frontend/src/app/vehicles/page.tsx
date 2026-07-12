"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { KpiGrid } from "@/components/ui/kpi-grid";
import { Modal } from "@/components/ui/modal";
import { VehicleStatusBadge } from "@/components/ui/status-badge";
import { LoadingBlock, ErrorBlock, TableRowState } from "@/components/ui/async-state";
import { PlusIcon, SearchIcon } from "@/components/icons";
import { api, ApiError, type VehicleType } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useFetch } from "@/lib/use-fetch";
import { fmtNumber, healthMeterClass, VEHICLE_TYPE_LABELS } from "@/lib/format";
import { can } from "@/lib/rbac";

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

export default function VehiclesPage() {
  const { user } = useAuth();
  const canWrite = can.writeVehicles(user?.role);
  const [status, setStatus] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [region, setRegion] = useState("");
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState<NewVehicleForm>(BLANK_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data, loading, error, reload } = useFetch(
    () =>
      Promise.all([
        api.vehicles.list({
          status: status || undefined,
          vehicle_type: vehicleType || undefined,
          region: region || undefined,
          q: search || undefined,
          page_size: 100,
        }),
        api.analytics.fleet(),
      ]),
    [status, vehicleType, region, search]
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

  async function handleAddVehicle(e: React.SyntheticEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.vehicles.create({
        registration_number: form.registration_number,
        name_model: form.name_model,
        vehicle_type: form.vehicle_type,
        max_load_capacity_kg: Number(form.max_load_capacity_kg),
        odometer_km: Number(form.odometer_km || 0),
        acquisition_cost: Number(form.acquisition_cost),
        region: form.region || undefined,
      });
      setIsAddOpen(false);
      setForm(BLANK_FORM);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to add vehicle");
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
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="available">Available</option>
            <option value="on_trip">On Trip</option>
            <option value="in_shop">In Shop</option>
            <option value="retired">Retired</option>
          </select>
          <select className="select" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
            <option value="">All Types</option>
            {Object.entries(VEHICLE_TYPE_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
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
        {canWrite && (
          <button className="btn btn-primary" onClick={() => setIsAddOpen(true)}>
            <PlusIcon className="icon" style={{ width: 16, height: 16 }} />
            Add Vehicle
          </button>
        )}
      </div>

      {loading && !data ? (
        <LoadingBlock label="Loading vehicles…" />
      ) : error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : (
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
      )}

      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add Vehicle"
        footer={
          <>
            <button className="btn btn-outline-muted" onClick={() => setIsAddOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleAddVehicle} disabled={submitting}>
              {submitting ? "Saving…" : "Save Vehicle"}
            </button>
          </>
        }
      >
        <form className="form-grid" onSubmit={handleAddVehicle}>
          <div className="field">
            <label className="label">Registration Number</label>
            <input
              className="input"
              placeholder="GJ-01-AB-1234"
              value={form.registration_number}
              onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label className="label">Model</label>
            <input
              className="input"
              placeholder="Tata Prima 4928"
              value={form.name_model}
              onChange={(e) => setForm({ ...form, name_model: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label className="label">Vehicle Type</label>
            <select
              className="select"
              value={form.vehicle_type}
              onChange={(e) => setForm({ ...form, vehicle_type: e.target.value as VehicleType })}
            >
              {Object.entries(VEHICLE_TYPE_LABELS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">Max Load Capacity (kg)</label>
            <input
              className="input"
              type="number"
              placeholder="18500"
              value={form.max_load_capacity_kg}
              onChange={(e) => setForm({ ...form, max_load_capacity_kg: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label className="label">Region</label>
            <input
              className="input"
              placeholder="Ahmedabad"
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="label">Acquisition Cost (₹)</label>
            <input
              className="input"
              type="number"
              placeholder="4200000"
              value={form.acquisition_cost}
              onChange={(e) => setForm({ ...form, acquisition_cost: e.target.value })}
              required
            />
          </div>
          <div className="field span-2">
            <label className="label">Odometer (km)</label>
            <input
              className="input"
              type="number"
              placeholder="0"
              value={form.odometer_km}
              onChange={(e) => setForm({ ...form, odometer_km: e.target.value })}
            />
          </div>
          {formError ? (
            <p className="text-body-sm u-warning span-2" style={{ gridColumn: "span 2" }}>
              {formError}
            </p>
          ) : null}
        </form>
      </Modal>
    </AppShell>
  );
}
