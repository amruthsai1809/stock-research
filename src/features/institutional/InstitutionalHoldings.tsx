"use client";

import { useEffect, useMemo, useState } from "react";
import type { InstitutionalRepository } from "@/src/application/ports/repositories";
import { PositionHistoryChart } from "@/src/components/charts/PositionHistoryChart";
import { StockMark, Tag } from "@/src/components/ui";
import {
  buildPositionHistory,
  compareInstitutionalQuarters,
  institutionalHoldingKey,
  managerConcentration,
  managerTurnover,
  type HoldingChange,
  type InstitutionalIndex,
  type InstitutionalManager,
} from "@/src/domain/institutional";

type ChangeFilter = "all" | "new" | "increased" | "reduced" | "exited";
type DirectoryFilter = "active" | "all" | "archived";
type DisplayHolding = HoldingChange & { exited?: boolean };

export function InstitutionalHoldings({ onSelect, repository }: { onSelect: (symbol: string) => void; repository: InstitutionalRepository }) {
  const [index, setIndex] = useState<InstitutionalIndex | null>(null);
  const [manager, setManager] = useState<InstitutionalManager | null>(null);
  const [managerId, setManagerId] = useState("berkshire");
  const [quarterIndex, setQuarterIndex] = useState(0);
  const [selectedHoldingKey, setSelectedHoldingKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<ChangeFilter>("all");
  const [holdingQuery, setHoldingQuery] = useState("");
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [directoryFilter, setDirectoryFilter] = useState<DirectoryFilter>("active");
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    repository.loadIndex().then((payload) => { if (active) setIndex(payload); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [repository]);

  useEffect(() => {
    let active = true;
    repository.loadManager(managerId).then((payload) => { if (active) setManager(payload); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [managerId, repository]);

  const directory = useMemo(() => (index?.managers ?? []).filter((item) => {
    if (directoryFilter === "active" && item.lifecycle.status === "archived") return false;
    if (directoryFilter === "archived" && item.lifecycle.status !== "archived") return false;
    return matchesSearch(`${item.name} ${item.displayName} ${item.category}`, directoryQuery);
  }), [directoryFilter, directoryQuery, index]);
  const current = manager?.quarters[quarterIndex] ?? null;
  const previous = manager?.quarters[quarterIndex + 1];
  const comparison = useMemo(() => current ? compareInstitutionalQuarters(current, previous) : { changes: [], exited: [] }, [current, previous]);
  const rows = useMemo<DisplayHolding[]>(() => {
    const exits: DisplayHolding[] = comparison.exited.map((holding) => ({
      ...holding,
      key: institutionalHoldingKey(holding),
      previousValue: holding.value,
      previousShares: holding.shares,
      valueChange: -holding.value,
      shareChange: -100,
      changeType: "reduced",
      exited: true,
    }));
    const base = filter === "exited" ? exits : filter === "all" ? [...comparison.changes, ...exits] : comparison.changes.filter((holding) => holding.changeType === filter);
    return base.filter((holding) => `${holding.issuer} ${holding.symbol ?? ""}`.toLowerCase().includes(holdingQuery.toLowerCase()));
  }, [comparison, filter, holdingQuery]);
  const fallbackHolding = rows[0] ?? current?.holdings[0] ?? null;
  const effectiveHoldingKey = selectedHoldingKey && rows.some((item) => item.key === selectedHoldingKey)
    ? selectedHoldingKey
    : fallbackHolding ? institutionalHoldingKey(fallbackHolding) : null;
  const history = useMemo(() => manager && effectiveHoldingKey ? buildPositionHistory(manager, effectiveHoldingKey) : null, [effectiveHoldingKey, manager]);

  if (!index || !manager || !current) return <IntelligenceLoading failed={failed} label="SEC filings" />;

  const topHolding = current.holdings[0];
  const newCount = comparison.changes.filter((holding) => holding.changeType === "new").length;
  const increasedCount = comparison.changes.filter((holding) => holding.changeType === "increased").length;
  const reducedCount = comparison.changes.filter((holding) => holding.changeType === "reduced").length;
  const filingLag = daysBetween(current.reportDate, current.filedDate);
  const activeCount = index.managers.filter((item) => item.lifecycle.status !== "archived").length;
  const consensus = buildConsensus(index, manager.id);
  const chooseManager = (id: string) => {
    setManager(null);
    setManagerId(id);
    setQuarterIndex(0);
    setSelectedHoldingKey(null);
    setFilter("all");
    setHoldingQuery("");
    setDirectoryOpen(false);
  };

  return <div className="view-stack institutional-view">
    <section className="section-hero intelligence-hero intelligence-hero--13f">
      <div><span className="hero-panel__kicker"><i />Institutional ownership lab</span><h1>Trace conviction.<br /><em>Quarter by quarter.</em></h1><p>Explore five years of SEC-reported position changes across concentrated investors, global managers, and systematic firms—with every conclusion tied back to a filing.</p></div>
      <aside className="intel-source-card">
        <span className="eyebrow">Live research universe</span><strong>{activeCount} active managers</strong><p>{index.coverageQuarters} quarters per manager · updated from official EDGAR filings</p>
        <dl><div><dt>Latest period</dt><dd>{formatQuarter(index.expectedReportDate)}</dd></div><div><dt>Reporting lag</dt><dd>Up to 45d</dd></div><div><dt>Archive</dt><dd>{index.managers.length - activeCount} closed</dd></div></dl>
      </aside>
    </section>

    <section className="intel-directory panel">
      <div className="intel-directory__bar">
        <div><span className="eyebrow">Manager directory</span><h2>{manager.name}</h2><p>{manager.displayName} · {manager.category}</p></div>
        <div className="intel-directory__actions">
          <label className="table-search"><span>⌕</span><input value={directoryQuery} onFocus={() => setDirectoryOpen(true)} onChange={(event) => { setDirectoryQuery(event.target.value); setDirectoryOpen(true); }} placeholder={`Search ${index.managers.length} managers`} /></label>
          <button className="secondary-button" onClick={() => setDirectoryOpen((value) => !value)}>{directoryOpen ? "Close directory" : "Browse all managers"}</button>
        </div>
      </div>
      {directoryOpen && <div className="intel-directory__drawer">
        <div className="filter-tabs">{(["active", "all", "archived"] as DirectoryFilter[]).map((item) => <button key={item} className={directoryFilter === item ? "is-active" : ""} onClick={() => setDirectoryFilter(item)}>{item === "active" ? `Active (${activeCount})` : item === "archived" ? `Closed / historical (${index.managers.length - activeCount})` : `All (${index.managers.length})`}</button>)}</div>
        <div className="manager-directory-grid">{directory.map((item) => <button key={item.id} className={item.id === manager.id ? "is-active" : ""} onClick={() => chooseManager(item.id)}>
          <span className="manager-monogram">{initials(item.displayName)}</span><span><b>{item.name}</b><small>{item.displayName}</small></span><span className={`lifecycle-dot lifecycle-dot--${item.lifecycle.status}`}>{item.lifecycle.status}</span><em>{item.latest?.holdingsCount ?? 0} positions</em>
        </button>)}</div>
        {!directory.length && <div className="table-empty">No manager matches this search.</div>}
      </div>}
    </section>

    <section className={`panel manager-header manager-header--${manager.lifecycle.status}`}>
      <div className="manager-title"><span className="manager-monogram manager-monogram--large">{initials(manager.displayName)}</span><div><span className="eyebrow">{manager.lifecycle.status === "archived" ? "Historical record" : manager.category} · CIK {manager.cik}</span><h2>{manager.name}{manager.lifecycle.status === "archived" ? " — closed" : ""}</h2><p>{manager.lifecycle.status === "archived" ? "Historical filings retained for research. This is not a current portfolio." : manager.description}</p></div></div>
      <div className="filing-status"><span className={`status-pill status-pill--${manager.lifecycle.status}`}><i />{manager.lifecycle.status === "archived" ? "NO LONGER REPORTING" : manager.lifecycle.status === "delayed" ? "Filing delayed" : "Current filer"}</span><small>{manager.lifecycle.status === "archived" ? `Last public portfolio: ${shortDate(manager.quarters[0].reportDate)} · filed ${shortDate(manager.quarters[0].filedDate)}` : manager.lifecycle.reason}</small></div>
      <label className="quarter-select"><span>{manager.lifecycle.status === "archived" ? "Historical report" : "Report period"}</span><select value={quarterIndex} onChange={(event) => { setQuarterIndex(Number(event.target.value)); setSelectedHoldingKey(null); }}>{manager.quarters.map((quarter, itemIndex) => <option value={itemIndex} key={quarter.accession}>{formatQuarter(quarter.reportDate)} · filed {shortDate(quarter.filedDate)}</option>)}</select></label>
      <a className="secondary-button" href={current.sourceUrl} target="_blank" rel="noreferrer">View SEC filing ↗</a>
    </section>

    {manager.lifecycle.status === "archived" && <section className="archive-banner archive-banner--critical" role="status"><span>Closed</span><div><b>{manager.name} / Michael Burry is not an active reporting manager in TIDE.</b><p>The last public 13F portfolio covers {shortDate(manager.quarters[0].reportDate)} and was filed {shortDate(manager.quarters[0].filedDate)}. SEC adviser registration ended {manager.lifecycle.endedAt ? shortDate(manager.lifecycle.endedAt) : "after that filing"}. Everything below is labeled and presented as historical—not current holdings.</p></div><a href={manager.lifecycle.sourceUrl} target="_blank" rel="noreferrer">Verify closure ↗</a></section>}

    <section className="intel-metrics">
      <Metric label={manager.lifecycle.status === "archived" ? "Historical reported value" : "Reported value"} value={compactMoney(current.totalValue)} note={`At ${shortDate(current.reportDate)}`} />
      <Metric label={manager.lifecycle.status === "archived" ? "Historical positions" : "Disclosed positions"} value={String(current.holdingsCount)} note={`${current.displayedHoldingsCount} loaded in this view`} />
      <Metric label="Top 10 concentration" value={`${managerConcentration(current).toFixed(1)}%`} note={`${topHolding?.symbol ?? topHolding?.issuer ?? "—"} is largest`} />
      <Metric label="Filing delay" value={`${filingLag} days`} note={`Filed ${shortDate(current.filedDate)}`} />
    </section>

    <div className="institutional-grid institutional-grid--overview">
      <section className="panel conviction-panel">
        <div className="panel-heading"><div><span className="eyebrow">{manager.lifecycle.status === "archived" ? "Historical position map" : "Position map"}</span><h2>{manager.lifecycle.status === "archived" ? "Last disclosed portfolio — not current" : "Portfolio at a glance"}</h2><p>Tile size is approximate; labels show exact reported weight.</p></div><Tag tone={manager.lifecycle.status === "archived" ? "warn" : "neutral"}>{manager.lifecycle.status === "archived" ? `Historical · ${formatQuarter(current.reportDate)}` : formatQuarter(current.reportDate)}</Tag></div>
        <div className="conviction-map">{current.holdings.slice(0, 12).map((holding, itemIndex) => <button key={institutionalHoldingKey(holding)} className={`conviction-tile conviction-tile--${Math.min(4, Math.floor(itemIndex / 3))} ${effectiveHoldingKey === institutionalHoldingKey(holding) ? "is-selected" : ""}`} onClick={() => setSelectedHoldingKey(institutionalHoldingKey(holding))}><span>{holding.symbol ?? holding.issuer.slice(0, 14)}</span><strong>{holding.weight.toFixed(1)}%</strong><small>{compactMoney(holding.value)} · inspect history</small></button>)}</div>
      </section>
      <section className="panel filing-brief">
        <div className="panel-heading"><div><span className="eyebrow">This filing</span><h2>Activity brief</h2><p>Based on share-count changes, not price changes.</p></div></div>
        <div className="activity-scoreboard"><div><strong>{newCount}</strong><span>new positions</span></div><div><strong>{increasedCount}</strong><span>increased</span></div><div><strong>{reducedCount}</strong><span>trimmed</span></div><div><strong>{comparison.exited.length}</strong><span>exited</span></div></div>
        <dl className="filing-facts"><div><dt>Quarter ended</dt><dd>{shortDate(current.reportDate)}</dd></div><div><dt>Public on</dt><dd>{shortDate(current.filedDate)}</dd></div><div><dt>Turnover proxy</dt><dd>{formatOptionalPercent(managerTurnover(current, previous))}</dd></div><div><dt>Amendments</dt><dd>{current.amendmentCount || "None"}</dd></div></dl>
        <p className="method-note">13F reports reveal quarter-end long positions, not the manager&apos;s exact purchase day or cost. A position marked “entered” was first visible sometime during that quarter.</p>
      </section>
    </div>

    <section className="panel change-panel">
      <div className="panel-heading"><div><span className="eyebrow">Quarter-over-quarter ledger</span><h2>Every loaded position change</h2><p>Select a row to open its full five-year entry, add, trim, and exit trail.</p></div><div className="change-summary"><span className="positive">+{newCount} new</span><span>↑ {increasedCount} added</span><span className="negative">↓ {reducedCount} trimmed</span></div></div>
      <div className="table-toolbar"><div className="filter-tabs">{(["all", "new", "increased", "reduced", "exited"] as ChangeFilter[]).map((item) => <button key={item} className={filter === item ? "is-active" : ""} onClick={() => { setFilter(item); setSelectedHoldingKey(null); }}>{item}</button>)}</div><label className="table-search"><span>⌕</span><input value={holdingQuery} onChange={(event) => { setHoldingQuery(event.target.value); setSelectedHoldingKey(null); }} placeholder="Ticker or company" /></label></div>
      <div className="institutional-ledger"><div className="institutional-ledger__head"><span>Company</span><span>Weight</span><span>Reported value</span><span>Shares</span><span>Quarter action</span><span /></div>{rows.slice(0, 100).map((holding) => <HoldingRow key={`${holding.key}-${holding.exited ? "exit" : "held"}`} holding={holding} selected={holding.key === effectiveHoldingKey} onInspect={() => setSelectedHoldingKey(holding.key)} />)}</div>
      {!rows.length && <div className="table-empty">No positions match this view.</div>}
    </section>

    {history && <section className="panel position-inspector" id="institutional-position-history">
      <div className="position-inspector__header"><div className="company-cell"><StockMark symbol={history.holding.symbol ?? history.holding.issuer.slice(0, 2)} /><span><span className="eyebrow">Position history · {manager.name}</span><h2>{history.holding.symbol ?? history.holding.issuer}</h2><small>{history.holding.issuer} · {history.holding.securityClass}{history.holding.optionType ? ` · ${history.holding.optionType}` : ""}</small></span></div><div className="position-inspector__actions">{history.holding.symbol && <button className="secondary-button" onClick={() => onSelect(history.holding.symbol!)}>Research {history.holding.symbol} →</button>}<a className="secondary-button" href={history.points.at(-1)?.sourceUrl} target="_blank" rel="noreferrer">Latest source ↗</a></div></div>
      <div className="position-summary-strip"><div><span>{manager.lifecycle.status === "archived" ? "Historical episode began" : "Current episode began"}</span><strong>{formatQuarter(history.currentEpisodeStart)}</strong><small>{history.historyLimited ? `Held since at least ${formatQuarter(history.firstLoadedReport)}` : "First reported in loaded filing"}</small></div><div><span>Quarters reported</span><strong>{history.quartersHeld}</strong><small>Across the five-year loaded window</small></div><div><span>{manager.lifecycle.status === "archived" ? "Last disclosed weight" : "Current weight"}</span><strong>{history.holding.weight.toFixed(2)}%</strong><small>{compactMoney(history.holding.value)} reported value</small></div><div><span>{manager.lifecycle.status === "archived" ? "Last disclosed shares" : "Current shares"}</span><strong>{compactNumber(history.holding.shares)}</strong><small>Quarter-end share count</small></div></div>
      <div className="position-inspector__grid"><PositionHistoryChart points={history.points} symbol={history.holding.symbol ?? history.holding.issuer} /><div className="position-event-log"><div className="panel-heading"><div><span className="eyebrow">Filing-by-filing</span><h3>Activity trail</h3></div></div><div>{[...history.points].reverse().filter((point) => point.status !== "absent").map((point) => <article key={point.reportDate}><i className={`event-dot event-dot--${point.status}`} /><div><b>{formatQuarter(point.reportDate)}</b><small>Filed {shortDate(point.filedDate)}</small></div><Tag tone={eventTone(point.status)}>{eventLabel(point.status)}</Tag><div><b>{point.shares == null ? "—" : compactNumber(point.shares)}</b><small>{point.weight == null ? "Not reported" : `${point.weight.toFixed(2)}% weight`}</small></div><a href={point.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open ${formatQuarter(point.reportDate)} filing`}>↗</a></article>)}</div></div></div>
      <div className="position-caveat"><b>How to read “entered”</b><p>13F filings are snapshots. We can identify the first quarter a position appeared, but not the exact trade date or purchase price. “Held since at least” means the position already existed at the start of our five-year window.</p></div>
    </section>}

    <section className="institutional-insight-grid">
      <section className="panel consensus-panel"><div className="panel-heading"><div><span className="eyebrow">Cross-manager signal</span><h2>Shared conviction</h2><p>Most common securities in latest active-manager filings.</p></div><Tag tone="blue">{activeCount} managers</Tag></div><div className="consensus-list">{consensus.map((item, itemIndex) => <button key={item.key} onClick={() => item.symbol && onSelect(item.symbol)} disabled={!item.symbol}><span className="rank-number">{String(itemIndex + 1).padStart(2, "0")}</span><StockMark symbol={item.symbol ?? item.issuer.slice(0, 2)} size="sm" /><span><b>{item.symbol ?? item.issuer}</b><small>{item.issuer}</small></span><strong>{item.count}<small>managers</small></strong></button>)}</div></section>
      <section className="panel coverage-panel"><div className="panel-heading"><div><span className="eyebrow">Coverage & freshness</span><h2>A system designed to age well</h2><p>Filing identity, expected periods, and explicit lifecycle records are validated during refresh.</p></div></div><div className="coverage-flow"><article><span>01</span><div><b>Validate identity</b><small>CIK names are checked against SEC submissions.</small></div></article><article><span>02</span><div><b>Detect expected quarter</b><small>Missing or late filers are flagged automatically.</small></div></article><article><span>03</span><div><b>Separate the archive</b><small>Closed managers remain researchable, never presented as current.</small></div></article></div><p className="coverage-stamp">Snapshot generated {dateTime(index.generatedAt)} · latest expected period {formatQuarter(index.expectedReportDate)}</p></section>
    </section>

    <section className="methodology-strip"><div><b>Use filings, not folklore</b><p>13F reports can be 45 days old and omit shorts, cash, most bonds, and many foreign securities. Confidential treatment and amendments can also change what appears.</p></div><a href="https://www.sec.gov/divisions/investment/13ffaq" target="_blank" rel="noreferrer">Read the SEC 13F guide ↗</a></section>
  </div>;
}

function HoldingRow({ holding, selected, onInspect }: { holding: DisplayHolding; selected: boolean; onInspect: () => void }) {
  const label = holding.exited ? "exited" : holding.changeType;
  return <button className={`institutional-ledger__row ${selected ? "is-selected" : ""}`} onClick={onInspect}><span className="company-cell"><StockMark symbol={holding.symbol ?? holding.issuer.slice(0, 2)} size="sm" /><span><b>{holding.symbol ?? holding.issuer}</b><small>{holding.symbol ? holding.issuer : holding.securityClass}</small></span></span><span><i className="allocation-bar"><i style={{ width: `${Math.min(100, holding.weight * 3)}%` }} /></i><small>{holding.exited ? "0% now" : `${holding.weight.toFixed(2)}%`}</small></span><span><b>{holding.exited ? "—" : compactMoney(holding.value)}</b><small>{holding.optionType ? `${holding.optionType} option` : "quarter end"}</small></span><span><b>{holding.exited ? "0" : compactNumber(holding.shares)}</b><small>{holding.previousShares ? `${compactNumber(holding.previousShares)} prior` : "First appearance"}</small></span><span><Tag tone={holding.exited || holding.changeType === "reduced" ? "warn" : holding.changeType === "new" || holding.changeType === "increased" ? "good" : "neutral"}>{label}</Tag><small className={(holding.shareChange ?? 0) >= 0 ? "positive" : "negative"}>{holding.shareChange == null ? "New position" : `${holding.shareChange >= 0 ? "+" : ""}${holding.shareChange.toFixed(1)}% shares`}</small></span><span className="inspect-affordance">History →</span></button>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <article><span className="eyebrow">{label}</span><strong>{value}</strong><small>{note}</small></article>; }
function IntelligenceLoading({ failed, label }: { failed: boolean; label: string }) { return <div className="panel intelligence-loading"><span>{failed ? "!" : "···"}</span><h2>{failed ? `${label} could not be loaded` : `Reading ${label}`}</h2><p>{failed ? "Refresh to retry the static research snapshot." : "Normalizing filings, amendments, and position histories."}</p></div>; }
function buildConsensus(index: InstitutionalIndex, excludeId: string) {
  const map = new Map<string, { key: string; issuer: string; symbol: string | null; count: number; value: number }>();
  for (const manager of index.managers) {
    if (manager.id === excludeId || manager.lifecycle.status === "archived") continue;
    for (const holding of manager.latest?.holdings ?? []) {
      const key = institutionalHoldingKey(holding);
      const item = map.get(key) ?? { key, issuer: holding.issuer, symbol: holding.symbol, count: 0, value: 0 };
      item.count += 1; item.value += holding.value; if (!item.symbol && holding.symbol) item.symbol = holding.symbol; map.set(key, item);
    }
  }
  return [...map.values()].filter((item) => item.count > 1).sort((a, b) => b.count - a.count || b.value - a.value).slice(0, 9);
}
function initials(value: string) { return value.split(/\s+|\//).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function formatQuarter(value?: string) { if (!value) return "—"; const date = new Date(`${value}T00:00:00Z`); return `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`; }
function shortDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function dateTime(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
function compactMoney(value = 0) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value); }
function compactNumber(value = 0) { return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value); }
function daysBetween(start: string, end: string) { return Math.round((new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86_400_000); }
function formatOptionalPercent(value: number | null) { return value == null ? "—" : `${value.toFixed(1)}%`; }
function eventLabel(value: string) { return ({ entered: "entered", added: "added", trimmed: "trimmed", unchanged: "unchanged", exited: "exited", absent: "absent" } as Record<string, string>)[value] ?? value; }
function eventTone(value: string): "neutral" | "good" | "warn" | "blue" { return value === "entered" || value === "added" ? "good" : value === "trimmed" || value === "exited" ? "warn" : value === "unchanged" ? "neutral" : "blue"; }
function matchesSearch(value: string, query: string) { const haystack = value.toLowerCase(); return query.toLowerCase().trim().split(/\s+/).filter(Boolean).every((term) => haystack.includes(term)); }
