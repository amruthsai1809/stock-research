"use client";

import { useMemo, useState } from "react";
import type { AnalyzedStock, AnnualFinancials } from "@/src/domain/stock";
import { formatCompactCurrency, formatPercent, percentChange } from "@/src/domain/analytics";
import { Change, MetricCard, ScoreDial, StockMark, Tag } from "@/src/components/ui";
import { InteractivePriceChart } from "@/src/components/charts/InteractivePriceChart";
import { FinancialAtlas } from "@/src/components/charts/FinancialAtlas";
import { MarketSignals } from "@/src/components/charts/MarketSignals";
import type { ResearchSignal } from "@/src/modules/stock-intelligence/domain/types";

type Props = {
  stock: AnalyzedStock;
  researchSignal?: ResearchSignal;
  isWatched: boolean;
  onToggleWatchlist: (symbol: string) => void;
  onOpenValuation: () => void;
};

type CompanyTab = "overview" | "financials" | "ownership" | "quality" | "source";
export function CompanyResearch({ stock, researchSignal, isWatched, onToggleWatchlist, onOpenValuation }: Props) {
  const [tab, setTab] = useState<CompanyTab>("overview");
  const annuals = stock.annuals.filter((annual) => annual.revenue != null || annual.netIncome != null);
  const latest = stock.latestAnnual;
  const insights = useMemo(() => buildInsights(stock), [stock]);

  return (
    <div className="view-stack">
      <header className="company-hero">
        <div className="company-hero__main">
          <StockMark symbol={stock.symbol} size="lg" />
          <div>
            <div className="company-hero__title"><h1>{stock.name}</h1><Tag tone="blue">{stock.exchange}</Tag></div>
            <p>{stock.symbol} · {stock.sector} · {stock.industry}</p>
          </div>
        </div>
        <div className="company-hero__quote">
          <span className="eyebrow">Latest adjusted close</span>
          <strong>${stock.latestPrice.toFixed(2)}</strong>
          <Change value={stock.dailyReturn} />
        </div>
        <div className="company-hero__actions">
          <button className={`secondary-button ${isWatched ? "is-active" : ""}`} onClick={() => onToggleWatchlist(stock.symbol)}>{isWatched ? "★ Watching" : "☆ Watch"}</button>
          <button className="primary-button" onClick={onOpenValuation}>Value this business →</button>
        </div>
      </header>

      <nav className="subnav" aria-label={`${stock.name} research sections`}>
        {(["overview", "financials", "ownership", "quality", "source"] as CompanyTab[]).map((item) => (
          <button key={item} className={tab === item ? "is-active" : ""} onClick={() => setTab(item)}>{item === "source" ? "Source lens" : item === "ownership" ? "Market signals" : item === "financials" ? "Financial charts" : item}</button>
        ))}
      </nav>

      {tab === "overview" && (
        <>
          <section className="metric-grid metric-grid--six">
            <MetricCard label="52W drawdown" value={<Change value={stock.drawdown52Week} />} detail={`${formatPercent(stock.distanceFrom200Day)} vs 200D`} accent="coral" />
            <MetricCard label="Revenue growth" value={formatPercent(stock.revenueGrowth)} detail={`FY ${latest?.year ?? "—"}`} />
            <MetricCard label="Operating margin" value={formatPercent(stock.operatingMargin)} detail="latest fiscal year" />
            <MetricCard label="Free cash flow" value={formatCompactCurrency(latest?.freeCashFlow)} detail={`${formatPercent(stock.freeCashFlowMargin)} margin`} accent="green" />
            <MetricCard label="Share count" value={formatPercent(stock.shareChange)} detail={stock.shareChange != null && stock.shareChange <= 0 ? "net reduction" : "year over year"} />
            <MetricCard label="Quality" value={`${stock.qualityScore}/100`} detail={stock.classification} accent="blue" />
          </section>

          <div className="research-grid">
            <section className="panel chart-panel chart-panel--large">
              <div className="panel-heading"><div><span className="eyebrow">Market context</span><h2>Interactive price structure</h2><p>Inspect any session, change the range, or switch to daily candles.</p></div><Tag tone="blue">EOD adjusted</Tag></div>
              <InteractivePriceChart prices={stock.prices} symbol={stock.symbol} name={stock.name} height={360} />
              <div className="chart-footer-metrics">
                <span><small>50-day average</small><b>${stock.sma50.toFixed(2)}</b></span>
                <span><small>200-day average</small><b>${stock.sma200.toFixed(2)}</b></span>
                <span><small>52-week high</small><b>${stock.high52Week.toFixed(2)}</b></span>
                <span><small>Annualized volatility</small><b>{stock.volatility.toFixed(1)}%</b></span>
              </div>
            </section>

            <aside className="panel change-panel">
              <div className="panel-heading"><div><span className="eyebrow">Deterministic analysis</span><h2>What changed?</h2></div><span className="freshness-dot">Latest FY</span></div>
              <div className="insight-list">
                {insights.map((insight) => (
                  <article key={insight.title} className={`insight insight--${insight.tone}`}>
                    <span className="insight__icon">{insight.tone === "good" ? "↗" : insight.tone === "bad" ? "↘" : "→"}</span>
                    <div><h3>{insight.title}</h3><p>{insight.body}</p></div>
                  </article>
                ))}
              </div>
            </aside>
          </div>

          <section className="panel financial-atlas-panel">
            <FinancialAtlas annuals={annuals} companyName={stock.name} />
          </section>
        </>
      )}

      {tab === "financials" && <div className="view-stack"><section className="panel financial-atlas-panel"><FinancialAtlas annuals={annuals} companyName={stock.name} /></section><FinancialStatements stock={stock} /></div>}
      {tab === "ownership" && <MarketSignals stock={stock} signal={researchSignal} />}
      {tab === "quality" && <QualityLab stock={stock} />}
      {tab === "source" && <SourceLens stock={stock} />}
    </div>
  );
}

