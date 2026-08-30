"use client";

import { useState } from "react";
import type { StockSummary } from "@/src/domain/stock";
import { StockMark, Tag } from "@/src/components/ui";

export function FilingIntel({ stocks, onSelect }: { stocks: StockSummary[]; onSelect: (symbol: string) => void }) {
  const [visibleCount, setVisibleCount] = useState(100);
  const filings = stocks.flatMap((stock) => {
    const annual = stock.latestAnnual?.accession ? stock.latestAnnual : stock.previousAnnual?.accession ? stock.previousAnnual : null;
    return annual ? [{ stock, annual }] : [];
  }).sort((a, b) => (b.annual.filed ?? "").localeCompare(a.annual.filed ?? ""));
  const incomeCoverage = coverage(stocks, ["revenue", "grossProfit", "operatingIncome", "netIncome"]);
  const cashCoverage = coverage(stocks, ["operatingCashFlow", "capex", "freeCashFlow"]);
  const balanceCoverage = coverage(stocks, ["assets", "liabilities", "equity", "cash"]);
  const overallCoverage = Math.round((incomeCoverage + cashCoverage + balanceCoverage) / 3);
  return (
    <div className="view-stack">
      <header className="section-hero"><div><span className="hero-panel__kicker">Primary-source research</span><h1>The filing is the<br />source of truth.</h1><p>Inspect normalized facts, reporting periods, and SEC provenance without losing your research context.</p></div><div className="filing-hero-note"><span>SEC EDGAR</span><strong>{filings.length}</strong><small>recent issuer reports</small></div></header>
      <div className="filing-grid">
        <section className="panel filing-feed"><div className="panel-heading"><div><span className="eyebrow">Filing stream</span><h2>Recent annual reports</h2><p>Newest reports load first; expand the stream only when you need more.</p></div><Tag tone="good">Source linked</Tag></div><div className="filing-list">{filings.slice(0, visibleCount).map(({ stock, annual }) => { const accession = annual.accession?.replaceAll("-", ""); const href = `https://www.sec.gov/Archives/edgar/data/${Number(stock.cik)}/${accession}/`; return <article key={`${stock.symbol}-${annual.accession}`}><button className="company-cell" onClick={() => onSelect(stock.symbol)}><StockMark symbol={stock.symbol} size="sm" /><span><b>{stock.symbol}</b><small>{stock.name}</small></span></button><div className="filing-type"><Tag tone="blue">10-K</Tag><span>FY {annual.year}</span></div><div><b>{annual.filed}</b><small>Filed</small></div><a href={href} target="_blank" rel="noreferrer">Open SEC ↗</a></article>; })}</div>{visibleCount < filings.length && <button type="button" className="secondary-button incremental-load" onClick={() => setVisibleCount((current) => current + 100)}>Show 100 more <span>{visibleCount} of {filings.length}</span></button>}</section>
        <aside className="panel coverage-panel"><span className="eyebrow">Trust layer</span><h2>Coverage report</h2><div className="coverage-score"><strong>{overallCoverage}%</strong><span>core metric coverage</span></div><div className="coverage-bars"><CoverageBar label="Income statement" value={incomeCoverage} /><CoverageBar label="Cash flow" value={cashCoverage} /><CoverageBar label="Balance sheet" value={balanceCoverage} /></div><div className="coverage-note"><b>No silent estimates</b><p>When a company does not report a compatible fact, the product displays a missing value instead of manufacturing one.</p></div></aside>
      </div>
      <section className="panel metric-dictionary"><div className="panel-heading"><div><span className="eyebrow">Metric dictionary</span><h2>Definitions used throughout the product</h2></div></div><div className="dictionary-grid">{[["Free cash flow","Operating cash flow − capital expenditure"],["Drawdown","Latest adjusted close relative to trailing 52-week high"],["Cash conversion","Operating cash flow ÷ net income"],["Quality score","Equal-weight normalized fundamental factors"],["Dip score","62% price dislocation + 38% business quality"],["Share change","Latest annual shares relative to prior annual shares"]].map(([title, text]) => <article key={title}><span>ƒ</span><div><b>{title}</b><p>{text}</p></div></article>)}</div></section>
    </div>
  );
}

type CoveredMetric = "revenue" | "grossProfit" | "operatingIncome" | "netIncome" | "operatingCashFlow" | "capex" | "freeCashFlow" | "assets" | "liabilities" | "equity" | "cash";

function coverage(stocks: StockSummary[], metrics: CoveredMetric[]) {
  const possible = stocks.length * metrics.length;
  if (!possible) return 0;
  const reported = stocks.reduce((total, stock) => total + metrics.filter((metric) => stock.latestAnnual?.[metric] != null).length, 0);
  return Math.round((reported / possible) * 100);
}

function CoverageBar({ label, value }: { label: string; value: number }) {
  return <span><b>{label}</b><i><em style={{ width: `${value}%` }} /></i><strong>{value}%</strong></span>;
}
