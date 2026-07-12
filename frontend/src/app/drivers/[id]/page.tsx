import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { Tabs } from "@/components/ui/tabs";
import { Meter } from "@/components/ui/meter";
import { DriverStatusBadge, TripStatusBadge } from "@/components/ui/status-badge";
import {
  drivers,
  driverPerformance,
  driverDocuments,
  trips,
  getVehicle,
  fmtMoney,
  fmtDate,
  fmtDateTime,
  healthMeterClass,
} from "@/lib/mock-data";

export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const driver = drivers.find((d) => d.id === id);
  if (!driver) notFound();

  const perf = driverPerformance[driver.id];
  const documents = driverDocuments[driver.id] ?? [];
  const driverTrips = trips.filter((t) => t.driver_id === driver.id);

  return (
    <AppShell
      eyebrow="Drivers"
      title={driver.name}
      backHref="/drivers"
      actions={
        <>
          <button className="btn btn-outline-muted btn-sm">Edit</button>
          <button className="btn btn-primary btn-sm">Assign to Trip</button>
        </>
      }
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", marginBottom: "var(--space-sm)" }}>
        <DriverStatusBadge status={driver.status} />
        <span className="text-body-md u-body">
          {driver.license_category} · Lic. {driver.license_number}
        </span>
      </div>

      <div className="spec-strip">
        <div className="spec-cell">
          <span className="spec-value text-number-display">{perf.total_trips}</span>
          <span className="spec-label text-caption-uppercase">Total Trips</span>
        </div>
        <div className="spec-cell">
          <span className="spec-value text-number-display">{perf.avg_fuel_efficiency}</span>
          <span className="spec-label text-caption-uppercase">Avg km/l</span>
        </div>
        <div className="spec-cell">
          <span className={`spec-value text-number-display ${perf.incident_count > 3 ? "is-warning" : "is-success"}`}>
            {perf.incident_count}
          </span>
          <span className="spec-label text-caption-uppercase">Incidents</span>
        </div>
        <div className="spec-cell">
          <span className="spec-value text-number-display is-primary">{perf.rating.toFixed(1)}</span>
          <span className="spec-label text-caption-uppercase">Rating / 5</span>
        </div>
        <div className="spec-cell">
          <span className={`spec-value text-number-display ${healthMeterClass(driver.safety_score) === "is-warning" ? "is-warning" : ""}`}>
            {driver.safety_score}
          </span>
          <span className="spec-label text-caption-uppercase">Safety Score</span>
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
                      Driver Information
                    </h2>
                  </div>
                  <div className="panel-body stack-sm">
                    <InfoRow label="Full Name" value={driver.name} />
                    <InfoRow label="License Number" value={driver.license_number} />
                    <InfoRow label="License Category" value={driver.license_category} />
                    <InfoRow label="License Expiry" value={fmtDate(driver.license_expiry_date)} />
                    <InfoRow label="Phone" value={driver.phone} />
                  </div>
                </div>
                <div className="panel">
                  <div className="panel-header">
                    <h2 className="text-title-md" style={{ margin: 0 }}>
                      Performance Summary
                    </h2>
                  </div>
                  <div className="panel-body stack-sm">
                    <InfoRow label="Total Trips Completed" value={String(perf.total_trips)} />
                    <InfoRow label="Average Fuel Efficiency" value={`${perf.avg_fuel_efficiency} km/l`} />
                    <InfoRow label="Incident Count" value={String(perf.incident_count)} />
                    <InfoRow label="Overall Rating" value={`${perf.rating.toFixed(1)} / 5.0`} />
                    <div className="health-row">
                      <div className="health-meta text-body-sm u-muted-soft">Safety Score</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Meter value={driver.safety_score} className="w-16" fillClassName={healthMeterClass(driver.safety_score)} />
                        <span className="text-body-sm">{driver.safety_score}</span>
                      </div>
                    </div>
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
                      <th>Expiry Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="cell-muted" style={{ textAlign: "center", padding: "var(--space-md)" }}>
                          No documents on file.
                        </td>
                      </tr>
                    ) : (
                      documents.map((d, i) => (
                        <tr key={i}>
                          <td className="cell-strong">{d.document_type}</td>
                          <td className="cell-muted">{fmtDate(d.expiry_date)}</td>
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
            id: "trips",
            label: "Trips",
            content: (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Route</th>
                      <th>Vehicle</th>
                      <th>Revenue</th>
                      <th>Status</th>
                      <th>Dispatched</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverTrips.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="cell-muted" style={{ textAlign: "center", padding: "var(--space-md)" }}>
                          No trips recorded for this driver.
                        </td>
                      </tr>
                    ) : (
                      driverTrips.map((t) => {
                        const vehicle = getVehicle(t.vehicle_id);
                        return (
                          <tr key={t.id}>
                            <td className="cell-strong">
                              {t.source_location} → {t.destination_location}
                            </td>
                            <td>{vehicle?.registration_number}</td>
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
