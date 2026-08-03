"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AreaSeries, ColorType, CrosshairMode, LineStyle, createChart, type Time } from "lightweight-charts";
import type { PositionHistoryPoint } from "@/src/domain/institutional";

type Metric = "shares" | "weight";

export function PositionHistoryChart({ points, symbol }: { points: PositionHistoryPoint[]; symbol: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [metric, setMetric] = useState<Metric>("shares");
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [theme, setTheme] = useState("light");
  const usable = useMemo(() => points.filter((point) => point[metric] != null), [metric, points]);
  const active = points.find((point) => point.reportDate === hoveredDate) ?? usable.at(-1) ?? null;

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
    if (!host || !usable.length) return;
    host.replaceChildren();
    const dark = theme === "dark";
    const chart = createChart(host, {
      height: 215,
      width: Math.max(1, host.clientWidth),
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: dark ? "#aab7b5" : "#68767b",
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: dark ? "rgba(255,255,255,.04)" : "rgba(16,32,41,.05)" },
        horzLines: { color: dark ? "rgba(255,255,255,.05)" : "rgba(16,32,41,.065)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#ef6c50", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#ef6c50" },
        horzLine: { color: "#6f7d81", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1b6f74" },
      },
      rightPriceScale: { borderColor: dark ? "#314247" : "#d9d8d1", scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderColor: dark ? "#314247" : "#d9d8d1", rightOffset: 1, barSpacing: 22, fixLeftEdge: true, fixRightEdge: true },
      handleScroll: true,
      handleScale: true,
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: "#ef6c50",
      topColor: dark ? "rgba(239,108,80,.35)" : "rgba(239,108,80,.28)",
      bottomColor: "rgba(239,108,80,0)",
      lineWidth: 2,
      priceFormat: metric === "weight" ? { type: "custom", formatter: (value: number) => `${value.toFixed(1)}%` } : { type: "volume" },
    });
    const data = usable.map((point) => ({ time: point.reportDate as Time, value: point[metric] as number }));
    series.setData(data);
    const pointByDate = new Map(points.map((point) => [point.reportDate, point]));
    chart.subscribeCrosshairMove((parameter) => {
      if (!parameter.time || !parameter.point || parameter.point.x < 0 || parameter.point.y < 0) setHoveredDate(null);
      else setHoveredDate(pointByDate.get(timeKey(parameter.time))?.reportDate ?? null);
    });
    chart.timeScale().setVisibleRange({ from: data[0].time, to: data.at(-1)!.time });
    const resize = new ResizeObserver(([entry]) => chart.applyOptions({ width: Math.max(1, Math.floor(entry.contentRect.width)) }));
    resize.observe(host);
    return () => { resize.disconnect(); chart.remove(); };
  }, [metric, points, theme, usable]);

  return <div className="position-history-chart">
    <div className="position-history-chart__head">
      <div><span>{active ? formatQuarter(active.reportDate) : "No position data"}</span><strong>{active ? metric === "weight" ? `${(active.weight ?? 0).toFixed(2)}%` : compactNumber(active.shares ?? 0) : "-"}</strong><small>{active ? `${statusLabel(active.status)} · filed ${shortDate(active.filedDate)}` : ""}</small></div>
      <div className="view-switch" aria-label={`${symbol} position metric`}><button className={metric === "shares" ? "is-active" : ""} onClick={() => { setHoveredDate(null); setMetric("shares"); }}>Shares</button><button className={metric === "weight" ? "is-active" : ""} onClick={() => { setHoveredDate(null); setMetric("weight"); }}>Weight</button></div>
    </div>
    <div ref={hostRef} className="chart-stage" aria-label={`${symbol} reported position history; hover for quarter details`} />
    <div className="chart-help"><span><i className="crosshair-icon" />Hover for the exact quarter and filing date</span><span>{formatQuarter(usable[0]?.reportDate)} – {formatQuarter(usable.at(-1)?.reportDate)}</span></div>
  </div>;
}

function timeKey(time: Time) {
  if (typeof time === "string") return time;
  if (typeof time === "number") return new Date(time * 1000).toISOString().slice(0, 10);
  return `${time.year}-${String(time.month).padStart(2, "0")}-${String(time.day).padStart(2, "0")}`;
}
function formatQuarter(value?: string) { if (!value) return "-"; const date = new Date(`${value}T00:00:00Z`); return `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`; }
function shortDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function compactNumber(value: number) { return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value); }
function statusLabel(value: PositionHistoryPoint["status"]) { return ({ entered: "Position entered", added: "Shares added", trimmed: "Shares reduced", unchanged: "No material share change", exited: "Position exited", absent: "Not reported" } as const)[value]; }
