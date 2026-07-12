"use client";

import { useMemo } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { KpiGrid } from "@/components/ui/kpi-grid";
import { Meter } from "@/components/ui/meter";
import { LoadingBlock, ErrorBlock, EmptyBlock } from "@/components/ui/async-state";
import { FleetMap } from "@/components/fleet-map";
import { TrendChart } from "@/components/revenue-trend-chart";
import { api } from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import { fmtMoney, ratingFromSafetyScore } from "@/lib/format";

async function loadAnalytics() {
  const [kpis, fleet, trends, liveTrips, driversPage] = await Promise.all([
    api.analytics.kpis(),
    api.analytics.fleet(),
    api.analytics.trends(8),
    api.trips.live(),
    api.drivers.list({ page_size: 200 }),
  ]);
  return { kpis, fleet, trends, liveTrips, drivers: driversPage.items };
}

export default function AnalyticsPage() {
  const { data, loading, error, reload } = useFetch(loadAnalytics, []);

  const avgUtilization = useMemo(() => {
    if (!data?.fleet.length) return 0;
    return Math.round(data.fleet.reduce((s, f) => s + f.utilization_pct, 0) / data.fleet.length);
  }, [data]);

  const avgHealth = useMemo(() => {
    if (!data?.fleet.length) return 0;
    return Math.round(data.fleet.reduce((s, f) => s + f.health_score, 0) / data.fleet.length);
  }, [data]);

  const utilizationRows = useMemo(
    () => (data ? [...data.fleet].sort((a, b) => b.utilization_pct - a.utilization_pct) : []),
    [data]
  );

  const buckets = useMemo(() => {
    const scores = (data?.fleet ?? []).map((f) => f.health_score);
    return [
      { label: "Critical (0–45)", cls: "b-critical", count: scores.filter((s) => s <= 45).length },
      { label: "Watch (46–75)", cls: "b-medium", count: scores.filter((s) => s > 45 && s <= 75).length },
      { label: "Healthy (76–100)", cls: "b-good", count: scores.filter((s) => s > 75).length },
    ];
  }, [data]);
  const maxBucket = Math.max(...buckets.map((b) => b.count), 1);

  const leaderboard = useMemo(
    () => (data ? [...data.drivers].sort((a, b) => b.safety_score - a.safety_score) : []),
    [data]
  );

  const fuelTrend = useMemo(
    () =>
      (data?.trends.weekly ?? []).map((w) => ({
        label: new Date(w.period).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        value: w.fuel_cost,
      })),
    [data]
  );

  if (loading) {
    return (
      <AppShell eyebrow="Insights" title="Fleet Map & Analytics">
        <LoadingBlock label="Loading analytics…" />
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell eyebrow="Insights" title="Fleet Map & Analytics">
        <ErrorBlock message={error ?? "Failed to load analytics"} onRetry={reload} />
      </AppShell>
    );
  }

  return (
    <AppShell
      eyebrow="Insights"
      title="Fleet Map & Analytics"
      actions={
        <>
          <a className="btn btn-outline-muted btn-sm" href={api.analytics.exportCsvUrl("fleet")}>
            Export Fleet CSV
          </a>
          <a className="btn btn-outline-muted btn-sm" href={api.analytics.exportCsvUrl("trips")}>
            Export Trips CSV
          </a>
          <a className="btn btn-outline-muted btn-sm" href={api.analytics.exportCsvUrl("expenses")}>
            Export Expenses CSV
          </a>
        </>
      }
    >
      <KpiGrid
        cells={[
          { label: "Total Revenue", value: fmtMoney(data.kpis.total_revenue), primary: true },
          { label: "Avg Utilization", value: `${avgUtilization}%` },
          { label: "Avg Fleet Health", value: avgHealth },
          { label: "Active Routes", value: data.liveTrips.length, primary: true },
        ]}
      />

      <div className="panel map-panel mb-md">
        <div className="panel-header">
          <div>
            <h2 className="text-title-md" style={{ margin: 0 }}>
              Live Fleet Map
            </h2>
            <p className="text-body-sm u-muted" style={{ margin: "4px 0 0" }}>
              Dispatched trips in transit, interpolated along their route
            </p>
          </div>
        </div>
        {data.liveTrips.length === 0 ? (
          <EmptyBlock label="No trips are currently dispatched." />
        ) : (
          <>
            <FleetMap trips={data.liveTrips} />
            <div className="map-legend">
              <div className="legend-item">
                <span className="legend-dot" style={{ background: "var(--color-primary)" }} />
                <span className="text-caption u-muted-soft">Vehicle on trip</span>
              </div>
              <div className="legend-item">
                <span style={{ width: 16, borderTop: "2px dashed var(--color-primary)", display: "inline-block" }} />
                <span className="text-caption u-muted-soft">Active trip route</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="panel mb-md">
        <div className="panel-header">
          <div>
            <h2 className="text-title-md" style={{ margin: 0 }}>
              Weekly Fuel Cost Trend
            </h2>
            <p className="text-body-sm u-muted" style={{ margin: "4px 0 0" }}>
              Fleet-wide fuel spend, last 8 weeks
            </p>
          </div>
        </div>
        <div className="panel-body">
          {fuelTrend.length === 0 ? <EmptyBlock label="No fuel logs in this window." /> : <TrendChart data={fuelTrend} />}
        </div>
      </div>

      <div className="grid-2col-even mb-md">
        <div className="panel">
          <div className="panel-header">
            <h2 className="text-title-md" style={{ margin: 0 }}>
              Fleet Utilization
            </h2>
          </div>
          <div className="panel-body">
            {utilizationRows.length === 0 ? (
              <EmptyBlock label="No vehicles yet." />
            ) : (
              utilizationRows.map((f) => (
                <div className="health-row" key={f.vehicle_id}>
                  <div className="health-meta">
                    <div className="text-body-sm cell-strong">{f.registration_number}</div>
                  </div>
                  <Meter
                    value={f.utilization_pct}
                    className="w-[140px]"
                    fillClassName={f.utilization_pct >= 60 ? "is-success" : f.utilization_pct >= 30 ? "" : "is-warning"}
                  />
                  <div className="health-score text-title-sm">{f.utilization_pct}%</div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">
            <h2 className="text-title-md" style={{ margin: 0 }}>
              Health Score Distribution
            </h2>
          </div>
          <div className="panel-body">
            <div className="bucket-chart">
              {buckets.map((b) => (
                <div className="bucket-col" key={b.label}>
                  <div className="bucket-count text-title-sm">{b.count}</div>
                  <div className={`bucket-bar ${b.cls}`} style={{ height: `${(b.count / maxBucket) * 100}%` }} />
                  <div className="bucket-label text-caption">{b.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="text-title-md" style={{ margin: 0 }}>
            Driver Safety Score Leaderboard
          </h2>
        </div>
        <div className="panel-body">
          {leaderboard.length === 0 ? (
            <EmptyBlock label="No drivers yet." />
          ) : (
            leaderboard.map((d, i) => (
              <div className="leaderboard-row" key={d.id}>
                <div className="leaderboard-rank text-body-sm">#{i + 1}</div>
                <div className="leaderboard-name text-body-sm cell-strong">{d.name}</div>
                <Meter value={d.safety_score} fillClassName={d.safety_score >= 80 ? "is-success" : d.safety_score >= 60 ? "" : "is-warning"} />
                <div className="leaderboard-value text-body-sm">{ratingFromSafetyScore(d.safety_score).toFixed(1)} ★</div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
