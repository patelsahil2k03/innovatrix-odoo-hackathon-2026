import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { KpiGrid } from "@/components/ui/kpi-grid";
import { Meter } from "@/components/ui/meter";
import { TripStatusBadge, RiskBadge, severityDotClass } from "@/components/ui/status-badge";
import {
  vehicles,
  drivers,
  trips,
  alerts,
  vehicleHealth,
  aiDispatchSuggestions,
  getVehicle,
  getDriver,
  fmtMoney,
  fmtDateTime,
  timeAgo,
  healthMeterClass,
} from "@/lib/mock-data";

export default function DashboardPage() {
  const activeVehicles = vehicles.filter((v) => v.status === "active").length;
  const availableDrivers = drivers.filter((d) => d.status !== "suspended").length;
  const tripsInProgress = trips.filter((t) => t.status === "dispatched" || t.status === "in_transit").length;
  const pendingDispatch = trips.filter((t) => t.status === "pending").length;
  const healthScores = Object.values(vehicleHealth);
  const avgHealth = Math.round(healthScores.reduce((s, h) => s + h.health_score, 0) / healthScores.length);
  const openAlerts = alerts.filter((a) => a.status === "open").length;
  const revenue = trips
    .filter((t) => t.status !== "cancelled" && t.status !== "pending")
    .reduce((s, t) => s + t.revenue, 0);

  const fleetHealthRows = vehicles
    .map((v) => ({ v, health: vehicleHealth[v.id] }))
    .sort((a, b) => a.health.health_score - b.health.health_score)
    .slice(0, 5);

  const alertRows = alerts.slice(0, 5);

  const pendingTripIds = Object.keys(aiDispatchSuggestions);
  const teaserTripId = pendingTripIds[0];
  const teaserTrip = teaserTripId ? trips.find((t) => t.id === teaserTripId) : undefined;
  const teaserBest = teaserTripId ? aiDispatchSuggestions[teaserTripId][0] : undefined;
  const teaserVehicle = teaserBest ? getVehicle(teaserBest.vehicle_id) : undefined;
  const teaserDriver = teaserBest ? getDriver(teaserBest.driver_id) : undefined;

  const recentTrips = [...trips]
    .sort((a, b) => new Date(b.dispatched_at ?? 0).getTime() - new Date(a.dispatched_at ?? 0).getTime())
    .slice(0, 5);

  return (
    <AppShell eyebrow="Overview" title="Dashboard">
      <KpiGrid
        cells={[
          { label: "Active Vehicles", value: activeVehicles, sub: `of ${vehicles.length} total` },
          { label: "Available Drivers", value: availableDrivers, sub: `of ${drivers.length} total` },
          { label: "Trips In Progress", value: tripsInProgress, sub: `${pendingDispatch} pending dispatch`, primary: true },
          { label: "Avg Fleet Health", value: avgHealth, sub: avgHealth >= 70 ? "Healthy" : "Needs attention" },
          { label: "Open Alerts", value: openAlerts, sub: "requires review" },
          { label: "Fleet Revenue", value: fmtMoney(revenue), sub: "active + completed trips", primary: true },
        ]}
      />

      <div className="grid-2 mb-md">
        <div className="panel">
          <div className="panel-header">
            <h2 className="text-title-md" style={{ margin: 0 }}>
              Fleet Health
            </h2>
            <Link href="/vehicles" className="btn-text text-body-sm">
              View all vehicles →
            </Link>
          </div>
          <div className="panel-body">
            {fleetHealthRows.map(({ v, health }) => (
              <div className="health-row" key={v.id}>
                <div className="health-meta">
                  <div className="text-body-md cell-strong">{v.registration_number}</div>
                  <div className="text-caption u-muted-soft">
                    {v.model} · <RiskBadge level={health.maintenance_risk} />
                  </div>
                </div>
                <Meter value={health.health_score} fillClassName={healthMeterClass(health.health_score)} />
                <div className="health-score text-title-sm">{health.health_score}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2 className="text-title-md" style={{ margin: 0 }}>
              Alerts
            </h2>
            <span className="badge badge-warning">{openAlerts} Open</span>
          </div>
          <div className="panel-body">
            {alertRows.map((a) => (
              <div className="alert-item" key={a.id}>
                <span className={`alert-sev ${severityDotClass(a.severity)}`} />
                <div className="alert-body">
                  <div className="text-body-sm cell-strong">{a.title}</div>
                  <div className="text-caption alert-time">{timeAgo(a.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel mb-md">
        <div className="panel-header">
          <div>
            <h2 className="text-title-md" style={{ margin: 0 }}>
              AI Dispatch Suggestions
            </h2>
            <p className="text-body-sm u-muted" style={{ margin: "4px 0 0" }}>
              Pending trips ranked by best vehicle + driver match
            </p>
          </div>
          <Link href="/trips" className="btn btn-sm btn-outline">
            Open Dispatch Center
          </Link>
        </div>
        <div className="panel-body">
          {teaserTrip && teaserBest && teaserVehicle && teaserDriver ? (
            <>
              <div className="match-card">
                <div className="match-score">
                  <span className="num text-number-display">{teaserBest.score}</span>
                  <span className="text-caption-uppercase u-muted-soft">Match</span>
                </div>
                <div className="match-body">
                  <div className="text-body-md cell-strong">
                    {teaserTrip.source_location} → {teaserTrip.destination_location}{" "}
                    <span className="u-muted-soft">({teaserTrip.cargo_weight}t)</span>
                  </div>
                  <div className="text-body-sm u-body">
                    Best match: {teaserVehicle.registration_number} · {teaserDriver.name}
                  </div>
                  <div className="text-body-sm match-reason">{teaserBest.reason}</div>
                </div>
                <Link href="/trips" className="btn btn-sm btn-primary">
                  Assign
                </Link>
              </div>
              {pendingTripIds.length > 1 ? (
                <p className="text-body-sm u-muted-soft" style={{ margin: "var(--space-xxs) 0 0" }}>
                  + {pendingTripIds.length - 1} more pending trip(s) awaiting dispatch.{" "}
                  <Link href="/trips" className="u-primary">
                    Review all →
                  </Link>
                </p>
              ) : null}
            </>
          ) : (
            <p className="u-muted">No pending trips need dispatch right now.</p>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="text-title-md" style={{ margin: 0 }}>
            Recent Trips
          </h2>
          <Link href="/trips" className="btn-text text-body-sm">
            View all trips →
          </Link>
        </div>
        <div className="table-wrap" style={{ border: "none" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Route</th>
                <th>Vehicle</th>
                <th>Driver</th>
                <th>Revenue</th>
                <th>Status</th>
                <th>Dispatched</th>
              </tr>
            </thead>
            <tbody>
              {recentTrips.map((t) => {
                const vehicle = getVehicle(t.vehicle_id);
                const driver = t.driver_id ? getDriver(t.driver_id) : null;
                return (
                  <tr key={t.id}>
                    <td className="cell-strong">
                      {t.source_location} → {t.destination_location}
                    </td>
                    <td>{vehicle?.registration_number}</td>
                    <td>{driver ? driver.name : <span className="cell-muted">Unassigned</span>}</td>
                    <td>{fmtMoney(t.revenue)}</td>
                    <td>
                      <TripStatusBadge status={t.status} />
                    </td>
                    <td className="cell-muted">{fmtDateTime(t.dispatched_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
