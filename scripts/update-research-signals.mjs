import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { strFromU8, unzipSync } from "fflate";
import { createStagedDirectory, replaceDirectory, writeJsonAtomic, writeTextAtomic } from "./lib/atomicOutput.mjs";
import {
  actionForCategory,
  classifyInsiderTransaction,
  groupInsiderTransactions,
  reconcileInsiderEvidence,
  summarizeInsiderTransactions,
} from "./lib/insiderTransactions.mjs";
import { symbolSlug } from "./market/universe.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const MARKET_INDEX_PATH = path.join(ROOT, "public", "data", "market", "index.json");
const LEGACY_MARKET_PATH = path.join(ROOT, "public", "data", "market-data.json");
const INSTITUTIONAL_DIR = path.join(ROOT, "public", "data", "institutional");
const OUTPUT_PATH = path.join(ROOT, "public", "data", "research-signals.json");
const DETAIL_DIR = path.join(ROOT, "public", "data", "signals");
const DEPLOYED_BASE_URL = (process.env.SIGNAL_BASE_URL ?? process.env.MARKET_BASE_URL ?? "https://el.amruthg.com").replace(/\/$/, "");
const SHORT_SOURCE_PAGE = "https://www.finra.org/finra-data/browse-catalog/equity-short-interest/files";
const INSIDER_SOURCE_PAGE = "https://www.sec.gov/data-research/sec-markets-data/insider-transactions-data-sets";
const INSTITUTIONAL_SOURCE_PAGE = "https://www.sec.gov/data-research/sec-markets-data/form-13f-data-sets";
const SEC_HEADERS = {
  "User-Agent": `Equity Lab ${process.env.SEC_CONTACT ?? "research@amruthg.com"}`,
  Accept: "application/json,application/xml,text/xml,text/plain,*/*",
};
const MAX_INSIDER_AGE_DAYS = 366;
// Keep the complete rolling-year event set for active issuers while retaining a
// hard safety ceiling for unusually noisy or malformed feeds. Per-symbol detail
// files are generated artifacts and are intentionally excluded from Git history.
const MAX_INSIDER_TRANSACTIONS = 2_000;
const SIGNAL_LIMIT = Math.max(0, Number(process.env.SIGNAL_LIMIT ?? 0));
const SIGNAL_SYMBOLS = new Set((process.env.SIGNAL_SYMBOLS ?? "").split(",").map((symbol) => symbol.trim().toUpperCase()).filter(Boolean));
const BOOTSTRAP_SIGNAL_SYMBOLS = new Set(["AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMZN", "TSLA", "ADBE", "CRM", "AMD", "AVGO", "NKE", "SBUX", "COST", "HD", "UNH", "JNJ", "KO", "DIS", "PYPL", "DUOL"]);

let secGate = Promise.resolve();
let lastSecRequest = 0;

async function enterSecQueue() {
  const turn = secGate.then(async () => {
    const delay = Math.max(0, 135 - (Date.now() - lastSecRequest));
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    lastSecRequest = Date.now();
  });
  secGate = turn.catch(() => {});
  await turn;
}

