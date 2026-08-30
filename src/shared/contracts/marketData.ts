import { z } from "zod";
import type { MarketDataset, MarketIndex, Stock } from "@/src/domain/stock";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const finite = z.number().finite();
const nullableFinite = finite.nullable();

export const PricePointSchema = z.object({
  date,
  open: finite.nonnegative(),
  high: finite.nonnegative(),
  low: finite.nonnegative(),
  close: finite.nonnegative(),
  adjustedClose: finite.positive(),
  volume: finite.nonnegative(),
});

export const AnnualFinancialsSchema = z.object({
  year: z.number().int(),
  end: date,
  filed: date.nullable(),
  accession: z.string().nullable(),
  revenue: nullableFinite,
  grossProfit: nullableFinite,
  operatingIncome: nullableFinite,
  netIncome: nullableFinite,
  operatingCashFlow: nullableFinite,
  capex: nullableFinite,
  freeCashFlow: nullableFinite,
  assets: nullableFinite,
  liabilities: nullableFinite,
  equity: nullableFinite,
  cash: nullableFinite,
  longTermDebt: nullableFinite,
  shares: nullableFinite,
  dilutedEps: nullableFinite,
  depreciationAndAmortization: nullableFinite,
  ebitda: nullableFinite,
  researchAndDevelopment: nullableFinite,
  stockCompensation: nullableFinite,
  buybacks: nullableFinite,
  dividends: nullableFinite,
  fiscalYearEndPrice: nullableFinite,
  priceToEarnings: nullableFinite,
  sourceConcepts: z.record(z.string(), z.string()),
});

export const StockSchema = z.object({
  symbol: z.string().regex(/^[A-Z.-]{1,12}$/),
  cik: z.string().regex(/^\d{10}$/),
  name: z.string().min(1),
  sector: z.string().min(1),
  industry: z.string().min(1),
  description: z.string(),
  exchange: z.string(),
  currency: z.string().length(3),
  prices: z.array(PricePointSchema).min(2),
  annuals: z.array(AnnualFinancialsSchema),
});

export const MarketDatasetSchema = z.object({
  generatedAt: z.string().datetime(),
  priceAsOf: date.nullable(),
  sources: z.object({ prices: z.string().min(1), fundamentals: z.string().min(1), universe: z.string().min(1).optional() }),
  stocks: z.array(StockSchema).min(1),
});

const AnalyzedFieldsSchema = z.object({
  latestPrice: finite.nonnegative(),
  previousPrice: finite.nonnegative(),
  dailyReturn: finite,
  oneMonthReturn: finite,
  threeMonthReturn: finite,
  oneYearReturn: finite,
  high52Week: finite.nonnegative(),
  drawdown52Week: finite,
  sma50: finite.nonnegative(),
  sma200: finite.nonnegative(),
  distanceFrom200Day: finite,
  volatility: finite.nonnegative(),
  qualityScore: z.number().int().min(0).max(100),
  dipScore: z.number().int().min(0).max(100),
  valuationScore: z.number().int().min(0).max(100),
  classification: z.enum(["Quality pullback", "Deep correction", "Trend fracture", "Early recovery", "Routine reset", "Potential value trap"]),
  latestAnnual: AnnualFinancialsSchema.nullable(),
  previousAnnual: AnnualFinancialsSchema.nullable(),
  revenueGrowth: nullableFinite,
  operatingMargin: nullableFinite,
  freeCashFlowMargin: nullableFinite,
  cashConversion: nullableFinite,
  liabilityRatio: nullableFinite,
  shareChange: nullableFinite,
  why: z.array(z.string().min(1)).min(1),
});

const StockSummarySchema = StockSchema.omit({ prices: true, annuals: true }).extend({
  ...AnalyzedFieldsSchema.shape,
  dataPath: z.string().regex(/^\.\/data\/market\/stocks\/[a-z0-9_-]+\.json$/),
  recentDataPath: z.string().regex(/^\.\/data\/market\/recent\/[a-z0-9_-]+\.json$/),
  priceAsOf: date,
  historyStart: date,
  historySessions: z.number().int().positive(),
  marketCap: finite.nonnegative().nullable(),
  securityType: z.enum(["common-stock", "adr"]),
});

export const MarketIndexSchema = z.object({
  schemaVersion: z.literal(2),
  generatedAt: z.string().datetime(),
  priceAsOf: date.nullable(),
  sources: z.object({ prices: z.string().min(1), fundamentals: z.string().min(1), universe: z.string().min(1).optional() }),
  universe: z.object({
    exchanges: z.array(z.string().min(1)).min(1),
    minimumMarketCap: finite.nonnegative(),
    securityTypes: z.array(z.enum(["common-stock", "adr"])).min(1),
    historyYears: z.number().int().positive(),
    eligibleCount: z.number().int().positive(),
    publishedCount: z.number().int().positive(),
    scope: z.enum(["full", "sample"]),
  }),
  stocks: z.array(StockSummarySchema).min(1),
});

export function parseMarketDataset(input: unknown): MarketDataset {
  return MarketDatasetSchema.parse(input) as MarketDataset;
}

export function parseMarketIndex(input: unknown): MarketIndex {
  return MarketIndexSchema.parse(input) as MarketIndex;
}

export function parseStock(input: unknown): Stock {
  return StockSchema.parse(input) as Stock;
}

export function parseStockArchive(input: unknown): Stock {
  return StockSchema.extend({ prices: z.array(PricePointSchema) }).parse(input) as Stock;
}

export function parseRecentPrices(input: unknown): { symbol: string; prices: Stock["prices"] } {
  return z.object({ symbol: z.string().regex(/^[A-Z.-]{1,12}$/), prices: z.array(PricePointSchema) }).parse(input) as { symbol: string; prices: Stock["prices"] };
}
