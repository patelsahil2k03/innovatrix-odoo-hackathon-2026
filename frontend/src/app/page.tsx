"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { KpiGrid, type KpiCell } from "@/components/ui/kpi-grid";
import { Meter } from "@/components/ui/meter";
import { LoadingBlock, ErrorBlock, EmptyBlock, TableRowState } from "@/components/ui/async-state";
import { TripStatusBadge, RiskBadge, severityDotClass } from "@/components/ui/status-badge";
import { api, type FleetRow, type TripOut, type DriverOut, type AlertOut, type Suggestion } from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import { useEventStream } from "@/lib/use-event-stream";
import { fmtMoney, fmtDate, fmtDateTime, timeAgo, healthMeterClass, riskFromHealth } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { DASHBOARD_TITLE_BY_ROLE, type Role } from "@/lib/roles";

const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;

interface DashboardData {
  kpis: Awaited<ReturnType<typeof api.analytics.kpis>>;
  fleet: FleetRow[];
  alerts: AlertOut[];
  recentTrips: TripOut[];
  drivers: DriverOut[];
  draftTrip: TripOut | null;
  draftSuggestions: Suggestion[];
  nowMs: number;
}

async function loadDashboard(): Promise<DashboardData> {
  const [kpis, fleet, alertsPage, tripsPage, driversPage, draftPage] = await Promise.all([
    api.analytics.kpis(),
    api.analytics.fleet(),
    api.alerts.list({ status: "active", sort: "-created_at", page_size: 5 }),
    api.trips.list({ sort: "-created_at", page_size: 5 }),
    api.drivers.list({ page_size: 200 }),
    api.trips.list({ status: "draft", sort: "-created_at", page_size: 1 }),
  ]);

  const draftTrip = draftPage.items[0] ?? null;
  const draftSuggestions = draftTrip
    ? await api.trips.suggestionsForTrip(draftTrip.id, 1).catch(() => [])
    : [];

  return {
    kpis,
    fleet,
    alerts: alertsPage.items,
    recentTrips: tripsPage.items,
    drivers: driversPage.items,
    draftTrip,
    draftSuggestions,
    nowMs: Date.now(),
  };
}

/** Each role owns a different slice of the business, so the dashboard shows the KPIs and panels
 * that role actually acts on — a Financial Analyst has no use for a dispatch queue, a Dispatcher
 * doesn't need fleet acquisition cost, etc. See lib/roles.ts for the write-permission mapping
 * this mirrors. */
