"use client";

import type { MarketRepository } from "@/src/application/ports/repositories";
import type { StockSummary } from "@/src/domain/stock";
import { Change, MetricCard, ScoreDial, StockMark, Tag } from "@/src/components/ui";
import { InteractivePriceChart } from "@/src/components/charts/InteractivePriceChart";
import { formatCompactCurrency, formatPercent } from "@/src/domain/analytics";
import { useStockDetail } from "@/src/features/market/useStockDetails";

export function Discover({ stocks, onSelect, onOpenDipFinder, marketRepository }: { stocks: StockSummary[]; onSelect: (symbol: string) => void; onOpenDipFinder: () => void; marketRepository: MarketRepository }) {
  const ranked = [...stocks].sort((a, b) => b.dipScore - a.dipScore);
  const quality = [...stocks].sort((a, b) => b.qualityScore - a.qualityScore).slice(0, 5);
  const dips = [...stocks].sort((a, b) => a.drawdown52Week - b.drawdown52Week).slice(0, 4);
  const positiveFcf = stocks.filter((stock) => (stock.latestAnnual?.freeCashFlow ?? 0) > 0).length;
  const averageDrawdown = stocks.reduce((total, stock) => total + stock.drawdown52Week, 0) / Math.max(1, stocks.length);
  const best = ranked[0];
  const bestDetail = useStockDetail(marketRepository, best?.symbol);

  return (
    <div className="view-stack">
      <header className="research-desk-header">
        <div>
          <span className="hero-panel__kicker"><span className="live-dot" /> End-of-day research desk</span>
          <h1>Today&apos;s market, explained.</h1>
          <p>Start with a signal, inspect the price path, then audit the business behind it.</p>
        </div>
        <div className="hero-actions">
          <button className="primary-button" onClick={onOpenDipFinder}>Open Dip Finder &rarr;</button>
          <button className="secondary-button" onClick={() => best && onSelect(best.symbol)}>Research {best?.symbol}</button>
        </div>
      </header>

      <section className="metric-grid metric-grid--four">
        <MetricCard label="Universe drawdown" value={formatPercent(averageDrawdown)} detail="average from 52W high" accent="coral" />
        <MetricCard label="Positive FCF" value={`${Math.round((positiveFcf / Math.max(1, stocks.length)) * 100)}%`} detail={`${positiveFcf} of ${stocks.length} companies`} accent="green" />
        <MetricCard label="Top quality" value={`${quality[0]?.qualityScore ?? 0}/100`} detail={quality[0]?.name ?? "-"} accent="blue" />
        <MetricCard label="Coverage" value={`${stocks.length} stocks`} detail="10Y prices or complete post-IPO history" />
      </section>

      <div className="desk-grid">
        {best && (
          <section className="panel desk-spotlight">
            <div className="panel-heading">
              <div><span className="eyebrow">Highest-ranked setup</span><h2>{best.name} <small>{best.symbol}</small></h2><p>{best.classification} with a {best.qualityScore}/100 business-quality score.</p></div>
              <ScoreDial value={best.dipScore} label="dip score" />
            </div>
            {bestDetail.stock
              ? <InteractivePriceChart prices={bestDetail.stock.prices} symbol={best.symbol} name={best.name} height={250} compact initialRange="1Y" />
              : <div className="chart-empty" aria-live="polite"><b>{bestDetail.error ? "Price history unavailable" : "Loading price history"}</b><span>{bestDetail.error ?? "Fetching this company only."}</span></div>}
            <div className="spotlight-actions">
              <span><small>52W drawdown</small><Change value={best.drawdown52Week} /></span>
              <span><small>Revenue growth</small><Change value={best.revenueGrowth} /></span>
              <span><small>Free cash flow</small><b>{formatCompactCurrency(best.latestAnnual?.freeCashFlow)}</b></span>
              <button className="primary-button" onClick={() => onSelect(best.symbol)}>Open full research &rarr;</button>
            </div>
          </section>
        )}

        <section className="panel opportunity-queue">
          <div className="panel-heading"><div><span className="eyebrow">Ranked opportunity queue</span><h2>Signals worth opening</h2></div><button className="text-button" onClick={onOpenDipFinder}>See all &rarr;</button></div>
          <div className="queue-list">
            {ranked.slice(0, 6).map((stock, index) => (
              <button key={stock.symbol} onClick={() => onSelect(stock.symbol)}>
                <span className="rank-number">{String(index + 1).padStart(2, "0")}</span>
                <StockMark symbol={stock.symbol} size="sm" />
                <span><b>{stock.symbol}</b><small>{stock.classification}</small></span>
                <Change value={stock.drawdown52Week} />
                <strong>{stock.dipScore}</strong>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="discover-grid">
        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Price dislocations</span><h2>Deepest drawdowns</h2></div><button className="text-button" onClick={onOpenDipFinder}>Open finder &rarr;</button></div>
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
          <div className="panel-heading"><div><span className="eyebrow">Fundamental leaders</span><h2>Quality board</h2></div><span className="method-chip">SEC-derived</span></div>
          <div className="quality-board">
            {quality.map((stock, index) => (
              <button key={stock.symbol} onClick={() => onSelect(stock.symbol)}><span className="rank-number">{String(index + 1).padStart(2, "0")}</span><StockMark symbol={stock.symbol} size="sm" /><span className="quality-board__name"><b>{stock.symbol}</b><small>{stock.sector}</small></span><span className="quality-inline"><i style={{ width: `${stock.qualityScore}%` }} />{stock.qualityScore}</span><span className="quality-board__fcf">{formatCompactCurrency(stock.latestAnnual?.freeCashFlow)}</span></button>
            ))}
          </div>
        </section>
      </div>

      <section className="trust-strip">
        <div><span>01</span><b>Inspect, do not guess</b><p>Every price chart reveals the exact date, price, range return, and volume under your pointer.</p></div>
        <div><span>02</span><b>Audit the business</b><p>Trace reported fundamentals back to their SEC filing context.</p></div>
        <div><span>03</span><b>Keep the workflow local</b><p>Watchlists and valuation assumptions stay in your browser.</p></div>
      </section>
    </div>
  );
}
