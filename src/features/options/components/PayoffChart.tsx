"use client";

import { useMemo, useState } from "react";
import type { ScenarioCurve } from "@/src/application/options/types";
import { formatDateLabel, formatOptionCurrency } from "../optionsViewModel";
import styles from "../OptionsLab.module.css";

const WIDTH = 800;
const HEIGHT = 320;
const PADDING = { top: 24, right: 24, bottom: 45, left: 67 };

export function PayoffChart({ curve, targetSpotPrice }: { curve: ScenarioCurve; targetSpotPrice: number }) {
  const nearestTarget = nearestPoint(curve, targetSpotPrice);
  const [inspectedSpotPrice, setInspectedSpotPrice] = useState<number | null>(null);
  const geometry = useMemo(() => buildGeometry(curve), [curve]);
  const selectedIndex = inspectedSpotPrice == null ? nearestTarget.index : nearestPoint(curve, inspectedSpotPrice).index;
  const selected = curve.points[Math.min(selectedIndex, curve.points.length - 1)] ?? curve.points[0];
  const selectedX = scale(selected.spotPrice, geometry.xMinimum, geometry.xMaximum, PADDING.left, WIDTH - PADDING.right);

  const selectFromClientX = (clientX: number, element: SVGSVGElement) => {
    const bounds = element.getBoundingClientRect();
    const normalized = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
    const spot = geometry.xMinimum + normalized * (geometry.xMaximum - geometry.xMinimum);
    setInspectedSpotPrice(curve.points[nearestPoint(curve, spot).index].spotPrice);
  };

  return <section className={`${styles.card} ${styles.chartCard}`} aria-labelledby="payoff-chart-heading">
    <header className={styles.chartHeader}>
      <div><span className={styles.step}>Price × time</span><h2 id="payoff-chart-heading">The same stock price can mean a different result</h2><p>Solid line: value on {formatDateLabel(curve.selectedDate)}. Dashed line: exact payoff at expiration.</p></div>
      <div className={styles.chartReadout} aria-live="polite"><span>At ${selected.spotPrice.toFixed(2)}</span><b className={selected.selectedDateProfitLossDollars >= 0 ? styles.positiveText : styles.negativeText}>{formatOptionCurrency(selected.selectedDateProfitLossDollars)}</b><small>on selected date</small></div>
    </header>
    <div className={styles.chartLegend}><span><i className={styles.solidLegend} />Selected date</span><span><i className={styles.dashedLegend} />Expiration</span><span><i className={styles.zeroLegend} />Break-even axis</span></div>
    <div className={styles.payoffPlot}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        tabIndex={0}
        aria-label={`Profit and loss curve from ${formatOptionCurrency(geometry.xMinimum)} to ${formatOptionCurrency(geometry.xMaximum)}. At the selected ${formatOptionCurrency(selected.spotPrice)}, modeled profit and loss is ${formatOptionCurrency(selected.selectedDateProfitLossDollars)}.`}
        onPointerMove={(event) => selectFromClientX(event.clientX, event.currentTarget)}
        onPointerLeave={() => setInspectedSpotPrice(null)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          const nextIndex = Math.min(curve.points.length - 1, Math.max(0, selectedIndex + (event.key === "ArrowRight" ? 1 : -1)));
          setInspectedSpotPrice(curve.points[nextIndex].spotPrice);
        }}
      >
        {geometry.yTicks.map((tick) => <g key={tick.value}><line className={tick.value === 0 ? styles.zeroLine : styles.gridLine} x1={PADDING.left} x2={WIDTH - PADDING.right} y1={tick.y} y2={tick.y} /><text className={styles.axisLabel} x={PADDING.left - 10} y={tick.y + 3} textAnchor="end">{compactMoney(tick.value)}</text></g>)}
        {geometry.xTicks.map((tick) => <g key={tick.value}><line className={styles.verticalGrid} x1={tick.x} x2={tick.x} y1={PADDING.top} y2={HEIGHT - PADDING.bottom} /><text className={styles.axisLabel} x={tick.x} y={HEIGHT - 17} textAnchor="middle">${tick.value.toFixed(0)}</text></g>)}
        <path className={styles.expirationPath} d={geometry.expirationPath} />
        <path className={styles.selectedPath} d={geometry.selectedPath} />
        <line className={styles.crosshair} x1={selectedX} x2={selectedX} y1={PADDING.top} y2={HEIGHT - PADDING.bottom} />
        <circle className={selected.selectedDateProfitLossDollars >= 0 ? styles.profitPoint : styles.lossPoint} cx={selectedX} cy={scale(selected.selectedDateProfitLossDollars, geometry.yMinimum, geometry.yMaximum, HEIGHT - PADDING.bottom, PADDING.top)} r="5" />
      </svg>
    </div>
    <div className={styles.chartFootnotes}><span>Break-even at expiration <b>${curve.breakEvenPrice.toFixed(2)}</b></span><span>Use ← and → after focusing chart</span><span>Fees and taxes excluded</span></div>
  </section>;
}

