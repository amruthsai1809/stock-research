import { z } from "zod";
import type { MarketDataset } from "@/src/domain/stock";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const finite = z.number().finite();
const nullableFinite = finite.nullable();

const PricePointSchema = z.object({
  date,
  open: finite.nonnegative(),
  high: finite.nonnegative(),
  low: finite.nonnegative(),
  close: finite.nonnegative(),
  adjustedClose: finite.positive(),
  volume: finite.nonnegative(),
});

const AnnualFinancialsSchema = z.object({
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
  shares: nullableFinite,
  stockCompensation: nullableFinite,
  buybacks: nullableFinite,
  dividends: nullableFinite,
  sourceConcepts: z.record(z.string(), z.string()),
});

const StockSchema = z.object({
  symbol: z.string().regex(/^[A-Z.]{1,10}$/),
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
  sources: z.object({ prices: z.string().min(1), fundamentals: z.string().min(1) }),
  stocks: z.array(StockSchema).min(1),
});

export function parseMarketDataset(input: unknown): MarketDataset {
  return MarketDatasetSchema.parse(input) as MarketDataset;
}
