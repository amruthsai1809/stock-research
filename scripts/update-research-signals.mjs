import { readFile } from "node:fs/promises";
import path from "node:path";
import { writeJsonAtomic } from "./lib/atomicOutput.mjs";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");
const MARKET_PATH = path.join(ROOT, "public", "data", "market-data.json");
const INSTITUTIONAL_INDEX_PATH = path.join(ROOT, "public", "data", "institutional", "index.json");
const OUTPUT_PATH = path.join(ROOT, "public", "data", "research-signals.json");
// A quarter-end wave of equity awards can push discretionary trades outside the
// first few filings. Forty recent ownership filings provides a useful rolling
// window while keeping the scheduled refresh comfortably below SEC rate limits.
const MAX_FILINGS_PER_COMPANY = 40;
const SEC_HEADERS = {
  "User-Agent": `Stock Research ${process.env.SEC_CONTACT ?? "research@amruthg.com"}`,
  Accept: "application/json,application/xml,text/xml",
};
const YAHOO_USER_AGENT = "Mozilla/5.0 Stock Research data refresh";

let secGate = Promise.resolve();
let lastSecRequest = 0;
async function enterSecQueue() {
  const turn = secGate.then(async () => {
    const delay = Math.max(0, 140 - (Date.now() - lastSecRequest));
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    lastSecRequest = Date.now();
  });
  secGate = turn.catch(() => {});
  await turn;
}

