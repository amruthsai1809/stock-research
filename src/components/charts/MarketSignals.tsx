"use client";

import type { AnalyzedStock } from "@/src/domain/stock";
import type { ResearchSignal } from "@/src/modules/stock-intelligence/domain/types";
import { Tag } from "@/src/components/ui";

export function MarketSignals({ stock, signal }: { stock: AnalyzedStock; signal?: ResearchSignal }) {
  const transactions = signal?.insider.transactions ?? [];
  const purchaseValue = transactions.filter((item) => item.action === "purchase").reduce((sum, item) => sum + (item.value ?? 0), 0);
  const saleValue = transactions.filter((item) => item.action === "sale").reduce((sum, item) => sum + (item.value ?? 0), 0);
  const analyst = signal?.analyst;
  const short = signal?.shortInterest;
  const institutional = signal?.institutional;
  return (
    <div className="market-signals">
      <section className="signal-summary-grid">
        <SignalSummary label="Insider open-market flow" value={transactions.length ? compactMoney(purchaseValue - saleValue, true) : "No recent trades"} detail={`${transactions.length} SEC transaction lines`} tone={purchaseValue > saleValue ? "good" : saleValue > purchaseValue ? "warn" : "neutral"} />
        <SignalSummary label="Analyst consensus" value={analyst?.available ? titleCase(analyst.recommendationKey ?? "available") : "Unavailable"} detail={analyst?.available ? `${analyst.numberOfAnalysts} opinions · ${formatPercent(analyst.targetUpside)} target upside` : analyst?.reason ?? "No analyst snapshot"} tone={(analyst?.recommendationMean ?? 3) < 2.5 ? "good" : (analyst?.recommendationMean ?? 3) > 3.2 ? "warn" : "neutral"} />
        <SignalSummary label="Short interest" value={short?.available ? formatUnsignedPercent((short.shortPercentOfFloat ?? 0) * 100) : "Unavailable"} detail={short?.available ? `${formatNumber(short.sharesShort)} shares · ${formatNumber(short.daysToCover)} days to cover` : "Delayed exchange report not loaded"} tone={(short?.shortPercentOfFloat ?? 0) > 0.12 ? "warn" : "neutral"} />
        <SignalSummary label="Tracked long managers" value={institutional?.reportDate ? String(institutional.managersHolding) : "Unavailable"} detail={institutional?.reportDate ? `${institutional.managersNew + institutional.managersIncreased} added/increased · ${institutional.managersReduced + institutional.managersExited} reduced/exited` : "No covered 13F position"} tone={(institutional?.managersNew ?? 0) + (institutional?.managersIncreased ?? 0) > (institutional?.managersReduced ?? 0) + (institutional?.managersExited ?? 0) ? "good" : "neutral"} />
      </section>

      <div className="market-signal-grid">
        <InsiderActivity signal={signal} />
        <AnalystConsensus stock={stock} signal={signal} />
        <ShortPositioning signal={signal} />
        <LongPositioning signal={signal} />
      </div>
    </div>
  );
}

