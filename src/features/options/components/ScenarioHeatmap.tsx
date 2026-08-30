"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { ScenarioSurface } from "@/src/application/options/types";
import { formatDateLabel, formatOptionCurrency } from "../optionsViewModel";
import styles from "../OptionsLab.module.css";

type Cell = { row: number; column: number; date: string; price: number; value: number };

export function ScenarioHeatmap({ surface, targetDate, targetSpotPrice, updating }: { surface: ScenarioSurface; targetDate: string; targetSpotPrice: number; updating: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<Cell | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => drawSurface(canvas, surface, targetDate, targetSpotPrice);
    draw();
    const resize = new ResizeObserver(draw);
    resize.observe(canvas);
    const theme = new MutationObserver(draw);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { resize.disconnect(); theme.disconnect(); };
  }, [surface, targetDate, targetSpotPrice]);

  const inspect = (event: PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const column = Math.min(surface.prices.length - 1, Math.max(0, Math.floor((event.clientX - bounds.left) / bounds.width * surface.prices.length)));
    const row = Math.min(surface.dates.length - 1, Math.max(0, Math.floor((event.clientY - bounds.top) / bounds.height * surface.dates.length)));
    setHovered({ row, column, date: surface.dates[row], price: surface.prices[column], value: surface.profitLossDollars[row][column] });
  };

  const range = Math.max(Math.abs(surface.minimumProfitLossDollars), Math.abs(surface.maximumProfitLossDollars));
  return <section className={`${styles.card} ${styles.heatmapCard}`} aria-labelledby="scenario-map-heading">
    <header className={styles.chartHeader}><div><span className={styles.step}>Outcome map</span><h2 id="scenario-map-heading">See the whole price-and-time field</h2><p>Each cell is modeled P/L for one stock price and one date at the scenario volatility.</p></div><span className={`${styles.computeStatus} ${updating ? styles.updating : ""}`}><i />{updating ? "Recomputing" : "Ready"}</span></header>
    <div className={styles.heatmapFrame}>
      <div className={styles.heatmapYAxis}><span>{formatDateLabel(surface.dates[0])}</span><span>{formatDateLabel(surface.dates.at(-1)!)}</span></div>
      <canvas ref={canvasRef} className={styles.heatmapCanvas} role="img" aria-label={`Profit and loss heatmap from ${formatDateLabel(surface.dates[0])} to ${formatDateLabel(surface.dates.at(-1)!)} and stock prices ${formatOptionCurrency(surface.prices[0])} to ${formatOptionCurrency(surface.prices.at(-1)!)}.`} onPointerMove={inspect} onPointerLeave={() => setHovered(null)} />
      <div className={styles.heatmapXAxis}><span>${surface.prices[0].toFixed(0)}</span><span>Stock price →</span><span>${surface.prices.at(-1)!.toFixed(0)}</span></div>
      {hovered && <div className={styles.heatmapTooltip}><b>{formatOptionCurrency(hovered.value)}</b><span>${hovered.price.toFixed(2)} · {formatDateLabel(hovered.date)}</span></div>}
    </div>
    <div className={styles.heatmapScale}><span>Loss {formatOptionCurrency(-range)}</span><i><span /></i><span>Profit {formatOptionCurrency(range)}</span></div>
    <table className={styles.screenReaderOnly}><caption>Selected option scenario samples</caption><thead><tr><th>Date</th><th>Low stock price P/L</th><th>Middle stock price P/L</th><th>High stock price P/L</th></tr></thead><tbody>{[0, Math.floor(surface.dates.length / 2), surface.dates.length - 1].map((row) => <tr key={surface.dates[row]}><th>{surface.dates[row]}</th>{[0, Math.floor(surface.prices.length / 2), surface.prices.length - 1].map((column) => <td key={column}>{formatOptionCurrency(surface.profitLossDollars[row][column])}</td>)}</tr>)}</tbody></table>
  </section>;
}

function drawSurface(canvas: HTMLCanvasElement, surface: ScenarioSurface, targetDate: string, targetSpotPrice: number) {
  const bounds = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(bounds.width));
  const height = Math.max(1, Math.floor(bounds.height));
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.scale(ratio, ratio);
  const styles = getComputedStyle(document.documentElement);
  const base = styles.getPropertyValue("--surface-muted").trim() || "#ebe9e1";
  const profit = styles.getPropertyValue("--teal").trim() || "#1b6f74";
  const loss = styles.getPropertyValue("--coral").trim() || "#ef6c50";
  const cellWidth = width / surface.prices.length;
  const cellHeight = height / surface.dates.length;
  const maximumMagnitude = Math.max(1, Math.abs(surface.minimumProfitLossDollars), Math.abs(surface.maximumProfitLossDollars));
  surface.profitLossDollars.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
    context.globalAlpha = 1;
    context.fillStyle = base;
    context.fillRect(columnIndex * cellWidth, rowIndex * cellHeight, Math.ceil(cellWidth), Math.ceil(cellHeight));
    context.globalAlpha = 0.18 + Math.min(1, Math.abs(value) / maximumMagnitude) * 0.82;
    context.fillStyle = value >= 0 ? profit : loss;
    context.fillRect(columnIndex * cellWidth + 1, rowIndex * cellHeight + 1, Math.max(0, cellWidth - 2), Math.max(0, cellHeight - 2));
  }));
  context.globalAlpha = 1;
  const selectedColumn = nearestIndex(surface.prices, targetSpotPrice);
  const selectedRow = nearestIndex(surface.dates.map((date) => new Date(`${date}T00:00:00Z`).getTime()), new Date(`${targetDate}T00:00:00Z`).getTime());
  context.strokeStyle = styles.getPropertyValue("--ink").trim() || "#102029";
  context.lineWidth = 2;
  context.strokeRect(selectedColumn * cellWidth + 1, selectedRow * cellHeight + 1, Math.max(0, cellWidth - 2), Math.max(0, cellHeight - 2));
}

function nearestIndex(values: readonly number[], target: number) {
  return values.reduce((nearest, value, index) => Math.abs(value - target) < nearest.distance ? { index, distance: Math.abs(value - target) } : nearest, { index: 0, distance: Number.POSITIVE_INFINITY }).index;
}