function FinancialStatements({ stock }: { stock: AnalyzedStock }) {
  const [mode, setMode] = useState<"value" | "growth" | "margin">("value");
  const rows: { label: string; key: keyof AnnualFinancials; parent?: boolean }[] = [
    { label: "Revenue", key: "revenue", parent: true },
    { label: "Gross profit", key: "grossProfit" },
    { label: "Operating income", key: "operatingIncome" },
    { label: "Net income", key: "netIncome", parent: true },
    { label: "Operating cash flow", key: "operatingCashFlow" },
    { label: "Capital expenditure", key: "capex" },
    { label: "Free cash flow", key: "freeCashFlow", parent: true },
  ];
  const annuals = stock.annuals.slice(-6);
  const display = (row: typeof rows[number], annual: AnnualFinancials, index: number) => {
    const value = annual[row.key] as number | null;
    if (mode === "value") return formatCompactCurrency(value);
    if (mode === "growth") {
      const previous = annuals[index - 1]?.[row.key] as number | null | undefined;
      return value == null || previous == null ? "—" : formatPercent(percentChange(value, previous));
    }
    return value == null || annual.revenue == null ? "—" : formatPercent((value / annual.revenue) * 100);
  };
  return (
    <section className="panel statement-panel">
      <div className="panel-heading"><div><span className="eyebrow">SEC-normalized</span><h2>Financial statements</h2><p>Reported annual values with calculated free cash flow.</p></div><div className="segmented-control segmented-control--compact">{(["value", "growth", "margin"] as const).map((item) => <button key={item} className={mode === item ? "is-active" : ""} onClick={() => setMode(item)}>{item}</button>)}</div></div>
      <div className="statement-scroll">
        <table className="data-table statement-table">
          <thead><tr><th>USD</th>{annuals.map((annual) => <th key={annual.end}>FY {annual.year}<small>{annual.end}</small></th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row.key} className={row.parent ? "is-parent" : ""}><td>{row.parent ? <b>{row.label}</b> : row.label}</td>{annuals.map((annual, index) => <td key={annual.end}>{display(row, annual, index)}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <div className="statement-note"><span>ⓘ</span><p>Free cash flow equals operating cash flow minus capital expenditures. Missing values remain blank rather than being estimated.</p></div>
    </section>
  );
}

function QualityLab({ stock }: { stock: AnalyzedStock }) {
  const factors = [
    { label: "Revenue durability", value: Math.max(0, Math.min(100, 50 + (stock.revenueGrowth ?? 0) * 2.2)), detail: `${formatPercent(stock.revenueGrowth)} latest growth` },
    { label: "Operating efficiency", value: Math.max(0, Math.min(100, 35 + (stock.operatingMargin ?? 0) * 1.8)), detail: `${formatPercent(stock.operatingMargin)} operating margin` },
    { label: "Cash generation", value: Math.max(0, Math.min(100, 35 + (stock.freeCashFlowMargin ?? 0) * 2.1)), detail: `${formatPercent(stock.freeCashFlowMargin)} FCF margin` },
    { label: "Balance sheet", value: Math.max(0, Math.min(100, 105 - (stock.liabilityRatio ?? .55) * 100)), detail: `${formatPercent((stock.liabilityRatio ?? 0) * 100)} liabilities / assets` },
    { label: "Per-share discipline", value: Math.max(0, Math.min(100, 55 - (stock.shareChange ?? 0) * 4)), detail: `${formatPercent(stock.shareChange)} share count` },
  ];
  return (
    <div className="quality-layout">
      <section className="panel quality-overview">
        <div><span className="eyebrow">Explainable fundamentals</span><h2>Business quality</h2><p>A transparent composite of profitability, cash generation, balance-sheet resilience, and per-share discipline.</p></div>
        <ScoreDial value={stock.qualityScore} label="quality" tone="green" />
      </section>
      <section className="panel factor-panel">
        <div className="panel-heading"><div><span className="eyebrow">Score anatomy</span><h2>Factor contribution</h2></div><span className="method-chip">No black box</span></div>
        <div className="factor-list">{factors.map((factor) => <div className="factor-row" key={factor.label}><div><b>{factor.label}</b><small>{factor.detail}</small></div><div className="factor-track"><i style={{ width: `${factor.value}%` }} /></div><strong>{Math.round(factor.value)}</strong></div>)}</div>
      </section>
      <section className="panel formula-panel">
        <span className="eyebrow">Methodology</span><h2>How the score is built</h2>
        <div className="formula-block"><code>quality = mean(growth, margins, cash conversion, balance sheet, share discipline)</code></div>
        <p>Each component is normalized from 0–100. Missing inputs receive a neutral 50 and lower the visible data-confidence indicator.</p>
      </section>
    </div>
  );
}

function SourceLens({ stock }: { stock: AnalyzedStock }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const latest = stock.latestAnnual;
  const accession = latest?.accession?.replaceAll("-", "");
  const filingUrl = accession ? `https://www.sec.gov/Archives/edgar/data/${Number(stock.cik)}/${accession}/` : `https://www.sec.gov/edgar/browse/?CIK=${stock.cik}`;
  const sources = [
    { label: "Revenue", key: "revenue", value: latest?.revenue },
    { label: "Operating income", key: "operatingIncome", value: latest?.operatingIncome },
    { label: "Net income", key: "netIncome", value: latest?.netIncome },
    { label: "Operating cash flow", key: "operatingCashFlow", value: latest?.operatingCashFlow },
    { label: "Capital expenditure", key: "capex", value: latest?.capex },
  ] as const;
  return (
    <section className="panel source-panel">
      <div className="panel-heading"><div><span className="eyebrow">Audit the analysis</span><h2>Source lens</h2><p>Every reported metric points back to a filing context.</p></div><a className="primary-button" href={filingUrl} target="_blank" rel="noreferrer">Open SEC filing ↗</a></div>
      <div className="source-list">
        {sources.map(({ label, key, value }) => {
          const concept = latest?.sourceConcepts?.[key] ?? "Concept unavailable";
          const isExpanded = expanded === key;
          return <article key={label} className={`source-item ${isExpanded ? "is-open" : ""}`}>
            <div className="source-row"><span className="source-row__status">✓</span><div><b>{label}</b><code>us-gaap: {concept}</code></div><div><strong>{formatCompactCurrency(value)}</strong><small>FY {latest?.year ?? "—"} · USD</small></div><button aria-label={`Inspect ${label} lineage`} aria-expanded={isExpanded} onClick={() => setExpanded(isExpanded ? null : key)}>{isExpanded ? "Close ↑" : "Inspect →"}</button></div>
            {isExpanded && <div className="source-lineage"><span><small>Taxonomy</small><b>US GAAP</b></span><span><small>Concept</small><code>{concept}</code></span><span><small>Period</small><b>{latest?.end ?? "—"}</b></span><span><small>Filed</small><b>{latest?.filed ?? "—"}</b></span><span><small>Accession</small><b>{latest?.accession ?? "—"}</b></span></div>}
          </article>;
        })}
      </div>
      <div className="provenance-card"><div><span className="eyebrow">Filing context</span><strong>{latest?.end ?? "Not available"}</strong><small>Period end</small></div><div><strong>{latest?.filed ?? "Not available"}</strong><small>Filed</small></div><div><strong>{latest?.accession ?? "Not available"}</strong><small>Accession</small></div><div><strong>Reported</strong><small>Confidence</small></div></div>
    </section>
  );
}

function buildInsights(stock: AnalyzedStock) {
  const latest = stock.latestAnnual;
  const previous = stock.previousAnnual;
  const fcfChange = latest?.freeCashFlow != null && previous?.freeCashFlow != null ? percentChange(latest.freeCashFlow, previous.freeCashFlow) : null;
  const marginBefore = previous?.revenue && previous.operatingIncome != null ? (previous.operatingIncome / previous.revenue) * 100 : null;
  const marginChange = stock.operatingMargin != null && marginBefore != null ? stock.operatingMargin - marginBefore : null;
  return [
    {
      tone: (stock.revenueGrowth ?? 0) >= 0 ? "good" : "bad",
      title: (stock.revenueGrowth ?? 0) >= 0 ? "Top line expanded" : "Revenue contracted",
      body: `Revenue changed ${formatPercent(stock.revenueGrowth)} in the latest reported fiscal year.`,
    },
    {
      tone: (marginChange ?? 0) >= 0 ? "good" : "bad",
      title: (marginChange ?? 0) >= 0 ? "Operating leverage improved" : "Operating margin compressed",
      body: `${marginChange == null ? "Insufficient history" : `${Math.abs(marginChange).toFixed(1)} percentage points`} versus the previous year.`,
    },
    {
      tone: (fcfChange ?? 0) >= 0 ? "good" : "bad",
      title: (fcfChange ?? 0) >= 0 ? "Cash generation strengthened" : "Free cash flow weakened",
      body: `Free cash flow changed ${formatPercent(fcfChange)} year over year.`,
    },
    {
      tone: (stock.shareChange ?? 0) <= 0 ? "good" : "neutral",
      title: (stock.shareChange ?? 0) <= 0 ? "Per-share ownership improved" : "Dilution requires attention",
      body: `Reported shares changed ${formatPercent(stock.shareChange)} over the latest annual period.`,
    },
  ];
}
