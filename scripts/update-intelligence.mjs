import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, "public", "data");
const SEC_HEADERS = {
  "User-Agent": `Tide Equity Research ${process.env.SEC_CONTACT ?? "contact@example.com"}`,
  Accept: "application/json,text/xml,application/xml,text/html,application/pdf",
};

const MANAGERS = [
  { id: "berkshire", name: "Berkshire Hathaway", manager: "Warren Buffett", cik: "0001067983", description: "Long-duration, concentrated public-equity portfolio." },
  { id: "pershing", name: "Pershing Square", manager: "Bill Ackman", cik: "0001336528", description: "Concentrated activist investment manager." },
  { id: "bridgewater", name: "Bridgewater Associates", manager: "Ray Dalio / Investment Committee", cik: "0001350694", description: "Diversified systematic investment manager." },
  { id: "scion", name: "Scion Asset Management", manager: "Michael Burry", cik: "0001649339", description: "Concentrated, opportunistic investment manager." },
  { id: "appaloosa", name: "Appaloosa", manager: "David Tepper", cik: "0001006438", description: "Value-oriented opportunistic investment manager." },
  { id: "tiger-global", name: "Tiger Global Management", manager: "Chase Coleman", cik: "0001167483", description: "Technology-focused public and private investment manager." },
  { id: "baupost", name: "The Baupost Group", manager: "Seth Klarman", cik: "0001061768", description: "Value-focused, long-term investment manager." },
  { id: "duquesne", name: "Duquesne Family Office", manager: "Stanley Druckenmiller", cik: "0001536411", description: "Macro-informed family office portfolio." },
  { id: "soros", name: "Soros Fund Management", manager: "Investment Committee", cik: "0001029160", description: "Global investment management family office." },
];

const OFFICIALS = [
  { id: "nancy-pelosi", name: "Nancy Pelosi", lastName: "Pelosi", match: /Pelosi/i, party: "D", state: "CA", district: "11", chamber: "House", role: "Representative" },
  { id: "michael-mccaul", name: "Michael McCaul", lastName: "McCaul", match: /McCaul/i, party: "R", state: "TX", district: "10", chamber: "House", role: "Representative" },
  { id: "ro-khanna", name: "Ro Khanna", lastName: "Khanna", match: /Khanna/i, party: "D", state: "CA", district: "17", chamber: "House", role: "Representative" },
  { id: "marjorie-taylor-greene", name: "Marjorie Taylor Greene", lastName: "Greene", match: /Greene/i, party: "R", state: "GA", district: "14", chamber: "House", role: "Representative" },
  { id: "josh-gottheimer", name: "Josh Gottheimer", lastName: "Gottheimer", match: /Gottheimer/i, party: "D", state: "NJ", district: "5", chamber: "House", role: "Representative" },
  { id: "debbie-wasserman-schultz", name: "Debbie Wasserman Schultz", lastName: "Wasserman Schultz", match: /Wasserman/i, party: "D", state: "FL", district: "25", chamber: "House", role: "Representative" },
];

const TICKERS = new Map(Object.entries({
  "APPLE INC": "AAPL", "MICROSOFT CORP": "MSFT", "AMAZON COM INC": "AMZN", "ALPHABET INC": "GOOGL",
  "NVIDIA CORP": "NVDA", "META PLATFORMS INC": "META", "TESLA INC": "TSLA", "BROADCOM INC": "AVGO",
  "VISA INC": "V", "MASTERCARD INC": "MA", "AMERICAN EXPRESS CO": "AXP", "COCA COLA CO": "KO",
  "CHEVRON CORP NEW": "CVX", "OCCIDENTAL PETE CORP": "OXY", "BANK AMERICA CORP": "BAC",
  "MOODYS CORP": "MCO", "KRAFT HEINZ CO": "KHC", "DAVITA INC": "DVA", "CHUBB LIMITED": "CB",
  "DOMINOS PIZZA INC": "DPZ", "VERISIGN INC": "VRSN", "SIRIUS XM HOLDINGS INC": "SIRI",
  "SPDR S&P 500 ETF TR": "SPY", "ISHARES TR": "IVV", "INVESCO QQQ TR": "QQQ",
  "TAIWAN SEMICONDUCTOR MFG LTD": "TSM", "UBER TECHNOLOGIES INC": "UBER", "SALESFORCE INC": "CRM",
  "NETFLIX INC": "NFLX", "PAYPAL HLDGS INC": "PYPL", "WALT DISNEY CO": "DIS", "HOME DEPOT INC": "HD",
  "UNITEDHEALTH GROUP INC": "UNH", "JOHNSON & JOHNSON": "JNJ", "ADVANCED MICRO DEVICES INC": "AMD",
}));

