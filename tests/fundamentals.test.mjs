import assert from "node:assert/strict";
import test from "node:test";
import { extractAnnualFundamentals } from "../scripts/market/fundamentals.mjs";

const annual = (year, value, form = "10-K") => ({
  start: `${year}-01-01`,
  end: `${year}-12-31`,
  val: value,
  accn: `0000000000-${String(year).slice(-2)}-000001`,
  filed: `${year + 1}-02-15`,
  form,
});

const instant = (year, value, form = "10-K") => ({
  end: `${year}-12-31`,
  val: value,
  accn: `0000000000-${String(year).slice(-2)}-000001`,
  filed: `${year + 1}-02-15`,
  form,
});

const concept = (unit, entries) => ({ units: { [unit]: entries } });

test("normalizes US GAAP 10-K facts without accepting quarterly contexts", () => {
  const result = extractAnnualFundamentals({
    "us-gaap": {
      RevenueFromContractWithCustomerExcludingAssessedTax: concept("USD", [annual(2023, 100), annual(2024, 120), annual(2024, 40, "10-Q")]),
      NetIncomeLoss: concept("USD", [annual(2023, 10), annual(2024, 15)]),
      NetCashProvidedByUsedInOperatingActivities: concept("USD", [annual(2023, 20), annual(2024, 24)]),
      PaymentsToAcquirePropertyPlantAndEquipment: concept("USD", [annual(2023, 5), annual(2024, 6)]),
      Assets: concept("USD", [instant(2023, 200), instant(2024, 230)]),
    },
  });

  assert.equal(result.reportingCurrency, "USD");
  assert.equal(result.fundamentalsTaxonomy, "us-gaap");
  assert.deepEqual(result.annuals.map((entry) => entry.revenue), [100, 120]);
  assert.equal(result.annuals.at(-1).freeCashFlow, 18);
  assert.equal(result.annuals.at(-1).assets, 230);
  assert.equal(result.annuals.at(-1).sourceConcepts.revenue, "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax");
});

test("normalizes IFRS 20-F facts in the issuer's reporting currency", () => {
  const result = extractAnnualFundamentals({
    "ifrs-full": {
      Revenue: concept("EUR", [annual(2023, 13_000, "20-F"), annual(2024, 15_000, "20-F")]),
      GrossProfit: concept("EUR", [annual(2023, 3_000, "20-F"), annual(2024, 4_000, "20-F")]),
      ProfitLossFromOperatingActivities: concept("EUR", [annual(2023, 500, "20-F"), annual(2024, 900, "20-F")]),
      ProfitLoss: concept("EUR", [annual(2023, 400, "20-F"), annual(2024, 800, "20-F")]),
      CashFlowsFromUsedInOperatingActivities: concept("EUR", [annual(2023, 1_000, "20-F"), annual(2024, 1_400, "20-F")]),
      PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities: concept("EUR", [annual(2023, 100, "20-F"), annual(2024, 150, "20-F")]),
      Assets: concept("EUR", [instant(2023, 9_000, "20-F"), instant(2024, 11_000, "20-F")]),
      DilutedEarningsLossPerShare: concept("EUR/shares", [annual(2023, 2.1, "20-F"), annual(2024, 4.2, "20-F")]),
    },
  });

  assert.equal(result.reportingCurrency, "EUR");
  assert.equal(result.fundamentalsTaxonomy, "ifrs-full");
  assert.equal(result.annuals.length, 2);
  assert.equal(result.annuals.at(-1).revenue, 15_000);
  assert.equal(result.annuals.at(-1).freeCashFlow, 1_250);
  assert.equal(result.annuals.at(-1).dilutedEps, 4.2);
  assert.equal(result.annuals.at(-1).sourceConcepts.revenue, "ifrs-full:Revenue");
});
