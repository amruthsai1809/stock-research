import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createStagedDirectory, replaceDirectory } from "./lib/atomicOutput.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "public", "data", "institutional");
const MAX_QUARTERS = 20;
const MAX_HOLDINGS_PER_QUARTER = 250;
const SEC_HEADERS = {
  "User-Agent": `Stock Research ${process.env.SEC_CONTACT ?? "research@amruthg.com"}`,
  Accept: "application/json,text/xml,application/xml,text/html",
};

// Every identity is verified against the SEC submissions endpoint on each run.
// `namePattern` is a guardrail: a recycled or mistyped CIK aborts the refresh.
const MANAGERS = [
  { id: "berkshire", name: "Berkshire Hathaway", displayName: "Warren Buffett / investment team", cik: "0001067983", namePattern: /BERKSHIRE HATHAWAY/i, category: "Concentrated", description: "Long-duration, concentrated public-equity portfolio." },
  { id: "pershing", name: "Pershing Square", displayName: "Bill Ackman", cik: "0001336528", namePattern: /Pershing Square/i, category: "Activist", description: "Concentrated activist investment manager." },
  { id: "bridgewater", name: "Bridgewater Associates", displayName: "Investment committee", cik: "0001350694", namePattern: /Bridgewater Associates/i, category: "Systematic", description: "Diversified systematic investment manager." },
  { id: "appaloosa", name: "Appaloosa", displayName: "David Tepper", cik: "0001656456", namePattern: /Appaloosa/i, category: "Opportunistic", description: "Value-oriented, opportunistic investment manager." },
  { id: "tiger-global", name: "Tiger Global Management", displayName: "Chase Coleman / investment team", cik: "0001167483", namePattern: /TIGER GLOBAL/i, category: "Growth", description: "Technology-focused public and private investment manager." },
  { id: "baupost", name: "The Baupost Group", displayName: "Seth Klarman / investment team", cik: "0001061768", namePattern: /BAUPOST/i, category: "Value", description: "Value-focused, long-term investment manager." },
  { id: "duquesne", name: "Duquesne Family Office", displayName: "Stanley Druckenmiller", cik: "0001536411", namePattern: /Duquesne/i, category: "Macro", description: "Macro-informed family-office portfolio." },
  { id: "soros", name: "Soros Fund Management", displayName: "Investment committee", cik: "0001029160", namePattern: /SOROS FUND/i, category: "Multi-strategy", description: "Global, multi-strategy family-office portfolio." },
  { id: "coatue", name: "Coatue Management", displayName: "Philippe Laffont / investment team", cik: "0001135730", namePattern: /COATUE/i, category: "Growth", description: "Technology-focused investment manager." },
  { id: "viking", name: "Viking Global Investors", displayName: "Investment committee", cik: "0001103804", namePattern: /VIKING GLOBAL/i, category: "Long/short", description: "Fundamental long/short equity manager." },
  { id: "lone-pine", name: "Lone Pine Capital", displayName: "Investment committee", cik: "0001061165", namePattern: /LONE PINE/i, category: "Growth", description: "Fundamental growth-oriented investment manager." },
  { id: "third-point", name: "Third Point", displayName: "Daniel Loeb", cik: "0001040273", namePattern: /Third Point/i, category: "Event-driven", description: "Event-driven and value-oriented investment manager." },
  { id: "tci", name: "TCI Fund Management", displayName: "Chris Hohn", cik: "0001647251", namePattern: /TCI Fund/i, category: "Concentrated", description: "Concentrated, long-horizon global equity manager." },
  { id: "himalaya", name: "Himalaya Capital", displayName: "Li Lu", cik: "0001709323", namePattern: /Himalaya Capital/i, category: "Value", description: "Concentrated value-oriented investment manager." },
  { id: "akre", name: "Akre Capital Management", displayName: "Investment team", cik: "0001112520", namePattern: /AKRE CAPITAL/i, category: "Quality", description: "Quality-compounding focused investment manager." },
  { id: "altarock", name: "AltaRock Partners", displayName: "Mark Massey / investment team", cik: "0001631014", namePattern: /ALTAROCK PARTNERS/i, category: "Concentrated", description: "Concentrated, long-term investment partnership." },
  { id: "fundsmith", name: "Fundsmith", displayName: "Terry Smith / investment team", cik: "0001569205", namePattern: /Fundsmith/i, category: "Quality", description: "Global quality-growth investment manager." },
  { id: "point72", name: "Point72 Asset Management", displayName: "Steven Cohen / investment teams", cik: "0001603466", namePattern: /Point72/i, category: "Multi-manager", description: "Multi-manager fundamental and quantitative platform." },
  { id: "renaissance", name: "Renaissance Technologies", displayName: "Investment team", cik: "0001037389", namePattern: /RENAISSANCE TECHNOLOGIES/i, category: "Quantitative", description: "Systematic quantitative investment manager." },
  { id: "citadel", name: "Citadel Advisors", displayName: "Investment teams", cik: "0001423053", namePattern: /CITADEL ADVISORS/i, category: "Multi-manager", description: "Multi-strategy institutional investment manager." },
  { id: "millennium", name: "Millennium Management", displayName: "Investment teams", cik: "0001273087", namePattern: /MILLENNIUM MANAGEMENT/i, category: "Multi-manager", description: "Multi-manager, multi-strategy investment platform." },
  { id: "de-shaw", name: "D. E. Shaw", displayName: "Investment team", cik: "0001009207", namePattern: /D\. E\. Shaw/i, category: "Quantitative", description: "Systematic and discretionary investment manager." },
  { id: "gates-foundation", name: "Gates Foundation Trust", displayName: "Trust investment team", cik: "0001166559", namePattern: /GATES FOUNDATION TRUST/i, category: "Foundation", description: "Public-equity holdings reported by the foundation trust." },
  { id: "first-eagle", name: "First Eagle Investment Management", displayName: "Investment team", cik: "0001325447", namePattern: /First Eagle/i, category: "Value", description: "Global value-oriented investment manager." },
  { id: "valueact", name: "ValueAct Capital", displayName: "Mason Morfit / investment team", cik: "0001418814", namePattern: /ValueAct/i, category: "Activist", description: "Concentrated, constructive activist investment firm." },
  { id: "maverick", name: "Maverick Capital", displayName: "Lee Ainslie / investment team", cik: "0000934639", namePattern: /MAVERICK CAPITAL/i, category: "Long/short", description: "Fundamental long/short equity manager." },
  { id: "scion", name: "Scion Asset Management", displayName: "Michael Burry", cik: "0001649339", namePattern: /Scion Asset Management/i, category: "Archived", description: "Historical public filings; public adviser reporting ended in November 2025.", lifecycle: { status: "archived", endedAt: "2025-11-10", reason: "SEC investment-adviser registration terminated; no current public reporting should be expected.", sourceUrl: "https://adviserinfo.sec.gov/firm/summary/167772" } },
];

