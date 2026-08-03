import type { ResearchSignalRepository } from "@/src/application/ports/repositories";
import type { ResearchSignalDataset } from "@/src/modules/stock-intelligence/domain/types";
import { parseResearchSignals } from "@/src/shared/contracts/researchSignals";

export class StaticResearchSignalRepository implements ResearchSignalRepository {
  constructor(private readonly url = "./data/research-signals.json") {}

  async load(): Promise<ResearchSignalDataset> {
    const response = await fetch(this.url);
    if (!response.ok) throw new Error(`Research signals returned ${response.status}`);
    return parseResearchSignals(await response.json());
  }
}
