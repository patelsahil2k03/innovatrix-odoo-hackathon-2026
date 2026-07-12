"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { Tabs } from "@/components/ui/tabs";
import { Modal } from "@/components/ui/modal";
import { PlusIcon } from "@/components/icons";
import { LoadingBlock, ErrorBlock, TableRowState } from "@/components/ui/async-state";
import {
  VehicleStatusBadge,
  RiskBadge,
  DocumentStatusBadge,
  MaintenanceStatusBadge,
  TripStatusBadge,
} from "@/components/ui/status-badge";
import {
  api,
  ApiError,
  type DriverOut,
  type VehicleType,
  type VehicleStatus,
  type MaintenanceType,
  type ExpenseType,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useFetch } from "@/lib/use-fetch";
import { can } from "@/lib/rbac";
import {
  fmtMoney,
  fmtDate,
  fmtDateTime,
  fmtNumber,
  riskFromHealth,
  DOCUMENT_TYPE_LABELS,
  MAINTENANCE_TYPE_LABELS,
  EXPENSE_TYPE_LABELS,
  VEHICLE_TYPE_LABELS,
} from "@/lib/format";

async function loadVehicle(id: string) {
  const [vehicle, documents, maintenance, fuel, expenses, trips, driversPage] = await Promise.all([
    api.vehicles.get(id),
    api.vehicles.documents(id).catch(() => []),
    api.maintenance.list({ vehicle_id: id, page_size: 100 }).catch(() => ({ items: [], total: 0, page: 1, page_size: 100 })),
    api.fuelLogs.list({ vehicle_id: id, page_size: 100 }).catch(() => ({ items: [], total: 0, page: 1, page_size: 100 })),
    api.expenses.list({ vehicle_id: id, page_size: 100 }).catch(() => ({ items: [], total: 0, page: 1, page_size: 100 })),
    api.trips.list({ vehicle_id: id, page_size: 100, sort: "-created_at" }).catch(() => ({ items: [], total: 0, page: 1, page_size: 100 })),
    api.drivers.list({ page_size: 200 }).catch(() => ({ items: [], total: 0, page: 1, page_size: 200 })),
  ]);
  return {
    vehicle,
    documents,
    maintenance: maintenance.items,
    fuel: fuel.items,
    expenses: expenses.items,
    trips: trips.items,
    drivers: driversPage.items,
  };
}

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const canWriteVehicle = can.writeVehicles(user?.role);
  const canWriteMaintenance = can.writeMaintenance(user?.role);
  const canWriteCosts = can.writeCosts(user?.role);
  const { data, loading, error, reload } = useFetch(() => loadVehicle(id), [id]);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name_model: "",
    vehicle_type: "truck" as VehicleType,
    max_load_capacity_kg: "",
    odometer_km: "",
    acquisition_cost: "",
    region: "",
    status: "available" as VehicleStatus,
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState({
    maintenance_type: "service" as MaintenanceType,
    description: "",
    cost: "",
  });
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const [maintenanceSubmitting, setMaintenanceSubmitting] = useState(false);

  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeCost, setCloseCost] = useState("");
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closeSubmitting, setCloseSubmitting] = useState(false);

  const [isFuelOpen, setIsFuelOpen] = useState(false);
  const [fuelForm, setFuelForm] = useState({ liters: "", cost: "", odometer_at_fill: "" });
  const [fuelError, setFuelError] = useState<string | null>(null);
  const [fuelSubmitting, setFuelSubmitting] = useState(false);

  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    expense_type: "toll" as ExpenseType,
    amount: "",
    notes: "",
  });
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);

  const driverById = useMemo(
    () => new Map((data?.drivers ?? []).map((d: DriverOut) => [d.id, d])),
    [data]
  );

  if (loading) {
    return (
      <AppShell eyebrow="Vehicles" title="Loading…" backHref="/vehicles">
        <LoadingBlock label="Loading vehicle…" />
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell eyebrow="Vehicles" title="Vehicle" backHref="/vehicles">
        <ErrorBlock message={error ?? "Vehicle not found"} onRetry={reload} />
      </AppShell>
    );
  }

  const { vehicle, documents, maintenance, fuel, expenses, trips } = data;
  const { costs, metrics } = vehicle;

  function openEdit() {
    setEditForm({
      name_model: vehicle.name_model,
      vehicle_type: vehicle.vehicle_type,
      max_load_capacity_kg: String(vehicle.max_load_capacity_kg),
      odometer_km: String(vehicle.odometer_km),
      acquisition_cost: String(vehicle.acquisition_cost),
      region: vehicle.region ?? "",
      status: vehicle.status,
    });
    setEditError(null);
    setIsEditOpen(true);
  }

  async function handleEditVehicle(e: React.SyntheticEvent) {
    e.preventDefault();
    setEditError(null);
    setEditSubmitting(true);
    try {
      await api.vehicles.update(vehicle.id, {
        name_model: editForm.name_model,
        vehicle_type: editForm.vehicle_type,
        max_load_capacity_kg: Number(editForm.max_load_capacity_kg),
        odometer_km: Number(editForm.odometer_km),
        acquisition_cost: Number(editForm.acquisition_cost),
        region: editForm.region || undefined,
        status: editForm.status,
      });
      setIsEditOpen(false);
      reload();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Failed to update vehicle");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleLogMaintenance(e: React.SyntheticEvent) {
    e.preventDefault();
    setMaintenanceError(null);
    setMaintenanceSubmitting(true);
    try {
      await api.maintenance.open({
        vehicle_id: vehicle.id,
        maintenance_type: maintenanceForm.maintenance_type,
        description: maintenanceForm.description || undefined,
        cost: maintenanceForm.cost ? Number(maintenanceForm.cost) : undefined,
      });
      setIsMaintenanceOpen(false);
      setMaintenanceForm({ maintenance_type: "service", description: "", cost: "" });
      reload();
    } catch (err) {
      setMaintenanceError(err instanceof ApiError ? err.message : "Failed to open maintenance job");
    } finally {
      setMaintenanceSubmitting(false);
    }
  }

  async function handleCloseMaintenance(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!closingId) return;
    setCloseError(null);
    setCloseSubmitting(true);
    try {
      await api.maintenance.close(closingId, Number(closeCost));
      setClosingId(null);
      setCloseCost("");
      reload();
    } catch (err) {
      setCloseError(err instanceof ApiError ? err.message : "Failed to close maintenance job");
    } finally {
      setCloseSubmitting(false);
    }
  }

  async function handleLogFuel(e: React.SyntheticEvent) {
    e.preventDefault();
    setFuelError(null);
    setFuelSubmitting(true);
    try {
      await api.fuelLogs.create({
        vehicle_id: vehicle.id,
        liters: Number(fuelForm.liters),
        cost: Number(fuelForm.cost),
        odometer_at_fill: fuelForm.odometer_at_fill ? Number(fuelForm.odometer_at_fill) : undefined,
      });
      setIsFuelOpen(false);
      setFuelForm({ liters: "", cost: "", odometer_at_fill: "" });
      reload();
    } catch (err) {
      setFuelError(err instanceof ApiError ? err.message : "Failed to log fuel");
    } finally {
      setFuelSubmitting(false);
    }
  }

  async function handleAddExpense(e: React.SyntheticEvent) {
    e.preventDefault();
    setExpenseError(null);
    setExpenseSubmitting(true);
    try {
      await api.expenses.create({
        vehicle_id: vehicle.id,
        expense_type: expenseForm.expense_type,
        amount: Number(expenseForm.amount),
        notes: expenseForm.notes || undefined,
      });
      setIsExpenseOpen(false);
      setExpenseForm({ expense_type: "toll", amount: "", notes: "" });
      reload();
    } catch (err) {
      setExpenseError(err instanceof ApiError ? err.message : "Failed to add expense");
    } finally {
      setExpenseSubmitting(false);
    }
  }

  return (
    <AppShell
      eyebrow="Vehicles"
      title={vehicle.registration_number}
      backHref="/vehicles"
      actions={
        <>
          {canWriteVehicle && (
            <button className="btn btn-outline-muted btn-sm" onClick={openEdit}>
              Edit
            </button>
          )}
          {canWriteMaintenance && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setMaintenanceError(null);
                setIsMaintenanceOpen(true);
              }}
            >
              Log Maintenance
            </button>
          )}
        </>
      }
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", marginBottom: "var(--space-sm)" }}>
        <VehicleStatusBadge status={vehicle.status} />
        <span className="text-body-md u-body">
          {vehicle.name_model} · {VEHICLE_TYPE_LABELS[vehicle.vehicle_type]} · {vehicle.region ?? "—"}
        </span>
      </div>

      <div className="spec-strip">
        <div className="spec-cell">
          <span
            className={`spec-value text-number-display ${metrics.health_score >= 70 ? "is-success" : metrics.health_score < 45 ? "is-warning" : ""}`}
          >
            {metrics.health_score}
          </span>
          <span className="spec-label text-caption-uppercase">Health Score</span>
        </div>
        <div className="spec-cell">
          <span className="spec-value text-number-display">{metrics.fuel_efficiency_kmpl ?? "—"}</span>
          <span className="spec-label text-caption-uppercase">km / liter</span>
        </div>
        <div className="spec-cell">
          <span className="spec-value text-number-display">{metrics.utilization_pct}%</span>
          <span className="spec-label text-caption-uppercase">Utilization</span>
        </div>
        <div className="spec-cell">
          <span className="spec-value text-number-display">
            {metrics.cost_per_km != null ? `₹${metrics.cost_per_km}` : "—"}
          </span>
          <span className="spec-label text-caption-uppercase">Cost / km</span>
        </div>
        <div className="spec-cell">
          <span
            className={`spec-value text-number-display ${metrics.roi != null && metrics.roi < 0 ? "is-warning" : "is-primary"}`}
          >
            {metrics.roi != null ? `${(metrics.roi * 100).toFixed(1)}%` : "—"}
          </span>
          <span className="spec-label text-caption-uppercase">ROI</span>
        </div>
      </div>

      <Tabs
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <div className="grid-2col-even">
                <div className="panel">
                  <div className="panel-header">
                    <h2 className="text-title-md" style={{ margin: 0 }}>
                      Vehicle Information
                    </h2>
                  </div>
                  <div className="panel-body stack-sm">
                    <InfoRow label="Registration Number" value={vehicle.registration_number} />
                    <InfoRow label="Model" value={vehicle.name_model} />
                    <InfoRow label="Vehicle Type" value={VEHICLE_TYPE_LABELS[vehicle.vehicle_type]} />
                    <InfoRow label="Max Load Capacity" value={`${fmtNumber(vehicle.max_load_capacity_kg)} kg`} />
                    <InfoRow label="Odometer" value={`${fmtNumber(vehicle.odometer_km)} km`} />
                    <InfoRow label="Acquisition Cost" value={fmtMoney(vehicle.acquisition_cost)} />
                    <InfoRow label="Region" value={vehicle.region ?? "—"} />
                  </div>
                </div>
                <div className="panel">
                  <div className="panel-header">
                    <h2 className="text-title-md" style={{ margin: 0 }}>
                      Cost Breakdown
                    </h2>
                  </div>
                  <div className="panel-body stack-sm">
                    <div className="health-row">
                      <div className="health-meta text-body-sm u-muted-soft">Maintenance Risk</div>
                      <div>
                        <RiskBadge level={riskFromHealth(metrics.health_score)} />
                      </div>
                    </div>
                    <InfoRow label="Fuel Cost" value={fmtMoney(costs.fuel_total)} />
                    <InfoRow label="Maintenance Cost" value={fmtMoney(costs.maintenance_total)} />
                    <InfoRow label="Other Expenses" value={fmtMoney(costs.other_total)} />
                    <InfoRow label="Total Operational Cost" value={fmtMoney(costs.operational_total)} />
                  </div>
                </div>
              </div>
            ),
          },
          {
            id: "documents",
            label: "Documents",
            content: (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Document Type</th>
                      <th>Number</th>
                      <th>Expiry Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.length === 0 ? (
                      <TableRowState colSpan={4}>No documents on file.</TableRowState>
                    ) : (
                      documents.map((d) => (
                        <tr key={d.id}>
                          <td className="cell-strong">{DOCUMENT_TYPE_LABELS[d.document_type] ?? d.document_type}</td>
                          <td className="cell-muted">{d.document_number ?? "—"}</td>
                          <td className="cell-muted">{fmtDate(d.expiry_date)}</td>
                          <td>
                            <DocumentStatusBadge status={d.status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ),
          },
          {
            id: "maintenance",
            label: "Maintenance",
            content: (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Cost</th>
                      <th>Status</th>
                      <th>Opened</th>
                      <th>Closed</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {maintenance.length === 0 ? (
                      <TableRowState colSpan={6}>No maintenance history.</TableRowState>
                    ) : (
                      maintenance.map((m) => (
                        <tr key={m.id}>
                          <td className="cell-strong">{MAINTENANCE_TYPE_LABELS[m.maintenance_type] ?? m.maintenance_type}</td>
                          <td>{fmtMoney(m.cost)}</td>
                          <td>
                            <MaintenanceStatusBadge status={m.status} />
                          </td>
                          <td className="cell-muted">{fmtDateTime(m.opened_at)}</td>
                          <td className="cell-muted">{fmtDateTime(m.closed_at)}</td>
                          <td>
                            {canWriteMaintenance && m.status === "open" && (
                              <button
                                className="btn btn-sm btn-outline-muted"
                                onClick={() => {
                                  setCloseError(null);
                                  setCloseCost(String(m.cost || ""));
                                  setClosingId(m.id);
                                }}
                              >
                                Close
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ),
          },
          {
            id: "fuel",
            label: "Fuel Logs",
            content: (
              <div>
                {canWriteCosts && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-xs)" }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setFuelError(null);
                        setIsFuelOpen(true);
                      }}
                    >
                      <PlusIcon style={{ width: 14, height: 14 }} />
                      Log Fuel
                    </button>
                  </div>
                )}
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Logged At</th>
                        <th>Liters</th>
                        <th>Cost</th>
                        <th>₹/Liter</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fuel.length === 0 ? (
                        <TableRowState colSpan={4}>No fuel logs recorded.</TableRowState>
                      ) : (
                        fuel.map((f) => (
                          <tr key={f.id}>
                            <td className="cell-strong">{fmtDateTime(f.logged_at)}</td>
                            <td>{f.liters} L</td>
                            <td>{fmtMoney(f.cost)}</td>
                            <td className="cell-muted">₹{(f.cost / f.liters).toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ),
          },
          {
            id: "expenses",
            label: "Expenses",
            content: (
              <div>
                {canWriteCosts && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-xs)" }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setExpenseError(null);
                        setIsExpenseOpen(true);
                      }}
                    >
                      <PlusIcon style={{ width: 14, height: 14 }} />
                      Add Expense
                    </button>
                  </div>
                )}
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Notes</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.length === 0 ? (
                        <TableRowState colSpan={4}>No expenses recorded.</TableRowState>
                      ) : (
                        expenses.map((e) => (
                          <tr key={e.id}>
                            <td className="cell-strong">{EXPENSE_TYPE_LABELS[e.expense_type] ?? e.expense_type}</td>
                            <td>{fmtMoney(e.amount)}</td>
                            <td className="cell-muted">{e.notes ?? "—"}</td>
                            <td className="cell-muted">{fmtDateTime(e.created_at)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ),
          },
          {
            id: "trips",
            label: "Trips",
            content: (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Route</th>
                      <th>Driver</th>
                      <th>Revenue</th>
                      <th>Status</th>
                      <th>Dispatched</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.length === 0 ? (
                      <TableRowState colSpan={5}>No trips recorded for this vehicle.</TableRowState>
                    ) : (
                      trips.map((t) => {
                        const driver = driverById.get(t.driver_id);
                        return (
                          <tr key={t.id}>
                            <td className="cell-strong">
                              {t.source_city} → {t.dest_city}
                            </td>
                            <td>{driver?.name ?? "—"}</td>
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
            ),
          },
        ]}
      />

      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Vehicle"
        footer={
          <>
            <button className="btn btn-outline-muted" onClick={() => setIsEditOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleEditVehicle} disabled={editSubmitting}>
              {editSubmitting ? "Saving…" : "Save Changes"}
            </button>
          </>
        }
      >
        <form className="form-grid" onSubmit={handleEditVehicle}>
          <div className="field">
            <label className="label">Model</label>
            <input
              className="input"
              value={editForm.name_model}
              onChange={(e) => setEditForm({ ...editForm, name_model: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label className="label">Vehicle Type</label>
            <select
              className="select"
              value={editForm.vehicle_type}
              onChange={(e) => setEditForm({ ...editForm, vehicle_type: e.target.value as VehicleType })}
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
              value={editForm.max_load_capacity_kg}
              onChange={(e) => setEditForm({ ...editForm, max_load_capacity_kg: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label className="label">Odometer (km)</label>
            <input
              className="input"
              type="number"
              value={editForm.odometer_km}
              onChange={(e) => setEditForm({ ...editForm, odometer_km: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label className="label">Acquisition Cost (₹)</label>
            <input
              className="input"
              type="number"
              value={editForm.acquisition_cost}
              onChange={(e) => setEditForm({ ...editForm, acquisition_cost: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label className="label">Region</label>
            <input
              className="input"
              value={editForm.region}
              onChange={(e) => setEditForm({ ...editForm, region: e.target.value })}
            />
          </div>
          <div className="field span-2">
            <label className="label">Status</label>
            <select
              className="select"
              value={editForm.status}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value as VehicleStatus })}
            >
              <option value="available">Available</option>
              <option value="on_trip">On Trip</option>
              <option value="in_shop">In Shop</option>
              <option value="retired">Retired</option>
            </select>
          </div>
          {editError ? (
            <p className="text-body-sm u-warning" style={{ gridColumn: "span 2" }}>
              {editError}
            </p>
          ) : null}
        </form>
      </Modal>

      <Modal
        isOpen={isMaintenanceOpen}
        onClose={() => setIsMaintenanceOpen(false)}
        title="Log Maintenance"
        footer={
          <>
            <button className="btn btn-outline-muted" onClick={() => setIsMaintenanceOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleLogMaintenance} disabled={maintenanceSubmitting}>
              {maintenanceSubmitting ? "Saving…" : "Open Job"}
            </button>
          </>
        }
      >
        <form className="form-grid" onSubmit={handleLogMaintenance}>
          <div className="field span-2">
            <label className="label">Maintenance Type</label>
            <select
              className="select"
              value={maintenanceForm.maintenance_type}
              onChange={(e) =>
                setMaintenanceForm({ ...maintenanceForm, maintenance_type: e.target.value as MaintenanceType })
              }
            >
              {Object.entries(MAINTENANCE_TYPE_LABELS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field span-2">
            <label className="label">Description (optional)</label>
            <input
              className="input"
              value={maintenanceForm.description}
              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
            />
          </div>
          <div className="field span-2">
            <label className="label">Estimated Cost (₹, optional)</label>
            <input
              className="input"
              type="number"
              value={maintenanceForm.cost}
              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })}
            />
          </div>
          <p className="text-caption u-muted-soft span-2" style={{ gridColumn: "span 2" }}>
            Opening this job will move the vehicle to <strong>In Shop</strong> and hide it from
            trip dispatch until it&apos;s closed.
          </p>
          {maintenanceError ? (
            <p className="text-body-sm u-warning" style={{ gridColumn: "span 2" }}>
              {maintenanceError}
            </p>
          ) : null}
        </form>
      </Modal>

      <Modal
        isOpen={!!closingId}
        onClose={() => setClosingId(null)}
        title="Close Maintenance Job"
        footer={
          <>
            <button className="btn btn-outline-muted" onClick={() => setClosingId(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleCloseMaintenance} disabled={closeSubmitting}>
              {closeSubmitting ? "Saving…" : "Close Job"}
            </button>
          </>
        }
      >
        <form className="form-grid" onSubmit={handleCloseMaintenance}>
          <div className="field span-2">
            <label className="label">Final Cost (₹)</label>
            <input
              className="input"
              type="number"
              value={closeCost}
              onChange={(e) => setCloseCost(e.target.value)}
              required
            />
          </div>
          <p className="text-caption u-muted-soft span-2" style={{ gridColumn: "span 2" }}>
            The vehicle returns to <strong>Available</strong> unless it&apos;s retired or has another
            open job.
          </p>
          {closeError ? (
            <p className="text-body-sm u-warning" style={{ gridColumn: "span 2" }}>
              {closeError}
            </p>
          ) : null}
        </form>
      </Modal>

      <Modal
        isOpen={isFuelOpen}
        onClose={() => setIsFuelOpen(false)}
        title="Log Fuel"
        footer={
          <>
            <button className="btn btn-outline-muted" onClick={() => setIsFuelOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleLogFuel} disabled={fuelSubmitting}>
              {fuelSubmitting ? "Saving…" : "Log Fuel"}
            </button>
          </>
        }
      >
        <form className="form-grid" onSubmit={handleLogFuel}>
          <div className="field">
            <label className="label">Liters</label>
            <input
              className="input"
              type="number"
              value={fuelForm.liters}
              onChange={(e) => setFuelForm({ ...fuelForm, liters: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label className="label">Cost (₹)</label>
            <input
              className="input"
              type="number"
              value={fuelForm.cost}
              onChange={(e) => setFuelForm({ ...fuelForm, cost: e.target.value })}
              required
            />
          </div>
          <div className="field span-2">
            <label className="label">Odometer at Fill (km, optional)</label>
            <input
              className="input"
              type="number"
              value={fuelForm.odometer_at_fill}
              onChange={(e) => setFuelForm({ ...fuelForm, odometer_at_fill: e.target.value })}
            />
          </div>
          {fuelError ? (
            <p className="text-body-sm u-warning" style={{ gridColumn: "span 2" }}>
              {fuelError}
            </p>
          ) : null}
        </form>
      </Modal>

      <Modal
        isOpen={isExpenseOpen}
        onClose={() => setIsExpenseOpen(false)}
        title="Add Expense"
        footer={
          <>
            <button className="btn btn-outline-muted" onClick={() => setIsExpenseOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleAddExpense} disabled={expenseSubmitting}>
              {expenseSubmitting ? "Saving…" : "Add Expense"}
            </button>
          </>
        }
      >
        <form className="form-grid" onSubmit={handleAddExpense}>
          <div className="field span-2">
            <label className="label">Expense Type</label>
            <select
              className="select"
              value={expenseForm.expense_type}
              onChange={(e) => setExpenseForm({ ...expenseForm, expense_type: e.target.value as ExpenseType })}
            >
              {Object.entries(EXPENSE_TYPE_LABELS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field span-2">
            <label className="label">Amount (₹)</label>
            <input
              className="input"
              type="number"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              required
            />
          </div>
          <div className="field span-2">
            <label className="label">Notes (optional)</label>
            <input
              className="input"
              value={expenseForm.notes}
              onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
            />
          </div>
          {expenseError ? (
            <p className="text-body-sm u-warning" style={{ gridColumn: "span 2" }}>
              {expenseError}
            </p>
          ) : null}
        </form>
      </Modal>
    </AppShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="health-row">
      <div className="health-meta text-body-sm u-muted-soft">{label}</div>
      <div className="cell-strong">{value}</div>
    </div>
  );
}
