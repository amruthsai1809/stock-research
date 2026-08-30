import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { replaceDirectory, writeJsonAtomic } from "./lib/atomicOutput.mjs";
import { loadEligibleUniverse, symbolSlug, universePolicy } from "./market/universe.mjs";
import { mergePriceHistories, trimHistoryYears } from "./market/incremental.mjs";
import { summarizeStock } from "./market/summarize.mjs";

const DATA_ROOT = path.resolve(import.meta.dirname, "..", "public", "data");
const OUTPUT_DIRECTORY = path.join(DATA_ROOT, "market");
const CONCURRENCY = Math.max(1, Math.min(12, Number.parseInt(process.env.MARKET_CONCURRENCY ?? "6", 10) || 6));
const USER_AGENT =
  process.env.SEC_USER_AGENT ||
  `Equity Lab ${process.env.SEC_CONTACT || "research@amruthg.com"}`;
const MARKET_BASE_URL = process.env.MARKET_BASE_URL?.replace(/\/+$/, "");
const INCREMENTAL_REFRESH = process.env.MARKET_REFRESH_MODE === "incremental";

const conceptAliases = {
  revenue: ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"],
  grossProfit: ["GrossProfit"],
  operatingIncome: ["OperatingIncomeLoss"],
  netIncome: ["NetIncomeLoss", "ProfitLoss"],
  operatingCashFlow: ["NetCashProvidedByUsedInOperatingActivities"],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsForPropertyPlantAndEquipment"],
  assets: ["Assets"],
  liabilities: ["Liabilities"],
  equity: ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
  cash: ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],
  longTermDebt: ["LongTermDebtAndFinanceLeaseObligations", "LongTermDebt", "LongTermDebtNoncurrent", "LongTermDebtAndFinanceLeaseObligationsCurrent", "LongTermDebtCurrent"],
  shares: ["EntityCommonStockSharesOutstanding", "CommonStockSharesOutstanding"],
  dilutedEps: ["EarningsPerShareDiluted", "EarningsPerShareDilutedIncludingExtraordinaryItems"],
  depreciationAndAmortization: ["DepreciationDepletionAndAmortization", "DepreciationDepletionAndAmortizationPropertyPlantAndEquipment", "DepreciationAmortizationAndAccretionNet", "Depreciation"],
  researchAndDevelopment: ["ResearchAndDevelopmentExpense", "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost"],
  stockCompensation: ["ShareBasedCompensation", "AllocatedShareBasedCompensationExpense"],
  buybacks: ["PaymentsForRepurchaseOfCommonStock"],
  dividends: ["PaymentsOfDividends", "PaymentsOfDividendsCommonStock"],
};

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let secGate = Promise.resolve();
let lastSecRequest = 0;

async function fetchSecJson(url, headers) {
  const turn = secGate.then(async () => {
    const delay = Math.max(0, 125 - (Date.now() - lastSecRequest));
    if (delay) await sleep(delay);
    lastSecRequest = Date.now();
  });
  secGate = turn.catch(() => {});
  await turn;
  return fetchJson(url, headers);
}

async function fetchJson(url, headers = {}) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
      if (response.ok) return response.json();
      if (![403, 408, 429, 500, 502, 503, 504].includes(response.status) || attempt === 3) {
        throw new Error(`${response.status} ${response.statusText}: ${url}`);
      }
    } catch (error) {
      if (attempt === 3) throw error;
    }
    await sleep(700 * 2 ** attempt + Math.floor(Math.random() * 250));
  }
  throw new Error(`Request failed: ${url}`);
}

function pickUnits(concept, preferredUnit = "USD") {
  if (!concept?.units) return [];
  return concept.units[preferredUnit] || Object.values(concept.units)[0] || [];
}

function selectConcept(facts, aliases, unit, predicate) {
  let best = { alias: null, entries: [] };
  for (const alias of aliases) {
    const concept = facts?.["us-gaap"]?.[alias] || facts?.dei?.[alias];
    const entries = pickUnits(concept, unit).filter(predicate).sort((a, b) => (a.end || "").localeCompare(b.end || ""));
    const latest = entries.at(-1)?.end || "";
    const bestLatest = best.entries.at(-1)?.end || "";
    if (latest > bestLatest || (latest === bestLatest && entries.length > best.entries.length)) {
      best = { alias, entries };
    }
  }
  return best;
}

