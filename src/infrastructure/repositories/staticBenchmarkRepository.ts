import type { BenchmarkRepository } from "@/src/application/ports/repositories";
import type { BenchmarkDataset } from "@/src/domain/portfolio";

export class StaticBenchmarkRepository implements BenchmarkRepository {
  constructor(private readonly url = "./data/benchmark-data.json") {}

  async load(): Promise<BenchmarkDataset> {
    const response = await fetch(this.url);
    if (!response.ok) throw new Error(`Benchmark snapshot returned ${response.status}`);
    const input: unknown = await response.json();
    if (!input || typeof input !== "object" || !("benchmarks" in input) || !Array.isArray(input.benchmarks)) {
      throw new Error("Benchmark snapshot failed its runtime contract");
    }
    return input as BenchmarkDataset;
  }
}