async function fetchOk(url, init = {}, { retryForbidden = true } = {}) {
  const isSec = new URL(url).hostname.endsWith("sec.gov");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (isSec) await enterSecQueue();
    const response = await fetch(url, { ...init, headers: { ...(isSec ? SEC_HEADERS : {}), ...(init.headers ?? {}) } });
    if (response.ok) return response;
    const retryable = [429, 500, 502, 503].includes(response.status) || (retryForbidden && response.status === 403);
    if (!retryable || attempt === 3) throw new Error(`${response.status} ${response.statusText}: ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
  }
  throw new Error(`Request failed: ${url}`);
}

async function readJsonIfPresent(file) {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function loadMarket() {
  const localIndex = await readJsonIfPresent(MARKET_INDEX_PATH);
  if (localIndex?.stocks?.length) return localIndex;
  try {
    const deployed = await (await fetchOk(`${DEPLOYED_BASE_URL}/data/market/index.json`)).json();
    if (deployed?.stocks?.length) return deployed;
  } catch (error) {
    process.stderr.write(`[signals] deployed market index unavailable: ${error.message}\n`);
  }
  const legacy = await readJsonIfPresent(LEGACY_MARKET_PATH);
  if (!legacy?.stocks?.length) throw new Error("No market universe is available.");
  return legacy;
}

async function loadBaseline() {
  const local = await readJsonIfPresent(OUTPUT_PATH);
  if (local?.signals) return local;
  try {
    const deployed = await (await fetchOk(`${DEPLOYED_BASE_URL}/data/research-signals.json`)).json();
    if (deployed?.signals) return deployed;
  } catch { /* The checked-in bootstrap remains a valid first-deploy fallback. */ }
  return { signals: {} };
}

async function loadDetailBaselines(stocks) {
  const details = new Map();
  for (const stock of stocks) {
    const detail = await readJsonIfPresent(path.join(DETAIL_DIR, `${symbolSlug(stock.symbol)}.json`));
    if (detail?.symbol === stock.symbol) details.set(stock.symbol, detail);
  }
  return details;
}

function knownCompleteAccessions(signal) {
  const transactions = signal?.insider?.transactions ?? [];
  // The previous generator capped detail at 120 rows. An exact cap can split a
  // filing, so those issuers are deliberately rescanned instead of guessed.
  if (transactions.length === 120 || transactions.length === 500 || transactions.length >= MAX_INSIDER_TRANSACTIONS) return new Set();
  return new Set(transactions.map((transaction) => transaction.accession).filter(Boolean));
}

function quarterCandidates(now = new Date()) {
  const result = [];
  let year = now.getUTCFullYear();
  let quarter = Math.floor(now.getUTCMonth() / 3) + 1;
  for (let index = 0; index < 8; index += 1) {
    result.push({ year, quarter });
    quarter -= 1;
    if (quarter === 0) { quarter = 4; year -= 1; }
  }
  return result;
}

function tsvRows(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const headers = lines.shift()?.split("\t") ?? [];
  return lines.filter(Boolean).map((line) => {
    const values = line.split("\t");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function zipText(zip, suffix) {
  const key = Object.keys(zip).find((name) => name.toUpperCase().endsWith(suffix.toUpperCase()));
  if (!key) throw new Error(`${suffix} is missing from SEC insider data set.`);
  return strFromU8(zip[key]);
}

function normalizeSecDate(value) {
  const text = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})-([A-Z]{3})-(\d{4})$/i);
  if (!match) return null;
  const month = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"].indexOf(match[2].toUpperCase()) + 1;
  return month ? `${match[3]}-${String(month).padStart(2, "0")}-${match[1].padStart(2, "0")}` : null;
}

function finite(value) {
  if (value == null || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roleForOwner(owner) {
  return [owner?.RPTOWNER_RELATIONSHIP, owner?.RPTOWNER_TITLE].filter(Boolean).join(" / ") || "Reporting owner";
}

function secAccessionUrl(cik, accession) {
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replaceAll("-", "")}/${accession}-index.html`;
}

function ownershipDirection(value) {
  return String(value ?? "").trim().toUpperCase() === "D" ? "disposed" : "acquired";
}

function ownershipMethod(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized === "D" ? "direct" : normalized === "I" ? "indirect" : null;
}

function footnoteIds(value) {
  return String(value ?? "").split(/[,\s]+/).map((item) => item.trim()).filter(Boolean);
}

function contextForBulkRow(row, footnotes) {
  const ids = [...new Set(Object.entries(row)
    .filter(([name, value]) => name.endsWith("_FN") && value)
    .flatMap(([, value]) => footnoteIds(value)))];
  return ids.map((id) => footnotes.get(row.ACCESSION_NUMBER)?.get(id)).filter(Boolean).join(" ") || null;
}

async function loadBulkInsiders(stocks) {
  const byCik = new Map(stocks.map((stock) => [String(Number(stock.cik)), stock.symbol]));
  const result = new Map(stocks.map((stock) => [stock.symbol, []]));
  let loaded = 0;
  for (const { year, quarter } of quarterCandidates()) {
    if (loaded >= 4) break;
    let zip;
    let unavailableReason = "not published";
    const locations = [
      `https://www.sec.gov/files/datastandardsinnovation/data/insider-transactions-data-sets/${year}q${quarter}_form345.zip`,
      `https://www.sec.gov/files/structureddata/data/insider-transactions-data-sets/${year}q${quarter}_form345.zip`,
    ];
    for (const url of locations) {
      try {
        const response = await fetchOk(url);
        zip = unzipSync(new Uint8Array(await response.arrayBuffer()));
        break;
      } catch (error) { unavailableReason = error.message.split(":")[0]; }
    }
    if (!zip) {
      process.stdout.write(`[signals] SEC ${year} Q${quarter} insider bulk unavailable (${unavailableReason})\n`);
      continue;
    }
    loaded += 1;
    const submissions = new Map();
    for (const row of tsvRows(zipText(zip, "SUBMISSION.tsv"))) {
      const symbol = byCik.get(String(Number(row.ISSUERCIK)));
      if (symbol && /^4(?:\/A)?$/i.test(row.DOCUMENT_TYPE)) submissions.set(row.ACCESSION_NUMBER, { ...row, symbol });
    }
    const owners = new Map();
    for (const row of tsvRows(zipText(zip, "REPORTINGOWNER.tsv"))) {
      if (submissions.has(row.ACCESSION_NUMBER) && !owners.has(row.ACCESSION_NUMBER)) owners.set(row.ACCESSION_NUMBER, row);
    }
    const footnotes = new Map();
    for (const row of tsvRows(zipText(zip, "FOOTNOTES.tsv"))) {
      if (!submissions.has(row.ACCESSION_NUMBER)) continue;
      if (!footnotes.has(row.ACCESSION_NUMBER)) footnotes.set(row.ACCESSION_NUMBER, new Map());
      footnotes.get(row.ACCESSION_NUMBER).set(row.FOOTNOTE_ID, clean(row.FOOTNOTE_TXT));
    }
    for (const row of tsvRows(zipText(zip, "NONDERIV_TRANS.tsv"))) {
      const submission = submissions.get(row.ACCESSION_NUMBER);
      const code = String(row.TRANS_CODE ?? "").trim().toUpperCase();
      if (!submission || !/^[A-Z]$/.test(code)) continue;
      const shares = Math.max(0, finite(row.TRANS_SHARES) ?? 0);
      const price = finite(row.TRANS_PRICEPERSHARE);
      const transactionDate = normalizeSecDate(row.TRANS_DATE) ?? normalizeSecDate(submission.PERIOD_OF_REPORT) ?? normalizeSecDate(submission.FILING_DATE);
      const filingDate = normalizeSecDate(submission.FILING_DATE);
      if (!transactionDate || !filingDate) continue;
      const owner = owners.get(row.ACCESSION_NUMBER);
      const filingContext = contextForBulkRow(row, footnotes);
      const rule10b51 = /^(?:1|true)$/i.test(submission.AFF10B5ONE) || /10b5-?1/i.test(filingContext ?? "");
      const category = classifyInsiderTransaction({ code, filingContext, rule10b51 });
      result.get(submission.symbol).push({
        accession: row.ACCESSION_NUMBER,
        ownerName: owner?.RPTOWNERNAME || "Undisclosed reporting owner",
        ownerRole: roleForOwner(owner),
        transactionDate,
        filingDate,
        code,
        action: actionForCategory(category),
        category,
        direction: ownershipDirection(row.TRANS_ACQUIRED_DISP_CD),
        securityTitle: row.SECURITY_TITLE || "Reported security",
        shares,
        price,
        value: ["P", "S"].includes(code) && price != null ? shares * price : null,
        sharesOwnedAfter: finite(row.SHRS_OWND_FOLWNG_TRANS),
        directOrIndirect: ownershipMethod(row.DIRECT_INDIRECT_OWNERSHIP),
        natureOfOwnership: row.NATURE_OF_OWNERSHIP || null,
        rule10b51,
        filingContext,
        sourceUrl: secAccessionUrl(submission.ISSUERCIK, row.ACCESSION_NUMBER),
      });
    }
    process.stdout.write(`[signals] loaded official SEC insider bulk ${year} Q${quarter}\n`);
  }
  if (loaded < 2) throw new Error(`Only ${loaded} SEC insider bulk quarters were available.`);
  return result;
}

const clean = (value = "") => decodeEntities(String(value).replace(/<!\[CDATA\[|\]\]>/g, "")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const decodeEntities = (value) => value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const rawTag = (xml, name) => xml.match(new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${name}>`, "i"))?.[1] ?? "";
const tag = (xml, name) => clean(rawTag(xml, name));
const numericTag = (xml, name) => finite(tag(xml, name));
const blocks = (xml, name) => [...xml.matchAll(new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${name}>`, "gi"))].map((match) => match[1]);

