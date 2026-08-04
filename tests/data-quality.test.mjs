import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dataUrl = new URL("../public/data/market-data.json", import.meta.url);

test("market snapshot passes coverage and ordering checks", async () => {
  const dataset = JSON.parse(await readFile(dataUrl, "utf8"));
  assert.ok(dataset.generatedAt);
  assert.match(dataset.priceAsOf, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(dataset.stocks.length >= 20);
  assert.equal(new Set(dataset.stocks.map((stock) => stock.symbol)).size, dataset.stocks.length);

  for (const stock of dataset.stocks) {
    assert.match(stock.symbol, /^[A-Z.]{1,6}$/);
    assert.ok(stock.prices.length >= 1_000, `${stock.symbol} requires five years of trading history`);
    assert.ok(new Date(stock.prices.at(-1).date).getTime() - new Date(stock.prices[0].date).getTime() >= 4.9 * 365 * 86_400_000, `${stock.symbol} price span must visibly cover five years`);
    assert.ok(stock.annuals.length >= 4, `${stock.symbol} requires four annual observations`);
    assert.ok(stock.prices.every((point) => point.adjustedClose > 0));
    const dates = stock.prices.map((point) => point.date);
    assert.deepEqual(dates, [...dates].sort(), `${stock.symbol} prices must be chronological`);
    assert.equal(new Set(dates).size, dates.length, `${stock.symbol} contains duplicate dates`);
    assert.ok(stock.annuals.some((annual) => annual.revenue != null || annual.netIncome != null));
    assert.ok(stock.annuals.some((annual) => annual.dilutedEps != null), `${stock.symbol} requires annual EPS history`);
    assert.ok(stock.annuals.some((annual) => annual.fiscalYearEndPrice != null), `${stock.symbol} requires fiscal-year price history`);
    const latest = stock.annuals.at(-1);
    assert.ok(Object.keys(latest.sourceConcepts ?? {}).length >= 4, `${stock.symbol} requires metric lineage`);
  }
});

test("published snapshot contains explicit source labels", async () => {
  const dataset = JSON.parse(await readFile(dataUrl, "utf8"));
  assert.match(dataset.sources.prices, /end-of-day/i);
  assert.match(dataset.sources.fundamentals, /SEC EDGAR/i);
});
