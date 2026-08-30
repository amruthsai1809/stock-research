import type { AnalyzedStock, PricePoint } from "./stock";

export type PortfolioBenchmark = {
  symbol: string;
  name: string;
  category: string;
  prices: PricePoint[];
};

export type BenchmarkDataset = {
  generatedAt: string;
  source: string;
  benchmarks: PortfolioBenchmark[];
};

export type PortfolioTransactionType =
  | "buy"
  | "sell"
  | "dividend"
  | "deposit"
  | "withdrawal"
  | "fee"
  | "split";

export type PortfolioTransaction = {
  id: string;
  date: string;
  type: PortfolioTransactionType;
  symbol: string | null;
  quantity: number;
  price: number;
  amount: number;
  fees: number;
  source: string;
  description?: string;
};

export type PortfolioHolding = {
  symbol: string;
  quantity: number;
  averageCost: number;
  costBasis: number;
  latestPrice: number;
  marketValue: number;
  gain: number;
  gainPercent: number;
  weight: number;
};

export type PortfolioPoint = {
  date: string;
  portfolio: number;
  benchmark: number;
};

export type PortfolioAnalysis = {
  holdings: PortfolioHolding[];
  currentValue: number;
  costBasis: number;
  cash: number;
  gain: number;
  gainPercent: number;
  income: number;
  fees: number;
  deposits: number;
  withdrawals: number;
  series: PortfolioPoint[];
  totalReturn: number;
  benchmarkReturn: number;
  annualizedReturn: number;
  volatility: number;
  maxDrawdown: number;
  coverage: {
    start: string | null;
    end: string | null;
    pricedTransactions: number;
    totalTransactions: number;
    score: number;
  };
};

export type PortfolioParseResult = {
  transactions: PortfolioTransaction[];
  warnings: string[];
  format: "csv" | "ofx" | "qif" | "json" | "pdf-text";
};

const aliases = {
  date: ["date", "trade date", "transaction date", "activity date", "settlement date"],
  type: ["type", "action", "transaction type", "activity type", "code"],
  symbol: ["symbol", "ticker", "security", "instrument", "description"],
  quantity: ["quantity", "shares", "qty", "units"],
  price: ["price", "share price", "unit price", "execution price"],
  amount: ["amount", "total", "net amount", "value", "principal amount"],
  fees: ["fees", "fee", "commission", "commissions"],
} as const;

export function parsePortfolioText(text: string, fileName = "portfolio.csv"): PortfolioParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { transactions: [], warnings: ["The selected file is empty."], format: "csv" };
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return parseJson(trimmed, fileName);
  if (/<OFX>|<INVTRANLIST>|<BUYMF>|<BUYSTOCK>/i.test(trimmed)) return parseOfx(trimmed, fileName);
  if (/^!Type:/m.test(trimmed)) return parseQif(trimmed, fileName);
  return parseDelimited(trimmed, fileName);
}

export function parseDelimited(text: string, source: string): PortfolioParseResult {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes("\t") ? "\t" : firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
  const rows = parseCsvRows(text, delimiter).filter((row) => row.some((cell) => cell.trim()));
  if (rows.length < 2) return { transactions: [], warnings: ["No transaction rows were detected."], format: "csv" };
  const headers = rows[0].map((header) => normalizeHeader(header));
  const index = Object.fromEntries(Object.entries(aliases).map(([field, names]) => [field, headers.findIndex((header) => (names as readonly string[]).includes(header))])) as Record<keyof typeof aliases, number>;
  const warnings: string[] = [];
  if (index.date < 0) warnings.push("A date column could not be identified.");
  if (index.type < 0) warnings.push("An action/type column could not be identified; buys will be assumed where possible.");
  if (index.symbol < 0) warnings.push("A ticker or security column could not be identified.");
  const transactions = rows.slice(1).flatMap((row, rowIndex) => {
    const date = normalizeDate(cell(row, index.date));
    const rawType = cell(row, index.type);
    const symbol = extractSymbol(cell(row, index.symbol));
    const quantity = numberValue(cell(row, index.quantity));
    const price = Math.abs(numberValue(cell(row, index.price)));
    const rawAmount = numberValue(cell(row, index.amount));
    const fees = Math.abs(numberValue(cell(row, index.fees)));
    const type = normalizeTransactionType(rawType, rawAmount, quantity, symbol);
    const amount = rawAmount || inferredAmount(type, quantity, price, fees);
    if (!date || (!symbol && !["deposit", "withdrawal", "fee"].includes(type))) {
      warnings.push(`Row ${rowIndex + 2} was skipped because its date or security could not be understood.`);
      return [];
    }
    return [{ id: `${source}-${rowIndex}-${date}-${symbol ?? "cash"}`, date, type, symbol, quantity: Math.abs(quantity), price, amount: Math.abs(amount), fees, source } satisfies PortfolioTransaction];
  });
  return { transactions, warnings: unique(warnings), format: "csv" };
}

