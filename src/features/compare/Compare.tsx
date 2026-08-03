"use client";

import { useState } from "react";
import type { AnalyzedStock } from "@/src/domain/stock";
import { formatCompactCurrency, formatPercent } from "@/src/domain/analytics";
import { LineChart, ScoreDial, StockMark } from "@/src/components/ui";

export function Compare({ stocks, onSelect }: { stocks: AnalyzedStock[]; onSelect: (symbol: string) => void }) {
  const [leftSymbol, setLeftSymbol] = useState(stocks[0]?.symbol ?? "");
  const [rightSymbol, setRightSymbol] = useState(stocks[1]?.symbol ?? "");
  const left = stocks.find((stock) => stock.symbol === leftSymbol) ?? stocks[0];
  const right = stocks.find((stock) => stock.symbol === rightSymbol) ?? stocks[1] ?? stocks[0];
  const rows = [
    ["Latest price", `$${left.latestPrice.toFixed(2)}`, `$${right.latestPrice.toFixed(2)}`],
    ["52W drawdown", formatPercent(left.drawdown52Week), formatPercent(right.drawdown52Week)],
    ["Revenue growth", formatPercent(left.revenueGrowth), formatPercent(right.revenueGrowth)],
    ["Operating margin", formatPercent(left.operatingMargin), formatPercent(right.operatingMargin)],
    ["Free-cash-flow margin", formatPercent(left.freeCashFlowMargin), formatPercent(right.freeCashFlowMargin)],
    ["Free cash flow", formatCompactCurrency(left.latestAnnual?.freeCashFlow), formatCompactCurrency(right.latestAnnual?.freeCashFlow)],
    ["Share-count change", formatPercent(left.shareChange), formatPercent(right.shareChange)],
  ];
  return (
    <div className="view-stack">
      <header className="section-hero"><div><span className="hero-panel__kicker">Side-by-side research</span><h1>Compare businesses,<br />not ticker symbols.</h1><p>Normalize operating performance and price pressure on one consistent framework.</p></div></header>
      <section className="compare-selector">
        {[{ stock: left, value: leftSymbol, set: setLeftSymbol }, { stock: right, value: rightSymbol, set: setRightSymbol }].map((item, index) => <div className="compare-company" key={index}><StockMark symbol={item.stock.symbol} size="lg" /><div><span className="eyebrow">{index === 0 ? "Company A" : "Company B"}</span><select value={item.value} onChange={(event) => item.set(event.target.value)}>{stocks.map((stock) => <option key={stock.symbol} value={stock.symbol}>{stock.symbol} — {stock.name}</option>)}</select><small>{item.stock.sector}</small></div><ScoreDial value={item.stock.qualityScore} label="quality" tone={index === 0 ? "coral" : "blue"} /></div>)}
      </section>
      <div className="compare-grid">
        <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Normalized performance</span><h2>Five-year price path</h2></div><span className="method-chip">Start = 100</span></div><LineChart series={[{ values: normalize(left.prices.map((point) => point.adjustedClose)), color: "#ef6c50" }, { values: normalize(right.prices.map((point) => point.adjustedClose)), color: "#1b6f74" }]} height={290} ariaLabel={`${left.name} and ${right.name} normalized five-year performance`} /><div className="comparison-legend"><span><i style={{ background: "#ef6c50" }} />{left.symbol}</span><span><i style={{ background: "#1b6f74" }} />{right.symbol}</span></div></section>
        <section className="panel comparison-table-panel"><div className="panel-heading"><div><span className="eyebrow">Operating comparison</span><h2>Head-to-head</h2></div></div><table className="comparison-table"><thead><tr><th>Metric</th><th>{left.symbol}</th><th>{right.symbol}</th></tr></thead><tbody>{rows.map(([label, a, b]) => <tr key={label}><td>{label}</td><td>{a}</td><td>{b}</td></tr>)}</tbody></table><div className="compare-actions"><button className="text-button" onClick={() => onSelect(left.symbol)}>Research {left.symbol} →</button><button className="text-button" onClick={() => onSelect(right.symbol)}>Research {right.symbol} →</button></div></section>
      </div>
    </div>
  );
}

function normalize(values: number[]) {
  const sampled = values.filter((_, index) => index % 10 === 0 || index === values.length - 1);
  const base = sampled[0] || 1;
  return sampled.map((value) => (value / base) * 100);
}
