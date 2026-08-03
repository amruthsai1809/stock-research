import { z } from "zod";
import type { ResearchSignalDataset } from "@/src/modules/stock-intelligence/domain/types";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
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
  analyst: z.object({ available: z.literal(false), reason: z.string().min(1) }),
});

export const ResearchSignalDatasetSchema = z.object({
  generatedAt: z.string().datetime(),
  methodology: z.string().min(1),
  sources: z.object({ insiders: z.string().url(), institutions: z.string().url() }),
  signals: z.record(z.string(), SignalSchema),
});

export const parseResearchSignals = (input: unknown) => ResearchSignalDatasetSchema.parse(input) as ResearchSignalDataset;
