"use client";

import { useMemo, useState } from "react";
import type { AnnualFinancials } from "@/src/domain/stock";
import {
  financialChartGroups,
  financialMetrics,
  type FinancialChartGroup,
  type FinancialMetricDefinition,
  type FinancialMetricKey,
} from "@/src/domain/financialMetrics";

export function FinancialAtlas({ annuals, companyName }: { annuals: AnnualFinancials[]; companyName: string }) {
  const periods = useMemo(() => annuals.slice(-6), [annuals]);
  return (
    <div className="financial-atlas" data-company={companyName}>
      <div className="financial-atlas__intro">
        <div>
          <span className="eyebrow">Financial atlas</span>
          <h2>The business, from eight angles.</h2>
          <p>Choose a metric inside any chart and point to a fiscal year for its exact reported value.</p>
        </div>
        <div className="atlas-legend"><span><i />Reported</span><span><i />Calculated</span><small>Annual · SEC normalized</small></div>
      </div>
      <div className="financial-atlas__grid">
        {financialChartGroups.map((group) => <FinancialTrendCard key={group.id} group={group} annuals={periods} companyName={companyName} />)}
      </div>
      <p className="financial-atlas__note">EBITDA is an operating proxy calculated as operating income plus reported depreciation and amortization. Fiscal P/E uses the adjusted close at fiscal year end and reported diluted EPS. Missing values are never estimated.</p>
    </div>
  );
}

function FinancialTrendCard({ group, annuals, companyName }: { group: FinancialChartGroup; annuals: AnnualFinancials[]; companyName: string }) {
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
  const change = activeValue != null && previousValue != null && previousValue !== 0
    ? ((activeValue - previousValue) / Math.abs(previousValue)) * 100
    : null;
  const finiteValues = values.filter((value): value is number => value != null && Number.isFinite(value));
  const minimum = Math.min(0, ...finiteValues);
  const maximum = Math.max(0, ...finiteValues);
  const span = Math.max(1e-9, maximum - minimum);
  const zeroTop = (maximum / span) * 100;
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
      <p>{group.description}</p>
      <div className="atlas-metric-tabs" aria-label={`${group.title} metric`}>
        {group.metrics.map((key) => {
          const definition = financialMetrics[key];
          const available = availableKeys.includes(key);
          return <button key={key} disabled={!available} className={metric.key === key ? "is-active" : ""} aria-pressed={metric.key === key} onClick={() => chooseMetric(key)}>{definition.shortLabel}</button>;
        })}
      </div>
      <div className="atlas-readout" aria-live="polite">
        <span>FY {activeAnnual?.year ?? "—"}</span>
        <strong>{formatMetric(activeValue, metric)}</strong>
        <b className={change == null ? "muted" : change >= 0 ? "positive" : "negative"}>{change == null ? "No comparable year" : `${signed(change)} YoY`}</b>
      </div>
      <div className="atlas-bars" role="img" aria-label={`${companyName} ${metric.label} annual chart`}>
        <i className="atlas-zero" style={{ top: `${zeroTop}%` }} />
        {annuals.map((annual, index) => {
          const value = values[index];
          const top = value == null ? zeroTop : value >= 0 ? ((maximum - value) / span) * 100 : zeroTop;
          const height = value == null ? 0 : Math.max(2.5, (Math.abs(value) / span) * 100);
          return (
            <button
              key={annual.end}
              className={`${index === activeIndex ? "is-selected" : ""} ${value != null && value < 0 ? "is-negative" : ""}`}
              onPointerEnter={() => value != null && setSelectedIndex(index)}
              onFocus={() => value != null && setSelectedIndex(index)}
              onClick={() => value != null && setSelectedIndex(index)}
              disabled={value == null}
              aria-label={`Fiscal ${annual.year}: ${formatMetric(value, metric)}`}
            >
              <span><i style={{ top: `${top}%`, height: `${height}%`, background: metric.color }} /></span>
              <b>FY{String(annual.year).slice(-2)}</b>
            </button>
          );
        })}
      </div>
      <footer><span style={{ background: metric.color }} /><p><b>{metric.label}</b>{metric.description}</p></footer>
    </article>
  );
}

function formatMetric(value: number | null, metric: FinancialMetricDefinition) {
  if (value == null || !Number.isFinite(value)) return "Not available";
  if (metric.format === "percent") return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  if (metric.format === "multiple") return `${value.toFixed(1)}×`;
  if (metric.format === "perShare") return `${value < 0 ? "−" : ""}$${Math.abs(value).toFixed(2)}`;
  if (metric.format === "shares") return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);
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