function annualSeries(facts, aliases, unit = "USD") {
  const selected = selectConcept(facts, aliases, unit, (entry) => {
    if (entry.form !== "10-K" || !entry.start || !entry.end) return false;
    const days = (Date.parse(entry.end) - Date.parse(entry.start)) / 86_400_000;
    return days >= 300 && days <= 430;
  });
  const entries = selected.entries.sort((a, b) => a.end.localeCompare(b.end) || a.filed.localeCompare(b.filed));

  const byPeriod = new Map();
  for (const entry of entries) byPeriod.set(entry.end, entry);
  return [...byPeriod.values()].slice(-10).map((entry) => ({
    year: Number(entry.end.slice(0, 4)),
    end: entry.end,
    filed: entry.filed,
    value: entry.val,
    accession: entry.accn,
    form: entry.form,
    concept: selected.alias,
  }));
}

function instantSeries(facts, aliases, unit = "USD") {
  const selected = selectConcept(facts, aliases, unit, (entry) => entry.form === "10-K" && entry.end);
  const entries = selected.entries.sort((a, b) => a.end.localeCompare(b.end) || a.filed.localeCompare(b.filed));
  const byPeriod = new Map();
  for (const entry of entries) byPeriod.set(entry.end, entry);
  return [...byPeriod.values()].slice(-10).map((entry) => ({
    year: Number(entry.end.slice(0, 4)),
    end: entry.end,
    filed: entry.filed,
    value: entry.val,
    accession: entry.accn,
    form: entry.form,
    concept: selected.alias,
  }));
}

function mergeAnnualMetrics(facts) {
  const series = {
    revenue: annualSeries(facts, conceptAliases.revenue),
    grossProfit: annualSeries(facts, conceptAliases.grossProfit),
    operatingIncome: annualSeries(facts, conceptAliases.operatingIncome),
    netIncome: annualSeries(facts, conceptAliases.netIncome),
    operatingCashFlow: annualSeries(facts, conceptAliases.operatingCashFlow),
    capex: annualSeries(facts, conceptAliases.capex),
    assets: instantSeries(facts, conceptAliases.assets),
    liabilities: instantSeries(facts, conceptAliases.liabilities),
    equity: instantSeries(facts, conceptAliases.equity),
    cash: instantSeries(facts, conceptAliases.cash),
    longTermDebt: instantSeries(facts, conceptAliases.longTermDebt),
    shares: instantSeries(facts, conceptAliases.shares, "shares"),
    dilutedEps: annualSeries(facts, conceptAliases.dilutedEps, "USD/shares"),
    depreciationAndAmortization: annualSeries(facts, conceptAliases.depreciationAndAmortization),
    researchAndDevelopment: annualSeries(facts, conceptAliases.researchAndDevelopment),
    stockCompensation: annualSeries(facts, conceptAliases.stockCompensation),
    buybacks: annualSeries(facts, conceptAliases.buybacks),
    dividends: annualSeries(facts, conceptAliases.dividends),
  };

  const anchors = series.revenue.length
    ? series.revenue
    : series.netIncome.length
      ? series.netIncome
      : series.operatingCashFlow;
  const years = [...new Set(anchors.map((entry) => entry.year))].sort().slice(-10);
  const valueFor = (metric, year) => series[metric].find((entry) => entry.year === year)?.value ?? null;
  const conceptFor = (metric, year) => series[metric].find((entry) => entry.year === year)?.concept ?? null;
  const sourceFor = (year) =>
    series.revenue.find((entry) => entry.year === year) || series.netIncome.find((entry) => entry.year === year);
  const instantValueFor = (metric, sourceEnd, year) => {
    const exact = series[metric].find((entry) => entry.year === year && entry.end === sourceEnd);
    if (exact) return exact.value;
    const target = Date.parse(sourceEnd);
    const nearest = [...series[metric]]
      .map((entry) => ({ entry, distance: Math.abs(Date.parse(entry.end) - target) }))
      .filter((candidate) => candidate.distance <= 120 * 86_400_000)
      .sort((a, b) => a.distance - b.distance)[0];
    return nearest?.entry.value ?? null;
  };

  return years.map((year) => {
    const operatingCashFlow = valueFor("operatingCashFlow", year);
    const capex = valueFor("capex", year);
    const source = sourceFor(year);
    return {
      year,
      end: source?.end || `${year}-12-31`,
      filed: source?.filed || null,
      accession: source?.accession || null,
      revenue: valueFor("revenue", year),
      grossProfit: valueFor("grossProfit", year),
      operatingIncome: valueFor("operatingIncome", year),
      netIncome: valueFor("netIncome", year),
      operatingCashFlow,
      capex,
      freeCashFlow:
        operatingCashFlow == null || capex == null ? null : operatingCashFlow - Math.abs(capex),
      assets: instantValueFor("assets", source?.end || `${year}-12-31`, year),
      liabilities: instantValueFor("liabilities", source?.end || `${year}-12-31`, year),
      equity: instantValueFor("equity", source?.end || `${year}-12-31`, year),
      cash: instantValueFor("cash", source?.end || `${year}-12-31`, year),
      longTermDebt: instantValueFor("longTermDebt", source?.end || `${year}-12-31`, year),
      shares: instantValueFor("shares", source?.end || `${year}-12-31`, year),
      dilutedEps: valueFor("dilutedEps", year),
      depreciationAndAmortization: valueFor("depreciationAndAmortization", year),
      ebitda:
        valueFor("operatingIncome", year) == null || valueFor("depreciationAndAmortization", year) == null
          ? null
          : valueFor("operatingIncome", year) + Math.abs(valueFor("depreciationAndAmortization", year)),
      researchAndDevelopment: valueFor("researchAndDevelopment", year),
      stockCompensation: valueFor("stockCompensation", year),
      buybacks: valueFor("buybacks", year),
      dividends: valueFor("dividends", year),
      fiscalYearEndPrice: null,
      priceToEarnings: null,
      sourceConcepts: Object.fromEntries(
        Object.keys(series).map((metric) => [metric, conceptFor(metric, year)]).filter(([, concept]) => concept),
      ),
    };
  });
}

