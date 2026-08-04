export type PricePoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjustedClose: number;
  volume: number;
};

export type SourceMetric =
  | "revenue"
  | "grossProfit"
  | "operatingIncome"
  | "netIncome"
  | "operatingCashFlow"
  | "capex"
  | "assets"
  | "liabilities"
  | "equity"
  | "cash"
  | "longTermDebt"
  | "shares"
  | "dilutedEps"
  | "depreciationAndAmortization"
  | "researchAndDevelopment"
  | "stockCompensation"
  | "buybacks"
  | "dividends";

export type AnnualFinancials = {
  year: number;
  end: string;
  filed: string | null;
  accession: string | null;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  operatingCashFlow: number | null;
  capex: number | null;
  freeCashFlow: number | null;
  assets: number | null;
  liabilities: number | null;
  equity: number | null;
  cash: number | null;
  longTermDebt: number | null;
  shares: number | null;
  dilutedEps: number | null;
  depreciationAndAmortization: number | null;
  ebitda: number | null;
  researchAndDevelopment: number | null;
  stockCompensation: number | null;
  buybacks: number | null;
  dividends: number | null;
  fiscalYearEndPrice: number | null;
  priceToEarnings: number | null;
  sourceConcepts: Partial<Record<SourceMetric, string>>;
};

export type Stock = {
  symbol: string;
  cik: string;
  name: string;
  sector: string;
  industry: string;
  description: string;
  exchange: string;
  currency: string;
  prices: PricePoint[];
  annuals: AnnualFinancials[];
};

export type MarketDataset = {
  generatedAt: string;
  priceAsOf: string | null;
  sources: {
    prices: string;
    fundamentals: string;
  };
  stocks: Stock[];
};

export type DipClassification =
  | "Quality pullback"
  | "Deep correction"
  | "Trend fracture"
  | "Early recovery"
  | "Routine reset"
  | "Potential value trap";

export type AnalyzedStock = Stock & {
  latestPrice: number;
  previousPrice: number;
  dailyReturn: number;
  oneMonthReturn: number;
  threeMonthReturn: number;
  oneYearReturn: number;
  high52Week: number;
  drawdown52Week: number;
  sma50: number;
  sma200: number;
  distanceFrom200Day: number;
  volatility: number;
  qualityScore: number;
  dipScore: number;
  valuationScore: number;
  classification: DipClassification;
  latestAnnual: AnnualFinancials | null;
  previousAnnual: AnnualFinancials | null;
  revenueGrowth: number | null;
  operatingMargin: number | null;
  freeCashFlowMargin: number | null;
  cashConversion: number | null;
  liabilityRatio: number | null;
  shareChange: number | null;
  why: string[];
};