const SECTORS = new Map(Object.entries({
  AAPL: "Technology", MSFT: "Technology", NVDA: "Technology", AVGO: "Technology", AMD: "Technology", CRM: "Technology",
  GOOGL: "Communication services", META: "Communication services", NFLX: "Communication services", DIS: "Communication services",
  AMZN: "Consumer discretionary", TSLA: "Consumer discretionary", HD: "Consumer discretionary", DPZ: "Consumer discretionary",
  AXP: "Financials", BAC: "Financials", V: "Financials", MA: "Financials", CB: "Financials", PYPL: "Financials",
  CVX: "Energy", OXY: "Energy", KO: "Consumer staples", KHC: "Consumer staples", UNH: "Health care", JNJ: "Health care",
  SPY: "ETF", IVV: "ETF", QQQ: "ETF", TSM: "Technology", UBER: "Industrials",
}));

const DISPLAY_ASSETS = new Map(Object.entries({
  AAPL: "Apple Inc.", AMZN: "Amazon.com, Inc.", GOOGL: "Alphabet Inc. Class A", GOOG: "Alphabet Inc. Class C", AXP: "American Express Company",
  T: "AT&T Inc.", SQ: "Block, Inc.", AVGO: "Broadcom Inc.", CMCSA: "Comcast Corporation", CRWD: "CrowdStrike Holdings",
  DBX: "Dropbox, Inc.", IBKR: "Interactive Brokers Group", MSFT: "Microsoft Corporation", MORN: "Morningstar, Inc.", NFLX: "Netflix, Inc.",
  NVDA: "NVIDIA Corporation", PANW: "Palo Alto Networks", PYPL: "PayPal Holdings", QCOM: "Qualcomm, Inc.", RBLX: "Roblox Corporation",
  CRM: "Salesforce, Inc.", V: "Visa Inc.", DIS: "The Walt Disney Company", WBD: "Warner Bros. Discovery", INTC: "Intel Corporation",
  UBER: "Uber Technologies", VST: "Vistra Corp.", TEM: "Tempus AI", AMD: "Advanced Micro Devices", UNH: "UnitedHealth Group",
  META: "Meta Platforms", JNJ: "Johnson & Johnson", JPM: "JPMorgan Chase", LLY: "Eli Lilly", HD: "Home Depot", ASML: "ASML Holding",
  "BRK.B": "Berkshire Hathaway", IBIT: "iShares Bitcoin Trust ETF", CAT: "Caterpillar", NEE: "NextEra Energy", OXY: "Occidental Petroleum",
}));

let lastSecRequest = 0;
async function fetchOk(url, init = {}) {
  const isSec = new URL(url).hostname.endsWith("sec.gov");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (isSec) {
      const wait = Math.max(0, 260 - (Date.now() - lastSecRequest));
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
      lastSecRequest = Date.now();
    }
    const response = await fetch(url, { ...init, headers: { ...SEC_HEADERS, ...(init.headers ?? {}) } });
    if (response.ok) return response;
    if (![403, 429, 500, 502, 503].includes(response.status) || attempt === 3) throw new Error(`${response.status} ${response.statusText}: ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }
  throw new Error(`Request failed: ${url}`);
}

const clean = (value = "") => decodeEntities(String(value)).replace(/\s+/g, " ").trim();
const decodeEntities = (value) => value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const tag = (xml, name) => clean(xml.match(new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${name}>`, "i"))?.[1] ?? "");
const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function normalizedIssuer(value) {
  return clean(value).toUpperCase().replace(/\b(CL A|CL B|COM|COMMON|NEW|DEL|PLC|LTD|HOLDINGS|HLDGS)\b/g, "").replace(/[^A-Z0-9&]+/g, " ").replace(/\s+/g, " ").trim();
}

