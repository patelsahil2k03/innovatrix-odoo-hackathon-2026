"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { Tabs } from "@/components/ui/tabs";
import { Meter } from "@/components/ui/meter";
import { LoadingBlock, ErrorBlock, TableRowState } from "@/components/ui/async-state";
import { DriverStatusBadge, TripStatusBadge, DocumentStatusBadge } from "@/components/ui/status-badge";
import { api, type VehicleOut } from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import { fmtMoney, fmtDate, fmtDateTime, healthMeterClass, DOCUMENT_TYPE_LABELS } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { canWriteDrivers, canWriteTrips } from "@/lib/roles";

async function loadDriver(id: string) {
  const [driver, documents, tripsPage, vehiclesPage] = await Promise.all([
    api.drivers.get(id),
    api.drivers.documents(id).catch(() => []),
    api.trips.list({ driver_id: id, page_size: 100, sort: "-created_at" }).catch(() => ({ items: [], total: 0, page: 1, page_size: 100 })),
    api.vehicles.list({ page_size: 100 }).catch(() => ({ items: [], total: 0, page: 1, page_size: 100 })),
  ]);
  return { driver, documents, trips: tripsPage.items, vehicles: vehiclesPage.items };
}

export default function DriverDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const canEdit = canWriteDrivers(user?.role);
  const canAssign = canWriteTrips(user?.role);
  const { data, loading, error, reload } = useFetch(() => loadDriver(id), [id]);

  const vehicleById = useMemo(
    () => new Map((data?.vehicles ?? []).map((v: VehicleOut) => [v.id, v])),
    [data]
  );

  if (loading) {
    return (
      <AppShell eyebrow="Drivers" title="Loading…" backHref="/drivers">
        <LoadingBlock label="Loading driver…" />
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell eyebrow="Drivers" title="Driver" backHref="/drivers">
        <ErrorBlock message={error ?? "Driver not found"} onRetry={reload} />
      </AppShell>
    );
  }

  const { driver, documents, trips } = data;
  const { performance } = driver;

  return (
    <AppShell
      eyebrow="Drivers"
      title={driver.name}
      backHref="/drivers"
      actions={
        canEdit || canAssign ? (
          <>
            {canEdit ? <button className="btn btn-outline-muted btn-sm">Edit</button> : null}
            {canAssign ? <button className="btn btn-primary btn-sm">Assign to Trip</button> : null}
          </>
        ) : undefined
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
          <span className="spec-value text-number-display">{performance.total_trips}</span>
          <span className="spec-label text-caption-uppercase">Total Trips</span>
        </div>
        <div className="spec-cell">
          <span className="spec-value text-number-display">{performance.completed_trips}</span>
          <span className="spec-label text-caption-uppercase">Completed</span>
        </div>
        <div className="spec-cell">
          <span className={`spec-value text-number-display ${performance.cancelled_trips > 3 ? "is-warning" : "is-success"}`}>
            {performance.cancelled_trips}
          </span>
          <span className="spec-label text-caption-uppercase">Cancelled</span>
        </div>
        <div className="spec-cell">
          <span className="spec-value text-number-display is-primary">{performance.rating.toFixed(1)}</span>
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
                    <InfoRow label="Phone" value={driver.phone ?? "—"} />
                  </div>
                </div>
                <div className="panel">
                  <div className="panel-header">
                    <h2 className="text-title-md" style={{ margin: 0 }}>
                      Performance Summary
                    </h2>
                  </div>
                  <div className="panel-body stack-sm">
                    <InfoRow label="Total Trips" value={String(performance.total_trips)} />
                    <InfoRow label="Total Distance" value={`${performance.total_distance_km.toLocaleString("en-IN")} km`} />
                    <InfoRow label="License Valid" value={performance.license_valid ? "Yes" : "No — expired"} />
                    <InfoRow
                      label="Days to License Expiry"
                      value={performance.days_to_license_expiry >= 0 ? String(performance.days_to_license_expiry) : "Expired"}
                    />
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
                    {trips.length === 0 ? (
                      <TableRowState colSpan={5}>No trips recorded for this driver.</TableRowState>
                    ) : (
                      trips.map((t) => {
                        const vehicle = vehicleById.get(t.vehicle_id);
                        return (
                          <tr key={t.id}>
                            <td className="cell-strong">
                              {t.source_city} → {t.dest_city}
                            </td>
                            <td>{vehicle?.registration_number ?? "—"}</td>
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
