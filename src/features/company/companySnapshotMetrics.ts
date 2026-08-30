import type { AnalyzedStock } from "@/src/domain/stock";

export type CompanySnapshot = {
  marketCap: number | null;
  marketCapEstimated: boolean;
  priceToEarnings: number | null;
  priceToEarningsReason: string | null;
  freeCashFlowYield: number | null;
  freeCashFlowYieldReason: string | null;
  dividendYield: number | null;
  dividendYieldReason: string | null;
  netCashDebt: number | null;
  netCashDebtReason: string | null;
  operatingMarginChange: number | null;
};

const sameCurrency = (stock: AnalyzedStock) => (stock.reportingCurrency ?? stock.currency) === stock.currency;

function financialBalanceSheetIsNotComparable(stock: AnalyzedStock) {
  return /bank|insurance|financial|capital markets|credit services/i.test(`${stock.sector} ${stock.industry}`);
}

export function calculateCompanySnapshot(stock: AnalyzedStock, suppliedMarketCap: number | null): CompanySnapshot {
  const annual = stock.latestAnnual;
  const previous = stock.previousAnnual;
  const estimatedMarketCap = annual?.shares && annual.shares > 0 ? annual.shares * stock.latestPrice : null;
  const marketCap = suppliedMarketCap && suppliedMarketCap > 0 ? suppliedMarketCap : estimatedMarketCap;
  const currenciesMatch = sameCurrency(stock);
  const previousOperatingMargin = previous?.revenue && previous.operatingIncome != null
    ? (previous.operatingIncome / previous.revenue) * 100
    : null;

  let priceToEarnings: number | null = null;
  let priceToEarningsReason: string | null = null;
  if (!marketCap) priceToEarningsReason = "Market capitalization is unavailable";
  else if (!currenciesMatch) priceToEarningsReason = "Market and reporting currencies differ";
  else if (annual?.netIncome == null) priceToEarningsReason = "Latest annual earnings are unavailable";
  else if (annual.netIncome <= 0) priceToEarningsReason = "Not meaningful with non-positive earnings";
  else priceToEarnings = marketCap / annual.netIncome;

  let freeCashFlowYield: number | null = null;
  let freeCashFlowYieldReason: string | null = null;
  if (!marketCap) freeCashFlowYieldReason = "Market capitalization is unavailable";
  else if (!currenciesMatch) freeCashFlowYieldReason = "Market and reporting currencies differ";
  else if (annual?.freeCashFlow == null) freeCashFlowYieldReason = "Latest annual free cash flow is unavailable";
  else freeCashFlowYield = (annual.freeCashFlow / marketCap) * 100;

  let dividendYield: number | null = null;
  let dividendYieldReason: string | null = null;
  if (!marketCap) dividendYieldReason = "Market capitalization is unavailable";
  else if (!currenciesMatch) dividendYieldReason = "Market and reporting currencies differ";
  else if (annual?.dividends == null || annual.dividends === 0) dividendYieldReason = "No annual cash dividend was reported";
  else dividendYield = (Math.abs(annual.dividends) / marketCap) * 100;

  let netCashDebt: number | null = null;
  let netCashDebtReason: string | null = null;
  if (financialBalanceSheetIsNotComparable(stock)) netCashDebtReason = "Not comparable for banks, insurers, and similar financial institutions";
  else if (annual?.cash == null) netCashDebtReason = "Cash and equivalents are unavailable";
  else if (annual.longTermDebt == null) netCashDebtReason = "Long-term debt was not reported";
  else netCashDebt = annual.cash - annual.longTermDebt;

  return {
    marketCap,
    marketCapEstimated: !suppliedMarketCap && marketCap != null,
    priceToEarnings,
    priceToEarningsReason,
    freeCashFlowYield,
    freeCashFlowYieldReason,
    dividendYield,
    dividendYieldReason,
    netCashDebt,
    netCashDebtReason,
    operatingMarginChange: stock.operatingMargin != null && previousOperatingMargin != null
      ? stock.operatingMargin - previousOperatingMargin
      : null,
  };
}