function ownershipFootnotes(xml) {
  return new Map([...xml.matchAll(/<(?:\w+:)?footnote\b[^>]*\bid=["']([^"']+)["'][^>]*>([\s\S]*?)<\/(?:\w+:)?footnote>/gi)]
    .map((match) => [match[1], clean(match[2])]));
}

function contextForXmlTransaction(transaction, footnotes) {
  const ids = [...new Set([...transaction.matchAll(/<(?:\w+:)?footnoteId\b[^>]*\bid=["']([^"']+)["'][^>]*\/?\s*>/gi)].map((match) => match[1]))];
  return ids.map((id) => footnotes.get(id)).filter(Boolean).join(" ") || null;
}

function ownershipRole(xml) {
  const relationship = rawTag(xml, "reportingOwnerRelationship");
  const roles = [];
  if (/true|1/i.test(tag(relationship, "isDirector"))) roles.push("Director");
  if (/true|1/i.test(tag(relationship, "isOfficer"))) roles.push(tag(relationship, "officerTitle") || "Officer");
  if (/true|1/i.test(tag(relationship, "isTenPercentOwner"))) roles.push("10% owner");
  return roles.join(" / ") || "Reporting owner";
}

function parseOwnershipXml(xml, filing) {
  const owner = clean(tag(xml, "rptOwnerName")) || "Undisclosed reporting owner";
  const role = ownershipRole(xml);
  const footnotes = ownershipFootnotes(xml);
  const filingRule10b51 = /^(?:1|true)$/i.test(tag(xml, "aff10b5One"));
  const sourceUrl = `https://www.sec.gov/Archives/edgar/data/${filing.cikNumber}/${filing.accession.replaceAll("-", "")}/${path.posix.basename(filing.primaryDocument)}`;
  return blocks(xml, "nonDerivativeTransaction").flatMap((transaction) => {
    const code = tag(rawTag(transaction, "transactionCoding"), "transactionCode").toUpperCase();
    if (!/^[A-Z]$/.test(code)) return [];
    const amounts = rawTag(transaction, "transactionAmounts");
    const post = rawTag(transaction, "postTransactionAmounts");
    const ownership = rawTag(transaction, "ownershipNature");
    const shares = Math.max(0, numericTag(rawTag(amounts, "transactionShares"), "value") ?? 0);
    const price = numericTag(rawTag(amounts, "transactionPricePerShare"), "value");
    const filingContext = contextForXmlTransaction(transaction, footnotes);
    const rule10b51 = filingRule10b51 || /10b5-?1/i.test(filingContext ?? "");
    const category = classifyInsiderTransaction({ code, filingContext, rule10b51 });
    return [{
      accession: filing.accession,
      ownerName: owner,
      ownerRole: role,
      transactionDate: tag(rawTag(transaction, "transactionDate"), "value") || filing.filingDate,
      filingDate: filing.filingDate,
      code,
      action: actionForCategory(category),
      category,
      direction: ownershipDirection(tag(rawTag(amounts, "transactionAcquiredDisposedCode"), "value")),
      securityTitle: tag(rawTag(transaction, "securityTitle"), "value") || "Reported security",
      shares,
      price,
      value: ["P", "S"].includes(code) && price != null ? shares * price : null,
      sharesOwnedAfter: numericTag(rawTag(post, "sharesOwnedFollowingTransaction"), "value"),
      directOrIndirect: ownershipMethod(tag(rawTag(ownership, "directOrIndirectOwnership"), "value")),
      natureOfOwnership: tag(rawTag(ownership, "natureOfOwnership"), "value") || null,
      rule10b51,
      filingContext,
      sourceUrl,
    }];
  });
}

