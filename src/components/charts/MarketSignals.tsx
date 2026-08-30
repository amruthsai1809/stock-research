"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { ResearchStock } from "@/src/domain/stock";
import {
  insiderActivityMeta,
  isAdministrativeActivity,
  isCompensationActivity,
  isPersonalInvestment,
  isSaleActivity,
  type InsiderActivityGroup,
} from "@/src/modules/stock-intelligence/domain/insiderActivity";
import type { InsiderTransaction, ResearchSignal } from "@/src/modules/stock-intelligence/domain/types";

type ActivityWindow = 30 | 90 | 366;
type ActivityView = "cash" | "ownership";
type ActivityFilter = "all" | InsiderActivityGroup;

export function MarketSignals({ stock, signal }: { stock: ResearchStock; signal?: ResearchSignal }) {
  const insider = signal?.insider.summary;
  const analyst = signal?.analyst;
  const short = signal?.shortInterest;
  const institutional = signal?.institutional;
  const shortRatio = short?.shortPercentOfFloat ?? short?.sharesPercentOutstanding ?? null;

  return <div className="market-signals">
    <section className="signal-summary-grid">
      <SignalSummary
        label="Personal insider investing"
        value={insider?.purchaseCount ? compactMoney(insider.purchaseValue) : "None reported"}
        detail={`${insider?.purchaseCount ?? 0} personal-capital purchase${insider?.purchaseCount === 1 ? "" : "s"} · rolling year`}
        tone={insider?.purchaseCount ? "good" : "neutral"}
      />
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

function SignalSummary({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "good" | "warn" | "neutral" }) {
  return <article className={`signal-summary signal-summary--${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function InsiderActivity({ signal }: { signal?: ResearchSignal }) {
  const pageSize = 8;
  const [windowDays, setWindowDays] = useState<ActivityWindow>(90);
  const [activeView, setActiveView] = useState<ActivityView>("cash");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const transactions = useMemo(() => {
    const rows = signal?.insider.transactions ?? [];
    const anchor = signal?.insider.asOf ? new Date(`${signal.insider.asOf}T00:00:00Z`) : new Date();
    const cutoff = new Date(anchor.getTime() - windowDays * 86_400_000).toISOString().slice(0, 10);
    return rows.filter((item) => item.transactionDate >= cutoff);
  }, [signal, windowDays]);
  const visibleByView = useMemo(() => activeView === "cash"
    ? transactions.filter((item) => isPersonalInvestment(item) || isSaleActivity(item))
    : transactions, [activeView, transactions]);
  const months = activeView === "cash"
    ? aggregateCashMonths(visibleByView, signal?.insider.asOf ?? null, windowDays)
    : aggregateOwnershipMonths(visibleByView, signal?.insider.asOf ?? null, windowDays);
  const personal = transactions.filter(isPersonalInvestment);
  const sales = transactions.filter(isSaleActivity);
  const compensation = transactions.filter(isCompensationActivity);
  const administrative = transactions.filter(isAdministrativeActivity);
  const filteredTransactions = visibleByView.filter((item) => {
    const meta = insiderActivityMeta(item.category);
    return (activityFilter === "all" || meta.group === activityFilter)
      && (!selectedMonth || item.transactionDate.startsWith(selectedMonth));
  });
  const pageCount = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const firstVisibleRow = safePage * pageSize;
  const lastVisibleRow = Math.min(firstVisibleRow + pageSize, filteredTransactions.length);
  const selectedMonthLabel = months.find((month) => month.key === selectedMonth)?.longLabel;
  const summary = signal?.insider.summary;

  const resetSelection = () => { setSelectedMonth(null); setPage(0); };
  const selectView = (view: ActivityView) => {
    setActiveView(view);
    setActivityFilter("all");
    resetSelection();
  };

  return <section className="panel market-signal-card market-signal-card--wide insider-workbench">
    <div className="panel-heading">
      <div><span className="eyebrow">SEC Forms 4 / 4-A</span><h2>Insider ownership & trades</h2><p>Personal investing is separated from sales, compensation, and administrative ownership changes.</p></div>
      <div className="signal-heading-actions"><div className="segmented-control segmented-control--compact" aria-label="Insider activity window">{([30, 90, 366] as const).map((days) => <button type="button" key={days} className={windowDays === days ? "is-active" : ""} onClick={() => { setWindowDays(days); resetSelection(); }}>{days === 366 ? "1Y" : `${days}D`}</button>)}</div><span className="method-chip">As of {shortDate(signal?.insider.asOf ?? null)}</span></div>
    </div>

    <div className="insider-story-grid" aria-label="Insider activity overview">
      <article className="insider-story insider-story--positive"><span>Personal investments</span><strong>{personal.length}</strong><p>{personal.length ? `${compactMoney(personal.reduce((sum, item) => sum + (item.value ?? 0), 0))} invested by ${uniqueOwners(personal)} insider${uniqueOwners(personal) === 1 ? "" : "s"}.` : "No personal-capital purchases reported in this window."}</p><small>Bullish evidence when present</small></article>
      <article className="insider-story insider-story--sale"><span>Share sales</span><strong>{sales.length}</strong><p>{sales.length ? `${compactMoney(sales.reduce((sum, item) => sum + (item.value ?? 0), 0))} disclosed across ${uniqueOwners(sales)} insider${uniqueOwners(sales) === 1 ? "" : "s"}.` : "No share sales reported in this window."}</p><small>Activity shown; motive not inferred</small></article>
      <article className="insider-story insider-story--context"><span>Compensation & other</span><strong>{compensation.length + administrative.length}</strong><p>{compensation.length} compensation · {administrative.length} administrative ownership changes</p><small>Context, not investing sentiment</small></article>
    </div>

    <div className="insider-view-tabs" role="tablist" aria-label="Insider activity view">
      <button type="button" role="tab" aria-selected={activeView === "cash"} className={activeView === "cash" ? "is-active" : ""} onClick={() => selectView("cash")}><b>Cash trades</b><span>Personal purchases and share sales</span></button>
      <button type="button" role="tab" aria-selected={activeView === "ownership"} className={activeView === "ownership" ? "is-active" : ""} onClick={() => selectView("ownership")}><b>All ownership changes</b><span>Awards, exercises, taxes, gifts, and trades</span></button>
    </div>

    {activeView === "cash"
      ? <CashTradeChart months={months as CashMonth[]} selectedMonth={selectedMonth} onSelect={(month) => { setSelectedMonth((current) => current === month ? null : month); setPage(0); }} />
      : <OwnershipActivityChart months={months as OwnershipMonth[]} selectedMonth={selectedMonth} onSelect={(month) => { setSelectedMonth((current) => current === month ? null : month); setPage(0); }} />}

    <div className="insider-filter-row">
      <div aria-label="Filter insider activity">
        <FilterButton active={activityFilter === "all"} onClick={() => { setActivityFilter("all"); setPage(0); }}>All <span>{visibleByView.length}</span></FilterButton>
        <FilterButton active={activityFilter === "investment"} onClick={() => { setActivityFilter("investment"); setPage(0); }}>Personal investments <span>{personal.length}</span></FilterButton>
        <FilterButton active={activityFilter === "sale"} onClick={() => { setActivityFilter("sale"); setPage(0); }}>Sales <span>{sales.length}</span></FilterButton>
        {activeView === "ownership" && <><FilterButton active={activityFilter === "compensation"} onClick={() => { setActivityFilter("compensation"); setPage(0); }}>Compensation <span>{compensation.length}</span></FilterButton><FilterButton active={activityFilter === "administrative"} onClick={() => { setActivityFilter("administrative"); setPage(0); }}>Other <span>{administrative.length}</span></FilterButton></>}
      </div>
      <div aria-live="polite">{selectedMonthLabel && <button type="button" className="method-chip" onClick={resetSelection}>{selectedMonthLabel} ×</button>}<small>{filteredTransactions.length ? `${firstVisibleRow + 1}${lastVisibleRow > firstVisibleRow + 1 ? `–${lastVisibleRow}` : ""} of ${filteredTransactions.length}` : "No matching activity"}</small></div>
    </div>

    {filteredTransactions.length ? <>
      <div className="insider-event-list">{filteredTransactions.slice(firstVisibleRow, lastVisibleRow).map((transaction) => <InsiderEvent key={`${transaction.accession}-${transaction.ownerName}-${transaction.transactionDate}-${transaction.category}-${transaction.shares}`} transaction={transaction} />)}</div>
      {pageCount > 1 && <nav className="table-pagination insider-pagination" aria-label="Insider activity pages"><span>{firstVisibleRow + 1}–{lastVisibleRow} of {filteredTransactions.length}</span><div><button type="button" disabled={safePage === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>Previous</button><b>{safePage + 1} / {pageCount}</b><button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}>Next</button></div></nav>}
    </> : <Unavailable title="No activity matches these filters" detail="Try another time window, activity type, or clear the selected month." />}
    <p className="insider-method-note"><b>How to read this:</b> personal investments can be bullish evidence. Sales are not scored as bearish because a Form 4 usually does not reveal the seller’s motive. Awards and administrative events are shown for ownership context only. {summary?.scheduledSaleCount || summary?.taxRelatedSaleCount ? `${summary.scheduledSaleCount} scheduled and ${summary.taxRelatedSaleCount} tax-related sales are identified from filing evidence.` : ""}</p>
  </section>;
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={active ? "is-active" : ""} onClick={onClick}>{children}</button>;
}

function InsiderEvent({ transaction }: { transaction: InsiderTransaction }) {
  const meta = insiderActivityMeta(transaction.category);
  const amount = transaction.value != null ? compactMoney(transaction.value) : `${formatNumber(transaction.shares)} shares`;
  return <article className={`insider-event insider-event--${meta.tone}`}>
    <time dateTime={transaction.transactionDate}>{shortDate(transaction.transactionDate)}</time>
    <div className="insider-event__identity"><b>{transaction.ownerName}</b><span>{transaction.ownerRole || "Reporting owner"}</span></div>
    <div className="insider-event__meaning"><span>{meta.label}</span><small>{meta.signalLabel}</small></div>
    <div className="insider-event__amount"><b>{amount}</b><span>{transaction.value == null ? `${transaction.direction === "acquired" ? "Acquired" : "Disposed"} · no cash value inferred` : `${formatNumber(transaction.shares)} shares${transaction.price == null ? "" : ` at ${moneyWithCents(transaction.price)}`}`}</span></div>
    <details className="insider-event__details"><summary>View filing details</summary><div><dl><div><dt>SEC code</dt><dd>{transaction.code}</dd></div><div><dt>Direction</dt><dd>{titleCase(transaction.direction)}</dd></div><div><dt>Security</dt><dd>{transaction.securityTitle || "Common shares"}</dd></div><div><dt>Ownership</dt><dd>{ownershipLabel(transaction)}</dd></div><div><dt>Shares after</dt><dd>{transaction.sharesOwnedAfter == null ? "Not reported" : formatNumber(transaction.sharesOwnedAfter)}</dd></div><div><dt>10b5-1 plan</dt><dd>{transaction.rule10b51 ? "Reported" : "Not reported"}</dd></div></dl><p>{meta.explanation}{transaction.filingContext ? ` Filing context: ${transaction.filingContext}` : ""}</p><a href={transaction.sourceUrl} target="_blank" rel="noreferrer">Open SEC filing ↗</a></div></details>
  </article>;
}

type MonthBase = { key: string; label: string; longLabel: string };
type CashMonth = MonthBase & { investments: number; sales: number };
type OwnershipMonth = MonthBase & { investment: number; sale: number; compensation: number; administrative: number };

function CashTradeChart({ months, selectedMonth, onSelect }: { months: CashMonth[]; selectedMonth: string | null; onSelect: (month: string) => void }) {
  const max = Math.max(1, ...months.flatMap((month) => [month.investments, month.sales]));
  const hasActivity = months.some((month) => month.investments || month.sales);
  return <div className="insider-chart-block">
    <div className="insider-chart-context"><div><span className="eyebrow">Disclosed cash value</span><h3>Purchases above zero · sales below zero</h3><p>Both directions use the same dollar scale, so their bar lengths are directly comparable.{months.length === 13 ? " Boundary months are partial." : ""}</p></div><span>Scale maximum <b>{compactMoney(max)}</b></span></div>
    {hasActivity ? <div className="insider-flow-chart" style={{ "--insider-buckets": months.length } as CSSProperties} aria-label="Personal investment and share sale values by month"><span className="insider-flow-chart__axis" aria-hidden="true"><b>Purchases ↑</b><b>Sales ↓</b></span>{months.map((month) => {
      const enabled = month.investments > 0 || month.sales > 0;
      const exact = `${month.longLabel}: ${exactMoney(month.investments)} personal purchases; ${exactMoney(month.sales)} share sales`;
      return <button type="button" key={month.key} className={selectedMonth === month.key ? "is-selected" : ""} disabled={!enabled} aria-pressed={selectedMonth === month.key} aria-label={exact} title={exact} onClick={() => onSelect(month.key)}><span className="insider-flow-chart__buy"><i className={month.investments ? "has-value" : ""} style={{ height: `${(month.investments / max) * 100}%` }} /></span><span className="insider-flow-chart__zero" /><span className="insider-flow-chart__sell"><i className={month.sales ? "has-value" : ""} style={{ height: `${(month.sales / max) * 100}%` }} /></span><b>{month.label}</b></button>;
    })}</div> : <div className="insider-chart-empty"><b>No cash trades in this window</b><span>Ownership changes may still appear in the complete view.</span></div>}
    <div className="insider-legend"><span><i className="is-buy" />Personal purchases ↑</span><span><i className="is-sale" />Share sales ↓</span><small>Hover for exact dollars · select a month to filter</small></div>
  </div>;
}

function OwnershipActivityChart({ months, selectedMonth, onSelect }: { months: OwnershipMonth[]; selectedMonth: string | null; onSelect: (month: string) => void }) {
  return <div className="insider-chart-block">
    <div className="insider-chart-context"><div><span className="eyebrow">Form 4 event count</span><h3>A monthly ownership-change matrix</h3><p>Each tile shows counts, not dollars. Nothing is plotted above or below a sentiment baseline.{months.length === 13 ? " Boundary months are partial." : ""}</p></div><span>Unit <b>Events</b></span></div>
    <div className="ownership-event-grid" style={{ "--ownership-columns": Math.min(7, months.length) } as CSSProperties} aria-label="Reported ownership events by month">{months.map((month) => {
      const total = month.investment + month.sale + month.compensation + month.administrative;
      const exact = `${month.longLabel}: ${total} events — ${month.investment} personal investments, ${month.sale} sales, ${month.compensation} compensation, and ${month.administrative} other ownership changes`;
      return <button type="button" key={month.key} className={selectedMonth === month.key ? "is-selected" : ""} disabled={!total} aria-pressed={selectedMonth === month.key} aria-label={exact} title={exact} onClick={() => onSelect(month.key)}><header><b>{month.label}</b><strong>{total}<small>{total === 1 ? " event" : " events"}</small></strong></header><span className="is-investment"><i />Personal <b>{month.investment}</b></span><span className="is-sale"><i />Sales <b>{month.sale}</b></span><span className="is-compensation"><i />Comp. <b>{month.compensation}</b></span><span className="is-administrative"><i />Other <b>{month.administrative}</b></span></button>;
    })}</div>
    <div className="insider-legend"><small>Exact event counts · select a month to filter the filing list</small></div>
  </div>;
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
    <div className="target-ladder"><div><span style={{ left: `${position(analyst.targetLow)}%` }} /><span className="target-ladder__price" style={{ left: `${position(stock.latestPrice)}%` }} /><span className="target-ladder__mean" style={{ left: `${position(analyst.targetMean)}%` }} /><span style={{ left: `${position(analyst.targetHigh)}%` }} /></div><dl><div><dt>Low</dt><dd>{money(analyst.targetLow)}</dd></div><div><dt>Last close</dt><dd>{money(stock.latestPrice)}</dd></div><div><dt>Mean</dt><dd>{money(analyst.targetMean)}</dd></div><div><dt>High</dt><dd>{money(analyst.targetHigh)}</dd></div></dl></div>
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
    <div className="ownership-donut-row"><div className="ownership-ring" style={{ "--ownership": `${Math.min(100, progress)}%` } as CSSProperties}><span><b>{item?.managersReported ?? 0}/{item?.expectedManagers ?? 0}</b><small>reported</small></span></div><dl><div><dt>Managers holding</dt><dd>{item?.managersHolding ?? 0}</dd></div><div><dt>Latest filing received</dt><dd>{shortDate(item?.filingDate ?? null)}</dd></div><div><dt>Portfolio period</dt><dd>{shortDate(item?.reportDate ?? null)}</dd></div></dl></div>
    <div className="manager-flow"><span className="is-positive"><b>+{(item?.managersNew ?? 0) + (item?.managersIncreased ?? 0)}</b><small>new or increased</small></span><i /><span className="is-negative"><b>−{(item?.managersReduced ?? 0) + (item?.managersExited ?? 0)}</b><small>reduced or exited</small></span></div>
    <small className="signal-lag-note">13F holdings can be filed up to 45 days after quarter end and omit shorts and many non-U.S. instruments.</small>
  </section>;
}

function Unavailable({ title, detail }: { title: string; detail: string }) { return <div className="signal-unavailable"><span>—</span><b>{title}</b><p>{detail}</p></div>; }

function monthBuckets(asOf: string | null, windowDays: ActivityWindow) {
  const latest = asOf ? new Date(`${asOf}T00:00:00Z`) : new Date();
  // A rolling 366-day window can touch 13 named calendar months. Keeping both
  // boundary months makes the chart totals reconcile with the filing list.
  const bucketCount = windowDays === 366 ? 13 : windowDays === 90 ? 4 : 2;
  return Array.from({ length: bucketCount }, (_, offset) => {
    const date = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth() - (bucketCount - 1 - offset), 1));
    return {
      key: date.toISOString().slice(0, 7),
      label: windowDays === 366 && (offset === 0 || offset === bucketCount - 1)
        ? new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date)
        : new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date),
      longLabel: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(date),
    };
  });
}

function aggregateCashMonths(transactions: InsiderTransaction[], asOf: string | null, windowDays: ActivityWindow): CashMonth[] {
  return monthBuckets(asOf, windowDays).map((month) => {
    const rows = transactions.filter((item) => item.transactionDate.startsWith(month.key));
    return { ...month, investments: rows.filter(isPersonalInvestment).reduce((sum, item) => sum + (item.value ?? 0), 0), sales: rows.filter(isSaleActivity).reduce((sum, item) => sum + (item.value ?? 0), 0) };
  });
}

function aggregateOwnershipMonths(transactions: InsiderTransaction[], asOf: string | null, windowDays: ActivityWindow): OwnershipMonth[] {
  return monthBuckets(asOf, windowDays).map((month) => {
    const rows = transactions.filter((item) => item.transactionDate.startsWith(month.key));
    return { ...month, investment: rows.filter(isPersonalInvestment).length, sale: rows.filter(isSaleActivity).length, compensation: rows.filter(isCompensationActivity).length, administrative: rows.filter(isAdministrativeActivity).length };
  });
}

function uniqueOwners(transactions: InsiderTransaction[]) { return new Set(transactions.map((item) => item.ownerName)).size; }
function ownershipLabel(transaction: InsiderTransaction) { return transaction.directOrIndirect === "direct" ? "Direct" : transaction.directOrIndirect === "indirect" ? `Indirect${transaction.natureOfOwnership ? ` · ${transaction.natureOfOwnership}` : ""}` : "Not reported"; }
function shortDate(value: string | null) { return value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : "Unavailable"; }
function compactMoney(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value); }
function exactMoney(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
function money(value: number | null) { return value == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
function moneyWithCents(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value); }
function formatNumber(value: number | null) { return value == null ? "—" : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value); }
function formatPercent(value: number | null) { return value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`; }
function formatUnsignedPercent(value: number | null) { return value == null ? "—" : `${value.toFixed(1)}%`; }
function titleCase(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
