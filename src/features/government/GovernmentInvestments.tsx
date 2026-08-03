"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { StockMark, Tag } from "@/src/components/ui";
import {
  buildExposureSignals,
  filerStats,
  tradeAction,
  type GovernmentFiler,
  type GovernmentMeta,
  type GovernmentProfile,
  type GovernmentTrade,
} from "@/src/domain/government";
import { governmentRepository } from "@/src/infrastructure/repositories/staticIntelligenceRepository";

type ActionFilter = "all" | "purchase" | "sale" | "exchange" | "other";
type UniverseFilter = "current" | "recent" | "all" | "archive";
type BranchFilter = "all" | "house" | "senate" | "executive";
type TimeFilter = "1Y" | "3Y" | "5Y" | "ALL";

export function GovernmentInvestments({ onSelect }: { onSelect: (symbol: string) => void }) {
  const [meta, setMeta] = useState<GovernmentMeta | null>(null);
  const [filers, setFilers] = useState<GovernmentFiler[]>([]);
  const [recent, setRecent] = useState<GovernmentTrade[]>([]);
  const [profile, setProfile] = useState<GovernmentProfile | null>(null);
  const [filerId, setFilerId] = useState("house_nancy_pelosi");
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [universeFilter, setUniverseFilter] = useState<UniverseFilter>("current");
  const [branchFilter, setBranchFilter] = useState<BranchFilter>("all");
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("3Y");
  const [tradeQuery, setTradeQuery] = useState("");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([governmentRepository.loadMeta(), governmentRepository.loadIndex(), governmentRepository.loadRecent()])
      .then(([nextMeta, nextFilers, nextRecent]) => { if (active) { setMeta(nextMeta); setFilers(nextFilers); setRecent(nextRecent); } })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    governmentRepository.loadProfile(filerId).then((payload) => { if (active) setProfile(payload); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [filerId]);

  const recentCutoff = useMemo(() => {
    const latest = filers.reduce((value, filer) => filer.latestTransactionDate > value ? filer.latestTransactionDate : value, "0000-01-01");
    const date = new Date(`${latest}T00:00:00Z`);
    date.setUTCFullYear(date.getUTCFullYear() - 2);
    return date.getTime();
  }, [filers]);
  const directory = useMemo(() => filers.filter((filer) => {
    const latestMs = new Date(`${filer.latestTransactionDate}T00:00:00Z`).getTime();
    if (universeFilter === "current" && filer.active !== true) return false;
    if (universeFilter === "recent" && latestMs < recentCutoff) return false;
    if (universeFilter === "archive" && filer.active !== false) return false;
    if (branchFilter === "executive" && filer.branch !== "executive") return false;
    if (branchFilter !== "all" && branchFilter !== "executive" && filer.chamber !== branchFilter) return false;
    return matchesSearch(`${filer.full_name} ${filer.state ?? ""} ${filer.office ?? ""} ${filer.agency ?? ""}`, directoryQuery);
  }).sort((a, b) => b.latestTransactionDate.localeCompare(a.latestTransactionDate) || b.trade_count - a.trade_count), [branchFilter, directoryQuery, filers, recentCutoff, universeFilter]);

  const exposureSignals = useMemo(() => buildExposureSignals(profile?.trades ?? []), [profile]);
  const effectiveTicker = selectedTicker && exposureSignals.some((signal) => signal.ticker === selectedTicker) ? selectedTicker : exposureSignals[0]?.ticker ?? null;
  const selectedExposure = exposureSignals.find((signal) => signal.ticker === effectiveTicker) ?? null;
  const filteredTrades = useMemo(() => {
    if (!profile) return [];
    const latestDate = profile.trades[0]?.transaction_date ?? new Date().toISOString().slice(0, 10);
    const cutoff = timeCutoff(latestDate, timeFilter);
    return profile.trades.filter((trade) => {
      const action = tradeAction(trade);
      return trade.transaction_date >= cutoff
        && (actionFilter === "all" || action === actionFilter)
        && `${trade.ticker ?? ""} ${trade.asset_name} ${trade.owner ?? ""}`.toLowerCase().includes(tradeQuery.toLowerCase());
    });
  }, [actionFilter, profile, timeFilter, tradeQuery]);
  const globalActivity = useMemo(() => recent.slice(0, 8), [recent]);

  if (!meta || !filers.length || !profile) return <IntelligenceLoading failed={failed} />;

  const official = filers.find((filer) => filer.id === profile.filer.id) ?? profile.filer;
  const stats = filerStats(profile);
  const currentCount = filers.filter((filer) => filer.active === true).length;
  const lateRate = meta.disclosureLag.tradesWithLag ? (meta.disclosureLag.lateCount / meta.disclosureLag.tradesWithLag) * 100 : 0;
  const chooseFiler = (id: string) => {
    setProfile(null);
    setFilerId(id);
    setSelectedTicker(null);
    setActionFilter("all");
    setTradeQuery("");
    setDirectoryOpen(false);
  };

  return <div className="view-stack government-view">
    <section className="section-hero intelligence-hero intelligence-hero--government">
      <div><span className="hero-panel__kicker"><i />Public disclosure intelligence</span><h1>Follow the filing.<br /><em>See the delay.</em></h1><p>Search congressional and executive-branch disclosures, reconstruct activity-derived exposure signals, and verify every transaction against its source document.</p></div>
      <aside className="disclosure-primer disclosure-primer--stats"><span className="eyebrow">National disclosure record</span><strong>{meta.totals.trades.toLocaleString()} transactions</strong><div><span>Filers</span><b>{meta.totals.filers}</b></div><div><span>Current lawmakers</span><b>{meta.totals.currentCongress}</b></div><div><span>Median reporting lag</span><b>{meta.disclosureLag.medianDaysToFile} days</b></div><small>Refreshed {shortDate(meta.dateRange.to)} · official House, Senate, and OGE records</small></aside>
    </section>

    <section className="intel-directory panel official-finder">
      <div className="intel-directory__bar">
        <div><span className="eyebrow">Official directory</span><h2>{official.full_name}</h2><p>{officialLabel(official)} · {official.trade_count.toLocaleString()} disclosed actions</p></div>
        <div className="intel-directory__actions"><label className="table-search"><span>⌕</span><input value={directoryQuery} onFocus={() => setDirectoryOpen(true)} onChange={(event) => { setDirectoryQuery(event.target.value); setDirectoryOpen(true); }} placeholder={`Search ${meta.totals.filers} public filers`} /></label><button className="secondary-button" onClick={() => setDirectoryOpen((value) => !value)}>{directoryOpen ? "Close directory" : "Browse all officials"}</button></div>
      </div>
      {directoryOpen && <div className="intel-directory__drawer">
        <div className="directory-filter-row"><div className="filter-tabs">{(["current", "recent", "all", "archive"] as UniverseFilter[]).map((item) => <button key={item} className={universeFilter === item ? "is-active" : ""} onClick={() => setUniverseFilter(item)}>{item === "current" ? `Current (${currentCount})` : item}</button>)}</div><div className="filter-tabs">{(["all", "house", "senate", "executive"] as BranchFilter[]).map((item) => <button key={item} className={branchFilter === item ? "is-active" : ""} onClick={() => setBranchFilter(item)}>{item}</button>)}</div><span>{directory.length} results</span></div>
        <div className="official-directory-grid">{directory.slice(0, 100).map((filer) => <button key={filer.id} className={filer.id === official.id ? "is-active" : ""} onClick={() => chooseFiler(filer.id)}>{filer.photo_url ? <Image src={filer.photo_url} alt="" width={40} height={49} unoptimized /> : <span className={`party-mark party-mark--${partyClass(filer.party)}`}>{filer.party ?? "•"}</span>}<span><b>{filer.full_name}</b><small>{officialLabel(filer)}</small></span><em>{filer.trade_count} trades</em><small>Latest {shortDate(filer.latestTransactionDate)}</small></button>)}</div>
        {directory.length > 100 && <p className="directory-limit-note">Showing the 100 most recently active matches. Refine the search to find any of the {meta.totals.filers} filers.</p>}
        {!directory.length && <div className="table-empty">No filer matches these filters.</div>}
      </div>}
    </section>

    <section className="official-profile panel">
      <div className="official-identity">{official.photo_url ? <Image className="official-photo" src={official.photo_url} alt="" width={57} height={68} unoptimized /> : <span className={`party-mark party-mark--${partyClass(official.party)} party-mark--large`}>{official.party ?? "•"}</span>}<div><span className="eyebrow">{partyName(official.party)} · {official.branch === "executive" ? "Executive branch" : titleCase(official.chamber ?? "Congress")}</span><h2>{official.full_name}</h2><p>{official.office ?? official.agency ?? "Public financial disclosure filer"}</p></div></div>
      <div className="official-freshness"><span className={`status-pill status-pill--${official.active === true ? "active" : official.active === false ? "archived" : "delayed"}`}><i />{official.active === true ? "Current member" : official.active === false ? "Historical filer" : "Executive disclosure"}</span><small>Latest disclosed trade: {shortDate(official.latestTransactionDate)}</small></div>
      <a className="secondary-button" href={sourcePortal(official, meta)} target="_blank" rel="noreferrer">Official disclosure portal ↗</a>
    </section>

    <section className="government-metrics">
      <Metric label="Disclosure history" value={official.trade_count.toLocaleString()} note={`${profile.trades.at(-1) ? shortDate(profile.trades.at(-1)!.transaction_date) : "—"} to ${shortDate(official.latestTransactionDate)}`} />
      <Metric label="Purchases / sales" value={`${stats.purchases} / ${stats.sales}`} note={`${profile.trades.length.toLocaleString()} records loaded`} />
      <Metric label="Median filing lag" value={stats.medianLag == null ? "—" : `${stats.medianLag} days`} note={stats.lateRate == null ? "Lag unavailable" : `${stats.lateRate.toFixed(1)}% marked late`} />
      <Metric label="Disclosed activity" value={compactMoney(stats.volume)} note="Range midpoints, not exact dollars" />
    </section>

    <section className="disclosure-truth-strip"><div><span>Trade date</span><b>When the transaction occurred</b></div><i>→</i><div><span>Filing date</span><b>When the public could see it</b></div><strong>Typical dataset lag: {meta.disclosureLag.medianDaysToFile} days</strong></section>

    <div className="government-grid government-grid--exposure">
      <section className="panel exposure-map-panel">
        <div className="panel-heading"><div><span className="eyebrow">Activity-derived exposure</span><h2>Potentially open positions</h2><p>Inferred from purchases after the latest explicit full sale—never presented as exact holdings.</p></div><Tag tone="warn">Not a live portfolio</Tag></div>
        {exposureSignals.length ? <div className="exposure-grid">{exposureSignals.slice(0, 18).map((signal) => <button key={signal.ticker} className={signal.ticker === effectiveTicker ? "is-selected" : ""} onClick={() => setSelectedTicker(signal.ticker)}><StockMark symbol={signal.ticker} size="sm" /><span><b>{signal.ticker}</b><small>{signal.assetName}</small></span><strong>{compactMoney(signal.estimatedNetActivity)}</strong><small>{signal.purchaseCount} buys · {signal.saleCount} sales · last {shortDate(signal.lastActivity)}</small><em>{signal.confidence}</em></button>)}</div> : <div className="disclosure-empty"><span>No open signal</span><h3>No position can be responsibly inferred</h3><p>The activity record contains no unresolved purchase after an explicit full sale. Use the full timeline below.</p></div>}
      </section>
      <section className="panel disclosure-health">
        <div className="panel-heading"><div><span className="eyebrow">Disclosure health</span><h2>Delay is part of the data</h2></div></div>
        <div className="lag-gauge"><strong>{meta.disclosureLag.medianDaysToFile}<small>days median</small></strong><span><i style={{ width: `${Math.min(100, (meta.disclosureLag.medianDaysToFile / 45) * 100)}%` }} /></span><div><b>Transaction</b><b>45-day limit</b></div></div>
        <dl className="filing-facts"><div><dt>90th percentile</dt><dd>{meta.disclosureLag.p90DaysToFile} days</dd></div><div><dt>Late records</dt><dd>{lateRate.toFixed(1)}%</dd></div><div><dt>Dataset span</dt><dd>{meta.dateRange.from.slice(0, 4)}–{meta.dateRange.to.slice(0, 4)}</dd></div><div><dt>Latest refresh</dt><dd>{shortDate(meta.dateRange.to)}</dd></div></dl>
        <div className="civic-note"><b>Why this matters</b><span>A disclosure is a delayed transparency record, not a real-time trading alert. Returns after filing can differ sharply from returns after the transaction.</span></div>
      </section>
    </div>

    {selectedExposure && <section className="panel exposure-inspector">
      <div className="position-inspector__header"><div className="company-cell"><StockMark symbol={selectedExposure.ticker} /><span><span className="eyebrow">Exposure trail · {official.full_name}</span><h2>{selectedExposure.ticker}</h2><small>{selectedExposure.assetName}</small></span></div><div className="position-inspector__actions"><button className="secondary-button" onClick={() => onSelect(selectedExposure.ticker)}>Research {selectedExposure.ticker} →</button><Tag tone={selectedExposure.confidence === "strong" ? "good" : "warn"}>{selectedExposure.confidence} inference</Tag></div></div>
      <div className="exposure-summary"><div><span>First purchase in episode</span><strong>{shortDate(selectedExposure.firstReported)}</strong><small>Exact disclosed transaction date</small></div><div><span>Last activity</span><strong>{shortDate(selectedExposure.lastActivity)}</strong><small>{selectedExposure.lastAction}</small></div><div><span>Activity range midpoint</span><strong>{compactMoney(selectedExposure.estimatedNetActivity)}</strong><small>Not an estimated market value</small></div><div><span>Disclosed owners</span><strong>{selectedExposure.ownerTypes.map(ownerLabel).join(", ") || "Unknown"}</strong><small>Household disclosure scope</small></div></div>
      <div className="trade-episode"><div className="trade-episode__rail" />{[...selectedExposure.trades].reverse().map((trade) => <TradeEvent key={trade.id} trade={trade} />)}</div>
      <div className="position-caveat"><b>What this signal can and cannot say</b><p>We can show purchases, partial sales, and explicit full sales in the disclosed record. We cannot know the exact remaining share count, current market value, undisclosed transactions, or whether similarly named assets are the same lot.</p></div>
    </section>}

    <section className="panel public-activity-ledger">
      <div className="panel-heading"><div><span className="eyebrow">Complete activity record</span><h2>{official.full_name}&apos;s disclosed transactions</h2><p>Trade date, public filing date, ownership, amount range, filing delay, and original document in one view.</p></div><Tag tone="blue">{filteredTrades.length.toLocaleString()} matching</Tag></div>
      <div className="table-toolbar table-toolbar--wrap"><div className="filter-tabs">{(["all", "purchase", "sale", "exchange", "other"] as ActionFilter[]).map((item) => <button key={item} className={actionFilter === item ? "is-active" : ""} onClick={() => setActionFilter(item)}>{item}</button>)}</div><div className="filter-tabs">{(["1Y", "3Y", "5Y", "ALL"] as TimeFilter[]).map((item) => <button key={item} className={timeFilter === item ? "is-active" : ""} onClick={() => setTimeFilter(item)}>{item}</button>)}</div><label className="table-search"><span>⌕</span><input value={tradeQuery} onChange={(event) => setTradeQuery(event.target.value)} placeholder="Ticker, asset, owner" /></label></div>
      <div className="public-trade-table"><div className="public-trade-row public-trade-row--head"><span>Asset</span><span>Action</span><span>Traded</span><span>Filed</span><span>Delay</span><span>Amount range</span><span>Owner</span><span>Source</span></div>{filteredTrades.slice(0, 250).map((trade) => <TradeRow key={trade.id} trade={trade} />)}</div>
      {filteredTrades.length > 250 && <p className="directory-limit-note">Showing 250 of {filteredTrades.length.toLocaleString()} matching transactions. Narrow the filters to inspect a specific activity trail.</p>}
      {!filteredTrades.length && <div className="table-empty">No disclosed transactions match this view.</div>}
      {profile.historyTruncated && <div className="history-truncated-note">This profile has {profile.totalTradeCount.toLocaleString()} transactions. The static profile loads the latest {profile.trades.length.toLocaleString()} for performance; the source archive retains the complete record.</div>}
    </section>

    <section className="panel latest-disclosures"><div className="panel-heading"><div><span className="eyebrow">Across all filers</span><h2>Latest disclosed activity</h2><p>A live cross-section of the most recently ingested public records.</p></div><Tag tone="neutral">{shortDate(meta.dateRange.to)}</Tag></div><div className="latest-disclosure-grid">{globalActivity.map((trade) => <article key={trade.id}><span className={`party-mark party-mark--${partyClass((trade.party as GovernmentFiler["party"]) ?? null)}`}>{trade.party ?? "•"}</span><div><b>{trade.filer_name}</b><small>{trade.chamber ? titleCase(trade.chamber) : "Executive"} · traded {shortDate(trade.transaction_date)}</small></div><Tag tone={actionTone(tradeAction(trade))}>{tradeAction(trade)}</Tag><strong>{trade.ticker ?? trade.asset_name.slice(0, 16)}</strong><a href={trade.doc_url} target="_blank" rel="noreferrer">Source ↗</a></article>)}</div></section>

    <section className="methodology-strip"><div><b>Public record, transformed with restraint</b><p>{meta.methodology} The interface preserves amount ranges and keeps trade date separate from filing date.</p></div><div className="methodology-links"><a href={meta.officialSources.house} target="_blank" rel="noreferrer">House ↗</a><a href={meta.officialSources.senate} target="_blank" rel="noreferrer">Senate ↗</a><a href={meta.upstreamUrl} target="_blank" rel="noreferrer">Open data method ↗</a></div></section>
  </div>;
}

function TradeRow({ trade }: { trade: GovernmentTrade }) {
  const action = tradeAction(trade);
  return <div className="public-trade-row"><span className="company-cell"><StockMark symbol={trade.ticker ?? trade.asset_name.slice(0, 2)} size="sm" /><span><b>{trade.ticker ?? "No ticker"}</b><small title={trade.asset_name}>{trade.asset_name}</small></span></span><span><Tag tone={actionTone(action)}>{action}</Tag><small>{trade.transaction_type}</small></span><span><b>{shortDate(trade.transaction_date)}</b><small>transaction</small></span><span><b>{shortDate(trade.filing_date)}</b><small>public filing</small></span><span><b className={trade.is_late ? "negative" : ""}>{trade.days_to_file == null ? "—" : `${trade.days_to_file}d`}</b><small>{trade.is_late ? "late" : "reported"}</small></span><span><b>{trade.amount_range_label}</b><small>not exact</small></span><span><b>{ownerLabel(trade.owner)}</b><small>{trade.filing_type}</small></span><span><a href={trade.doc_url} target="_blank" rel="noreferrer">Open ↗</a></span></div>;
}

function TradeEvent({ trade }: { trade: GovernmentTrade }) {
  const action = tradeAction(trade);
  return <article className={`trade-event trade-event--${action}`}><i /><div><b>{shortDate(trade.transaction_date)}</b><small>{trade.days_to_file == null ? "Filing lag unavailable" : `Filed ${trade.days_to_file} days later${trade.is_late ? " · late" : ""}`}</small></div><Tag tone={actionTone(action)}>{action}</Tag><div><b>{trade.amount_range_label}</b><small>{ownerLabel(trade.owner)} · {trade.transaction_type}</small></div>{trade.comment && <p>{trade.comment}</p>}<a href={trade.doc_url} target="_blank" rel="noreferrer">Filing ↗</a></article>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <article><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }
function IntelligenceLoading({ failed }: { failed: boolean }) { return <div className="panel intelligence-loading"><span>{failed ? "!" : "···"}</span><h2>{failed ? "Disclosure data could not be loaded" : "Reading public disclosures"}</h2><p>{failed ? "Refresh to retry the static research snapshot." : "Indexing officials, transaction ranges, and source documents."}</p></div>; }
function timeCutoff(latest: string, range: TimeFilter) { if (range === "ALL") return "0000-01-01"; const date = new Date(`${latest}T00:00:00Z`); date.setUTCFullYear(date.getUTCFullYear() - Number.parseInt(range)); return date.toISOString().slice(0, 10); }
function ownerLabel(value: string | null) { return ({ SP: "Spouse", JT: "Joint", DC: "Dependent", SELF: "Self", self: "Self", spouse: "Spouse", joint: "Joint" } as Record<string, string>)[value ?? ""] ?? value ?? "Unspecified"; }
function officialLabel(filer: GovernmentFiler) { if (filer.branch === "executive") return filer.agency ?? filer.office ?? "Executive branch"; return `${filer.chamber ? titleCase(filer.chamber) : "Congress"} · ${filer.state ?? "—"}${filer.district ? `-${String(filer.district).padStart(2, "0")}` : ""}`; }
function partyName(value: GovernmentFiler["party"]) { return value === "D" ? "Democratic" : value === "R" ? "Republican" : value === "I" ? "Independent" : "Unaffiliated"; }
function partyClass(value: GovernmentFiler["party"]) { return value === "D" ? "democratic" : value === "R" ? "republican" : "independent"; }
function sourcePortal(filer: GovernmentFiler, meta: GovernmentMeta) { return filer.branch === "executive" ? meta.officialSources.executive : filer.chamber === "senate" ? meta.officialSources.senate : meta.officialSources.house; }
function actionTone(action: ReturnType<typeof tradeAction>): "good" | "warn" | "blue" | "neutral" { return action === "purchase" ? "good" : action === "sale" ? "warn" : action === "exchange" ? "blue" : "neutral"; }
function shortDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!value || !Number.isFinite(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}
function compactMoney(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value); }
function titleCase(value: string) { return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value; }
function matchesSearch(value: string, query: string) { const haystack = value.toLowerCase(); return query.toLowerCase().trim().split(/\s+/).filter(Boolean).every((term) => haystack.includes(term)); }
