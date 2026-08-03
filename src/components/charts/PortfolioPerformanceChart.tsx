"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AreaSeries, ColorType, CrosshairMode, LineSeries, LineStyle, createChart, type BusinessDay, type Time } from "lightweight-charts";
import type { PortfolioPoint } from "@/src/domain/portfolio";

export function PortfolioPerformanceChart({ points, benchmark }: { points: PortfolioPoint[]; benchmark: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ date: string; portfolio: number | null; benchmark: number | null } | null>(null);
  const [theme, setTheme] = useState("light");
  const normalized = useMemo(() => normalize(points), [points]);
  const active = hover ?? normalized.at(-1) ?? { date: "", portfolio: null, benchmark: null };

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setTheme(root.dataset.theme ?? "light");
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || normalized.length < 2) return;
    host.replaceChildren();
    const dark = theme === "dark";
    const chart = createChart(host, {
      width: Math.max(1, host.clientWidth), height: 360,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: dark ? "#aab7b5" : "#68767b", fontFamily: "var(--font-geist-mono), ui-monospace, monospace", fontSize: 11 },
      grid: { vertLines: { color: dark ? "rgba(255,255,255,.045)" : "rgba(16,32,41,.055)" }, horzLines: { color: dark ? "rgba(255,255,255,.06)" : "rgba(16,32,41,.07)" } },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: "#ef6c50", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#ef6c50" }, horzLine: { color: "#1b6f74", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1b6f74" } },
      rightPriceScale: { borderColor: dark ? "#314247" : "#d9d8d1" },
      timeScale: { borderColor: dark ? "#314247" : "#d9d8d1", fixLeftEdge: true, rightOffset: 3, minBarSpacing: 1.2 },
      localization: { priceFormatter: (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%` },
      handleScale: true, handleScroll: true,
    });
    const portfolioSeries = chart.addSeries(AreaSeries, { lineColor: "#ef6c50", topColor: "rgba(239,108,80,.28)", bottomColor: "rgba(239,108,80,.015)", lineWidth: 3, priceLineVisible: false });
    const benchmarkSeries = chart.addSeries(LineSeries, { color: "#1b9b91", lineWidth: 2, lineStyle: LineStyle.Dashed, priceLineVisible: false });
    portfolioSeries.setData(normalized.map((point) => ({ time: point.date as Time, value: point.portfolio })));
    benchmarkSeries.setData(normalized.map((point) => ({ time: point.date as Time, value: point.benchmark })));
    const byDate = new Map(normalized.map((point) => [point.date, point]));
    chart.subscribeCrosshairMove((parameter) => {
      if (!parameter.time || !parameter.point || parameter.point.x < 0 || parameter.point.y < 0) { setHover(null); return; }
      const point = byDate.get(timeKey(parameter.time));
      if (point) setHover(point);
    });
    chart.timeScale().fitContent();
    const resize = new ResizeObserver(([entry]) => chart.applyOptions({ width: Math.max(1, Math.floor(entry.contentRect.width)) }));
    resize.observe(host);
    return () => { resize.disconnect(); chart.remove(); };
  }, [normalized, theme]);

  if (normalized.length < 2) return <div className="chart-empty"><b>Not enough history yet</b><span>Import dated transactions with supported tickers to build the comparison.</span></div>;
  const lead = active.portfolio != null && active.benchmark != null ? active.portfolio - active.benchmark : null;
  return <div className="comparison-chart">
    <div className="portfolio-chart-live" aria-live="polite">
      <span>{active.date ? formatDate(active.date) : "Performance"}</span>
      <b><i className="legend-dot legend-dot--portfolio" />Portfolio {formatReturn(active.portfolio)}</b>
      <b><i className="legend-dot legend-dot--benchmark" />{benchmark} {formatReturn(active.benchmark)}</b>
      {lead != null && <small className={lead >= 0 ? "positive" : "negative"}>{lead >= 0 ? "Ahead" : "Behind"} by {Math.abs(lead).toFixed(1)} pts</small>}
    </div>
    <div ref={hostRef} className="chart-stage" role="img" aria-label={`Interactive cash-flow-matched portfolio return compared with ${benchmark}. Move the pointer for exact values.`} />
    <div className="chart-help"><span>Each deposit is invested into the benchmark on the same date</span><small>Move to inspect · drag to pan · scroll to zoom</small></div>
  </div>;
}

function normalize(points: PortfolioPoint[]) {
  const basePortfolio = points.find((point) => point.portfolio > 0)?.portfolio ?? 1;
  const baseBenchmark = points.find((point) => point.benchmark > 0)?.benchmark ?? 1;
  return points.map((point) => ({ date: point.date, portfolio: ((point.portfolio / basePortfolio) - 1) * 100, benchmark: ((point.benchmark / baseBenchmark) - 1) * 100 }));
}

function timeKey(time: Time) {
  if (typeof time === "string") return time;
  if (typeof time === "number") return new Date(time * 1000).toISOString().slice(0, 10);
  const day = time as BusinessDay;
  return `${day.year}-${String(day.month).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
}

function formatReturn(value: number | null) { return value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
