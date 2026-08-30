import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const splitIndexPath = path.join(root, "public", "data", "market", "index.json");
const legacyPath = path.join(root, "public", "data", "market-data.json");
const cloudflareAssetLimit = 25 * 1024 * 1024;

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

async function loadPublishedMarket() {
  if (await exists(splitIndexPath)) {
    const index = JSON.parse(await readFile(splitIndexPath, "utf8"));
    return {
      mode: "split",
      index,
      loadDetail: async (summary) => {
        const archive = JSON.parse(await readFile(path.join(root, "public", summary.dataPath.replace(/^\.\//, "")), "utf8"));
        const recent = JSON.parse(await readFile(path.join(root, "public", summary.recentDataPath.replace(/^\.\//, "")), "utf8"));
        assert.equal(archive.symbol, recent.symbol);
        return { ...archive, prices: [...archive.prices, ...recent.prices] };
      },
    };
  }
  const legacy = JSON.parse(await readFile(legacyPath, "utf8"));
  return {
    mode: "legacy",
    index: { ...legacy, schemaVersion: 1, universe: { scope: "sample", publishedCount: legacy.stocks.length, eligibleCount: legacy.stocks.length, minimumMarketCap: 0, historyYears: 5 } },
    loadDetail: async (stock) => stock,
  };
}

test("market snapshot passes universe, storage, and history quality gates", async () => {
  const published = await loadPublishedMarket();
  const { index } = published;
  assert.ok(new Date(index.generatedAt).getTime() > 0);
  assert.match(index.priceAsOf, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Set(index.stocks.map((stock) => stock.symbol)).size, index.stocks.length);
  assert.equal(index.universe.publishedCount, index.stocks.length);

  if (index.universe.scope === "full") {
    assert.ok(index.stocks.length >= 2_000, "the production universe must contain at least 2,000 eligible companies");
    assert.ok(index.stocks.length >= index.universe.eligibleCount * 0.9, "at least 90% of the screened universe must publish successfully");
    assert.equal(index.universe.minimumMarketCap, 1_000_000_000);
    assert.equal(index.universe.historyYears, 10);
    assert.ok(index.stocks.some((stock) => stock.symbol === "DUOL"), "Duolingo is a required acceptance symbol");
    const spotify = index.stocks.find((stock) => stock.symbol === "SPOT");
    assert.ok(spotify?.latestAnnual, "Spotify must retain normalized annual fundamentals");
    assert.equal(spotify.fundamentalsTaxonomy, "ifrs-full", "Spotify must be sourced from its IFRS filing taxonomy");
    assert.equal(spotify.reportingCurrency, "EUR", "Spotify fundamentals must retain their reported currency");
  } else {
    assert.ok(index.stocks.length >= 20, "the development fixture must exercise a useful cross-section");
  }

  if (published.mode === "split") {
    assert.ok((await stat(splitIndexPath)).size < cloudflareAssetLimit, "the startup index must fit Cloudflare's per-asset limit");
  }

  let fundamentalsCovered = 0;
  for (const summary of index.stocks) {
    assert.match(summary.symbol, /^[A-Z.-]{1,12}$/);
    if (index.universe.minimumMarketCap) assert.ok(summary.marketCap >= index.universe.minimumMarketCap, `${summary.symbol} fell below the universe threshold`);
    if (summary.latestAnnual || summary.annuals?.some((annual) => annual.revenue != null || annual.netIncome != null)) fundamentalsCovered += 1;
    if (published.mode === "split") {
      assert.match(summary.dataPath, /^\.\/data\/market\/stocks\/[a-z0-9_-]+\.json$/);
      assert.match(summary.recentDataPath, /^\.\/data\/market\/recent\/[a-z0-9_-]+\.json$/);
      const absolute = path.join(root, "public", summary.dataPath.replace(/^\.\//, ""));
      const recentAbsolute = path.join(root, "public", summary.recentDataPath.replace(/^\.\//, ""));
      assert.ok((await stat(absolute)).size < cloudflareAssetLimit, `${summary.symbol} exceeds Cloudflare's per-asset limit`);
      assert.ok((await stat(recentAbsolute)).size < cloudflareAssetLimit, `${summary.symbol} recent delta exceeds Cloudflare's per-asset limit`);
    }

    const stock = await published.loadDetail(summary);
    assert.ok(stock.prices.length >= 2, `${stock.symbol} requires a usable price history`);
    assert.ok(stock.prices.every((point) => point.adjustedClose > 0));
    const dates = stock.prices.map((point) => point.date);
    assert.deepEqual(dates, [...dates].sort(), `${stock.symbol} prices must be chronological`);
    assert.equal(new Set(dates).size, dates.length, `${stock.symbol} contains duplicate dates`);
    if (published.mode === "split") {
      assert.equal(summary.historySessions, stock.prices.length);
      assert.equal(summary.historyStart, dates[0]);
      assert.equal(summary.priceAsOf, dates.at(-1));
      const spanYears = (Date.parse(dates.at(-1)) - Date.parse(dates[0])) / (365.25 * 86_400_000);
      assert.ok(spanYears <= 10.1, `${stock.symbol} unexpectedly exceeds the ten-year contract`);
      if (dates[0] <= shiftYears(dates.at(-1), -9)) assert.ok(spanYears >= 9, `${stock.symbol} should visibly cover ten calendar years`);
    }
  }
  assert.ok(fundamentalsCovered >= index.stocks.length * 0.65, "SEC fundamentals coverage fell below 65%");
});

test("published snapshot contains explicit source labels", async () => {
  const { index } = await loadPublishedMarket();
  assert.match(index.sources.prices, /end-of-day/i);
  assert.match(index.sources.fundamentals, /SEC EDGAR/i);
  if (index.schemaVersion === 2) assert.match(index.sources.universe, /Nasdaq.*SEC/i);
});

function shiftYears(date, years) {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCFullYear(shifted.getUTCFullYear() + years);
  return shifted.toISOString().slice(0, 10);
}
