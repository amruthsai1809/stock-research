import type { InstitutionalIndex, InstitutionalManager } from "@/src/domain/institutional";
import type { GovernmentFiler, GovernmentMeta, GovernmentProfile, GovernmentTrade } from "@/src/domain/government";

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json() as Promise<T>;
}

export interface InstitutionalRepository {
  loadIndex(): Promise<InstitutionalIndex>;
  loadManager(id: string): Promise<InstitutionalManager>;
}

export class StaticInstitutionalRepository implements InstitutionalRepository {
  private index: InstitutionalIndex | null = null;
  private readonly managers = new Map<string, InstitutionalManager>();

  async loadIndex() {
    this.index ??= await loadJson<InstitutionalIndex>("./data/institutional/index.json");
    return this.index;
  }

  async loadManager(id: string) {
    const cached = this.managers.get(id);
    if (cached) return cached;
    const manager = await loadJson<InstitutionalManager>(`./data/institutional/${encodeURIComponent(id)}.json`);
    this.managers.set(id, manager);
    return manager;
  }
}

export interface GovernmentRepository {
  loadMeta(): Promise<GovernmentMeta>;
  loadIndex(): Promise<GovernmentFiler[]>;
  loadRecent(): Promise<GovernmentTrade[]>;
  loadProfile(id: string): Promise<GovernmentProfile>;
}

export class StaticGovernmentRepository implements GovernmentRepository {
  private meta: GovernmentMeta | null = null;
  private index: GovernmentFiler[] | null = null;
  private recent: GovernmentTrade[] | null = null;
  private readonly profiles = new Map<string, GovernmentProfile>();

  async loadMeta() {
    this.meta ??= await loadJson<GovernmentMeta>("./data/government/meta.json");
    return this.meta;
  }

  async loadIndex() {
    this.index ??= await loadJson<GovernmentFiler[]>("./data/government/index.json");
    return this.index;
  }

  async loadRecent() {
    this.recent ??= await loadJson<GovernmentTrade[]>("./data/government/recent.json");
    return this.recent;
  }

  async loadProfile(id: string) {
    const cached = this.profiles.get(id);
    if (cached) return cached;
    const profile = await loadJson<GovernmentProfile>(`./data/government/profiles/${encodeURIComponent(id)}.json`);
    this.profiles.set(id, profile);
    return profile;
  }
}

export const institutionalRepository = new StaticInstitutionalRepository();
export const governmentRepository = new StaticGovernmentRepository();
