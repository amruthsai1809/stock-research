"use client";

import { useId, useMemo, useState } from "react";
import type { AnnualFinancials } from "@/src/domain/stock";
import {
  financialChartGroups,
  financialMetrics,
  type FinancialChartGroup,
  type FinancialMetricDefinition,
  type FinancialMetricKey,
} from "@/src/domain/financialMetrics";

const pulseMetrics: FinancialMetricKey[] = ["revenue", "netIncome", "freeCashFlow", "dilutedEps"];

export function FinancialAtlas({ annuals, companyName, currency = "USD" }: { annuals: AnnualFinancials[]; companyName: string; currency?: string }) {
  const periods = useMemo(() => annuals.slice(-10), [annuals]);
  return (
    <div className="financial-atlas" data-company={companyName}>
      <div className="financial-atlas__intro">
        <div>
          <span className="eyebrow">Interactive financial atlas</span>
          <h2>See the business move.</h2>
          <p>Eight chart lenses turn reported filings into a visual operating history. Switch metrics, then point to any fiscal year for the exact value.</p>
        </div>
        <div className="atlas-legend"><span><i />Reported or filing-derived</span><span><i />Interactive series</span><small>Up to ten annual periods · SEC normalized</small></div>
      </div>
      {periods.length ? <>
        <FinancialPulse annuals={periods} companyName={companyName} currency={currency} />
        <div className="financial-atlas__grid">
          {financialChartGroups.map((group) => <FinancialTrendCard key={group.id} group={group} annuals={periods} companyName={companyName} currency={currency} />)}
        </div>
        <p className="financial-atlas__note">EBITDA is an operating proxy calculated as operating income plus reported depreciation and amortization. Fiscal P/E is calculated only when trading and reporting currencies match. Missing values are never estimated.</p>
      </> : <section className="financial-atlas__empty" role="status">
        <span aria-hidden="true">◇</span>
        <div><h3>Standardized financial history is unavailable</h3><p>SEC Company Facts does not currently provide a comparable annual revenue or profit series for this security. Price research remains available; financial values are not guessed.</p></div>
      </section>}
    </div>
  );
}

function FinancialPulse({ annuals, companyName, currency }: { annuals: AnnualFinancials[]; companyName: string; currency: string }) {
  return <section className="financial-pulse" aria-label={`${companyName} financial pulse`}>
    {pulseMetrics.map((key) => {
      const metric = financialMetrics[key];
      const values = annuals.map((annual) => metric.value(annual));
      const latestIndex = findLastIndex(values, (value) => value != null);
      const previousIndex = findPreviousValue(values, latestIndex);
      const latest = latestIndex >= 0 ? values[latestIndex] : null;
      const previous = previousIndex >= 0 ? values[previousIndex] : null;
      const change = percentageChange(latest, previous);
      return <article key={key}>
        <span><i style={{ background: metric.color }} />{metric.shortLabel}</span>
        <strong>{formatMetric(latest, metric, currency)}</strong>
        <small className={change == null ? "muted" : change >= 0 ? "positive" : "negative"}>{change == null ? "No comparison" : `${signed(change)} latest YoY`}</small>
        <MiniTrend values={values} color={metric.color} label={`${companyName} ${metric.label} trend`} />
      </article>;
    })}
  </section>;
}

