"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ColorType, CrosshairMode, LineSeries, LineStyle, createChart, type BusinessDay, type Time } from "lightweight-charts";
import type { AnalyzedStock, PricePoint } from "@/src/domain/stock";

type CompareRange = "3M" | "1Y" | "3Y" | "5Y";

export function ComparisonChart({ left, right }: { left: AnalyzedStock; right: AnalyzedStock }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<CompareRange>("1Y");
  const [theme, setTheme] = useState("light");
  const [hover, setHover] = useState<{ date: string; left: number | null; right: number | null } | null>(null);
  const leftVisible = useMemo(() => selectRange(left.prices, range), [left.prices, range]);
  const rightVisible = useMemo(() => selectRange(right.prices, range), [right.prices, range]);
  const leftNormalized = useMemo(() => normalize(leftVisible), [leftVisible]);
  const rightNormalized = useMemo(() => normalize(rightVisible), [rightVisible]);
  const latest = {
    date: leftVisible.at(-1)?.date ?? rightVisible.at(-1)?.date ?? "",
    left: leftNormalized.at(-1)?.value ?? null,
    right: rightNormalized.at(-1)?.value ?? null,
  };
  const active = hover ?? latest;

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
    if (!host || !leftNormalized.length || !rightNormalized.length) return;
    host.replaceChildren();
    const dark = theme === "dark";
    const chart = createChart(host, {
      height: 330,
      width: Math.max(1, host.clientWidth),
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: dark ? "#aab7b5" : "#68767b", fontFamily: "var(--font-geist-mono), ui-monospace, monospace", fontSize: 11 },
      grid: {
        vertLines: { color: dark ? "rgba(255,255,255,.045)" : "rgba(16,32,41,.055)" },
        horzLines: { color: dark ? "rgba(255,255,255,.06)" : "rgba(16,32,41,.07)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#ef6c50", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#ef6c50" },
        horzLine: { color: dark ? "#83918f" : "#6f7d81", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1b6f74" },
      },
      rightPriceScale: { borderColor: dark ? "#314247" : "#d9d8d1" },
      timeScale: { borderColor: dark ? "#314247" : "#d9d8d1", fixLeftEdge: true, rightOffset: 3, minBarSpacing: 1.2 },
      localization: { priceFormatter: (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%` },
      handleScale: true,
      handleScroll: true,
    });
    const leftSeries = chart.addSeries(LineSeries, { color: "#ef6c50", lineWidth: 3, priceLineVisible: false, lastValueVisible: true });
    const rightSeries = chart.addSeries(LineSeries, { color: "#1b9b91", lineWidth: 3, priceLineVisible: false, lastValueVisible: true });
    leftSeries.setData(leftNormalized);
    rightSeries.setData(rightNormalized);
    const leftByDate = new Map(leftNormalized.map((point) => [String(point.time), point.value]));
    const rightByDate = new Map(rightNormalized.map((point) => [String(point.time), point.value]));
    chart.subscribeCrosshairMove((parameter) => {
      if (!parameter.time || !parameter.point || parameter.point.x < 0 || parameter.point.y < 0) {
        setHover(null);
        return;
      }
      const date = timeKey(parameter.time);
      setHover({ date, left: leftByDate.get(date) ?? null, right: rightByDate.get(date) ?? null });
    });
    chart.timeScale().fitContent();
    const resize = new ResizeObserver(([entry]) => chart.applyOptions({ width: Math.max(1, Math.floor(entry.contentRect.width)) }));
    resize.observe(host);
    return () => { resize.disconnect(); chart.remove(); };
  }, [leftNormalized, rightNormalized, theme]);

  const spread = active.left != null && active.right != null ? active.left - active.right : null;
  return (
    <div className="comparison-chart">
      <div className="comparison-chart__head">
        <div className="comparison-live" aria-live="polite">
          <span>{active.date ? formatDate(active.date) : "No price data"}</span>
          <b className="comparison-live__left"><i />{left.symbol} {formatReturn(active.left)}</b>
          <b className="comparison-live__right"><i />{right.symbol} {formatReturn(active.right)}</b>
          {spread != null && <small>{Math.abs(spread).toFixed(1)} point lead</small>}
        </div>
        <div className="chart-range" aria-label="Comparison period">{(["3M", "1Y", "3Y", "5Y"] as CompareRange[]).map((item) => <button key={item} className={range === item ? "is-active" : ""} aria-pressed={range === item} onClick={() => setRange(item)}>{item}</button>)}</div>
      </div>
      <div ref={hostRef} className="chart-stage" role="img" aria-label={`Interactive normalized price performance for ${left.name} and ${right.name}. Move the pointer for exact returns.`} />
      <div className="chart-help"><span>Return from the beginning of the selected period</span><small>Move to inspect · drag to pan · scroll to zoom</small></div>
    </div>
  );
}

function normalize(prices: PricePoint[]) {
  const base = prices[0]?.adjustedClose ?? 1;
  return prices.map((point) => ({ time: point.date as Time, value: ((point.adjustedClose / base) - 1) * 100 }));
}

function selectRange(prices: PricePoint[], range: CompareRange) {
  if (!prices.length || range === "5Y") return prices;
  const last = new Date(`${prices.at(-1)!.date}T00:00:00Z`);
  const days = { "3M": 93, "1Y": 366, "3Y": 1096 }[range];
  const cutoff = new Date(last);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const key = cutoff.toISOString().slice(0, 10);
  return prices.filter((point) => point.date >= key);
}

function timeKey(time: Time) {
  if (typeof time === "string") return time;
  if (typeof time === "number") return new Date(time * 1000).toISOString().slice(0, 10);
  const day = time as BusinessDay;
  return `${day.year}-${String(day.month).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatReturn(value: number | null) {
  if (value == null) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
