import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeStock, summarizeStock } from "@/src/domain/analytics";
import type { MarketIndex, PricePoint, Stock } from "@/src/domain/stock";
import { StaticMarketRepository, withSnapshotVersion } from "@/src/infrastructure/repositories/staticMarketRepository";

const point = (date: string, close: number): PricePoint => ({
  date,
  open: close,
  high: close,
  low: close,
  close,
  adjustedClose: close,
  volume: 1,
});

const archive: Stock = {
  symbol: "TEST",
  cik: "0000000001",
  name: "Test Company",
  sector: "Technology",
  industry: "Software",
  description: "Cache consistency fixture",
  exchange: "Nasdaq",
  currency: "USD",
  prices: [],
  annuals: [],
};

const recentPrices = [point("2026-08-27", 10), point("2026-08-28", 11)];
const analyzed = analyzeStock({ ...archive, prices: recentPrices });
const generatedAt = "2026-08-30T04:48:47.762Z";
const summary = summarizeStock(analyzed, {
  dataPath: "./data/market/stocks/test.json",
  recentDataPath: "./data/market/recent/test.json",
  marketCap: 1_100_000_000,
});
const index: MarketIndex = {
  schemaVersion: 2,
  generatedAt,
  priceAsOf: "2026-08-28",
  sources: { prices: "Test prices", fundamentals: "Test fundamentals", universe: "Test universe" },
  universe: {
    exchanges: ["Nasdaq"],
    minimumMarketCap: 1_000_000_000,
    securityTypes: ["common-stock"],
    historyYears: 10,
    eligibleCount: 1,
    publishedCount: 1,
    scope: "sample",
  },
  stocks: [summary],
};

afterEach(() => vi.unstubAllGlobals());

describe("static market snapshot consistency", () => {
  it("encodes snapshot versions and preserves existing query parameters", () => {
    expect(withSnapshotVersion("./stock.json", generatedAt)).toBe(
      "./stock.json?snapshot=2026-08-30T04%3A48%3A47.762Z",
    );
    expect(withSnapshotVersion("./stock.json?format=compact", generatedAt)).toBe(
      "./stock.json?format=compact&snapshot=2026-08-30T04%3A48%3A47.762Z",
    );
  });

  it("loads archive and recent prices from the same version as the index", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "./data/market/index.json") return Response.json(index);
      if (url === withSnapshotVersion(summary.dataPath, generatedAt)) return Response.json(archive);
      if (url === withSnapshotVersion(summary.recentDataPath, generatedAt)) {
        return Response.json({ symbol: "TEST", prices: recentPrices });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const stock = await new StaticMarketRepository().loadStock("test");

    expect(stock.symbol).toBe("TEST");
    expect(stock.prices).toEqual(recentPrices);
    expect(fetchMock).toHaveBeenCalledWith(withSnapshotVersion(summary.dataPath, generatedAt));
    expect(fetchMock).toHaveBeenCalledWith(withSnapshotVersion(summary.recentDataPath, generatedAt));
  });
});
