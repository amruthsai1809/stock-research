import { describe, expect, it } from "vitest";
import type { AnalyzedStock, AnnualFinancials } from "@/src/domain/stock";
import { calculateCompanySnapshot } from "@/src/features/company/companySnapshotMetrics";

const annual = (overrides: Partial<AnnualFinancials> = {}): AnnualFinancials => ({
  year: 2026,
  end: "2026-06-30",
  filed: "2026-08-01",
  accession: null,
  revenue: 100,
  grossProfit: 80,
  operatingIncome: 25,
  netIncome: 20,
  operatingCashFlow: 24,
  capex: -4,
  freeCashFlow: 20,
  assets: 200,
  liabilities: 80,
  equity: 120,
  cash: 30,
  longTermDebt: 10,
  shares: 10,
  dilutedEps: 2,
  depreciationAndAmortization: null,
  ebitda: null,
  researchAndDevelopment: null,
  stockCompensation: null,
  buybacks: null,
  dividends: -2,
  fiscalYearEndPrice: null,
  priceToEarnings: null,
  sourceConcepts: {},
  ...overrides,
});

const stock = (overrides: Partial<AnalyzedStock> = {}): AnalyzedStock => ({
  symbol: "TEST",
  name: "Test Company",
  sector: "Technology",
  industry: "Software",
  currency: "USD",
  reportingCurrency: "USD",
  latestPrice: 10,
  latestAnnual: annual(),
  previousAnnual: annual({ year: 2025, operatingIncome: 20 }),
  operatingMargin: 25,
  ...overrides,
} as AnalyzedStock);

describe("company snapshot metrics", () => {
  it("uses one consistent market value for valuation and capital metrics", () => {
    const result = calculateCompanySnapshot(stock(), 1_000);

    expect(result.marketCap).toBe(1_000);
    expect(result.marketCapEstimated).toBe(false);
    expect(result.priceToEarnings).toBe(50);
    expect(result.freeCashFlowYield).toBe(2);
    expect(result.dividendYield).toBe(0.2);
    expect(result.netCashDebt).toBe(20);
    expect(result.operatingMarginChange).toBe(5);
  });

  it("estimates market cap from reported shares only when the market snapshot is absent", () => {
    const result = calculateCompanySnapshot(stock(), null);

    expect(result.marketCap).toBe(100);
    expect(result.marketCapEstimated).toBe(true);
  });

  it("explains when P/E is not meaningful and avoids cross-currency yields", () => {
    const loss = calculateCompanySnapshot(stock({ latestAnnual: annual({ netIncome: -5 }) }), 1_000);
    expect(loss.priceToEarnings).toBeNull();
    expect(loss.priceToEarningsReason).toContain("non-positive");

    const mixedCurrency = calculateCompanySnapshot(stock({ reportingCurrency: "EUR" }), 1_000);
    expect(mixedCurrency.freeCashFlowYield).toBeNull();
    expect(mixedCurrency.dividendYield).toBeNull();
    expect(mixedCurrency.freeCashFlowYieldReason).toContain("currencies differ");
  });

  it("suppresses generic net debt comparisons for financial institutions", () => {
    const result = calculateCompanySnapshot(stock({ sector: "Financial Services", industry: "Banks" }), 1_000);

    expect(result.netCashDebt).toBeNull();
    expect(result.netCashDebtReason).toContain("Not comparable");
  });
});
