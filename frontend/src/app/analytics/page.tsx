"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { KpiGrid } from "@/components/ui/kpi-grid";
import { Meter } from "@/components/ui/meter";
import { LoadingBlock, ErrorBlock, EmptyBlock } from "@/components/ui/async-state";
import { FleetMap } from "@/components/fleet-map";
import { TrendChart } from "@/components/revenue-trend-chart";
import { api, type FleetRow, type DriverOut } from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import { fmtMoney, ratingFromSafetyScore, initials } from "@/lib/format";

const AUTO_REFRESH_MS = 30_000;
const SPOTLIGHT_COUNT = 5;
const SPOTLIGHT_SPLIT_THRESHOLD = SPOTLIGHT_COUNT * 2;

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

/** "YYYY-MM-DD" → "11 May", parsed from the string directly rather than via `new Date(...)`
 * (which reads UTC midnight back in the browser's local timezone and can shift the displayed
 * day by ±1 depending on the viewer's offset). */
function formatWeekLabel(period: string): string {
  const [year, month, day] = period.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default function AnalyticsPage() {
  const { data, loading, error, reload } = useFetch(loadAnalytics, []);

  // The trip simulator keeps advancing trips and generating fuel logs in the background, so
  // this page's data goes stale within seconds of loading — keep it live without a manual
  // reload. The interval's own callback does the setState (via reload), not the effect body
  // itself, so this doesn't trip react-hooks/set-state-in-effect.
  useEffect(() => {
    const interval = setInterval(reload, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const splitUtilization = utilizationRows.length > SPOTLIGHT_SPLIT_THRESHOLD;
  const topUtilization = splitUtilization ? utilizationRows.slice(0, SPOTLIGHT_COUNT) : utilizationRows;
  const bottomUtilization = splitUtilization ? utilizationRows.slice(-SPOTLIGHT_COUNT) : [];

  const buckets = useMemo(() => {
    const scores = (data?.fleet ?? []).map((f) => f.health_score);
    return [
      { key: "good", label: "Healthy", range: "76–100", cls: "b-good", count: scores.filter((s) => s > 75).length },
      { key: "medium", label: "Watch", range: "46–75", cls: "b-medium", count: scores.filter((s) => s > 45 && s <= 75).length },
      { key: "critical", label: "Critical", range: "0–45", cls: "b-critical", count: scores.filter((s) => s <= 45).length },
    ];
  }, [data]);
  const totalHealthScored = buckets.reduce((s, b) => s + b.count, 0);

  const leaderboard = useMemo(
    () => (data ? [...data.drivers].sort((a, b) => b.safety_score - a.safety_score) : []),
    [data]
  );
  const splitLeaderboard = leaderboard.length > SPOTLIGHT_SPLIT_THRESHOLD;
  const topDrivers = splitLeaderboard ? leaderboard.slice(0, SPOTLIGHT_COUNT) : leaderboard;
  const bottomDrivers = splitLeaderboard ? leaderboard.slice(-SPOTLIGHT_COUNT) : [];

  const fuelTrend = useMemo(
    () => (data?.trends.weekly ?? []).map((w) => ({ label: formatWeekLabel(w.period), value: w.fuel_cost })),
    [data]
  );

  function utilizationRow(f: FleetRow) {
    return (
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
    );
  }

  function leaderboardRow(d: DriverOut, rank: number) {
    const scoreClass = d.safety_score >= 80 ? "is-success" : d.safety_score >= 60 ? "" : "is-warning";
    const scoreColor = scoreClass === "is-success" ? "u-success" : scoreClass === "is-warning" ? "u-warning" : "";
    return (
      <div className="leaderboard-row" key={d.id}>
        <div className={`leaderboard-rank ${rank === 1 ? "is-first" : rank <= 3 ? "is-top" : ""}`}>{rank}</div>
        <div className="leaderboard-avatar">{initials(d.name)}</div>
        <div className="leaderboard-name">
          <div className="text-body-sm cell-strong">{d.name}</div>
          <div className="text-caption u-muted-soft">{d.license_category} License</div>
        </div>
        <Meter value={d.safety_score} className="leaderboard-meter" fillClassName={scoreClass} />
        <div className="leaderboard-value">
          <div className={`text-title-sm ${scoreColor}`}>{d.safety_score}</div>
          <div className="text-caption u-muted-soft">{ratingFromSafetyScore(d.safety_score).toFixed(1)} ★</div>
        </div>
      </div>
    );
  }

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
    <AppShell eyebrow="Insights" title="Fleet Map & Analytics">
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
              Fleet-wide fuel spend, last 8 weeks · auto-refreshes every 30s
            </p>
          </div>
          <button className="btn-text text-body-sm" onClick={reload}>
            Refresh now
          </button>
        </div>
        <div className="panel-body">
          {fuelTrend.length === 0 ? (
            <EmptyBlock label="No fuel logs in this window." />
          ) : (
            <>
              <TrendChart data={fuelTrend} />
              <p className="text-body-sm u-muted-soft" style={{ margin: "var(--space-xs) 0 0" }}>
                CO₂ output: {data.trends.co2_total_kg.toLocaleString("en-IN")} kg
                {data.trends.co2_saved_kg > 0
                  ? ` · ${data.trends.co2_saved_kg.toLocaleString("en-IN")} kg saved vs. a 6 km/l baseline fleet`
                  : ""}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="grid-2col-even mb-md">
        <div className="panel">
          <div className="panel-header">
            <h2 className="text-title-md" style={{ margin: 0 }}>
              Fleet Utilization
            </h2>
            <Link href="/vehicles" className="btn-text text-body-sm">
              View all vehicles →
            </Link>
          </div>
          <div className="panel-body">
            {utilizationRows.length === 0 ? (
              <EmptyBlock label="No vehicles yet." />
            ) : (
              <>
                {splitUtilization && (
                  <div className="text-caption-uppercase u-muted-soft" style={{ marginBottom: "var(--space-xxs)" }}>
                    Most utilized
                  </div>
                )}
                {topUtilization.map(utilizationRow)}
                {splitUtilization && (
                  <>
                    <div
                      className="text-caption-uppercase u-muted-soft"
                      style={{ margin: "var(--space-xs) 0 var(--space-xxs)" }}
                    >
                      Least utilized
                    </div>
                    {bottomUtilization.map(utilizationRow)}
                  </>
                )}
              </>
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
            {totalHealthScored === 0 ? (
              <EmptyBlock label="No vehicles yet." />
            ) : (
              <>
                <div className="dist-bar">
                  {buckets
                    .filter((b) => b.count > 0)
                    .map((b) => (
                      <div
                        key={b.key}
                        className={`dist-segment ${b.cls}`}
                        style={{ flexBasis: `${(b.count / totalHealthScored) * 100}%` }}
                        title={`${b.label} (${b.range}): ${b.count} vehicle(s)`}
                      />
                    ))}
                </div>
                <div className="dist-legend">
                  {buckets.map((b) => (
                    <div className="dist-legend-item" key={b.key}>
                      <span className={`dist-dot ${b.cls}`} />
                      <span className="text-body-sm cell-strong">{b.label}</span>
                      <span className="text-body-sm u-muted-soft">
                        {b.count} · {Math.round((b.count / totalHealthScored) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="text-title-md" style={{ margin: 0 }}>
            Driver Safety Score Leaderboard
          </h2>
          <Link href="/drivers" className="btn-text text-body-sm">
            View all drivers →
          </Link>
        </div>
        <div className="panel-body">
          {leaderboard.length === 0 ? (
            <EmptyBlock label="No drivers yet." />
          ) : (
            <>
              {splitLeaderboard && (
                <div className="text-caption-uppercase u-muted-soft" style={{ marginBottom: "var(--space-xxs)" }}>
                  Top performers
                </div>
              )}
              {topDrivers.map((d, i) => leaderboardRow(d, i + 1))}
              {splitLeaderboard && (
                <>
                  <div
                    className="text-caption-uppercase u-muted-soft"
                    style={{ margin: "var(--space-xs) 0 var(--space-xxs)" }}
                  >
                    Needs coaching
                  </div>
                  {bottomDrivers.map((d, i) => leaderboardRow(d, leaderboard.length - SPOTLIGHT_COUNT + i + 1))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
