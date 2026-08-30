"use client";

import { useMemo, useState } from "react";
import type { AnnualFinancials } from "@/src/domain/stock";
import { formatCompactCurrency, percentChange } from "@/src/domain/analytics";

type FinancialMetric = keyof Pick<AnnualFinancials, "revenue" | "operatingIncome" | "netIncome" | "freeCashFlow">;

const metricLabels: Record<FinancialMetric, string> = {
  revenue: "Revenue",
  operatingIncome: "Operating income",
  netIncome: "Net income",
  freeCashFlow: "Free cash flow",
};

export function FundamentalChart({ annuals, companyName }: { annuals: AnnualFinancials[]; companyName: string }) {
  const [metric, setMetric] = useState<FinancialMetric>("revenue");
  const validAnnuals = useMemo(() => annuals.slice(-10), [annuals]);
  const [selectedYear, setSelectedYear] = useState<number | null>(validAnnuals.at(-1)?.year ?? null);
  const selectedIndex = Math.max(0, validAnnuals.findIndex((annual) => annual.year === selectedYear));
  const selected = validAnnuals[selectedIndex] ?? validAnnuals.at(-1);
  const previous = validAnnuals[selectedIndex - 1];
  const value = selected?.[metric] ?? null;
  const priorValue = previous?.[metric] ?? null;
  const growth = value != null && priorValue != null && priorValue !== 0 ? percentChange(value, priorValue) : null;
  const allValues = validAnnuals.map((annual) => annual[metric] ?? 0);
  const maxMagnitude = Math.max(1, ...allValues.map(Math.abs));
  const firstValue = validAnnuals[0]?.[metric] ?? null;
  const lastValue = validAnnuals.at(-1)?.[metric] ?? null;
  const periods = Math.max(1, validAnnuals.length - 1);
  const cagr = firstValue != null && lastValue != null && firstValue > 0 && lastValue > 0
    ? ((lastValue / firstValue) ** (1 / periods) - 1) * 100
    : null;

  return (
    <div className="fundamental-chart">
      <div className="fundamental-chart__toolbar">
        <div className="segmented-control segmented-control--compact" aria-label="Fundamental metric">
          {(Object.keys(metricLabels) as FinancialMetric[]).map((item) => (
            <button key={item} className={metric === item ? "is-active" : ""} aria-pressed={metric === item} onClick={() => setMetric(item)}>{metricLabels[item]}</button>
          ))}
        </div>
        <span className="method-chip">{cagr == null ? "Reported annuals" : `${cagr >= 0 ? "+" : ""}${cagr.toFixed(1)}% CAGR`}</span>
      </div>

      <div className="fundamental-readout" aria-live="polite">
        <div><span>FY {selected?.year ?? "-"}</span><strong>{formatCompactCurrency(value)}</strong></div>
        <div><span>Year over year</span><b className={growth == null ? "muted" : growth >= 0 ? "positive" : "negative"}>{growth == null ? "Not available" : `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`}</b></div>
        <small>Point to a fiscal year for the reported value</small>
      </div>

      <div className="fundamental-bars" role="img" aria-label={`${companyName} ${metricLabels[metric]} for the last ${validAnnuals.length} fiscal years`}>
        <span className="fundamental-bars__zero">0</span>
        {validAnnuals.map((annual) => {
          const annualValue = annual[metric];
          const magnitude = annualValue == null ? 0 : Math.max(2, (Math.abs(annualValue) / maxMagnitude) * 46);
          const selectedBar = annual.year === selected?.year;
          return (
            <button
              key={annual.end}
              className={`fundamental-bar ${selectedBar ? "is-selected" : ""} ${annualValue != null && annualValue < 0 ? "is-negative" : ""}`}
              onPointerEnter={() => setSelectedYear(annual.year)}
              onFocus={() => setSelectedYear(annual.year)}
              onClick={() => setSelectedYear(annual.year)}
              aria-label={`Fiscal ${annual.year}: ${formatCompactCurrency(annualValue)}`}
            >
              <span className="fundamental-bar__track"><i style={{ "--bar-size": `${magnitude}%` } as React.CSSProperties} /></span>
              <b>FY{String(annual.year).slice(-2)}</b>
            </button>
          );
        })}
      </div>
    </div>
  );
}
