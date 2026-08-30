const NASDAQ_SCREENER_URL = "https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&offset=0&download=true";
const SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers_exchange.json";
const SUPPORTED_SEC_EXCHANGES = new Set(["Nasdaq", "NYSE"]);

const browserHeaders = {
  "User-Agent": "Mozilla/5.0",
  Accept: "application/json, text/plain, */*",
  Origin: "https://www.nasdaq.com",
  Referer: "https://www.nasdaq.com/",
};

const adrPattern = /American Depositary|American Depository|Global Depositary|\bADR\b|\bADS\b|New York Registry Shares/i;
const domesticDepositaryPattern = /Depositary Shares|Depository Shares/i;
const ineligibleSecurityPattern = /Warrant|\bRights?\b|Preferred|Preference|\bNotes?\b|\bBonds?\b|Debenture|Subordinated|Senior Secured|Senior Notes|Index-Linked|\bETN\b|\bZONES\b/i;
const ineligibleOperatingPattern = /\bUnits?\b|\bETF\b|Exchange.Traded|\bFund\b|Acquisition Corp|Income Trust|Closed.End/i;
const listedInvestmentVehiclePattern = /Common Shares? of Beneficial Interest|Shares? of Beneficial Interest|BlackRock.*(?:Trust|Income|Resources)|Blackrock.*(?:Trust|Income|Resources)|Calamos Strategic Total Return|FS Credit Opportunities|Gabelli .*Trust|General American Investors|ASA\s+Gold and Precious Metals|STRATS Trust/i;

export const universePolicy = Object.freeze({
  minimumMarketCap: 1_000_000_000,
  exchanges: ["Nasdaq", "NYSE", "NYSE American"],
  securityTypes: ["common-stock", "adr"],
  historyYears: 10,
});

export async function loadEligibleUniverse({ fetchImpl = fetch, minimumMarketCap = universePolicy.minimumMarketCap } = {}) {
  const [nasdaqPayload, secPayload] = await Promise.all([
    fetchJson(fetchImpl, `${NASDAQ_SCREENER_URL}&_=${Date.now()}`, browserHeaders),
    loadSecIdentifiers(fetchImpl),
  ]);

  const secBySymbol = new Map(
    (secPayload.data ?? [])
      .filter((row) => SUPPORTED_SEC_EXCHANGES.has(row[3]))
      .map(([cik, name, ticker, exchange]) => [canonicalSymbol(ticker), { cik: String(cik).padStart(10, "0"), name, exchange }]),
  );

  const eligible = (nasdaqPayload.data?.rows ?? []).flatMap((row) => {
    const symbol = canonicalSymbol(row.symbol);
    const sec = secBySymbol.get(symbol);
    const marketCap = Number(row.marketCap);
    if (!sec || !Number.isFinite(marketCap) || marketCap < minimumMarketCap || !isEligibleSecurity(row.name, row)) return [];
    return [{
      symbol,
      providerSymbol: yahooSymbol(symbol),
      cik: sec.cik,
      name: cleanSecurityName(row.name) || sec.name,
      sector: normalizeLabel(row.sector, "Unclassified"),
      industry: normalizeLabel(row.industry, "Unclassified"),
      marketCap,
      securityType: adrPattern.test(row.name) ? "adr" : "common-stock",
      secExchange: sec.exchange,
      ipoYear: parseYear(row.ipoyear),
    }];
  });

  const bySymbol = new Map(eligible.map((company) => [company.symbol, company]));
  const companies = [...bySymbol.values()].sort((left, right) => left.symbol.localeCompare(right.symbol));
  if (!companies.some((company) => company.symbol === "DUOL")) throw new Error("Universe quality gate failed: DUOL is missing.");
  if (companies.length < 2_000) throw new Error(`Universe quality gate failed: only ${companies.length} eligible companies.`);
  return companies;
}

async function loadSecIdentifiers(fetchImpl) {
  const baselineUrl = process.env.MARKET_BASE_URL?.replace(/\/+$/, "");
  const preferBaseline = process.env.MARKET_REFRESH_MODE === "incremental";
  if (!preferBaseline) {
    try {
      return await fetchJson(fetchImpl, SEC_TICKERS_URL, {
        "User-Agent": process.env.SEC_USER_AGENT ?? `Equity Lab ${process.env.SEC_CONTACT ?? "research@amruthg.com"}`,
        Accept: "application/json",
      });
    } catch (error) {
      if (!baselineUrl) throw error;
      process.stderr.write(`[market] SEC identifier feed unavailable; using the last validated deployment: ${error.message}\n`);
    }
  }
  if (!baselineUrl) throw new Error("MARKET_BASE_URL is required for an incremental refresh.");
  const baseline = await fetchJson(fetchImpl, `${baselineUrl}/data/market/index.json`, { Accept: "application/json" });
  if (!Array.isArray(baseline.stocks) || baseline.stocks.length < 2_000 || !baseline.stocks.some((stock) => stock.symbol === "DUOL")) {
    throw new Error("The deployed market baseline failed its universe quality gate.");
  }
  return {
    data: baseline.stocks.map((stock) => [
      stock.cik,
      stock.name,
      stock.symbol,
      /^Nasdaq/i.test(stock.exchange) ? "Nasdaq" : "NYSE",
    ]),
  };
}

export function isEligibleSecurity(name = "", context = {}) {
  if (ineligibleSecurityPattern.test(name)) return false;
  if (adrPattern.test(name)) return true;
  if (domesticDepositaryPattern.test(name)) return false;
  const financeTrust = context.sector === "Finance" && /Trusts Except Educational Religious and Charitable/i.test(context.industry ?? "");
  if (financeTrust || listedInvestmentVehiclePattern.test(name)) return false;
  return !ineligibleOperatingPattern.test(name);
}

export function symbolSlug(symbol) {
  return canonicalSymbol(symbol).toLowerCase().replaceAll(".", "-");
}

function canonicalSymbol(symbol = "") {
  return String(symbol).trim().toUpperCase().replaceAll("-", ".");
}

function yahooSymbol(symbol) {
  return symbol.replaceAll(".", "-");
}

function parseYear(value) {
  const year = Number.parseInt(value, 10);
  return Number.isInteger(year) && year >= 1800 && year <= 2200 ? year : null;
}

function normalizeLabel(value, fallback) {
  const normalized = String(value ?? "").trim();
  return normalized && normalized.toLowerCase() !== "n/a" ? normalized : fallback;
}

function cleanSecurityName(value) {
  return String(value ?? "")
    .replace(/\s+(Class [A-Z] )?(Common Stock|Common Shares?|Ordinary Shares?)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchJson(fetchImpl, url, headers) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(20_000) });
      if (response.ok) return response.json();
      if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === 3) throw new Error(`${response.status} ${response.statusText}: ${url}`);
    } catch (error) {
      if (attempt === 3) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** attempt));
  }
  throw new Error(`Request failed: ${url}`);
}
