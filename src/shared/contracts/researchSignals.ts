import { z } from "zod";
import type { ResearchSignalDataset } from "@/src/modules/stock-intelligence/domain/types";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const finite = z.number().finite();
const InsiderTransactionSchema = z.object({
  accession: z.string().min(1),
  ownerName: z.string().min(1),
  ownerRole: z.string(),
  transactionDate: date,
  filingDate: date,
  code: z.enum(["P", "S"]),
  action: z.enum(["purchase", "sale"]),
  shares: z.number().nonnegative(),
  price: z.number().nonnegative().nullable(),
  value: z.number().nonnegative().nullable(),
  sharesOwnedAfter: z.number().nonnegative().nullable(),
  rule10b51: z.boolean(),
  sourceUrl: z.string().url(),
});

const InsiderSummarySchema = z.object({
  purchaseCount: z.number().int().nonnegative(),
  saleCount: z.number().int().nonnegative(),
  purchaseValue: z.number().nonnegative(),
  saleValue: z.number().nonnegative(),
  discretionarySaleCount: z.number().int().nonnegative(),
});

const InsiderSchema = z.object({
  asOf: date.nullable(),
  summary: InsiderSummarySchema.optional(),
  transactions: z.array(InsiderTransactionSchema),
}).transform((value) => {
  if (value.summary) return value as typeof value & { summary: z.infer<typeof InsiderSummarySchema> };
  const purchases = value.transactions.filter((item) => item.action === "purchase");
  const sales = value.transactions.filter((item) => item.action === "sale");
  return {
    ...value,
    summary: {
      purchaseCount: purchases.length,
      saleCount: sales.length,
      purchaseValue: purchases.reduce((sum, item) => sum + (item.value ?? 0), 0),
      saleValue: sales.reduce((sum, item) => sum + (item.value ?? 0), 0),
      discretionarySaleCount: sales.filter((item) => !item.rule10b51).length,
    },
  };
});

const SignalSchema = z.object({
  symbol: z.string().min(1),
  insider: InsiderSchema,
  institutional: z.object({
    reportDate: date.nullable(),
    filingDate: date.nullable(),
    expectedManagers: z.number().int().nonnegative().default(0),
    managersReported: z.number().int().nonnegative().default(0),
    managersHolding: z.number().int().nonnegative(),
    managersIncreased: z.number().int().nonnegative(),
    managersReduced: z.number().int().nonnegative(),
    managersNew: z.number().int().nonnegative(),
    managersExited: z.number().int().nonnegative(),
  }),
  analyst: z.object({
    available: z.boolean(),
    reason: z.string().nullable(),
    asOf: date.nullable(),
    recommendationKey: z.string().nullable(),
    recommendationMean: finite.nullable(),
    numberOfAnalysts: z.number().int().nonnegative(),
    targetLow: finite.nullable(),
    targetMean: finite.nullable(),
    targetMedian: finite.nullable(),
    targetHigh: finite.nullable(),
    targetUpside: finite.nullable(),
    trend: z.array(z.object({
      period: z.string(),
      strongBuy: z.number().int().nonnegative(),
      buy: z.number().int().nonnegative(),
      hold: z.number().int().nonnegative(),
      sell: z.number().int().nonnegative(),
      strongSell: z.number().int().nonnegative(),
    })),
    actions: z.array(z.object({
      date,
      firm: z.string(),
      action: z.string(),
      fromGrade: z.string(),
      toGrade: z.string(),
      priceTargetAction: z.string(),
      priorPriceTarget: finite.nullable(),
      currentPriceTarget: finite.nullable(),
    })),
  }),
  shortInterest: z.object({
    available: z.boolean(),
    asOf: date.nullable(),
    sharesShort: finite.nullable(),
    sharesShortPriorMonth: finite.nullable(),
    shortPercentOfFloat: finite.nullable(),
    sharesPercentOutstanding: finite.nullable(),
    daysToCover: finite.nullable(),
    institutionalOwnership: finite.nullable(),
    insiderOwnership: finite.nullable(),
    sourceUrl: z.string().url().nullable().default(null),
    history: z.array(z.object({
      asOf: date,
      sharesShort: z.number().nonnegative(),
      sharesShortPriorMonth: z.number().nonnegative().nullable(),
      daysToCover: finite.nullable(),
      sharesPercentOutstanding: finite.nullable(),
    })).default([]),
  }),
});

export const ResearchSignalDatasetSchema = z.object({
  schemaVersion: z.number().int().positive().default(1),
  generatedAt: z.string().datetime(),
  methodology: z.string().min(1),
  sources: z.object({
    insiders: z.string().url(),
    institutions: z.string().url(),
    analysts: z.string().url(),
    shortInterest: z.string().url().default("https://www.finra.org/finra-data/browse-catalog/equity-short-interest"),
  }),
  coverage: z.object({
    universe: z.number().int().nonnegative(),
    insiders: z.number().int().nonnegative(),
    shortInterest: z.number().int().nonnegative(),
    institutions: z.number().int().nonnegative(),
  }).default({ universe: 0, insiders: 0, shortInterest: 0, institutions: 0 }),
  signals: z.record(z.string(), SignalSchema),
});

export const parseResearchSignals = (input: unknown) => ResearchSignalDatasetSchema.parse(input) as ResearchSignalDataset;
export const parseResearchSignal = (input: unknown) => SignalSchema.parse(input) as ResearchSignalDataset["signals"][string];