function parseJson(text: string, source: string): PortfolioParseResult {
  try {
    const parsed = JSON.parse(text) as unknown;
    const rows = Array.isArray(parsed) ? parsed : typeof parsed === "object" && parsed && "transactions" in parsed ? (parsed as { transactions: unknown[] }).transactions : [];
    const transactions = rows.flatMap((row, index) => {
      if (!row || typeof row !== "object") return [];
      const record = row as Record<string, unknown>;
      const date = normalizeDate(String(record.date ?? record.tradeDate ?? ""));
      const symbol = extractSymbol(String(record.symbol ?? record.ticker ?? ""));
      const rawAmount = Number(record.amount ?? record.total ?? 0);
      const quantity = Math.abs(Number(record.quantity ?? record.shares ?? 0));
      const price = Math.abs(Number(record.price ?? 0));
      const type = normalizeTransactionType(String(record.type ?? record.action ?? ""), rawAmount, quantity, symbol);
      if (!date) return [];
      return [{ id: `${source}-${index}-${date}`, date, type, symbol, quantity, price, amount: Math.abs(rawAmount || inferredAmount(type, quantity, price, 0)), fees: Math.abs(Number(record.fees ?? 0)), source } satisfies PortfolioTransaction];
    });
    return { transactions, warnings: transactions.length ? [] : ["No compatible transactions were found in the JSON file."], format: "json" };
  } catch {
    return { transactions: [], warnings: ["The JSON file could not be parsed."], format: "json" };
  }
}

function parseOfx(text: string, source: string): PortfolioParseResult {
  const blocks = [...text.matchAll(/<(BUYSTOCK|SELLSTOCK|BUYMF|SELLMF|INCOME|INVBANKTRAN)>([\s\S]*?)(?=<\/(?:BUYSTOCK|SELLSTOCK|BUYMF|SELLMF|INCOME|INVBANKTRAN)>|<(?:BUYSTOCK|SELLSTOCK|BUYMF|SELLMF|INCOME|INVBANKTRAN)>|$)/gi)];
  const transactions = blocks.flatMap((match, index) => {
    const block = match[2];
    const date = normalizeDate(tag(block, "DTTRADE") || tag(block, "DTPOSTED"));
    if (!date) return [];
    const action = match[1].toUpperCase();
    const type: PortfolioTransactionType = action.startsWith("BUY") ? "buy" : action.startsWith("SELL") ? "sell" : action === "INCOME" ? "dividend" : numberValue(tag(block, "TRNAMT")) >= 0 ? "deposit" : "withdrawal";
    const symbol = extractSymbol(tag(block, "TICKER") || tag(block, "UNIQUEID") || "");
    const quantity = Math.abs(numberValue(tag(block, "UNITS")));
    const price = Math.abs(numberValue(tag(block, "UNITPRICE")));
    const amount = Math.abs(numberValue(tag(block, "TOTAL")) || numberValue(tag(block, "TRNAMT")) || inferredAmount(type, quantity, price, 0));
    return [{ id: `${source}-ofx-${index}-${date}`, date, type, symbol, quantity, price, amount, fees: Math.abs(numberValue(tag(block, "COMMISSION")) + numberValue(tag(block, "FEES"))), source } satisfies PortfolioTransaction];
  });
  return { transactions, warnings: transactions.length ? [] : ["The OFX/QFX file contained no supported investment records."], format: "ofx" };
}

