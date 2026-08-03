"use client";

import { useEffect, useMemo, useState } from "react";
import type { GovernmentDataset, GovernmentTransaction } from "@/src/domain/government";
import { disclosedPortfolioRange, rangeMidpoint } from "@/src/domain/government";
import { StockMark, Tag } from "@/src/components/ui";

type ActionFilter = "all" | "purchase" | "sale" | "exchange";

export function GovernmentInvestments({ onSelect }: { onSelect: (symbol: string) => void }) {
  const [dataset, setDataset] = useState<GovernmentDataset | null>(null);
  const [failed, setFailed] = useState(false);
  const [officialId, setOfficialId] = useState("nancy-pelosi");
  const [filter, setFilter] = useState<ActionFilter>("all");
  const [query, setQuery] = useState("");
  useEffect(() => {
    let active = true;
    fetch("./data/government-data.json").then((response) => { if (!response.ok) throw new Error(); return response.json() as Promise<GovernmentDataset>; }).then((payload) => { if (active) setDataset(payload); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  const official = dataset?.officials.find((item) => item.id === officialId) ?? dataset?.officials[0];
  const transactions = useMemo(() => (official?.transactions ?? []).filter((transaction) => (filter === "all" || transaction.type === filter) && `${transaction.asset} ${transaction.symbol}`.toLowerCase().includes(query.toLowerCase())), [official, filter, query]);
  if (!dataset) return <div className="panel intelligence-loading"><span>{failed ? "!" : "···"}</span><h2>{failed ? "Disclosure data could not be loaded" : "Reading official disclosures"}</h2><p>{failed ? "Refresh to retry the static research snapshot." : "Normalizing ranges and transaction reports."}</p></div>;
  if (!official) return null;
  const portfolioRange = disclosedPortfolioRange(official.holdings);
  const recent = official.transactions[0];
  const purchases = official.transactions.filter((transaction) => transaction.type === "purchase").length;
  const sales = official.transactions.filter((transaction) => transaction.type === "sale").length;
  const tickerCounts = new Map<string, number>();
  official.transactions.forEach((transaction) => tickerCounts.set(transaction.symbol, (tickerCounts.get(transaction.symbol) ?? 0) + 1));
  const mostActive = [...tickerCounts].sort((a, b) => b[1] - a[1])[0];

  return <div className="view-stack government-view">
    <section className="section-hero intelligence-hero intelligence-hero--government">
      <div><span className="hero-panel__kicker"><i />Public disclosure explorer</span><h1>See the filing.<br /><em>Understand the limits.</em></h1><p>Turn difficult-to-read public financial disclosures into an explorable record of reported holdings and transaction ranges.</p></div>
      <aside className="disclosure-primer"><span className="eyebrow">What this is—and is not</span><div><strong>Ranges</strong><p>Dollar bands, never exact position sizes.</p></div><div><strong>Delayed</strong><p>Transactions can be reported weeks later.</p></div><div><strong>Household</strong><p>Self, spouse, joint, and dependent assets may appear.</p></div></aside>
    </section>

    <section className="official-directory" aria-label="Select a public official">{dataset.officials.map((item) => <button key={item.id} className={item.id === official.id ? "is-active" : ""} onClick={() => setOfficialId(item.id)}><span className={`party-mark party-mark--${item.party.toLowerCase()}`}>{item.party[0]}</span><span><b>{item.name}</b><small>{item.chamber} · {item.state}{item.district ? `-${item.district}` : ""}</small></span><em>{item.transactions.length}</em></button>)}</section>

    <section className="official-profile panel">
      <div className="official-identity"><span className={`party-mark party-mark--${official.party.toLowerCase()} party-mark--large`}>{official.party[0]}</span><div><span className="eyebrow">{official.party} · {official.chamber}</span><h2>{official.name}</h2><p>{official.role} · {official.state}{official.district ? ` District ${official.district}` : ""}</p></div></div>
      <div className="official-freshness"><span className="eyebrow">Holding snapshot</span><b>{official.holdingsAsOf ? `Annual report for ${official.holdingsAsOf.slice(0, 4)}` : "No annual holdings parsed"}</b><small>Transactions shown separately below</small></div>
      {official.annualFilingUrl ? <a className="secondary-button" href={official.annualFilingUrl} target="_blank" rel="noreferrer">Verify annual filing ↗</a> : <a className="secondary-button" href="https://disclosures-clerk.house.gov/FinancialDisclosure" target="_blank" rel="noreferrer">Search official records ↗</a>}
    </section>

    <section className="government-metrics">
      <article><span>Disclosed holding range</span><strong>{official.holdings.length ? `${compactMoney(portfolioRange.minimum)}–${compactMoney(portfolioRange.maximum)}` : "Not available"}</strong><small>{official.holdings.length} parsed securities · household scope</small></article>
      <article><span>Recent actions</span><strong>{official.transactions.length}</strong><small>{purchases} purchases · {sales} sales in loaded filings</small></article>
      <article><span>Most active ticker</span><strong>{mostActive?.[0] ?? "—"}</strong><small>{mostActive ? `${mostActive[1]} disclosed actions` : "No actions parsed"}</small></article>
      <article><span>Latest transaction</span><strong>{recent ? shortDate(recent.transactionDate) : "—"}</strong><small>{recent ? `${recent.type} · ${recent.symbol}` : "No transaction found"}</small></article>
    </section>

    <div className="government-grid">
      <section className="panel disclosed-holdings">
        <div className="panel-heading"><div><span className="eyebrow">Annual disclosure</span><h2>Reported holdings</h2><p>Bars use range midpoints for relative scale only.</p></div><Tag tone="warn">Estimated ranges</Tag></div>
        {official.holdings.length ? <div key="holdings" className="range-holdings">{official.holdings.slice(0, 18).map((holding, index) => { const midpoint = rangeMidpoint(holding.value); const max = Math.max(...official.holdings.map((item) => rangeMidpoint(item.value))); return <button key={`${holding.symbol}-${holding.owner}-${holding.assetType}-${index}`} onClick={() => onSelect(holding.symbol)}><span className="company-cell"><StockMark symbol={holding.symbol} size="sm" /><span><b>{holding.symbol}</b><small>{holding.asset}</small></span></span><span className="range-visual"><i style={{ width: `${Math.max(3, (midpoint / max) * 100)}%` }} /><small>{holding.value.label}</small></span><span><Tag tone="neutral">{holding.owner}</Tag><small>{holding.assetType}</small></span></button>; })}</div> : <div key="empty" className="disclosure-empty"><span>Annual snapshot unavailable</span><h3>Use the transaction timeline</h3><p>The official search returned transaction reports, but no compatible annual holding table. We do not infer a current portfolio from trades alone.</p></div>}
      </section>
      <section className="panel disclosure-insight">
        <div className="panel-heading"><div><span className="eyebrow">Interpretation guide</span><h2>Precision without false certainty</h2></div></div>
        <div className="range-example"><span>$15K</span><i><i /></i><span>$50K</span></div>
        <p>A disclosed <b>$15,001–$50,000</b> transaction could be anywhere in that band. TIDE uses the midpoint only for visual comparison.</p>
        <dl><div><dt>Ownership</dt><dd>Includes {new Set(official.holdings.map((holding) => holding.owner)).size || "unknown"} owner type(s)</dd></div><div><dt>Options</dt><dd>{official.holdings.filter((holding) => holding.assetType === "option").length} reported positions</dd></div><div><dt>Largest disclosed band</dt><dd>{official.holdings[0]?.value.label ?? "—"}</dd></div></dl>
        <div className="civic-note"><b>Research standard</b><span>We label disclosures, link originals, and do not describe estimated ranges as exact wealth or a live portfolio.</span></div>
      </section>
    </div>

    <section className="panel transaction-timeline">
      <div className="panel-heading"><div><span className="eyebrow">Periodic transaction reports</span><h2>Disclosed action timeline</h2><p>Purchases and sales are separate from the annual holding snapshot.</p></div><Tag tone="blue">Official House records</Tag></div>
      <div className="table-toolbar"><div className="filter-tabs">{(["all", "purchase", "sale", "exchange"] as ActionFilter[]).map((item) => <button key={item} className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><label className="table-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ticker or asset" /></label></div>
      <div className="timeline-list">{transactions.slice(0, 80).map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} onSelect={onSelect} />)}</div>
      {!transactions.length && <div className="table-empty">No disclosed transactions match this view.</div>}
    </section>

    <section className="methodology-strip"><div><b>Official source, transformed for clarity</b><p>{dataset.methodology}</p></div><a href="https://disclosures-clerk.house.gov/FinancialDisclosure" target="_blank" rel="noreferrer">House disclosure database ↗</a></section>
  </div>;
}

function TransactionRow({ transaction, onSelect }: { transaction: GovernmentTransaction; onSelect: (symbol: string) => void }) {
  const tone = transaction.type === "purchase" ? "good" : transaction.type === "sale" ? "warn" : "blue";
  return <article><div className="timeline-date"><strong>{new Date(`${transaction.transactionDate}T00:00:00Z`).getUTCDate()}</strong><span>{new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${transaction.transactionDate}T00:00:00Z`))}</span></div><i className={`timeline-node timeline-node--${transaction.type}`} /><button className="company-cell" onClick={() => onSelect(transaction.symbol)}><StockMark symbol={transaction.symbol} size="sm" /><span><b>{transaction.symbol} · {transaction.asset}</b><small>{transaction.owner} · {transaction.assetType}{transaction.partial ? " · partial" : ""}</small></span></button><Tag tone={tone}>{transaction.type}</Tag><div className="timeline-amount"><b>{transaction.amount.label}</b><small>disclosed range</small></div><a href={transaction.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open source filing for ${transaction.symbol}`}>↗</a></article>;
}

function compactMoney(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value); }
function shortDate(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
