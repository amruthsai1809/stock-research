export type InstitutionalHolding = {
  cusip: string;
  issuer: string;
  symbol: string | null;
  securityClass: string;
  sector: string;
  value: number;
  shares: number;
  weight: number;
  optionType: "PUT" | "CALL" | null;
};

export type InstitutionalQuarter = {
  reportDate: string;
  filedDate: string;
  accession: string;
  sourceUrl: string;
  totalValue: number;
  holdingsCount: number;
  amendment: boolean;
  holdings: InstitutionalHolding[];
};

export type InstitutionalManager = {
  id: string;
  cik: string;
  name: string;
  displayName: string;
  description: string;
  style: string;
  quarters: InstitutionalQuarter[];
};

export type InstitutionalDataset = {
  generatedAt: string;
  coverageStart: string;
  source: string;
  managers: InstitutionalManager[];
};

export type HoldingChange = InstitutionalHolding & {
  previousValue: number;
  previousShares: number;
  valueChange: number;
  shareChange: number | null;
  changeType: "new" | "increased" | "reduced" | "unchanged";
};

export function compareInstitutionalQuarters(
  current: InstitutionalQuarter,
  previous?: InstitutionalQuarter,
): { changes: HoldingChange[]; exited: InstitutionalHolding[] } {
  const before = new Map((previous?.holdings ?? []).map((holding) => [holding.cusip, holding]));
  const currentCusips = new Set(current.holdings.map((holding) => holding.cusip));
  const changes = current.holdings.map((holding) => {
    const prior = before.get(holding.cusip);
    const shareChange = prior?.shares
      ? ((holding.shares - prior.shares) / Math.abs(prior.shares)) * 100
      : null;
    let changeType: HoldingChange["changeType"] = "unchanged";
    if (!prior) changeType = "new";
    else if ((shareChange ?? 0) > 0.1) changeType = "increased";
    else if ((shareChange ?? 0) < -0.1) changeType = "reduced";
    return {
      ...holding,
      previousValue: prior?.value ?? 0,
      previousShares: prior?.shares ?? 0,
      valueChange: holding.value - (prior?.value ?? 0),
      shareChange,
      changeType,
    };
  });
  const exited = (previous?.holdings ?? []).filter((holding) => !currentCusips.has(holding.cusip));
  return { changes, exited };
}

export function managerConcentration(quarter: InstitutionalQuarter, top = 10) {
  return quarter.holdings.slice(0, top).reduce((total, holding) => total + holding.weight, 0);
}

export function managerTurnover(current: InstitutionalQuarter, previous?: InstitutionalQuarter) {
  if (!previous?.totalValue) return null;
  const before = new Map(previous.holdings.map((holding) => [holding.cusip, holding.value]));
  const buys = current.holdings.reduce(
    (total, holding) => total + Math.max(0, holding.value - (before.get(holding.cusip) ?? 0)),
    0,
  );
  return Math.min(100, (buys / previous.totalValue) * 100);
}
