"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { GovernmentLeaderboardDataset, GovernmentLeaderboardEntry } from "@/src/domain/government";

type RankingMetric = "return" | "consistency" | "exposure" | "activity" | "freshness";
type RankingUniverse = "current" | "all";
type RankingBranch = "all" | "house" | "senate" | "executive";
type Coverage = "reliable" | "all";

const METRICS: { id: RankingMetric; label: string; shortLabel: string; description: string }[] = [
  { id: "return", label: "Top 1Y return", shortLabel: "Median 1Y", description: "Median underlying-security return one year after each disclosed purchase." },
  { id: "consistency", label: "Most consistent", shortLabel: "Reliability score", description: "A sample-adjusted one-year win rate. The 95% Wilson lower bound prevents a tiny perfect record from outranking a deep history." },
  { id: "exposure", label: "Largest activity", shortLabel: "Est. open activity", description: "Purchase-range midpoints remaining after explicit sales. This is not portfolio value." },
  { id: "activity", label: "Most active", shortLabel: "Recent actions", description: "Number of disclosed transactions in the latest two-year window." },
  { id: "freshness", label: "Latest disclosure", shortLabel: "Latest trade", description: "Most recent transaction date available in the disclosure record." },
];

export function GovernmentLeaderboard({ dataset, onChoose }: { dataset: GovernmentLeaderboardDataset; onChoose: (id: string) => void }) {
  const [metric, setMetric] = useState<RankingMetric>("return");
  const [universe, setUniverse] = useState<RankingUniverse>("current");
  const [branch, setBranch] = useState<RankingBranch>("all");
  const [coverage, setCoverage] = useState<Coverage>("reliable");
  const [visibleCount, setVisibleCount] = useState(20);
  const activeMetric = METRICS.find((item) => item.id === metric)!;

  const entries = useMemo(() => dataset.entries
    .filter((entry) => universe === "all" || entry.active === true)
    .filter((entry) => matchesBranch(entry, branch))
    .filter((entry) => coverage === "all" || entry.confidence !== "limited")
    .sort((a, b) => compareEntries(a, b, metric)), [branch, coverage, dataset.entries, metric, universe]);

  const chooseBranch = (value: RankingBranch) => {
    setBranch(value);
    if (value === "executive") setUniverse("all");
    setVisibleCount(20);
  };
  const chooseMetric = (value: RankingMetric) => { setMetric(value); setVisibleCount(20); };
  const chooseCoverage = (value: Coverage) => { setCoverage(value); setVisibleCount(20); };
  const podium = entries.slice(0, 3);

  return <section className="panel official-leaderboard">
    <div className="leaderboard-heading">
      <div><span className="eyebrow">Disclosure leaderboard</span><h2>Who has had the strongest disclosed activity?</h2><p>Compare public officials using the same transparent rules, with sample size and uncertainty attached to every rank.</p></div>
      <div className="leaderboard-asof"><span>Records through</span><strong>{shortDate(dataset.asOf)}</strong><small>{entries.length} officials in this view</small></div>
    </div>

    <div className="leaderboard-controls">
      <div className="leaderboard-control-group"><span>Rank by</span><div className="filter-tabs leaderboard-tabs">{METRICS.map((item) => <button key={item.id} className={metric === item.id ? "is-active" : ""} onClick={() => chooseMetric(item.id)}>{item.label}</button>)}</div></div>
      <div className="leaderboard-control-row">
        <div className="leaderboard-control-group"><span>Universe</span><div className="filter-tabs"><button className={universe === "current" ? "is-active" : ""} onClick={() => { setUniverse("current"); if (branch === "executive") setBranch("all"); setVisibleCount(20); }}>Current Congress</button><button className={universe === "all" ? "is-active" : ""} onClick={() => { setUniverse("all"); setVisibleCount(20); }}>All records</button></div></div>
        <div className="leaderboard-control-group"><span>Branch</span><div className="filter-tabs">{(["all", "house", "senate", "executive"] as RankingBranch[]).map((item) => <button key={item} className={branch === item ? "is-active" : ""} onClick={() => chooseBranch(item)}>{item === "all" ? "All branches" : titleCase(item)}</button>)}</div></div>
        <div className="leaderboard-control-group"><span>Coverage</span><div className="filter-tabs"><button className={coverage === "reliable" ? "is-active" : ""} onClick={() => chooseCoverage("reliable")}>Reliable samples</button><button className={coverage === "all" ? "is-active" : ""} onClick={() => chooseCoverage("all")}>Include limited</button></div></div>
      </div>
    </div>

    <div className="leaderboard-definition"><span>{activeMetric.shortLabel}</span><p>{activeMetric.description}</p><small>Performance excludes option and other derivative disclosures so an underlying stock return is not mistaken for the return of a different instrument.</small></div>

    {podium.length > 0 && <div className="leaderboard-podium">{podium.map((entry, index) => <button key={entry.filerId} className={`leaderboard-podium-card leaderboard-podium-card--${index + 1}`} onClick={() => onChoose(entry.filerId)}>
      <span className="leaderboard-rank">#{index + 1}</span>
      <OfficialAvatar entry={entry} featured />
      <div className="leaderboard-podium-name"><strong>{entry.fullName}</strong><small>{officialLabel(entry)}</small></div>
      <div className="leaderboard-primary-value"><strong>{metricValue(entry, metric)}</strong><span>{activeMetric.shortLabel}</span></div>
      <div className="leaderboard-podium-details"><span><b>{formatPercent(entry.medianPurchaseReturn1Y)}</b> median 1Y</span><span><b>{formatPercent(entry.purchaseWinRate1Y, false)}</b> win rate</span><span><b>{entry.performanceSample}</b> observations</span></div>
      {entry.bestPurchase && <small className="leaderboard-best">Best 1Y observation: <b>{entry.bestPurchase.ticker} {formatPercent(entry.bestPurchase.return1Y)}</b></small>}
      <span className={`confidence-badge confidence-badge--${entry.confidence}`}>{confidenceLabel(entry)}</span>
    </button>)}</div>}

    <div className="leaderboard-table-wrap">
      <div className="leaderboard-table leaderboard-table--head"><span>Rank</span><span>Official</span><span>Median 1Y</span><span>Win rate</span><span>Sample</span><span>Est. open activity</span><span>Recent actions</span><span>Latest trade</span></div>
      {entries.slice(0, visibleCount).map((entry, index) => <button className="leaderboard-table" key={entry.filerId} onClick={() => onChoose(entry.filerId)}>
        <span className="leaderboard-table-rank">{index + 1}</span>
        <span className="leaderboard-official-cell"><OfficialAvatar entry={entry} /><span><b>{entry.fullName}</b><small>{officialLabel(entry)}</small></span></span>
        <MetricCell value={formatPercent(entry.medianPurchaseReturn1Y)} note={`${entry.performanceSample} of ${entry.eligiblePurchases} eligible buys priced at 1Y`} />
        <MetricCell value={formatPercent(entry.purchaseWinRate1Y, false)} note={metric === "consistency" ? `${formatPercent(entry.reliabilityScore1Y, false)} reliability score` : `${entry.eligiblePurchases} eligible buys`} />
        <span className="leaderboard-sample"><b>{entry.performanceSample}</b><span className={`confidence-dot confidence-dot--${entry.confidence}`} /> <small>{confidenceLabel(entry)}</small></span>
        <MetricCell value={compactMoney(entry.estimatedOpenActivity)} note={`${entry.inferredPositions} inferred positions`} />
        <MetricCell value={entry.recentTransactions.toLocaleString()} note="latest 2 years" />
        <MetricCell value={shortDate(entry.latestTransactionDate)} note={entry.active === true ? "current member" : entry.branch === "executive" ? "executive record" : "historical filer"} />
      </button>)}
      {!entries.length && <div className="table-empty">No officials meet this combination of coverage and branch filters.</div>}
    </div>

    {visibleCount < entries.length && <button className="leaderboard-more secondary-button" onClick={() => setVisibleCount((value) => value + 20)}>Show 20 more <span>{visibleCount} of {entries.length}</span></button>}

    <div className="leaderboard-method">
      <div><span>01</span><p><b>Return</b> uses the median instead of a headline average, reducing the effect of one extreme winner.</p></div>
      <div><span>02</span><p><b>Confidence</b> is high at 20+ one-year observations, medium at 5–19, and limited below 5.</p></div>
      <div><span>03</span><p><b>Estimated open activity</b> nets disclosure-range midpoints after sales. It is not shares held, market value, or net worth.</p></div>
    </div>
  </section>;
}