function SignalSummary({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "good" | "warn" | "neutral" }) {
  return <article className={`signal-summary signal-summary--${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function InsiderActivity({ signal }: { signal?: ResearchSignal }) {
  const transactions = signal?.insider.transactions ?? [];
  const months = aggregateInsiderMonths(transactions);
  const max = Math.max(1, ...months.flatMap((month) => [month.purchases, month.sales]));
  return <section className="panel market-signal-card market-signal-card--wide">
    <div className="panel-heading"><div><span className="eyebrow">SEC Forms 4 / 4-A</span><h2>Insider transaction tape</h2><p>Open-market purchases and sales only; planned 10b5-1 transactions remain identified.</p></div><span className="method-chip">As of {shortDate(signal?.insider.asOf ?? null)}</span></div>
    {transactions.length ? <>
      <div className="insider-flow-chart" role="img" aria-label="Monthly corporate insider open-market purchase and sale values">
        {months.map((month) => <div key={month.key}><span className="insider-flow-chart__buy"><i style={{ height: `${Math.max(month.purchases ? 3 : 0, (month.purchases / max) * 100)}%` }} /></span><span className="insider-flow-chart__zero" /><span className="insider-flow-chart__sell"><i style={{ height: `${Math.max(month.sales ? 3 : 0, (month.sales / max) * 100)}%` }} /></span><b>{month.label}</b></div>)}
      </div>
      <div className="insider-legend"><span><i className="is-buy" />Purchases</span><span><i className="is-sale" />Sales</span><small>Bar height represents disclosed transaction value</small></div>
      <div className="signal-table-wrap"><table className="data-table signal-table"><thead><tr><th>Date</th><th>Insider</th><th>Action</th><th>Value</th><th>After trade</th><th>Source</th></tr></thead><tbody>{transactions.slice(0, 8).map((trade) => <tr key={`${trade.accession}-${trade.ownerName}-${trade.transactionDate}-${trade.shares}`}><td>{shortDate(trade.transactionDate)}</td><td><b>{trade.ownerName}</b><small>{trade.ownerRole}</small></td><td><Tag tone={trade.action === "purchase" ? "good" : "warn"}>{trade.action}</Tag>{trade.rule10b51 && <small>10b5-1</small>}</td><td>{trade.value == null ? `${formatNumber(trade.shares)} sh.` : compactMoney(trade.value)}</td><td>{trade.sharesOwnedAfter == null ? "—" : `${formatNumber(trade.sharesOwnedAfter)} sh.`}</td><td><a href={trade.sourceUrl} target="_blank" rel="noreferrer">Filing ↗</a></td></tr>)}</tbody></table></div>
    </> : <Unavailable title="No open-market transactions in the loaded filing window" detail="This is neutral. Equity awards and other non-open-market transaction codes are intentionally excluded." />}
  </section>;
}

function AnalystConsensus({ stock, signal }: { stock: AnalyzedStock; signal?: ResearchSignal }) {
  const analyst = signal?.analyst;
  if (!analyst?.available) return <section className="panel market-signal-card"><div className="panel-heading"><div><span className="eyebrow">Delayed consensus</span><h2>Analyst view</h2></div></div><Unavailable title="Analyst consensus unavailable" detail={analyst?.reason ?? "No public snapshot was loaded."} /></section>;
  const currentTrend = analyst.trend[0];
  const ratings = currentTrend ? [
    { label: "Strong buy", value: currentTrend.strongBuy, tone: "strong-buy" },
    { label: "Buy", value: currentTrend.buy, tone: "buy" },
    { label: "Hold", value: currentTrend.hold, tone: "hold" },
    { label: "Sell", value: currentTrend.sell, tone: "sell" },
    { label: "Strong sell", value: currentTrend.strongSell, tone: "strong-sell" },
  ] : [];
  const total = ratings.reduce((sum, item) => sum + item.value, 0);
  const targets = [analyst.targetLow, stock.latestPrice, analyst.targetMean, analyst.targetHigh].filter((value): value is number => value != null);
  const minimum = Math.min(...targets);
  const maximum = Math.max(...targets);
  const span = Math.max(1, maximum - minimum);
  const position = (value: number | null) => value == null ? 0 : ((value - minimum) / span) * 100;
  return <section className="panel market-signal-card">
    <div className="panel-heading"><div><span className="eyebrow">Delayed consensus</span><h2>Analyst view</h2><p>Distribution, target range, and recent revisions.</p></div><span className="method-chip">{analyst.numberOfAnalysts} analysts</span></div>
    <div className="rating-distribution" aria-label="Analyst rating distribution">{ratings.map((item) => item.value ? <span key={item.label} className={`rating-distribution__${item.tone}`} style={{ width: `${(item.value / Math.max(1, total)) * 100}%` }} title={`${item.label}: ${item.value}`} /> : null)}</div>
    <div className="rating-labels">{ratings.map((item) => <span key={item.label}><i className={`rating-distribution__${item.tone}`} />{item.label}<b>{item.value}</b></span>)}</div>
    <div className="target-ladder"><div><span style={{ left: `${position(analyst.targetLow)}%` }} /><span className="target-ladder__price" style={{ left: `${position(stock.latestPrice)}%` }} /><span className="target-ladder__mean" style={{ left: `${position(analyst.targetMean)}%` }} /><span style={{ left: `${position(analyst.targetHigh)}%` }} /></div><dl><span><dt>Low</dt><dd>{money(analyst.targetLow)}</dd></span><span><dt>Last close</dt><dd>{money(stock.latestPrice)}</dd></span><span><dt>Mean</dt><dd>{money(analyst.targetMean)}</dd></span><span><dt>High</dt><dd>{money(analyst.targetHigh)}</dd></span></dl></div>
    <div className="analyst-actions">{analyst.actions.slice(0, 5).map((action, index) => <article key={`${action.date}-${action.firm}-${index}`}><span className={`revision-dot revision-dot--${action.action}`} /><div><b>{action.firm}</b><small>{action.fromGrade && action.fromGrade !== action.toGrade ? `${action.fromGrade} → ` : ""}{action.toGrade || titleCase(action.action)}</small></div><span>{shortDate(action.date)}{action.currentPriceTarget != null && <small>{action.priceTargetAction || "Target"} {money(action.currentPriceTarget)}</small>}</span></article>)}</div>
    <small className="signal-lag-note">Targets and ratings are third-party opinions, not TIDE forecasts. Snapshot dated {shortDate(analyst.asOf)}.</small>
  </section>;
}

function ShortPositioning({ signal }: { signal?: ResearchSignal }) {
  const item = signal?.shortInterest;
  if (!item?.available) return <section className="panel market-signal-card"><div className="panel-heading"><div><span className="eyebrow">Reported positioning</span><h2>Short interest</h2></div></div><Unavailable title="Short-interest snapshot unavailable" detail="Official short interest is periodic rather than real time." /></section>;
  const current = item.sharesShort ?? 0;
  const prior = item.sharesShortPriorMonth ?? 0;
  const max = Math.max(1, current, prior);
  const change = prior > 0 ? ((current / prior) - 1) * 100 : null;
  return <section className="panel market-signal-card">
    <div className="panel-heading"><div><span className="eyebrow">Reported positioning</span><h2>Short interest</h2><p>Periodic exchange-reported positioning, never presented as live.</p></div><span className="method-chip">{shortDate(item.asOf)}</span></div>
    <div className="short-comparison"><div><span>Prior report</span><i><i style={{ width: `${(prior / max) * 100}%` }} /></i><b>{formatNumber(prior)}</b></div><div><span>Latest report</span><i><i style={{ width: `${(current / max) * 100}%` }} /></i><b>{formatNumber(current)}</b></div></div>
    <div className="signal-stat-grid"><span><small>Month change</small><b className={(change ?? 0) > 0 ? "negative" : "positive"}>{formatPercent(change)}</b></span><span><small>Float short</small><b>{formatUnsignedPercent((item.shortPercentOfFloat ?? 0) * 100)}</b></span><span><small>Days to cover</small><b>{formatNumber(item.daysToCover)}</b></span><span><small>% outstanding</small><b>{formatUnsignedPercent((item.sharesPercentOutstanding ?? 0) * 100)}</b></span></div>
  </section>;
}

function LongPositioning({ signal }: { signal?: ResearchSignal }) {
  const item = signal?.institutional;
  const ownership = signal?.shortInterest;
  return <section className="panel market-signal-card">
    <div className="panel-heading"><div><span className="eyebrow">Long ownership</span><h2>Institutional positioning</h2><p>Ownership snapshot plus activity among covered active 13F managers.</p></div><span className="method-chip">13F · delayed</span></div>
    <div className="ownership-donut-row"><div className="ownership-ring" style={{ "--ownership": `${Math.min(100, (ownership?.institutionalOwnership ?? 0) * 100)}%` } as React.CSSProperties}><span><b>{formatUnsignedPercent((ownership?.institutionalOwnership ?? 0) * 100)}</b><small>institutional</small></span></div><dl><div><dt>Insider ownership</dt><dd>{formatUnsignedPercent((ownership?.insiderOwnership ?? 0) * 100)}</dd></div><div><dt>Covered managers</dt><dd>{item?.managersHolding ?? 0}</dd></div><div><dt>Portfolio period</dt><dd>{shortDate(item?.reportDate ?? null)}</dd></div></dl></div>
    <div className="manager-flow"><span className="is-positive"><b>+{(item?.managersNew ?? 0) + (item?.managersIncreased ?? 0)}</b><small>new or increased</small></span><i /><span className="is-negative"><b>−{(item?.managersReduced ?? 0) + (item?.managersExited ?? 0)}</b><small>reduced or exited</small></span></div>
    <small className="signal-lag-note">13F holdings can be filed up to 45 days after quarter end and omit shorts and many non-U.S. instruments.</small>
  </section>;
}

function Unavailable({ title, detail }: { title: string; detail: string }) { return <div className="signal-unavailable"><span>—</span><b>{title}</b><p>{detail}</p></div>; }

function aggregateInsiderMonths(transactions: NonNullable<ResearchSignal>["insider"]["transactions"]) {
  const latest = transactions[0]?.transactionDate ? new Date(`${transactions[0].transactionDate}T00:00:00Z`) : new Date();
  return Array.from({ length: 8 }, (_, offset) => {
    const date = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth() - (7 - offset), 1));
    const key = date.toISOString().slice(0, 7);
    const rows = transactions.filter((item) => item.transactionDate.startsWith(key));
    return { key, label: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date), purchases: rows.filter((item) => item.action === "purchase").reduce((sum, item) => sum + (item.value ?? 0), 0), sales: rows.filter((item) => item.action === "sale").reduce((sum, item) => sum + (item.value ?? 0), 0) };
  });
}

function shortDate(value: string | null) { return value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : "Unavailable"; }
function compactMoney(value: number, signed = false) { const prefix = signed && value > 0 ? "+" : ""; return `${prefix}${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value)}`; }
function money(value: number | null) { return value == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
function formatNumber(value: number | null) { return value == null ? "—" : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value); }
function formatPercent(value: number | null) { return value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`; }
function formatUnsignedPercent(value: number | null) { return value == null ? "—" : `${value.toFixed(1)}%`; }
function titleCase(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