const MANUAL_TICKERS = new Map(Object.entries({
  "APPLE INC": "AAPL", "MICROSOFT CORP": "MSFT", "AMAZON COM INC": "AMZN", "ALPHABET INC": "GOOGL",
  "NVIDIA CORP": "NVDA", "META PLATFORMS INC": "META", "TESLA INC": "TSLA", "BROADCOM INC": "AVGO",
  "SPDR S&P 500 ETF TR": "SPY", "INVESCO QQQ TR": "QQQ", "ISHARES CORE S&P 500 ETF": "IVV",
  "ISHARES RUSSELL 2000 ETF": "IWM", "VANGUARD INDEX FDS": "VTI", "TAIWAN SEMICONDUCTOR MFG LTD": "TSM",
  "BERKSHIRE HATHAWAY INC": "BRK.B", "AMERICAN EXPRESS CO": "AXP", "BANK AMERICA CORP": "BAC",
  "COCA COLA CO": "KO", "OCCIDENTAL PETE CORP": "OXY", "CHEVRON CORP NEW": "CVX",
}));

let lastSecRequest = 0;
let secRequestGate = Promise.resolve();
async function enterSecQueue() {
  const turn = secRequestGate.then(async () => {
    const delay = Math.max(0, 130 - (Date.now() - lastSecRequest));
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    lastSecRequest = Date.now();
  });
  secRequestGate = turn.catch(() => {});
  await turn;
}
async function fetchOk(url, init = {}) {
  const isSec = new URL(url).hostname.endsWith("sec.gov");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (isSec) await enterSecQueue();
    const response = await fetch(url, { ...init, headers: { ...SEC_HEADERS, ...(init.headers ?? {}) } });
    if (response.ok) return response;
    if (![403, 429, 500, 502, 503].includes(response.status) || attempt === 4) throw new Error(`${response.status} ${response.statusText}: ${url}`);
    await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
  }
  throw new Error(`Request failed: ${url}`);
}

