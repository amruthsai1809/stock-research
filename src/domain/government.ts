export type GovernmentFiler = {
  id: string;
  full_name: string;
  branch: "congress" | "executive";
  chamber: "house" | "senate" | null;
  party: "D" | "R" | "I" | null;
  state: string | null;
  district?: number | null;
  agency: string | null;
  level: string | null;
  office: string | null;
  photo_url: string | null;
  trade_count: number;
  purchases: number;
  sales: number;
  late_filings: number;
  est_volume: number;
  active: boolean | null;
  bioguide_id: string | null;
  latestTransactionDate: string;
  loadedTradeCount: number;
};

export type GovernmentTrade = {
  id: string;
  filing_id?: string;
  source_id: "house_clerk" | "senate_efd" | "oge_executive";
  transaction_date: string | null;
  notification_date?: string | null;
  filing_date: string;
  owner: string | null;
  ticker: string | null;
  asset_name: string;
  asset_type: string | null;
  transaction_type: string;
  amount_range_low: number | null;
  amount_range_high: number | null;
  amount_range_label: string;
  days_to_file: number | null;
  is_late: number;
  comment: string | null;
  filer_id: string;
  filer_name?: string;
  branch?: string;
  chamber?: string | null;
  party?: string | null;
  state?: string | null;
  office?: string | null;
  doc_url: string;
  filing_type: string;
  ret_since: number | null;
  excess_since: number | null;
  ret_30d: number | null;
  ret_1y: number | null;
};

export type GovernmentProfile = {
  filer: GovernmentFiler;
  trades: GovernmentTrade[];
  historyTruncated: boolean;
  totalTradeCount: number;
};

export type GovernmentMeta = {
  generatedAt: string;
  upstreamGeneratedAt: string;
  upstreamCommit?: string;
  source: string;
  normalizedBy: string;
  upstreamUrl: string;
  methodology: string;
  officialSources: { house: string; senate: string; executive: string };
  totals: { trades: number; filings: number; filers: number; currentCongress: number; recentLoaded: number };
  dateRange: { from: string; to: string };
  disclosureLag: {
    medianDaysToFile: number;
    p90DaysToFile: number;
    maxDaysToFile: number;
    tradesWithLag: number;
    lateCount: number;
    buckets: { key: string; label: string; count: number; late: boolean }[];
  };
};

export type GovernmentLeaderboardConfidence = "high" | "medium" | "limited";

export type GovernmentLeaderboardPurchase = {
  ticker: string;
  transactionDate: string;
  return1Y: number;
};

export type GovernmentLeaderboardEntry = {
  filerId: string;
  fullName: string;
  branch: GovernmentFiler["branch"];
  chamber: GovernmentFiler["chamber"];
  party: GovernmentFiler["party"];
  state: string | null;
  office: string | null;
  agency: string | null;
  photoUrl: string | null;
  active: boolean | null;
  latestTransactionDate: string;
  totalTransactions: number;
  recentTransactions: number;
  disclosedActivity: number;
  estimatedOpenActivity: number;
  inferredPositions: number;
  medianPurchaseReturn1Y: number | null;
  averagePurchaseReturn1Y: number | null;
  purchaseWinRate1Y: number | null;
  reliabilityScore1Y: number | null;
  medianReturnSincePurchase: number | null;
  medianExcessSincePurchase: number | null;
  performanceSample: number;
  eligiblePurchases: number;
  returnCoverage: number;
  confidence: GovernmentLeaderboardConfidence;
  historyTruncated: boolean;
  bestPurchase: GovernmentLeaderboardPurchase | null;
  worstPurchase: GovernmentLeaderboardPurchase | null;
};

export type GovernmentLeaderboardDataset = {
  generatedAt: string;
  asOf: string;
  methodology: string;
  entries: GovernmentLeaderboardEntry[];
};

export type ExposureSignal = {
  ticker: string;
  assetName: string;
  firstReported: string;
  lastActivity: string;
  lastAction: "purchase" | "sale" | "exchange" | "other";
  purchaseCount: number;
  saleCount: number;
  estimatedNetActivity: number;
  ownerTypes: string[];
  confidence: "strong" | "moderate";
  trades: GovernmentTrade[];
};

export function tradeAction(trade: GovernmentTrade): "purchase" | "sale" | "exchange" | "other" {
  const value = trade.transaction_type.toLowerCase();
  if (value.includes("purchase") || value.includes("buy")) return "purchase";
  if (value.includes("sale") || value.includes("sell")) return "sale";
  if (value.includes("exchange")) return "exchange";
  return "other";
}