export default function DashboardPage() {
  const { user } = useAuth();
  const role = (user?.role as Role | undefined) ?? "fleet_manager";
  const { data, loading, error, reload } = useFetch(loadDashboard, []);

  // "kpi.refresh" fires after every meaningful write (dispatch, complete, cancel, maintenance,
  // fuel/expense — backend/core/events.py) so the dashboard visibly moves on its own, without
  // the user ever refreshing — the "dynamic data" judging criterion.
  useEventStream({ "kpi.refresh": () => reload() });

  const vehicleByI = useMemo(() => new Map((data?.fleet ?? []).map((v) => [v.vehicle_id, v])), [data]);
  const driverById = useMemo(() => new Map((data?.drivers ?? []).map((d) => [d.id, d])), [data]);

  const fleetHealthRows = useMemo(
    () => [...(data?.fleet ?? [])].sort((a, b) => a.health_score - b.health_score).slice(0, 5),
    [data]
  );

  const expiringLicenses = useMemo(() => {
    if (!data) return [];
    return [...data.drivers]
      .filter((d) => new Date(d.license_expiry_date).getTime() - data.nowMs < THIRTY_DAYS_MS)
      .sort((a, b) => new Date(a.license_expiry_date).getTime() - new Date(b.license_expiry_date).getTime())
      .slice(0, 5);
  }, [data]);

  const kpiCells: KpiCell[] = useMemo(() => {
    if (!data) return [];
    const { kpis, drivers } = data;

    if (role === "dispatcher") {
      return [
        { label: "Active Trips", value: kpis.active_trips, sub: "currently dispatched", primary: true },
        { label: "Pending Dispatch", value: kpis.pending_trips, sub: "draft trips awaiting you" },
        { label: "Drivers On Duty", value: kpis.drivers_on_duty, sub: `of ${kpis.total_drivers} total` },
        { label: "Available Vehicles", value: kpis.available_vehicles, sub: `of ${kpis.total_vehicles} total` },
      ];
    }

    if (role === "safety_officer") {
      const avgSafety = drivers.length
        ? Math.round(drivers.reduce((s, d) => s + d.safety_score, 0) / drivers.length)
        : 0;
      return [
        { label: "Drivers On Duty", value: kpis.drivers_on_duty, sub: `of ${kpis.total_drivers} total` },
        { label: "Open Alerts", value: kpis.open_alerts, sub: "requires review", primary: true },
        { label: "Avg Safety Score", value: avgSafety },
        {
          label: "Licenses Expiring ≤30d",
          value: expiringLicenses.length,
          sub: expiringLicenses.length > 0 ? "needs renewal" : "all clear",
        },
      ];
    }

    if (role === "financial_analyst") {
      return [
        { label: "Fleet Revenue", value: fmtMoney(kpis.total_revenue), sub: "completed trips", primary: true },
        { label: "Operational Cost", value: fmtMoney(kpis.total_operational_cost), sub: "fuel + maintenance" },
        { label: "Fleet Utilization", value: `${kpis.fleet_utilization_pct}%` },
        { label: "Open Alerts", value: kpis.open_alerts, sub: "requires review" },
      ];
    }

    // fleet_manager (and fallback) — the generalist owner's view.
    return [
      { label: "Active Vehicles", value: kpis.available_vehicles + kpis.on_trip_vehicles, sub: `of ${kpis.total_vehicles} total` },
      { label: "In Shop", value: kpis.in_shop_vehicles, sub: "under maintenance" },
      { label: "Open Alerts", value: kpis.open_alerts, sub: "requires review" },
      { label: "Fleet Revenue", value: fmtMoney(kpis.total_revenue), sub: "completed trips", primary: true },
    ];
  }, [data, role, expiringLicenses.length]);

  const showFleetHealth = role === "fleet_manager";
  const showAlerts = role !== "financial_analyst";
  const showLicensesPanel = role === "safety_officer";
  const showDispatchSuggestions = role === "dispatcher";
  const showRecentTrips = role !== "safety_officer";

  return (
    <AppShell eyebrow="Overview" title={DASHBOARD_TITLE_BY_ROLE[role]}>
      {loading ? (
        <LoadingBlock label="Loading dashboard…" />
      ) : error || !data ? (
        <ErrorBlock message={error ?? "Failed to load dashboard"} onRetry={reload} />
      ) : (
        <>
          <KpiGrid cells={kpiCells} />

          {showFleetHealth || showAlerts ? (
            <div className="grid-2 mb-md">
              {showFleetHealth ? (
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
                    {fleetHealthRows.length === 0 ? (
                      <EmptyBlock label="No vehicles yet." />
                    ) : (
                      fleetHealthRows.map((v) => (
                        <div className="health-row" key={v.vehicle_id}>
                          <div className="health-meta">
                            <div className="text-body-md cell-strong">{v.registration_number}</div>
                            <div className="text-caption u-muted-soft">
                              {v.name_model} · <RiskBadge level={riskFromHealth(v.health_score)} />
                            </div>
                          </div>
                          <Meter value={v.health_score} fillClassName={healthMeterClass(v.health_score)} />
                          <div className="health-score text-title-sm">{v.health_score}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}

              {showAlerts ? (
                <div className="panel">
                  <div className="panel-header">
                    <h2 className="text-title-md" style={{ margin: 0 }}>
                      Alerts
                    </h2>
                    <span className="badge badge-warning">{data.kpis.open_alerts} Open</span>
                  </div>
                  <div className="panel-body">
                    {data.alerts.length === 0 ? (
                      <EmptyBlock label="No open alerts." />
                    ) : (
                      data.alerts.map((a) => (
                        <div className="alert-item" key={a.id}>
                          <span className={`alert-sev ${severityDotClass(a.severity)}`} />
                          <div className="alert-body">
                            <div className="text-body-sm cell-strong">{a.title}</div>
                            <div className="text-caption alert-time">{timeAgo(a.created_at, data.nowMs)}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {showLicensesPanel ? (
            <div className="panel mb-md">
              <div className="panel-header">
                <div>
                  <h2 className="text-title-md" style={{ margin: 0 }}>
                    Licenses Expiring Soon
                  </h2>
                  <p className="text-body-sm u-muted" style={{ margin: "4px 0 0" }}>
                    Drivers whose license has expired or expires within 30 days
                  </p>
                </div>
                <Link href="/drivers" className="btn-text text-body-sm">
                  View all drivers →
                </Link>
              </div>
              <div className="panel-body">
                {expiringLicenses.length === 0 ? (
                  <EmptyBlock label="No expired or soon-to-expire licenses." />
                ) : (
                  expiringLicenses.map((d) => (
                    <div className="health-row" key={d.id}>
                      <div className="health-meta">
                        <div className="text-body-md cell-strong">{d.name}</div>
                        <div className="text-caption u-muted-soft">Lic. {d.license_number}</div>
                      </div>
                      <div className="text-body-sm u-warning">
                        {new Date(d.license_expiry_date).getTime() < data.nowMs ? "Expired" : "Expires"}{" "}
                        {fmtDate(d.license_expiry_date)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {showDispatchSuggestions ? (
            <div className="panel mb-md">
              <div className="panel-header">
                <div>
                  <h2 className="text-title-md" style={{ margin: 0 }}>
                    AI Dispatch Suggestions
                  </h2>
                  <p className="text-body-sm u-muted" style={{ margin: "4px 0 0" }}>
                    Best alternative pairing for the newest draft trip awaiting dispatch
                  </p>
                </div>
                <Link href="/trips" className="btn btn-sm btn-outline">
                  Open Dispatch Center
                </Link>
              </div>
              <div className="panel-body">
                {data.draftTrip && data.draftSuggestions[0] ? (
                  <>
                    <div className="match-card">
                      <div className="match-score">
                        <span className="num text-number-display">{Math.round(data.draftSuggestions[0].score)}</span>
                        <span className="text-caption-uppercase u-muted-soft">Match</span>
                      </div>
                      <div className="match-body">
                        <div className="text-body-md cell-strong">
                          {data.draftTrip.source_city} → {data.draftTrip.dest_city}{" "}
                          <span className="u-muted-soft">({data.draftTrip.cargo_weight_kg} kg)</span>
                        </div>
                        <div className="text-body-sm u-body">
                          Best match: {data.draftSuggestions[0].vehicle.registration_number} · {data.draftSuggestions[0].driver.name}
                        </div>
                        <div className="text-body-sm match-reason">{data.draftSuggestions[0].reasons.join(" · ")}</div>
                      </div>
                      <Link href="/trips" className="btn btn-sm btn-primary">
                        Review
                      </Link>
                    </div>
                    {data.kpis.pending_trips > 1 ? (
                      <p className="text-body-sm u-muted-soft" style={{ margin: "var(--space-xxs) 0 0" }}>
                        + {data.kpis.pending_trips - 1} more draft trip(s) awaiting dispatch.{" "}
                        <Link href="/trips" className="u-primary">
                          Review all →
                        </Link>
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="u-muted">No draft trips need dispatch right now.</p>
                )}
              </div>
            </div>
          ) : null}

          {showRecentTrips ? (
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
                    {data.recentTrips.length === 0 ? (
                      <TableRowState colSpan={6}>No trips recorded yet.</TableRowState>
                    ) : (
                      data.recentTrips.map((t) => {
                        const vehicle = vehicleByI.get(t.vehicle_id);
                        const driver = driverById.get(t.driver_id);
                        return (
                          <tr key={t.id}>
                            <td className="cell-strong">
                              {t.source_city} → {t.dest_city}
                            </td>
                            <td>{vehicle?.registration_number ?? "—"}</td>
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
            </div>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