function attachFiscalValuation(annuals, prices) {
  return annuals.map((annual) => {
    const fiscalPrice = [...prices].reverse().find((point) => point.date <= annual.end)?.adjustedClose ?? null;
    const pe = fiscalPrice != null && annual.dilutedEps != null && annual.dilutedEps > 0
      ? fiscalPrice / annual.dilutedEps
      : null;
    return {
      ...annual,
      fiscalYearEndPrice: fiscalPrice,
      priceToEarnings: pe == null ? null : Math.round(pe * 100) / 100,
    };
  });
}

function normalizePrices(payload) {
  const result = payload?.chart?.result?.[0];
  if (!result) return { meta: {}, history: [] };
  const quote = result.indicators?.quote?.[0] || {};
  const adjusted = result.indicators?.adjclose?.[0]?.adjclose || [];
  const history = (result.timestamp || []).flatMap((timestamp, index) => {
    const close = quote.close?.[index];
    if (!Number.isFinite(close) || close <= 0) return [];
    const normalized = {
      open: quote.open?.[index],
      high: quote.high?.[index],
      low: quote.low?.[index],
      adjustedClose: adjusted[index],
    };
    for (const [key, value] of Object.entries(normalized)) {
      normalized[key] = Number.isFinite(value) && value > 0 ? value : close;
    }
    return [{
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      open: roundPrice(normalized.open),
      high: roundPrice(normalized.high),
      low: roundPrice(normalized.low),
      close: roundPrice(close),
      adjustedClose: roundPrice(normalized.adjustedClose),
      volume: Number.isFinite(quote.volume?.[index]) && quote.volume[index] >= 0
        ? Math.round(quote.volume[index])
        : 0,
    }];
  });
  return { meta: result.meta || {}, history };
}

function roundPrice(value) {
  return Math.round(value * 10_000) / 10_000;
}

async function loadCompany(company) {
  const baseline = await loadBaselineCompany(company);
  const priceRange = baseline ? "5d" : "10y";
  const pricePayload = await fetchJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(company.providerSymbol)}?range=${priceRange}&interval=1d&events=div%2Csplits`, {
    "User-Agent": "Mozilla/5.0 Equity Lab data refresh",
  });
  let factsPayload = null;
  if (!baseline) {
    try {
      factsPayload = await fetchSecJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${company.cik}.json`, {
        "User-Agent": USER_AGENT,
        From: process.env.SEC_CONTACT || "https://amruthg.com",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      });
    } catch (error) {
      process.stderr.write(`Fundamentals unavailable for ${company.symbol}: ${error.message}\n`);
    }
  }
  const freshPrices = normalizePrices(pricePayload);
  const history = trimHistoryYears(mergePriceHistories(baseline?.prices, freshPrices.history), universePolicy.historyYears);
  if (history.length < 2) throw new Error("Price history contains fewer than two sessions.");
  const annuals = factsPayload ? attachFiscalValuation(mergeAnnualMetrics(factsPayload.facts), history) : baseline?.annuals ?? [];
  return {
    symbol: company.symbol,
    cik: company.cik,
    name: company.name,
    sector: company.sector,
    industry: company.industry,
    description: factsPayload?.entityName || baseline?.description || company.name,
    exchange: freshPrices.meta.fullExchangeName || freshPrices.meta.exchangeName || baseline?.exchange || "US",
    currency: freshPrices.meta.currency || baseline?.currency || "USD",
    prices: history,
    annuals,
  };
}

