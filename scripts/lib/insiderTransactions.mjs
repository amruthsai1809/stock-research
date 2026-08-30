const TAX_SALE_PATTERN = /(?:tax(?:es| liability| withholding)?|withholding obligation|sell[- ]to[- ]cover)/i;

const clip = (value, limit = 700) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text || null;
  const shortened = text.slice(0, limit - 1);
  return `${shortened.slice(0, shortened.lastIndexOf(" "))}…`;
};

export const SALE_CATEGORIES = new Set(["sale", "scheduled_sale", "tax_sale"]);
export const COMPENSATION_CATEGORIES = new Set(["award", "option_exercise"]);

export function classifyInsiderTransaction({ code, filingContext, rule10b51 }) {
  const normalizedCode = String(code ?? "").trim().toUpperCase();
  if (normalizedCode === "P") return "personal_investment";
  if (normalizedCode === "S") {
    if (TAX_SALE_PATTERN.test(filingContext ?? "")) return "tax_sale";
    return rule10b51 ? "scheduled_sale" : "sale";
  }
  if (normalizedCode === "A") return "award";
  if (["M", "O", "X"].includes(normalizedCode)) return "option_exercise";
  if (normalizedCode === "F") return "tax_withholding";
  if (normalizedCode === "G") return "gift";
  if (normalizedCode === "C") return "conversion";
  if (normalizedCode === "D") return "issuer_disposition";
  return "other";
}

export function actionForCategory(category) {
  if (category === "personal_investment") return "purchase";
  if (SALE_CATEGORIES.has(category)) return "sale";
  return "other";
}

export function normalizeInsiderTransaction(transaction) {
  const direction = transaction.direction === "disposed" || transaction.direction === "acquired"
    ? transaction.direction
    : transaction.action === "sale" ? "disposed" : "acquired";
  const filingContext = clip(transaction.filingContext);
  const category = transaction.category ?? classifyInsiderTransaction({
    code: transaction.code,
    filingContext,
    rule10b51: transaction.rule10b51,
  });
  return {
    ...transaction,
    code: String(transaction.code ?? "J").trim().toUpperCase() || "J",
    action: actionForCategory(category),
    category,
    direction,
    securityTitle: transaction.securityTitle?.trim() || "Reported security",
    directOrIndirect: transaction.directOrIndirect === "direct" || transaction.directOrIndirect === "indirect" ? transaction.directOrIndirect : null,
    natureOfOwnership: clip(transaction.natureOfOwnership, 180),
    filingContext,
  };
}

export function groupInsiderTransactions(transactions) {
  const groups = new Map();
  for (const raw of transactions) {
    const transaction = normalizeInsiderTransaction(raw);
    const key = [
      transaction.accession,
      transaction.ownerName,
      transaction.transactionDate,
      transaction.code,
      transaction.category,
      transaction.direction,
      transaction.securityTitle,
      transaction.directOrIndirect,
    ].join("|");
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { ...transaction });
      continue;
    }
    const combinedShares = existing.shares + transaction.shares;
    const combinedValue = existing.value == null && transaction.value == null
      ? null
      : (existing.value ?? 0) + (transaction.value ?? 0);
    const owned = [existing.sharesOwnedAfter, transaction.sharesOwnedAfter].filter((value) => value != null);
    const contexts = [...new Set([existing.filingContext, transaction.filingContext].filter(Boolean))];
    groups.set(key, {
      ...existing,
      shares: combinedShares,
      price: combinedValue != null && combinedShares > 0 ? combinedValue / combinedShares : existing.price ?? transaction.price,
      value: combinedValue,
      sharesOwnedAfter: owned.length
        ? transaction.direction === "disposed" ? Math.min(...owned) : Math.max(...owned)
        : null,
      rule10b51: existing.rule10b51 || transaction.rule10b51,
      filingContext: clip(contexts.join(" ")),
    });
  }
  return [...groups.values()].sort((a, b) => (
    b.transactionDate.localeCompare(a.transactionDate)
    || b.filingDate.localeCompare(a.filingDate)
    || a.ownerName.localeCompare(b.ownerName)
  ));
}

export function reconcileInsiderEvidence({ previousRows = [], bulkRows = [], liveRows = [], cutoff }) {
  const freshRows = [...bulkRows, ...liveRows];
  const refreshedAccessions = new Set(freshRows.map((row) => row.accession).filter(Boolean));
  const retainedRows = previousRows.filter((row) => !refreshedAccessions.has(row.accession));
  const unique = new Map();
  for (const raw of [...retainedRows, ...freshRows]) {
    const row = normalizeInsiderTransaction(raw);
    if (cutoff && row.transactionDate < cutoff) continue;
    const normalizedPrice = row.price == null ? "" : row.price.toFixed(2);
    const key = [row.accession, row.ownerName, row.transactionDate, row.code, row.shares, normalizedPrice, row.sharesOwnedAfter].join("|");
    unique.set(key, row);
  }
  return groupInsiderTransactions([...unique.values()]);
}

export function summarizeInsiderTransactions(transactions) {
  const purchases = transactions.filter((item) => item.category === "personal_investment");
  const sales = transactions.filter((item) => SALE_CATEGORIES.has(item.category));
  const scheduledSales = sales.filter((item) => item.category === "scheduled_sale");
  const taxSales = sales.filter((item) => item.category === "tax_sale");
  const compensation = transactions.filter((item) => COMPENSATION_CATEGORIES.has(item.category));
  const administrative = transactions.filter((item) => ![
    "personal_investment",
    "sale",
    "scheduled_sale",
    "tax_sale",
    "award",
    "option_exercise",
  ].includes(item.category));
  return {
    purchaseCount: purchases.length,
    saleCount: sales.length,
    purchaseValue: purchases.reduce((sum, item) => sum + (item.value ?? 0), 0),
    saleValue: sales.reduce((sum, item) => sum + (item.value ?? 0), 0),
    discretionarySaleCount: sales.length - scheduledSales.length - taxSales.length,
    scheduledSaleCount: scheduledSales.length,
    taxRelatedSaleCount: taxSales.length,
    compensationCount: compensation.length,
    administrativeCount: administrative.length,
  };
}
