import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyInsiderTransaction,
  groupInsiderTransactions,
  reconcileInsiderEvidence,
  summarizeInsiderTransactions,
} from "../scripts/lib/insiderTransactions.mjs";

test("Form 4 transactions are classified from their codes and filing evidence", () => {
  assert.equal(classifyInsiderTransaction({ code: "P" }), "personal_investment");
  assert.equal(classifyInsiderTransaction({ code: "S", rule10b51: true }), "scheduled_sale");
  assert.equal(classifyInsiderTransaction({ code: "S", rule10b51: true, filingContext: "Automatically sold to cover tax withholding obligations." }), "tax_sale");
  assert.equal(classifyInsiderTransaction({ code: "A" }), "award");
  assert.equal(classifyInsiderTransaction({ code: "M" }), "option_exercise");
  assert.equal(classifyInsiderTransaction({ code: "F" }), "tax_withholding");
  assert.equal(classifyInsiderTransaction({ code: "G" }), "gift");
});

test("price lots from one filing become one understandable ownership event", () => {
  const base = {
    accession: "0000000000-26-000001",
    ownerName: "Example Insider",
    ownerRole: "Officer",
    transactionDate: "2026-03-03",
    filingDate: "2026-03-04",
    code: "P",
    action: "purchase",
    direction: "acquired",
    securityTitle: "Class A Common Stock",
    sharesOwnedAfter: 20_000,
    directOrIndirect: "direct",
    natureOfOwnership: null,
    rule10b51: false,
    filingContext: null,
    sourceUrl: "https://www.sec.gov/Archives/edgar/data/1/filing.txt",
  };
  const grouped = groupInsiderTransactions([
    { ...base, shares: 1_000, price: 90, value: 90_000 },
    { ...base, shares: 4_000, price: 102.2, value: 408_800 },
  ]);

  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].category, "personal_investment");
  assert.equal(grouped[0].shares, 5_000);
  assert.equal(grouped[0].value, 498_800);
  assert.equal(grouped[0].price, 99.76);
});

test("summary keeps investments, sales, compensation, and administration separate", () => {
  const make = (category, value = null) => ({ category, value });
  const summary = summarizeInsiderTransactions([
    make("personal_investment", 500_000),
    make("sale", 100_000),
    make("scheduled_sale", 200_000),
    make("tax_sale", 50_000),
    make("award"),
    make("option_exercise"),
    make("tax_withholding"),
    make("gift"),
  ]);

  assert.deepEqual(summary, {
    purchaseCount: 1,
    saleCount: 3,
    purchaseValue: 500_000,
    saleValue: 350_000,
    discretionarySaleCount: 1,
    scheduledSaleCount: 1,
    taxRelatedSaleCount: 1,
    compensationCount: 2,
    administrativeCount: 2,
  });
});

test("fresh SEC evidence replaces an older contract without multiplying the event", () => {
  const legacy = {
    accession: "0000000000-26-000002",
    ownerName: "Example Insider",
    ownerRole: "Officer",
    transactionDate: "2026-08-18",
    filingDate: "2026-08-19",
    code: "S",
    action: "sale",
    shares: 1_539,
    price: 137.803,
    value: 212_078.817,
    sharesOwnedAfter: 169_111,
    rule10b51: true,
    sourceUrl: "https://www.sec.gov/Archives/edgar/data/1/legacy.xml",
  };
  const enriched = {
    ...legacy,
    price: 137.80288356075374,
    value: 212_078.6378,
    category: "scheduled_sale",
    direction: "disposed",
    securityTitle: "Class A Common Stock",
    directOrIndirect: "direct",
    natureOfOwnership: null,
    filingContext: "The sale was effected pursuant to a Rule 10b5-1 trading plan.",
    sourceUrl: "https://www.sec.gov/Archives/edgar/data/1/current.xml",
  };

  const reconciled = reconcileInsiderEvidence({ previousRows: [legacy], bulkRows: [enriched], liveRows: [enriched], cutoff: "2025-08-30" });
  assert.equal(reconciled.length, 1);
  assert.equal(reconciled[0].shares, 1_539);
  assert.equal(reconciled[0].category, "scheduled_sale");
  assert.match(reconciled[0].filingContext, /10b5-1/);
});
