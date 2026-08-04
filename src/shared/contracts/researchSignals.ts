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

const SignalSchema = z.object({
  symbol: z.string().min(1),
  insider: z.object({ asOf: date.nullable(), transactions: z.array(InsiderTransactionSchema) }),
  institutional: z.object({
    reportDate: date.nullable(),
    filingDate: date.nullable(),
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
  }),
});

export const ResearchSignalDatasetSchema = z.object({
  generatedAt: z.string().datetime(),
  methodology: z.string().min(1),
  sources: z.object({ insiders: z.string().url(), institutions: z.string().url(), analysts: z.string().url() }),
  signals: z.record(z.string(), SignalSchema),
});

export const parseResearchSignals = (input: unknown) => ResearchSignalDatasetSchema.parse(input) as ResearchSignalDataset;
