"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type BusinessDay,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import type { PricePoint } from "@/src/domain/stock";

type RangeKey = "1M" | "3M" | "6M" | "YTD" | "1Y" | "3Y" | "5Y";
type ChartStyle = "line" | "candles";

const fullRanges: RangeKey[] = ["1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y"];
const compactRanges: RangeKey[] = ["3M", "6M", "1Y", "3Y"];

export function InteractivePriceChart({
  prices,
  symbol,
  name,
  height = 360,
  compact = false,
  initialRange = compact ? "6M" : "1Y",
}: {
  prices: PricePoint[];
  symbol: string;
  name: string;
  height?: number;
  compact?: boolean;
  initialRange?: RangeKey;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [range, setRange] = useState<RangeKey>(initialRange);
  const [style, setStyle] = useState<ChartStyle>("line");
  const [showSma50, setShowSma50] = useState(!compact);
  const [showSma200, setShowSma200] = useState(false);
  const [theme, setTheme] = useState("light");
  const [hovered, setHovered] = useState<PricePoint | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setTheme(root.dataset.theme ?? "light");
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const movingAverages = useMemo(() => ({
    sma50: movingAverage(prices, 50),
    sma200: movingAverage(prices, 200),
  }), [prices]);
  const visible = useMemo(() => selectRange(prices, range), [prices, range]);
  const latest = visible.at(-1) ?? prices.at(-1) ?? null;
  const active = hovered ?? latest;
  const rangeStart = visible[0]?.adjustedClose ?? active?.adjustedClose ?? 1;
  const activeChange = active ? ((active.adjustedClose / rangeStart) - 1) * 100 : 0;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !visible.length) return;
    host.replaceChildren();

    const dark = theme === "dark";
    const chart = createChart(host, {
      height,
      width: Math.max(1, host.clientWidth),
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: dark ? "#aab7b5" : "#68767b",
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: dark ? "rgba(255,255,255,.045)" : "rgba(16,32,41,.055)" },
        horzLines: { color: dark ? "rgba(255,255,255,.06)" : "rgba(16,32,41,.07)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#ef6c50", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#ef6c50" },
        horzLine: { color: dark ? "#83918f" : "#6f7d81", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1b6f74" },
      },
      rightPriceScale: {
        borderColor: dark ? "#314247" : "#d9d8d1",
        scaleMargins: { top: 0.08, bottom: compact ? 0.23 : 0.2 },
      },
      timeScale: {
        borderColor: dark ? "#314247" : "#d9d8d1",
        timeVisible: false,
        rightOffset: 3,
        barSpacing: compact ? 5 : 7,
        minBarSpacing: 1.2,
        fixLeftEdge: true,
      },
      handleScale: true,
      handleScroll: true,
    });
    chartRef.current = chart;

    const chartData = visible.map((point) => ({ time: point.date as Time, value: point.adjustedClose }));
    const candleData = visible.map((point) => ({
      time: point.date as Time,
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.adjustedClose,
    }));
    const primary = style === "candles"
      ? chart.addSeries(CandlestickSeries, {
          upColor: "#1b8a76",
          downColor: "#d95d49",
          borderVisible: false,
          wickUpColor: "#1b8a76",
          wickDownColor: "#d95d49",
          priceLineVisible: true,
          lastValueVisible: true,
        })
      : chart.addSeries(AreaSeries, {
          lineColor: "#ef6c50",
          topColor: dark ? "rgba(239,108,80,.35)" : "rgba(239,108,80,.28)",
          bottomColor: "rgba(239,108,80,0)",
          lineWidth: 2,
          priceLineColor: "#ef6c50",
        });
    if (style === "candles") primary.setData(candleData);
    else primary.setData(chartData);

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    volume.setData(visible.map((point) => ({
      time: point.date as Time,
      value: point.volume,
      color: point.adjustedClose >= point.open ? "rgba(27,138,118,.34)" : "rgba(217,93,73,.3)",
    })));
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: compact ? 0.82 : 0.8, bottom: 0 } });

    if (showSma50) {
      const sma50 = chart.addSeries(LineSeries, {
        color: "#1b6f74",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      sma50.setData(visible.flatMap((point) => {
        const value = movingAverages.sma50.get(point.date);
        return value == null ? [] : [{ time: point.date as Time, value }];
      }));
    }
    if (showSma200) {
      const sma200 = chart.addSeries(LineSeries, {
        color: "#4678b7",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      sma200.setData(visible.flatMap((point) => {
        const value = movingAverages.sma200.get(point.date);
        return value == null ? [] : [{ time: point.date as Time, value }];
      }));
    }

    const pointByDate = new Map(visible.map((point) => [point.date, point]));
    chart.subscribeCrosshairMove((parameter) => {
      if (!parameter.time || !parameter.point || parameter.point.x < 0 || parameter.point.y < 0) {
        setHovered(null);
        return;
      }
      const date = timeKey(parameter.time);
      setHovered(pointByDate.get(date) ?? null);
    });
    chart.timeScale().fitContent();

    const resize = new ResizeObserver(([entry]) => {
      chart.applyOptions({ width: Math.max(1, Math.floor(entry.contentRect.width)) });
    });
    resize.observe(host);
    return () => {
      resize.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [height, movingAverages, showSma50, showSma200, style, theme, visible, compact]);

  return (
    <div className={`interactive-price-chart ${compact ? "interactive-price-chart--compact" : ""}`}>
      <div className="chart-readout" aria-live="polite">
        <div className="chart-readout__quote">
          <span>{active ? formatDate(active.date) : "No price data"}</span>
          <strong>{active ? `$${active.adjustedClose.toFixed(2)}` : "-"}</strong>
          {active && <b className={activeChange >= 0 ? "positive" : "negative"}>{signedPercent(activeChange)} <small>{range} return</small></b>}
        </div>
        {active && !compact && (
          <dl className="chart-ohlc">
            <div><dt>Open</dt><dd>${active.open.toFixed(2)}</dd></div>
            <div><dt>High</dt><dd>${active.high.toFixed(2)}</dd></div>
            <div><dt>Low</dt><dd>${active.low.toFixed(2)}</dd></div>
            <div><dt>Volume</dt><dd>{formatVolume(active.volume)}</dd></div>
          </dl>
        )}
      </div>

      <div className="chart-toolbar">
        <div className="chart-range" aria-label={`${name} price range`}>
          {(compact ? compactRanges : fullRanges).map((item) => (
            <button key={item} className={range === item ? "is-active" : ""} aria-pressed={range === item} onClick={() => setRange(item)}>{item}</button>
          ))}
        </div>
        {!compact && (
          <div className="chart-tools">
            <div className="chart-style-toggle" aria-label="Price display">
              <button className={style === "line" ? "is-active" : ""} aria-pressed={style === "line"} onClick={() => setStyle("line")}>Line</button>
              <button className={style === "candles" ? "is-active" : ""} aria-pressed={style === "candles"} onClick={() => setStyle("candles")}>Candles</button>
            </div>
            <button className={showSma50 ? "is-active" : ""} aria-pressed={showSma50} onClick={() => setShowSma50((value) => !value)}><i className="legend-swatch legend-swatch--teal" />50D</button>
            <button className={showSma200 ? "is-active" : ""} aria-pressed={showSma200} onClick={() => setShowSma200((value) => !value)}><i className="legend-swatch legend-swatch--blue" />200D</button>
            <button onClick={() => chartRef.current?.timeScale().fitContent()} title="Reset zoom">Reset</button>
          </div>
        )}
      </div>

      <div
        ref={hostRef}
        className="chart-stage"
        role="img"
        aria-label={`${symbol} interactive ${range} price chart. Move the pointer across the chart for exact daily price, OHLC, and volume.`}
      />
      <div className="chart-help"><span><i className="legend-swatch legend-swatch--coral" />{style === "candles" ? "Daily OHLC" : "Adjusted close"}</span><small>Move to inspect · drag to pan · scroll to zoom</small></div>
    </div>
  );
}

function selectRange(prices: PricePoint[], range: RangeKey) {
  if (!prices.length || range === "5Y") return prices;
  const last = new Date(`${prices.at(-1)!.date}T00:00:00Z`);
  if (range === "YTD") return prices.filter((point) => point.date >= `${last.getUTCFullYear()}-01-01`);
  const days: Record<Exclude<RangeKey, "YTD" | "5Y">, number> = {
    "1M": 31,
    "3M": 93,
    "6M": 186,
    "1Y": 366,
    "3Y": 1096,
  };
  const cutoff = new Date(last);
  cutoff.setUTCDate(cutoff.getUTCDate() - days[range]);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  return prices.filter((point) => point.date >= cutoffKey);
}

function movingAverage(prices: PricePoint[], period: number) {
  const values = new Map<string, number>();
  let total = 0;
  prices.forEach((point, index) => {
    total += point.adjustedClose;
    if (index >= period) total -= prices[index - period].adjustedClose;
    if (index >= period - 1) values.set(point.date, total / period);
  });
  return values;
}

function timeKey(time: Time) {
  if (typeof time === "string") return time;
  if (typeof time === "number") return new Date(time * 1000).toISOString().slice(0, 10);
  const day = time as BusinessDay;
  return `${day.year}-${String(day.month).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

function formatVolume(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function signedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