async function fetchSec(url) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await enterSecQueue();
    const response = await fetch(url, { headers: SEC_HEADERS });
    if (response.ok) return response;
    if (![403, 429, 500, 502, 503].includes(response.status) || attempt === 3) throw new Error(`${response.status} ${response.statusText}: ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
  }
  throw new Error(`Request failed: ${url}`);
}

async function createYahooSession() {
  const seed = await fetch("https://fc.yahoo.com/", { headers: { "User-Agent": YAHOO_USER_AGENT }, redirect: "manual" });
  const setCookies = typeof seed.headers.getSetCookie === "function"
    ? seed.headers.getSetCookie()
    : [seed.headers.get("set-cookie")].filter(Boolean);
  const cookie = setCookies.map((value) => value.split(";", 1)[0]).join("; ");
  if (!cookie) throw new Error("Yahoo session cookie was unavailable.");
  const crumbResponse = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": YAHOO_USER_AGENT, Cookie: cookie },
  });
  if (!crumbResponse.ok) throw new Error(`Yahoo crumb returned ${crumbResponse.status}.`);
  const crumb = (await crumbResponse.text()).trim();
  if (!crumb) throw new Error("Yahoo crumb was empty.");
  return { cookie, crumb };
}

const raw = (value) => value && typeof value.raw === "number" && Number.isFinite(value.raw) ? value.raw : null;
const positiveNumber = (value) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
const dateFromEpoch = (value) => value == null ? null : new Date(value * 1000).toISOString().slice(0, 10);

async function loadMarketSignals(symbol, session, fallbackAsOf) {
  const modules = "defaultKeyStatistics,financialData,recommendationTrend,upgradeDowngradeHistory";
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(session.crumb)}`;
  const response = await fetch(url, { headers: { "User-Agent": YAHOO_USER_AGENT, Cookie: session.cookie } });
  if (!response.ok) throw new Error(`Yahoo quote summary returned ${response.status}.`);
  const summary = (await response.json())?.quoteSummary?.result?.[0];
  if (!summary) throw new Error("Yahoo quote summary was empty.");
  const financial = summary.financialData ?? {};
  const statistics = summary.defaultKeyStatistics ?? {};
  const currentPrice = raw(financial.currentPrice);
  const targetMean = raw(financial.targetMeanPrice);
  const history = (summary.upgradeDowngradeHistory?.history ?? []).slice(0, 30).flatMap((item) => {
    const date = dateFromEpoch(item.epochGradeDate);
    if (!date) return [];
    return [{
      date,
      firm: String(item.firm ?? "Unknown firm"),
      action: String(item.action ?? "").toLowerCase(),
      fromGrade: String(item.fromGrade ?? ""),
      toGrade: String(item.toGrade ?? ""),
      priceTargetAction: String(item.priceTargetAction ?? ""),
      priorPriceTarget: positiveNumber(item.priorPriceTarget),
      currentPriceTarget: positiveNumber(item.currentPriceTarget),
    }];
  });
  const trend = (summary.recommendationTrend?.trend ?? []).slice(0, 4).map((item) => ({
    period: String(item.period ?? ""),
    strongBuy: Number(item.strongBuy ?? 0),
    buy: Number(item.buy ?? 0),
    hold: Number(item.hold ?? 0),
    sell: Number(item.sell ?? 0),
    strongSell: Number(item.strongSell ?? 0),
  }));
  const recommendationMean = raw(financial.recommendationMean);
  const analystAvailable = recommendationMean != null || targetMean != null || trend.some((item) => item.strongBuy + item.buy + item.hold + item.sell + item.strongSell > 0);
  return {
    analyst: {
      available: analystAvailable,
      reason: analystAvailable ? null : "Analyst consensus was not available from the public market snapshot.",
      asOf: history[0]?.date ?? fallbackAsOf,
      recommendationKey: typeof financial.recommendationKey === "string" ? financial.recommendationKey : null,
      recommendationMean,
      numberOfAnalysts: Math.max(0, Math.round(raw(financial.numberOfAnalystOpinions) ?? 0)),
      targetLow: raw(financial.targetLowPrice),
      targetMean,
      targetMedian: raw(financial.targetMedianPrice),
      targetHigh: raw(financial.targetHighPrice),
      targetUpside: currentPrice != null && currentPrice > 0 && targetMean != null ? ((targetMean / currentPrice) - 1) * 100 : null,
      trend,
      actions: history,
    },
    shortInterest: {
      available: raw(statistics.sharesShort) != null || raw(statistics.shortPercentOfFloat) != null,
      asOf: dateFromEpoch(raw(statistics.dateShortInterest)),
      sharesShort: raw(statistics.sharesShort),
      sharesShortPriorMonth: raw(statistics.sharesShortPriorMonth),
      shortPercentOfFloat: raw(statistics.shortPercentOfFloat),
      sharesPercentOutstanding: raw(statistics.sharesPercentSharesOut),
      daysToCover: raw(statistics.shortRatio),
      institutionalOwnership: raw(statistics.heldPercentInstitutions),
      insiderOwnership: raw(statistics.heldPercentInsiders),
    },
  };
}

function unavailableMarketSignals(reason) {
  return {
    analyst: {
      available: false,
      reason,
      asOf: null,
      recommendationKey: null,
      recommendationMean: null,
      numberOfAnalysts: 0,
      targetLow: null,
      targetMean: null,
      targetMedian: null,
      targetHigh: null,
      targetUpside: null,
      trend: [],
      actions: [],
    },
    shortInterest: {
      available: false,
      asOf: null,
      sharesShort: null,
      sharesShortPriorMonth: null,
      shortPercentOfFloat: null,
      sharesPercentOutstanding: null,
      daysToCover: null,
      institutionalOwnership: null,
      insiderOwnership: null,
    },
  };
}

const clean = (value = "") => decodeEntities(String(value).replace(/<!\[CDATA\[|\]\]>/g, "")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const decodeEntities = (value) => value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const rawTag = (xml, name) => xml.match(new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${name}>`, "i"))?.[1] ?? "";
const tag = (xml, name) => clean(rawTag(xml, name));
const numericTag = (xml, name) => {
  const value = Number(tag(xml, name));
  return Number.isFinite(value) ? value : null;
};

function blocks(xml, name) {
  return [...xml.matchAll(new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${name}>`, "gi"))].map((match) => match[1]);
}

