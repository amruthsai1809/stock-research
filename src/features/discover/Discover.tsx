"use client";

import type { AnalyzedStock } from "@/src/domain/stock";
import { Change, LineChart, MetricCard, ScoreDial, StockMark, Tag } from "@/src/components/ui";
import { formatCompactCurrency, formatPercent } from "@/src/domain/analytics";

export function Discover({ stocks, onSelect, onOpenDipFinder }: { stocks: AnalyzedStock[]; onSelect: (symbol: string) => void; onOpenDipFinder: () => void }) {
  const quality = [...stocks].sort((a, b) => b.qualityScore - a.qualityScore).slice(0, 5);
  const dips = [...stocks].sort((a, b) => a.drawdown52Week - b.drawdown52Week).slice(0, 4);
  const positiveFcf = stocks.filter((stock) => (stock.latestAnnual?.freeCashFlow ?? 0) > 0).length;
  const averageDrawdown = stocks.reduce((total, stock) => total + stock.drawdown52Week, 0) / Math.max(1, stocks.length);
  const best = stocks[0];

  return (
    <div className="view-stack">
      <header className="discover-hero">
        <div className="discover-hero__copy">
          <span className="hero-panel__kicker"><span className="live-dot" /> Fundamentals-first equity research</span>
          <h1>See the business.<br /><em>Then</em> see the price.</h1>
          <p>TIDE turns market drawdowns and SEC filings into an explainable research workflow—without an account or a black-box rating.</p>
          <div className="hero-actions"><button className="primary-button primary-button--large" onClick={onOpenDipFinder}>Explore today’s dips →</button><button className="text-button" onClick={() => best && onSelect(best.symbol)}>Open strongest signal</button></div>
        </div>
        <div className="market-card">
          <div className="market-card__header"><div><span className="eyebrow">Research universe</span><h2>Opportunity pulse</h2></div><Tag tone="good">EOD snapshot</Tag></div>
          <div className="market-card__score">
            <ScoreDial value={best?.dipScore ?? 0} label="top signal" />
            <div><strong>{best?.symbol}</strong><span>{best?.classification}</span><small>{best ? `${Math.abs(best.drawdown52Week).toFixed(1)}% below 52W high` : "—"}</small></div>
          </div>
          <LineChart series={[{ values: dips.map((stock) => Math.abs(stock.drawdown52Week)), color: "#ef6c50" }]} height={100} compact ariaLabel="Current opportunity distribution" />
          <div className="market-card__footer"><span><b>{stocks.length}</b> companies tracked</span><span><b>{positiveFcf}</b> cash positive</span></div>
        </div>
      </header>

      <section className="metric-grid metric-grid--four">
        <MetricCard label="Universe drawdown" value={formatPercent(averageDrawdown)} detail="average from 52W high" accent="coral" />
        <MetricCard label="Positive FCF" value={`${Math.round((positiveFcf / Math.max(1, stocks.length)) * 100)}%`} detail={`${positiveFcf} of ${stocks.length} companies`} accent="green" />
        <MetricCard label="Top quality" value={`${quality[0]?.qualityScore ?? 0}/100`} detail={quality[0]?.name ?? "—"} accent="blue" />
        <MetricCard label="Data provenance" value="100%" detail="filing-linked fundamentals" />
      </section>

      <div className="discover-grid">
        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Price dislocations</span><h2>Deepest drawdowns</h2></div><button className="text-button" onClick={onOpenDipFinder}>View Dip Finder →</button></div>
          <div className="drawdown-cards">
            {dips.map((stock) => (
              <button className="drawdown-card" key={stock.symbol} onClick={() => onSelect(stock.symbol)}>
                <div className="drawdown-card__top"><StockMark symbol={stock.symbol} /><span><b>{stock.symbol}</b><small>{stock.name}</small></span><Change value={stock.drawdown52Week} /></div>
                <div className="drawdown-track"><i style={{ width: `${Math.min(100, Math.abs(stock.drawdown52Week) * 2)}%` }} /></div>
                <div className="drawdown-card__bottom"><Tag tone={stock.qualityScore >= 65 ? "good" : "warn"}>{stock.classification}</Tag><span>Quality {stock.qualityScore}</span></div>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Fundamental leaders</span><h2>Quality board</h2></div><span className="method-chip">Explainable scores</span></div>
          <div className="quality-board">
            {quality.map((stock, index) => (
              <button key={stock.symbol} onClick={() => onSelect(stock.symbol)}><span className="rank-number">{String(index + 1).padStart(2, "0")}</span><StockMark symbol={stock.symbol} size="sm" /><span className="quality-board__name"><b>{stock.symbol}</b><small>{stock.sector}</small></span><span className="quality-inline"><i style={{ width: `${stock.qualityScore}%` }} />{stock.qualityScore}</span><span className="quality-board__fcf">{formatCompactCurrency(stock.latestAnnual?.freeCashFlow)}</span></button>
            ))}
          </div>
        </section>
      </div>

      <section className="trust-strip">
        <div><span>01</span><b>Every score explains itself</b><p>See exactly which price and business factors changed the rank.</p></div>
        <div><span>02</span><b>Every number has a source</b><p>Trace reported fundamentals back to their SEC filing context.</p></div>
        <div><span>03</span><b>Your research stays yours</b><p>Watchlists and assumptions live in your browser, not our database.</p></div>
      </section>
    </div>
  );
}
