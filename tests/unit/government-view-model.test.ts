import { describe, expect, it } from "vitest";
import type { GovernmentFiler, GovernmentTrade } from "@/src/domain/government";
import { buildGovernmentDirectory, filterGovernmentTrades, latestDatedTrade, timeCutoff } from "@/src/features/government/governmentViewModel";

describe("government view model", () => {
  const filers = [
    filer({ id: "current", full_name: "Current House", active: true, chamber: "house", latestTransactionDate: "2026-06-01" }),
    filer({ id: "archive", full_name: "Former Senator", active: false, chamber: "senate", latestTransactionDate: "2018-01-01" }),
    filer({ id: "executive", full_name: "Executive Officer", branch: "executive", active: null, chamber: null, latestTransactionDate: "2025-09-01", agency: "Treasury" }),
  ];

  it("applies universe, branch, and multi-term search filters deterministically", () => {
    expect(buildGovernmentDirectory(filers, { universe: "current", branch: "all", query: "" }).map((item) => item.id)).toEqual(["current"]);
    expect(buildGovernmentDirectory(filers, { universe: "all", branch: "executive", query: "executive treasury" }).map((item) => item.id)).toEqual(["executive"]);
    expect(buildGovernmentDirectory(filers, { universe: "archive", branch: "senate", query: "former" }).map((item) => item.id)).toEqual(["archive"]);
  });

  it("uses the true latest dated trade even when input is unsorted", () => {
    const trades = [trade({ id: "old", transaction_date: "2022-01-01", ticker: "MSFT" }), trade({ id: "missing", transaction_date: null }), trade({ id: "new", transaction_date: "2026-01-01", ticker: "NVDA" })];
    expect(latestDatedTrade(trades)).toBe("2026-01-01");
    expect(timeCutoff("2026-01-01", "3Y")).toBe("2023-01-01");
    expect(filterGovernmentTrades(trades, { action: "purchase", time: "3Y", query: "nvda" }).map((item) => item.id)).toEqual(["new"]);
    expect(filterGovernmentTrades(trades, { action: "all", time: "ALL", query: "" }).map((item) => item.id)).toEqual(["old", "new"]);
  });
});

function filer(overrides: Partial<GovernmentFiler>): GovernmentFiler {
  return { id: "filer", full_name: "Filer", branch: "congress", chamber: "house", party: "I", state: "CA", agency: null, level: null, office: null, photo_url: null, trade_count: 1, purchases: 1, sales: 0, late_filings: 0, est_volume: 1, active: true, bioguide_id: null, latestTransactionDate: "2026-01-01", loadedTradeCount: 1, ...overrides };
}
function trade(overrides: Partial<GovernmentTrade>): GovernmentTrade {
  return { id: "trade", source_id: "house_clerk", transaction_date: "2025-01-01", filing_date: "2025-01-10", owner: "SELF", ticker: "AAPL", asset_name: "Apple", asset_type: "Stock", transaction_type: "Purchase", amount_range_low: 1, amount_range_high: 1, amount_range_label: "$1", days_to_file: 9, is_late: 0, comment: null, filer_id: "filer", doc_url: "https://example.com", filing_type: "PTR", ret_since: null, excess_since: null, ret_30d: null, ret_1y: null, ...overrides };
}