function ownerRole(xml) {
  const relationship = rawTag(xml, "reportingOwnerRelationship");
  const roles = [];
  if (/true|1/i.test(tag(relationship, "isDirector"))) roles.push("Director");
  if (/true|1/i.test(tag(relationship, "isOfficer"))) roles.push(tag(relationship, "officerTitle") || "Officer");
  if (/true|1/i.test(tag(relationship, "isTenPercentOwner"))) roles.push("10% owner");
  if (/true|1/i.test(tag(relationship, "isOther"))) roles.push(tag(relationship, "otherText") || "Other insider");
  return roles.join(" · ") || "Reporting owner";
}

function parseOwnershipXml(xml, filing) {
  const owner = clean(tag(xml, "rptOwnerName")) || "Undisclosed reporting owner";
  const role = ownerRole(xml);
  const rule10b51 = /10b5-?1/i.test(xml);
  const sourceUrl = `https://www.sec.gov/Archives/edgar/data/${filing.cikNumber}/${filing.accession.replace(/-/g, "")}/${path.posix.basename(filing.primaryDocument)}`;
  return blocks(xml, "nonDerivativeTransaction").flatMap((transaction) => {
    const code = tag(rawTag(transaction, "transactionCoding"), "transactionCode").toUpperCase();
    if (code !== "P" && code !== "S") return [];
    const amounts = rawTag(transaction, "transactionAmounts");
    const post = rawTag(transaction, "postTransactionAmounts");
    const shares = numericTag(rawTag(amounts, "transactionShares"), "value") ?? 0;
    const price = numericTag(rawTag(amounts, "transactionPricePerShare"), "value");
    const acquiredDisposed = tag(rawTag(amounts, "transactionAcquiredDisposedCode"), "value").toUpperCase();
    const signedAction = code === "P" || acquiredDisposed === "A" ? "purchase" : "sale";
    return [{
      accession: filing.accession,
      ownerName: owner,
      ownerRole: role,
      transactionDate: tag(rawTag(transaction, "transactionDate"), "value") || filing.filingDate,
      filingDate: filing.filingDate,
      code,
      action: signedAction,
      shares,
      price,
      value: price == null ? null : shares * price,
      sharesOwnedAfter: numericTag(rawTag(post, "sharesOwnedFollowingTransaction"), "value"),
      rule10b51,
      sourceUrl,
    }];
  });
}

async function loadInsiderTransactions(stock) {
  const submissions = await (await fetchSec(`https://data.sec.gov/submissions/CIK${stock.cik}.json`)).json();
  const recent = submissions.filings?.recent ?? {};
  const filings = (recent.form ?? []).map((form, index) => ({
    form,
    accession: recent.accessionNumber[index],
    filingDate: recent.filingDate[index],
    primaryDocument: recent.primaryDocument[index],
    cikNumber: String(Number(stock.cik)),
  })).filter((filing) => /^4(?:\/A)?$/i.test(filing.form) && filing.accession && filing.primaryDocument).slice(0, MAX_FILINGS_PER_COMPANY);
  const transactions = [];
  for (const filing of filings) {
    try {
      const url = `https://www.sec.gov/Archives/edgar/data/${filing.cikNumber}/${filing.accession.replace(/-/g, "")}/${path.posix.basename(filing.primaryDocument)}`;
      const xml = await (await fetchSec(url)).text();
      transactions.push(...parseOwnershipXml(xml, filing));
    } catch (error) {
      console.warn(`[signals] ${stock.symbol}: skipped ${filing.accession}: ${error.message}`);
    }
  }
  const unique = new Map();
  for (const transaction of transactions) unique.set(`${transaction.accession}-${transaction.ownerName}-${transaction.transactionDate}-${transaction.code}-${transaction.shares}`, transaction);
  return [...unique.values()].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate) || b.filingDate.localeCompare(a.filingDate));
}