export function tradeRangeMidpoint(trade: GovernmentTrade) {
  const low = trade.amount_range_low ?? 0;
  return trade.amount_range_high == null ? low : (low + trade.amount_range_high) / 2;
}

export function buildExposureSignals(trades: GovernmentTrade[]): ExposureSignal[] {
  const latestTradeDate = trades.reduce((latest, trade) => (trade.transaction_date ?? "") > latest ? trade.transaction_date! : latest, "0000-01-01");
  const staleDate = new Date(`${latestTradeDate}T00:00:00Z`);
  staleDate.setUTCFullYear(staleDate.getUTCFullYear() - 3);
  const staleCutoff = staleDate.toISOString().slice(0, 10);
  const byTicker = new Map<string, DatedGovernmentTrade[]>();
  for (const trade of trades) {
    if (!hasTradeDate(trade)) continue;
    const ticker = trade.ticker?.trim().toUpperCase();
    if (!ticker || !/^[A-Z][A-Z0-9.-]{0,7}$/.test(ticker)) continue;
    const group = byTicker.get(ticker) ?? [];
    group.push(trade);
    byTicker.set(ticker, group);
  }
  const signals: ExposureSignal[] = [];
  for (const [ticker, group] of byTicker) {
    const ordered = [...group].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
    let episode: DatedGovernmentTrade[] = [];
    let net = 0;
    for (const trade of ordered) {
      const action = tradeAction(trade);
      if (action === "sale" && /full/i.test(trade.transaction_type)) {
        episode = [];
        net = 0;
        continue;
      }
      if (action === "purchase") {
        episode.push(trade);
        net += tradeRangeMidpoint(trade);
      } else if (action === "sale" && episode.length) {
        episode.push(trade);
        net = Math.max(0, net - tradeRangeMidpoint(trade));
      } else if (action === "exchange" && episode.length) {
        episode.push(trade);
      }
    }
    const purchases = episode.filter((trade) => tradeAction(trade) === "purchase");
    if (!episode.length || !purchases.length || net <= 0) continue;
    const latest = episode.at(-1)!;
    signals.push({
      ticker,
      assetName: exposureAssetName(ticker, episode),
      firstReported: episode[0].transaction_date,
      lastActivity: latest.transaction_date,
      lastAction: tradeAction(latest),
      purchaseCount: purchases.length,
      saleCount: episode.filter((trade) => tradeAction(trade) === "sale").length,
      estimatedNetActivity: net,
      ownerTypes: [...new Set(episode.map((trade) => trade.owner).filter(Boolean) as string[])],
      confidence: episode.some((trade) => tradeAction(trade) === "sale") || latest.transaction_date < staleCutoff ? "moderate" : "strong",
      trades: [...episode].reverse(),
    });
  }
  return signals.sort((a, b) => b.estimatedNetActivity - a.estimatedNetActivity || b.lastActivity.localeCompare(a.lastActivity));
}

type DatedGovernmentTrade = GovernmentTrade & { transaction_date: string };
function hasTradeDate(trade: GovernmentTrade): trade is DatedGovernmentTrade { return Boolean(trade.transaction_date); }

function exposureAssetName(ticker: string, trades: GovernmentTrade[]) {
  const candidates = trades
    .map((trade) => trade.asset_name.trim())
    .filter(Boolean)
    .filter((name) => !/description:|filing\s+status|\$\d|s\d{1,2}\/\d{1,2}\/|\d{8}[A-Z]/i.test(name))
    .filter((name) => name.length <= 96)
    .sort((a, b) => a.length - b.length || a.localeCompare(b));
  return candidates[0] ?? `${ticker} security · source label needs verification`;
}

export function filerStats(profile: GovernmentProfile) {
  const purchases = profile.trades.filter((trade) => tradeAction(trade) === "purchase").length;
  const sales = profile.trades.filter((trade) => tradeAction(trade) === "sale").length;
  const lagged = profile.trades.filter((trade) => trade.days_to_file != null);
  const medianLag = lagged.length ? [...lagged].sort((a, b) => (a.days_to_file ?? 0) - (b.days_to_file ?? 0))[Math.floor(lagged.length / 2)].days_to_file : null;
  const lateRate = lagged.length ? (lagged.filter((trade) => trade.is_late).length / lagged.length) * 100 : null;
  const volume = profile.trades.reduce((sum, trade) => sum + tradeRangeMidpoint(trade), 0);
  return { purchases, sales, medianLag, lateRate, volume };
}