function guessTicker(name, securityClass = "") {
  const upper = clean(name).toUpperCase();
  if (/ALPHABET/.test(upper)) return /CL C|CLASS C/i.test(securityClass) ? "GOOG" : "GOOGL";
  if (/BERKSHIRE HATHAWAY/.test(upper)) return /CL B|CLASS B/i.test(securityClass) ? "BRK.B" : "BRK.A";
  if (TICKERS.has(upper)) return TICKERS.get(upper);
  const normalized = normalizedIssuer(upper);
  for (const [issuer, ticker] of TICKERS) if (normalizedIssuer(issuer) === normalized) return ticker;
  return null;
}

async function fetchInstitutional() {
  const managers = [];
  for (const config of MANAGERS) {
    process.stdout.write(`13F ${config.name}... `);
    const submissions = await (await fetchOk(`https://data.sec.gov/submissions/CIK${config.cik}.json`)).json();
    const recent = submissions.filings?.recent ?? {};
    const candidates = (recent.form ?? []).map((form, index) => ({
      form, accession: recent.accessionNumber[index], filedAt: recent.filingDate[index], reportDate: recent.reportDate[index], primaryDocument: recent.primaryDocument[index],
    })).filter((filing) => filing.form === "13F-HR" && filing.accession && filing.reportDate).slice(0, 8);
    const quarters = [];
    for (const filing of candidates) {
      try {
        const accession = filing.accession.replaceAll("-", "");
        const base = `https://www.sec.gov/Archives/edgar/data/${Number(config.cik)}/${accession}`;
        const index = await (await fetchOk(`${base}/index.json`)).json();
        const files = index.directory?.item ?? [];
        const xmlFile = files.find((file) => /\.xml$/i.test(file.name) && !/primary_doc|primary-document|cover|header/i.test(file.name)) ?? files.find((file) => /\.xml$/i.test(file.name));
        if (!xmlFile) throw new Error("information table XML not found");
        const xml = await (await fetchOk(`${base}/${xmlFile.name}`)).text();
        const raw = [...xml.matchAll(/<(?:\w+:)?infoTable(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?infoTable>/gi)];
        const aggregated = new Map();
        const parsedEntries = raw.map((match) => {
          const block = match[1];
          return { issuer: tag(block, "nameOfIssuer"), title: tag(block, "titleOfClass"), cusip: tag(block, "cusip"), value: Number(tag(block, "value").replaceAll(",", "")) || 0, shares: Number(tag(block, "sshPrnamt").replaceAll(",", "")) || 0, amountType: tag(block, "sshPrnamtType"), putCall: tag(block, "putCall") || null };
        });
        // The legacy 13F schema reports value in thousands; the modern schema
        // reports dollars. Detect the filing-level convention from common-share
        // value-per-share ratios, rather than guessing position by position.
        const ratios = parsedEntries.filter((entry) => entry.amountType === "SH" && entry.shares > 0 && entry.value > 0).map((entry) => entry.value / entry.shares).sort((a, b) => a - b);
        const valueMultiplier = ratios.length && ratios[Math.floor(ratios.length / 2)] < 1 ? 1000 : 1;
        for (const entry of parsedEntries) {
          const { issuer, title, cusip, shares, putCall } = entry;
          const value = entry.value * valueMultiplier;
          if (!issuer || value <= 0) continue;
          const key = `${cusip}-${putCall ?? "long"}`;
          const previous = aggregated.get(key);
          if (previous) { previous.value += value; previous.shares += shares; }
          else aggregated.set(key, { issuer, securityClass: title, symbol: guessTicker(issuer, title), cusip, value, shares, optionType: putCall ? putCall.toUpperCase() : null, sector: SECTORS.get(guessTicker(issuer, title)) ?? "Other", weight: 0 });
        }
        const holdings = [...aggregated.values()].sort((a, b) => b.value - a.value);
        const totalValue = holdings.reduce((sum, holding) => sum + holding.value, 0);
        for (const holding of holdings) holding.weight = totalValue ? (holding.value / totalValue) * 100 : 0;
        quarters.push({
          reportDate: filing.reportDate, filedDate: filing.filedAt, accession: filing.accession, totalValue, holdingsCount: holdings.length, amendment: false,
          sourceUrl: `https://www.sec.gov/Archives/edgar/data/${Number(config.cik)}/${accession}/${filing.primaryDocument}`,
          holdings: holdings.slice(0, 200),
        });
      } catch (error) {
        process.stderr.write(`\n  skipped ${filing.reportDate}: ${error.message}`);
      }
    }
    managers.push({ id: config.id, cik: config.cik, name: config.name, displayName: config.manager, description: config.description, style: config.description.split(" ").slice(0, 3).join(" "), quarters });
    process.stdout.write(`${quarters.length} quarters\n`);
  }
  return {
    generatedAt: new Date().toISOString(),
    coverageStart: "2013-04-01",
    source: "SEC EDGAR Form 13F information tables",
    sourceUrl: "https://www.sec.gov/edgar/sec-api-documentation",
    methodology: "Quarterly long U.S.-listed positions disclosed on Form 13F. Values and shares are reported by each filer and can be amended. Shorts, most cash, and many non-U.S. securities are excluded.",
    managers,
  };
}

function stripHtml(value) {
  return decodeEntities(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

async function houseSearch(lastName, year) {
  const landing = await fetchOk("https://disclosures-clerk.house.gov/FinancialDisclosure/ViewSearch", { headers: { Accept: "text/html" } });
  const html = await landing.text();
  const token = html.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/i)?.[1];
  const cookie = typeof landing.headers.getSetCookie === "function" ? landing.headers.getSetCookie().map((item) => item.split(";", 1)[0]).join("; ") : landing.headers.get("set-cookie")?.split(";", 1)[0];
  if (!token) throw new Error("House search token was not available");
  const body = new URLSearchParams({ LastName: lastName, FilingYear: String(year), State: "", District: "", __RequestVerificationToken: token });
  const response = await fetchOk("https://disclosures-clerk.house.gov/FinancialDisclosure/ViewMemberSearchResult", {
    method: "POST", body, headers: { Accept: "text/html", "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie ?? "", Referer: "https://disclosures-clerk.house.gov/FinancialDisclosure/ViewSearch" },
  });
  const resultHtml = await response.text();
  return [...resultHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap((match) => {
    const row = match[1];
    const href = row.match(/href="([^"]+\.pdf)"/i)?.[1];
    if (!href) return [];
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => stripHtml(cell[1]));
    const label = cells.join(" · ");
    return [{ label, url: new URL(href.replace(/^\.?\//, "/"), "https://disclosures-clerk.house.gov").href, type: /periodic transaction|\bPTR\b/i.test(label) ? "PTR" : /annual|FD Original/i.test(label) ? "Annual" : "Other", year }];
  });
}

function parseRange(value) {
  const normalized = clean(value).replace(/\s+to\s+/i, " - ");
  const numbers = [...normalized.matchAll(/\$?([\d,]+)/g)].map((match) => Number(match[1].replaceAll(",", "")));
  if (/over/i.test(normalized) && numbers[0]) return { label: normalized, min: numbers[0], max: null };
  if (numbers.length >= 2) return { label: normalized, min: numbers[0], max: numbers[1] };
  if (numbers[0]) return { label: normalized, min: numbers[0], max: numbers[0] };
  return null;
}

function pdfDate(value) {
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return null;
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function ownerName(code) {
  return ({ SP: "Spouse", JT: "Joint", DC: "Dependent child" })[code] ?? "Self";
}

function assetType(code) {
  return ({ ST: "Stock", OP: "Option", MF: "Fund", PS: "Partnership", OT: "Other" })[code] ?? "Other";
}

function actionName(code) {
  if (/^P$/i.test(code)) return "Purchase";
  if (/^S/i.test(code)) return "Sale";
  if (/^E$/i.test(code)) return "Exchange";
  return clean(code);
}

function tidyAsset(value) {
  return clean(value).replace(/^(?:[A-Z]\.|[A-Z]\d+\.|\d+\.)\s*/, "").replace(/^(?:SP|JT|DC)\s+/, "").replace(/^(?:DESCRIPTION|ASSET|TRANSACTIONS?)\s+/i, "").replace(/^(?:None|[\d,]+)\s+/, "").slice(-110);
}

function parseAnnualHoldings(text, sourceUrl) {
  const holdings = [];
  const regex = /([A-Za-z0-9&.,'’/\- ]{2,110}?)\s+\(([A-Z.]{1,7})\)\s+\[(ST|OP|MF|OT|PS)\]\s+(?:(SP|JT|DC)\s+)?(\$[\d,]+\s*-\s*\$[\d,]+|Over\s+\$[\d,]+|None)/g;
  for (const match of text.matchAll(regex)) {
    const range = parseRange(match[5]);
    const asset = DISPLAY_ASSETS.get(match[2]) ?? tidyAsset(match[1]);
    if (!range || asset.length < 2 || /schedule|asset and income|description/i.test(asset)) continue;
    holdings.push({ id: slug(`${match[2]}-${match.index}`), asset, symbol: match[2], assetType: assetType(match[3]).toLowerCase(), owner: ownerName(match[4]).toLowerCase().replace("dependent child", "dependent"), value: { label: range.label, minimum: range.min, maximum: range.max }, sector: SECTORS.get(match[2]) ?? "Other", sourceUrl });
  }
  const best = new Map();
  for (const holding of holdings) {
    const key = `${holding.symbol}-${holding.assetType}-${holding.owner}`;
    const prior = best.get(key);
    if (!prior || (holding.value.maximum ?? holding.value.minimum) > (prior.value.maximum ?? prior.value.minimum)) best.set(key, holding);
  }
  return [...best.values()].sort((a, b) => (b.value.maximum ?? b.value.minimum) - (a.value.maximum ?? a.value.minimum));
}

function parseTransactions(text, sourceUrl, sourceType) {
  const normalized = text.replace(/\s+/g, " ");
  const transactions = [];
  const patterns = [
    { regex: /([A-Za-z0-9&.,'’/\- ]{2,115}?)\s+\(([A-Z.]{1,7})\)\s+\[(ST|OP|MF|OT|PS)\]\s+(?:(SP|JT|DC)\s+)?(P|S(?:\s*\(partial\))?|E)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(?:\d{1,2}\/\d{1,2}\/\d{4}\s+)?(\$[\d,]+\s*-\s*\$[\d,]+|Over\s+\$[\d,]+)/gi, action: 5, date: 6, amount: 7 },
    { regex: /([A-Za-z0-9&.,'’/\- ]{2,115}?)\s+\(([A-Z.]{1,7})\)\s+\[(ST|OP|MF|OT|PS)\]\s+(?:(SP|JT|DC)\s+)?(\d{1,2}\/\d{1,2}\/\d{4})\s+(P|S(?:\s*\(partial\))?|E)\s+(\$[\d,]+\s*-\s*\$[\d,]+|Over\s+\$[\d,]+)/gi, action: 6, date: 5, amount: 7 },
  ];
  for (const pattern of patterns) for (const match of normalized.matchAll(pattern.regex)) {
    const range = parseRange(match[pattern.amount]);
    const transactionDate = pdfDate(match[pattern.date]);
    const asset = DISPLAY_ASSETS.get(match[2].toUpperCase()) ?? tidyAsset(match[1]);
    if (!range || !transactionDate || asset.length < 2) continue;
    const action = actionName(match[pattern.action]);
    transactions.push({ id: slug(`${match[2]}-${transactionDate}-${match.index}`), asset, symbol: match[2].toUpperCase(), assetType: assetType(match[3].toUpperCase()).toLowerCase(), owner: ownerName(match[4]?.toUpperCase()).toLowerCase().replace("dependent child", "dependent"), transactionDate, type: action.toLowerCase().startsWith("sale") ? "sale" : action.toLowerCase(), partial: /partial/i.test(match[pattern.action]), notificationDate: null, filingDate: null, amount: { label: range.label, minimum: range.min, maximum: range.max }, description: sourceType, sourceUrl });
  }
  return transactions;
}

async function extractPdfText(url) {
  const bytes = new Uint8Array(await (await fetchOk(url, { headers: { Accept: "application/pdf" } })).arrayBuffer());
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjs.getDocument({ data: bytes, disableWorker: true }).promise;
  const pages = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
  }
  return pages.join(" \n ").replace(/\s+/g, " ");
}

async function fetchGovernment() {
  const officials = [];
  for (const config of OFFICIALS) {
    process.stdout.write(`House ${config.name}... `);
    try {
      const filingLists = await Promise.all([2026, 2025].map((year) => houseSearch(config.lastName, year).catch(() => [])));
      const filings = filingLists.flat().filter((filing) => config.match.test(filing.label));
      const annual = filings.find((filing) => filing.type === "Annual");
      const ptrs = filings.filter((filing) => filing.type === "PTR").slice(0, 10);
      let holdings = [];
      let annualTransactions = [];
      if (annual) {
        const text = await extractPdfText(annual.url);
        holdings = parseAnnualHoldings(text, annual.url);
        annualTransactions = parseTransactions(text, annual.url, "Annual report");
      }
      const ptrTransactions = [];
      for (const filing of ptrs) {
        try {
          const text = await extractPdfText(filing.url);
          ptrTransactions.push(...parseTransactions(text, filing.url, "Periodic transaction report"));
        } catch (error) {
          process.stderr.write(`\n  skipped PDF: ${error.message}`);
        }
      }
      const uniqueTransactions = new Map([...ptrTransactions, ...annualTransactions].map((transaction) => [`${transaction.symbol}-${transaction.transactionDate}-${transaction.type}-${transaction.amount.label}`, transaction]));
      const transactions = [...uniqueTransactions.values()].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
      officials.push({ id: config.id, name: config.name, chamber: config.chamber, party: config.party === "D" ? "Democratic" : config.party === "R" ? "Republican" : "Independent", state: config.state, district: config.district, role: config.role, holdingsAsOf: annual ? `${annual.year}-12-31` : null, annualFilingUrl: annual?.url ?? null, holdings, transactions, filingsReviewed: (annual ? 1 : 0) + ptrs.length });
      process.stdout.write(`${holdings.length} holdings, ${transactions.length} transactions\n`);
    } catch (error) {
      process.stderr.write(`failed: ${error.message}\n`);
      officials.push({ id: config.id, name: config.name, chamber: config.chamber, party: config.party === "D" ? "Democratic" : config.party === "R" ? "Republican" : "Independent", state: config.state, district: config.district, role: config.role, holdingsAsOf: null, annualFilingUrl: null, holdings: [], transactions: [], filingsReviewed: 0 });
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    source: "U.S. House of Representatives Financial Disclosure Reports Database",
    sourceUrl: "https://disclosures-clerk.house.gov/FinancialDisclosure",
    methodology: "Annual disclosures provide reported asset-value ranges; periodic transaction reports provide transaction-value ranges. Values are estimates, not exact account balances. A disclosure is not a real-time portfolio and may include jointly or spouse-owned assets.",
    legalNotice: "Public-disclosure records are used here for non-commercial civic information and research. Always consult the linked official filing.",
    officials,
  };
}

await mkdir(DATA_DIR, { recursive: true });
const [institutional, government] = await Promise.all([fetchInstitutional(), fetchGovernment()]);
await Promise.all([
  writeFile(path.join(DATA_DIR, "institutional-data.json"), `${JSON.stringify(institutional)}\n`),
  writeFile(path.join(DATA_DIR, "government-data.json"), `${JSON.stringify(government)}\n`),
]);
console.log(`Wrote institutional-data.json (${institutional.managers.length} managers)`);
console.log(`Wrote government-data.json (${government.officials.length} officials)`);