function holdingShares(quarter, symbol) {
  return (quarter?.holdings ?? []).filter((holding) => holding.symbol === symbol && holding.optionType == null).reduce((sum, holding) => sum + holding.shares, 0);
}

async function buildInstitutionalSignals(symbols) {
  const index = JSON.parse(await readFile(INSTITUTIONAL_INDEX_PATH, "utf8"));
  const active = index.managers.filter((manager) => manager.lifecycle.status === "active");
  const managers = await Promise.all(active.map(async (summary) => JSON.parse(await readFile(path.join(ROOT, "public", "data", "institutional", `${summary.id}.json`), "utf8"))));
  const reportDate = managers.map((manager) => manager.quarters[0]?.reportDate ?? "").sort().at(-1) || null;
  const filingDate = managers.map((manager) => manager.quarters[0]?.filedDate ?? "").sort().at(-1) || null;
  return Object.fromEntries(symbols.map((symbol) => {
    let managersHolding = 0;
    let managersIncreased = 0;
    let managersReduced = 0;
    let managersNew = 0;
    let managersExited = 0;
    for (const manager of managers) {
      const current = holdingShares(manager.quarters[0], symbol);
      const previous = holdingShares(manager.quarters[1], symbol);
      if (current > 0) managersHolding += 1;
      if (current > 0 && previous === 0) managersNew += 1;
      else if (current > previous * 1.001) managersIncreased += 1;
      else if (current > 0 && current < previous * 0.999) managersReduced += 1;
      else if (current === 0 && previous > 0) managersExited += 1;
    }
    return [symbol, { reportDate, filingDate, managersHolding, managersIncreased, managersReduced, managersNew, managersExited }];
  }));
}

async function main() {
  const market = JSON.parse(await readFile(MARKET_PATH, "utf8"));
  const symbols = market.stocks.map((stock) => stock.symbol);
  const institutional = await buildInstitutionalSignals(symbols);
  let yahooSession = null;
  try { yahooSession = await createYahooSession(); }
  catch (error) { console.warn(`[signals] analyst and short-interest source unavailable: ${error.message}`); }
  const signals = {};
  for (const [index, stock] of market.stocks.entries()) {
    process.stdout.write(`[signals] ${String(index + 1).padStart(2, "0")}/${market.stocks.length} ${stock.symbol}\n`);
    let transactions = [];
    try { transactions = await loadInsiderTransactions(stock); }
    catch (error) { console.warn(`[signals] ${stock.symbol}: insider source unavailable: ${error.message}`); }
    let marketSignals = unavailableMarketSignals("Analyst consensus was unavailable during the latest static refresh.");
    if (yahooSession) {
      try { marketSignals = await loadMarketSignals(stock.symbol, yahooSession, market.priceAsOf); }
      catch (error) { console.warn(`[signals] ${stock.symbol}: analyst/short source unavailable: ${error.message}`); }
    }
    signals[stock.symbol] = {
      symbol: stock.symbol,
      insider: { asOf: transactions[0]?.filingDate ?? market.priceAsOf, transactions },
      institutional: institutional[stock.symbol],
      ...marketSignals,
    };
  }
  const output = {
    generatedAt: new Date().toISOString(),
    methodology: "Fundamental and market factors are computed locally. Corporate-insider activity includes recent SEC Forms 4/4-A open-market codes P and S. Institutional breadth uses only active managers in the latest two loaded 13F periods; archived managers are excluded. Analyst consensus and short interest are delayed market snapshots and are dated separately.",
    sources: { insiders: "https://www.sec.gov/edgar/sec-api-documentation", institutions: "https://www.sec.gov/divisions/investment/13ffaq", analysts: "https://finance.yahoo.com/" },
    signals,
  };
  await writeJsonAtomic(OUTPUT_PATH, output, { pretty: true });
  console.log(`[signals] wrote ${OUTPUT_PATH}`);
}

await main();
