import { describe, expect, it } from "vitest";
import { summarizeGovernmentFiler } from "../../scripts/lib/governmentLeaderboard.mjs";

describe("government leaderboard policy", () => {
  it("excludes derivatives from performance and adjusts consistency for sample size", () => {
    const trades = [
      ...Array.from({ length: 20 }, (_, index) => trade({ id: `stock-${index}`, ticker: "AAA", transaction_date: `2023-01-${String(index + 1).padStart(2, "0")}`, ret_1y: index < 18 ? 20 : -10 })),
      trade({ id: "option", ticker: "AAA", asset_name: "AAA call option", comment: "Call option", ret_1y: 500 }),
    ];
    const summary = summarizeGovernmentFiler(filer(), trades, { historyTruncated: false });
    expect(summary.performanceSample).toBe(20);
    expect(summary.purchaseWinRate1Y).toBe(90);
    expect(summary.reliabilityScore1Y!).toBeLessThan(summary.purchaseWinRate1Y!);
    expect(summary.medianPurchaseReturn1Y).toBe(20);
    expect(summary.confidence).toBe("high");
  });
});

function filer() { return { id: "filer", full_name: "Filer", branch: "congress", chamber: "house", party: "I", state: "CA", office: "House", agency: null, photo_url: null, active: true, latestTransactionDate: "2025-01-01", trade_count: 20, est_volume: 20 }; }
function trade(overrides: Record<string, unknown>) { return { id: "trade", transaction_type: "Purchase", transaction_date: "2023-01-01", ticker: "AAA", asset_name: "AAA stock", comment: null, amount_range_low: 1, amount_range_high: 1, ret_1y: 10, ret_since: 10, excess_since: 5, ...overrides }; }