function parseQif(text: string, source: string): PortfolioParseResult {
  const records = text.split(/^\^\s*$/m);
  const transactions = records.flatMap((record, index) => {
    const fields = Object.fromEntries(record.split(/\r?\n/).filter(Boolean).map((line) => [line[0], line.slice(1).trim()]));
    const date = normalizeDate(fields.D ?? "");
    if (!date) return [];
    const symbol = extractSymbol(fields.Y ?? fields.N ?? "");
    const quantity = Math.abs(numberValue(fields.Q ?? ""));
    const price = Math.abs(numberValue(fields.I ?? ""));
    const rawAmount = numberValue(fields.T ?? "");
    const type = normalizeTransactionType(fields.N ?? "", rawAmount, quantity, symbol);
    return [{ id: `${source}-qif-${index}-${date}`, date, type, symbol, quantity, price, amount: Math.abs(rawAmount || inferredAmount(type, quantity, price, 0)), fees: Math.abs(numberValue(fields.O ?? "")), source } satisfies PortfolioTransaction];
  });
  return { transactions, warnings: transactions.length ? [] : ["The QIF file contained no supported investment records."], format: "qif" };
}

export function analyzePortfolio(transactions: PortfolioTransaction[], stocks: AnalyzedStock[], benchmarkSymbol: string, benchmarks: PortfolioBenchmark[] = []): PortfolioAnalysis {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const stockMap = new Map(stocks.map((stock) => [stock.symbol, stock]));
  const positions = new Map<string, { quantity: number; costBasis: number }>();
  let cash = 0;
  let income = 0;
  let fees = 0;
  let deposits = 0;
  let withdrawals = 0;
  for (const transaction of sorted) {
    const amount = transaction.amount || transaction.quantity * transaction.price;
    if (transaction.type === "deposit") { cash += amount; deposits += amount; continue; }
    if (transaction.type === "withdrawal") { cash -= amount; withdrawals += amount; continue; }
    if (transaction.type === "dividend") { cash += amount; income += amount; continue; }
    if (transaction.type === "fee") { cash -= amount; fees += amount; continue; }
    if (!transaction.symbol) continue;
    const current = positions.get(transaction.symbol) ?? { quantity: 0, costBasis: 0 };
    if (transaction.type === "buy") {
      current.quantity += transaction.quantity;
      current.costBasis += amount + transaction.fees;
      cash -= amount + transaction.fees;
      fees += transaction.fees;
    } else if (transaction.type === "sell") {
      const soldRatio = current.quantity ? Math.min(1, transaction.quantity / current.quantity) : 0;
      current.costBasis *= 1 - soldRatio;
      current.quantity -= transaction.quantity;
      cash += amount - transaction.fees;
      fees += transaction.fees;
    } else if (transaction.type === "split" && transaction.quantity) current.quantity *= transaction.quantity;
    positions.set(transaction.symbol, current);
  }
  const interim = [...positions.entries()].filter(([, position]) => position.quantity > 0).map(([symbol, position]) => {
    const latestPrice = stockMap.get(symbol)?.latestPrice ?? latestTransactionPrice(sorted, symbol);
    const marketValue = position.quantity * latestPrice;
    return { symbol, quantity: position.quantity, averageCost: position.quantity ? position.costBasis / position.quantity : 0, costBasis: position.costBasis, latestPrice, marketValue, gain: marketValue - position.costBasis };
  });
  const currentValue = interim.reduce((total, holding) => total + holding.marketValue, 0) + cash;
  const costBasis = interim.reduce((total, holding) => total + holding.costBasis, 0);
  const holdings = interim.map((holding) => ({ ...holding, gainPercent: holding.costBasis ? (holding.gain / holding.costBasis) * 100 : 0, weight: currentValue ? (holding.marketValue / currentValue) * 100 : 0 })).sort((a, b) => b.marketValue - a.marketValue);
  const priceUniverse = new Map<string, PriceInstrument>([...stocks, ...benchmarks].map((instrument) => [instrument.symbol, instrument]));
  const benchmark = priceUniverse.get(benchmarkSymbol) ?? stocks[0];
  const series = buildSeries(sorted, priceUniverse, benchmark);
  const portfolioReturns = dailyReturns(series.map((point) => point.portfolio));
  const start = series[0]?.portfolio ?? 0;
  const end = series.at(-1)?.portfolio ?? currentValue;
  const benchmarkStart = series[0]?.benchmark ?? 0;
  const benchmarkEnd = series.at(-1)?.benchmark ?? 0;
  const totalReturn = start > 0 ? ((end - start) / start) * 100 : costBasis ? ((currentValue - costBasis) / costBasis) * 100 : 0;
  const benchmarkReturn = benchmarkStart > 0 ? ((benchmarkEnd - benchmarkStart) / benchmarkStart) * 100 : 0;
  const years = sorted.length > 1 ? Math.max(1 / 365, (new Date(sorted.at(-1)!.date).getTime() - new Date(sorted[0].date).getTime()) / 31_557_600_000) : 1;
  const annualizedReturn = totalReturn > -100 ? ((1 + totalReturn / 100) ** (1 / years) - 1) * 100 : -100;
  const pricedTransactions = sorted.filter((transaction) => !transaction.symbol || stockMap.has(transaction.symbol) || transaction.price > 0).length;
  return {
    holdings,
    currentValue,
    costBasis,
    cash,
    gain: currentValue - Math.max(0, deposits - withdrawals),
    gainPercent: deposits > withdrawals ? ((currentValue - (deposits - withdrawals)) / (deposits - withdrawals)) * 100 : totalReturn,
    income,
    fees,
    deposits,
    withdrawals,
    series,
    totalReturn,
    benchmarkReturn,
    annualizedReturn,
    volatility: standardDeviation(portfolioReturns) * Math.sqrt(252) * 100,
    maxDrawdown: calculateMaxDrawdown(series.map((point) => point.portfolio)),
    coverage: { start: sorted[0]?.date ?? null, end: sorted.at(-1)?.date ?? null, pricedTransactions, totalTransactions: sorted.length, score: sorted.length ? Math.round((pricedTransactions / sorted.length) * 100) : 0 },
  };
}

