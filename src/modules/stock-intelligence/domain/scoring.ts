import type { StockSummary } from "@/src/domain/stock";
import type { FactorEvidence, FactorScore, IntelligenceFactorKey, IntelligenceStrategyId, ResearchSignal, StockIntelligenceScore } from "./types";

const factorLabels: Record<IntelligenceFactorKey, string> = {
  quality: "Business quality",
  valuation: "Valuation",
  growth: "Growth",
  momentum: "Price trend",
  risk: "Resilience",
  insider: "Insider activity",
  institutional: "Institutional activity",
  analyst: "Analyst consensus",
};

export const intelligenceStrategies: Record<IntelligenceStrategyId, { label: string; description: string; weights: Record<IntelligenceFactorKey, number> }> = {
  balanced: { label: "Balanced", description: "A broad evidence mix that does not let momentum dominate the result.", weights: { quality: 20, valuation: 18, growth: 14, momentum: 11, risk: 13, insider: 8, institutional: 8, analyst: 8 } },
  compounder: { label: "Compounder", description: "Rewards durable margins, cash conversion, growth, and balance-sheet resilience.", weights: { quality: 29, valuation: 9, growth: 21, momentum: 7, risk: 16, insider: 5, institutional: 5, analyst: 8 } },
  value: { label: "Value", description: "Prioritizes cash-flow yield and margin of safety without ignoring business health.", weights: { quality: 18, valuation: 31, growth: 8, momentum: 5, risk: 14, insider: 8, institutional: 8, analyst: 8 } },
  momentum: { label: "Trend", description: "Emphasizes persistent price strength, tempered by quality and downside risk.", weights: { quality: 13, valuation: 6, growth: 9, momentum: 32, risk: 12, insider: 7, institutional: 13, analyst: 8 } },
  "dip-hunter": { label: "Dip hunter", description: "Looks for quality companies in meaningful drawdowns with signs of stabilization.", weights: { quality: 22, valuation: 19, growth: 9, momentum: 13, risk: 14, insider: 8, institutional: 7, analyst: 8 } },
};

type RawFactor = Omit<FactorScore, "configuredWeight" | "effectiveWeight" | "contribution">;

const clamp = (value: number, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));
const average = (values: Array<number | null>) => {
  const usable = values.filter((value): value is number => value != null && Number.isFinite(value));
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
};
const scale = (value: number, low: number, high: number) => clamp(((value - low) / (high - low)) * 100);
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);
const pct = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;

function metricPercentile(value: number | null, peers: Array<number | null>, higherIsBetter = true) {
  if (value == null || !Number.isFinite(value)) return null;
  const usable = peers.filter((peer): peer is number => peer != null && Number.isFinite(peer));
  if (usable.length < 3) return null;
  const lower = usable.filter((peer) => peer < value).length;
  const equal = usable.filter((peer) => peer === value).length;
  const percentile = ((lower + Math.max(0, equal - 1) / 2) / Math.max(1, usable.length - 1)) * 100;
  return higherIsBetter ? percentile : 100 - percentile;
}

function latestMarketCap(stock: StockSummary) {
  if (stock.marketCap && stock.marketCap > 0) return stock.marketCap;
  const shares = stock.latestAnnual?.shares;
  return shares && shares > 0 ? shares * stock.latestPrice : null;
}

function estimatedFairValue(stock: StockSummary) {
  const annual = stock.latestAnnual;
  if (!annual?.freeCashFlow || annual.freeCashFlow <= 0 || !annual.shares || annual.shares <= 0) return null;
  const growth = clamp(stock.revenueGrowth ?? 4, -5, 14) / 100;
  const discountRate = 0.095;
  const terminalGrowth = 0.025;
  let cashFlow = annual.freeCashFlow;
  let presentValue = 0;
  for (let year = 1; year <= 10; year += 1) {
    cashFlow *= 1 + growth * Math.max(0.35, 1 - year * 0.065);
    presentValue += cashFlow / (1 + discountRate) ** year;
  }
  const terminal = (cashFlow * (1 + terminalGrowth)) / (discountRate - terminalGrowth);
  const enterpriseValue = presentValue + terminal / (1 + discountRate) ** 10;
  const equityValue = enterpriseValue + (annual.cash ?? 0) - Math.max(0, (annual.liabilities ?? 0) - (annual.assets ?? 0) * 0.35);
  const perShare = equityValue / annual.shares;
  return Number.isFinite(perShare) && perShare > 0 ? perShare : null;
}