const clean = (value = "") => decodeEntities(String(value)).replace(/\s+/g, " ").trim();
const decodeEntities = (value) => value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const tag = (xml, name) => clean(xml.match(new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${name}>`, "i"))?.[1] ?? "");

function normalizedIssuer(value) {
  return clean(value).toUpperCase().replace(/&/g, "AND").replace(/\b(CLASS|CL|COMMON|COM|ORDINARY|SHARES?|NEW|DEL|PLC|LTD|LIMITED|CORP(?:ORATION)?|INC(?:ORPORATED)?|HOLDINGS?|HLDGS?|CO|COMPANY)\b/g, " ").replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

async function tickerDirectory() {
  const payload = await (await fetchOk("https://www.sec.gov/files/company_tickers.json")).json();
  const directory = new Map();
  for (const entry of Object.values(payload)) {
    const key = normalizedIssuer(entry.title);
    if (key && !directory.has(key)) directory.set(key, entry.ticker);
  }
  return directory;
}

function guessTicker(name, securityClass, directory) {
  const upper = clean(name).toUpperCase();
  if (/ALPHABET/.test(upper)) return /CL C|CLASS C/i.test(securityClass) ? "GOOG" : "GOOGL";
  if (/BERKSHIRE HATHAWAY/.test(upper)) return /CL A|CLASS A/i.test(securityClass) ? "BRK.A" : "BRK.B";
  if (MANUAL_TICKERS.has(upper)) return MANUAL_TICKERS.get(upper);
  const normalized = normalizedIssuer(upper);
  return directory.get(normalized) ?? null;
}

function expectedQuarter(now = new Date()) {
  const year = now.getUTCFullYear();
  const candidates = [];
  for (let candidateYear = year - 2; candidateYear <= year; candidateYear += 1) {
    candidates.push(
      { reportDate: `${candidateYear}-03-31`, due: Date.UTC(candidateYear, 4, 15) },
      { reportDate: `${candidateYear}-06-30`, due: Date.UTC(candidateYear, 7, 14) },
      { reportDate: `${candidateYear}-09-30`, due: Date.UTC(candidateYear, 10, 14) },
      { reportDate: `${candidateYear}-12-31`, due: Date.UTC(candidateYear + 1, 1, 14) },
    );
  }
  return candidates.filter((candidate) => candidate.due <= now.getTime()).at(-1)?.reportDate ?? `${year - 1}-12-31`;
}

function filingRows(submissions) {
  const recent = submissions.filings?.recent ?? {};
  return (recent.form ?? []).map((form, index) => ({
    form,
    accession: recent.accessionNumber[index],
    filedDate: recent.filingDate[index],
    reportDate: recent.reportDate[index],
    primaryDocument: recent.primaryDocument[index],
  })).filter((filing) => ["13F-HR", "13F-HR/A"].includes(filing.form) && filing.accession && filing.reportDate);
}

async function parseFiling(config, filing, directory) {
  const accessionCompact = filing.accession.replaceAll("-", "");
  const base = `https://www.sec.gov/Archives/edgar/data/${Number(config.cik)}/${accessionCompact}`;
  const index = await (await fetchOk(`${base}/index.json`)).json();
  const files = index.directory?.item ?? [];
  const xmlFile = files.find((file) => /\.xml$/i.test(file.name) && !/primary_doc|primary-document|cover|header/i.test(file.name)) ?? files.find((file) => /\.xml$/i.test(file.name));
  if (!xmlFile) throw new Error("information table XML not found");
  const xml = await (await fetchOk(`${base}/${xmlFile.name}`)).text();
  const cover = filing.form.endsWith("/A") && filing.primaryDocument
    ? await (await fetchOk(`${base}/${filing.primaryDocument}`)).text()
    : "";
  const parsedEntries = [...xml.matchAll(/<(?:\w+:)?infoTable(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?infoTable>/gi)].map((match) => {
    const block = match[1];
    return {
      issuer: tag(block, "nameOfIssuer"),
      securityClass: tag(block, "titleOfClass"),
      cusip: tag(block, "cusip"),
      value: Number(tag(block, "value").replaceAll(",", "")) || 0,
      shares: Number(tag(block, "sshPrnamt").replaceAll(",", "")) || 0,
      amountType: tag(block, "sshPrnamtType"),
      optionType: tag(block, "putCall").toUpperCase() || null,
    };
  });
  const ratios = parsedEntries.filter((entry) => entry.amountType === "SH" && entry.shares > 0 && entry.value > 0).map((entry) => entry.value / entry.shares).sort((a, b) => a - b);
  const valueMultiplier = ratios.length && ratios[Math.floor(ratios.length / 2)] < 1 ? 1000 : 1;
  const aggregated = new Map();
  for (const entry of parsedEntries) {
    const value = entry.value * valueMultiplier;
    if (!entry.issuer || !entry.cusip || value <= 0) continue;
    const key = `${entry.cusip}-${entry.optionType ?? "LONG"}`;
    const prior = aggregated.get(key);
    if (prior) {
      prior.value += value;
      prior.shares += entry.shares;
    } else {
      aggregated.set(key, { ...entry, key, value, symbol: guessTicker(entry.issuer, entry.securityClass, directory), weight: 0 });
    }
  }
  const amendmentType = /isRestatement[^>]*>\s*(?:true|1)/i.test(cover) || /RESTATEMENT/i.test(tag(cover, "amendmentType"))
    ? "restatement"
    : filing.form.endsWith("/A") ? "additions" : "original";
  return {
    filing,
    amendmentType,
    confidentialOmitted: /confidential information has been omitted/i.test(cover) || /isConfidentialOmitted[^>]*>\s*(?:true|1)/i.test(cover),
    sourceUrl: `${base}/${filing.accession}-index.html`,
    holdings: [...aggregated.values()],
  };
}

function combineQuarter(reportDate, filings) {
  const ordered = [...filings].sort((a, b) => a.filing.filedDate.localeCompare(b.filing.filedDate));
  let holdings = new Map();
  let confidentialOmitted = false;
  for (const filing of ordered) {
    if (filing.amendmentType === "original" || filing.amendmentType === "restatement") holdings = new Map();
    for (const holding of filing.holdings) holdings.set(holding.key, holding);
    confidentialOmitted ||= filing.confidentialOmitted;
  }
  const sorted = [...holdings.values()].sort((a, b) => b.value - a.value);
  const totalValue = sorted.reduce((total, holding) => total + holding.value, 0);
  for (const holding of sorted) holding.weight = totalValue ? (holding.value / totalValue) * 100 : 0;
  const latest = ordered.at(-1);
  return {
    reportDate,
    filedDate: latest.filing.filedDate,
    accession: latest.filing.accession,
    sourceUrl: latest.sourceUrl,
    sourceUrls: ordered.map((item) => item.sourceUrl),
    totalValue,
    holdingsCount: sorted.length,
    displayedHoldingsCount: Math.min(sorted.length, MAX_HOLDINGS_PER_QUARTER),
    amendmentCount: ordered.filter((item) => item.amendmentType !== "original").length,
    confidentialOmitted,
    holdings: sorted.slice(0, MAX_HOLDINGS_PER_QUARTER).map((holding) => ({
      issuer: holding.issuer,
      securityClass: holding.securityClass,
      cusip: holding.cusip,
      value: holding.value,
      shares: holding.shares,
      optionType: holding.optionType,
      symbol: holding.symbol,
      weight: holding.weight,
    })),
  };
}

async function fetchManager(config, directory, expected) {
  process.stdout.write(`13F ${config.name}... `);
  const submissions = await (await fetchOk(`https://data.sec.gov/submissions/CIK${config.cik}.json`)).json();
  if (!config.namePattern.test(submissions.name ?? "")) throw new Error(`CIK ${config.cik} resolved to unexpected filer: ${submissions.name}`);
  const rows = filingRows(submissions);
  const reportDates = [...new Set(rows.map((row) => row.reportDate))].sort().reverse().slice(0, MAX_QUARTERS);
  const quarters = (await Promise.all(reportDates.map(async (reportDate) => {
    const filings = [];
    for (const filing of rows.filter((row) => row.reportDate === reportDate).sort((a, b) => a.filedDate.localeCompare(b.filedDate))) {
      try {
        filings.push(await parseFiling(config, filing, directory));
      } catch (error) {
        process.stderr.write(`\n  skipped ${filing.accession}: ${error.message}`);
      }
    }
    return filings.length ? combineQuarter(reportDate, filings) : null;
  }))).filter(Boolean).sort((a, b) => b.reportDate.localeCompare(a.reportDate));
  const latest = quarters[0];
  const lifecycle = config.lifecycle ?? (latest?.reportDate >= expected
    ? { status: "active", endedAt: null, reason: "Latest expected quarterly report is available.", sourceUrl: latest.sourceUrl }
    : { status: "delayed", endedAt: null, reason: `No ${expected} holdings report was found in the SEC submissions feed.`, sourceUrl: `https://www.sec.gov/edgar/browse/?CIK=${Number(config.cik)}` });
  const manager = {
    id: config.id,
    cik: config.cik,
    secName: submissions.name,
    name: config.name,
    displayName: config.displayName,
    category: config.category,
    description: config.description,
    lifecycle,
    quarters,
  };
  process.stdout.write(`${quarters.length} quarters · ${lifecycle.status}\n`);
  return manager;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const expected = expectedQuarter(new Date(generatedAt));
  const directory = await tickerDirectory();
  const managers = [];
  for (let index = 0; index < MANAGERS.length; index += 4) {
    managers.push(...await Promise.all(MANAGERS.slice(index, index + 4).map((config) => fetchManager(config, directory, expected))));
  }
  const activeCount = managers.filter((manager) => manager.lifecycle.status === "active").length;
  if (activeCount < 20) throw new Error(`Institutional refresh failed validation: only ${activeCount} active managers`);
  const index = {
    generatedAt,
    expectedReportDate: expected,
    coverageQuarters: MAX_QUARTERS,
    source: "SEC EDGAR Form 13F filings and information tables",
    sourceUrl: "https://www.sec.gov/data-research/sec-markets-data/form-13f-data-sets",
    methodology: "Official 13F-HR filings are combined with restatements and additions by report period. The directory validates each CIK and automatically flags missing expected reports. Current holdings are capped to the largest 250 disclosed positions per manager for a practical static experience.",
    managers: managers.map((manager) => ({
      id: manager.id,
      cik: manager.cik,
      name: manager.name,
      displayName: manager.displayName,
      category: manager.category,
      description: manager.description,
      lifecycle: manager.lifecycle,
      latest: manager.quarters[0] ? { ...manager.quarters[0], holdings: manager.quarters[0].holdings.slice(0, 75) } : null,
      earliestLoadedReportDate: manager.quarters.at(-1)?.reportDate ?? null,
      quartersLoaded: manager.quarters.length,
    })),
  };
  validateInstitutionalSnapshot(index, managers);
  const stagedOutput = await createStagedDirectory(OUTPUT_DIR);
  try {
    await Promise.all([
      ...managers.map((manager) => writeFile(path.join(stagedOutput, `${manager.id}.json`), `${JSON.stringify(manager)}\n`)),
      writeFile(path.join(stagedOutput, "index.json"), `${JSON.stringify(index)}\n`),
    ]);
    await replaceDirectory(stagedOutput, OUTPUT_DIR);
  } catch (error) {
    await rm(stagedOutput, { recursive: true, force: true });
    throw error;
  }
  process.stdout.write(`Wrote ${managers.length} manager profiles (${activeCount} active; expected ${expected}).\n`);
}

function validateInstitutionalSnapshot(index, managers) {
  if (new Set(managers.map((manager) => manager.id)).size !== managers.length) throw new Error("Institutional snapshot contains duplicate manager IDs");
  if (index.managers.length !== managers.length) throw new Error("Institutional index does not cover every manager");
  if (managers.some((manager) => !manager.lifecycle?.status || !manager.quarters.length)) throw new Error("Institutional manager profile is incomplete");
}

await main();
