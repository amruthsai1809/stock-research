"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ColorType, CrosshairMode, LineSeries, LineStyle, createChart, type BusinessDay, type Time } from "lightweight-charts";
import type { AnalyzedStock, PricePoint } from "@/src/domain/stock";
import { priceRangeLabel, selectPriceRange, type PriceRangeKey } from "@/src/domain/priceRange";
import { COMPARISON_COLORS } from "@/src/components/charts/comparisonPalette";

export type CompareRange = Extract<PriceRangeKey, "3M" | "1Y" | "3Y" | "5Y" | "10Y">;

type HoverState = { date: string; values: Record<string, number | null>; context: string };

export function ComparisonChart({ stocks, range, onRangeChange }: { stocks: AnalyzedStock[]; range: CompareRange; onRangeChange: (range: CompareRange) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState("light");
  const [hover, setHover] = useState<HoverState | null>(null);
  const [renderedRange, setRenderedRange] = useState<{ start: string; end: string } | null>(null);
  const prepared = useMemo(() => {
    const selected = stocks.map((stock) => ({ stock, prices: selectPriceRange(stock.prices, range) }));
    const commonStart = selected.map((item) => item.prices[0]?.date).filter(Boolean).sort().at(-1) ?? "";
    const series = selected.map(({ stock, prices }) => {
      const visible = prices.filter((point) => point.date >= commonStart);
      return { stock, visible, normalized: normalize(visible) };
    });
    return { commonStart, series };
  }, [range, stocks]);
  const context = `${stocks.map((stock) => stock.symbol).join(":")}:${range}`;
  const latestDate = prepared.series.map((item) => item.visible.at(-1)?.date).filter(Boolean).sort().at(-1) ?? "";
  const latestValues = Object.fromEntries(prepared.series.map((item) => [item.stock.symbol, item.normalized.at(-1)?.value ?? null]));
  const active = hover?.context === context ? hover : { date: latestDate, values: latestValues, context };
  const ranked = stocks
    .map((stock) => ({ symbol: stock.symbol, value: active.values[stock.symbol] }))
    .filter((item): item is { symbol: string; value: number } => item.value != null)
    .sort((left, right) => right.value - left.value);
  const lead = ranked.length > 1 ? ranked[0].value - ranked[1].value : null;
  const shortest = prepared.series.reduce<PricePoint[] | null>(
    (current, item) => current == null || item.visible.length < current.length ? item.visible : current,
    null,
  ) ?? [];
  const sessionCount = prepared.series.length ? Math.min(...prepared.series.map((item) => item.visible.length)) : 0;

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
    if (!host || prepared.series.length < 2 || prepared.series.some((item) => !item.normalized.length)) return;
    host.replaceChildren();
    const dark = theme === "dark";
    const chart = createChart(host, {
      height: 360,
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
      timeScale: { borderColor: dark ? "#314247" : "#d9d8d1", fixLeftEdge: true, rightOffset: 3, minBarSpacing: 0.1 },
      localization: { priceFormatter: (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%` },
      handleScale: true,
      handleScroll: true,
    });

    const valuesBySymbol = new Map<string, Map<string, number>>();
    prepared.series.forEach((item, index) => {
      const line = chart.addSeries(LineSeries, {
        color: COMPARISON_COLORS[index],
        lineWidth: 3,
        priceLineVisible: false,
        lastValueVisible: true,
      });
      line.setData(item.normalized);
      valuesBySymbol.set(item.stock.symbol, new Map(item.normalized.map((point) => [String(point.time), point.value])));
    });

    chart.subscribeCrosshairMove((parameter) => {
      if (!parameter.time || !parameter.point || parameter.point.x < 0 || parameter.point.y < 0) {
        setHover(null);
        return;
      }
      const date = timeKey(parameter.time);
      setHover({
        date,
        context,
        values: Object.fromEntries(prepared.series.map((item) => [item.stock.symbol, valuesBySymbol.get(item.stock.symbol)?.get(date) ?? null])),
      });
    });

    const firstTime = prepared.commonStart as Time;
    const lastTime = latestDate as Time;
    const fitSelectedHistory = () => {
      if (firstTime && lastTime) chart.timeScale().setVisibleRange({ from: firstTime, to: lastTime });
    };
    const captureRenderedRange = (next: { from: Time; to: Time } | null) => {
      if (next) setRenderedRange({ start: timeKey(next.from), end: timeKey(next.to) });
    };
    chart.timeScale().subscribeVisibleTimeRangeChange(captureRenderedRange);
    fitSelectedHistory();
    captureRenderedRange(chart.timeScale().getVisibleRange());
    const resize = new ResizeObserver(([entry]) => {
      chart.applyOptions({ width: Math.max(1, Math.floor(entry.contentRect.width)) });
      fitSelectedHistory();
    });
    resize.observe(host);
    return () => {
      resize.disconnect();
      chart.timeScale().unsubscribeVisibleTimeRangeChange(captureRenderedRange);
      chart.remove();
    };
  }, [context, latestDate, prepared, theme]);

  return (
    <div className="comparison-chart">
      <div className="comparison-chart__head">
        <div className="comparison-live" aria-live="polite">
          <span>{active.date ? formatDate(active.date) : "No price data"}</span>
          {stocks.map((stock, index) => (
            <b className="comparison-live__company" style={{ "--series-color": COMPARISON_COLORS[index] } as CSSProperties} key={stock.symbol}><i />{stock.symbol} {formatReturn(active.values[stock.symbol] ?? null)}</b>
          ))}
          {ranked[0] && lead != null && <small>{ranked[0].symbol} leads by {lead.toFixed(1)} points</small>}
        </div>
        <div className="chart-range" aria-label="Comparison period">{(["3M", "1Y", "3Y", "5Y", "10Y"] as CompareRange[]).map((item) => <button key={item} className={range === item ? "is-active" : ""} aria-pressed={range === item} onClick={() => { setHover(null); onRangeChange(item); }}>{item}</button>)}</div>
      </div>
      <div className="chart-period-readout" data-chart-range={range} data-range-start={prepared.commonStart} data-range-end={latestDate} data-rendered-start={renderedRange?.start ?? ""} data-rendered-end={renderedRange?.end ?? ""} data-session-count={sessionCount}><b>{range}</b><span>{priceRangeLabel(shortest)}</span><em className={coversSelectedRange(renderedRange, prepared.commonStart, latestDate) ? "is-complete" : ""}>{coversSelectedRange(renderedRange, prepared.commonStart, latestDate) ? "Full selected history" : "Zoomed view"}</em></div>
      <div ref={hostRef} className="chart-stage" role="group" aria-label={`Interactive normalized price performance for ${stocks.map((stock) => stock.name).join(", ")}. Move the pointer for exact returns.`} />
      <div className="chart-help"><span>Return from the beginning of the selected period</span><small>Move to inspect · drag to pan · scroll to zoom</small></div>
    </div>
  );
}

function normalize(prices: PricePoint[]) {
  const base = prices[0]?.adjustedClose ?? 1;
  return prices.map((point) => ({ time: point.date as Time, value: ((point.adjustedClose / base) - 1) * 100 }));
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
  if (value == null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function coversSelectedRange(rendered: { start: string; end: string } | null, start: string, end: string) {
  return Boolean(rendered && start && end && rendered.start <= start && rendered.end >= end);
}
