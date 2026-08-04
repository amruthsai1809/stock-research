import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { governmentLeaderboardDataset, summarizeGovernmentFiler } from "./lib/governmentLeaderboard.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const GOVERNMENT_DIR = path.join(ROOT, "public", "data", "government");
const index = JSON.parse(await readFile(path.join(GOVERNMENT_DIR, "index.json"), "utf8"));
const meta = JSON.parse(await readFile(path.join(GOVERNMENT_DIR, "meta.json"), "utf8"));
const entries = [];

for (const filer of index) {
  const profile = JSON.parse(await readFile(path.join(GOVERNMENT_DIR, "profiles", `${filer.id}.json`), "utf8"));
  entries.push(summarizeGovernmentFiler(filer, profile.trades ?? [], { asOf: meta.dateRange.to, historyTruncated: profile.historyTruncated }));
}

const dataset = governmentLeaderboardDataset(entries, { asOf: meta.dateRange.to });
await writeFile(path.join(GOVERNMENT_DIR, "leaderboard.json"), `${JSON.stringify(dataset)}\n`);
process.stdout.write(`Wrote ${entries.length} public-official leaderboard entries.\n`);
