import { mkdir, writeFile } from "node:fs/promises";
import { companies } from "./company-registry.mjs";

const OUTPUT = new URL("../public/data/market-data.json", import.meta.url);
const USER_AGENT =
  process.env.SEC_USER_AGENT ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36";

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

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
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
  return [...byPeriod.values()].slice(-6).map((entry) => ({
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
  return [...byPeriod.values()].slice(-6).map((entry) => ({
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
  const years = [...new Set(anchors.map((entry) => entry.year))].sort().slice(-6);
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
    if (close == null) return [];
    return [{
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      open: roundPrice(quote.open?.[index] ?? close),
      high: roundPrice(quote.high?.[index] ?? close),
      low: roundPrice(quote.low?.[index] ?? close),
      close: roundPrice(close),
      adjustedClose: roundPrice(adjusted[index] ?? close),
      volume: quote.volume?.[index] ?? 0,
    }];
  });
  return { meta: result.meta || {}, history };
}

function roundPrice(value) {
  return Math.round(value * 10_000) / 10_000;
}

async function loadCompany(company) {
  const [pricePayload, factsPayload] = await Promise.all([
    fetchJson(`https://query1.finance.yahoo.com/v8/finance/chart/${company.symbol}?range=5y&interval=1d&events=div%2Csplits`, {
      "User-Agent": "Mozilla/5.0 TIDE research-data refresh",
    }),
    fetchJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${company.cik}.json`, {
      "User-Agent": USER_AGENT,
      From: process.env.SEC_CONTACT || "https://github.com/open-source/tide",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
    }),
  ]);
  const prices = normalizePrices(pricePayload);
  const annuals = attachFiscalValuation(mergeAnnualMetrics(factsPayload.facts), prices.history);
  return {
    ...company,
    description: factsPayload.entityName || company.name,
    exchange: prices.meta.fullExchangeName || prices.meta.exchangeName || "US",
    currency: prices.meta.currency || "USD",
    prices: prices.history,
    annuals,
  };
}

async function main() {
  const stocks = [];
  for (const company of companies) {
    try {
      stocks.push(await loadCompany(company));
      process.stdout.write(`Updated ${company.symbol}\n`);
    } catch (error) {
      process.stderr.write(`Skipped ${company.symbol}: ${error.message}\n`);
    }
    await sleep(150);
  }
  if (stocks.length < Math.ceil(companies.length * 0.8)) {
    throw new Error(`Data refresh failed quality gate: ${stocks.length}/${companies.length} companies loaded.`);
  }
  const lastDates = stocks.map((stock) => stock.prices.at(-1)?.date).filter(Boolean).sort();
  const payload = {
    generatedAt: new Date().toISOString(),
    priceAsOf: lastDates.at(-1) || null,
    sources: {
      prices: "Yahoo Finance chart data (community endpoint; end-of-day snapshot)",
      fundamentals: "SEC EDGAR Company Facts",
    },
    stocks,
  };
  await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(payload)}\n`);
  process.stdout.write(`Wrote ${stocks.length} companies to ${OUTPUT.pathname}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