function OfficialAvatar({ entry, featured = false }: { entry: GovernmentLeaderboardEntry; featured?: boolean }) {
  const size = featured ? 50 : 34;
  return entry.photoUrl
    ? <Image className={featured ? "leaderboard-avatar leaderboard-avatar--featured" : "leaderboard-avatar"} src={entry.photoUrl} alt="" width={size} height={Math.round(size * 1.2)} unoptimized />
    : <span className={`party-mark party-mark--${partyClass(entry.party)}${featured ? " party-mark--large" : ""}`}>{entry.party ?? "•"}</span>;
}

function MetricCell({ value, note }: { value: string; note: string }) {
  return <span className="leaderboard-metric-cell"><b>{value}</b><small>{note}</small></span>;
}

function compareEntries(a: GovernmentLeaderboardEntry, b: GovernmentLeaderboardEntry, metric: RankingMetric) {
  if (metric === "return") return compareNullableDesc(a.medianPurchaseReturn1Y, b.medianPurchaseReturn1Y) || b.performanceSample - a.performanceSample;
  if (metric === "consistency") return compareNullableDesc(a.reliabilityScore1Y, b.reliabilityScore1Y) || b.performanceSample - a.performanceSample || compareNullableDesc(a.medianPurchaseReturn1Y, b.medianPurchaseReturn1Y);
  if (metric === "exposure") return b.estimatedOpenActivity - a.estimatedOpenActivity || b.inferredPositions - a.inferredPositions;
  if (metric === "activity") return b.recentTransactions - a.recentTransactions || b.totalTransactions - a.totalTransactions;
  return b.latestTransactionDate.localeCompare(a.latestTransactionDate) || b.recentTransactions - a.recentTransactions;
}

