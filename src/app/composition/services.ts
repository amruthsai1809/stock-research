import type { ApplicationServices } from "@/src/application/ports/repositories";
import { StaticBenchmarkRepository } from "@/src/infrastructure/repositories/staticBenchmarkRepository";
import { StaticGovernmentRepository, StaticInstitutionalRepository } from "@/src/infrastructure/repositories/staticIntelligenceRepository";
import { StaticMarketRepository } from "@/src/infrastructure/repositories/staticMarketRepository";
import { StaticResearchSignalRepository } from "@/src/infrastructure/repositories/staticResearchSignalRepository";

export const appServices: ApplicationServices = Object.freeze({
  marketRepository: new StaticMarketRepository(),
  benchmarkRepository: new StaticBenchmarkRepository(),
  institutionalRepository: new StaticInstitutionalRepository(),
  governmentRepository: new StaticGovernmentRepository(),
  researchSignalRepository: new StaticResearchSignalRepository(),
});
