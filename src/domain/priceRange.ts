import type { PricePoint } from "@/src/domain/stock";

export type PriceRangeKey = "1M" | "3M" | "6M" | "YTD" | "1Y" | "3Y" | "5Y";

export function priceRangeCutoff(lastDate: string, range: PriceRangeKey) {
  const last = new Date(`${lastDate}T00:00:00Z`);
  if (range === "YTD") return `${last.getUTCFullYear()}-01-01`;
  const cutoff = new Date(last);
  if (range.endsWith("Y")) cutoff.setUTCFullYear(cutoff.getUTCFullYear() - Number.parseInt(range, 10));
  else cutoff.setUTCMonth(cutoff.getUTCMonth() - Number.parseInt(range, 10));
  return cutoff.toISOString().slice(0, 10);
}

export function selectPriceRange(prices: PricePoint[], range: PriceRangeKey) {
  if (!prices.length) return [];
  const cutoff = priceRangeCutoff(prices.at(-1)!.date, range);
  return prices.filter((point) => point.date >= cutoff);
}

export function priceRangeLabel(prices: PricePoint[]) {
  if (!prices.length) return "No sessions";
  return `${formatRangeDate(prices[0].date)} – ${formatRangeDate(prices.at(-1)!.date)} · ${prices.length.toLocaleString()} sessions`;
}

function formatRangeDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}