function FinancialTrendCard({ group, annuals, companyName, currency }: { group: FinancialChartGroup; annuals: AnnualFinancials[]; companyName: string; currency: string }) {
  const availableKeys = group.metrics.filter((key) => annuals.some((annual) => financialMetrics[key].value(annual) != null));
  const fallbackKey = availableKeys[0] ?? group.metrics[0];
  const [metricKey, setMetricKey] = useState<FinancialMetricKey>(fallbackKey);
  const metric = financialMetrics[availableKeys.includes(metricKey) ? metricKey : fallbackKey];
  const values = annuals.map((annual) => metric.value(annual));
  const lastAvailableIndex = findLastIndex(values, (value) => value != null);
  const [selectedIndex, setSelectedIndex] = useState(lastAvailableIndex);
  const activeIndex = selectedIndex >= 0 && values[selectedIndex] != null ? selectedIndex : lastAvailableIndex;
  const activeAnnual = annuals[activeIndex];
  const activeValue = values[activeIndex] ?? null;
  const previousIndex = findPreviousValue(values, activeIndex);
  const previousValue = previousIndex >= 0 ? values[previousIndex] : null;
  const change = percentageChange(activeValue, previousValue);
  const firstIndex = values.findIndex((value) => value != null);
  const firstValue = firstIndex >= 0 ? values[firstIndex] : null;
  const trend = firstValue != null && activeValue != null && firstValue > 0 && activeValue > 0 && activeIndex > firstIndex
    ? ((activeValue / firstValue) ** (1 / (activeIndex - firstIndex)) - 1) * 100
    : null;

  const chooseMetric = (key: FinancialMetricKey) => {
    setMetricKey(key);
    const nextValues = annuals.map((annual) => financialMetrics[key].value(annual));
    setSelectedIndex(findLastIndex(nextValues, (value) => value != null));
  };

  return (
    <article className={`financial-trend-card financial-trend-card--${group.id}`} data-metric={metric.key}>
      <header>
        <div><span className="eyebrow">{group.eyebrow}</span><h3>{group.title}</h3></div>
        {trend != null && <span className={`atlas-trend ${trend >= 0 ? "positive" : "negative"}`}>{signed(trend)} CAGR</span>}
      </header>
      <div className="atlas-metric-tabs" aria-label={`${group.title} metric`}>
        {group.metrics.map((key) => {
          const definition = financialMetrics[key];
          const available = availableKeys.includes(key);
          return <button key={key} disabled={!available} className={metric.key === key ? "is-active" : ""} aria-pressed={metric.key === key} onClick={() => chooseMetric(key)}><i style={{ background: definition.color }} />{definition.shortLabel}</button>;
        })}
      </div>
      <div className="atlas-readout" aria-live="polite">
        <span>Fiscal {activeAnnual?.year ?? "—"}</span>
        <strong>{formatMetric(activeValue, metric, currency)}</strong>
        <b className={change == null ? "muted" : change >= 0 ? "positive" : "negative"}>{change == null ? "No comparable year" : `${signed(change)} YoY`}</b>
      </div>
      <AnnualTrendPlot annuals={annuals} values={values} metric={metric} activeIndex={activeIndex} onSelect={setSelectedIndex} companyName={companyName} currency={currency} />
      <footer><span style={{ background: metric.color }} /><p><b>{metric.label}</b>{metric.description}</p></footer>
    </article>
  );
}

