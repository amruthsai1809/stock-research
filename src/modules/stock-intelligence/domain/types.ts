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

export type InsiderTransaction = {
  accession: string;
  ownerName: string;
  ownerRole: string;
  transactionDate: string;
  filingDate: string;
  code: "P" | "S";
  action: "purchase" | "sale";
  shares: number;
  price: number | null;
  value: number | null;
  sharesOwnedAfter: number | null;
  rule10b51: boolean;
  sourceUrl: string;
};

export type InstitutionalSignal = {
  reportDate: string | null;
  filingDate: string | null;
  managersHolding: number;
  managersIncreased: number;
  managersReduced: number;
  managersNew: number;
  managersExited: number;
};

export type ResearchSignal = {
  symbol: string;
  insider: {
    asOf: string | null;
    transactions: InsiderTransaction[];
  };
  institutional: InstitutionalSignal;
  analyst: {
    available: false;
    reason: string;
  };
};

export type ResearchSignalDataset = {
  generatedAt: string;
  methodology: string;
  sources: {
    insiders: string;
    institutions: string;
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
