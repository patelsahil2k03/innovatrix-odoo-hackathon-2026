import { AppShell } from "@/components/shell/app-shell";
import { KpiGrid } from "@/components/ui/kpi-grid";
import { Meter } from "@/components/ui/meter";
import { FleetMap } from "@/components/fleet-map";
import { RevenueTrendChart } from "@/components/revenue-trend-chart";
import {
  vehicles,
  drivers,
  driverPerformance,
  vehicleAnalytics,
  vehicleHealth,
  trips,
  revenueTrend,
  fmtMoney,
} from "@/lib/mock-data";

export default function AnalyticsPage() {
  const revenue7d = revenueTrend.reduce((s, d) => s + d.revenue, 0);
  const analyticsValues = Object.values(vehicleAnalytics);
  const avgUtilization = Math.round(analyticsValues.reduce((s, a) => s + a.utilization_percent, 0) / analyticsValues.length);
  const healthValues = Object.values(vehicleHealth);
  const avgHealth = Math.round(healthValues.reduce((s, h) => s + h.health_score, 0) / healthValues.length);
  const activeRoutes = trips.filter((t) => t.status === "in_transit" || t.status === "dispatched").length;

  const utilizationRows = vehicles
    .map((v) => ({ v, analytics: vehicleAnalytics[v.id] }))
    .sort((a, b) => b.analytics.utilization_percent - a.analytics.utilization_percent);

  const scores = healthValues.map((h) => h.health_score);
  const buckets = [
    { label: "Critical (0–45)", cls: "b-critical", count: scores.filter((s) => s <= 45).length },
    { label: "Watch (46–75)", cls: "b-medium", count: scores.filter((s) => s > 45 && s <= 75).length },
    { label: "Healthy (76–100)", cls: "b-good", count: scores.filter((s) => s > 75).length },
  ];
  const maxBucket = Math.max(...buckets.map((b) => b.count), 1);

  const leaderboard = drivers
    .map((d) => ({ d, perf: driverPerformance[d.id] }))
    .sort((a, b) => b.perf.rating - a.perf.rating);

  return (
    <AppShell
      eyebrow="Insights"
      title="Fleet Map & Analytics"
      actions={
        <button className="icon-btn" aria-label="Notifications">
          <svg className="icon" viewBox="0 0 24 24">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
          <span className="dot" />
        </button>
      }
    >
      <KpiGrid
        cells={[
          { label: "Revenue (7d)", value: fmtMoney(revenue7d), primary: true },
          { label: "Avg Utilization", value: `${avgUtilization}%` },
          { label: "Avg Fleet Health", value: avgHealth },
          { label: "Active Routes", value: activeRoutes, primary: true },
        ]}
      />

      <div className="panel map-panel mb-md">
        <div className="panel-header">
          <div>
            <h2 className="text-title-md" style={{ margin: 0 }}>
              Live Fleet Map
            </h2>
            <p className="text-body-sm u-muted" style={{ margin: "4px 0 0" }}>
              Vehicle locations by region, with active trip routes
            </p>
          </div>
        </div>
        <FleetMap />
        <div className="map-legend">
          <div className="legend-item">
            <span className="legend-dot" style={{ background: "var(--color-success)" }} />
            <span className="text-caption u-muted-soft">Active</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: "var(--color-warning)" }} />
            <span className="text-caption u-muted-soft">Maintenance</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: "var(--color-muted-soft)" }} />
            <span className="text-caption u-muted-soft">Idle</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: "var(--color-muted)" }} />
            <span className="text-caption u-muted-soft">Retired</span>
          </div>
          <div className="legend-item">
            <span style={{ width: 16, borderTop: "2px dashed var(--color-primary)", display: "inline-block" }} />
            <span className="text-caption u-muted-soft">Active trip route</span>
          </div>
        </div>
      </div>

      <div className="panel mb-md">
        <div className="panel-header">
          <div>
            <h2 className="text-title-md" style={{ margin: 0 }}>
              Revenue Trend
            </h2>
            <p className="text-body-sm u-muted" style={{ margin: "4px 0 0" }}>
              Fleet-wide revenue, last 7 days
            </p>
          </div>
        </div>
        <div className="panel-body">
          <RevenueTrendChart />
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
            {utilizationRows.map(({ v, analytics }) => (
              <div className="health-row" key={v.id}>
                <div className="health-meta">
                  <div className="text-body-sm cell-strong">{v.registration_number}</div>
                </div>
                <Meter
                  value={analytics.utilization_percent}
                  className="w-[140px]"
                  fillClassName={analytics.utilization_percent >= 60 ? "is-success" : analytics.utilization_percent >= 30 ? "" : "is-warning"}
                />
                <div className="health-score text-title-sm">{analytics.utilization_percent}%</div>
              </div>
            ))}
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
            Driver Rating Leaderboard
          </h2>
        </div>
        <div className="panel-body">
          {leaderboard.map(({ d, perf }, i) => (
            <div className="leaderboard-row" key={d.id}>
              <div className="leaderboard-rank text-body-sm">#{i + 1}</div>
              <div className="leaderboard-name text-body-sm cell-strong">{d.name}</div>
              <Meter value={(perf.rating / 5) * 100} fillClassName={perf.rating >= 4 ? "is-success" : perf.rating >= 3 ? "" : "is-warning"} />
              <div className="leaderboard-value text-body-sm">{perf.rating.toFixed(1)} ★</div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
