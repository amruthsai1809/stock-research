import { z } from "zod";
import type {
  GovernmentFiler,
  GovernmentLeaderboardDataset,
  GovernmentMeta,
  GovernmentProfile,
  GovernmentTrade,
} from "@/src/domain/government";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nullableDate = z.preprocess((value) => value == null || value === "" ? null : value, date.nullable());
const finite = z.number().finite();
const nullableFinite = finite.nullable();
const url = z.string().url();

const BaseFilerSchema = z.object({
  id: z.string().min(1),
  full_name: z.string().min(1),
  branch: z.enum(["congress", "executive"]),
  chamber: z.enum(["house", "senate"]).nullable(),
  party: z.enum(["D", "R", "I"]).nullable(),
  state: z.string().nullable(),
  district: z.number().int().nonnegative().nullable().optional(),
  agency: z.string().nullable(),
  level: z.string().nullable(),
  office: z.string().nullable(),
  photo_url: url.nullable(),
  trade_count: z.number().int().nonnegative(),
  purchases: z.number().int().nonnegative(),
  sales: z.number().int().nonnegative(),
  late_filings: z.number().int().nonnegative(),
  est_volume: finite.nonnegative(),
  active: z.boolean().nullable(),
  bioguide_id: z.string().nullable(),
});

const GovernmentFilerSchema = BaseFilerSchema.extend({
  latestTransactionDate: date,
  loadedTradeCount: z.number().int().nonnegative(),
});

const GovernmentTradeSchema = z.object({
  id: z.string().min(1),
  filing_id: z.string().optional(),
  source_id: z.enum(["house_clerk", "senate_efd", "oge_executive"]),
  transaction_date: nullableDate,
  notification_date: z.string().nullable().optional(),
  filing_date: date,
  owner: z.string().nullable(),
  ticker: z.string().nullable(),
  asset_name: z.string().min(1),
  asset_type: z.string().nullable(),
  transaction_type: z.string().min(1),
  amount_range_low: finite.nonnegative().nullable(),
  amount_range_high: finite.nonnegative().nullable(),
  amount_range_label: z.string().min(1),
  days_to_file: z.number().int().nullable(),
  is_late: z.number().int().min(0).max(1),
  comment: z.string().nullable(),
  filer_id: z.string().min(1),
  filer_name: z.string().optional(),
  branch: z.string().optional(),
  chamber: z.string().nullable().optional(),
  party: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  office: z.string().nullable().optional(),
  doc_url: url,
  filing_type: z.string().min(1),
  ret_since: nullableFinite,
  excess_since: nullableFinite,
  ret_30d: nullableFinite,
  ret_1y: nullableFinite,
});

const GovernmentProfileSchema = z.object({
  filer: BaseFilerSchema.extend({
    latestTransactionDate: date.optional(),
    loadedTradeCount: z.number().int().nonnegative().optional(),
  }),
  trades: z.array(GovernmentTradeSchema),
  historyTruncated: z.boolean(),
  totalTradeCount: z.number().int().nonnegative(),
}).transform((profile) => ({
  ...profile,
  filer: {
    ...profile.filer,
    latestTransactionDate: profile.filer.latestTransactionDate ?? latestTradeDate(profile.trades),
    loadedTradeCount: profile.filer.loadedTradeCount ?? profile.trades.length,
  },
}));

const LeaderboardPurchaseSchema = z.object({ ticker: z.string().min(1), transactionDate: date, return1Y: finite });
const GovernmentLeaderboardEntrySchema = z.object({
  filerId: z.string().min(1), fullName: z.string().min(1), branch: z.enum(["congress", "executive"]),
  chamber: z.enum(["house", "senate"]).nullable(), party: z.enum(["D", "R", "I"]).nullable(), state: z.string().nullable(),
  office: z.string().nullable(), agency: z.string().nullable(), photoUrl: url.nullable(), active: z.boolean().nullable(), latestTransactionDate: date,
  totalTransactions: z.number().int().nonnegative(), recentTransactions: z.number().int().nonnegative(), disclosedActivity: finite.nonnegative(),
  estimatedOpenActivity: finite.nonnegative(), inferredPositions: z.number().int().nonnegative(), medianPurchaseReturn1Y: nullableFinite,
  averagePurchaseReturn1Y: nullableFinite, purchaseWinRate1Y: nullableFinite, reliabilityScore1Y: nullableFinite,
  medianReturnSincePurchase: nullableFinite, medianExcessSincePurchase: nullableFinite, performanceSample: z.number().int().nonnegative(),
  eligiblePurchases: z.number().int().nonnegative(), returnCoverage: finite.nonnegative(), confidence: z.enum(["high", "medium", "limited"]),
  historyTruncated: z.boolean(), bestPurchase: LeaderboardPurchaseSchema.nullable(), worstPurchase: LeaderboardPurchaseSchema.nullable(),
});

export const GovernmentMetaSchema = z.object({
  generatedAt: z.string().datetime(), upstreamGeneratedAt: z.string().min(1), upstreamCommit: z.string().optional(), source: z.string().min(1),
  normalizedBy: z.string().min(1), upstreamUrl: url, methodology: z.string().min(1),
  officialSources: z.object({ house: url, senate: url, executive: url }),
  totals: z.object({ trades: z.number().int().nonnegative(), filings: z.number().int().nonnegative(), filers: z.number().int().nonnegative(), currentCongress: z.number().int().nonnegative(), recentLoaded: z.number().int().nonnegative() }),
  dateRange: z.object({ from: date, to: date }),
  disclosureLag: z.object({
    medianDaysToFile: finite.nonnegative(), p90DaysToFile: finite.nonnegative(), maxDaysToFile: finite.nonnegative(),
    tradesWithLag: z.number().int().nonnegative(), lateCount: z.number().int().nonnegative(),
    buckets: z.array(z.object({ key: z.string().min(1), label: z.string().min(1), count: z.number().int().nonnegative(), late: z.boolean() })),
  }),
});

export const GovernmentLeaderboardDatasetSchema = z.object({
  generatedAt: z.string().datetime(), asOf: date, methodology: z.string().min(1), entries: z.array(GovernmentLeaderboardEntrySchema),
});

export const parseGovernmentMeta = (input: unknown) => GovernmentMetaSchema.parse(input) as GovernmentMeta;
export const parseGovernmentIndex = (input: unknown) => z.array(GovernmentFilerSchema).parse(input) as GovernmentFiler[];
export const parseGovernmentRecent = (input: unknown) => z.array(GovernmentTradeSchema).parse(input) as GovernmentTrade[];
export const parseGovernmentProfile = (input: unknown) => GovernmentProfileSchema.parse(input) as GovernmentProfile;
export const parseGovernmentLeaderboard = (input: unknown) => GovernmentLeaderboardDatasetSchema.parse(input) as GovernmentLeaderboardDataset;

function latestTradeDate(trades: { transaction_date: string | null }[]) {
  return trades.reduce((latest, trade) => (trade.transaction_date ?? "") > latest ? trade.transaction_date! : latest, "1970-01-01");
}
