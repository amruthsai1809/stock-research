"use client";

import { useMemo, useState } from "react";
import type { MarketRepository } from "@/src/application/ports/repositories";
import type { StockSummary } from "@/src/domain/stock";
import { Change, ScoreDial, StockMark, Tag } from "@/src/components/ui";
import { InteractivePriceChart } from "@/src/components/charts/InteractivePriceChart";
import { formatPercent } from "@/src/domain/analytics";
import { useStockDetail } from "@/src/features/market/useStockDetails";

type SortKey = "dipScore" | "drawdown52Week" | "qualityScore" | "oneMonthReturn";
type SortDirection = "asc" | "desc";
const pageSize = 100;
const mapLimit = 200;

const presets = [
  { id: "all", label: "All signals", quality: 0, drawdown: 0 },
  { id: "quality", label: "Quality on sale", quality: 65, drawdown: -10 },
  { id: "deep", label: "Deep corrections", quality: 0, drawdown: -25 },
  { id: "fcf", label: "Cash generators", quality: 55, drawdown: -8 },
] as const;

function toneForClassification(classification: StockSummary["classification"]) {
  if (classification === "Quality pullback" || classification === "Early recovery") return "good" as const;
  if (classification === "Potential value trap" || classification === "Trend fracture") return "bad" as const;
  return "warn" as const;
}

