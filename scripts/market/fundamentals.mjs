const annualForms = new Set(["10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A"]);

const conceptAliases = {
  revenue: [
    ["us-gaap", "RevenueFromContractWithCustomerExcludingAssessedTax"],
    ["us-gaap", "Revenues"],
    ["us-gaap", "SalesRevenueNet"],
    ["ifrs-full", "Revenue"],
  ],
  grossProfit: [["us-gaap", "GrossProfit"], ["ifrs-full", "GrossProfit"]],
  operatingIncome: [
    ["us-gaap", "OperatingIncomeLoss"],
    ["ifrs-full", "ProfitLossFromOperatingActivities"],
  ],
  netIncome: [
    ["us-gaap", "NetIncomeLoss"],
    ["us-gaap", "ProfitLoss"],
    ["ifrs-full", "ProfitLoss"],
    ["ifrs-full", "ProfitLossAttributableToOwnersOfParent"],
  ],
  operatingCashFlow: [
    ["us-gaap", "NetCashProvidedByUsedInOperatingActivities"],
    ["ifrs-full", "CashFlowsFromUsedInOperatingActivities"],
  ],
  capex: [
    ["us-gaap", "PaymentsToAcquirePropertyPlantAndEquipment"],
    ["us-gaap", "PaymentsForPropertyPlantAndEquipment"],
    ["ifrs-full", "PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities"],
  ],
  assets: [["us-gaap", "Assets"], ["ifrs-full", "Assets"]],
  liabilities: [["us-gaap", "Liabilities"], ["ifrs-full", "Liabilities"]],
  equity: [
    ["us-gaap", "StockholdersEquity"],
    ["us-gaap", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
    ["ifrs-full", "EquityAttributableToOwnersOfParent"],
    ["ifrs-full", "Equity"],
  ],
  cash: [
    ["us-gaap", "CashAndCashEquivalentsAtCarryingValue"],
    ["us-gaap", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],
    ["ifrs-full", "CashAndCashEquivalents"],
  ],
  longTermDebt: [
    ["us-gaap", "LongTermDebtAndFinanceLeaseObligations"],
    ["us-gaap", "LongTermDebt"],
    ["us-gaap", "LongTermDebtNoncurrent"],
    ["us-gaap", "LongTermDebtAndFinanceLeaseObligationsCurrent"],
    ["us-gaap", "LongTermDebtCurrent"],
    ["ifrs-full", "NoncurrentBorrowings"],
    ["ifrs-full", "LongtermBorrowings"],
  ],
  shares: [
    ["dei", "EntityCommonStockSharesOutstanding"],
    ["us-gaap", "CommonStockSharesOutstanding"],
    ["ifrs-full", "NumberOfSharesOutstanding"],
  ],
  dilutedEps: [
    ["us-gaap", "EarningsPerShareDiluted"],
    ["us-gaap", "EarningsPerShareDilutedIncludingExtraordinaryItems"],
    ["ifrs-full", "DilutedEarningsLossPerShare"],
  ],
  depreciationAndAmortization: [
    ["us-gaap", "DepreciationDepletionAndAmortization"],
    ["us-gaap", "DepreciationDepletionAndAmortizationPropertyPlantAndEquipment"],
    ["us-gaap", "DepreciationAmortizationAndAccretionNet"],
    ["us-gaap", "Depreciation"],
    ["ifrs-full", "AdjustmentsForDepreciationExpense"],
    ["ifrs-full", "AdjustmentsForAmortisationExpense"],
  ],
  researchAndDevelopment: [
    ["us-gaap", "ResearchAndDevelopmentExpense"],
    ["us-gaap", "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost"],
    ["ifrs-full", "ResearchAndDevelopmentExpense"],
  ],
  stockCompensation: [
    ["us-gaap", "ShareBasedCompensation"],
    ["us-gaap", "AllocatedShareBasedCompensationExpense"],
    ["ifrs-full", "ExpenseFromSharebasedPaymentTransactionsWithEmployees"],
    ["ifrs-full", "AdjustmentsForSharebasedPayments"],
  ],
  buybacks: [
    ["us-gaap", "PaymentsForRepurchaseOfCommonStock"],
    ["ifrs-full", "PaymentsToAcquireOrRedeemEntitysShares"],
  ],
  dividends: [
    ["us-gaap", "PaymentsOfDividends"],
    ["us-gaap", "PaymentsOfDividendsCommonStock"],
    ["ifrs-full", "DividendsPaid"],
    ["ifrs-full", "DividendsPaidOrdinaryShares"],
  ],
};

const seriesKinds = {
  revenue: "money",
  grossProfit: "money",
  operatingIncome: "money",
  netIncome: "money",
  operatingCashFlow: "money",
  capex: "money",
  assets: "money",
  liabilities: "money",
  equity: "money",
  cash: "money",
  longTermDebt: "money",
  shares: "shares",
  dilutedEps: "per-share",
  depreciationAndAmortization: "money",
  researchAndDevelopment: "money",
  stockCompensation: "money",
  buybacks: "money",
  dividends: "money",
};

const instantMetrics = new Set(["assets", "liabilities", "equity", "cash", "longTermDebt", "shares"]);

export function extractAnnualFundamentals(facts) {
  const firstPass = buildSeries(facts);
  const reportingCurrency = inferReportingCurrency(firstPass);
  const series = reportingCurrency ? buildSeries(facts, reportingCurrency) : firstPass;
  const anchors = series.revenue.length
    ? series.revenue
    : series.netIncome.length
      ? series.netIncome
      : series.operatingCashFlow;
  const years = [...new Set(anchors.map((entry) => entry.year))].sort().slice(-10);
  const valueFor = (metric, year) => series[metric].find((entry) => entry.year === year)?.value ?? null;
  const conceptFor = (metric, year) => series[metric].find((entry) => entry.year === year)?.concept ?? null;
  const sourceFor = (year) =>
    series.revenue.find((entry) => entry.year === year)
    || series.netIncome.find((entry) => entry.year === year)
    || series.operatingCashFlow.find((entry) => entry.year === year);
  const instantValueFor = (metric, sourceEnd, year) => {
    const exact = series[metric].find((entry) => entry.year === year && entry.end === sourceEnd);
    if (exact) return exact.value;
    const target = Date.parse(sourceEnd);
    const nearest = [...series[metric]]
      .map((entry) => ({ entry, distance: Math.abs(Date.parse(entry.end) - target) }))
      .filter((candidate) => candidate.distance <= 120 * 86_400_000)
      .sort((left, right) => left.distance - right.distance)[0];
    return nearest?.entry.value ?? null;
  };

  const annuals = years.map((year) => {
    const operatingCashFlow = valueFor("operatingCashFlow", year);
    const capex = valueFor("capex", year);
    const source = sourceFor(year);
    const sourceEnd = source?.end || `${year}-12-31`;
    const operatingIncome = valueFor("operatingIncome", year);
    const depreciationAndAmortization = valueFor("depreciationAndAmortization", year);
    return {
      year,
      end: sourceEnd,
      filed: source?.filed || null,
      accession: source?.accession || null,
      revenue: valueFor("revenue", year),
      grossProfit: valueFor("grossProfit", year),
      operatingIncome,
      netIncome: valueFor("netIncome", year),
      operatingCashFlow,
      capex,
      freeCashFlow: operatingCashFlow == null || capex == null ? null : operatingCashFlow - Math.abs(capex),
      assets: instantValueFor("assets", sourceEnd, year),
      liabilities: instantValueFor("liabilities", sourceEnd, year),
      equity: instantValueFor("equity", sourceEnd, year),
      cash: instantValueFor("cash", sourceEnd, year),
      longTermDebt: instantValueFor("longTermDebt", sourceEnd, year),
      shares: instantValueFor("shares", sourceEnd, year),
      dilutedEps: valueFor("dilutedEps", year),
      depreciationAndAmortization,
      ebitda: operatingIncome == null || depreciationAndAmortization == null
        ? null
        : operatingIncome + Math.abs(depreciationAndAmortization),
      researchAndDevelopment: valueFor("researchAndDevelopment", year),
      stockCompensation: valueFor("stockCompensation", year),
      buybacks: valueFor("buybacks", year),
      dividends: valueFor("dividends", year),
      fiscalYearEndPrice: null,
      priceToEarnings: null,
      sourceConcepts: Object.fromEntries(
        Object.keys(series).map((metric) => [metric, conceptFor(metric, year)]).filter(([, concept]) => concept),
      ),
    };
  });

  return {
    annuals,
    reportingCurrency,
    fundamentalsTaxonomy: anchors.at(-1)?.namespace ?? null,
  };
}

function buildSeries(facts, preferredCurrency) {
  return Object.fromEntries(Object.keys(conceptAliases).map((metric) => [
    metric,
    instantMetrics.has(metric)
      ? instantSeries(facts, conceptAliases[metric], seriesKinds[metric], preferredCurrency)
      : annualSeries(facts, conceptAliases[metric], seriesKinds[metric], preferredCurrency),
  ]));
}

function annualSeries(facts, aliases, unitKind, preferredCurrency) {
  return normalizedSeries(facts, aliases, unitKind, preferredCurrency, (entry) => {
    if (!annualForms.has(entry.form) || !entry.start || !entry.end) return false;
    const days = (Date.parse(entry.end) - Date.parse(entry.start)) / 86_400_000;
    return days >= 300 && days <= 430;
  });
}

function instantSeries(facts, aliases, unitKind, preferredCurrency) {
  return normalizedSeries(
    facts,
    aliases,
    unitKind,
    preferredCurrency,
    (entry) => annualForms.has(entry.form) && Boolean(entry.end),
  );
}

function normalizedSeries(facts, aliases, unitKind, preferredCurrency, predicate) {
  const selected = selectConcept(facts, aliases, unitKind, preferredCurrency, predicate);
  const entries = [...selected.entries].sort((left, right) => left.end.localeCompare(right.end) || left.filed.localeCompare(right.filed));
  const byPeriod = new Map();
  for (const entry of entries) byPeriod.set(entry.end, entry);
  return [...byPeriod.values()].slice(-10).map((entry) => ({
    year: Number(entry.end.slice(0, 4)),
    end: entry.end,
    filed: entry.filed,
    value: entry.val,
    accession: entry.accn,
    form: entry.form,
    unit: selected.unit,
    namespace: selected.namespace,
    concept: selected.namespace && selected.alias ? `${selected.namespace}:${selected.alias}` : null,
  }));
}

function selectConcept(facts, aliases, unitKind, preferredCurrency, predicate) {
  let best = { namespace: null, alias: null, unit: null, entries: [] };
  for (const [namespace, alias] of aliases) {
    const concept = facts?.[namespace]?.[alias];
    const selectedUnit = selectUnit(concept, unitKind, preferredCurrency, predicate);
    const latest = selectedUnit.entries.at(-1)?.end || "";
    const bestLatest = best.entries.at(-1)?.end || "";
    if (latest > bestLatest || (latest === bestLatest && selectedUnit.entries.length > best.entries.length)) {
      best = { namespace, alias, ...selectedUnit };
    }
  }
  return best;
}

function selectUnit(concept, unitKind, preferredCurrency, predicate) {
  if (!concept?.units) return { unit: null, entries: [] };
  const candidates = Object.entries(concept.units).flatMap(([unit, values]) => {
    if (!matchesUnitKind(unit, unitKind)) return [];
    const entries = values.filter(predicate).sort((left, right) => (left.end || "").localeCompare(right.end || ""));
    return entries.length ? [{ unit, entries }] : [];
  });
  candidates.sort((left, right) => {
    const leftPreferred = unitUsesCurrency(left.unit, preferredCurrency) ? 1 : 0;
    const rightPreferred = unitUsesCurrency(right.unit, preferredCurrency) ? 1 : 0;
    const latest = (right.entries.at(-1)?.end || "").localeCompare(left.entries.at(-1)?.end || "");
    return latest || rightPreferred - leftPreferred || right.entries.length - left.entries.length;
  });
  return candidates[0] ?? { unit: null, entries: [] };
}

function matchesUnitKind(unit, kind) {
  if (kind === "shares") return unit === "shares";
  if (kind === "per-share") return /^[A-Z]{3}\/shares$/.test(unit);
  return /^[A-Z]{3}$/.test(unit);
}

function unitUsesCurrency(unit, currency) {
  return Boolean(currency) && (unit === currency || unit === `${currency}/shares`);
}

function inferReportingCurrency(series) {
  for (const metric of ["revenue", "netIncome", "operatingCashFlow", "assets"]) {
    const unit = series[metric].at(-1)?.unit;
    const match = unit?.match(/^([A-Z]{3})(?:\/shares)?$/);
    if (match) return match[1];
  }
  return null;
}