function qualityFactor(stock: StockSummary): RawFactor {
  const profitability = average([
    stock.operatingMargin == null ? null : scale(stock.operatingMargin, 0, 35),
    stock.freeCashFlowMargin == null ? null : scale(stock.freeCashFlowMargin, 0, 30),
    stock.cashConversion == null ? null : scale(stock.cashConversion, 0.45, 1.45),
    stock.liabilityRatio == null ? null : scale(stock.liabilityRatio, 0.85, 0.25),
    stock.shareChange == null ? null : scale(stock.shareChange, 5, -4),
  ]);
  const evidence: FactorEvidence[] = [
    { label: "Operating margin", value: stock.operatingMargin == null ? "Unavailable" : pct(stock.operatingMargin), direction: (stock.operatingMargin ?? 0) >= 15 ? "positive" : (stock.operatingMargin ?? 0) < 5 ? "negative" : "neutral", detail: "Latest reported operating income divided by revenue." },
    { label: "FCF margin", value: stock.freeCashFlowMargin == null ? "Unavailable" : pct(stock.freeCashFlowMargin), direction: (stock.freeCashFlowMargin ?? 0) >= 12 ? "positive" : (stock.freeCashFlowMargin ?? 0) < 2 ? "negative" : "neutral", detail: "Latest reported free cash flow divided by revenue." },
    { label: "Share change", value: stock.shareChange == null ? "Unavailable" : pct(stock.shareChange), direction: (stock.shareChange ?? 0) <= 0 ? "positive" : (stock.shareChange ?? 0) > 3 ? "negative" : "neutral", detail: "Change in annual weighted shares; dilution reduces the factor." },
  ];
  return profitability == null
    ? unavailable("quality", "Annual profitability and balance-sheet inputs are unavailable.")
    : available("quality", Math.round(profitability), stock.latestAnnual?.filed ?? stock.latestAnnual?.end ?? null, evidence);
}

function valuationFactor(stock: StockSummary, peers: StockSummary[]): { factor: RawFactor; fairValue: number | null; marginOfSafety: number | null } {
  const marketCap = latestMarketCap(stock);
  const netYield = marketCap && stock.latestAnnual?.netIncome != null ? (stock.latestAnnual.netIncome / marketCap) * 100 : null;
  const fcfYield = marketCap && stock.latestAnnual?.freeCashFlow != null ? (stock.latestAnnual.freeCashFlow / marketCap) * 100 : null;
  const fairValue = estimatedFairValue(stock);
  const marginOfSafety = fairValue ? ((fairValue - stock.latestPrice) / stock.latestPrice) * 100 : null;
  const peerFcfYields = peers.map((peer) => {
    const peerCap = latestMarketCap(peer);
    return peerCap && peer.latestAnnual?.freeCashFlow != null ? (peer.latestAnnual.freeCashFlow / peerCap) * 100 : null;
  });
  const score = average([
    metricPercentile(fcfYield, peerFcfYields),
    netYield == null ? null : scale(netYield, -2, 8),
    marginOfSafety == null ? null : scale(marginOfSafety, -45, 45),
  ]);
  const evidence: FactorEvidence[] = [
    { label: "FCF yield", value: fcfYield == null ? "Unavailable" : pct(fcfYield), direction: (fcfYield ?? 0) >= 4 ? "positive" : (fcfYield ?? 0) < 1 ? "negative" : "neutral", detail: "Free cash flow divided by estimated market capitalization." },
    { label: "Earnings yield", value: netYield == null ? "Unavailable" : pct(netYield), direction: (netYield ?? 0) >= 4 ? "positive" : (netYield ?? 0) < 0 ? "negative" : "neutral", detail: "Net income divided by estimated market capitalization; the inverse of P/E." },
    { label: "Model fair value", value: fairValue == null ? "Unavailable" : `$${fairValue.toFixed(2)}`, direction: (marginOfSafety ?? 0) >= 10 ? "positive" : (marginOfSafety ?? 0) < -15 ? "negative" : "neutral", detail: "A conservative 10-year cash-flow model, not a price target." },
  ];
  return { factor: score == null ? unavailable("valuation", "Positive cash flow or share-count inputs are unavailable.") : available("valuation", Math.round(score), stock.latestAnnual?.filed ?? null, evidence), fairValue, marginOfSafety };
}

