import type { OptionAnalysis } from "@/src/application/options/types";

export function formatOptionCurrency(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits }).format(value);
}

export function formatOptionPercent(value: number, maximumFractionDigits = 1): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(maximumFractionDigits)}%`;
}

export function describeOutcome(analysis: OptionAnalysis, targetSpotPrice: number, currentSpotPrice: number): string {
  const movement = (targetSpotPrice / currentSpotPrice - 1) * 100;
  const direction = movement >= 0 ? "rises" : "falls";
  const result = analysis.targetProfitLossDollars >= 0 ? "modeled profit" : "modeled loss";
  return `If the stock ${direction} ${Math.abs(movement).toFixed(1)}%, this scenario shows a ${result} of ${formatOptionCurrency(Math.abs(analysis.targetProfitLossDollars))}.`;
}

export function formatDateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}
