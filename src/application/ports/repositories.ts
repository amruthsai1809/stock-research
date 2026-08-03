import type { MarketDataset } from "@/src/domain/stock";
import type { InstitutionalIndex, InstitutionalManager } from "@/src/domain/institutional";
import type { GovernmentFiler, GovernmentMeta, GovernmentProfile, GovernmentTrade } from "@/src/domain/government";
import type { BenchmarkDataset } from "@/src/domain/portfolio";
import type { ResearchSignalDataset } from "@/src/modules/stock-intelligence/domain/types";

export interface MarketRepository {
  load(): Promise<MarketDataset>;
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
  loadProfile(id: string): Promise<GovernmentProfile>;
}

export interface ResearchSignalRepository {
  load(): Promise<ResearchSignalDataset>;
}

export interface ApplicationServices {
  marketRepository: MarketRepository;
  benchmarkRepository: BenchmarkRepository;
  institutionalRepository: InstitutionalRepository;
  governmentRepository: GovernmentRepository;
  researchSignalRepository: ResearchSignalRepository;
}
