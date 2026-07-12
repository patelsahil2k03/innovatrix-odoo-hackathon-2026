"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { Tabs } from "@/components/ui/tabs";
import { Meter } from "@/components/ui/meter";
import { Modal } from "@/components/ui/modal";
import { LoadingBlock, ErrorBlock, TableRowState } from "@/components/ui/async-state";
import { DriverStatusBadge, TripStatusBadge, DocumentStatusBadge } from "@/components/ui/status-badge";
import { api, ApiError, type VehicleOut, type LicenseCategory, type DriverStatus } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useFetch } from "@/lib/use-fetch";
import { can } from "@/lib/rbac";
import { fmtMoney, fmtDate, fmtDateTime, healthMeterClass, DOCUMENT_TYPE_LABELS } from "@/lib/format";

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
  const router = useRouter();
  const { user } = useAuth();
  const canWriteDriver = can.writeDrivers(user?.role);
  const canWriteTrips = can.writeTrips(user?.role);
  const { data, loading, error, reload } = useFetch(() => loadDriver(id), [id]);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    license_category: "LMV" as LicenseCategory,
    license_expiry_date: "",
    safety_score: "",
    status: "available" as DriverStatus,
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

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

  function openEdit() {
    setEditForm({
      name: driver.name,
      phone: driver.phone ?? "",
      license_category: driver.license_category,
      license_expiry_date: driver.license_expiry_date,
      safety_score: String(driver.safety_score),
      status: driver.status,
    });
    setEditError(null);
    setIsEditOpen(true);
  }

  async function handleEditDriver(e: React.SyntheticEvent) {
    e.preventDefault();
    setEditError(null);
    setEditSubmitting(true);
    try {
      await api.drivers.update(driver.id, {
        name: editForm.name,
        phone: editForm.phone || undefined,
        license_category: editForm.license_category,
        license_expiry_date: editForm.license_expiry_date,
        safety_score: Number(editForm.safety_score),
        status: editForm.status,
      });
      setIsEditOpen(false);
      reload();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Failed to update driver");
    } finally {
      setEditSubmitting(false);
    }
  }

  return (
    <AppShell
      eyebrow="Drivers"
      title={driver.name}
      backHref="/drivers"
      actions={
        <>
          {canWriteDriver && (
            <button className="btn btn-outline-muted btn-sm" onClick={openEdit}>
              Edit
            </button>
          )}
          {canWriteTrips && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => router.push(`/trips?openTrip=1&driverId=${driver.id}`)}
            >
              Assign to Trip
            </button>
          )}
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

      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Driver"
        footer={
          <>
            <button className="btn btn-outline-muted" onClick={() => setIsEditOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleEditDriver} disabled={editSubmitting}>
              {editSubmitting ? "Saving…" : "Save Changes"}
            </button>
          </>
        }
      >
        <form className="form-grid" onSubmit={handleEditDriver}>
          <div className="field span-2">
            <label className="label">Full Name</label>
            <input
              className="input"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label className="label">Phone</label>
            <input
              className="input"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="label">License Category</label>
            <select
              className="select"
              value={editForm.license_category}
              onChange={(e) =>
                setEditForm({ ...editForm, license_category: e.target.value as LicenseCategory })
              }
            >
              <option value="LMV">LMV</option>
              <option value="HMV">HMV</option>
              <option value="TRANS">TRANS</option>
            </select>
          </div>
          <div className="field">
            <label className="label">License Expiry</label>
            <input
              className="input"
              type="date"
              value={editForm.license_expiry_date}
              onChange={(e) => setEditForm({ ...editForm, license_expiry_date: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label className="label">Safety Score (0–100)</label>
            <input
              className="input"
              type="number"
              min={0}
              max={100}
              value={editForm.safety_score}
              onChange={(e) => setEditForm({ ...editForm, safety_score: e.target.value })}
              required
            />
          </div>
          <div className="field span-2">
            <label className="label">Status</label>
            <select
              className="select"
              value={editForm.status}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value as DriverStatus })}
            >
              <option value="available">Available</option>
              <option value="on_trip">On Trip</option>
              <option value="off_duty">Off Duty</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          {editError ? (
            <p className="text-body-sm u-warning" style={{ gridColumn: "span 2" }}>
              {editError}
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
