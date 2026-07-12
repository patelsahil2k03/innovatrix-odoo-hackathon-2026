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
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import { SearchIcon } from "@/components/icons";
import {
  api,
  type DriverOut,
  type VehicleDocumentOut,
  type MaintenanceOut,
  type FuelLogOut,
  type ExpenseOut,
  type TripOut,
} from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import { usePagedRows } from "@/lib/use-paged-rows";
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

  const documentsPaged = usePagedRows<VehicleDocumentOut>(data?.documents ?? [], {
    searchFields: (d) => [d.document_number, DOCUMENT_TYPE_LABELS[d.document_type]],
    sortFns: {
      document_type: (a, b) => a.document_type.localeCompare(b.document_type),
      expiry_date: (a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime(),
      status: (a, b) => a.status.localeCompare(b.status),
    },
    defaultSort: "expiry_date",
  });
  const maintenancePaged = usePagedRows<MaintenanceOut>(data?.maintenance ?? [], {
    searchFields: (m) => [m.description, MAINTENANCE_TYPE_LABELS[m.maintenance_type]],
    sortFns: {
      maintenance_type: (a, b) => a.maintenance_type.localeCompare(b.maintenance_type),
      cost: (a, b) => a.cost - b.cost,
      status: (a, b) => a.status.localeCompare(b.status),
      opened_at: (a, b) => new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime(),
    },
    defaultSort: "-opened_at",
  });
  const fuelPaged = usePagedRows<FuelLogOut>(data?.fuel ?? [], {
    sortFns: {
      logged_at: (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime(),
      liters: (a, b) => a.liters - b.liters,
      cost: (a, b) => a.cost - b.cost,
    },
    defaultSort: "-logged_at",
  });
  const expensesPaged = usePagedRows<ExpenseOut>(data?.expenses ?? [], {
    searchFields: (e) => [e.notes, EXPENSE_TYPE_LABELS[e.expense_type]],
    sortFns: {
      expense_type: (a, b) => a.expense_type.localeCompare(b.expense_type),
      amount: (a, b) => a.amount - b.amount,
      created_at: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    defaultSort: "-created_at",
  });
  const tripsPaged = usePagedRows<TripOut>(data?.trips ?? [], {
    searchFields: (t) => [t.source_city, t.dest_city],
    sortFns: {
      revenue: (a, b) => a.revenue - b.revenue,
      status: (a, b) => a.status.localeCompare(b.status),
      dispatched_at: (a, b) =>
        new Date(a.dispatched_at ?? 0).getTime() - new Date(b.dispatched_at ?? 0).getTime(),
    },
  });

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

  const { vehicle } = data;
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
              <div>
                <div className="table-toolbar table-toolbar-tab">
                  <div className="search-field">
                    <SearchIcon />
                    <input
                      className="input"
                      type="text"
                      placeholder="Search documents…"
                      value={documentsPaged.query}
                      onChange={(e) => documentsPaged.updateQuery(e.target.value)}
                    />
                  </div>
                </div>
              <div className="table-wrap">
                <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <SortableTh label="Document Type" field="document_type" sort={documentsPaged.sort} onSort={documentsPaged.toggleSort} />
                      <th>Number</th>
                      <SortableTh label="Expiry Date" field="expiry_date" sort={documentsPaged.sort} onSort={documentsPaged.toggleSort} />
                      <SortableTh label="Status" field="status" sort={documentsPaged.sort} onSort={documentsPaged.toggleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {documentsPaged.pageRows.length === 0 ? (
                      <TableRowState colSpan={4}>No documents on file.</TableRowState>
                    ) : (
                      documentsPaged.pageRows.map((d) => (
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
                <Pagination
                  page={documentsPaged.page}
                  pageSize={documentsPaged.pageSize}
                  total={documentsPaged.total}
                  onPageChange={documentsPaged.setPage}
                />
              </div>
              </div>
            ),
          },
          {
            id: "maintenance",
            label: "Maintenance",
            content: (
              <div>
                <div className="table-toolbar table-toolbar-tab">
                  <div className="search-field">
                    <SearchIcon />
                    <input
                      className="input"
                      type="text"
                      placeholder="Search maintenance…"
                      value={maintenancePaged.query}
                      onChange={(e) => maintenancePaged.updateQuery(e.target.value)}
                    />
                  </div>
                </div>
              <div className="table-wrap">
                <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <SortableTh label="Type" field="maintenance_type" sort={maintenancePaged.sort} onSort={maintenancePaged.toggleSort} />
                      <SortableTh label="Cost" field="cost" sort={maintenancePaged.sort} onSort={maintenancePaged.toggleSort} />
                      <SortableTh label="Status" field="status" sort={maintenancePaged.sort} onSort={maintenancePaged.toggleSort} />
                      <SortableTh label="Opened" field="opened_at" sort={maintenancePaged.sort} onSort={maintenancePaged.toggleSort} />
                      <th>Closed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maintenancePaged.pageRows.length === 0 ? (
                      <TableRowState colSpan={5}>No maintenance history.</TableRowState>
                    ) : (
                      maintenancePaged.pageRows.map((m) => (
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
                <Pagination
                  page={maintenancePaged.page}
                  pageSize={maintenancePaged.pageSize}
                  total={maintenancePaged.total}
                  onPageChange={maintenancePaged.setPage}
                />
              </div>
              </div>
            ),
          },
          {
            id: "fuel",
            label: "Fuel Logs",
            content: (
              <div className="table-wrap">
                <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <SortableTh label="Logged At" field="logged_at" sort={fuelPaged.sort} onSort={fuelPaged.toggleSort} />
                      <SortableTh label="Liters" field="liters" sort={fuelPaged.sort} onSort={fuelPaged.toggleSort} />
                      <SortableTh label="Cost" field="cost" sort={fuelPaged.sort} onSort={fuelPaged.toggleSort} />
                      <th>₹/Liter</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fuelPaged.pageRows.length === 0 ? (
                      <TableRowState colSpan={4}>No fuel logs recorded.</TableRowState>
                    ) : (
                      fuelPaged.pageRows.map((f) => (
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
                <Pagination
                  page={fuelPaged.page}
                  pageSize={fuelPaged.pageSize}
                  total={fuelPaged.total}
                  onPageChange={fuelPaged.setPage}
                />
              </div>
            ),
          },
          {
            id: "expenses",
            label: "Expenses",
            content: (
              <div>
                <div className="table-toolbar table-toolbar-tab">
                  <div className="search-field">
                    <SearchIcon />
                    <input
                      className="input"
                      type="text"
                      placeholder="Search expenses…"
                      value={expensesPaged.query}
                      onChange={(e) => expensesPaged.updateQuery(e.target.value)}
                    />
                  </div>
                </div>
              <div className="table-wrap">
                <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <SortableTh label="Type" field="expense_type" sort={expensesPaged.sort} onSort={expensesPaged.toggleSort} />
                      <SortableTh label="Amount" field="amount" sort={expensesPaged.sort} onSort={expensesPaged.toggleSort} />
                      <th>Notes</th>
                      <SortableTh label="Date" field="created_at" sort={expensesPaged.sort} onSort={expensesPaged.toggleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {expensesPaged.pageRows.length === 0 ? (
                      <TableRowState colSpan={4}>No expenses recorded.</TableRowState>
                    ) : (
                      expensesPaged.pageRows.map((e) => (
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
                <Pagination
                  page={expensesPaged.page}
                  pageSize={expensesPaged.pageSize}
                  total={expensesPaged.total}
                  onPageChange={expensesPaged.setPage}
                />
              </div>
              </div>
            ),
          },
          {
            id: "trips",
            label: "Trips",
            content: (
              <div>
                <div className="table-toolbar table-toolbar-tab">
                  <div className="search-field">
                    <SearchIcon />
                    <input
                      className="input"
                      type="text"
                      placeholder="Search route…"
                      value={tripsPaged.query}
                      onChange={(e) => tripsPaged.updateQuery(e.target.value)}
                    />
                  </div>
                </div>
              <div className="table-wrap">
                <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Route</th>
                      <th>Driver</th>
                      <SortableTh label="Revenue" field="revenue" sort={tripsPaged.sort} onSort={tripsPaged.toggleSort} />
                      <SortableTh label="Status" field="status" sort={tripsPaged.sort} onSort={tripsPaged.toggleSort} />
                      <SortableTh label="Dispatched" field="dispatched_at" sort={tripsPaged.sort} onSort={tripsPaged.toggleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {tripsPaged.pageRows.length === 0 ? (
                      <TableRowState colSpan={5}>No trips recorded for this vehicle.</TableRowState>
                    ) : (
                      tripsPaged.pageRows.map((t) => {
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
                <Pagination
                  page={tripsPaged.page}
                  pageSize={tripsPaged.pageSize}
                  total={tripsPaged.total}
                  onPageChange={tripsPaged.setPage}
                />
              </div>
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