function growthFactor(stock: StockSummary): RawFactor {
  const current = stock.latestAnnual;
  const previous = stock.previousAnnual;
  const fcfGrowth = current?.freeCashFlow != null && previous?.freeCashFlow ? ((current.freeCashFlow - previous.freeCashFlow) / Math.abs(previous.freeCashFlow)) * 100 : null;
  const score = average([
    stock.revenueGrowth == null ? null : scale(stock.revenueGrowth, -10, 28),
    fcfGrowth == null ? null : scale(fcfGrowth, -25, 45),
  ]);
  const evidence: FactorEvidence[] = [
    { label: "Revenue growth", value: stock.revenueGrowth == null ? "Unavailable" : pct(stock.revenueGrowth), direction: (stock.revenueGrowth ?? 0) >= 8 ? "positive" : (stock.revenueGrowth ?? 0) < 0 ? "negative" : "neutral", detail: "Year-over-year change in reported annual revenue." },
    { label: "FCF growth", value: fcfGrowth == null ? "Unavailable" : pct(fcfGrowth), direction: (fcfGrowth ?? 0) >= 8 ? "positive" : (fcfGrowth ?? 0) < 0 ? "negative" : "neutral", detail: "Year-over-year change in free cash flow; volatile when the prior value is small." },
  ];
  return score == null ? unavailable("growth", "Two comparable annual periods are unavailable.") : available("growth", Math.round(score), current?.filed ?? null, evidence);
}

function momentumFactor(stock: StockSummary, peers: StockSummary[], strategy: IntelligenceStrategyId): RawFactor {
  const trendPercentile = metricPercentile(stock.oneYearReturn, peers.map((peer) => peer.oneYearReturn));
  const dipSetup = average([
    scale(stock.drawdown52Week, -45, -8),
    scale(stock.oneMonthReturn, -12, 6),
    scale(stock.distanceFrom200Day, -25, 8),
  ]);
  const trendScore = average([
    trendPercentile,
    scale(stock.threeMonthReturn, -20, 28),
    scale(stock.distanceFrom200Day, -20, 20),
  ]);
  const score = strategy === "dip-hunter" ? dipSetup : trendScore;
  return available("momentum", Math.round(score ?? 50), stock.priceAsOf, [
    { label: "12-month return", value: pct(stock.oneYearReturn), direction: stock.oneYearReturn > 8 ? "positive" : stock.oneYearReturn < -8 ? "negative" : "neutral", detail: "Adjusted close performance over roughly 252 trading days." },
    { label: "vs. 200-day", value: pct(stock.distanceFrom200Day), direction: stock.distanceFrom200Day > 0 ? "positive" : stock.distanceFrom200Day < -12 ? "negative" : "neutral", detail: "Distance from the long-term moving-average trend." },
    { label: "From 52-week high", value: pct(stock.drawdown52Week), direction: strategy === "dip-hunter" && stock.drawdown52Week < -12 ? "positive" : stock.drawdown52Week < -30 ? "negative" : "neutral", detail: strategy === "dip-hunter" ? "A meaningful pullback can improve opportunity only when other factors remain healthy." : "A deep drawdown reduces ordinary trend strength." },
  ]);
}

function riskFactor(stock: StockSummary, peers: StockSummary[]): RawFactor {
  const score = average([
    metricPercentile(stock.volatility, peers.map((peer) => peer.volatility), false),
    scale(stock.drawdown52Week, -50, 0),
    stock.liabilityRatio == null ? null : scale(stock.liabilityRatio, 0.9, 0.2),
    stock.latestAnnual?.freeCashFlow == null ? null : stock.latestAnnual.freeCashFlow > 0 ? 75 : 20,
  ]);
  return available("risk", Math.round(score ?? 50), stock.priceAsOf, [
    { label: "Annual volatility", value: pct(stock.volatility), direction: stock.volatility < 25 ? "positive" : stock.volatility > 50 ? "negative" : "neutral", detail: "Annualized realized volatility from recent daily prices." },
    { label: "52-week drawdown", value: pct(stock.drawdown52Week), direction: stock.drawdown52Week > -12 ? "positive" : stock.drawdown52Week < -30 ? "negative" : "neutral", detail: "Peak-to-current loss over the latest trading year." },
    { label: "Liability ratio", value: stock.liabilityRatio == null ? "Unavailable" : pct(stock.liabilityRatio * 100), direction: (stock.liabilityRatio ?? 0) < 0.55 ? "positive" : (stock.liabilityRatio ?? 0) > 0.8 ? "negative" : "neutral", detail: "Reported liabilities divided by assets." },
  ]);
}