async function loadCurrentQuarterInsiders(stocks, quarterStart, knownAccessions = new Map()) {
  const result = new Map(stocks.map((stock) => [stock.symbol, []]));
  if (process.env.SIGNAL_SKIP_LIVE_INSIDERS === "1") return result;
  let cursor = 0;
  let completed = 0;
  let submissionsCircuitOpen = false;
  const workers = Array.from({ length: Math.min(6, stocks.length) }, async () => {
    while (cursor < stocks.length && !submissionsCircuitOpen) {
      const stock = stocks[cursor++];
      try {
        const submissions = await (await fetchOk(`https://data.sec.gov/submissions/CIK${stock.cik}.json`, {}, { retryForbidden: false })).json();
        const recent = submissions.filings?.recent ?? {};
        const known = knownAccessions.get(stock.symbol) ?? new Set();
        const filings = (recent.form ?? []).map((form, index) => ({ form, accession: recent.accessionNumber[index], filingDate: recent.filingDate[index], primaryDocument: recent.primaryDocument[index], cikNumber: String(Number(stock.cik)) }))
          .filter((filing) => /^4(?:\/A)?$/i.test(filing.form) && filing.filingDate >= quarterStart && filing.accession && filing.primaryDocument && !known.has(filing.accession));
        for (const filing of filings) {
          try {
            const url = `https://www.sec.gov/Archives/edgar/data/${filing.cikNumber}/${filing.accession.replaceAll("-", "")}/${path.posix.basename(filing.primaryDocument)}`;
            result.get(stock.symbol).push(...parseOwnershipXml(await (await fetchOk(url)).text(), filing));
          } catch (error) {
            process.stderr.write(`[signals] ${stock.symbol} skipped ${filing.accession}: ${error.message}\n`);
          }
        }
      } catch (error) {
        if (/^403\b/.test(error.message)) {
          if (!submissionsCircuitOpen) {
            submissionsCircuitOpen = true;
            process.stderr.write("[signals] SEC submissions unavailable from this runner; retaining the deployed and quarterly-bulk insider evidence.\n");
          }
        } else {
          process.stderr.write(`[signals] ${stock.symbol} live insider delta unavailable: ${error.message}\n`);
        }
      }
      completed += 1;
      if (completed % 100 === 0 || completed === stocks.length) process.stdout.write(`[signals] SEC live insider scan ${completed}/${stocks.length}\n`);
    }
  });
  await Promise.all(workers);
  if (submissionsCircuitOpen && completed < stocks.length) process.stdout.write(`[signals] SEC live insider scan stopped after ${completed}/${stocks.length}; deployed evidence retained\n`);
  return result;
}

