"use client";

import { useMemo, useState } from "react";
import type { StockSummary } from "@/src/domain/stock";
import { Change, StockMark, Tag } from "@/src/components/ui";
import { formatCompactCurrency, formatPercent } from "@/src/domain/analytics";

export function Screener({ stocks, onSelect }: { stocks: StockSummary[]; onSelect: (symbol: string) => void }) {
  const [minimumQuality, setMinimumQuality] = useState(50);
  const [maximumDrawdown, setMaximumDrawdown] = useState(0);
  const [positiveFcf, setPositiveFcf] = useState(true);
  const [sector, setSector] = useState("All sectors");
  const [page, setPage] = useState(0);
  const sectors = ["All sectors", ...new Set(stocks.map((stock) => stock.sector))];
  const matches = useMemo(() => stocks.filter((stock) =>
    stock.qualityScore >= minimumQuality &&
    (maximumDrawdown === 0 || stock.drawdown52Week <= maximumDrawdown) &&
    (!positiveFcf || (stock.latestAnnual?.freeCashFlow ?? 0) > 0) &&
    (sector === "All sectors" || stock.sector === sector),
  ), [stocks, minimumQuality, maximumDrawdown, positiveFcf, sector]);
  const pageSize = 100;
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  const visible = matches.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="view-stack">
      <header className="section-hero"><div><span className="hero-panel__kicker">Local screening engine</span><h1>Build a better shortlist.</h1><p>Combine price dislocation with financial resilience. Results update instantly in your browser.</p></div><div className="section-hero__stat"><strong>{matches.length}</strong><span>companies match</span><small>from {stocks.length} analyzed</small></div></header>
      <section className="panel screener-builder">
        <div className="panel-heading"><div><span className="eyebrow">Screen logic</span><h2>All conditions must pass</h2></div><button className="text-button" onClick={() => { setMinimumQuality(50); setMaximumDrawdown(0); setPositiveFcf(true); setSector("All sectors"); setPage(0); }}>Reset filters</button></div>
        <div className="filter-builder-grid">
          <label className="range-field"><span><b>Quality score</b><strong>≥ {minimumQuality}</strong></span><input type="range" min="20" max="90" value={minimumQuality} onChange={(event) => { setMinimumQuality(Number(event.target.value)); setPage(0); }} /></label>
          <label className="select-field select-field--large"><span>52W drawdown</span><select value={maximumDrawdown} onChange={(event) => { setMaximumDrawdown(Number(event.target.value)); setPage(0); }}><option value="0">Any drawdown</option><option value="-10">Down 10%+</option><option value="-20">Down 20%+</option><option value="-30">Down 30%+</option></select></label>
          <label className="select-field select-field--large"><span>Sector</span><select value={sector} onChange={(event) => { setSector(event.target.value); setPage(0); }}>{sectors.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="toggle-field"><span><b>Positive free cash flow</b><small>Latest fiscal year</small></span><input type="checkbox" checked={positiveFcf} onChange={(event) => { setPositiveFcf(event.target.checked); setPage(0); }} /></label>
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">Screen results</span><h2>{matches.length} passing companies</h2></div><button className="secondary-button" onClick={() => downloadCsv(matches)}>Export CSV ↓</button></div>
        <div className="dip-table-wrap"><table className="data-table"><thead><tr><th>Company</th><th>Sector</th><th>Price</th><th>52W drawdown</th><th>Revenue growth</th><th>FCF</th><th>Quality</th><th>Classification</th></tr></thead><tbody>{visible.map((stock) => <tr key={stock.symbol} onClick={() => onSelect(stock.symbol)}><td><button className="company-cell"><StockMark symbol={stock.symbol} size="sm" /><span><b>{stock.symbol}</b><small>{stock.name}</small></span></button></td><td>{stock.sector}</td><td>${stock.latestPrice.toFixed(2)}</td><td><Change value={stock.drawdown52Week} /></td><td><Change value={stock.revenueGrowth} /></td><td>{formatCompactCurrency(stock.latestAnnual?.freeCashFlow)}</td><td><span className="quality-inline"><i style={{ width: `${stock.qualityScore}%` }} />{stock.qualityScore}</span></td><td><Tag tone={stock.qualityScore >= 65 ? "good" : "warn"}>{stock.classification}</Tag></td></tr>)}</tbody></table></div>
        {pageCount > 1 && <div className="table-pagination"><span>Showing {page * pageSize + 1}–{Math.min(matches.length, (page + 1) * pageSize)} of {matches.length}</span><div><button disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>Previous</button><b>{page + 1} / {pageCount}</b><button disabled={page >= pageCount - 1} onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}>Next</button></div></div>}
      </section>
    </div>
  );
}

function downloadCsv(stocks: StockSummary[]) {
  const rows = [["Symbol", "Company", "Sector", "Price", "52W Drawdown", "Revenue Growth", "Quality"], ...stocks.map((stock) => [stock.symbol, stock.name, stock.sector, stock.latestPrice.toFixed(2), formatPercent(stock.drawdown52Week), formatPercent(stock.revenueGrowth), String(stock.qualityScore)])];
  const blob = new Blob([rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "stock-research-screen.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}
