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
    const raw = JSON.parse(readFileSync(path.resolve("public/data/signals/duol.json"), "utf8"));
    const duol = parseResearchSignal(raw);
    const categories = new Set(duol.insider.transactions.map((item) => item.category));

    expect(categories).toContain("personal_investment");
    expect([...categories].some((category) => ["sale", "scheduled_sale", "tax_sale"].includes(category))).toBe(true);
    expect(categories).toContain("award");
    expect(categories).toContain("option_exercise");
    expect(duol.insider.summary.purchaseCount).toBeGreaterThan(0);
    expect(duol.insider.summary.compensationCount).toBeGreaterThan(0);
  });
});
