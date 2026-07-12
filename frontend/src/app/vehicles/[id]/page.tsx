import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { Tabs } from "@/components/ui/tabs";
import {
  VehicleStatusBadge,
  RiskBadge,
  DocumentStatusBadge,
  MaintenanceStatusBadge,
  TripStatusBadge,
} from "@/components/ui/status-badge";
import {
  vehicles,
  vehicleHealth,
  vehicleAnalytics,
  vehicleDocuments,
  maintenanceLogs,
  fuelLogs,
  expenses,
  trips,
  getDriver,
  fmtMoney,
  fmtDate,
  fmtDateTime,
} from "@/lib/mock-data";

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vehicle = vehicles.find((v) => v.id === id);
  if (!vehicle) notFound();

  const health = vehicleHealth[vehicle.id];
  const analytics = vehicleAnalytics[vehicle.id];
  const documents = vehicleDocuments[vehicle.id] ?? [];
  const maintenance = maintenanceLogs[vehicle.id] ?? [];
  const fuel = fuelLogs[vehicle.id] ?? [];
  const vehicleExpenses = expenses[vehicle.id] ?? [];
  const vehicleTrips = trips.filter((t) => t.vehicle_id === vehicle.id);

  return (
    <AppShell
      eyebrow="Vehicles"
      title={vehicle.registration_number}
      backHref="/vehicles"
      actions={
        <>
          <button className="btn btn-outline-muted btn-sm">Edit</button>
          <button className="btn btn-primary btn-sm">Log Maintenance</button>
        </>
      }
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", marginBottom: "var(--space-sm)" }}>
        <VehicleStatusBadge status={vehicle.status} />
        <span className="text-body-md u-body">
          {vehicle.model} · {vehicle.vehicle_type} · {vehicle.region}
        </span>
      </div>

      <div className="spec-strip">
        <div className="spec-cell">
          <span className={`spec-value text-number-display ${health.health_score >= 70 ? "is-success" : health.health_score < 45 ? "is-warning" : ""}`}>
            {health.health_score}
          </span>
          <span className="spec-label text-caption-uppercase">Health Score</span>
        </div>
        <div className="spec-cell">
          <span className="spec-value text-number-display">{analytics.fuel_efficiency}</span>
          <span className="spec-label text-caption-uppercase">km / liter</span>
        </div>
        <div className="spec-cell">
          <span className="spec-value text-number-display">{analytics.utilization_percent}%</span>
          <span className="spec-label text-caption-uppercase">Utilization</span>
        </div>
        <div className="spec-cell">
          <span className="spec-value text-number-display">₹{analytics.cost_per_km}</span>
          <span className="spec-label text-caption-uppercase">Cost / km</span>
        </div>
        <div className="spec-cell">
          <span className={`spec-value text-number-display ${analytics.profitability < 0 ? "is-warning" : "is-primary"}`}>
            {fmtMoney(analytics.profitability)}
          </span>
          <span className="spec-label text-caption-uppercase">Profitability</span>
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
                    <InfoRow label="Model" value={vehicle.model} />
                    <InfoRow label="Vehicle Type" value={vehicle.vehicle_type} />
                    <InfoRow label="Max Load Capacity" value={`${vehicle.max_load_capacity} t`} />
                    <InfoRow label="Odometer" value={`${vehicle.odometer.toLocaleString("en-IN")} km`} />
                    <InfoRow label="Acquisition Cost" value={fmtMoney(vehicle.acquisition_cost)} />
                    <InfoRow label="Region" value={vehicle.region} />
                  </div>
                </div>
                <div className="panel">
                  <div className="panel-header">
                    <h2 className="text-title-md" style={{ margin: 0 }}>
                      Predictive Health
                    </h2>
                  </div>
                  <div className="panel-body stack-sm">
                    <div className="health-row">
                      <div className="health-meta text-body-sm u-muted-soft">Maintenance Risk</div>
                      <div>
                        <RiskBadge level={health.maintenance_risk} />
                      </div>
                    </div>
                    <InfoRow label="Predicted Service Date" value={fmtDate(health.predicted_service_date)} />
                    <InfoRow label="Last Calculated" value={fmtDateTime(health.calculated_at)} />
                    <InfoRow label="Fuel Efficiency" value={`${analytics.fuel_efficiency} km/l`} />
                    <InfoRow label="Utilization" value={`${analytics.utilization_percent}%`} />
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
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.length === 0 ? (
                      <EmptyRow colSpan={5} label="No documents on file." />
                    ) : (
                      documents.map((d) => (
                        <tr key={d.document_number}>
                          <td className="cell-strong">{d.document_type}</td>
                          <td className="cell-muted">{d.document_number}</td>
                          <td className="cell-muted">{fmtDate(d.expiry_date)}</td>
                          <td>
                            <DocumentStatusBadge status={d.status} />
                          </td>
                          <td>
                            <a href="#" className="btn-text text-body-sm">
                              View File
                            </a>
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
                      <EmptyRow colSpan={5} label="No maintenance history." />
                    ) : (
                      maintenance.map((m, i) => (
                        <tr key={i}>
                          <td className="cell-strong">{m.maintenance_type}</td>
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
                      <EmptyRow colSpan={4} label="No fuel logs recorded." />
                    ) : (
                      fuel.map((f, i) => (
                        <tr key={i}>
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
                    {vehicleExpenses.length === 0 ? (
                      <EmptyRow colSpan={4} label="No expenses recorded." />
                    ) : (
                      vehicleExpenses.map((e, i) => (
                        <tr key={i}>
                          <td className="cell-strong">{e.expense_type}</td>
                          <td>{fmtMoney(e.amount)}</td>
                          <td className="cell-muted">{e.notes}</td>
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
                    {vehicleTrips.length === 0 ? (
                      <EmptyRow colSpan={5} label="No trips recorded for this vehicle." />
                    ) : (
                      vehicleTrips.map((t) => {
                        const driver = t.driver_id ? getDriver(t.driver_id) : null;
                        return (
                          <tr key={t.id}>
                            <td className="cell-strong">
                              {t.source_location} → {t.destination_location}
                            </td>
                            <td>{driver ? driver.name : <span className="cell-muted">Unassigned</span>}</td>
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

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="cell-muted" style={{ textAlign: "center", padding: "var(--space-md)" }}>
        {label}
      </td>
    </tr>
  );
}