type PriceInstrument = { symbol: string; prices: PricePoint[] };

function buildSeries(transactions: PortfolioTransaction[], stocks: Map<string, PriceInstrument>, benchmark: PriceInstrument) {
  if (!transactions.length || !benchmark) return [];
  const start = transactions[0].date;
  const dates = benchmark.prices.filter((point) => point.date >= start).map((point) => point.date);
  const priceMaps = new Map([...stocks].map(([symbol, stock]) => [symbol, new Map(stock.prices.map((point) => [point.date, point.adjustedClose]))]));
  const lastPrices = new Map<string, number>();
  const positions = new Map<string, number>();
  let cash = 0;
  let benchmarkCash = 0;
  let benchmarkUnits = 0;
  let cursor = 0;
  const output: PortfolioPoint[] = [];
  const benchmarkPrices = new Map(benchmark.prices.map((point) => [point.date, point.adjustedClose]));
  for (const date of dates) {
    const benchmarkPrice = benchmarkPrices.get(date) ?? 0;
    while (cursor < transactions.length && transactions[cursor].date <= date) {
      const transaction = transactions[cursor++];
      const amount = transaction.amount || transaction.quantity * transaction.price;
      if (transaction.type === "deposit") { cash += amount; benchmarkCash += amount; }
      else if (transaction.type === "withdrawal") {
        cash -= amount;
        const saleUnits = benchmarkPrice ? Math.min(benchmarkUnits, amount / benchmarkPrice) : 0;
        benchmarkUnits -= saleUnits;
        benchmarkCash += saleUnits * benchmarkPrice - amount;
      } else if (transaction.type === "dividend") cash += amount;
      else if (transaction.type === "fee") cash -= amount;
      else if (transaction.symbol && transaction.type === "buy") {
        positions.set(transaction.symbol, (positions.get(transaction.symbol) ?? 0) + transaction.quantity);
        cash -= amount + transaction.fees;
      } else if (transaction.symbol && transaction.type === "sell") {
        positions.set(transaction.symbol, (positions.get(transaction.symbol) ?? 0) - transaction.quantity);
        cash += amount - transaction.fees;
      }
    }
    for (const [symbol, map] of priceMaps) {
      const price = map.get(date);
      if (price != null) lastPrices.set(symbol, price);
    }
    if (benchmarkPrice && benchmarkCash > 0) {
      benchmarkUnits += benchmarkCash / benchmarkPrice;
      benchmarkCash = 0;
    }
    const portfolioValue = cash + [...positions].reduce((total, [symbol, quantity]) => total + quantity * (lastPrices.get(symbol) ?? 0), 0);
    const benchmarkValue = benchmarkCash + benchmarkUnits * benchmarkPrice;
    if (portfolioValue > 0 || benchmarkValue > 0) output.push({ date, portfolio: portfolioValue, benchmark: benchmarkValue });
  }
  return output;
}

