import type { AnalyzedStock, MarketIndex } from "@/src/domain/stock";
import type { InstitutionalIndex, InstitutionalManager } from "@/src/domain/institutional";
import type { GovernmentFiler, GovernmentLeaderboardDataset, GovernmentMeta, GovernmentProfile, GovernmentTrade } from "@/src/domain/government";
import type { BenchmarkDataset } from "@/src/domain/portfolio";
import type { ResearchSignal, ResearchSignalDataset } from "@/src/modules/stock-intelligence/domain/types";

export interface MarketRepository {
  loadIndex(): Promise<MarketIndex>;
  loadStock(symbol: string): Promise<AnalyzedStock>;
}

export interface BenchmarkRepository {
  load(): Promise<BenchmarkDataset>;
}

export interface InstitutionalRepository {
  loadIndex(): Promise<InstitutionalIndex>;
  loadManager(id: string): Promise<InstitutionalManager>;
}

export interface GovernmentRepository {
  loadMeta(): Promise<GovernmentMeta>;
  loadIndex(): Promise<GovernmentFiler[]>;
  loadRecent(): Promise<GovernmentTrade[]>;
  loadLeaderboard(): Promise<GovernmentLeaderboardDataset>;
  loadProfile(id: string): Promise<GovernmentProfile>;
}

export interface ResearchSignalRepository {
  load(): Promise<ResearchSignalDataset>;
  loadSymbol(symbol: string): Promise<ResearchSignal | null>;
}

export interface ApplicationServices {
  marketRepository: MarketRepository;
  benchmarkRepository: BenchmarkRepository;
  institutionalRepository: InstitutionalRepository;
  governmentRepository: GovernmentRepository;
  researchSignalRepository: ResearchSignalRepository;
}
