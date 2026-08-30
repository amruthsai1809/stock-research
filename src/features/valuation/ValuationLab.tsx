"use client";

import { useMemo, useState } from "react";
import type { StockSummary } from "@/src/domain/stock";
import { formatCompactCurrency, formatPercent } from "@/src/domain/analytics";
import { MetricCard, ScoreDial, StockMark, Tag } from "@/src/components/ui";
import { CompanySelect } from "@/src/components/CompanySelect";

export function ValuationLab({ stocks, initialSymbol, onSelect }: { stocks: StockSummary[]; initialSymbol: string; onSelect: (symbol: string) => void }) {
  const [symbol, setSymbol] = useState(initialSymbol || stocks[0]?.symbol || "");
  const [growth, setGrowth] = useState(8);
  const [discount, setDiscount] = useState(10);
  const [terminalGrowth, setTerminalGrowth] = useState(3);
  const [marginOfSafety, setMarginOfSafety] = useState(20);
  const stock = stocks.find((item) => item.symbol === symbol) ?? stocks[0];
  const result = useMemo(() => calculateDcf(stock, growth, discount, terminalGrowth), [stock, growth, discount, terminalGrowth]);
  const buyBelow = result.perShare * (1 - marginOfSafety / 100);
  const upside = ((result.perShare - stock.latestPrice) / stock.latestPrice) * 100;

  return (
    <div className="view-stack">
      <header className="section-hero section-hero--valuation"><div><span className="hero-panel__kicker">Interactive valuation laboratory</span><h1>Make expectations<br />visible.</h1><p>Build a transparent cash-flow scenario, pressure-test assumptions, and compare it with the market price.</p></div><div className="valuation-company-picker"><StockMark symbol={stock.symbol} size="lg" /><CompanySelect stocks={stocks} value={stock.symbol} label="Valuing" detail={`Latest FCF ${formatCompactCurrency(stock.latestAnnual?.freeCashFlow)}`} onChange={setSymbol} align="right" /></div></header>

      <section className="metric-grid metric-grid--four">
        <MetricCard label="Model value" value={`$${result.perShare.toFixed(2)}`} detail={<Tag tone={upside >= 0 ? "good" : "bad"}>{formatPercent(upside)} vs price</Tag>} accent="green" />
        <MetricCard label="Latest price" value={`$${stock.latestPrice.toFixed(2)}`} detail="end-of-day adjusted close" />
        <MetricCard label="Buy-below price" value={`$${buyBelow.toFixed(2)}`} detail={`${marginOfSafety}% margin of safety`} accent="coral" />
        <MetricCard label="Confidence" value={`${result.confidence}/100`} detail="based on filing coverage" accent="blue" />
      </section>

      <div className="valuation-grid">
        <section className="panel assumptions-panel">
          <div className="panel-heading"><div><span className="eyebrow">Base case</span><h2>Model assumptions</h2></div><button className="text-button" onClick={() => { setGrowth(8); setDiscount(10); setTerminalGrowth(3); setMarginOfSafety(20); }}>Reset</button></div>
          <div className="assumption-list">
            <RangeControl label="Five-year FCF growth" value={growth} minimum={-5} maximum={25} step={1} onChange={setGrowth} />
            <RangeControl label="Discount rate" value={discount} minimum={6} maximum={18} step={.5} onChange={setDiscount} />
            <RangeControl label="Terminal growth" value={terminalGrowth} minimum={0} maximum={5} step={.25} onChange={setTerminalGrowth} />
            <RangeControl label="Margin of safety" value={marginOfSafety} minimum={0} maximum={50} step={5} onChange={setMarginOfSafety} />
          </div>
          <div className="assumption-note"><span>ⓘ</span><p>This compact equity DCF uses reported free cash flow and diluted share count. It intentionally avoids pretending that uncertain inputs are precise.</p></div>
        </section>

        <section className="panel valuation-output">
          <div className="valuation-output__top"><div><span className="eyebrow">Discounted cash-flow result</span><h2>${result.perShare.toFixed(2)} <small>per share</small></h2><p>{upside >= 0 ? "Model value sits above" : "Model value sits below"} the latest available market price by {Math.abs(upside).toFixed(1)}%.</p></div><ScoreDial value={Math.round(Math.max(0, Math.min(100, 50 + upside)))} label="value gap" tone={upside >= 0 ? "green" : "coral"} /></div>
          <div className="cashflow-bars" aria-label="Projected free cash flow">
            {result.cashFlows.map((value, index) => <div key={index}><i style={{ height: `${Math.max(15, (value / Math.max(...result.cashFlows)) * 100)}%` }} /><span>Y{index + 1}</span><b>{formatCompactCurrency(value)}</b></div>)}
          </div>
          <div className="valuation-bridge"><span><small>PV of 5Y cash flows</small><b>{formatCompactCurrency(result.presentCashFlows)}</b></span><span>+</span><span><small>PV of terminal value</small><b>{formatCompactCurrency(result.presentTerminal)}</b></span><span>=</span><span><small>Equity value</small><b>{formatCompactCurrency(result.equityValue)}</b></span></div>
          <button className="secondary-button" onClick={() => onSelect(stock.symbol)}>Review {stock.symbol} fundamentals →</button>
        </section>
      </div>

      <section className="panel sensitivity-panel">
        <div className="panel-heading"><div><span className="eyebrow">Scenario pressure test</span><h2>Value per share sensitivity</h2></div><span className="method-chip">Growth × discount rate</span></div>
        <div className="sensitivity-grid">
          <span className="sensitivity-corner">Growth ↓ / Rate →</span>
          {[discount - 2, discount - 1, discount, discount + 1, discount + 2].map((rate) => <b key={rate}>{rate.toFixed(1)}%</b>)}
          {[growth + 4, growth + 2, growth, growth - 2, growth - 4].map((growthRate) => [<b key={`label-${growthRate}`}>{growthRate.toFixed(0)}%</b>, ...[discount - 2, discount - 1, discount, discount + 1, discount + 2].map((rate) => { const value = calculateDcf(stock, growthRate, rate, terminalGrowth).perShare; const favorable = value > stock.latestPrice; return <span key={`${growthRate}-${rate}`} className={favorable ? "is-favorable" : value < stock.latestPrice * .8 ? "is-unfavorable" : ""}>${value.toFixed(0)}</span>; })])}
        </div>
      </section>
    </div>
  );
}