export const demoPortfolioTransactions: PortfolioTransaction[] = [
  { id: "demo-1", date: "2022-01-03", type: "deposit", symbol: null, quantity: 0, price: 0, amount: 25_000, fees: 0, source: "Guided demo" },
  { id: "demo-2", date: "2022-01-04", type: "buy", symbol: "AAPL", quantity: 55, price: 179.7, amount: 9_883.5, fees: 0, source: "Guided demo" },
  { id: "demo-3", date: "2022-06-17", type: "buy", symbol: "MSFT", quantity: 35, price: 247.65, amount: 8_667.75, fees: 0, source: "Guided demo" },
  { id: "demo-4", date: "2023-01-06", type: "deposit", symbol: null, quantity: 0, price: 0, amount: 15_000, fees: 0, source: "Guided demo" },
  { id: "demo-5", date: "2023-01-09", type: "buy", symbol: "NVDA", quantity: 55, price: 15.63, amount: 859.65, fees: 0, source: "Guided demo" },
  { id: "demo-6", date: "2023-10-27", type: "buy", symbol: "GOOGL", quantity: 50, price: 122.17, amount: 6_108.5, fees: 0, source: "Guided demo" },
  { id: "demo-7", date: "2024-06-21", type: "sell", symbol: "AAPL", quantity: 15, price: 207.49, amount: 3_112.35, fees: 0, source: "Guided demo" },
  { id: "demo-8", date: "2024-07-01", type: "buy", symbol: "AMZN", quantity: 18, price: 197.2, amount: 3_549.6, fees: 0, source: "Guided demo" },
  { id: "demo-9", date: "2025-03-14", type: "dividend", symbol: "MSFT", quantity: 0, price: 0, amount: 26.25, fees: 0, source: "Guided demo" },
];

export function parseBrokerPdfText(text: string, source: string): PortfolioParseResult {
  const normalized = text.replace(/\u0000/g, "").replace(/[ \t]+/g, " ");
  const transactions: PortfolioTransaction[] = [];
  const warnings: string[] = [];
  const rows = normalized.split(/\r?\n/).flatMap((line) => line.split(/(?=\d{1,2}\/\d{1,2}\/\d{2,4}\b)/));
  const pattern = /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+.*?\b(BUY|BOUGHT|PURCHASE|SELL|SOLD|DIVIDEND|REINVESTMENT|DEPOSIT|WITHDRAWAL|TRANSFER)\b.*?(?:\(([A-Z.]{1,6})\)|\b([A-Z.]{1,6})\b)?(?:.*?([\d,.]+)\s+(?:shares?|shs?|units?))?(?:.*?@?\s*\$([\d,.]+))?(?:.*?\$([\d,.]+))?/i;
  rows.forEach((row, index) => {
    const match = row.match(pattern);
    if (!match) return;
    const date = normalizeDate(match[1]);
    const rawType = match[2];
    const symbol = extractSymbol(match[3] ?? match[4] ?? "");
    const quantity = Math.abs(numberValue(match[5] ?? "0"));
    const price = Math.abs(numberValue(match[6] ?? "0"));
    const amount = Math.abs(numberValue(match[7] ?? "0") || quantity * price);
    const type = normalizeTransactionType(rawType, amount, quantity, symbol);
    if (!date || (!symbol && !["deposit", "withdrawal"].includes(type))) return;
    transactions.push({ id: `${source}-pdf-${index}-${date}`, date, type, symbol, quantity, price, amount, fees: 0, source, description: row.trim().slice(0, 180) });
  });
  if (!transactions.length) warnings.push("No compatible transaction rows were found in this PDF. A CSV, QFX/OFX, QIF, or Stock Research JSON export will be more reliable.");
  else warnings.push("PDF extraction is best effort. Review the parsed ledger before relying on the analysis.");
  return { transactions, warnings, format: "pdf-text" };
}

