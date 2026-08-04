import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseGovernmentIndex, parseGovernmentLeaderboard, parseGovernmentMeta, parseGovernmentProfile, parseGovernmentRecent } from "@/src/shared/contracts/governmentData";

const dataUrl = new URL("../../public/data/government/", import.meta.url);

describe("government runtime contracts", () => {
  it("accepts every published dataset boundary", async () => {
    const [meta, index, recent, leaderboard, profile] = await Promise.all([
      json("meta.json"), json("index.json"), json("recent.json"), json("leaderboard.json"), json("profiles/house_nancy_pelosi.json"),
    ]);
    expect(parseGovernmentMeta(meta).totals.filers).toBeGreaterThan(400);
    expect(parseGovernmentIndex(index)).toHaveLength(440);
    expect(parseGovernmentRecent(recent).length).toBeGreaterThan(4_000);
    expect(parseGovernmentLeaderboard(leaderboard).entries).toHaveLength(440);
    expect(parseGovernmentProfile(profile).trades.length).toBeGreaterThan(100);
  }, 20_000);

  it("normalizes an upstream record with a missing transaction date without inventing one", async () => {
    const profile = parseGovernmentProfile(await json("profiles/house_pete_sessions.json"));
    expect(profile.trades.some((trade) => trade.transaction_date === null)).toBe(true);
    expect(profile.filer.loadedTradeCount).toBe(profile.trades.length);
    expect(profile.filer.latestTransactionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("rejects malformed source lineage and invalid financial ranges", async () => {
    const index = await json("index.json") as unknown[];
    expect(() => parseGovernmentIndex([{ ...(index[0] as object), id: "", est_volume: -1 }])).toThrow();
    const recent = await json("recent.json") as unknown[];
    expect(() => parseGovernmentRecent([{ ...(recent[0] as object), doc_url: "not-a-url" }])).toThrow();
  });
});

async function json(relativePath: string) { return JSON.parse(await readFile(new URL(relativePath, dataUrl), "utf8")) as unknown; }
