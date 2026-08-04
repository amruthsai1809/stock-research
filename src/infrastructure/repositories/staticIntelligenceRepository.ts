import type { GovernmentRepository, InstitutionalRepository } from "@/src/application/ports/repositories";
import type { GovernmentFiler, GovernmentLeaderboardDataset, GovernmentMeta, GovernmentProfile, GovernmentTrade } from "@/src/domain/government";
import type { InstitutionalIndex, InstitutionalManager } from "@/src/domain/institutional";
import { parseInstitutionalIndex, parseInstitutionalManager } from "@/src/shared/contracts/institutionalData";
import { parseGovernmentIndex, parseGovernmentLeaderboard, parseGovernmentMeta, parseGovernmentProfile, parseGovernmentRecent } from "@/src/shared/contracts/governmentData";

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json() as Promise<T>;
}

export class StaticInstitutionalRepository implements InstitutionalRepository {
  private index: InstitutionalIndex | null = null;
  private readonly managers = new Map<string, InstitutionalManager>();

  async loadIndex() {
    this.index ??= parseInstitutionalIndex(await loadJson<unknown>("./data/institutional/index.json"));
    return this.index;
  }

  async loadManager(id: string) {
    const cached = this.managers.get(id);
    if (cached) return cached;
    const manager = parseInstitutionalManager(await loadJson<unknown>(`./data/institutional/${encodeURIComponent(id)}.json`));
    this.managers.set(id, manager);
    return manager;
  }
}

export class StaticGovernmentRepository implements GovernmentRepository {
  private meta: GovernmentMeta | null = null;
  private index: GovernmentFiler[] | null = null;
  private recent: GovernmentTrade[] | null = null;
  private leaderboard: GovernmentLeaderboardDataset | null = null;
  private readonly profiles = new Map<string, GovernmentProfile>();

  async loadMeta() {
    this.meta ??= parseGovernmentMeta(await loadJson<unknown>("./data/government/meta.json"));
    return this.meta;
  }

  async loadIndex() {
    this.index ??= parseGovernmentIndex(await loadJson<unknown>("./data/government/index.json"));
    return this.index;
  }

  async loadRecent() {
    this.recent ??= parseGovernmentRecent(await loadJson<unknown>("./data/government/recent.json"));
    return this.recent;
  }

  async loadLeaderboard() {
    this.leaderboard ??= parseGovernmentLeaderboard(await loadJson<unknown>("./data/government/leaderboard.json"));
    return this.leaderboard;
  }

  async loadProfile(id: string) {
    const cached = this.profiles.get(id);
    if (cached) return cached;
    const profile = parseGovernmentProfile(await loadJson<unknown>(`./data/government/profiles/${encodeURIComponent(id)}.json`));
    this.profiles.set(id, profile);
    return profile;
  }
}
