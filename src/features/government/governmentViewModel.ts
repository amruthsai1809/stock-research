import { tradeAction, type GovernmentFiler, type GovernmentTrade } from "@/src/domain/government";

export type ActionFilter = "all" | "purchase" | "sale" | "exchange" | "other";
export type UniverseFilter = "current" | "recent" | "all" | "archive";
export type BranchFilter = "all" | "house" | "senate" | "executive";
export type TimeFilter = "1Y" | "3Y" | "5Y" | "ALL";

export function buildGovernmentDirectory(filers: GovernmentFiler[], filters: { universe: UniverseFilter; branch: BranchFilter; query: string }) {
  const recentCutoff = recentCutoffTime(filers);
  return filers.filter((filer) => {
    const latestMs = Date.parse(`${filer.latestTransactionDate}T00:00:00Z`);
    if (filters.universe === "current" && filer.active !== true) return false;
    if (filters.universe === "recent" && latestMs < recentCutoff) return false;
    if (filters.universe === "archive" && filer.active !== false) return false;
    if (filters.branch === "executive" && filer.branch !== "executive") return false;
    if (filters.branch !== "all" && filters.branch !== "executive" && filer.chamber !== filters.branch) return false;
    return matchesSearch(`${filer.full_name} ${filer.state ?? ""} ${filer.office ?? ""} ${filer.agency ?? ""}`, filters.query);
  }).sort((a, b) => b.latestTransactionDate.localeCompare(a.latestTransactionDate) || b.trade_count - a.trade_count);
}

export function filterGovernmentTrades(trades: GovernmentTrade[], filters: { action: ActionFilter; time: TimeFilter; query: string }) {
  const latestDate = latestDatedTrade(trades) ?? new Date().toISOString().slice(0, 10);
  const cutoff = timeCutoff(latestDate, filters.time);
  const query = filters.query.trim().toLowerCase();
  return trades.filter((trade) => {
    const action = tradeAction(trade);
    return (trade.transaction_date ?? "") >= cutoff
      && (filters.action === "all" || action === filters.action)
      && `${trade.ticker ?? ""} ${trade.asset_name} ${trade.owner ?? ""}`.toLowerCase().includes(query);
  });
}

export function latestDatedTrade(trades: GovernmentTrade[]) {
  return trades.reduce<string | null>((latest, trade) => !trade.transaction_date || latest && trade.transaction_date <= latest ? latest : trade.transaction_date, null);
}

export function timeCutoff(latest: string, range: TimeFilter) {
  if (range === "ALL") return "0000-01-01";
  const date = new Date(`${latest}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() - Number.parseInt(range));
  return date.toISOString().slice(0, 10);
}

function recentCutoffTime(filers: GovernmentFiler[]) {
  const latest = filers.reduce((value, filer) => filer.latestTransactionDate > value ? filer.latestTransactionDate : value, "1970-01-01");
  const date = new Date(`${latest}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() - 2);
  return date.getTime();
}

function matchesSearch(value: string, query: string) {
  const haystack = value.toLowerCase();
  return query.toLowerCase().trim().split(/\s+/).filter(Boolean).every((term) => haystack.includes(term));
}