function insiderFactor(signal: ResearchSignal | undefined): RawFactor {
  if (!signal) return unavailable("insider", "The SEC ownership snapshot is unavailable for this company.");
  const transactions = signal.insider.transactions;
  const purchases = transactions.filter((item) => item.action === "purchase");
  const sales = transactions.filter((item) => item.action === "sale");
  const summary = signal.insider.summary;
  const purchaseCount = summary.purchaseCount || purchases.length;
  const saleCount = summary.saleCount || sales.length;
  const purchaseValue = summary.purchaseValue || purchases.reduce((sum, item) => sum + (item.value ?? 0), 0);
  const saleValue = summary.saleValue || sales.reduce((sum, item) => sum + (item.value ?? 0), 0);
  const discretionarySaleCount = summary.discretionarySaleCount || sales.filter((item) => !item.rule10b51).length;
  if (!purchaseCount && !saleCount) return available("insider", 50, signal.insider.asOf, [{ label: "Open-market trades", value: "None found", direction: "neutral", detail: "No coded open-market purchase or sale appears in the loaded Forms 4/4-A window. This is neutral, not bullish." }]);
  const raw = 50 + Math.min(32, purchaseCount * 8 + Math.log10(purchaseValue + 1) * 2) - Math.min(28, discretionarySaleCount * 5 + Math.log10(saleValue + 1));
  return available("insider", Math.round(clamp(raw)), signal.insider.asOf, [
    { label: "Purchases", value: `${purchaseCount} · ${money(purchaseValue)}`, direction: purchaseCount ? "positive" : "neutral", detail: "Open-market purchases (transaction code P) in the loaded SEC window." },
    { label: "Sales", value: `${saleCount} · ${money(saleValue)}`, direction: discretionarySaleCount ? "negative" : "neutral", detail: "Open-market sales (code S); 10b5-1 plan sales receive less negative weight." },
    { label: "10b5-1 plan sales", value: String(Math.max(0, saleCount - discretionarySaleCount)), direction: "neutral", detail: "Planned sales are disclosed separately so they are not treated like discretionary selling." },
  ]);
}

function institutionalFactor(signal: ResearchSignal | undefined): RawFactor {
  if (!signal?.institutional.reportDate) return unavailable("institutional", "No covered active 13F manager held this security in the latest loaded period.");
  const item = signal.institutional;
  const score = clamp(50 + item.managersNew * 8 + item.managersIncreased * 4 - item.managersReduced * 4 - item.managersExited * 8 + Math.min(10, item.managersHolding));
  return available("institutional", Math.round(score), item.filingDate, [
    { label: "Managers holding", value: String(item.managersHolding), direction: item.managersHolding >= 3 ? "positive" : "neutral", detail: "Covered active 13F managers reporting a position." },
    { label: "Added / new", value: `${item.managersIncreased} / ${item.managersNew}`, direction: item.managersIncreased + item.managersNew > item.managersReduced + item.managersExited ? "positive" : "neutral", detail: "Quarter-over-quarter share-count increases and newly reported positions." },
    { label: "Reduced / exited", value: `${item.managersReduced} / ${item.managersExited}`, direction: item.managersReduced + item.managersExited > item.managersIncreased + item.managersNew ? "negative" : "neutral", detail: "Quarter-over-quarter reductions and exits." },
  ]);
}

function analystFactor(signal: ResearchSignal | undefined): RawFactor {
  const analyst = signal?.analyst;
  if (!analyst?.available) return unavailable("analyst", analyst?.reason ?? "Analyst consensus is unavailable for this company.");
  const ratingScore = analyst.recommendationMean == null ? null : scale(analyst.recommendationMean, 5, 1);
  const targetScore = analyst.targetUpside == null ? null : scale(analyst.targetUpside, -30, 40);
  const recent = analyst.actions.slice(0, 15);
  const upgrades = recent.filter((item) => item.action === "up").length;
  const downgrades = recent.filter((item) => item.action === "down").length;
  const revisionScore = recent.length ? clamp(50 + (upgrades - downgrades) * 8) : null;
  const score = average([ratingScore, targetScore, revisionScore]);
  return score == null
    ? unavailable("analyst", "The available analyst snapshot did not contain enough comparable fields.")
    : available("analyst", Math.round(score), analyst.asOf, [
        { label: "Consensus", value: analyst.recommendationKey?.replaceAll("_", " ") ?? "Unavailable", direction: (ratingScore ?? 50) >= 65 ? "positive" : (ratingScore ?? 50) < 40 ? "negative" : "neutral", detail: `${analyst.numberOfAnalysts} analyst opinions in the latest delayed snapshot.` },
        { label: "Mean target upside", value: analyst.targetUpside == null ? "Unavailable" : pct(analyst.targetUpside), direction: (analyst.targetUpside ?? 0) >= 10 ? "positive" : (analyst.targetUpside ?? 0) < 0 ? "negative" : "neutral", detail: "Mean published target relative to the market price captured with the analyst snapshot." },
        { label: "Recent changes", value: `${upgrades} up / ${downgrades} down`, direction: upgrades > downgrades ? "positive" : downgrades > upgrades ? "negative" : "neutral", detail: "Rating changes among the most recent available analyst actions." },
      ]);
}