async function loadBaselineCompany(company) {
  if (!INCREMENTAL_REFRESH) return null;
  if (!MARKET_BASE_URL) throw new Error("MARKET_BASE_URL is required for an incremental refresh.");
  const fileName = `${symbolSlug(company.symbol)}.json`;
  try {
    const [archive, recent] = await Promise.all([
      fetchJson(`${MARKET_BASE_URL}/data/market/stocks/${fileName}`, { Accept: "application/json" }),
      fetchJson(`${MARKET_BASE_URL}/data/market/recent/${fileName}`, { Accept: "application/json" }),
    ]);
    if (archive.symbol !== company.symbol || recent.symbol !== company.symbol) throw new Error("Baseline symbol mismatch.");
    return { ...archive, prices: mergePriceHistories(archive.prices, recent.prices) };
  } catch (error) {
    process.stderr.write(`[market] No deployed baseline for ${company.symbol}; running a full symbol refresh: ${error.message}\n`);
    return null;
  }
}

async function main() {
  const fullUniverse = await loadEligibleUniverse();
  const requested = new Set((process.env.MARKET_SYMBOLS ?? "").split(",").map((value) => value.trim().toUpperCase()).filter(Boolean));
  const maximum = Number.parseInt(process.env.MARKET_MAX_SYMBOLS ?? "0", 10) || 0;
  let companies = requested.size ? fullUniverse.filter((company) => requested.has(company.symbol)) : fullUniverse;
  if (maximum > 0) companies = companies.slice(0, maximum);
  if (!companies.length) throw new Error("No eligible companies matched the requested refresh scope.");

  await mkdir(DATA_ROOT, { recursive: true });
  const stage = await mkdtemp(path.join(DATA_ROOT, ".market-stage-"));
  const stockDirectory = path.join(stage, "stocks");
  const recentDirectory = path.join(stage, "recent");
  await mkdir(stockDirectory, { recursive: true });
  await mkdir(recentDirectory, { recursive: true });

  const summaries = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, companies.length) }, async () => {
    while (cursor < companies.length) {
      const index = cursor;
      cursor += 1;
      const company = companies[index];
      try {
        const stock = await loadCompany(company);
        const fileName = `${symbolSlug(company.symbol)}.json`;
        const currentYear = Number.parseInt(stock.prices.at(-1).date.slice(0, 4), 10);
        const archivedPrices = stock.prices.filter((point) => Number.parseInt(point.date.slice(0, 4), 10) < currentYear);
        const recentPrices = stock.prices.filter((point) => Number.parseInt(point.date.slice(0, 4), 10) === currentYear);
        await Promise.all([
          writeJsonAtomic(path.join(stockDirectory, fileName), { ...stock, prices: archivedPrices }),
          writeJsonAtomic(path.join(recentDirectory, fileName), { symbol: stock.symbol, prices: recentPrices }),
        ]);
        summaries.push(summarizeStock(stock, {
          dataPath: `./data/market/stocks/${fileName}`,
          recentDataPath: `./data/market/recent/${fileName}`,
          marketCap: company.marketCap,
          securityType: company.securityType,
        }));
        process.stdout.write(`[market] ${String(index + 1).padStart(4, "0")}/${companies.length} ${company.symbol}\n`);
      } catch (error) {
        process.stderr.write(`Skipped ${company.symbol}: ${error.message}\n`);
      }
    }
  });
  await Promise.all(workers);

  const minimumSuccess = requested.size || maximum > 0 ? Math.ceil(companies.length * 0.8) : Math.ceil(companies.length * 0.9);
  if (summaries.length < minimumSuccess) {
    await rm(stage, { recursive: true, force: true });
    throw new Error(`Data refresh failed quality gate: ${summaries.length}/${companies.length} companies loaded.`);
  }
  if (companies.some((company) => company.symbol === "DUOL") && !summaries.some((stock) => stock.symbol === "DUOL")) {
    await rm(stage, { recursive: true, force: true });
    throw new Error("Data refresh failed quality gate: DUOL did not load.");
  }
  summaries.sort((left, right) => right.dipScore - left.dipScore || left.symbol.localeCompare(right.symbol));
  const lastDates = summaries.map((stock) => stock.priceAsOf).filter(Boolean).sort();
  const payload = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    priceAsOf: lastDates.at(-1) || null,
    sources: {
      prices: "Yahoo Finance chart data (community endpoint; end-of-day snapshot)",
      fundamentals: "SEC EDGAR Company Facts",
      universe: "Nasdaq stock screener joined to SEC exchange and CIK identifiers",
    },
    universe: {
      ...universePolicy,
      eligibleCount: fullUniverse.length,
      publishedCount: summaries.length,
      scope: requested.size || maximum > 0 ? "sample" : "full",
    },
    stocks: summaries,
  };
  await writeJsonAtomic(path.join(stage, "index.json"), payload);
  await replaceDirectory(stage, OUTPUT_DIRECTORY);
  process.stdout.write(`Wrote ${summaries.length} companies as one compact index, stable archives, and current-year deltas.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