function AnnualTrendPlot({ annuals, values, metric, activeIndex, onSelect, companyName, currency }: { annuals: AnnualFinancials[]; values: Array<number | null>; metric: FinancialMetricDefinition; activeIndex: number; onSelect: (index: number) => void; companyName: string; currency: string }) {
  const rawId = useId();
  const gradientId = `atlas-gradient-${rawId.replaceAll(":", "")}`;
  const width = 640;
  const height = 220;
  const left = 14;
  const right = 76;
  const top = 17;
  const bottom = 31;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const finite = values.filter((value): value is number => value != null && Number.isFinite(value));
  const rawMinimum = Math.min(0, ...finite);
  const rawMaximum = Math.max(0, ...finite);
  const naturalSpan = Math.max(1e-9, rawMaximum - rawMinimum);
  const padding = naturalSpan * 0.08;
  const minimum = rawMinimum < 0 ? rawMinimum - padding : 0;
  const maximum = rawMaximum + padding;
  const span = Math.max(1e-9, maximum - minimum);
  const xAt = (index: number) => left + (annuals.length <= 1 ? plotWidth / 2 : (index / (annuals.length - 1)) * plotWidth);
  const yAt = (value: number) => top + ((maximum - value) / span) * plotHeight;
  const zeroY = yAt(0);
  const points = values.flatMap((value, index) => value == null ? [] : [{ index, value, x: xAt(index), y: yAt(value) }]);
  const linePath = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const areaPath = points.length ? `${linePath} L${points.at(-1)!.x.toFixed(1)},${zeroY.toFixed(1)} L${points[0].x.toFixed(1)},${zeroY.toFixed(1)} Z` : "";
  const activePoint = points.find((point) => point.index === activeIndex);
  const barWidth = Math.min(34, (plotWidth / Math.max(1, annuals.length)) * .36);
  const levels = [maximum, minimum + span / 2, minimum];

  return <figure className="annual-trend-plot" aria-label={`${companyName} ${metric.label} interactive annual chart`}>
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={metric.color} stopOpacity=".28" />
          <stop offset="100%" stopColor={metric.color} stopOpacity=".015" />
        </linearGradient>
      </defs>
      {levels.map((level) => <g key={level}><line className="annual-trend-plot__grid" x1={left} x2={width - right + 8} y1={yAt(level)} y2={yAt(level)} /><text className="annual-trend-plot__axis" x={width - right + 16} y={yAt(level) + 4}>{formatAxis(level, metric, currency)}</text></g>)}
      {minimum < 0 && maximum > 0 && <line className="annual-trend-plot__zero" x1={left} x2={width - right + 8} y1={zeroY} y2={zeroY} />}
      {activePoint && <rect className="annual-trend-plot__focus-band" x={activePoint.x - plotWidth / Math.max(1, annuals.length) / 2} y={top} width={plotWidth / Math.max(1, annuals.length)} height={plotHeight} />}
      {points.map((point) => <rect key={`bar-${point.index}`} x={point.x - barWidth / 2} y={Math.min(point.y, zeroY)} width={barWidth} height={Math.max(2, Math.abs(zeroY - point.y))} rx="5" fill={metric.color} opacity={point.index === activeIndex ? .25 : .11} />)}
      {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
      {linePath && <path d={linePath} fill="none" stroke={metric.color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
      {points.map((point) => <circle key={`point-${point.index}`} cx={point.x} cy={point.y} r={point.index === activeIndex ? 6 : 3.5} fill={point.index === activeIndex ? metric.color : "var(--surface)"} stroke={metric.color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />)}
      {activePoint && <line className="annual-trend-plot__crosshair" x1={activePoint.x} x2={activePoint.x} y1={top} y2={height - bottom} />}
      {annuals.map((annual, index) => <text key={annual.end} className={index === activeIndex ? "annual-trend-plot__year is-active" : "annual-trend-plot__year"} x={xAt(index)} y={height - 8} textAnchor="middle">FY{String(annual.year).slice(-2)}</text>)}
    </svg>
    <div className="annual-trend-plot__hits" style={{ gridTemplateColumns: `repeat(${annuals.length}, 1fr)` }}>
      {annuals.map((annual, index) => <button key={annual.end} disabled={values[index] == null} aria-label={`Fiscal ${annual.year}: ${formatMetric(values[index], metric, currency)}`} onPointerEnter={() => values[index] != null && onSelect(index)} onFocus={() => values[index] != null && onSelect(index)} onClick={() => values[index] != null && onSelect(index)} />)}
    </div>
  </figure>;
}

function MiniTrend({ values, color, label }: { values: Array<number | null>; color: string; label: string }) {
  const finite = values.filter((value): value is number => value != null);
  if (finite.length < 2) return <div className="mini-trend mini-trend--empty">Insufficient history</div>;
  const minimum = Math.min(...finite);
  const maximum = Math.max(...finite);
  const span = Math.max(1e-9, maximum - minimum);
  const points = values.flatMap((value, index) => value == null ? [] : [`${(index / Math.max(1, values.length - 1)) * 100},${31 - ((value - minimum) / span) * 25}`]).join(" ");
  return <svg className="mini-trend" viewBox="0 0 100 36" preserveAspectRatio="none" role="img" aria-label={label}><polyline points={points} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></svg>;
}

function formatMetric(value: number | null, metric: FinancialMetricDefinition, currency: string) {
  if (value == null || !Number.isFinite(value)) return "Not available";
  if (metric.format === "percent") return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  if (metric.format === "multiple") return `${value.toFixed(1)}×`;
  if (metric.format === "perShare") return formatCurrency(value, currency, 2);
  if (metric.format === "shares") return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatAxis(value: number, metric: FinancialMetricDefinition, currency: string) {
  if (metric.format === "percent") return `${value.toFixed(0)}%`;
  if (metric.format === "multiple") return `${value.toFixed(0)}×`;
  if (metric.format === "perShare") return formatCurrency(value, currency, Math.abs(value) < 10 ? 1 : 0);
  if (metric.format === "shares") return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 0 }).format(value);
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 0 }).format(value);
}

function formatCurrency(value: number, currency: string, digits: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function percentageChange(value: number | null, previous: number | null) {
  return value != null && previous != null && previous !== 0 ? ((value - previous) / Math.abs(previous)) * 100 : null;
}

function findLastIndex<T>(values: T[], predicate: (value: T) => boolean) {
  for (let index = values.length - 1; index >= 0; index -= 1) if (predicate(values[index])) return index;
  return -1;
}

function findPreviousValue(values: Array<number | null>, index: number) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) if (values[cursor] != null) return cursor;
  return -1;
}

function signed(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}