function buildGeometry(curve: ScenarioCurve) {
  const xMinimum = curve.points[0].spotPrice;
  const xMaximum = curve.points.at(-1)!.spotPrice;
  const allY = curve.points.flatMap((point) => [point.selectedDateProfitLossDollars, point.expirationProfitLossDollars, 0]);
  let yMinimum = Math.min(...allY);
  let yMaximum = Math.max(...allY);
  const margin = Math.max(1, (yMaximum - yMinimum) * 0.08);
  yMinimum -= margin;
  yMaximum += margin;
  const path = (key: "selectedDateProfitLossDollars" | "expirationProfitLossDollars") => curve.points.map((point, index) => `${index ? "L" : "M"}${scale(point.spotPrice, xMinimum, xMaximum, PADDING.left, WIDTH - PADDING.right).toFixed(2)},${scale(point[key], yMinimum, yMaximum, HEIGHT - PADDING.bottom, PADDING.top).toFixed(2)}`).join(" ");
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const value = yMinimum + (yMaximum - yMinimum) * index / 4;
    return { value, y: scale(value, yMinimum, yMaximum, HEIGHT - PADDING.bottom, PADDING.top) };
  });
  if (yMinimum < 0 && yMaximum > 0 && !yTicks.some((tick) => Math.abs(tick.value) < (yMaximum - yMinimum) * 0.01)) {
    yTicks.push({ value: 0, y: scale(0, yMinimum, yMaximum, HEIGHT - PADDING.bottom, PADDING.top) });
    yTicks.sort((left, right) => left.value - right.value);
  }
  const xTicks = Array.from({ length: 5 }, (_, index) => {
    const value = xMinimum + (xMaximum - xMinimum) * index / 4;
    return { value, x: scale(value, xMinimum, xMaximum, PADDING.left, WIDTH - PADDING.right) };
  });
  return { xMinimum, xMaximum, yMinimum, yMaximum, selectedPath: path("selectedDateProfitLossDollars"), expirationPath: path("expirationProfitLossDollars"), xTicks, yTicks };
}

function nearestPoint(curve: ScenarioCurve, spot: number) {
  return curve.points.reduce((nearest, point, index) => Math.abs(point.spotPrice - spot) < nearest.distance ? { index, distance: Math.abs(point.spotPrice - spot) } : nearest, { index: 0, distance: Number.POSITIVE_INFINITY });
}

function scale(value: number, minimum: number, maximum: number, outputMinimum: number, outputMaximum: number) {
  return outputMinimum + (value - minimum) / Math.max(1e-9, maximum - minimum) * (outputMaximum - outputMinimum);
}

function compactMoney(value: number) {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (absolute >= 1_000_000) return `${sign}$${(absolute / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${sign}$${(absolute / 1_000).toFixed(1)}K`;
  return `${sign}$${absolute.toFixed(0)}`;
}
