import type { ResearchSignalRepository } from "@/src/application/ports/repositories";
import type { StockSummary } from "@/src/domain/stock";
import { scoreIntelligenceUniverse } from "../domain/scoring";
import type { IntelligenceStrategyId } from "../domain/types";

export async function loadStockIntelligence(repository: ResearchSignalRepository, stocks: StockSummary[], strategy: IntelligenceStrategyId) {
  const dataset = await repository.load();
  return { dataset, scores: scoreIntelligenceUniverse(stocks, dataset.signals, strategy) };
}
