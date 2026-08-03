"use client";

import { useEffect, useMemo, useState } from "react";
import type { InstitutionalDataset } from "@/src/domain/institutional";
import { compareInstitutionalQuarters, managerConcentration, managerTurnover } from "@/src/domain/institutional";
import { LineChart, StockMark, Tag } from "@/src/components/ui";

type ChangeFilter = "all" | "new" | "increased" | "reduced" | "exited";

export function InstitutionalHoldings({ onSelect }: { onSelect: (symbol: string) => void }) {
  const [dataset, setDataset] = useState<InstitutionalDataset | null>(null);
  const [failed, setFailed] = useState(false);
  const [managerId, setManagerId] = useState("berkshire");
  const [quarterIndex, setQuarterIndex] = useState(0);
  const [compareId, setCompareId] = useState("pershing");
  const [filter, setFilter] = useState<ChangeFilter>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    fetch("./data/institutional-data.json").then((response) => { if (!response.ok) throw new Error(); return response.json() as Promise<InstitutionalDataset>; }).then((payload) => { if (active) setDataset(payload); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  const manager = dataset?.managers.find((item) => item.id === managerId) ?? dataset?.managers[0];
  const current = manager?.quarters[quarterIndex] ?? manager?.quarters[0];
  const previous = manager?.quarters[quarterIndex + 1];
  const comparison = useMemo(() => current ? compareInstitutionalQuarters(current, previous) : { changes: [], exited: [] }, [current, previous]);
  const rows = useMemo(() => {
    const base = filter === "exited" ? comparison.exited.map((holding) => ({ ...holding, previousValue: holding.value, previousShares: holding.shares, valueChange: -holding.value, shareChange: -100, changeType: "reduced" as const })) : comparison.changes.filter((holding) => filter === "all" || holding.changeType === filter);
    return base.filter((holding) => `${holding.issuer} ${holding.symbol ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  }, [comparison, filter, query]);
  const consensus = useMemo(() => {
    const positions = new Map<string, { cusip: string; issuer: string; symbol: string | null; managers: string[]; reportedValue: number }>();
    for (const item of dataset?.managers ?? []) for (const holding of item.quarters[0]?.holdings ?? []) {
      const record = positions.get(holding.cusip) ?? { cusip: holding.cusip, issuer: holding.issuer, symbol: holding.symbol, managers: [], reportedValue: 0 };
      record.managers.push(item.name);
      record.reportedValue += holding.value;
      if (!record.symbol && holding.symbol) record.symbol = holding.symbol;
      positions.set(holding.cusip, record);
    }
    return [...positions.values()].filter((item) => item.managers.length > 1).sort((a, b) => b.managers.length - a.managers.length || b.reportedValue - a.reportedValue).slice(0, 8);
  }, [dataset]);
  if (!dataset) return <IntelligenceLoading failed={failed} label="SEC 13F filings" />;
  if (!manager || !current) return <IntelligenceLoading failed label="manager filings" />;
  const turnover = managerTurnover(current, previous);
  const topHolding = current.holdings[0];
  const newCount = comparison.changes.filter((holding) => holding.changeType === "new").length;
  const increasedCount = comparison.changes.filter((holding) => holding.changeType === "increased").length;
  const reducedCount = comparison.changes.filter((holding) => holding.changeType === "reduced").length;
  const trend = [...manager.quarters].reverse();
  const compareManager = dataset.managers.find((item) => item.id === compareId && item.id !== manager.id) ?? dataset.managers.find((item) => item.id !== manager.id);
  const compareQuarter = compareManager?.quarters[0];
  const compareCusips = new Set(compareQuarter?.holdings.map((holding) => holding.cusip) ?? []);
  const overlap = current.holdings.filter((holding) => compareCusips.has(holding.cusip));
  const overlapWeight = overlap.reduce((total, holding) => total + holding.weight, 0);

  return <div className="view-stack institutional-view">
    <section className="section-hero intelligence-hero intelligence-hero--13f">
      <div><span className="hero-panel__kicker"><i />SEC 13F intelligence</span><h1>Follow conviction.<br /><em>Question the delay.</em></h1><p>Explore quarterly long positions, concentration, entries, exits, and sizing changes from prominent U.S. investment managers.</p></div>
      <div className="intel-source-card"><span className="eyebrow">Source discipline</span><strong>Official SEC EDGAR</strong><p>Every position traces to the manager&apos;s filed information table.</p><dl><div><dt>Coverage</dt><dd>8 quarters</dd></div><div><dt>Delay</dt><dd>Up to 45 days</dd></div><div><dt>Scope</dt><dd>Long 13F securities</dd></div></dl></div>
    </section>

    <section className="manager-rail" aria-label="Select investment manager">{dataset.managers.map((item) => <button key={item.id} className={item.id === manager.id ? "is-active" : ""} onClick={() => { setManagerId(item.id); setQuarterIndex(0); }}><span className="manager-monogram">{initials(item.displayName)}</span><span><b>{item.name}</b><small>{item.displayName}</small></span><em>{item.quarters[0]?.holdingsCount ?? 0}</em></button>)}</section>

    <section className="panel manager-header">
      <div className="manager-title"><span className="manager-monogram manager-monogram--large">{initials(manager.displayName)}</span><div><span className="eyebrow">{manager.style}</span><h2>{manager.name}</h2><p>{manager.description}</p></div></div>
      <label className="quarter-select"><span>Report period</span><select value={quarterIndex} onChange={(event) => setQuarterIndex(Number(event.target.value))}>{manager.quarters.map((quarter, index) => <option value={index} key={quarter.accession}>{formatQuarter(quarter.reportDate)} · filed {shortDate(quarter.filedDate)}</option>)}</select></label>
      <a className="secondary-button" href={current.sourceUrl} target="_blank" rel="noreferrer">Open SEC filing ↗</a>
    </section>

    <section className="intel-metrics">
      <article><span className="eyebrow">Reported value</span><strong>{compactMoney(current.totalValue)}</strong><small>Market value at quarter end</small></article>
      <article><span className="eyebrow">Positions</span><strong>{current.holdingsCount}</strong><small>{newCount} new · {comparison.exited.length} exited</small></article>
      <article><span className="eyebrow">Top 10 concentration</span><strong>{managerConcentration(current).toFixed(1)}%</strong><small>{topHolding?.symbol ?? topHolding?.issuer ?? "—"} is largest</small></article>
      <article><span className="eyebrow">Estimated turnover</span><strong>{turnover == null ? "—" : `${turnover.toFixed(1)}%`}</strong><small>Value-change proxy</small></article>
    </section>

    <div className="institutional-grid">
      <section className="panel conviction-panel">
        <div className="panel-heading"><div><span className="eyebrow">Position map</span><h2>Where disclosed capital sits</h2><p>Tile area represents portfolio weight.</p></div><Tag tone="neutral">Top {Math.min(12, current.holdings.length)}</Tag></div>
        <div className="conviction-map">{current.holdings.slice(0, 12).map((holding, index) => <button key={`${holding.cusip}-${holding.optionType ?? "long"}`} className={`conviction-tile conviction-tile--${Math.min(4, Math.floor(index / 3))}`} style={{ "--weight": Math.max(1, holding.weight) } as React.CSSProperties} onClick={() => holding.symbol && onSelect(holding.symbol)} disabled={!holding.symbol}><span>{holding.symbol ?? holding.issuer.slice(0, 13)}</span><strong>{holding.weight.toFixed(1)}%</strong><small>{compactMoney(holding.value)}</small></button>)}</div>
      </section>
      <section className="panel quarter-trend">
        <div className="panel-heading"><div><span className="eyebrow">Quarter history</span><h2>Reported portfolio value</h2><p>Not investment performance; price moves and flows both matter.</p></div></div>
        <LineChart series={[{ values: trend.map((quarter) => quarter.totalValue / 1e9), color: "#ef6c50" }]} labels={trend.map((quarter) => formatQuarter(quarter.reportDate)).filter((_, index) => index === 0 || index === trend.length - 1 || index === Math.floor(trend.length / 2))} height={235} ariaLabel={`${manager.name} reported 13F value by quarter, in billions of dollars`} />
        <div className="trend-caption"><span>{formatQuarter(trend[0]?.reportDate)} <b>{compactMoney(trend[0]?.totalValue)}</b></span><span>{formatQuarter(current.reportDate)} <b>{compactMoney(current.totalValue)}</b></span></div>
      </section>
    </div>

    <div className="institutional-insight-grid">
      <section className="panel overlap-panel">
        <div className="panel-heading"><div><span className="eyebrow">Manager overlap</span><h2>Shared conviction</h2><p>Compare disclosed security overlap—not investment philosophy.</p></div><label className="compact-select"><span>Compare with</span><select value={compareManager?.id ?? ""} onChange={(event) => setCompareId(event.target.value)}>{dataset.managers.filter((item) => item.id !== manager.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
        <div className="overlap-score"><strong>{overlap.length}</strong><span>shared positions</span><em>{overlapWeight.toFixed(1)}% of {manager.name}&apos;s reported value</em></div>
        <div className="overlap-list">{overlap.slice(0, 8).map((holding) => <button key={holding.cusip} disabled={!holding.symbol} onClick={() => holding.symbol && onSelect(holding.symbol)}><StockMark symbol={holding.symbol ?? holding.issuer.slice(0, 2)} size="sm" /><span><b>{holding.symbol ?? holding.issuer}</b><small>{holding.issuer}</small></span><strong>{holding.weight.toFixed(1)}%</strong></button>)}{!overlap.length && <div className="table-empty">No shared positions in the loaded top holdings.</div>}</div>
      </section>
      <section className="panel consensus-panel">
        <div className="panel-heading"><div><span className="eyebrow">Cross-manager lens</span><h2>Consensus holdings</h2><p>Names appearing across the latest loaded filings.</p></div><Tag tone="blue">{dataset.managers.length} managers</Tag></div>
        <div className="consensus-list">{consensus.map((item, index) => <button key={item.cusip} disabled={!item.symbol} onClick={() => item.symbol && onSelect(item.symbol)}><span className="rank-number">{String(index + 1).padStart(2, "0")}</span><StockMark symbol={item.symbol ?? item.issuer.slice(0, 2)} size="sm" /><span><b>{item.symbol ?? item.issuer}</b><small>{item.managers.slice(0, 2).join(" · ")}{item.managers.length > 2 ? ` +${item.managers.length - 2}` : ""}</small></span><strong>{item.managers.length}<small>managers</small></strong></button>)}</div>
      </section>
    </div>

    <section className="panel change-panel">
      <div className="panel-heading"><div><span className="eyebrow">Quarter-over-quarter</span><h2>What changed</h2><p>Share-count change separates manager activity from price movement.</p></div><div className="change-summary"><span className="positive">+{newCount} new</span><span>↑ {increasedCount} increased</span><span className="negative">↓ {reducedCount} reduced</span></div></div>
      <div className="table-toolbar"><div className="filter-tabs">{(["all", "new", "increased", "reduced", "exited"] as ChangeFilter[]).map((item) => <button key={item} className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><label className="table-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter positions" /></label></div>
      <div className="institutional-table"><div className="institutional-row institutional-row--head"><span>Company</span><span>Portfolio</span><span>Reported value</span><span>Shares</span><span>Quarter change</span></div>{rows.slice(0, 40).map((holding) => <HoldingRow key={`${holding.cusip}-${holding.optionType ?? "long"}`} holding={holding} onSelect={onSelect} />)}</div>
      {!rows.length && <div className="table-empty">No positions match this view.</div>}
    </section>

    <section className="methodology-strip"><div><b>Read 13F data carefully</b><p>These filings omit short positions, cash, most bonds, and many foreign securities. They can be 45 days stale and may later be amended.</p></div><a href={dataset.source ? "https://www.sec.gov/divisions/investment/13ffaq" : current.sourceUrl} target="_blank" rel="noreferrer">SEC 13F guide ↗</a></section>
  </div>;
}

function HoldingRow({ holding, onSelect }: { holding: ReturnType<typeof compareInstitutionalQuarters>["changes"][number]; onSelect: (symbol: string) => void }) {
  return <button className="institutional-row" onClick={() => holding.symbol && onSelect(holding.symbol)} disabled={!holding.symbol}><span className="company-cell"><StockMark symbol={holding.symbol ?? holding.issuer.slice(0, 2).toUpperCase()} size="sm" /><span><b>{holding.symbol ?? holding.issuer}</b><small>{holding.symbol ? holding.issuer : holding.securityClass}</small></span></span><span><i className="allocation-bar"><i style={{ width: `${Math.min(100, holding.weight * 3)}%` }} /></i><small>{holding.weight.toFixed(2)}%</small></span><span><b>{compactMoney(holding.value)}</b><small>{holding.optionType ? `${holding.optionType} option` : holding.sector}</small></span><span><b>{compactNumber(holding.shares)}</b><small>{holding.previousShares ? `${compactNumber(holding.previousShares)} prior` : "New position"}</small></span><span><Tag tone={holding.changeType === "new" || holding.changeType === "increased" ? "good" : holding.changeType === "reduced" ? "warn" : "neutral"}>{holding.changeType}</Tag><small className={(holding.shareChange ?? 0) >= 0 ? "positive" : "negative"}>{holding.shareChange == null ? "New" : `${holding.shareChange >= 0 ? "+" : ""}${holding.shareChange.toFixed(1)}% shares`}</small></span></button>;
}

function IntelligenceLoading({ failed, label }: { failed: boolean; label: string }) { return <div className="panel intelligence-loading"><span>{failed ? "!" : "···"}</span><h2>{failed ? `${label} could not be loaded` : `Reading ${label}`}</h2><p>{failed ? "Refresh to retry the static research snapshot." : "Normalizing official filings and position changes."}</p></div>; }
function initials(value: string) { return value.split(/\s+|\//).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function formatQuarter(value?: string) { if (!value) return "—"; const date = new Date(`${value}T00:00:00Z`); return `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`; }
function shortDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function compactMoney(value = 0) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value); }
function compactNumber(value = 0) { return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value); }