export function DipFinder({ stocks, onSelect, watchlist, onToggleWatchlist, marketRepository }: { stocks: StockSummary[]; onSelect: (symbol: string) => void; watchlist: string[]; onToggleWatchlist: (symbol: string) => void; marketRepository: MarketRepository }) {
  const [preset, setPreset] = useState<(typeof presets)[number]["id"]>("all");
  const [sector, setSector] = useState("All sectors");
  const [view, setView] = useState<"rank" | "map">("rank");
  const [selected, setSelected] = useState(stocks[0]?.symbol ?? "");
  const [sortKey, setSortKey] = useState<SortKey>("dipScore");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(0);
  const activePreset = presets.find((item) => item.id === preset) ?? presets[0];
  const sectors = ["All sectors", ...new Set(stocks.map((stock) => stock.sector))];
  const filtered = useMemo(() => {
    const subset = stocks
      .filter((stock) => sector === "All sectors" || stock.sector === sector)
      .filter((stock) => stock.qualityScore >= activePreset.quality)
      .filter((stock) => activePreset.drawdown === 0 || stock.drawdown52Week <= activePreset.drawdown);
    return subset.sort((a, b) => {
      const delta = a[sortKey] - b[sortKey];
      return sortDirection === "asc" ? delta : -delta;
    });
  }, [stocks, sector, activePreset, sortKey, sortDirection]);
  const selectedStock = filtered.find((stock) => stock.symbol === selected) ?? filtered[0] ?? stocks[0];
  const selectedDetail = useStockDetail(marketRepository, selectedStock?.symbol);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const changeSort = (key: SortKey) => {
    setPage(0);
    if (key === sortKey) setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDirection(key === "drawdown52Week" ? "asc" : "desc");
    }
  };

  return (
    <div className="view-stack">
      <header className="dip-workbench-header">
        <div><span className="hero-panel__kicker"><span className="live-dot" /> Research signal engine</span><h1>Dip Finder</h1><p>Separate ordinary price pain from financially stronger pullbacks. Select any row to inspect the evidence.</p></div>
        <div className="dip-model-key"><span><i className="dip-model-key__price" />62% price dislocation</span><span><i className="dip-model-key__quality" />38% business quality</span><small>Transparent composite · 0-100</small></div>
      </header>

      <section className="workflow-strip" aria-label="How to use Dip Finder">
        <div><span>1</span><p><b>Choose a lens</b><small>Start broad or focus on quality, depth, or cash generation.</small></p></div>
        <div><span>2</span><p><b>Rank the evidence</b><small>Sort by dip score, drawdown, quality, or recent return.</small></p></div>
        <div><span>3</span><p><b>Inspect before opening</b><small>Click a company to reveal its price path and score anatomy.</small></p></div>
      </section>

      <section className="filter-ribbon" aria-label="Dip Finder filters">
        <div className="segmented-control">
          {presets.map((item) => <button key={item.id} className={preset === item.id ? "is-active" : ""} aria-pressed={preset === item.id} onClick={() => { setPreset(item.id); setPage(0); }}>{item.label}</button>)}
        </div>
        <div className="filter-ribbon__right">
          <label className="select-field"><span>Sector</span><select value={sector} onChange={(event) => { setSector(event.target.value); setPage(0); }}>{sectors.map((item) => <option key={item}>{item}</option>)}</select></label>
          <div className="view-switch" aria-label="Results view"><button className={view === "rank" ? "is-active" : ""} aria-pressed={view === "rank"} onClick={() => { setView("rank"); setPage(0); }}>Ranked</button><button className={view === "map" ? "is-active" : ""} aria-pressed={view === "map"} onClick={() => { setView("map"); setPage(0); }}>Map</button></div>
        </div>
      </section>

      <div className="dip-layout">
        <section className="panel dip-results">
          <div className="panel-heading"><div><span className="eyebrow">Opportunity set</span><h2>{filtered.length} companies surfaced</h2><p>Results update instantly as filters and sorting change.</p></div><span className="method-chip">As-of latest EOD close</span></div>
          {view === "rank" ? (
            <div className="dip-table-wrap">
              <table className="data-table dip-table">
                <thead><tr><th>Rank</th><th>Company</th><th>Price</th><SortableHeader label="1 month" column="oneMonthReturn" active={sortKey} direction={sortDirection} onSort={changeSort} /><SortableHeader label="52W dip" column="drawdown52Week" active={sortKey} direction={sortDirection} onSort={changeSort} /><th>200D</th><SortableHeader label="Quality" column="qualityScore" active={sortKey} direction={sortDirection} onSort={changeSort} /><SortableHeader label="Dip score" column="dipScore" active={sortKey} direction={sortDirection} onSort={changeSort} /><th>Signal</th><th aria-label="Watchlist" /></tr></thead>
                <tbody>{visible.map((stock, index) => (
                  <tr key={stock.symbol} className={selectedStock?.symbol === stock.symbol ? "is-selected" : ""} aria-selected={selectedStock?.symbol === stock.symbol} tabIndex={0} onClick={() => setSelected(stock.symbol)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelected(stock.symbol); }}>
                    <td><span className="rank-number">{String(page * pageSize + index + 1).padStart(2, "0")}</span></td>
                    <td><button className="company-cell" onClick={(event) => { event.stopPropagation(); onSelect(stock.symbol); }}><StockMark symbol={stock.symbol} size="sm" /><span><b>{stock.symbol}</b><small>{stock.name}</small></span></button></td>
                    <td><b>${stock.latestPrice.toFixed(2)}</b></td><td><Change value={stock.oneMonthReturn} /></td><td><Change value={stock.drawdown52Week} /></td><td><Change value={stock.distanceFrom200Day} /></td>
                    <td><span className="quality-inline"><i style={{ width: `${stock.qualityScore}%` }} />{stock.qualityScore}</span></td><td><strong className="dip-score-inline">{stock.dipScore}</strong></td><td><Tag tone={toneForClassification(stock.classification)}>{stock.classification}</Tag></td>
                    <td><button className={`watch-button ${watchlist.includes(stock.symbol) ? "is-active" : ""}`} onClick={(event) => { event.stopPropagation(); onToggleWatchlist(stock.symbol); }} aria-label={`${watchlist.includes(stock.symbol) ? "Remove" : "Add"} ${stock.symbol} ${watchlist.includes(stock.symbol) ? "from" : "to"} watchlist`}>{watchlist.includes(stock.symbol) ? "★" : "☆"}</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : (
            <div className="opportunity-map" aria-label="Price pain versus fundamental quality map">
              <div className="map-axis map-axis--y">Stronger business ↑</div><div className="map-axis map-axis--x">Deeper drawdown →</div><div className="map-quadrant map-quadrant--prime"><span>Quality on sale</span></div>
              {filtered.slice(0, mapLimit).map((stock) => <button key={stock.symbol} className={`map-bubble ${selectedStock?.symbol === stock.symbol ? "is-selected" : ""}`} style={{ left: `${clampPosition(Math.abs(stock.drawdown52Week), 3, 55)}%`, bottom: `${clampPosition(stock.qualityScore, 25, 90)}%` }} onClick={() => setSelected(stock.symbol)} title={`${stock.name}: ${stock.dipScore} dip score`}>{stock.symbol}<small>{stock.dipScore}</small></button>)}
            </div>
          )}
          {view === "rank" && pageCount > 1 && <div className="table-pagination"><span>Showing {page * pageSize + 1}–{Math.min(filtered.length, (page + 1) * pageSize)} of {filtered.length}</span><div><button disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>Previous</button><b>{page + 1} / {pageCount}</b><button disabled={page >= pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}>Next</button></div></div>}
          {view === "map" && filtered.length > mapLimit && <p className="method-note">Showing the top {mapLimit} ranked signals to keep the interactive map readable.</p>}
        </section>

        {selectedStock && (
          <aside className="panel signal-inspector">
            <div className="signal-inspector__header"><div className="company-cell"><StockMark symbol={selectedStock.symbol} /><span><b>{selectedStock.symbol}</b><small>{selectedStock.name}</small></span></div><ScoreDial value={selectedStock.dipScore} label="dip score" /></div>
            {selectedDetail.stock
              ? <InteractivePriceChart prices={selectedDetail.stock.prices} symbol={selectedStock.symbol} name={selectedStock.name} height={190} compact initialRange="6M" />
              : <div className="chart-empty" aria-live="polite"><b>{selectedDetail.error ? "Price history unavailable" : "Loading price history"}</b><span>{selectedDetail.error ?? `Fetching ${selectedStock.symbol} only.`}</span></div>}
            <div className="inspector-grid"><span><small>52W drawdown</small><b className="negative">{formatPercent(selectedStock.drawdown52Week)}</b></span><span><small>1 month</small><b className={selectedStock.oneMonthReturn >= 0 ? "positive" : "negative"}>{formatPercent(selectedStock.oneMonthReturn)}</b></span><span><small>Quality</small><b>{selectedStock.qualityScore}/100</b></span><span><small>Volatility</small><b>{selectedStock.volatility.toFixed(1)}%</b></span></div>
            <div className="score-anatomy"><span><b>Price dislocation</b><small>62% weight</small><i><em style={{ width: `${Math.min(100, Math.max(0, selectedStock.dipScore * 1.08))}%` }} /></i></span><span><b>Business quality</b><small>38% weight</small><i><em style={{ width: `${selectedStock.qualityScore}%` }} /></i></span></div>
            <div className="why-card"><span className="eyebrow">Why it surfaced</span><ul>{selectedStock.why.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>
            <button className="primary-button primary-button--wide" onClick={() => onSelect(selectedStock.symbol)}>Open full research <span>&rarr;</span></button>
          </aside>
        )}
      </div>
    </div>
  );
}

function SortableHeader({ label, column, active, direction, onSort }: { label: string; column: SortKey; active: SortKey; direction: SortDirection; onSort: (key: SortKey) => void }) {
  return <th aria-sort={active === column ? direction === "asc" ? "ascending" : "descending" : "none"}><button className="sort-button" onClick={() => onSort(column)}>{label}<span>{active === column ? direction === "asc" ? "↑" : "↓" : "↕"}</span></button></th>;
}

function clampPosition(value: number, minimum: number, maximum: number) {
  return Math.min(92, Math.max(8, ((value - minimum) / (maximum - minimum)) * 84 + 8));
}
