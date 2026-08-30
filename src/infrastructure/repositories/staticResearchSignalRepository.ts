import type { ResearchSignalRepository } from "@/src/application/ports/repositories";
import type { ResearchSignal, ResearchSignalDataset } from "@/src/modules/stock-intelligence/domain/types";
import { parseResearchSignal, parseResearchSignals } from "@/src/shared/contracts/researchSignals";
import { symbolFileSlug } from "@/src/domain/symbolFile";

export class StaticResearchSignalRepository implements ResearchSignalRepository {
  private indexPromise: Promise<ResearchSignalDataset> | null = null;
  private readonly details = new Map<string, Promise<ResearchSignal | null>>();

  constructor(
    private readonly url = "./data/research-signals.json",
    private readonly detailRoot = "./data/signals",
  ) {}

  async load(): Promise<ResearchSignalDataset> {
    this.indexPromise ??= this.fetchIndex();
    return this.indexPromise;
  }

  async loadSymbol(symbol: string): Promise<ResearchSignal | null> {
    const normalized = symbol.trim().toUpperCase();
    const existing = this.details.get(normalized);
    if (existing) return existing;
    const request = this.fetchSymbol(normalized).catch((error) => {
      this.details.delete(normalized);
      throw error;
    });
    this.details.set(normalized, request);
    return request;
  }

  private async fetchIndex(): Promise<ResearchSignalDataset> {
    const response = await fetch(this.url);
    if (!response.ok) throw new Error(`Research signals returned ${response.status}`);
    return parseResearchSignals(await response.json());
  }

  private async fetchSymbol(symbol: string): Promise<ResearchSignal | null> {
    const slug = symbolFileSlug(symbol);
    const response = await fetch(`${this.detailRoot}/${slug}.json`);
    if (response.ok) return parseResearchSignal(await response.json());
    if (response.status !== 404) throw new Error(`${symbol} research signals returned ${response.status}`);
    return (await this.load()).signals[symbol] ?? null;
  }
}
