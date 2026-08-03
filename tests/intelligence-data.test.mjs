import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const institutionalIndexUrl = new URL("../public/data/institutional/index.json", import.meta.url);
const institutionalDirectoryUrl = new URL("../public/data/institutional/", import.meta.url);
const governmentMetaUrl = new URL("../public/data/government/meta.json", import.meta.url);
const governmentIndexUrl = new URL("../public/data/government/index.json", import.meta.url);
const governmentRecentUrl = new URL("../public/data/government/recent.json", import.meta.url);
const governmentProfilesUrl = new URL("../public/data/government/profiles/", import.meta.url);
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

test("13F directory separates current filers from archived managers", async () => {
  const index = JSON.parse(await readFile(institutionalIndexUrl, "utf8"));
  assert.match(index.source, /SEC EDGAR/i);
  assert.ok(index.managers.length >= 25, "the manager directory should be broad enough for discovery");
  assert.ok(index.coverageQuarters >= 20, "position histories should span at least five years");
  assert.ok(index.managers.filter((manager) => manager.lifecycle.status === "active").length >= 20);
  const scion = index.managers.find((manager) => manager.id === "scion");
  assert.equal(scion?.lifecycle.status, "archived");
  assert.equal(scion?.lifecycle.endedAt, "2025-11-10");
  assert.notEqual(scion?.latest?.reportDate, index.expectedReportDate);
  const appaloosa = index.managers.find((manager) => manager.id === "appaloosa");
  assert.equal(appaloosa?.latest?.reportDate, index.expectedReportDate, "Appaloosa must resolve to its current SEC identity");

  for (const summary of index.managers) {
    await access(new URL(`${summary.id}.json`, institutionalDirectoryUrl));
    if (summary.lifecycle.status === "active") assert.equal(summary.latest?.reportDate, index.expectedReportDate, `${summary.name} is stale`);
    assert.match(summary.lifecycle.sourceUrl, /^https:\/\/(www\.)?(sec\.gov|adviserinfo\.sec\.gov)\//);
  }
});

test("institutional profiles retain source lineage and position history", async () => {
  for (const id of ["berkshire", "pershing", "bridgewater", "appaloosa", "scion"]) {
    const manager = JSON.parse(await readFile(new URL(`${id}.json`, institutionalDirectoryUrl), "utf8"));
    assert.ok(manager.quarters.length >= 15, `${manager.name} needs meaningful history`);
    assert.deepEqual(manager.quarters.map((quarter) => quarter.reportDate), [...manager.quarters.map((quarter) => quarter.reportDate)].sort().reverse());
    for (const quarter of manager.quarters) {
      assert.match(quarter.sourceUrl, /^https:\/\/www\.sec\.gov\//);
      assert.ok(quarter.totalValue > 0);
      assert.ok(quarter.holdings.every((holding) => holding.value > 0 && holding.shares >= 0 && holding.weight >= 0));
      assert.ok(quarter.holdings.slice(0, 10).reduce((sum, holding) => sum + holding.weight, 0) <= 100.01);
    }
  }
});

test("public-official directory is broad, fresh, and backed by profile files", async () => {
  const meta = JSON.parse(await readFile(governmentMetaUrl, "utf8"));
  const filers = JSON.parse(await readFile(governmentIndexUrl, "utf8"));
  const profileFiles = await readdir(governmentProfilesUrl);
  assert.match(meta.source, /House Clerk, Senate eFD/i);
  assert.match(meta.methodology, /ranges?/i);
  assert.ok(meta.totals.trades >= 60_000);
  assert.ok(filers.length >= 400);
  assert.ok(filers.filter((filer) => filer.active === true).length >= 200);
  assert.ok(filers.some((filer) => filer.chamber === "house"));
  assert.ok(filers.some((filer) => filer.chamber === "senate"));
  assert.ok(filers.some((filer) => filer.branch === "executive"));
  assert.ok(profileFiles.length >= filers.length);
  const generated = new Date(meta.generatedAt).getTime();
  const latest = new Date(`${meta.dateRange.to}T00:00:00Z`).getTime();
  assert.ok(generated - latest <= 21 * 86_400_000, "official disclosures are more than 21 days behind the refresh");
});

test("high-activity officials expose long histories and original filing links", async () => {
  const expected = [
    ["house_nancy_pelosi", 150],
    ["house_michaelt_mccaul", 350],
    ["house_rohit_khanna", 500],
  ];
  for (const [id, minimum] of expected) {
    const profile = JSON.parse(await readFile(new URL(`${id}.json`, governmentProfilesUrl), "utf8"));
    assert.ok(profile.trades.length >= minimum, `${profile.filer.full_name} history is unexpectedly sparse`);
    for (const trade of profile.trades) {
      assert.match(trade.transaction_date, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(trade.filing_date, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(trade.amount_range_low >= 0);
      assert.ok(trade.amount_range_high == null || trade.amount_range_high >= trade.amount_range_low);
      assert.match(trade.doc_url, /^https:\/\//);
    }
  }
});

test("recent public disclosures preserve transaction and filing dates", async () => {
  const recent = JSON.parse(await readFile(governmentRecentUrl, "utf8"));
  assert.ok(recent.length >= 4_000);
  assert.ok(recent.some((trade) => trade.source_id === "house_clerk"));
  assert.ok(recent.some((trade) => trade.source_id === "senate_efd"));
  assert.ok(recent.every((trade) => trade.transaction_date && trade.filing_date && trade.doc_url));
});