function parseFinraDate(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 8 ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}` : null;
}

async function loadFinraShortInterest() {
  const html = await (await fetchOk(SHORT_SOURCE_PAGE)).text();
  const links = [...new Set(html.match(/https:\/\/cdn\.finra\.org\/equity\/otcmarket\/biweekly\/shrt\d{8}\.csv/gi) ?? [])].sort().reverse().slice(0, 2);
  if (!links.length) throw new Error("FINRA did not publish a short-interest file link.");
  const snapshots = [];
  for (const url of links) {
    const rows = tsvRows((await (await fetchOk(url)).text()).replaceAll("|", "\t"));
    snapshots.push({ url, bySymbol: new Map(rows.map((row) => [row.symbolCode?.trim().toUpperCase(), row])) });
  }
  return snapshots;
}

function shortSignal(stock, snapshots, baseline) {
  const currentRow = snapshots[0]?.bySymbol.get(stock.symbol);
  const priorRow = snapshots[1]?.bySymbol.get(stock.symbol);
  const sharesShort = finite(currentRow?.currentShortPositionQuantity);
  const priorShares = finite(priorRow?.currentShortPositionQuantity) ?? finite(currentRow?.previousShortPositionQuantity);
  const sharesOutstanding = stock.marketCap > 0 && stock.latestPrice > 0 ? stock.marketCap / stock.latestPrice : null;
  const asOf = parseFinraDate(currentRow?.settlementDate) ?? parseFinraDate(snapshots[0]?.url.match(/shrt(\d{8})/i)?.[1]);
  const history = snapshots.flatMap((snapshot) => {
    const row = snapshot.bySymbol.get(stock.symbol);
    const pointShares = finite(row?.currentShortPositionQuantity);
    const pointDate = parseFinraDate(row?.settlementDate) ?? parseFinraDate(snapshot.url.match(/shrt(\d{8})/i)?.[1]);
    if (pointShares == null || !pointDate) return [];
    return [{ asOf: pointDate, sharesShort: pointShares, sharesShortPriorMonth: finite(row.previousShortPositionQuantity), daysToCover: finite(row.daysToCoverQuantity), sharesPercentOutstanding: sharesOutstanding ? pointShares / sharesOutstanding : null }];
  }).sort((a, b) => a.asOf.localeCompare(b.asOf));
  return {
    available: sharesShort != null,
    asOf,
    sharesShort,
    sharesShortPriorMonth: priorShares,
    shortPercentOfFloat: baseline?.shortPercentOfFloat ?? null,
    sharesPercentOutstanding: sharesShort != null && sharesOutstanding ? sharesShort / sharesOutstanding : null,
    daysToCover: finite(currentRow?.daysToCoverQuantity),
    institutionalOwnership: baseline?.institutionalOwnership ?? null,
    insiderOwnership: baseline?.insiderOwnership ?? null,
    sourceUrl: snapshots[0]?.url ?? null,
    history,
  };
}

function holdingShares(quarter, symbol) {
  return (quarter?.holdings ?? []).filter((holding) => holding.symbol === symbol && holding.optionType == null).reduce((sum, holding) => sum + holding.shares, 0);
}

async function buildInstitutionalSignals(symbols) {
  const index = await readJsonIfPresent(path.join(INSTITUTIONAL_DIR, "index.json"));
  if (!index?.managers?.length) return Object.fromEntries(symbols.map((symbol) => [symbol, emptyInstitutional()]));
  const tracked = index.managers.filter((manager) => manager.lifecycle?.status !== "archived");
  const managers = (await Promise.all(tracked.map((summary) => readJsonIfPresent(path.join(INSTITUTIONAL_DIR, `${summary.id}.json`))))).filter(Boolean);
  const reportDate = managers.flatMap((manager) => manager.quarters?.[0]?.reportDate ?? []).sort().at(-1) ?? null;
  const reported = reportDate ? managers.filter((manager) => manager.quarters?.some((quarter) => quarter.reportDate === reportDate)) : [];
  const filingDate = reported.flatMap((manager) => manager.quarters.find((quarter) => quarter.reportDate === reportDate)?.filedDate ?? []).sort().at(-1) ?? null;
  return Object.fromEntries(symbols.map((symbol) => {
    const item = { ...emptyInstitutional(), reportDate, filingDate, expectedManagers: managers.length, managersReported: reported.length };
    for (const manager of reported) {
      const currentIndex = manager.quarters.findIndex((quarter) => quarter.reportDate === reportDate);
      const current = holdingShares(manager.quarters[currentIndex], symbol);
      const previous = holdingShares(manager.quarters.slice(currentIndex + 1).find((quarter) => quarter.reportDate < reportDate), symbol);
      if (current > 0) item.managersHolding += 1;
      if (current > 0 && previous === 0) item.managersNew += 1;
      else if (current > previous * 1.001) item.managersIncreased += 1;
      else if (current > 0 && current < previous * 0.999) item.managersReduced += 1;
      else if (current === 0 && previous > 0) item.managersExited += 1;
    }
    return [symbol, item];
  }));
}

function emptyInstitutional() {
  return { reportDate: null, filingDate: null, expectedManagers: 0, managersReported: 0, managersHolding: 0, managersIncreased: 0, managersReduced: 0, managersNew: 0, managersExited: 0 };
}

function emptyAnalyst(reason = "Analyst consensus was not collected for this company in the official-source refresh.") {
  return { available: false, reason, asOf: null, recommendationKey: null, recommendationMean: null, numberOfAnalysts: 0, targetLow: null, targetMean: null, targetMedian: null, targetHigh: null, targetUpside: null, trend: [], actions: [] };
}

function compactSignal(signal) {
  const transactions = BOOTSTRAP_SIGNAL_SYMBOLS.has(signal.symbol) ? signal.insider.transactions.slice(0, 3) : [];
  return { ...signal, insider: { ...signal.insider, transactions }, analyst: { ...signal.analyst, trend: signal.analyst.trend.slice(0, 1), actions: [] }, shortInterest: { ...signal.shortInterest, history: [] } };
}

function serializeLineOrientedIndex(output) {
  const { signals, ...metadata } = output;
  const lines = ["{"];
  for (const [key, value] of Object.entries(metadata)) lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value)},`);
  lines.push('  "signals": {');
  const entries = Object.entries(signals);
  entries.forEach(([symbol, signal], index) => lines.push(`    ${JSON.stringify(symbol)}: ${JSON.stringify(signal)}${index === entries.length - 1 ? "" : ","}`));
  lines.push("  }", "}");
  return `${lines.join("\n")}\n`;
}

