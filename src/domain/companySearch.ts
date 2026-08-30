export type CompanySearchRecord = {
  symbol: string;
  name: string;
  sector?: string;
  industry?: string;
};

/**
 * Ranks a local company universe by intent instead of dataset order. Exact
 * ticker matches win, followed by ticker/name prefixes, token matches, and a
 * deliberately narrow typo tolerance for longer queries.
 */
export function searchCompanies<T extends CompanySearchRecord>(companies: T[], rawQuery: string, limit = 8): T[] {
  const query = normalizeSearchText(rawQuery);
  if (!query) return companies.slice(0, limit);

  return companies
    .map((company, index) => ({ company, index, score: companyMatchScore(company, query) }))
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .slice(0, limit)
    .map(({ company }) => company);
}

function companyMatchScore(company: CompanySearchRecord, query: string): number {
  const symbol = normalizeSearchText(company.symbol);
  const name = normalizeSearchText(company.name);
  const sector = normalizeSearchText(company.sector ?? "");
  const industry = normalizeSearchText(company.industry ?? "");
  const searchable = `${symbol} ${name} ${sector} ${industry}`;
  const words = `${symbol} ${name}`.split(" ").filter(Boolean);
  const tokens = query.split(" ").filter(Boolean);

  if (symbol === query) return 0;
  if (name === query) return 1;
  if (symbol.startsWith(query)) return 5;
  if (name.startsWith(query)) return 10;
  if (tokens.every((token) => words.some((word) => word.startsWith(token)))) return 15;
  if (name.includes(query)) return 20;
  if (tokens.every((token) => searchable.includes(token))) return 30;

  const compactQuery = query.replaceAll(" ", "");
  if (`${symbol}${name.replaceAll(" ", "")}`.includes(compactQuery)) return 35;

  if (compactQuery.length >= 4) {
    const tolerance = compactQuery.length >= 7 ? 2 : 1;
    const closest = Math.min(...words.map((word) => editDistance(compactQuery, word)));
    if (closest <= tolerance) return 45 + closest;
  }

  return Number.POSITIVE_INFINITY;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}
