export interface KpiCell {
  label: string;
  value: string | number;
  sub?: string;
  primary?: boolean;
}

export function KpiGrid({ cells }: { cells: KpiCell[] }) {
  return (
    <div className="kpi-grid">
      {cells.map((c) => (
        <div className="kpi-cell" key={c.label}>
          <div className="kpi-label text-caption-uppercase">
            <span>{c.label}</span>
          </div>
          <div className={`kpi-value text-number-display ${c.primary ? "is-primary" : ""}`}>{c.value}</div>
          {c.sub ? <div className="kpi-trend u-muted-soft">{c.sub}</div> : null}
        </div>
      ))}
    </div>
  );
}
