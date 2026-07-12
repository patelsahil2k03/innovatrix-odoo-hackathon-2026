export interface TrendChartPoint {
  label: string;
  value: number;
}

export function TrendChart({ data }: { data: TrendChartPoint[] }) {
  const w = 640;
  const h = 200;
  const padX = 24;
  const padBottom = 26;
  const padTop = 14;

  const max = Math.max(...data.map((d) => d.value), 1) * 1.15;
  const stepX = data.length > 1 ? (w - padX * 2) / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = padX + i * stepX;
    const y = padTop + (1 - d.value / max) * (h - padBottom - padTop);
    return [x, y] as const;
  });

  const linePath = points.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L${points[points.length - 1][0].toFixed(1)},${h - padBottom} L${points[0][0].toFixed(1)},${h - padBottom} Z`
      : "";

  const gridLines = [0, 1, 2, 3].map((i) => padTop + i * ((h - padBottom - padTop) / 3));

  return (
    <svg id="revenue-trend-chart" className="trend-chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#024ad8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#024ad8" stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridLines.map((y, i) => (
        <line key={i} className="grid-line" x1={padX} y1={y.toFixed(1)} x2={w - padX} y2={y.toFixed(1)} />
      ))}
      <path className="area-fill" d={areaPath} />
      <path className="trend-line" d={linePath} />
      {points.map((p, i) => (
        <circle key={i} className="trend-dot" cx={p[0].toFixed(1)} cy={p[1].toFixed(1)} r={3.5} />
      ))}
      {data.map((d, i) => {
        const x = padX + i * stepX;
        return (
          <text key={d.label} className="axis-label" x={x} y={h - 6} textAnchor="middle">
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
