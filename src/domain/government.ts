export type DisclosureValueRange = {
  label: string;
  minimum: number;
  maximum: number | null;
};

export type GovernmentHolding = {
  asset: string;
  symbol: string;
  assetType: "stock" | "option" | "fund" | "other";
  owner: "self" | "spouse" | "joint" | "dependent" | "unspecified";
  value: DisclosureValueRange;
  sector: string;
};

export type GovernmentTransaction = {
  id: string;
  asset: string;
  symbol: string;
  assetType: "stock" | "option" | "fund" | "other";
  owner: GovernmentHolding["owner"];
  type: "purchase" | "sale" | "exchange";
  partial: boolean;
  transactionDate: string;
  notificationDate: string | null;
  filingDate: string | null;
  amount: DisclosureValueRange;
  description: string | null;
  sourceUrl: string;
};

export type GovernmentOfficial = {
  id: string;
  name: string;
  chamber: "House" | "Senate";
  party: "Democratic" | "Republican" | "Independent";
  state: string;
  district: string | null;
  role: string;
  holdingsAsOf: string | null;
  annualFilingUrl: string | null;
  holdings: GovernmentHolding[];
  transactions: GovernmentTransaction[];
};

export type GovernmentDataset = {
  generatedAt: string;
  source: string;
  methodology: string;
  officials: GovernmentOfficial[];
};

export function rangeMidpoint(range: DisclosureValueRange) {
  if (range.maximum == null) return range.minimum;
  return (range.minimum + range.maximum) / 2;
}

export function disclosedPortfolioRange(holdings: GovernmentHolding[]) {
  return holdings.reduce(
    (totals, holding) => ({
      minimum: totals.minimum + holding.value.minimum,
      midpoint: totals.midpoint + rangeMidpoint(holding.value),
      maximum: totals.maximum + (holding.value.maximum ?? holding.value.minimum),
    }),
    { minimum: 0, midpoint: 0, maximum: 0 },
  );
}

export function disclosureDelay(transaction: GovernmentTransaction) {
  if (!transaction.filingDate) return null;
  const traded = new Date(`${transaction.transactionDate}T00:00:00Z`).getTime();
  const filed = new Date(`${transaction.filingDate}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((filed - traded) / 86_400_000));
}
