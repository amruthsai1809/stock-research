"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import type { AnalyzedStock } from "@/src/domain/stock";
import { analyzePortfolio, demoPortfolioTransactions, parseBrokerPdfText, parsePortfolioText, type BenchmarkDataset, type PortfolioBenchmark, type PortfolioParseResult, type PortfolioTransaction } from "@/src/domain/portfolio";
import { PortfolioPerformanceChart } from "@/src/components/charts/PortfolioPerformanceChart";
import { MetricCard, StockMark, Tag } from "@/src/components/ui";

export function PortfolioLab({ stocks, onSelect }: { stocks: AnalyzedStock[]; onSelect: (symbol: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>(demoPortfolioTransactions);
  const [benchmarks, setBenchmarks] = useState<PortfolioBenchmark[]>([]);
  const [benchmark, setBenchmark] = useState("SPY");
  const [sourceName, setSourceName] = useState("Guided demo portfolio");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const analysis = useMemo(() => analyzePortfolio(transactions, stocks, benchmark, benchmarks), [transactions, stocks, benchmark, benchmarks]);
  const coverageTone = analysis.coverage.score >= 90 ? "good" : analysis.coverage.score >= 70 ? "warn" : "bad";

  useEffect(() => {
    let active = true;
    fetch("./data/benchmark-data.json").then((response) => { if (!response.ok) throw new Error(); return response.json() as Promise<BenchmarkDataset>; }).then((payload) => { if (active) setBenchmarks(payload.benchmarks); }).catch(() => { if (active) setBenchmark(stocks[0]?.symbol ?? ""); });
    return () => { active = false; };
  }, [stocks]);

  const openFile = () => inputRef.current?.click();
  const handleInput = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = ""; };
  const handleDrop = (event: DragEvent) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void importFile(file); };
  const importFile = async (file: File) => {
    try {
      let result: PortfolioParseResult;
      if (file.name.toLowerCase().endsWith(".pdf")) {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        const pages: string[] = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const content = await page.getTextContent();
          pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
        }
        result = parseBrokerPdfText(pages.join("\n"), file.name);
      } else result = parsePortfolioText(await file.text(), file.name);
      setWarnings(result.warnings);
      if (result.transactions.length) { setTransactions(result.transactions); setSourceName(`${file.name} · ${result.format.toUpperCase()}`); }
    } catch {
      setWarnings(["This file could not be read. Try the brokerage CSV, QFX/OFX, QIF, or a TIDE JSON export."]);
    }
  };

  return <div className="view-stack portfolio-lab">
    <section className="section-hero portfolio-hero">
      <div>
        <span className="hero-panel__kicker"><i />Private portfolio lab</span>
        <h1>Your history.<br /><em>Measured honestly.</em></h1>
        <p>Import brokerage activity locally, reconstruct your holdings, and compare every contribution against a stock or ETF—without uploading a document.</p>
        <div className="hero-actions"><button className="primary-button primary-button--large" onClick={openFile}>Import activity file <span>↑</span></button><button className="text-button" onClick={() => { setTransactions(demoPortfolioTransactions); setSourceName("Guided demo portfolio"); setWarnings([]); }}>Reset guided demo</button></div>
      </div>
      <aside className="privacy-card">
        <span className="privacy-card__seal">LOCAL</span>
        <div><span className="eyebrow">Privacy architecture</span><h2>Your file never leaves this tab.</h2></div>
        <ul><li><i />Parsed in your browser</li><li><i />No account connection</li><li><i />Nothing saved automatically</li></ul>
        <small>Close or refresh the page and the imported portfolio is gone.</small>
      </aside>
    </section>

    <section className="portfolio-workbar panel">
      <div className={`import-dropzone ${dragging ? "is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
        <input ref={inputRef} className="visually-hidden" type="file" accept=".csv,.tsv,.txt,.json,.ofx,.qfx,.qif,.pdf" onChange={handleInput} />
        <span className="import-dropzone__icon">↥</span><div><b>{sourceName}</b><small>CSV · QFX/OFX · QIF · JSON · PDF (best effort)</small></div><button className="secondary-button" onClick={openFile}>Choose file</button>
      </div>
      <label className="benchmark-control"><span className="eyebrow">Benchmark</span><select value={benchmark} onChange={(event) => setBenchmark(event.target.value)}><optgroup label="Broad-market ETFs">{benchmarks.map((instrument) => <option key={instrument.symbol} value={instrument.symbol}>{instrument.symbol} · {instrument.category}</option>)}</optgroup><optgroup label="Covered stocks">{stocks.map((stock) => <option key={stock.symbol} value={stock.symbol}>{stock.symbol} · {stock.name}</option>)}</optgroup></select><small>Contributions are invested on matching dates</small></label>
      <button className="secondary-button" onClick={() => exportPortfolio(transactions)}>Export normalized JSON ↓</button>
    </section>
    {warnings.length > 0 && <div className="import-warnings" role="status">{warnings.map((warning) => <span key={warning}>⚑ {warning}</span>)}</div>}

    <section className="metric-grid metric-grid--six">
      <MetricCard label="Current value" value={money(analysis.currentValue)} detail={`${analysis.holdings.length} open positions`} accent="coral" />
      <MetricCard label="Net contributions" value={money(analysis.deposits - analysis.withdrawals)} detail={`${transactions.length} ledger entries`} />
      <MetricCard label="Total gain" value={signedMoney(analysis.gain)} detail={<span className={analysis.gainPercent >= 0 ? "positive" : "negative"}>{signed(analysis.gainPercent)}%</span>} accent="green" />
      <MetricCard label="Annualized" value={`${signed(analysis.annualizedReturn)}%`} detail="Since first activity" />
      <MetricCard label="Max drawdown" value={`${analysis.maxDrawdown.toFixed(1)}%`} detail="Peak-to-trough" />
      <MetricCard label="Data coverage" value={`${analysis.coverage.score}%`} detail={<Tag tone={coverageTone}>{analysis.coverage.pricedTransactions}/{analysis.coverage.totalTransactions} priced</Tag>} accent="blue" />
    </section>

    <section className="panel portfolio-performance">
      <div className="panel-heading"><div><span className="eyebrow">Cash-flow matched comparison</span><h2>Performance, on equal footing</h2><p>The benchmark receives the same deposits and withdrawals on the same dates.</p></div><Tag tone={analysis.totalReturn >= analysis.benchmarkReturn ? "good" : "warn"}>{analysis.totalReturn >= analysis.benchmarkReturn ? "Outperforming" : "Trailing"} {benchmark}</Tag></div>
      <PortfolioPerformanceChart points={analysis.series} benchmark={benchmark} />
    </section>

    <div className="portfolio-detail-grid">
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">Live reconstruction</span><h2>Current holdings</h2><p>Latest available end-of-day prices, not live quotes.</p></div></div>
        {analysis.holdings.length ? <div className="holdings-table">
          <div className="table-row table-row--head"><span>Security</span><span>Allocation</span><span>Value</span><span>Return</span></div>
          {analysis.holdings.map((holding) => <button className="table-row" key={holding.symbol} onClick={() => onSelect(holding.symbol)}><span className="company-cell"><StockMark symbol={holding.symbol} size="sm" /><span><b>{holding.symbol}</b><small>{holding.quantity.toFixed(holding.quantity % 1 ? 2 : 0)} shares · avg {money(holding.averageCost)}</small></span></span><span><i className="allocation-bar"><i style={{ width: `${Math.min(100, holding.weight)}%` }} /></i><small>{holding.weight.toFixed(1)}%</small></span><span><b>{money(holding.marketValue)}</b><small>@ {money(holding.latestPrice)}</small></span><span className={holding.gainPercent >= 0 ? "positive" : "negative"}><b>{signed(holding.gainPercent)}%</b><small>{signedMoney(holding.gain)}</small></span></button>)}
        </div> : <div className="chart-empty"><b>No open holdings</b><span>Import purchase and sale activity to reconstruct positions.</span></div>}
      </section>
      <section className="panel risk-card">
        <div className="panel-heading"><div><span className="eyebrow">Decision context</span><h2>Return & risk</h2></div></div>
        <div className="risk-score"><strong>{signed(analysis.totalReturn - analysis.benchmarkReturn)}</strong><span>percentage-point<br />benchmark spread</span></div>
        <dl><div><dt>Portfolio return</dt><dd>{signed(analysis.totalReturn)}%</dd></div><div><dt>{benchmark} return</dt><dd>{signed(analysis.benchmarkReturn)}%</dd></div><div><dt>Annual volatility</dt><dd>{analysis.volatility.toFixed(1)}%</dd></div><div><dt>Cash balance</dt><dd>{money(analysis.cash)}</dd></div><div><dt>Income captured</dt><dd>{money(analysis.income)}</dd></div></dl>
        <p className="method-note"><b>Important:</b> Results depend on the completeness of imported records. Missing transfers, splits, dividends, or corporate actions can materially change performance.</p>
      </section>
    </div>

    <section className="panel">
      <div className="panel-heading"><div><span className="eyebrow">Audit trail</span><h2>Normalized activity ledger</h2><p>Review exactly what TIDE understood before using the analysis.</p></div><Tag tone="neutral">{formatDate(analysis.coverage.start)} — {formatDate(analysis.coverage.end)}</Tag></div>
      <div className="activity-table"><div className="activity-row activity-row--head"><span>Date</span><span>Action</span><span>Security</span><span>Quantity</span><span>Amount</span><span>Source</span></div>{[...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40).map((transaction) => <div className="activity-row" key={transaction.id}><span>{formatDate(transaction.date)}</span><span><Tag tone={transaction.type === "buy" || transaction.type === "deposit" ? "good" : transaction.type === "sell" || transaction.type === "withdrawal" ? "warn" : "blue"}>{transaction.type}</Tag></span><span>{transaction.symbol ?? "Cash"}</span><span>{transaction.quantity ? transaction.quantity.toFixed(2) : "—"}</span><span>{money(transaction.amount)}</span><span>{transaction.source}</span></div>)}</div>
    </section>
  </div>;
}

function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value < 1000 ? 2 : 0 }).format(value); }
function signed(value: number) { return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`; }
function signedMoney(value: number) { return `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`; }
function formatDate(value: string | null) { if (!value) return "—"; return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function exportPortfolio(transactions: PortfolioTransaction[]) { const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), transactions }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "tide-portfolio.json"; anchor.click(); URL.revokeObjectURL(url); }
