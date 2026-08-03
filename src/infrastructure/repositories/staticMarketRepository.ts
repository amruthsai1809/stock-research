import type { MarketDataset } from "@/src/domain/stock";

export interface MarketRepository {
  load(): Promise<MarketDataset>;
}

export class StaticMarketRepository implements MarketRepository {
  constructor(private readonly url = "./data/market-data.json") {}

  async load() {
    const response = await fetch(this.url);
    if (!response.ok) throw new Error(`Market snapshot returned ${response.status}`);
    return response.json() as Promise<MarketDataset>;
  }
}

export const marketRepository = new StaticMarketRepository();
