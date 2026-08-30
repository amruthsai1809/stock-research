"use client";

import { useCallback, useMemo, useState, type CSSProperties, type DragEvent } from "react";
import type { MarketRepository } from "@/src/application/ports/repositories";
import type { StockSummary } from "@/src/domain/stock";
import { formatCompactCurrency, formatPercent } from "@/src/domain/analytics";
import { StockMark } from "@/src/components/ui";
import { CompanyPicker } from "@/src/components/CompanyPicker";
import { ComparisonChart, type CompareRange } from "@/src/components/charts/ComparisonChart";
import { COMPARISON_COLORS } from "@/src/components/charts/comparisonPalette";
import { useStockDetails } from "@/src/features/market/useStockDetails";

const MAX_COMPANIES = 5;
const DEFAULT_SYMBOLS = ["AAPL", "MSFT", "GOOGL"];

type PickerState = { mode: "add" } | { mode: "replace"; index: number } | null;

export function Compare({ stocks, onSelect, marketRepository }: { stocks: StockSummary[]; onSelect: (symbol: string) => void; marketRepository: MarketRepository }) {
  const [selectedSymbols, setSelectedSymbols] = useState(() => buildDefaultSymbols(stocks));
  const [range, setRange] = useState<CompareRange>("1Y");
  const [picker, setPicker] = useState<PickerState>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const closePicker = useCallback(() => setPicker(null), []);
  const selectedStocks = useMemo(
    () => selectedSymbols.map((symbol) => stocks.find((stock) => stock.symbol === symbol)).filter(Boolean) as StockSummary[],
    [selectedSymbols, stocks],
  );
  const details = useStockDetails(marketRepository, selectedSymbols);
  const orderedDetails = selectedSymbols
    .map((symbol) => details.stocks.find((stock) => stock.symbol === symbol))
    .filter(Boolean) as typeof details.stocks;

  const replaceAt = (index: number, symbol: string) => {
    setSelectedSymbols((current) => current.map((item, itemIndex) => itemIndex === index ? symbol : item));
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= selectedSymbols.length || from === to) return;
    setSelectedSymbols((current) => reorder(current, from, to));
    setPicker(null);
  };
  const remove = (index: number) => {
    if (selectedSymbols.length <= 2) return;
    setSelectedSymbols((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setPicker(null);
  };

  const metricRows = [
    { label: "Latest price", value: (stock: StockSummary) => `$${stock.latestPrice.toFixed(2)}` },
    { label: "52W drawdown", value: (stock: StockSummary) => formatPercent(stock.drawdown52Week) },
    { label: "Revenue growth", value: (stock: StockSummary) => formatPercent(stock.revenueGrowth) },
    { label: "Operating margin", value: (stock: StockSummary) => formatPercent(stock.operatingMargin) },
    { label: "Free-cash-flow margin", value: (stock: StockSummary) => formatPercent(stock.freeCashFlowMargin) },
    { label: "Free cash flow", value: (stock: StockSummary) => formatCompactCurrency(stock.latestAnnual?.freeCashFlow, stock.reportingCurrency ?? stock.currency) },
    { label: "Share-count change", value: (stock: StockSummary) => formatPercent(stock.shareChange) },
  ];

  return (
    <div className="view-stack compare-view">
      <header className="section-hero section-hero--compact">
        <div><span className="hero-panel__kicker">Multi-company research</span><h1>Compare the business and the price.</h1><p>Put up to five companies on one starting line, then change the roster without losing context.</p></div>
      </header>

      <section className="compare-roster-panel panel">
        <div className="compare-roster-heading">
          <div><span className="eyebrow">Comparison roster</span><h2>Build the set you actually want to study</h2><p>Click a company to replace it. Drag or use the arrows to change chart and table order.</p></div>
          <div className="compare-roster-count"><strong>{selectedStocks.length}</strong><span>of {MAX_COMPANIES}<small>companies</small></span></div>
        </div>

        <div className="compare-roster" role="list" aria-label="Companies being compared">
          {selectedStocks.map((stock, index) => (
            <article
              role="listitem"
              className={`compare-company-slot ${draggedIndex === index ? "is-dragging" : ""}`}
              style={{ "--series-color": COMPARISON_COLORS[index] } as CSSProperties}
              key={stock.symbol}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedIndex != null) move(draggedIndex, index);
                setDraggedIndex(null);
              }}
            >
              <div className="compare-company-card">
                <div className="compare-company-card__top">
                  <span><i />Series {index + 1}</span>
                  <div>
                    <button
                      type="button"
                      draggable
                      className="compare-drag-handle"
                      aria-label={`Drag ${stock.symbol} to reorder`}
                      title="Drag to reorder"
                      onDragStart={(event: DragEvent<HTMLButtonElement>) => {
                        event.dataTransfer.effectAllowed = "move";
                        setDraggedIndex(index);
                      }}
                      onDragEnd={() => setDraggedIndex(null)}
                    >⋮⋮</button>
                    <button type="button" onClick={() => move(index, index - 1)} disabled={index === 0} aria-label={`Move ${stock.symbol} left`}>←</button>
                    <button type="button" onClick={() => move(index, index + 1)} disabled={index === selectedStocks.length - 1} aria-label={`Move ${stock.symbol} right`}>→</button>
                    <button type="button" onClick={() => remove(index)} disabled={selectedStocks.length <= 2} aria-label={`Remove ${stock.symbol}`}>×</button>
                  </div>
                </div>
                <button
                  type="button"
                  className="compare-company-card__identity"
                  aria-label={`Replace ${stock.symbol}`}
                  aria-expanded={picker?.mode === "replace" && picker.index === index}
                  onClick={() => setPicker((current) => current?.mode === "replace" && current.index === index ? null : { mode: "replace", index })}
                >
                  <StockMark symbol={stock.symbol} size="md" />
                  <span><b>{stock.symbol}</b><small title={stock.name}>{stock.name}</small></span>
                  <em><strong>{stock.qualityScore}</strong><small>quality</small></em>
                </button>
                <div className="compare-company-card__sector"><span>{stock.sector}</span><b>Replace⌄</b></div>
              </div>
              {picker?.mode === "replace" && picker.index === index && (
                <CompanyPicker
                  stocks={stocks}
                  excludedSymbols={selectedSymbols}
                  label={`Find a company to replace ${stock.symbol}`}
                  align={index >= Math.ceil(selectedStocks.length / 2) ? "right" : "left"}
                  onSelect={(symbol) => replaceAt(index, symbol)}
                  onClose={closePicker}
                />
              )}
            </article>
          ))}

          {selectedStocks.length < MAX_COMPANIES && (
            <div className="compare-company-slot compare-company-slot--add" role="listitem">
              <button
                type="button"
                className="compare-add-company"
                aria-expanded={picker?.mode === "add"}
                onClick={() => setPicker((current) => current?.mode === "add" ? null : { mode: "add" })}
              >
                <span>+</span><b>Add company</b><small>{MAX_COMPANIES - selectedStocks.length} slots available</small>
              </button>
              {picker?.mode === "add" && (
                <CompanyPicker
                  stocks={stocks}
                  excludedSymbols={selectedSymbols}
                  label="Find a company to add"
                  align="right"
                  onSelect={(symbol) => setSelectedSymbols((current) => [...current, symbol].slice(0, MAX_COMPANIES))}
                  onClose={closePicker}
                />
              )}
            </div>
          )}
        </div>
        <div className="compare-roster-note"><span><i />Colors and order stay consistent across the chart and table.</span><small>Minimum 2 · Maximum 5</small></div>
      </section>

      <div className="compare-grid">
        <section className="panel compare-performance-panel">
          <div className="panel-heading"><div><span className="eyebrow">Normalized performance</span><h2>Price return, same starting line</h2><p>Move across the chart to compare exact relative returns on any date.</p></div><span className="method-chip">Period start = 0%</span></div>
          {orderedDetails.length === selectedSymbols.length
            ? <ComparisonChart stocks={orderedDetails} range={range} onRangeChange={setRange} />
            : <div className="chart-empty" aria-live="polite"><b>{details.error ? "Comparison history unavailable" : "Loading company histories"}</b><span>{details.error ?? `Fetching only the ${selectedSymbols.length} selected companies.`}</span></div>}
        </section>
        <section className="panel comparison-table-panel">
          <div className="panel-heading"><div><span className="eyebrow">Operating comparison</span><h2>One metric, every company</h2><p>The first column stays anchored while the company columns scroll on smaller screens.</p></div></div>
          <div className="comparison-table-scroll">
            <table className="comparison-table">
              <thead><tr><th>Metric</th>{selectedStocks.map((stock, index) => <th key={stock.symbol}><i style={{ background: COMPARISON_COLORS[index] }} />{stock.symbol}</th>)}</tr></thead>
              <tbody>{metricRows.map((row) => <tr key={row.label}><td>{row.label}</td>{selectedStocks.map((stock) => <td key={stock.symbol}>{row.value(stock)}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <div className="compare-actions">{selectedStocks.map((stock) => <button key={stock.symbol} className="text-button" onClick={() => onSelect(stock.symbol)}>Research {stock.symbol} →</button>)}</div>
        </section>
      </div>
    </div>
  );
}

function buildDefaultSymbols(stocks: StockSummary[]): string[] {
  const available = new Set(stocks.map((stock) => stock.symbol));
  const defaults = DEFAULT_SYMBOLS.filter((symbol) => available.has(symbol));
  for (const stock of stocks) {
    if (defaults.length >= 3) break;
    if (!defaults.includes(stock.symbol)) defaults.push(stock.symbol);
  }
  return defaults;
}

function reorder<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
