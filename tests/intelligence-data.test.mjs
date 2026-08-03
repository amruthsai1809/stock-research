import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const institutionalUrl = new URL("../public/data/institutional-data.json", import.meta.url);
const governmentUrl = new URL("../public/data/government-data.json", import.meta.url);
const benchmarkUrl = new URL("../public/data/benchmark-data.json", import.meta.url);

test("portfolio benchmarks contain long, chronological end-of-day histories", async () => {
  const dataset = JSON.parse(await readFile(benchmarkUrl, "utf8"));
  assert.match(dataset.source, /end-of-day/i);
  assert.deepEqual(dataset.benchmarks.map((item) => item.symbol).sort(), ["QQQ", "SPY", "VTI"]);
  for (const benchmark of dataset.benchmarks) {
    assert.ok(benchmark.prices.length >= 2_400, `${benchmark.symbol} requires approximately ten years of history`);
    const dates = benchmark.prices.map((point) => point.date);
    assert.deepEqual(dates, [...dates].sort());
    assert.ok(benchmark.prices.every((point) => point.adjustedClose > 0));
  }
});

test("13F snapshot retains source lineage and usable quarter history", async () => {
  const dataset = JSON.parse(await readFile(institutionalUrl, "utf8"));
  assert.ok(dataset.generatedAt);
  assert.match(dataset.source, /SEC EDGAR/i);
  assert.ok(dataset.managers.length >= 8);
  assert.ok(dataset.managers.filter((manager) => manager.quarters.length >= 6).length >= 7);
  const populated = dataset.managers.filter((manager) => manager.quarters.some((quarter) => quarter.holdings.length));
  assert.ok(populated.length >= 6, "at least six managers need parsed holdings");
  for (const manager of populated) {
    const quarter = manager.quarters.find((item) => item.holdings.length);
    assert.match(quarter.reportDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(quarter.sourceUrl, /^https:\/\/www\.sec\.gov\//);
    assert.ok(quarter.totalValue > 0);
    assert.ok(quarter.holdings.every((holding) => holding.value > 0 && holding.weight >= 0));
    assert.ok(quarter.holdings.slice(0, 10).reduce((sum, holding) => sum + holding.weight, 0) <= 100.01);
  }
});

test("public-official snapshot uses ranges and links every transaction to an official filing", async () => {
  const dataset = JSON.parse(await readFile(governmentUrl, "utf8"));
  assert.ok(dataset.generatedAt);
  assert.match(dataset.source, /House of Representatives/i);
  assert.match(dataset.methodology, /range/i);
  assert.ok(dataset.officials.length >= 5);
  assert.ok(dataset.officials.some((official) => official.holdings.length >= 10));
  assert.ok(dataset.officials.filter((official) => official.transactions.length).length >= 3);
  for (const official of dataset.officials) {
    for (const holding of official.holdings) {
      assert.ok(holding.value.minimum >= 0);
      assert.ok(holding.value.maximum == null || holding.value.maximum >= holding.value.minimum);
    }
    for (const transaction of official.transactions) {
      assert.match(transaction.transactionDate, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(transaction.sourceUrl, /^https:\/\/disclosures-clerk\.house\.gov\//);
      assert.ok(["purchase", "sale", "exchange"].includes(transaction.type));
      assert.ok(transaction.amount.minimum >= 0);
    }
  }
});
