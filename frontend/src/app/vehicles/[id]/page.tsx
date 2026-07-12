"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { Tabs } from "@/components/ui/tabs";
import { LoadingBlock, ErrorBlock, TableRowState } from "@/components/ui/async-state";
import {
  VehicleStatusBadge,
  RiskBadge,
  DocumentStatusBadge,
  MaintenanceStatusBadge,
  TripStatusBadge,
} from "@/components/ui/status-badge";
import { api, type DriverOut } from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import { useAuth } from "@/lib/auth-context";
import { canWriteVehicles } from "@/lib/roles";
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
  const canManage = canWriteVehicles(user?.role);
  const { data, loading, error, reload } = useFetch(() => loadVehicle(id), [id]);

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

  return (
    <AppShell
      eyebrow="Vehicles"
      title={vehicle.registration_number}
      backHref="/vehicles"
      actions={
        canManage ? (
          <>
            <button className="btn btn-outline-muted btn-sm">Edit</button>
            <button className="btn btn-primary btn-sm">Log Maintenance</button>
          </>
        ) : undefined
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
                    </tr>
                  </thead>
                  <tbody>
                    {maintenance.length === 0 ? (
                      <TableRowState colSpan={5}>No maintenance history.</TableRowState>
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
            ),
          },
          {
            id: "expenses",
            label: "Expenses",
            content: (
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
