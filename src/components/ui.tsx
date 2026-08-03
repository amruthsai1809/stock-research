"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { PricePoint } from "@/src/domain/stock";
import { formatPercent } from "@/src/domain/analytics";

export function StockMark({ symbol, size = "md" }: { symbol: string; size?: "sm" | "md" | "lg" }) {
  const hue = [...symbol].reduce((total, character) => total + character.charCodeAt(0), 0) % 360;
  return (
    <span
      className={`stock-mark stock-mark--${size}`}
      style={{ "--mark-hue": hue } as React.CSSProperties}
      aria-hidden="true"
    >
      {symbol.slice(0, 2)}
    </span>
  );
}

export function Change({ value, suffix = "" }: { value: number | null | undefined; suffix?: string }) {
  if (value == null || !Number.isFinite(value)) return <span className="muted">—</span>;
  return <span className={value >= 0 ? "positive" : "negative"}>{formatPercent(value)}{suffix}</span>;
}

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" | "blue" }) {
  return <span className={`tag tag--${tone}`}>{children}</span>;
}

export function ScoreDial({ value, label, tone = "coral" }: { value: number; label: string; tone?: "coral" | "green" | "blue" }) {
  return (
    <div className={`score-dial score-dial--${tone}`} style={{ "--score": `${value * 3.6}deg` } as React.CSSProperties}>
      <div className="score-dial__inside">
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  accent?: "coral" | "green" | "blue";
}) {
  return (
    <article className={`metric-card ${accent ? `metric-card--${accent}` : ""}`}>
      <span className="eyebrow">{label}</span>
      <strong className="metric-card__value">{value}</strong>
      {detail && <span className="metric-card__detail">{detail}</span>}
    </article>
  );
}

type Series = { values: number[]; color: string; label?: string };

export function LineChart({
  series,
  labels,
  height = 240,
  compact = false,
  ariaLabel,
}: {
  series: Series[];
  labels?: string[];
  height?: number;
  compact?: boolean;
  ariaLabel: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const draw = () => {
      const width = Math.max(1, Math.floor(canvas.getBoundingClientRect().width || parent.clientWidth));
      const ratio = window.devicePixelRatio || 1;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = "100%";
      canvas.style.height = `${height}px`;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.scale(ratio, ratio);
      context.clearRect(0, 0, width, height);

      const allValues = series.flatMap((item) => item.values).filter(Number.isFinite);
      if (!allValues.length) return;
      const minimum = Math.min(...allValues);
      const maximum = Math.max(...allValues);
      const span = maximum - minimum || 1;
      const left = compact ? 1 : 10;
      const right = compact ? 1 : 10;
      const top = compact ? 4 : 16;
      const bottom = compact ? 4 : 28;
      const chartWidth = width - left - right;
      const chartHeight = height - top - bottom;

      if (!compact) {
        context.strokeStyle = "rgba(17, 30, 38, 0.09)";
        context.lineWidth = 1;
        for (let index = 0; index < 4; index += 1) {
          const y = top + (chartHeight / 3) * index;
          context.beginPath();
          context.moveTo(left, y);
          context.lineTo(width - right, y);
          context.stroke();
        }
      }

      series.forEach((item, seriesIndex) => {
        const points = item.values.map((value, index) => ({
          x: left + (index / Math.max(1, item.values.length - 1)) * chartWidth,
          y: top + (1 - (value - minimum) / span) * chartHeight,
        }));
        if (seriesIndex === 0 && !compact && points.length > 1) {
          const gradient = context.createLinearGradient(0, top, 0, height - bottom);
          gradient.addColorStop(0, `${item.color}33`);
          gradient.addColorStop(1, `${item.color}00`);
          context.beginPath();
          context.moveTo(points[0].x, height - bottom);
          points.forEach((point) => context.lineTo(point.x, point.y));
          context.lineTo(points.at(-1)?.x ?? left, height - bottom);
          context.closePath();
          context.fillStyle = gradient;
          context.fill();
        }
        context.beginPath();
        points.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
        context.strokeStyle = item.color;
        context.lineWidth = compact ? 2 : seriesIndex === 0 ? 2.5 : 1.5;
        context.lineJoin = "round";
        context.lineCap = "round";
        if (seriesIndex > 0) context.setLineDash([5, 5]);
        context.stroke();
        context.setLineDash([]);
      });

      if (!compact && labels?.length) {
        context.fillStyle = "rgba(17, 30, 38, .48)";
        context.font = "11px var(--font-geist-mono), monospace";
        labels.forEach((label, index) => {
          const x = left + (index / Math.max(1, labels.length - 1)) * chartWidth;
          context.textAlign = index === 0 ? "left" : index === labels.length - 1 ? "right" : "center";
          context.fillText(label, x, height - 7);
        });
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [height, labels, series, compact]);

  return <canvas ref={canvasRef} role="img" aria-label={ariaLabel} className="line-chart" />;
}

export function PriceChart({ prices, height = 250, years = 1 }: { prices: PricePoint[]; height?: number; years?: 1 | 3 | 5 }) {
  const windowed = prices.slice(-(252 * years));
  const sampled = windowed.filter((_, index, source) => index % Math.max(1, Math.floor(source.length / 120)) === 0 || index === source.length - 1);
  const closes = sampled.map((point) => point.adjustedClose);
  const average50 = sampled.map((_, index) => {
    const start = Math.max(0, index - 12);
    const group = closes.slice(start, index + 1);
    return group.reduce((total, value) => total + value, 0) / group.length;
  });
  const labels = [sampled[0]?.date.slice(5), sampled[Math.floor(sampled.length / 2)]?.date.slice(5), sampled.at(-1)?.date.slice(5)].filter(Boolean) as string[];
  return (
    <LineChart
      series={[
        { values: closes, color: "#ef6c50", label: "Adjusted close" },
        { values: average50, color: "#1b6f74", label: "Trend" },
      ]}
      labels={labels}
      height={height}
      ariaLabel={`${years}-year adjusted closing price with smoothed trend`}
    />
  );
}

export function EmptyValue({ children = "Not reported" }: { children?: ReactNode }) {
  return <span className="empty-value">{children}</span>;
}
