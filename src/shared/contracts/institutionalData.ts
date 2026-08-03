import { z } from "zod";
import type { InstitutionalIndex, InstitutionalManager } from "@/src/domain/institutional";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const url = z.string().url();

const LifecycleSchema = z.object({
  status: z.enum(["active", "delayed", "archived"]),
  endedAt: date.nullable(),
  reason: z.string(),
  sourceUrl: url,
});

const HoldingSchema = z.object({
  cusip: z.string().min(1),
  issuer: z.string().min(1),
  symbol: z.string().nullable(),
  securityClass: z.string(),
  value: z.number().nonnegative(),
  shares: z.number().nonnegative(),
  weight: z.number().nonnegative(),
  optionType: z.enum(["PUT", "CALL"]).nullable(),
});

const QuarterSchema = z.object({
  reportDate: date,
  filedDate: date,
  accession: z.string().min(1),
  sourceUrl: url,
  sourceUrls: z.array(url),
  totalValue: z.number().positive(),
  holdingsCount: z.number().int().nonnegative(),
  displayedHoldingsCount: z.number().int().nonnegative(),
  amendmentCount: z.number().int().nonnegative(),
  confidentialOmitted: z.boolean(),
  holdings: z.array(HoldingSchema),
});

const SummarySchema = z.object({
  id: z.string().min(1),
  cik: z.string().regex(/^\d{10}$/),
  name: z.string().min(1),
  displayName: z.string().min(1),
  category: z.string().min(1),
  description: z.string(),
  lifecycle: LifecycleSchema,
  latest: QuarterSchema.nullable(),
  earliestLoadedReportDate: date.nullable(),
  quartersLoaded: z.number().int().nonnegative(),
});

export const InstitutionalIndexSchema = z.object({
  generatedAt: z.string().datetime(),
  expectedReportDate: date,
  coverageQuarters: z.number().int().positive(),
  source: z.string().min(1),
  sourceUrl: url,
  methodology: z.string().min(1),
  managers: z.array(SummarySchema),
});

export const InstitutionalManagerSchema = z.object({
  id: z.string().min(1),
  cik: z.string().regex(/^\d{10}$/),
  name: z.string().min(1),
  displayName: z.string().min(1),
  category: z.string().min(1),
  description: z.string(),
  lifecycle: LifecycleSchema,
  secName: z.string().min(1),
  quarters: z.array(QuarterSchema).min(1),
});

export const parseInstitutionalIndex = (input: unknown) => InstitutionalIndexSchema.parse(input) as InstitutionalIndex;
export const parseInstitutionalManager = (input: unknown) => InstitutionalManagerSchema.parse(input) as InstitutionalManager;