function matchesBranch(entry: GovernmentLeaderboardEntry, branch: RankingBranch) {
  if (branch === "all") return true;
  if (branch === "executive") return entry.branch === "executive";
  return entry.chamber === branch;
}

function compareNullableDesc(a: number | null, b: number | null) { if (a == null && b == null) return 0; if (a == null) return 1; if (b == null) return -1; return b - a; }
function metricValue(entry: GovernmentLeaderboardEntry, metric: RankingMetric) {
  if (metric === "return") return formatPercent(entry.medianPurchaseReturn1Y);
  if (metric === "consistency") return formatPercent(entry.reliabilityScore1Y, false);
  if (metric === "exposure") return compactMoney(entry.estimatedOpenActivity);
  if (metric === "activity") return entry.recentTransactions.toLocaleString();
  return shortDate(entry.latestTransactionDate);
}
function confidenceLabel(entry: GovernmentLeaderboardEntry) { return entry.confidence === "high" ? "High confidence" : entry.confidence === "medium" ? "Medium confidence" : "Limited sample"; }
function officialLabel(entry: GovernmentLeaderboardEntry) { return entry.branch === "executive" ? entry.agency ?? entry.office ?? "Executive branch" : `${titleCase(entry.chamber ?? "Congress")} · ${entry.state ?? "—"}`; }
function partyClass(value: GovernmentLeaderboardEntry["party"]) { return value === "D" ? "democratic" : value === "R" ? "republican" : "independent"; }
function formatPercent(value: number | null, sign = true) { if (value == null) return "—"; return `${sign && value > 0 ? "+" : ""}${value.toFixed(1)}%`; }
function compactMoney(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value); }
function shortDate(value: string) { const date = new Date(`${value}T00:00:00Z`); return value && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date) : "Unknown"; }
function titleCase(value: string) { return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value; }
