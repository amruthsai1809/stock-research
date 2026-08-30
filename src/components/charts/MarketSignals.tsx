"use client";

import { useMemo, useState } from "react";
import type { ResearchStock } from "@/src/domain/stock";
import type { ResearchSignal } from "@/src/modules/stock-intelligence/domain/types";
import { Tag } from "@/src/components/ui";

export function MarketSignals({ stock, signal }: { stock: ResearchStock; signal?: ResearchSignal }) {
  const insider = signal?.insider.summary;
  const purchaseValue = insider?.purchaseValue ?? 0;
  const saleValue = insider?.saleValue ?? 0;
  const transactionCount = (insider?.purchaseCount ?? 0) + (insider?.saleCount ?? 0);
  const analyst = signal?.analyst;
  const short = signal?.shortInterest;
  const institutional = signal?.institutional;
  const shortRatio = short?.shortPercentOfFloat ?? short?.sharesPercentOutstanding ?? null;

  return <div className="market-signals">
    <section className="signal-summary-grid">
      <SignalSummary label="Insider open-market flow" value={transactionCount ? compactMoney(purchaseValue - saleValue, true) : "No recent trades"} detail={`${transactionCount} transaction lines · rolling year`} tone={purchaseValue > saleValue ? "good" : saleValue > purchaseValue ? "warn" : "neutral"} />
      <SignalSummary label="Analyst consensus" value={analyst?.available ? titleCase(analyst.recommendationKey ?? "available") : "Unavailable"} detail={analyst?.available ? `${analyst.numberOfAnalysts} opinions · ${formatPercent(analyst.targetUpside)} target upside` : analyst?.reason ?? "No analyst snapshot"} tone={(analyst?.recommendationMean ?? 3) < 2.5 ? "good" : (analyst?.recommendationMean ?? 3) > 3.2 ? "warn" : "neutral"} />
      <SignalSummary label="Short interest" value={short?.available ? formatUnsignedPercent(shortRatio == null ? null : shortRatio * 100) : "Unavailable"} detail={short?.available ? `${formatNumber(short.sharesShort)} shares · ${formatNumber(short.daysToCover)} days to cover` : "Official periodic report not loaded"} tone={(shortRatio ?? 0) > 0.12 ? "warn" : "neutral"} />
      <SignalSummary label="Tracked long managers" value={institutional?.reportDate ? String(institutional.managersHolding) : "Unavailable"} detail={institutional?.reportDate ? `${institutional.managersReported}/${institutional.expectedManagers} managers reported · ${shortDate(institutional.reportDate)}` : "No covered 13F period"} tone={(institutional?.managersNew ?? 0) + (institutional?.managersIncreased ?? 0) > (institutional?.managersReduced ?? 0) + (institutional?.managersExited ?? 0) ? "good" : "neutral"} />
    </section>
    <div className="market-signal-grid">
      <InsiderActivity key={signal?.symbol ?? "unavailable"} signal={signal} />
      <AnalystConsensus stock={stock} signal={signal} />
      <ShortPositioning signal={signal} />
      <LongPositioning signal={signal} />
    </div>
  </div>;
}

export function MarketSignalPreview({ signal, onOpen }: { signal?: ResearchSignal; onOpen: () => void }) {
  const summary = signal?.insider.summary;
  const short = signal?.shortInterest;
  const institutional = signal?.institutional;
  const insiderCount = (summary?.purchaseCount ?? 0) + (summary?.saleCount ?? 0);
  const shortRatio = short?.shortPercentOfFloat ?? short?.sharesPercentOutstanding ?? null;
  return <section className="panel signal-preview">
    <div className="panel-heading"><div><span className="eyebrow">Ownership & activity</span><h2>Positioning snapshot</h2><p>Official insider, short-interest, and tracked 13F disclosures—each on its own reporting clock.</p></div><button className="text-button" onClick={onOpen}>Open full analysis →</button></div>
    <div className="signal-preview__grid">
      <span><small>Insider open-market lines</small><b>{signal ? insiderCount : "—"}</b><em>Rolling year · {shortDate(signal?.insider.asOf ?? null)}</em></span>
      <span><small>Reported short position</small><b>{short?.available ? formatUnsignedPercent(shortRatio == null ? null : shortRatio * 100) : "—"}</b><em>{short?.shortPercentOfFloat != null ? "of float" : "of estimated shares"} · {shortDate(short?.asOf ?? null)}</em></span>
      <span><small>Tracked managers holding</small><b>{institutional?.reportDate ? institutional.managersHolding : "—"}</b><em>{institutional?.managersReported ?? 0}/{institutional?.expectedManagers ?? 0} reported · {shortDate(institutional?.reportDate ?? null)}</em></span>
    </div>
  </section>;
}

