import { describe, expect, it } from "vitest";
import { buildExposureSignals, filerStats, tradeAction, type GovernmentProfile, type GovernmentTrade } from "@/src/domain/government";

describe("government disclosure domain", () => {
  it("sorts inferred exposure by amount and closes explicit full-sale episodes", () => {
    const signals = buildExposureSignals([
      trade({ id: "a-buy", ticker: "AAPL", transaction_date: "2025-01-05", transaction_type: "Purchase", amount_range_low: 100, amount_range_high: 100 }),
      trade({ id: "a-sell", ticker: "AAPL", transaction_date: "2025-06-05", transaction_type: "Sale (Partial)", amount_range_low: 20, amount_range_high: 20 }),
      trade({ id: "m-buy", ticker: "MSFT", transaction_date: "2024-03-03", transaction_type: "Purchase", amount_range_low: 200, amount_range_high: 200 }),
      trade({ id: "g-buy", ticker: "GOOG", transaction_date: "2025-02-02", transaction_type: "Purchase", amount_range_low: 500, amount_range_high: 500 }),
      trade({ id: "g-close", ticker: "GOOG", transaction_date: "2025-04-02", transaction_type: "Sale (Full)", amount_range_low: 500, amount_range_high: 500 }),
      trade({ id: "undated", ticker: "NVDA", transaction_date: null, transaction_type: "Purchase", amount_range_low: 1_000, amount_range_high: 1_000 }),
    ]);
    expect(signals.map((signal) => [signal.ticker, signal.estimatedNetActivity])).toEqual([["MSFT", 200], ["AAPL", 80]]);
    expect(signals[1]).toMatchObject({ firstReported: "2025-01-05", lastActivity: "2025-06-05", purchaseCount: 1, saleCount: 1 });
  });

  it("classifies actions and calculates profile statistics without inventing exact values", () => {
    const trades = [
      trade({ id: "buy", transaction_type: "Buy", amount_range_low: 10, amount_range_high: 30, days_to_file: 10 }),
      trade({ id: "sale", transaction_type: "Sale", amount_range_low: 50, amount_range_high: null, days_to_file: 50, is_late: 1 }),
      trade({ id: "exchange", transaction_type: "Exchange", amount_range_low: 5, amount_range_high: 15, days_to_file: null }),
    ];
    expect(trades.map(tradeAction)).toEqual(["purchase", "sale", "exchange"]);
    const profile = { filer: {} as GovernmentProfile["filer"], trades, historyTruncated: false, totalTradeCount: trades.length };
    expect(filerStats(profile)).toEqual({ purchases: 1, sales: 1, medianLag: 50, lateRate: 50, volume: 80 });
  });
});

function trade(overrides: Partial<GovernmentTrade>): GovernmentTrade {
  return {
    id: "trade", source_id: "house_clerk", transaction_date: "2025-01-01", filing_date: "2025-01-10", owner: "SELF", ticker: "AAPL",
    asset_name: "Apple Inc.", asset_type: "Stock", transaction_type: "Purchase", amount_range_low: 1, amount_range_high: 1,
    amount_range_label: "$1", days_to_file: 9, is_late: 0, comment: null, filer_id: "filer", doc_url: "https://example.com/filing", filing_type: "PTR",
    ret_since: null, excess_since: null, ret_30d: null, ret_1y: null, ...overrides,
  };
}
