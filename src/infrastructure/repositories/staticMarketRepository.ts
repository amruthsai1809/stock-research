import type { MarketRepository } from "@/src/application/ports/repositories";
import { symbolFileSlug } from "@/src/domain/symbolFile";
import type { AnalyzedStock, MarketIndex } from "@/src/domain/stock";
import { analyzeStock, summarizeStock } from "@/src/domain/analytics";
import { parseMarketDataset, parseMarketIndex, parseRecentPrices, parseStockArchive } from "@/src/shared/contracts/marketData";

export class StaticMarketRepository implements MarketRepository {
  private indexPromise: Promise<MarketIndex> | null = null;
  private readonly details = new Map<string, Promise<AnalyzedStock>>();

  constructor(
    private readonly indexUrl = "./data/market/index.json",
    private readonly legacyUrl = "./data/market-data.json",
  ) {}

  loadIndex(): Promise<MarketIndex> {
    this.indexPromise ??= this.fetchIndex();
    return this.indexPromise;
  }

  async loadStock(symbol: string): Promise<AnalyzedStock> {
    const normalized = symbol.trim().toUpperCase();
    const existing = this.details.get(normalized);
    if (existing) return existing;

    const request = this.fetchStock(normalized).catch((error) => {
      this.details.delete(normalized);
      throw error;
    });
    this.details.set(normalized, request);
    return request;
  }

  private async fetchIndex(): Promise<MarketIndex> {
    const response = await fetch(this.indexUrl);
    if (response.ok) return parseMarketIndex(await response.json());
    if (response.status !== 404) throw new Error(`Market index returned ${response.status}`);

    // Compatibility for development checkouts created before schema v2. The
    // production data job always emits the split index and per-symbol files.
    const legacyResponse = await fetch(this.legacyUrl);
    if (!legacyResponse.ok) throw new Error(`Market snapshot returned ${legacyResponse.status}`);
    const legacy = parseMarketDataset(await legacyResponse.json());
    const stocks = legacy.stocks.map((stock) => {
      const analyzed = analyzeStock(stock);
      this.details.set(stock.symbol, Promise.resolve(analyzed));
      return summarizeStock(analyzed, { dataPath: dataPath(stock.symbol), recentDataPath: recentDataPath(stock.symbol) });
    }).sort((left, right) => right.dipScore - left.dipScore);
    return {
      schemaVersion: 2,
      generatedAt: legacy.generatedAt,
      priceAsOf: legacy.priceAsOf,
      sources: legacy.sources,
      universe: {
        exchanges: ["Nasdaq", "NYSE", "NYSE American"],
        minimumMarketCap: 1_000_000_000,
        securityTypes: ["common-stock", "adr"],
        historyYears: 10,
        eligibleCount: stocks.length,
        publishedCount: stocks.length,
        scope: "sample",
      },
      stocks,
    };
  }

  private async fetchStock(symbol: string): Promise<AnalyzedStock> {
    const index = await this.loadIndex();
    const summary = index.stocks.find((stock) => stock.symbol === symbol);
    if (!summary) throw new Error(`${symbol} is not present in this market snapshot`);
    // The index and detail files form one immutable logical snapshot. Versioning
    // detail URLs with the index timestamp prevents a browser from combining a
    // newly deployed index with a still-fresh detail response from the prior day.
    const archiveUrl = withSnapshotVersion(summary.dataPath, index.generatedAt);
    const recentUrl = withSnapshotVersion(summary.recentDataPath, index.generatedAt);
    const [archiveResponse, recentResponse] = await Promise.all([fetch(archiveUrl), fetch(recentUrl)]);
    if (!archiveResponse.ok) throw new Error(`${symbol} archive returned ${archiveResponse.status}`);
    if (!recentResponse.ok) throw new Error(`${symbol} recent prices returned ${recentResponse.status}`);
    const archive = parseStockArchive(await archiveResponse.json());
    const recent = parseRecentPrices(await recentResponse.json());
    if (archive.symbol !== symbol || recent.symbol !== symbol) throw new Error(`${symbol} history files failed their identity check`);
    return analyzeStock({ ...archive, prices: [...archive.prices, ...recent.prices] });
  }
}

export function withSnapshotVersion(path: string, generatedAt: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}snapshot=${encodeURIComponent(generatedAt)}`;
}

function dataPath(symbol: string) {
  return `./data/market/stocks/${symbolFileSlug(symbol)}.json`;
}

function recentDataPath(symbol: string) {
  return `./data/market/recent/${symbolFileSlug(symbol)}.json`;
}