function available(key: IntelligenceFactorKey, score: number, asOf: string | null, evidence: FactorEvidence[]): RawFactor {
  return { key, label: factorLabels[key], score: clamp(score), status: "available", asOf, evidence };
}

function unavailable(key: IntelligenceFactorKey, reason: string): RawFactor {
  return { key, label: factorLabels[key], score: null, status: "unavailable", asOf: null, evidence: [], unavailableReason: reason };
}

function grade(score: number): StockIntelligenceScore["grade"] {
  if (score >= 82) return "Exceptional";
  if (score >= 70) return "Attractive";
  if (score >= 58) return "Selective";
  if (score >= 45) return "Watch";
  return "Caution";
}

export function scoreStockIntelligence(stock: StockSummary, universe: StockSummary[], signal: ResearchSignal | undefined, strategy: IntelligenceStrategyId): StockIntelligenceScore {
  const peers = universe.filter((candidate) => candidate.sector === stock.sector);
  const peerSet = peers.length >= 4 ? peers : universe;
  const valuation = valuationFactor(stock, peerSet);
  const rawFactors: RawFactor[] = [
    qualityFactor(stock),
    valuation.factor,
    growthFactor(stock),
    momentumFactor(stock, peerSet, strategy),
    riskFactor(stock, peerSet),
    insiderFactor(signal),
    institutionalFactor(signal),
    analystFactor(signal),
  ];
  const configured = intelligenceStrategies[strategy].weights;
  const availableWeight = rawFactors.reduce((sum, factor) => sum + (factor.score == null ? 0 : configured[factor.key]), 0);
  const configuredWeight = rawFactors.reduce((sum, factor) => sum + configured[factor.key], 0);
  const factors = rawFactors.map<FactorScore>((factor) => {
    const effectiveWeight = factor.score == null || !availableWeight ? 0 : (configured[factor.key] / availableWeight) * 100;
    return { ...factor, configuredWeight: configured[factor.key], effectiveWeight, contribution: factor.score == null ? 0 : (factor.score * effectiveWeight) / 100 };
  });
  const score = Math.round(factors.reduce((sum, factor) => sum + factor.contribution, 0));
  const confidence = Math.round((availableWeight / Math.max(1, configuredWeight)) * 100);
  const positives = factors.filter((factor) => (factor.score ?? 0) >= 65).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3).map((factor) => `${factor.label} is supportive at ${factor.score}/100.`);
  const cautions = factors.filter((factor) => factor.score != null && factor.score < 42).sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).slice(0, 3).map((factor) => `${factor.label} is a constraint at ${factor.score}/100.`);
  if (factors.some((factor) => factor.status === "unavailable")) cautions.push("Some factors are unavailable; confidence reflects the missing coverage.");
  return {
    symbol: stock.symbol,
    companyName: stock.name,
    strategy,
    score,
    grade: grade(score),
    confidence,
    quality: Math.round(average([factors.find((factor) => factor.key === "quality")?.score ?? null, factors.find((factor) => factor.key === "growth")?.score ?? null]) ?? 0),
    opportunity: Math.round(average([factors.find((factor) => factor.key === "valuation")?.score ?? null, factors.find((factor) => factor.key === "momentum")?.score ?? null, factors.find((factor) => factor.key === "institutional")?.score ?? null]) ?? 0),
    resilience: Math.round(factors.find((factor) => factor.key === "risk")?.score ?? 0),
    fairValue: valuation.fairValue,
    marginOfSafety: valuation.marginOfSafety,
    factors,
    positives: positives.length ? positives : ["No factor currently clears the supportive threshold."],
    cautions: cautions.length ? cautions : ["No factor currently clears the high-risk threshold."],
    dataAsOf: stock.priceAsOf,
  };
}

export function scoreIntelligenceUniverse(stocks: StockSummary[], signals: Record<string, ResearchSignal>, strategy: IntelligenceStrategyId) {
  return stocks.map((stock) => scoreStockIntelligence(stock, stocks, signals[stock.symbol], strategy)).sort((a, b) => b.score - a.score || b.confidence - a.confidence);
}
