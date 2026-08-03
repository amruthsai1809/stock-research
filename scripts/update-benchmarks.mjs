import { mkdir, writeFile } from "node:fs/promises";

const OUTPUT = new URL("../public/data/benchmark-data.json", import.meta.url);
const benchmarks = [
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", category: "U.S. large cap" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", category: "Nasdaq-100" },
  { symbol: "VTI", name: "Vanguard Total Stock Market ETF", category: "U.S. total market" },
];

function round(value) { return Math.round(value * 10_000) / 10_000; }

async function loadBenchmark(benchmark) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${benchmark.symbol}?range=10y&interval=1d&events=div%2Csplits`;
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 TIDE research-data refresh" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${benchmark.symbol}`);
  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  if (!result) throw new Error(`No chart result for ${benchmark.symbol}`);
  const quote = result.indicators?.quote?.[0] ?? {};
  const adjusted = result.indicators?.adjclose?.[0]?.adjclose ?? [];
  const prices = (result.timestamp ?? []).flatMap((timestamp, index) => {
    const close = quote.close?.[index];
    if (close == null) return [];
    return [{ date: new Date(timestamp * 1000).toISOString().slice(0, 10), open: round(quote.open?.[index] ?? close), high: round(quote.high?.[index] ?? close), low: round(quote.low?.[index] ?? close), close: round(close), adjustedClose: round(adjusted[index] ?? close), volume: quote.volume?.[index] ?? 0 }];
  });
  return { ...benchmark, prices };
}

const instruments = [];
for (const benchmark of benchmarks) {
  instruments.push(await loadBenchmark(benchmark));
  console.log(`Updated benchmark ${benchmark.symbol}`);
}
await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify({ generatedAt: new Date().toISOString(), source: "Yahoo Finance chart data (community endpoint; end-of-day snapshot)", benchmarks: instruments })}\n`);
console.log(`Wrote benchmark-data.json (${instruments.length} benchmarks)`);
