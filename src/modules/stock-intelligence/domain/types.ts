export type IntelligenceFactorKey =
  | "quality"
  | "valuation"
  | "growth"
  | "momentum"
  | "risk"
  | "insider"
  | "institutional"
  | "analyst";

export type IntelligenceStrategyId = "balanced" | "compounder" | "value" | "momentum" | "dip-hunter";

export type InsiderActivityCategory =
  | "personal_investment"
  | "sale"
  | "scheduled_sale"
  | "tax_sale"
  | "award"
  | "option_exercise"
  | "tax_withholding"
  | "gift"
  | "conversion"
  | "issuer_disposition"
  | "other";

export type InsiderTransaction = {
  accession: string;
  ownerName: string;
  ownerRole: string;
  transactionDate: string;
  filingDate: string;
  code: string;
  action: "purchase" | "sale" | "other";
  category: InsiderActivityCategory;
  direction: "acquired" | "disposed";
  securityTitle: string;
  shares: number;
  price: number | null;
  value: number | null;
  sharesOwnedAfter: number | null;
  directOrIndirect: "direct" | "indirect" | null;
  natureOfOwnership: string | null;
  rule10b51: boolean;
  filingContext: string | null;
  sourceUrl: string;
};

export type InstitutionalSignal = {
  reportDate: string | null;
  filingDate: string | null;
  expectedManagers: number;
  managersReported: number;
  managersHolding: number;
  managersIncreased: number;
  managersReduced: number;
  managersNew: number;
  managersExited: number;
};

export type InsiderActivitySummary = {
  purchaseCount: number;
  saleCount: number;
  purchaseValue: number;
  saleValue: number;
  discretionarySaleCount: number;
  scheduledSaleCount: number;
  taxRelatedSaleCount: number;
  compensationCount: number;
  administrativeCount: number;
};

export type AnalystTrend = {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
};

export type AnalystAction = {
  date: string;
  firm: string;
  action: string;
  fromGrade: string;
  toGrade: string;
  priceTargetAction: string;
  priorPriceTarget: number | null;
  currentPriceTarget: number | null;
};

export type AnalystSignal = {
  available: boolean;
  reason: string | null;
  asOf: string | null;
  recommendationKey: string | null;
  recommendationMean: number | null;
  numberOfAnalysts: number;
  targetLow: number | null;
  targetMean: number | null;
  targetMedian: number | null;
  targetHigh: number | null;
  targetUpside: number | null;
  trend: AnalystTrend[];
  actions: AnalystAction[];
};

export type ShortInterestSignal = {
  available: boolean;
  asOf: string | null;
  sharesShort: number | null;
  sharesShortPriorMonth: number | null;
  shortPercentOfFloat: number | null;
  sharesPercentOutstanding: number | null;
  daysToCover: number | null;
  institutionalOwnership: number | null;
  insiderOwnership: number | null;
  sourceUrl: string | null;
  history: Array<{
    asOf: string;
    sharesShort: number;
    sharesShortPriorMonth: number | null;
    daysToCover: number | null;
    sharesPercentOutstanding: number | null;
  }>;
};

export type ResearchSignal = {
  symbol: string;
  insider: {
    asOf: string | null;
    summary: InsiderActivitySummary;
    transactions: InsiderTransaction[];
  };
  institutional: InstitutionalSignal;
  analyst: AnalystSignal;
  shortInterest: ShortInterestSignal;
};

export type ResearchSignalDataset = {
  schemaVersion: number;
  generatedAt: string;
  methodology: string;
  sources: {
    insiders: string;
    institutions: string;
    analysts: string;
    shortInterest: string;
  };
  coverage: {
    universe: number;
    insiders: number;
    shortInterest: number;
    institutions: number;
  };
  signals: Record<string, ResearchSignal>;
};

export type FactorEvidence = {
  label: string;
  value: string;
  direction: "positive" | "negative" | "neutral";
  detail: string;
};

export type FactorScore = {
  key: IntelligenceFactorKey;
  label: string;
  score: number | null;
  configuredWeight: number;
  effectiveWeight: number;
  contribution: number;
  status: "available" | "unavailable";
  asOf: string | null;
  evidence: FactorEvidence[];
  unavailableReason?: string;
};

export type StockIntelligenceScore = {
  symbol: string;
  companyName: string;
  strategy: IntelligenceStrategyId;
  score: number;
  grade: "Exceptional" | "Attractive" | "Selective" | "Watch" | "Caution";
  confidence: number;
  quality: number;
  opportunity: number;
  resilience: number;
  fairValue: number | null;
  marginOfSafety: number | null;
  factors: FactorScore[];
  positives: string[];
  cautions: string[];
  dataAsOf: string | null;
};

export type AiProviderId = "openai" | "anthropic" | "gemini";

export type AiResearchMemo = {
  headline: string;
  summary: string;
  bullCase: string[];
  bearCase: string[];
  watchItems: string[];
  verdict: string;
  generatedAt: string;
  provider: AiProviderId | "local";
  model: string;
};
