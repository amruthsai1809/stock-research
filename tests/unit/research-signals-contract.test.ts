import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseResearchSignal, parseResearchSignals } from "@/src/shared/contracts/researchSignals";

describe("research signal contracts", () => {
  it("upgrades the checked-in bootstrap snapshot without losing insider evidence", () => {
    const raw = JSON.parse(readFileSync(path.resolve("public/data/research-signals.json"), "utf8"));
    const parsed = parseResearchSignals(raw);
    const apple = parsed.signals.AAPL;
    const purchases = apple.insider.transactions.filter((item) => item.action === "purchase");
    const sales = apple.insider.transactions.filter((item) => item.action === "sale");

    expect(apple.insider.summary.purchaseCount).toBe(purchases.length);
    expect(apple.insider.summary.saleCount).toBe(sales.length);
    expect(apple.institutional.expectedManagers).toBeGreaterThanOrEqual(0);
    expect(apple.shortInterest.history).toEqual([]);
    expect(parsed.sources.shortInterest).toMatch(/^https:\/\/www\.finra\.org\//);
  });

  it("preserves complete Form 4 categories in the per-company detail contract", () => {
    const transaction = (code: string, category: string, index: number) => ({
      accession: `0000000000-26-00000${index}`,
      ownerName: `Test owner ${index}`,
      ownerRole: "Officer",
      transactionDate: `2026-03-0${index}`,
      filingDate: `2026-03-0${index}`,
      code,
      category,
      direction: category === "sale" ? "disposed" : "acquired",
      securityTitle: "Common stock",
      shares: 100,
      price: 10,
      value: 1_000,
      sharesOwnedAfter: 1_000,
      directOrIndirect: "direct",
      natureOfOwnership: null,
      rule10b51: false,
      filingContext: null,
      sourceUrl: `https://www.sec.gov/Archives/edgar/data/1/${index}`,
    });
    const duol = parseResearchSignal({
      symbol: "DUOL",
      insider: {
        asOf: "2026-03-04",
        transactions: [
          transaction("P", "personal_investment", 1),
          transaction("S", "sale", 2),
          transaction("A", "award", 3),
          transaction("M", "option_exercise", 4),
        ],
      },
      institutional: {
        reportDate: null,
        filingDate: null,
        expectedManagers: 0,
        managersReported: 0,
        managersHolding: 0,
        managersIncreased: 0,
        managersReduced: 0,
        managersNew: 0,
        managersExited: 0,
      },
      analyst: {
        available: false,
        reason: "Fixture intentionally omits analyst coverage.",
        asOf: null,
        recommendationKey: null,
        recommendationMean: null,
        numberOfAnalysts: 0,
        targetLow: null,
        targetMean: null,
        targetMedian: null,
        targetHigh: null,
        targetUpside: null,
        trend: [],
        actions: [],
      },
      shortInterest: {
        available: false,
        asOf: null,
        sharesShort: null,
        sharesShortPriorMonth: null,
        shortPercentOfFloat: null,
        sharesPercentOutstanding: null,
        daysToCover: null,
        institutionalOwnership: null,
        insiderOwnership: null,
        sourceUrl: null,
        history: [],
      },
    });
    const categories = new Set(duol.insider.transactions.map((item) => item.category));

    expect(categories).toContain("personal_investment");
    expect([...categories].some((category) => ["sale", "scheduled_sale", "tax_sale"].includes(category))).toBe(true);
    expect(categories).toContain("award");
    expect(categories).toContain("option_exercise");
    expect(duol.insider.summary.purchaseCount).toBeGreaterThan(0);
    expect(duol.insider.summary.compensationCount).toBeGreaterThan(0);
  });
});