function SignalSummary({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "good" | "warn" | "neutral" }) {
  return <article className={`signal-summary signal-summary--${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function InsiderActivity({ signal }: { signal?: ResearchSignal }) {
  const [windowDays, setWindowDays] = useState<30 | 90 | 366>(90);
  const [actionFilter, setActionFilter] = useState<"all" | "purchase" | "sale">("all");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [visibleRows, setVisibleRows] = useState(12);
  const transactions = useMemo(() => {
    const rows = signal?.insider.transactions ?? [];
    const anchor = signal?.insider.asOf ? new Date(`${signal.insider.asOf}T00:00:00Z`) : new Date();
    const cutoff = new Date(anchor.getTime() - windowDays * 86_400_000).toISOString().slice(0, 10);
    return rows.filter((item) => item.transactionDate >= cutoff);
  }, [signal, windowDays]);
  const months = aggregateInsiderMonths(transactions, signal?.insider.asOf ?? null, windowDays);
  const max = Math.max(1, ...months.flatMap((month) => [month.purchases, month.sales]));
  const purchaseCount = transactions.filter((trade) => trade.action === "purchase").length;
  const saleCount = transactions.length - purchaseCount;
  const tableTransactions = transactions.filter((trade) => (
    (actionFilter === "all" || trade.action === actionFilter)
    && (!selectedMonth || trade.transactionDate.startsWith(selectedMonth))
  ));
  const selectedMonthLabel = months.find((month) => month.key === selectedMonth)?.longLabel;

  return <section className="panel market-signal-card market-signal-card--wide">
    <div className="panel-heading"><div><span className="eyebrow">SEC Forms 4 / 4-A</span><h2>Open-market insider activity</h2><p>Official transaction codes P and S only. Awards, option exercises, gifts, and tax withholding are excluded.</p></div><div className="signal-heading-actions"><div className="segmented-control segmented-control--compact" aria-label="Insider transaction window">{([30, 90, 366] as const).map((days) => <button type="button" key={days} className={windowDays === days ? "is-active" : ""} onClick={() => { setWindowDays(days); setSelectedMonth(null); setVisibleRows(12); }}>{days === 366 ? "1Y" : `${days}D`}</button>)}</div><span className="method-chip">As of {shortDate(signal?.insider.asOf ?? null)}</span></div></div>
    {transactions.length ? <>
      <div
        className="insider-flow-chart"
        style={{ "--insider-buckets": months.length } as React.CSSProperties}
        aria-label="Corporate insider open-market purchase and sale values by month"
      >{months.map((month) => {
        const hasActivity = month.purchases > 0 || month.sales > 0;
        return <button
          type="button"
          key={month.key}
          className={selectedMonth === month.key ? "is-selected" : ""}
          disabled={!hasActivity}
          aria-pressed={selectedMonth === month.key}
          aria-label={`${month.longLabel}: ${compactMoney(month.purchases)} purchases and ${compactMoney(month.sales)} sales`}
          onClick={() => { setSelectedMonth((current) => current === month.key ? null : month.key); setVisibleRows(12); }}
        ><span className="insider-flow-chart__buy"><i style={{ height: `${Math.max(month.purchases ? 3 : 0, (month.purchases / max) * 100)}%` }} /></span><span className="insider-flow-chart__zero" /><span className="insider-flow-chart__sell"><i style={{ height: `${Math.max(month.sales ? 3 : 0, (month.sales / max) * 100)}%` }} /></span><b>{month.label}</b></button>;
      })}</div>
      <div className="insider-legend"><span><i className="is-buy" />Purchases <b>{purchaseCount}</b></span><span><i className="is-sale" />Sales <b>{saleCount}</b></span><small>Disclosed transaction value · select a month to inspect it</small></div>
      <div className="insider-table-toolbar">
        <div className="segmented-control segmented-control--compact" aria-label="Filter insider transactions">
          <button type="button" className={actionFilter === "all" ? "is-active" : ""} onClick={() => { setActionFilter("all"); setVisibleRows(12); }}>All <span>{transactions.length}</span></button>
          <button type="button" className={actionFilter === "purchase" ? "is-active" : ""} onClick={() => { setActionFilter("purchase"); setVisibleRows(12); }}>Purchases <span>{purchaseCount}</span></button>
          <button type="button" className={actionFilter === "sale" ? "is-active" : ""} onClick={() => { setActionFilter("sale"); setVisibleRows(12); }}>Sales <span>{saleCount}</span></button>
        </div>
        <div aria-live="polite">
          {selectedMonthLabel && <button type="button" className="method-chip" onClick={() => { setSelectedMonth(null); setVisibleRows(12); }}>{selectedMonthLabel} ×</button>}
          <small>Showing {Math.min(visibleRows, tableTransactions.length)} of {tableTransactions.length}</small>
        </div>
      </div>
      {tableTransactions.length ? <>
        <div className="signal-table-wrap"><table className="data-table signal-table"><thead><tr><th>Date</th><th>Insider</th><th>Action</th><th>Value</th><th>After trade</th><th>Source</th></tr></thead><tbody>{tableTransactions.slice(0, visibleRows).map((trade) => <tr key={`${trade.accession}-${trade.ownerName}-${trade.transactionDate}-${trade.shares}`}><td>{shortDate(trade.transactionDate)}</td><td><b>{trade.ownerName}</b><small>{trade.ownerRole}</small></td><td><Tag tone={trade.action === "purchase" ? "good" : "warn"}>{trade.action}</Tag>{trade.rule10b51 && <small>10b5-1 plan</small>}</td><td>{trade.value == null ? `${formatNumber(trade.shares)} sh.` : compactMoney(trade.value)}</td><td>{trade.sharesOwnedAfter == null ? "—" : `${formatNumber(trade.sharesOwnedAfter)} sh.`}</td><td><a href={trade.sourceUrl} target="_blank" rel="noreferrer">SEC filing ↗</a></td></tr>)}</tbody></table></div>
        {visibleRows < tableTransactions.length && <button type="button" className="secondary-button insider-show-more" onClick={() => setVisibleRows((current) => current + 12)}>Show 12 more</button>}
      </> : <Unavailable title="No transactions match these filters" detail="Clear the month or action filter to restore the full transaction list." />}
      <details className="insider-methodology"><summary>Why this can differ from Robinhood</summary><p>Equity Lab reports raw SEC open-market purchase and sale lines. Robinhood’s TipRanks view also classifies Form 4 activity as informative or uninformative and may display grants, automatic transactions, and estimated values. The two charts therefore do not use the same transaction universe or aggregation.</p></details>
    </> : <Unavailable title={`No open-market transactions in the selected ${windowDays === 366 ? "year" : `${windowDays} days`}`} detail="This is neutral. Equity awards and other non-open-market transaction codes are intentionally excluded." />}
  </section>;
}

function AnalystConsensus({ stock, signal }: { stock: ResearchStock; signal?: ResearchSignal }) {
  const analyst = signal?.analyst;
  if (!analyst?.available) return <section className="panel market-signal-card"><div className="panel-heading"><div><span className="eyebrow">Delayed consensus</span><h2>Analyst view</h2></div></div><Unavailable title="Analyst consensus unavailable" detail={analyst?.reason ?? "No public snapshot was loaded."} /></section>;
  const trend = analyst.trend[0];
  const ratings = trend ? [
    { label: "Strong buy", value: trend.strongBuy, tone: "strong-buy" },
    { label: "Buy", value: trend.buy, tone: "buy" },
    { label: "Hold", value: trend.hold, tone: "hold" },
    { label: "Sell", value: trend.sell, tone: "sell" },
    { label: "Strong sell", value: trend.strongSell, tone: "strong-sell" },
  ] : [];
  const total = ratings.reduce((sum, item) => sum + item.value, 0);
  const targets = [analyst.targetLow, stock.latestPrice, analyst.targetMean, analyst.targetHigh].filter((value): value is number => value != null);
  const minimum = targets.length ? Math.min(...targets) : 0;
  const span = Math.max(1, (targets.length ? Math.max(...targets) : 1) - minimum);
  const position = (value: number | null) => value == null ? 0 : ((value - minimum) / span) * 100;
  return <section className="panel market-signal-card">
    <div className="panel-heading"><div><span className="eyebrow">Delayed consensus</span><h2>Analyst view</h2><p>Distribution, target range, and recent revisions.</p></div><span className="method-chip">{analyst.numberOfAnalysts} analysts</span></div>
    <div className="rating-distribution" aria-label="Analyst rating distribution">{ratings.map((item) => item.value ? <span key={item.label} className={`rating-distribution__${item.tone}`} style={{ width: `${(item.value / Math.max(1, total)) * 100}%` }} title={`${item.label}: ${item.value}`} /> : null)}</div>
    <div className="rating-labels">{ratings.map((item) => <span key={item.label}><i className={`rating-distribution__${item.tone}`} />{item.label}<b>{item.value}</b></span>)}</div>
    <div className="target-ladder"><div><span style={{ left: `${position(analyst.targetLow)}%` }} /><span className="target-ladder__price" style={{ left: `${position(stock.latestPrice)}%` }} /><span className="target-ladder__mean" style={{ left: `${position(analyst.targetMean)}%` }} /><span style={{ left: `${position(analyst.targetHigh)}%` }} /></div><dl><span><dt>Low</dt><dd>{money(analyst.targetLow)}</dd></span><span><dt>Last close</dt><dd>{money(stock.latestPrice)}</dd></span><span><dt>Mean</dt><dd>{money(analyst.targetMean)}</dd></span><span><dt>High</dt><dd>{money(analyst.targetHigh)}</dd></span></dl></div>
    <div className="analyst-actions">{analyst.actions.slice(0, 5).map((action, index) => <article key={`${action.date}-${action.firm}-${index}`}><span className={`revision-dot revision-dot--${action.action}`} /><div><b>{action.firm}</b><small>{action.fromGrade && action.fromGrade !== action.toGrade ? `${action.fromGrade} → ` : ""}{action.toGrade || titleCase(action.action)}</small></div><span>{shortDate(action.date)}{action.currentPriceTarget != null && <small>{action.priceTargetAction || "Target"} {money(action.currentPriceTarget)}</small>}</span></article>)}</div>
    <small className="signal-lag-note">Targets and ratings are third-party opinions, not product forecasts. Snapshot dated {shortDate(analyst.asOf)}.</small>
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
    <div className="panel-heading"><div><span className="eyebrow">Reported positioning</span><h2>Short interest</h2><p>Official periodic positioning, never presented as live.</p></div><span className="method-chip">{shortDate(item.asOf)}</span></div>
    <div className="short-comparison"><div><span>Prior report</span><i><i style={{ width: `${(prior / max) * 100}%` }} /></i><b>{formatNumber(prior)}</b></div><div><span>Latest report</span><i><i style={{ width: `${(current / max) * 100}%` }} /></i><b>{formatNumber(current)}</b></div></div>
    <div className="signal-stat-grid"><span><small>Report change</small><b className={(change ?? 0) > 0 ? "negative" : "positive"}>{formatPercent(change)}</b></span><span><small>Float short</small><b>{formatUnsignedPercent(item.shortPercentOfFloat == null ? null : item.shortPercentOfFloat * 100)}</b></span><span><small>Days to cover</small><b>{formatNumber(item.daysToCover)}</b></span><span><small>% outstanding</small><b>{formatUnsignedPercent(item.sharesPercentOutstanding == null ? null : item.sharesPercentOutstanding * 100)}</b></span></div>
    <small className="signal-lag-note">FINRA settlement snapshot · published twice monthly. {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">Open source file ↗</a>}</small>
  </section>;
}

function LongPositioning({ signal }: { signal?: ResearchSignal }) {
  const item = signal?.institutional;
  const progress = item?.expectedManagers ? (item.managersReported / item.expectedManagers) * 100 : 0;
  return <section className="panel market-signal-card market-signal-card--wide">
    <div className="panel-heading"><div><span className="eyebrow">Long ownership</span><h2>Institutional positioning</h2><p>Activity among covered managers for one consistent report period.</p></div><span className="method-chip">13F · delayed</span></div>
    <div className="ownership-donut-row"><div className="ownership-ring" style={{ "--ownership": `${Math.min(100, progress)}%` } as React.CSSProperties}><span><b>{item?.managersReported ?? 0}/{item?.expectedManagers ?? 0}</b><small>reported</small></span></div><dl><div><dt>Managers holding</dt><dd>{item?.managersHolding ?? 0}</dd></div><div><dt>Latest filing received</dt><dd>{shortDate(item?.filingDate ?? null)}</dd></div><div><dt>Portfolio period</dt><dd>{shortDate(item?.reportDate ?? null)}</dd></div></dl></div>
    <div className="manager-flow"><span className="is-positive"><b>+{(item?.managersNew ?? 0) + (item?.managersIncreased ?? 0)}</b><small>new or increased</small></span><i /><span className="is-negative"><b>−{(item?.managersReduced ?? 0) + (item?.managersExited ?? 0)}</b><small>reduced or exited</small></span></div>
    <small className="signal-lag-note">13F holdings can be filed up to 45 days after quarter end and omit shorts and many non-U.S. instruments.</small>
  </section>;
}

function Unavailable({ title, detail }: { title: string; detail: string }) { return <div className="signal-unavailable"><span>—</span><b>{title}</b><p>{detail}</p></div>; }

function aggregateInsiderMonths(
  transactions: ResearchSignal["insider"]["transactions"],
  asOf: string | null,
  windowDays: 30 | 90 | 366,
) {
  const latest = asOf ? new Date(`${asOf}T00:00:00Z`) : new Date();
  const bucketCount = windowDays === 366 ? 12 : windowDays === 90 ? 4 : 2;
  return Array.from({ length: bucketCount }, (_, offset) => {
    const date = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth() - (bucketCount - 1 - offset), 1));
    const key = date.toISOString().slice(0, 7);
    const rows = transactions.filter((item) => item.transactionDate.startsWith(key));
    return {
      key,
      label: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date),
      longLabel: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(date),
      purchases: rows.filter((item) => item.action === "purchase").reduce((sum, item) => sum + (item.value ?? 0), 0),
      sales: rows.filter((item) => item.action === "sale").reduce((sum, item) => sum + (item.value ?? 0), 0),
    };
  });
}

function shortDate(value: string | null) { return value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : "Unavailable"; }
function compactMoney(value: number, signed = false) { const prefix = signed && value > 0 ? "+" : ""; return `${prefix}${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value)}`; }
function money(value: number | null) { return value == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
function formatNumber(value: number | null) { return value == null ? "—" : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value); }
function formatPercent(value: number | null) { return value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`; }
function formatUnsignedPercent(value: number | null) { return value == null ? "—" : `${value.toFixed(1)}%`; }
function titleCase(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
