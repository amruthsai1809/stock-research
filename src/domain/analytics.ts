import type {
  AnalyzedStock,
  AnnualFinancials,
  DipClassification,
  PricePoint,
  Stock,
} from "./stock";

const clamp = (value: number, minimum = 0, maximum = 100) =>
  Math.min(maximum, Math.max(minimum, value));

export function percentChange(current: number, previous: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function nullableRatio(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return numerator / denominator;
}

function average(values: number[]): number {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

export function movingAverage(prices: PricePoint[], periods: number): number {
  return average(prices.slice(-periods).map((point) => point.adjustedClose));
}

export function annualizedVolatility(prices: PricePoint[], periods = 63): number {
  const values = prices.slice(-(periods + 1));
  const returns = values.slice(1).map((point, index) =>
    Math.log(point.adjustedClose / values[index].adjustedClose),
  );
  if (!returns.length) return 0;
  const mean = average(returns);
  const variance = average(returns.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function pointReturn(prices: PricePoint[], lookback: number): number {
  const latest = prices.at(-1)?.adjustedClose ?? 0;
  const prior = prices[Math.max(0, prices.length - 1 - lookback)]?.adjustedClose ?? latest;
  return percentChange(latest, prior);
}

function latestCompleteAnnuals(stock: Stock): [AnnualFinancials | null, AnnualFinancials | null] {
  const complete = stock.annuals.filter((annual) => annual.revenue != null || annual.netIncome != null);
  return [complete.at(-1) ?? null, complete.at(-2) ?? null];
}

function scoreQuality(input: {
  revenueGrowth: number | null;
  operatingMargin: number | null;
  freeCashFlowMargin: number | null;
  cashConversion: number | null;
  liabilityRatio: number | null;
  shareChange: number | null;
}): number {
  const components = [
    input.revenueGrowth == null ? 50 : clamp(50 + input.revenueGrowth * 2.2),
    input.operatingMargin == null ? 50 : clamp(35 + input.operatingMargin * 1.8),
    input.freeCashFlowMargin == null ? 50 : clamp(35 + input.freeCashFlowMargin * 2.1),
    input.cashConversion == null ? 50 : clamp(input.cashConversion * 65),
    input.liabilityRatio == null ? 50 : clamp(105 - input.liabilityRatio * 100),
    input.shareChange == null ? 50 : clamp(55 - input.shareChange * 4),
  ];
  return Math.round(average(components));
}

function classify(
  drawdown: number,
  distanceFrom200Day: number,
  quality: number,
  oneMonthReturn: number,
): DipClassification {
  if (quality < 42 && drawdown < -18) return "Potential value trap";
  if (distanceFrom200Day < -12 && oneMonthReturn < -7) return "Trend fracture";
  if (drawdown < -28) return "Deep correction";
  if (quality >= 68 && drawdown < -12) return "Quality pullback";
  if (oneMonthReturn > 3 && drawdown < -10) return "Early recovery";
  return "Routine reset";
}

function buildWhy(input: {
  drawdown: number;
  oneMonthReturn: number;
  distanceFrom200Day: number;
  revenueGrowth: number | null;
  freeCashFlowMargin: number | null;
  shareChange: number | null;
  quality: number;
}): string[] {
  const reasons: string[] = [];
  reasons.push(`${Math.abs(input.drawdown).toFixed(1)}% below its 52-week high`);
  reasons.push(
    input.distanceFrom200Day < 0
      ? `${Math.abs(input.distanceFrom200Day).toFixed(1)}% below the 200-day trend`
      : `${input.distanceFrom200Day.toFixed(1)}% above the 200-day trend`,
  );
  if (input.revenueGrowth != null) {
    reasons.push(`revenue ${input.revenueGrowth >= 0 ? "grew" : "contracted"} ${Math.abs(input.revenueGrowth).toFixed(1)}%`);
  }
  if (input.freeCashFlowMargin != null) {
    reasons.push(`${input.freeCashFlowMargin.toFixed(1)}% free-cash-flow margin`);
  }
  if (input.shareChange != null && Math.abs(input.shareChange) >= 0.5) {
    reasons.push(`${Math.abs(input.shareChange).toFixed(1)}% ${input.shareChange > 0 ? "share dilution" : "share reduction"}`);
  }
  reasons.push(`${input.quality}/100 fundamental quality`);
  return reasons.slice(0, 5);
}

export function analyzeStock(stock: Stock): AnalyzedStock {
  const latestPrice = stock.prices.at(-1)?.adjustedClose ?? 0;
  const previousPrice = stock.prices.at(-2)?.adjustedClose ?? latestPrice;
  const trailingYear = stock.prices.slice(-252);
  const high52Week = Math.max(...trailingYear.map((point) => point.adjustedClose), latestPrice);
  const drawdown52Week = percentChange(latestPrice, high52Week);
  const sma50 = movingAverage(stock.prices, 50);
  const sma200 = movingAverage(stock.prices, 200);
  const distanceFrom200Day = percentChange(latestPrice, sma200 || latestPrice);
  const [latestAnnual, previousAnnual] = latestCompleteAnnuals(stock);
  const revenueGrowth =
    latestAnnual?.revenue != null && previousAnnual?.revenue != null
      ? percentChange(latestAnnual.revenue, previousAnnual.revenue)
      : null;
  const operatingMargin = nullableRatio(latestAnnual?.operatingIncome ?? null, latestAnnual?.revenue ?? null);
  const freeCashFlowMargin = nullableRatio(latestAnnual?.freeCashFlow ?? null, latestAnnual?.revenue ?? null);
  const cashConversion = nullableRatio(latestAnnual?.operatingCashFlow ?? null, latestAnnual?.netIncome ?? null);
  const liabilityRatio = nullableRatio(latestAnnual?.liabilities ?? null, latestAnnual?.assets ?? null);
  const shareChange =
    latestAnnual?.shares != null && previousAnnual?.shares != null
      ? percentChange(latestAnnual.shares, previousAnnual.shares)
      : null;
  const qualityScore = scoreQuality({
    revenueGrowth,
    operatingMargin: operatingMargin == null ? null : operatingMargin * 100,
    freeCashFlowMargin: freeCashFlowMargin == null ? null : freeCashFlowMargin * 100,
    cashConversion,
    liabilityRatio,
    shareChange,
  });
  const painScore = clamp(Math.abs(drawdown52Week) * 1.8 + Math.max(0, -pointReturn(stock.prices, 21)) * 1.2 + Math.max(0, -distanceFrom200Day));
  const dipScore = Math.round(clamp(painScore * 0.62 + qualityScore * 0.38));
  const valuationScore = Math.round(clamp(48 + Math.abs(drawdown52Week) * 0.8 + (freeCashFlowMargin ?? 0) * 35));
  const oneMonthReturn = pointReturn(stock.prices, 21);
  const classification = classify(drawdown52Week, distanceFrom200Day, qualityScore, oneMonthReturn);
  const why = buildWhy({
    drawdown: drawdown52Week,
    oneMonthReturn,
    distanceFrom200Day,
    revenueGrowth,
    freeCashFlowMargin: freeCashFlowMargin == null ? null : freeCashFlowMargin * 100,
    shareChange,
    quality: qualityScore,
  });

  return {
    ...stock,
    latestPrice,
    previousPrice,
    dailyReturn: percentChange(latestPrice, previousPrice),
    oneMonthReturn,
    threeMonthReturn: pointReturn(stock.prices, 63),
    oneYearReturn: pointReturn(stock.prices, 252),
    high52Week,
    drawdown52Week,
    sma50,
    sma200,
    distanceFrom200Day,
    volatility: annualizedVolatility(stock.prices),
    qualityScore,
    dipScore,
    valuationScore,
    classification,
    latestAnnual,
    previousAnnual,
    revenueGrowth,
    operatingMargin: operatingMargin == null ? null : operatingMargin * 100,
    freeCashFlowMargin: freeCashFlowMargin == null ? null : freeCashFlowMargin * 100,
    cashConversion,
    liabilityRatio,
    shareChange,
    why,
  };
}

export function analyzeUniverse(stocks: Stock[]): AnalyzedStock[] {
  return stocks.map(analyzeStock).sort((a, b) => b.dipScore - a.dipScore);
}

export function formatCompactCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}