function parseCsvRows(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cellValue = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') { cellValue += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === delimiter && !quoted) { row.push(cellValue); cellValue = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cellValue); rows.push(row); row = []; cellValue = "";
    } else cellValue += character;
  }
  row.push(cellValue); rows.push(row);
  return rows;
}

function normalizeHeader(value: string) { return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " "); }
function cell(row: string[], index: number) { return index >= 0 ? row[index]?.trim() ?? "" : ""; }
function numberValue(value: string) { const parsed = Number(value.replace(/[,$%()]/g, (match) => match === "(" ? "-" : "").replace(/\s/g, "")); return Number.isFinite(parsed) ? parsed : 0; }
function extractSymbol(value: string) { const parenthetical = value.match(/\(([A-Z.]{1,6})\)/)?.[1]; const direct = value.trim().toUpperCase().match(/^[A-Z.]{1,6}$/)?.[0]; return parenthetical ?? direct ?? null; }
function normalizeDate(value: string) {
  const cleaned = value.trim().replace(/\[.*$/, "").slice(0, 10);
  if (/^\d{8}$/.test(cleaned)) return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}
function normalizeTransactionType(value: string, amount: number, quantity: number, symbol: string | null): PortfolioTransactionType {
  const normalized = value.toLowerCase();
  if (/buy|bought|purchase|reinvest/.test(normalized)) return "buy";
  if (/sell|sold|sale/.test(normalized)) return "sell";
  if (/div|income|interest/.test(normalized)) return "dividend";
  if (/deposit|contribution|transfer in/.test(normalized)) return "deposit";
  if (/withdraw|distribution|transfer out/.test(normalized)) return "withdrawal";
  if (/fee|commission/.test(normalized)) return "fee";
  if (/split/.test(normalized)) return "split";
  if (symbol && quantity) return amount < 0 ? "buy" : "buy";
  return amount >= 0 ? "deposit" : "withdrawal";
}
function inferredAmount(type: PortfolioTransactionType, quantity: number, price: number, fees: number) { const value = Math.abs(quantity * price); return type === "buy" ? value + fees : value; }
function tag(block: string, name: string) { return block.match(new RegExp(`<${name}>([^<\\r\\n]+)`, "i"))?.[1]?.trim() ?? ""; }
function latestTransactionPrice(transactions: PortfolioTransaction[], symbol: string) { return [...transactions].reverse().find((transaction) => transaction.symbol === symbol && transaction.price)?.price ?? 0; }
function dailyReturns(values: number[]) { return values.slice(1).flatMap((value, index) => values[index] > 0 ? [value / values[index] - 1] : []); }
function standardDeviation(values: number[]) { if (!values.length) return 0; const mean = values.reduce((total, value) => total + value, 0) / values.length; return Math.sqrt(values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length); }
function calculateMaxDrawdown(values: number[]) { let peak = 0; let worst = 0; for (const value of values) { peak = Math.max(peak, value); if (peak) worst = Math.min(worst, ((value - peak) / peak) * 100); } return worst; }
function unique(values: string[]) { return [...new Set(values)]; }
