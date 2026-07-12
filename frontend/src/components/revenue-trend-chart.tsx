"use client";

import { useEffect, useRef, useState } from "react";

export interface TrendChartPoint {
  label: string;
  value: number;
}

const HEIGHT = 200;
const PAD_X = 40;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const TICK_COUNT = 4;

/** Rounds up to a "nice" step so axis ticks read as ₹40k, ₹50k… instead of arbitrary fractions
 * of the max data point. Uses a denser 1/2/2.5/5/10 progression (rather than plain 1/2/5/10) so
 * a peak just past a step boundary — e.g. 2.1x the magnitude — doesn't jump all the way to 5x
 * and leave most of the chart empty. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function compactMoney(n: number): string {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(n % 100_000 === 0 ? 0 : 1)}L`;
  if (n >= 1_000) return `₹${Math.round(n / 1_000)}k`;
  return `₹${Math.round(n)}`;
}

export function TrendChart({ data }: { data: TrendChartPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  // SVG has no intrinsic width, so it's measured from the container and drawn 1:1 in pixels —
  // this used to hardcode viewBox="0 0 640 200" with preserveAspectRatio="none", which stretched
  // the coordinate space non-uniformly on any panel wider than 640px (circles became ellipses,
  // stroke width looked uneven, axis text looked squashed/stretched).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const max = niceMax(Math.max(...data.map((d) => d.value), 1) * 1.1);
  const plotW = Math.max(width - PAD_X * 2, 0);
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const stepX = data.length > 1 ? plotW / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = PAD_X + i * stepX;
    const y = PAD_TOP + (1 - d.value / max) * plotH;
    return [x, y] as const;
  });

  const linePath = points.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L${points[points.length - 1][0].toFixed(1)},${HEIGHT - PAD_BOTTOM} L${points[0][0].toFixed(1)},${HEIGHT - PAD_BOTTOM} Z`
      : "";

  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => ({
    value: (max / TICK_COUNT) * (TICK_COUNT - i),
    y: PAD_TOP + (i / TICK_COUNT) * plotH,
  }));

  return (
    <div className="trend-chart" ref={containerRef}>
      {width > 0 && (
        <svg id="revenue-trend-chart" width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`}>
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#024ad8" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#024ad8" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t, i) => (
            <g key={i}>
              <line className="grid-line" x1={PAD_X} y1={t.y.toFixed(1)} x2={width - PAD_X} y2={t.y.toFixed(1)} />
              <text className="axis-value-label" x={PAD_X - 8} y={t.y + 3} textAnchor="end">
                {compactMoney(t.value)}
              </text>
            </g>
          ))}
          <path className="area-fill" d={areaPath} />
          <path className="trend-line" d={linePath} />
          {points.map((p, i) => (
            <circle key={i} className="trend-dot" cx={p[0].toFixed(1)} cy={p[1].toFixed(1)} r={3.5} />
          ))}
          {data.map((d, i) => {
            const x = PAD_X + i * stepX;
            return (
              <text key={d.label} className="axis-label" x={x} y={HEIGHT - 6} textAnchor="middle">
                {d.label}
              </text>
            );
          })}
        </svg>
      )}
    </div>
  );
}