function RangeControl({ label, value, minimum, maximum, step, onChange }: { label: string; value: number; minimum: number; maximum: number; step: number; onChange: (value: number) => void }) {
  return <label className="range-field range-field--valuation"><span><b>{label}</b><input className="range-number" type="number" aria-label={`${label} exact value`} min={minimum} max={maximum} step={step} value={value} onChange={(event) => onChange(Math.min(maximum, Math.max(minimum, Number(event.target.value))))} /></span><input type="range" min={minimum} max={maximum} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /><small><span>{minimum}%</span><span>{maximum}%</span></small></label>;
}

function calculateDcf(stock: StockSummary, growth: number, discount: number, terminalGrowth: number) {
  const baseFcf = Math.max(1, stock.latestAnnual?.freeCashFlow ?? stock.latestAnnual?.netIncome ?? 1);
  const discountRate = discount / 100;
  const terminalRate = Math.min(terminalGrowth / 100, discountRate - .005);
  const cashFlows = Array.from({ length: 5 }, (_, index) => baseFcf * (1 + growth / 100) ** (index + 1));
  const presentCashFlows = cashFlows.reduce((total, value, index) => total + value / (1 + discountRate) ** (index + 1), 0);
  const terminalValue = cashFlows.at(-1)! * (1 + terminalRate) / (discountRate - terminalRate);
  const presentTerminal = terminalValue / (1 + discountRate) ** 5;
  const equityValue = presentCashFlows + presentTerminal;
  const shares = Math.max(1, stock.latestAnnual?.shares ?? equityValue / Math.max(1, stock.latestPrice));
  const dataPoints = Object.values(stock.latestAnnual ?? {}).filter((value) => value != null).length;
  return { cashFlows, presentCashFlows, presentTerminal, equityValue, perShare: equityValue / shares, confidence: Math.min(94, 48 + dataPoints * 4) };
}
