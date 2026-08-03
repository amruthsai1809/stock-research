export type InstitutionalLifecycle = {
  status: "active" | "delayed" | "archived";
  endedAt: string | null;
  reason: string;
  sourceUrl: string;
};

export type InstitutionalHolding = {
  cusip: string;
  issuer: string;
  symbol: string | null;
  securityClass: string;
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
  sourceUrls: string[];
  totalValue: number;
  holdingsCount: number;
  displayedHoldingsCount: number;
  amendmentCount: number;
  confidentialOmitted: boolean;
  holdings: InstitutionalHolding[];
};

export type InstitutionalManagerSummary = {
  id: string;
  cik: string;
  name: string;
  displayName: string;
  category: string;
  description: string;
  lifecycle: InstitutionalLifecycle;
  latest: InstitutionalQuarter | null;
  earliestLoadedReportDate: string | null;
  quartersLoaded: number;
};

export type InstitutionalManager = Omit<InstitutionalManagerSummary, "latest" | "earliestLoadedReportDate" | "quartersLoaded"> & {
  secName: string;
  quarters: InstitutionalQuarter[];
};

export type InstitutionalIndex = {
  generatedAt: string;
  expectedReportDate: string;
  coverageQuarters: number;
  source: string;
  sourceUrl: string;
  methodology: string;
  managers: InstitutionalManagerSummary[];
};

export type HoldingChange = InstitutionalHolding & {
  key: string;
  previousValue: number;
  previousShares: number;
  valueChange: number;
  shareChange: number | null;
  changeType: "new" | "increased" | "reduced" | "unchanged";
};

export type PositionHistoryPoint = {
  reportDate: string;
  filedDate: string;
  shares: number | null;
  value: number | null;
  weight: number | null;
  status: "entered" | "added" | "trimmed" | "unchanged" | "exited" | "absent";
  sourceUrl: string;
};

export type PositionHistory = {
  holding: InstitutionalHolding;
  points: PositionHistoryPoint[];
  currentEpisodeStart: string;
  firstLoadedReport: string;
  firstSeenInLoadedHistory: string;
  historyLimited: boolean;
  quartersHeld: number;
};

export function institutionalHoldingKey(holding: Pick<InstitutionalHolding, "cusip" | "optionType">) {
  return `${holding.cusip}-${holding.optionType ?? "LONG"}`;
}

export function compareInstitutionalQuarters(
  current: InstitutionalQuarter,
  previous?: InstitutionalQuarter,
): { changes: HoldingChange[]; exited: InstitutionalHolding[] } {
  const before = new Map((previous?.holdings ?? []).map((holding) => [institutionalHoldingKey(holding), holding]));
  const currentKeys = new Set(current.holdings.map(institutionalHoldingKey));
  const changes = current.holdings.map((holding) => {
    const key = institutionalHoldingKey(holding);
    const prior = before.get(key);
    const shareChange = prior?.shares ? ((holding.shares - prior.shares) / Math.abs(prior.shares)) * 100 : null;
    let changeType: HoldingChange["changeType"] = "unchanged";
    if (!prior) changeType = "new";
    else if ((shareChange ?? 0) > 0.1) changeType = "increased";
    else if ((shareChange ?? 0) < -0.1) changeType = "reduced";
    return {
      ...holding,
      key,
      previousValue: prior?.value ?? 0,
      previousShares: prior?.shares ?? 0,
      valueChange: holding.value - (prior?.value ?? 0),
      shareChange,
      changeType,
    };
  });
  const exited = (previous?.holdings ?? []).filter((holding) => !currentKeys.has(institutionalHoldingKey(holding)));
  return { changes, exited };
}

export function buildPositionHistory(manager: InstitutionalManager, holdingKey: string): PositionHistory | null {
  const chronological = [...manager.quarters].reverse();
  let prior: InstitutionalHolding | null = null;
  let currentEpisodeStart = "";
  let firstSeen = "";
  let historyLimited = false;
  let quartersHeld = 0;
  const points = chronological.map((quarter, index) => {
    const holding = quarter.holdings.find((item) => institutionalHoldingKey(item) === holdingKey) ?? null;
    let status: PositionHistoryPoint["status"] = "absent";
    if (holding && !prior) {
      status = "entered";
      currentEpisodeStart = quarter.reportDate;
      if (!firstSeen) {
        firstSeen = quarter.reportDate;
        historyLimited = index === 0;
      }
    } else if (!holding && prior) {
      status = "exited";
    } else if (holding && prior) {
      const change = prior.shares ? ((holding.shares - prior.shares) / Math.abs(prior.shares)) * 100 : 0;
      status = change > 0.1 ? "added" : change < -0.1 ? "trimmed" : "unchanged";
    }
    if (holding) quartersHeld += 1;
    const point = {
      reportDate: quarter.reportDate,
      filedDate: quarter.filedDate,
      shares: holding?.shares ?? null,
      value: holding?.value ?? null,
      weight: holding?.weight ?? null,
      status,
      sourceUrl: quarter.sourceUrl,
    };
    prior = holding;
    return point;
  });
  const holding = manager.quarters[0]?.holdings.find((item) => institutionalHoldingKey(item) === holdingKey)
    ?? [...manager.quarters].flatMap((quarter) => quarter.holdings).find((item) => institutionalHoldingKey(item) === holdingKey);
  if (!holding || !firstSeen) return null;
  return {
    holding,
    points: points.slice(Math.max(0, points.findIndex((point) => point.status === "entered") - 1)),
    currentEpisodeStart,
    firstLoadedReport: chronological[0]?.reportDate ?? firstSeen,
    firstSeenInLoadedHistory: firstSeen,
    historyLimited,
    quartersHeld,
  };
}

export function managerConcentration(quarter: InstitutionalQuarter, top = 10) {
  return quarter.holdings.slice(0, top).reduce((total, holding) => total + holding.weight, 0);
}

export function managerTurnover(current: InstitutionalQuarter, previous?: InstitutionalQuarter) {
  if (!previous?.totalValue) return null;
  const before = new Map(previous.holdings.map((holding) => [institutionalHoldingKey(holding), holding]));
  const currentKeys = new Set(current.holdings.map(institutionalHoldingKey));
  const buys = current.holdings.reduce((total, holding) => {
    const prior = before.get(institutionalHoldingKey(holding));
    if (!prior) return total + holding.value;
    const fraction = prior.shares ? Math.max(0, (holding.shares - prior.shares) / Math.abs(holding.shares || 1)) : 0;
    return total + holding.value * fraction;
  }, 0);
  const sales = previous.holdings.reduce((total, holding) => {
    const currentHolding = current.holdings.find((item) => institutionalHoldingKey(item) === institutionalHoldingKey(holding));
    if (!currentKeys.has(institutionalHoldingKey(holding)) || !currentHolding) return total + holding.value;
    const fraction = holding.shares ? Math.max(0, (holding.shares - currentHolding.shares) / Math.abs(holding.shares)) : 0;
    return total + holding.value * fraction;
  }, 0);
  return Math.min(100, (Math.min(buys, sales) / ((current.totalValue + previous.totalValue) / 2)) * 100);
}
