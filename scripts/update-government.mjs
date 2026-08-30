import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";
import { governmentLeaderboardDataset, summarizeGovernmentFiler } from "./lib/governmentLeaderboard.mjs";
import { createStagedDirectory, replaceDirectory } from "./lib/atomicOutput.mjs";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "public", "data", "government");
const UPSTREAM = "https://github.com/kadoa-org/congress-trading-monitor.git";
const UPSTREAM_WEB = "https://github.com/kadoa-org/congress-trading-monitor";
const MAX_PROFILE_TRADES = 1_200;

const normalizeName = (value = "") => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\b(honorable|hon|jr|sr|ii|iii|iv|dr)\b/g, " ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

async function cloneUpstream(target) {
  await execFileAsync("git", ["clone", "--depth", "1", "--filter=blob:none", UPSTREAM, target], { windowsHide: true, maxBuffer: 1024 * 1024 * 8 });
  const { stdout } = await execFileAsync("git", ["-C", target, "rev-parse", "HEAD"], { windowsHide: true });
  return stdout.trim();
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function currentLegislators() {
  const response = await fetch("https://unitedstates.github.io/congress-legislators/legislators-current.json");
  if (!response.ok) throw new Error(`Current legislator registry returned ${response.status}`);
  return response.json();
}

function currentMemberFor(filer, byBioguide, byName) {
  const bioguide = filer.photo_url?.match(/\/([A-Z]\d{6})\.jpg/i)?.[1]?.toUpperCase();
  return (bioguide && byBioguide.get(bioguide)) || byName.get(normalizeName(filer.full_name)) || null;
}

function enrichFiler(filer, current) {
  const term = current?.terms?.at(-1);
  const bioguideId = current?.id?.bioguide ?? filer.photo_url?.match(/\/([A-Z]\d{6})\.jpg/i)?.[1] ?? null;
  if (filer.branch !== "congress" || !current || !term) return { ...filer, active: filer.branch === "executive" ? null : false, bioguide_id: bioguideId };
  const chamber = term.type === "sen" ? "senate" : "house";
  const district = chamber === "house" ? term.district ?? null : null;
  return {
    ...filer,
    active: true,
    bioguide_id: bioguideId,
    chamber,
    party: term.party === "Democrat" ? "D" : term.party === "Republican" ? "R" : "I",
    state: term.state,
    district,
    office: chamber === "senate" ? `U.S. Senator · ${term.state}` : `U.S. Representative · ${term.state}-${String(district ?? 0).padStart(2, "0")}`,
  };
}

function latestTransaction(trades) {
  return trades.reduce((latest, trade) => trade.transaction_date > latest ? trade.transaction_date : latest, "");
}

async function writeGovernmentSnapshot({ enriched, dataDir, recent, stats, commit }) {
  const stagedOutput = await createStagedDirectory(OUTPUT_DIR);
  const profileDirectory = path.join(stagedOutput, "profiles");
  try {
    await mkdir(profileDirectory, { recursive: true });
    const profileSummaries = new Map();
    const leaderboardEntries = [];
    for (const filer of enriched) {
      const sourceFile = path.join(dataDir, "filer", `${filer.id}.json`);
      let profile;
      try {
        profile = await readJson(sourceFile);
      } catch {
        profile = { filer, trades: recent.filter((trade) => trade.filer_id === filer.id) };
      }
      const trades = (profile.trades ?? []).slice(0, MAX_PROFILE_TRADES);
      const latestTransactionDate = latestTransaction(trades) || filer.latestTransactionDate || stats.dateRange.to;
      const filerSnapshot = { ...profile.filer, ...filer, latestTransactionDate, loadedTradeCount: trades.length };
      const payload = {
        filer: filerSnapshot,
        trades,
        historyTruncated: (profile.trades?.length ?? 0) > trades.length,
        totalTradeCount: profile.trades?.length ?? trades.length,
      };
      profileSummaries.set(filer.id, { latestTransactionDate, loadedTradeCount: trades.length });
      leaderboardEntries.push(summarizeGovernmentFiler(filerSnapshot, trades, { asOf: stats.dateRange.to, historyTruncated: payload.historyTruncated }));
      await writeFile(path.join(profileDirectory, `${filer.id}.json`), `${JSON.stringify(payload)}\n`);
    }

    const index = enriched.map((filer) => ({ ...filer, ...profileSummaries.get(filer.id) }));
    const currentCongress = index.filter((filer) => filer.branch === "congress" && filer.active);
    if (currentCongress.length < 120) throw new Error(`Only ${currentCongress.length} current members matched the disclosure universe`);

    const generatedAt = new Date().toISOString();
    const meta = {
      generatedAt,
      upstreamGeneratedAt: stats.generatedAt,
      upstreamCommit: commit,
      source: "House Clerk, Senate eFD, and U.S. Office of Government Ethics disclosures",
      normalizedBy: "Kadoa Congress Trading Monitor (MIT licensed)",
      upstreamUrl: UPSTREAM_WEB,
      methodology: "Transactions are parsed from official public filings. Dollar amounts remain disclosure ranges. Current-member status is refreshed from the unitedstates/congress-legislators registry. Activity-based exposure is an interface aid, not an exact or complete portfolio.",
      officialSources: {
        house: "https://disclosures-clerk.house.gov/FinancialDisclosure",
        senate: "https://efdsearch.senate.gov/search/home/",
        executive: "https://www.oge.gov/web/oge.nsf/Resources/Public+Financial+Disclosure+Guide",
      },
      totals: {
        trades: stats.totalTrades,
        filings: stats.totalFilings,
        filers: index.length,
        currentCongress: currentCongress.length,
        recentLoaded: recent.length,
      },
      dateRange: stats.dateRange,
      disclosureLag: stats.disclosureLag,
    };
    const leaderboard = governmentLeaderboardDataset(leaderboardEntries, { asOf: stats.dateRange.to, generatedAt });
    validateGovernmentSnapshot({ index, recent, meta, leaderboard });
    await Promise.all([
      writeFile(path.join(stagedOutput, "index.json"), `${JSON.stringify(index)}\n`),
      writeFile(path.join(stagedOutput, "recent.json"), `${JSON.stringify(recent)}\n`),
      writeFile(path.join(stagedOutput, "meta.json"), `${JSON.stringify(meta)}\n`),
      writeFile(path.join(stagedOutput, "leaderboard.json"), `${JSON.stringify(leaderboard)}\n`),
    ]);
    await replaceDirectory(stagedOutput, OUTPUT_DIR);
    process.stdout.write(`Wrote ${index.length} public-official profiles (${currentCongress.length} current members; ${stats.totalTrades.toLocaleString()} total transactions upstream).\n`);
  } catch (error) {
    await rm(stagedOutput, { recursive: true, force: true });
    throw error;
  }
}

function validateGovernmentSnapshot({ index, recent, meta, leaderboard }) {
  if (new Set(index.map((filer) => filer.id)).size !== index.length) throw new Error("Government snapshot contains duplicate filer IDs");
  if (leaderboard.entries.length !== index.length) throw new Error("Government leaderboard does not cover every filer");
  if (meta.totals.filers !== index.length || meta.totals.recentLoaded !== recent.length) throw new Error("Government metadata totals do not match snapshot files");
  if (index.some((filer) => !filer.latestTransactionDate || filer.loadedTradeCount < 0)) throw new Error("Government filer summary is incomplete");
  if (recent.some((trade) => !trade.filing_date || !trade.doc_url)) throw new Error("Government recent feed contains an unverifiable record");
}

async function main() {
  const temp = await mkdtemp(path.join(tmpdir(), "equity-lab-government-"));
  try {
    const commit = await cloneUpstream(temp);
    const dataDir = path.join(temp, "public", "data");
    const [filers, stats, recent, legislators] = await Promise.all([
      readJson(path.join(dataDir, "filers.json")),
      readJson(path.join(dataDir, "stats.json")),
      readJson(path.join(dataDir, "trades.json")),
      currentLegislators(),
    ]);
    const latestDate = new Date(`${stats.dateRange?.to}T00:00:00Z`).getTime();
    if (!Array.isArray(filers) || filers.length < 350) throw new Error(`Upstream filer universe unexpectedly small: ${filers?.length ?? 0}`);
    if (!Array.isArray(recent) || recent.length < 4_000) throw new Error(`Upstream recent trade set unexpectedly small: ${recent?.length ?? 0}`);
    if (!latestDate || Date.now() - latestDate > 21 * 86_400_000) throw new Error(`Upstream disclosure feed is stale: ${stats.dateRange?.to ?? "unknown"}`);

    const byBioguide = new Map(legislators.map((member) => [member.id.bioguide, member]));
    const byName = new Map(legislators.map((member) => [normalizeName(`${member.name.first} ${member.name.middle ?? ""} ${member.name.last}`), member]));
    const enriched = filers.map((filer) => enrichFiler(filer, currentMemberFor(filer, byBioguide, byName)));
    await writeGovernmentSnapshot({ enriched, dataDir, recent, stats, commit });
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

await main();
