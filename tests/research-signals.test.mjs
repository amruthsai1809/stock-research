import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const marketUrl = new URL("../public/data/market-data.json", import.meta.url);
const signalsUrl = new URL("../public/data/research-signals.json", import.meta.url);
const institutionalUrl = new URL("../public/data/institutional/index.json", import.meta.url);

test("stock-intelligence snapshot covers the complete market universe", async () => {
  const market = JSON.parse(await readFile(marketUrl, "utf8"));
  const dataset = JSON.parse(await readFile(signalsUrl, "utf8"));
  assert.match(dataset.methodology, /computed locally/i);
  assert.match(dataset.sources.insiders, /^https:\/\/www\.sec\.gov\//);
  assert.match(dataset.sources.institutions, /^https:\/\/www\.sec\.gov\//);
  assert.match(dataset.sources.analysts, /^https:\/\/finance\.yahoo\.com\//);
  assert.deepEqual(Object.keys(dataset.signals).sort(), market.stocks.map((stock) => stock.symbol).sort());
  assert.ok(new Date(dataset.generatedAt).getTime() > 0);
});

test("insider signal uses only source-linked open-market transactions", async () => {
  const dataset = JSON.parse(await readFile(signalsUrl, "utf8"));
  const populated = Object.values(dataset.signals).filter((signal) => signal.insider.transactions.length);
  assert.ok(populated.length >= 12, "recent insider coverage is unexpectedly sparse");
  for (const signal of Object.values(dataset.signals)) {
    const keys = new Set();
    for (const transaction of signal.insider.transactions) {
      assert.ok(transaction.code === "P" || transaction.code === "S");
      assert.equal(transaction.action, transaction.code === "P" ? "purchase" : "sale");
      assert.match(transaction.transactionDate, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(transaction.filingDate, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(transaction.sourceUrl, /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//);
      assert.ok(transaction.shares >= 0);
      assert.ok(transaction.value == null || transaction.value >= 0);
      const key = [transaction.accession, transaction.ownerName, transaction.transactionDate, transaction.code, transaction.shares].join("|");
      assert.ok(!keys.has(key), `${signal.symbol} contains a duplicated insider transaction`);
      keys.add(key);
    }
  }
});

test("institutional signal excludes archived managers and market snapshots remain explicit", async () => {
  const dataset = JSON.parse(await readFile(signalsUrl, "utf8"));
  const index = JSON.parse(await readFile(institutionalUrl, "utf8"));
  const activeCount = index.managers.filter((manager) => manager.lifecycle.status === "active").length;
  assert.equal(index.managers.find((manager) => manager.id === "scion")?.lifecycle.status, "archived");
  for (const signal of Object.values(dataset.signals)) {
    const item = signal.institutional;
    assert.match(item.reportDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(item.filingDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(item.managersHolding <= activeCount);
    if (signal.analyst.available) {
      assert.ok(signal.analyst.numberOfAnalysts > 0);
      assert.ok(signal.analyst.recommendationMean == null || signal.analyst.recommendationMean > 0);
      assert.ok(Array.isArray(signal.analyst.trend));
      assert.ok(Array.isArray(signal.analyst.actions));
    } else {
      assert.ok(signal.analyst.reason, `${signal.symbol} must explain unavailable analyst data`);
    }
    if (signal.shortInterest.available) {
      assert.match(signal.shortInterest.asOf, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(signal.shortInterest.sharesShort == null || signal.shortInterest.sharesShort >= 0);
      assert.ok(signal.shortInterest.shortPercentOfFloat == null || signal.shortInterest.shortPercentOfFloat >= 0);
    }
  }
});
