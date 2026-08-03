import type { MarketRepository } from "@/src/application/ports/repositories";
import { parseMarketDataset } from "@/src/shared/contracts/marketData";

export class StaticMarketRepository implements MarketRepository {
  constructor(private readonly url = "./data/market-data.json") {}

  async load() {
    const response = await fetch(this.url);
    if (!response.ok) throw new Error(`Market snapshot returned ${response.status}`);
    return parseMarketDataset(await response.json());
  }
}