function normalizeStoredSignal(signal) {
  const transactions = groupInsiderTransactions(signal.insider?.transactions ?? []);
  return {
    ...signal,
    insider: {
      ...signal.insider,
      // Aggregate files intentionally keep only three example rows. Their
      // complete summary must survive a targeted refresh of other symbols.
      summary: signal.insider?.summary ?? summarizeInsiderTransactions(transactions),
      transactions,
    },
  };
}

async function main() {
  const generatedAt = new Date().toISOString();
  const market = await loadMarket();
  const allStocks = market.stocks;
  const selectedStocks = SIGNAL_SYMBOLS.size ? allStocks.filter((stock) => SIGNAL_SYMBOLS.has(stock.symbol)) : allStocks;
  const stocks = SIGNAL_LIMIT ? selectedStocks.slice(0, SIGNAL_LIMIT) : selectedStocks;
  const baseline = await loadBaseline();
  const detailBaselines = await loadDetailBaselines(stocks);
  process.stdout.write(`[signals] building ${stocks.length}/${allStocks.length} company signals\n`);

  const institutional = await buildInstitutionalSignals(stocks.map((stock) => stock.symbol));
  const bulkInsiders = await loadBulkInsiders(stocks);
  const now = new Date(generatedAt);
  const quarterStart = new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1)).toISOString().slice(0, 10);
  const knownAccessions = new Map(stocks.map((stock) => [stock.symbol, knownCompleteAccessions(detailBaselines.get(stock.symbol))]));
  const liveInsiders = await loadCurrentQuarterInsiders(stocks, quarterStart, knownAccessions);
  const finra = await loadFinraShortInterest();
  const cutoff = new Date(now.getTime() - MAX_INSIDER_AGE_DAYS * 86_400_000).toISOString().slice(0, 10);
  const details = {};

  for (const stock of stocks) {
    const previous = detailBaselines.get(stock.symbol) ?? baseline.signals?.[stock.symbol];
    const transactions = reconcileInsiderEvidence({
      previousRows: previous?.insider?.transactions ?? [],
      bulkRows: bulkInsiders.get(stock.symbol) ?? [],
      liveRows: liveInsiders.get(stock.symbol) ?? [],
      cutoff,
    });
    details[stock.symbol] = {
      symbol: stock.symbol,
      insider: {
        asOf: transactions[0]?.filingDate ?? generatedAt.slice(0, 10),
        summary: summarizeInsiderTransactions(transactions),
        transactions: transactions.slice(0, MAX_INSIDER_TRANSACTIONS),
      },
      institutional: institutional[stock.symbol] ?? emptyInstitutional(),
      analyst: previous?.analyst ?? emptyAnalyst(),
      shortInterest: shortSignal(stock, finra, previous?.shortInterest),
    };
  }

  const isPartialBuild = Boolean(SIGNAL_LIMIT || SIGNAL_SYMBOLS.size);
  const mergedSignals = isPartialBuild
    ? { ...Object.fromEntries(Object.entries(baseline.signals ?? {}).map(([symbol, signal]) => [symbol, normalizeStoredSignal(signal)])), ...Object.fromEntries(Object.entries(details).map(([symbol, signal]) => [symbol, compactSignal(signal)])) }
    : Object.fromEntries(Object.entries(details).map(([symbol, signal]) => [symbol, compactSignal(signal)]));
  const indexedSignals = Object.fromEntries(Object.entries(mergedSignals).map(([symbol, signal]) => [symbol, compactSignal(signal)]));
  const output = {
    schemaVersion: 3,
    generatedAt,
    methodology: "Signals are computed locally from official SEC insider, SEC 13F, and FINRA short-interest disclosures. Insider activity separates personal-capital purchases and reported sales from awards, option exercises, tax transactions, gifts, conversions, and other common-share ownership changes in a rolling one-year window. Sales are reported as activity rather than treated as the inverse of personal buying. Institutional breadth compares one report period across tracked managers and exposes reporting progress. Short interest is the latest periodic FINRA publication, not a live estimate. Analyst data is supplemental and may be unavailable.",
    sources: { insiders: INSIDER_SOURCE_PAGE, institutions: INSTITUTIONAL_SOURCE_PAGE, analysts: "https://finance.yahoo.com/", shortInterest: SHORT_SOURCE_PAGE },
    coverage: {
      universe: Object.keys(indexedSignals).length,
      insiders: Object.values(indexedSignals).filter((signal) => {
        const summary = signal.insider.summary;
        return summary.purchaseCount + summary.saleCount + summary.compensationCount + summary.administrativeCount > 0;
      }).length,
      shortInterest: Object.values(indexedSignals).filter((signal) => signal.shortInterest.available).length,
      institutions: Object.values(indexedSignals).filter((signal) => signal.institutional.managersHolding > 0).length,
    },
    signals: indexedSignals,
  };

  if (!SIGNAL_LIMIT && !SIGNAL_SYMBOLS.size && Object.keys(output.signals).length !== allStocks.length) throw new Error("Signal output does not cover the complete market universe.");
  if (isPartialBuild) {
    await Promise.all(Object.entries(details).map(([symbol, signal]) => writeJsonAtomic(path.join(DETAIL_DIR, `${symbolSlug(symbol)}.json`), signal)));
  } else {
    const stagedDetails = await createStagedDirectory(DETAIL_DIR);
    try {
      await Promise.all(Object.entries(details).map(([symbol, signal]) => writeFile(path.join(stagedDetails, `${symbolSlug(symbol)}.json`), `${JSON.stringify(signal)}\n`, "utf8")));
      await replaceDirectory(stagedDetails, DETAIL_DIR);
    } catch (error) {
      await rm(stagedDetails, { recursive: true, force: true });
      throw error;
    }
  }
  // One symbol per line keeps the eager index small while remaining friendly to
  // Git delta compression and code review.
  await writeTextAtomic(OUTPUT_PATH, serializeLineOrientedIndex(output));
  process.stdout.write(`[signals] wrote ${stocks.length} summaries and symbol details (${output.coverage.shortInterest} short, ${output.coverage.insiders} insider, ${output.coverage.institutions} institutional)\n`);
}

await main();
