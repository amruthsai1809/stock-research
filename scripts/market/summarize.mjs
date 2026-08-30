const clamp = (value, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, value));
const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

function percentChange(current, previous) {
  return Number.isFinite(current) && Number.isFinite(previous) && previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : 0;
}

function movingAverage(prices, periods) {
  return average(prices.slice(-periods).map((point) => point.adjustedClose));
}

function pointReturn(prices, lookback) {
  const latest = prices.at(-1)?.adjustedClose ?? 0;
  const previous = prices[Math.max(0, prices.length - 1 - lookback)]?.adjustedClose ?? latest;
  return percentChange(latest, previous);
}

function annualizedVolatility(prices, periods = 63) {
  const values = prices.slice(-(periods + 1));
  const returns = values.slice(1).map((point, index) => Math.log(point.adjustedClose / values[index].adjustedClose));
  if (!returns.length) return 0;
  const mean = average(returns);
  return Math.sqrt(average(returns.map((value) => (value - mean) ** 2))) * Math.sqrt(252) * 100;
}

const ratio = (numerator, denominator) => numerator == null || denominator == null || denominator === 0 ? null : numerator / denominator;

function qualityScore(metrics) {
  return Math.round(average([
    metrics.revenueGrowth == null ? 50 : clamp(50 + metrics.revenueGrowth * 2.2),
    metrics.operatingMargin == null ? 50 : clamp(35 + metrics.operatingMargin * 1.8),
    metrics.freeCashFlowMargin == null ? 50 : clamp(35 + metrics.freeCashFlowMargin * 2.1),
    metrics.cashConversion == null ? 50 : clamp(metrics.cashConversion * 65),
    metrics.liabilityRatio == null ? 50 : clamp(105 - metrics.liabilityRatio * 100),
    metrics.shareChange == null ? 50 : clamp(55 - metrics.shareChange * 4),
  ]));
}

function classify(drawdown, distanceFrom200Day, quality, oneMonthReturn) {
  if (quality < 42 && drawdown < -18) return "Potential value trap";
  if (distanceFrom200Day < -12 && oneMonthReturn < -7) return "Trend fracture";
  if (drawdown < -28) return "Deep correction";
  if (quality >= 68 && drawdown < -12) return "Quality pullback";
  if (oneMonthReturn > 3 && drawdown < -10) return "Early recovery";
  return "Routine reset";
}

function why(metrics) {
  const reasons = [
    `${Math.abs(metrics.drawdown).toFixed(1)}% below its 52-week high`,
    metrics.distanceFrom200Day < 0
      ? `${Math.abs(metrics.distanceFrom200Day).toFixed(1)}% below the 200-day trend`
      : `${metrics.distanceFrom200Day.toFixed(1)}% above the 200-day trend`,
  ];
  if (metrics.revenueGrowth != null) reasons.push(`revenue ${metrics.revenueGrowth >= 0 ? "grew" : "contracted"} ${Math.abs(metrics.revenueGrowth).toFixed(1)}%`);
  if (metrics.freeCashFlowMargin != null) reasons.push(`${metrics.freeCashFlowMargin.toFixed(1)}% free-cash-flow margin`);
  if (metrics.shareChange != null && Math.abs(metrics.shareChange) >= 0.5) reasons.push(`${Math.abs(metrics.shareChange).toFixed(1)}% ${metrics.shareChange > 0 ? "share dilution" : "share reduction"}`);
  reasons.push(`${metrics.quality}/100 fundamental quality`);
  return reasons.slice(0, 5);
}

export function summarizeStock(stock, { dataPath, recentDataPath, marketCap, securityType }) {
  const latestPrice = stock.prices.at(-1)?.adjustedClose ?? 0;
  const previousPrice = stock.prices.at(-2)?.adjustedClose ?? latestPrice;
  const trailingYear = stock.prices.slice(-252);
  const high52Week = Math.max(...trailingYear.map((point) => point.adjustedClose), latestPrice);
  const drawdown52Week = percentChange(latestPrice, high52Week);
  const sma50 = movingAverage(stock.prices, 50);
  const sma200 = movingAverage(stock.prices, 200);
  const distanceFrom200Day = percentChange(latestPrice, sma200 || latestPrice);
  const completeAnnuals = stock.annuals.filter((annual) => annual.revenue != null || annual.netIncome != null);
  const latestAnnual = completeAnnuals.at(-1) ?? null;
  const previousAnnual = completeAnnuals.at(-2) ?? null;
  const revenueGrowth = latestAnnual?.revenue != null && previousAnnual?.revenue != null ? percentChange(latestAnnual.revenue, previousAnnual.revenue) : null;
  const operatingMargin = ratio(latestAnnual?.operatingIncome ?? null, latestAnnual?.revenue ?? null);
  const freeCashFlowMargin = ratio(latestAnnual?.freeCashFlow ?? null, latestAnnual?.revenue ?? null);
  const cashConversion = ratio(latestAnnual?.operatingCashFlow ?? null, latestAnnual?.netIncome ?? null);
  const liabilityRatio = ratio(latestAnnual?.liabilities ?? null, latestAnnual?.assets ?? null);
  const shareChange = latestAnnual?.shares != null && previousAnnual?.shares != null ? percentChange(latestAnnual.shares, previousAnnual.shares) : null;
  const quality = qualityScore({
    revenueGrowth,
    operatingMargin: operatingMargin == null ? null : operatingMargin * 100,
    freeCashFlowMargin: freeCashFlowMargin == null ? null : freeCashFlowMargin * 100,
    cashConversion,
    liabilityRatio,
    shareChange,
  });
  const oneMonthReturn = pointReturn(stock.prices, 21);
  const painScore = clamp(Math.abs(drawdown52Week) * 1.8 + Math.max(0, -oneMonthReturn) * 1.2 + Math.max(0, -distanceFrom200Day));
  const { prices, annuals: _annuals, ...identity } = stock;
  void _annuals;
  return {
    ...identity,
    latestPrice,
    previousPrice,
    dailyReturn: percentChange(latestPrice, previousPrice),
    oneMonthReturn,
    threeMonthReturn: pointReturn(prices, 63),
    oneYearReturn: pointReturn(prices, 252),
    high52Week,
    drawdown52Week,
    sma50,
    sma200,
    distanceFrom200Day,
    volatility: annualizedVolatility(prices),
    qualityScore: quality,
    dipScore: Math.round(clamp(painScore * 0.62 + quality * 0.38)),
    valuationScore: Math.round(clamp(48 + Math.abs(drawdown52Week) * 0.8 + (freeCashFlowMargin ?? 0) * 35)),
    classification: classify(drawdown52Week, distanceFrom200Day, quality, oneMonthReturn),
    latestAnnual,
    previousAnnual,
    revenueGrowth,
    operatingMargin: operatingMargin == null ? null : operatingMargin * 100,
    freeCashFlowMargin: freeCashFlowMargin == null ? null : freeCashFlowMargin * 100,
    cashConversion,
    liabilityRatio,
    shareChange,
    why: why({ drawdown: drawdown52Week, distanceFrom200Day, revenueGrowth, freeCashFlowMargin: freeCashFlowMargin == null ? null : freeCashFlowMargin * 100, shareChange, quality }),
    dataPath,
    recentDataPath,
    priceAsOf: prices.at(-1).date,
    historyStart: prices[0].date,
    historySessions: prices.length,
    marketCap,
    securityType,
  };
}
