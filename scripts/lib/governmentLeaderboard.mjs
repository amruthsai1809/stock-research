const validTicker = (value) => typeof value === "string" && /^[A-Z][A-Z0-9.-]{0,7}$/.test(value.trim().toUpperCase());
const finite = (value) => typeof value === "number" && Number.isFinite(value) ? value : null;
const tradeDate = (trade) => typeof trade.transaction_date === "string" && trade.transaction_date
  ? trade.transaction_date
  : null;

function actionFor(trade) {
  const value = String(trade.transaction_type ?? "").toLowerCase();
  if (value.includes("purchase") || value.includes("buy")) return "purchase";
  if (value.includes("sale") || value.includes("sell")) return "sale";
  if (value.includes("exchange")) return "exchange";
  return "other";
}

function midpoint(trade) {
  const low = finite(trade.amount_range_low) ?? 0;
  const high = finite(trade.amount_range_high);
  return high == null ? low : (low + high) / 2;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function wilsonLowerBound(wins, observations) {
  if (!observations) return null;
  const z = 1.96;
  const proportion = wins / observations;
  const zSquared = z ** 2;
  const lowerBound = (proportion + zSquared / (2 * observations) - z * Math.sqrt((proportion * (1 - proportion) + zSquared / (4 * observations)) / observations)) / (1 + zSquared / observations);
  return Math.min(proportion, Math.max(0, lowerBound)) * 100;
}

function isDerivativeProxy(trade) {
  return /\b(option|call|put|warrant|derivative)\b/i.test(`${trade.asset_name ?? ""} ${trade.comment ?? ""}`);
}

function inferredExposure(trades) {
  const byTicker = new Map();
  for (const trade of trades) {
    const ticker = trade.ticker?.trim().toUpperCase();
    if (!validTicker(ticker)) continue;
    const group = byTicker.get(ticker) ?? [];
    group.push(trade);
    byTicker.set(ticker, group);
  }
  let value = 0;
  let positions = 0;
  for (const group of byTicker.values()) {
    const ordered = group.filter(tradeDate).sort((a, b) => tradeDate(a).localeCompare(tradeDate(b)));
    let episodeValue = 0;
    let hasPurchase = false;
    for (const trade of ordered) {
      const action = actionFor(trade);
      if (action === "sale" && /full/i.test(trade.transaction_type)) {
        episodeValue = 0;
        hasPurchase = false;
      } else if (action === "purchase") {
        episodeValue += midpoint(trade);
        hasPurchase = true;
      } else if (action === "sale" && hasPurchase) {
        episodeValue = Math.max(0, episodeValue - midpoint(trade));
      }
    }
    if (hasPurchase && episodeValue > 0) {
      value += episodeValue;
      positions += 1;
    }
  }
  return { value, positions };
}

export function summarizeGovernmentFiler(filer, trades, { asOf, historyTruncated = false } = {}) {
  const purchases = trades.filter((trade) => tradeDate(trade) && actionFor(trade) === "purchase" && validTicker(trade.ticker) && !isDerivativeProxy(trade));
  const oneYear = purchases.filter((trade) => finite(trade.ret_1y) != null);
  const since = purchases.filter((trade) => finite(trade.ret_since) != null);
  const excess = purchases.filter((trade) => finite(trade.excess_since) != null);
  const exposure = inferredExposure(trades);
  const effectiveAsOf = asOf || filer.latestTransactionDate || "1970-01-01";
  const recentCutoff = new Date(`${effectiveAsOf}T00:00:00Z`);
  recentCutoff.setUTCFullYear(recentCutoff.getUTCFullYear() - 2);
  const recentCutoffValue = recentCutoff.toISOString().slice(0, 10);
  const recentTransactions = trades.filter((trade) => tradeDate(trade) && tradeDate(trade) >= recentCutoffValue).length;
  const oneYearReturns = oneYear.map((trade) => trade.ret_1y);
  const oneYearWins = oneYearReturns.filter((value) => value > 0).length;
  const confidence = historyTruncated || oneYear.length < 5 ? "limited" : oneYear.length >= 20 ? "high" : "medium";
  const best = [...oneYear].sort((a, b) => b.ret_1y - a.ret_1y)[0] ?? null;
  const worst = [...oneYear].sort((a, b) => a.ret_1y - b.ret_1y)[0] ?? null;
  return {
    filerId: filer.id,
    fullName: filer.full_name,
    branch: filer.branch,
    chamber: filer.chamber,
    party: filer.party,
    state: filer.state,
    office: filer.office,
    agency: filer.agency,
    photoUrl: filer.photo_url,
    active: filer.active,
    latestTransactionDate: filer.latestTransactionDate,
    totalTransactions: filer.trade_count,
    recentTransactions,
    disclosedActivity: filer.est_volume,
    estimatedOpenActivity: exposure.value,
    inferredPositions: exposure.positions,
    medianPurchaseReturn1Y: median(oneYearReturns),
    averagePurchaseReturn1Y: oneYearReturns.length ? oneYearReturns.reduce((sum, value) => sum + value, 0) / oneYearReturns.length : null,
    purchaseWinRate1Y: oneYearReturns.length ? (oneYearWins / oneYearReturns.length) * 100 : null,
    reliabilityScore1Y: wilsonLowerBound(oneYearWins, oneYearReturns.length),
    medianReturnSincePurchase: median(since.map((trade) => trade.ret_since)),
    medianExcessSincePurchase: median(excess.map((trade) => trade.excess_since)),
    performanceSample: oneYear.length,
    eligiblePurchases: purchases.length,
    returnCoverage: purchases.length ? (oneYear.length / purchases.length) * 100 : 0,
    confidence,
    historyTruncated,
    bestPurchase: best ? { ticker: best.ticker, transactionDate: tradeDate(best), return1Y: best.ret_1y } : null,
    worstPurchase: worst ? { ticker: worst.ticker, transactionDate: tradeDate(worst), return1Y: worst.ret_1y } : null,
  };
}

export function governmentLeaderboardDataset(entries, { asOf, generatedAt = new Date().toISOString() } = {}) {
  return {
    generatedAt,
    asOf,
    methodology: "Performance uses the median one-year underlying-security return after disclosed non-derivative purchases. Consistency uses the 95% Wilson lower bound of the one-year win rate to penalize small samples. Estimated open activity nets disclosure-range midpoints after explicit purchases and sales; it is not current portfolio value. Rankings require visible sample and confidence labels.",
    entries: entries.sort((a, b) => (b.medianPurchaseReturn1Y ?? -Infinity) - (a.medianPurchaseReturn1Y ?? -Infinity) || b.performanceSample - a.performanceSample),
  };
}
