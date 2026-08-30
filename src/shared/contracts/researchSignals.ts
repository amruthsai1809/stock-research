import { z } from "zod";
import type { ResearchSignalDataset } from "@/src/modules/stock-intelligence/domain/types";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const finite = z.number().finite();
const InsiderCategorySchema = z.enum([
  "personal_investment",
  "sale",
  "scheduled_sale",
  "tax_sale",
  "award",
  "option_exercise",
  "tax_withholding",
  "gift",
  "conversion",
  "issuer_disposition",
  "other",
]);

function categoryFor(value: { code: string; action?: string; rule10b51: boolean; filingContext?: string | null }) {
  if (value.code === "P" || value.action === "purchase") return "personal_investment" as const;
  if (value.code === "S" || value.action === "sale") {
    if (/(?:tax(?:es| liability| withholding)?|withholding obligation|sell[- ]to[- ]cover)/i.test(value.filingContext ?? "")) return "tax_sale" as const;
    return value.rule10b51 ? "scheduled_sale" as const : "sale" as const;
  }
  if (value.code === "A") return "award" as const;
  if (["M", "O", "X"].includes(value.code)) return "option_exercise" as const;
  if (value.code === "F") return "tax_withholding" as const;
  if (value.code === "G") return "gift" as const;
  if (value.code === "C") return "conversion" as const;
  if (value.code === "D") return "issuer_disposition" as const;
  return "other" as const;
}

const InsiderTransactionSchema = z.object({
  accession: z.string().min(1),
  ownerName: z.string().min(1),
  ownerRole: z.string(),
  transactionDate: date,
  filingDate: date,
  code: z.string().regex(/^[A-Z]$/),
  action: z.enum(["purchase", "sale", "other"]).optional(),
  category: InsiderCategorySchema.optional(),
  direction: z.enum(["acquired", "disposed"]).optional(),
  securityTitle: z.string().min(1).optional(),
  shares: z.number().nonnegative(),
  price: z.number().nonnegative().nullable(),
  value: z.number().nonnegative().nullable(),
  sharesOwnedAfter: z.number().nonnegative().nullable(),
  directOrIndirect: z.enum(["direct", "indirect"]).nullable().optional(),
  natureOfOwnership: z.string().nullable().optional(),
  rule10b51: z.boolean(),
  filingContext: z.string().nullable().optional(),
  sourceUrl: z.string().url(),
}).transform((value) => {
  const category = value.category ?? categoryFor(value);
  return {
    ...value,
    action: category === "personal_investment" ? "purchase" as const : ["sale", "scheduled_sale", "tax_sale"].includes(category) ? "sale" as const : "other" as const,
    category,
    direction: value.direction ?? (category === "personal_investment" ? "acquired" as const : value.action === "sale" ? "disposed" as const : "acquired" as const),
    securityTitle: value.securityTitle ?? "Reported security",
    directOrIndirect: value.directOrIndirect ?? null,
    natureOfOwnership: value.natureOfOwnership ?? null,
    filingContext: value.filingContext ?? null,
  };
});

const InsiderSummarySchema = z.object({
  purchaseCount: z.number().int().nonnegative(),
  saleCount: z.number().int().nonnegative(),
  purchaseValue: z.number().nonnegative(),
  saleValue: z.number().nonnegative(),
  discretionarySaleCount: z.number().int().nonnegative(),
  scheduledSaleCount: z.number().int().nonnegative().default(0),
  taxRelatedSaleCount: z.number().int().nonnegative().default(0),
  compensationCount: z.number().int().nonnegative().default(0),
  administrativeCount: z.number().int().nonnegative().default(0),
});

const InsiderSchema = z.object({
  asOf: date.nullable(),
  summary: InsiderSummarySchema.optional(),
  transactions: z.array(InsiderTransactionSchema),
}).transform((value) => {
  const purchases = value.transactions.filter((item) => item.category === "personal_investment");
  const sales = value.transactions.filter((item) => ["sale", "scheduled_sale", "tax_sale"].includes(item.category));
  const scheduledSales = sales.filter((item) => item.category === "scheduled_sale");
  const taxSales = sales.filter((item) => item.category === "tax_sale");
  const compensation = value.transactions.filter((item) => ["award", "option_exercise"].includes(item.category));
  const administrative = value.transactions.filter((item) => !purchases.includes(item) && !sales.includes(item) && !compensation.includes(item));
  return {
    ...value,
    summary: {
      purchaseCount: purchases.length,
      saleCount: sales.length,
      purchaseValue: purchases.reduce((sum, item) => sum + (item.value ?? 0), 0),
      saleValue: sales.reduce((sum, item) => sum + (item.value ?? 0), 0),
      discretionarySaleCount: sales.length - scheduledSales.length - taxSales.length,
      scheduledSaleCount: scheduledSales.length,
      taxRelatedSaleCount: taxSales.length,
      compensationCount: compensation.length,
      administrativeCount: administrative.length,
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
