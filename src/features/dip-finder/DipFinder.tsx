"use client";

import { useMemo, useState } from "react";
import type { AnalyzedStock } from "@/src/domain/stock";
import { Change, LineChart, ScoreDial, StockMark, Tag } from "@/src/components/ui";
import { formatPercent } from "@/src/domain/analytics";

type Props = {
  stocks: AnalyzedStock[];
  onSelect: (symbol: string) => void;
  watchlist: string[];
  onToggleWatchlist: (symbol: string) => void;
};

const presets = [
  { id: "all", label: "All signals", quality: 0, drawdown: 0 },
  { id: "quality", label: "Quality on sale", quality: 65, drawdown: -10 },
  { id: "deep", label: "Deep corrections", quality: 0, drawdown: -25 },
  { id: "fcf", label: "Cash generators", quality: 55, drawdown: -8 },
] as const;

function toneForClassification(classification: AnalyzedStock["classification"]) {
  if (classification === "Quality pullback" || classification === "Early recovery") return "good" as const;
  if (classification === "Potential value trap" || classification === "Trend fracture") return "bad" as const;
  return "warn" as const;
}

export function DipFinder({ stocks, onSelect, watchlist, onToggleWatchlist }: Props) {
  const [preset, setPreset] = useState<(typeof presets)[number]["id"]>("all");
  const [sector, setSector] = useState("All sectors");
  const [view, setView] = useState<"rank" | "map">("rank");
  const [selected, setSelected] = useState(stocks[0]?.symbol ?? "");
  const activePreset = presets.find((item) => item.id === preset) ?? presets[0];
  const sectors = ["All sectors", ...new Set(stocks.map((stock) => stock.sector))];
  const filtered = useMemo(
    () => stocks
      .filter((stock) => sector === "All sectors" || stock.sector === sector)
      .filter((stock) => stock.qualityScore >= activePreset.quality)
      .filter((stock) => activePreset.drawdown === 0 || stock.drawdown52Week <= activePreset.drawdown)
      .sort((a, b) => b.dipScore - a.dipScore),
    [stocks, sector, activePreset],
  );
  const selectedStock = filtered.find((stock) => stock.symbol === selected) ?? filtered[0] ?? stocks[0];

  return (
    <div className="view-stack">
      <header className="hero-panel hero-panel--dip">
        <div>
          <div className="hero-panel__kicker"><span className="live-dot" /> TIDE signal engine</div>
          <h1>Find the signal<br />beneath the selloff.</h1>
          <p>Price pain ranked against business resilience. Every signal is transparent, dated, and traceable.</p>
        </div>
        <div className="hero-score-card">
          <span className="eyebrow">Strongest current setup</span>
          {stocks[0] && (
            <>
              <div className="hero-score-card__identity">
                <StockMark symbol={stocks[0].symbol} size="lg" />
                <div><strong>{stocks[0].symbol}</strong><span>{stocks[0].name}</span></div>
                <ScoreDial value={stocks[0].dipScore} label="dip score" />
              </div>
              <div className="hero-score-card__stats">
                <span><small>Drawdown</small><b>{formatPercent(stocks[0].drawdown52Week)}</b></span>
                <span><small>Quality</small><b>{stocks[0].qualityScore}/100</b></span>
                <span><small>Regime</small><b>{stocks[0].classification}</b></span>
              </div>
            </>
          )}
        </div>
      </header>

      <section className="filter-ribbon" aria-label="Dip Finder filters">
        <div className="segmented-control">
          {presets.map((item) => (
            <button key={item.id} className={preset === item.id ? "is-active" : ""} onClick={() => setPreset(item.id)}>{item.label}</button>
          ))}
        </div>
        <div className="filter-ribbon__right">
          <label className="select-field"><span>Sector</span><select value={sector} onChange={(event) => setSector(event.target.value)}>{sectors.map((item) => <option key={item}>{item}</option>)}</select></label>
          <div className="icon-toggle" aria-label="View style">
            <button className={view === "rank" ? "is-active" : ""} onClick={() => setView("rank")} aria-label="Ranked list">☷</button>
            <button className={view === "map" ? "is-active" : ""} onClick={() => setView("map")} aria-label="Opportunity map">⌁</button>
          </div>
        </div>
      </section>

      <div className="dip-layout">
        <section className="panel dip-results">
          <div className="panel-heading">
            <div><span className="eyebrow">Opportunity set</span><h2>{filtered.length} companies surfaced</h2></div>
            <span className="method-chip" title="62% price dislocation and 38% fundamental quality">Explainable model ↗</span>
          </div>
          {view === "rank" ? (
            <div className="dip-table-wrap">
              <table className="data-table dip-table">
                <thead><tr><th>Rank</th><th>Company</th><th>Price</th><th>1 month</th><th>52W dip</th><th>200D</th><th>Quality</th><th>Signal</th><th aria-label="Watchlist" /></tr></thead>
                <tbody>
                  {filtered.map((stock, index) => (
                    <tr key={stock.symbol} className={selectedStock?.symbol === stock.symbol ? "is-selected" : ""} onClick={() => setSelected(stock.symbol)}>
                      <td><span className="rank-number">{String(index + 1).padStart(2, "0")}</span></td>
                      <td><button className="company-cell" onClick={(event) => { event.stopPropagation(); onSelect(stock.symbol); }}><StockMark symbol={stock.symbol} size="sm" /><span><b>{stock.symbol}</b><small>{stock.name}</small></span></button></td>
                      <td><b>${stock.latestPrice.toFixed(2)}</b></td>
                      <td><Change value={stock.oneMonthReturn} /></td>
                      <td><Change value={stock.drawdown52Week} /></td>
                      <td><Change value={stock.distanceFrom200Day} /></td>
                      <td><span className="quality-inline"><i style={{ width: `${stock.qualityScore}%` }} />{stock.qualityScore}</span></td>
                      <td><Tag tone={toneForClassification(stock.classification)}>{stock.classification}</Tag></td>
                      <td><button className={`watch-button ${watchlist.includes(stock.symbol) ? "is-active" : ""}`} onClick={(event) => { event.stopPropagation(); onToggleWatchlist(stock.symbol); }} aria-label={`${watchlist.includes(stock.symbol) ? "Remove" : "Add"} ${stock.symbol} ${watchlist.includes(stock.symbol) ? "from" : "to"} watchlist`}>{watchlist.includes(stock.symbol) ? "★" : "☆"}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="opportunity-map" aria-label="Price pain versus fundamental quality map">
              <div className="map-axis map-axis--y">Stronger business ↑</div>
              <div className="map-axis map-axis--x">Deeper drawdown →</div>
              <div className="map-quadrant map-quadrant--prime"><span>Quality on sale</span></div>
              {filtered.map((stock) => (
                <button
                  key={stock.symbol}
                  className={`map-bubble ${selectedStock?.symbol === stock.symbol ? "is-selected" : ""}`}
                  style={{ left: `${clampPosition(Math.abs(stock.drawdown52Week), 3, 55)}%`, bottom: `${clampPosition(stock.qualityScore, 25, 90)}%` }}
                  onClick={() => setSelected(stock.symbol)}
                  title={`${stock.name}: ${stock.dipScore} dip score`}
                >{stock.symbol}<small>{stock.dipScore}</small></button>
              ))}
            </div>
          )}
        </section>

        {selectedStock && (
          <aside className="panel signal-inspector">
            <div className="signal-inspector__header">
              <div className="company-cell"><StockMark symbol={selectedStock.symbol} /><span><b>{selectedStock.symbol}</b><small>{selectedStock.name}</small></span></div>
              <ScoreDial value={selectedStock.dipScore} label="dip score" />
            </div>
            <div className="chart-shell chart-shell--small">
              <div className="chart-shell__legend"><span><i className="legend-line legend-line--coral" /> Price</span><span><i className="legend-line legend-line--teal" /> Trend</span></div>
              <LineChart series={[{ values: selectedStock.prices.slice(-90).map((point) => point.adjustedClose), color: "#ef6c50" }]} height={150} compact ariaLabel={`${selectedStock.name} recent price trend`} />
            </div>
            <div className="inspector-grid">
              <span><small>52W drawdown</small><b className="negative">{formatPercent(selectedStock.drawdown52Week)}</b></span>
              <span><small>1 month</small><b className={selectedStock.oneMonthReturn >= 0 ? "positive" : "negative"}>{formatPercent(selectedStock.oneMonthReturn)}</b></span>
              <span><small>Quality</small><b>{selectedStock.qualityScore}/100</b></span>
              <span><small>Volatility</small><b>{selectedStock.volatility.toFixed(1)}%</b></span>
            </div>
            <div className="why-card">
              <span className="eyebrow">Why it surfaced</span>
              <ul>{selectedStock.why.map((reason) => <li key={reason}>{reason}</li>)}</ul>
            </div>
            <div className="model-note"><b>Model composition</b><span>62% price dislocation</span><span>38% fundamental quality</span></div>
            <button className="primary-button primary-button--wide" onClick={() => onSelect(selectedStock.symbol)}>Open full research <span>→</span></button>
          </aside>
        )}
      </div>
    </div>
  );
}

function clampPosition(value: number, minimum: number, maximum: number) {
  return Math.min(92, Math.max(8, ((value - minimum) / (maximum - minimum)) * 84 + 8));
}
