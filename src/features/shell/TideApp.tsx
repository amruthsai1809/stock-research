"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalyzedStock, MarketDataset } from "@/src/domain/stock";
import { analyzeUniverse } from "@/src/domain/analytics";
import { StockMark, Tag } from "@/src/components/ui";
import { Discover } from "@/src/features/discover/Discover";
import { DipFinder } from "@/src/features/dip-finder/DipFinder";
import { CompanyResearch } from "@/src/features/company/CompanyResearch";
import { Screener } from "@/src/features/screener/Screener";
import { Compare } from "@/src/features/compare/Compare";
import { ValuationLab } from "@/src/features/valuation/ValuationLab";
import { FilingIntel } from "@/src/features/filings/FilingIntel";
import { PortfolioLab } from "@/src/features/portfolio/PortfolioLab";
import { InstitutionalHoldings } from "@/src/features/institutional/InstitutionalHoldings";
import { GovernmentInvestments } from "@/src/features/government/GovernmentInvestments";
import { navigation, readSymbol, readView, writeView, type AppView } from "@/src/features/shell/navigation";
import { marketRepository } from "@/src/infrastructure/repositories/staticMarketRepository";

export function TideApp() {
  const [dataset, setDataset] = useState<MarketDataset | null>(null);
  const [dataError, setDataError] = useState(false);
  const stocks = useMemo(() => analyzeUniverse(dataset?.stocks ?? []), [dataset]);
  const [view, setView] = useState<AppView>(readView);
  const [selectedSymbol, setSelectedSymbol] = useState(() => readSymbol("AAPL"));
  const [watchlist, setWatchlist] = useState<string[]>(readWatchlist);
  const [searchOpen, setSearchOpen] = useState(false);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(readTheme);
  const selectedStock = stocks.find((stock) => stock.symbol === selectedSymbol) ?? stocks[0];

  useEffect(() => {
    let active = true;
    marketRepository.load().then((payload) => { if (active) setDataset(payload); }).catch(() => { if (active) setDataError(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("tide-theme", theme);
  }, [theme]);

  useEffect(() => {
    const handleHistory = () => { setView(readView()); setSelectedSymbol(readSymbol("AAPL")); };
    window.addEventListener("popstate", handleHistory);
    return () => window.removeEventListener("popstate", handleHistory);
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen((current) => !current); }
      if (event.key === "Escape") { setSearchOpen(false); setWatchlistOpen(false); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const nav = document.querySelector<HTMLElement>(".mobile-nav");
      const active = nav?.querySelector<HTMLElement>(".is-active");
      if (nav && active && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: Math.max(0, active.offsetLeft - nav.clientWidth / 2 + active.clientWidth / 2), behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [view]);

  const navigate = (next: AppView) => {
    setView(next);
    writeView(next, next === "company" ? selectedSymbol : undefined);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectStock = (symbol: string) => {
    setSelectedSymbol(symbol);
    setView("company");
    writeView("company", symbol);
    setSearchOpen(false);
    setWatchlistOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleWatchlist = (symbol: string) => {
    setWatchlist((current) => {
      const next = current.includes(symbol) ? current.filter((item) => item !== symbol) : [...current, symbol];
      localStorage.setItem("tide-watchlist", JSON.stringify(next));
      return next;
    });
  };

  if (!dataset) return <ProductLoading failed={dataError} />;

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => navigate("discover")} aria-label="TIDE home"><span className="brand__mark">T</span><span><b>TIDE</b><small>Equity research</small></span></button>
      <nav className="primary-nav" aria-label="Primary navigation">
        <span className="nav-label">Research</span>
        {navigation.filter((item) => item.section === "Research").map((item) => <button key={item.id} className={view === item.id || (item.id === "discover" && view === "company") ? "is-active" : ""} onClick={() => navigate(item.id)}><span>{item.glyph}</span>{item.label}{item.id === "dips" && <em>{stocks.filter((stock) => stock.drawdown52Week < -15).length}</em>}</button>)}
        <span className="nav-label nav-label--second">Intelligence</span>
        {navigation.filter((item) => item.section === "Intelligence").map((item) => <button key={item.id} className={view === item.id ? "is-active" : ""} onClick={() => navigate(item.id)}><span>{item.glyph}</span>{item.label}</button>)}
      </nav>
      <div className="sidebar-section">
        <span className="nav-label">Workspace</span>
        <button onClick={() => setWatchlistOpen(true)}><span>☆</span>Watchlist<em>{watchlist.length}</em></button>
        <button onClick={() => setSearchOpen(true)}><span>⌕</span>Company search</button>
      </div>
      <div className="sidebar-card"><span className="sidebar-card__icon">◉</span><b>Portfolio lab</b><p>Analyze a brokerage export without uploading it.</p><button onClick={() => navigate("portfolio")}>Open private lab →</button></div>
      <footer className="sidebar-footer"><span className="source-status"><i /> Static sources ready</span><small>SEC · House · EOD prices</small></footer>
    </aside>

    <div className="app-main">
      <header className="topbar">
        <button className="mobile-brand" onClick={() => navigate("discover")}><span className="brand__mark">T</span>TIDE</button>
        <button className="search-trigger" onClick={() => setSearchOpen(true)}><span>⌕</span><span>Search any company or ticker</span><kbd>⌘ K</kbd></button>
        <div className="topbar__actions">
          <div className="as-of"><span className="live-dot" /><span><b>End-of-day data</b><small>As of {formatDate(dataset.priceAsOf)}</small></span></div>
          <button className="round-button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}>{theme === "light" ? "◐" : "◑"}</button>
          <button className="watchlist-trigger" onClick={() => setWatchlistOpen(true)} aria-label="Open watchlist">★ <span>{watchlist.length}</span></button>
        </div>
      </header>

      <div className="data-banner"><span>Research snapshot</span><p>End-of-day prices and official filings · No login · No paid data service · Not investment advice</p><button onClick={() => navigate("filings")}>Inspect sources →</button></div>

      <main className="content">
        {view === "discover" && <Discover stocks={stocks} onSelect={selectStock} onOpenDipFinder={() => navigate("dips")} />}
        {view === "dips" && <DipFinder stocks={stocks} onSelect={selectStock} watchlist={watchlist} onToggleWatchlist={toggleWatchlist} />}
        {view === "company" && selectedStock && <CompanyResearch stock={selectedStock} isWatched={watchlist.includes(selectedStock.symbol)} onToggleWatchlist={toggleWatchlist} onOpenValuation={() => navigate("valuation")} />}
        {view === "screener" && <Screener stocks={stocks} onSelect={selectStock} />}
        {view === "compare" && <Compare stocks={stocks} onSelect={selectStock} />}
        {view === "valuation" && <ValuationLab stocks={stocks} initialSymbol={selectedSymbol} onSelect={selectStock} />}
        {view === "filings" && <FilingIntel stocks={stocks} onSelect={selectStock} />}
        {view === "portfolio" && <PortfolioLab stocks={stocks} onSelect={selectStock} />}
        {view === "institutional" && <InstitutionalHoldings onSelect={selectStock} />}
        {view === "government" && <GovernmentInvestments onSelect={selectStock} />}
      </main>

      <footer className="site-footer"><span><b>TIDE</b> · Open-source equity research</span><span>Data as of {formatDate(dataset.priceAsOf)} · Not investment advice</span></footer>
    </div>

    <nav className="mobile-nav" aria-label="Mobile navigation">{navigation.map((item) => <button key={item.id} className={view === item.id ? "is-active" : ""} onClick={() => navigate(item.id)}><span>{item.glyph}</span><small>{item.shortLabel}</small></button>)}</nav>
    {searchOpen && <SearchDialog stocks={stocks} onSelect={selectStock} onClose={() => setSearchOpen(false)} />}
    {watchlistOpen && <WatchlistDrawer stocks={stocks} symbols={watchlist} onSelect={selectStock} onToggle={toggleWatchlist} onClose={() => setWatchlistOpen(false)} />}
  </div>;
}

function ProductLoading({ failed }: { failed: boolean }) {
  return <main className="product-loading"><div className="product-loading__brand"><span className="brand__mark">T</span><b>TIDE</b></div>{failed ? <><h1>Research data could not be loaded.</h1><p>Check your connection and refresh the page.</p><button className="primary-button" onClick={() => window.location.reload()}>Try again</button></> : <><div className="product-loading__pulse"><i /><i /><i /></div><h1>Preparing the research desk</h1><p>Loading end-of-day prices and SEC-derived fundamentals…</p></>}</main>;
}

function SearchDialog({ stocks, onSelect, onClose }: { stocks: AnalyzedStock[]; onSelect: (symbol: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const results = stocks.filter((stock) => `${stock.symbol} ${stock.name} ${stock.sector}`.toLowerCase().includes(query.toLowerCase())).slice(0, 8);
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="search-dialog" role="dialog" aria-modal="true" aria-label="Search companies" onMouseDown={(event) => event.stopPropagation()}><div className="search-dialog__input"><span>⌕</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ticker, company, or sector…" /><kbd>ESC</kbd></div><div className="search-dialog__hint"><span>Companies</span><small>{results.length} results</small></div><div className="search-results">{results.map((stock, index) => <button key={stock.symbol} onClick={() => onSelect(stock.symbol)}><StockMark symbol={stock.symbol} /><span><b>{stock.symbol}</b><small>{stock.name} · {stock.sector}</small></span><Tag tone={stock.drawdown52Week < -15 ? "warn" : "neutral"}>{stock.drawdown52Week.toFixed(1)}% from high</Tag><kbd>{index + 1}</kbd></button>)}</div><div className="search-dialog__footer"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Open research</span><span>Search runs locally</span></div></section></div>;
}

function WatchlistDrawer({ stocks, symbols, onSelect, onToggle, onClose }: { stocks: AnalyzedStock[]; symbols: string[]; onSelect: (symbol: string) => void; onToggle: (symbol: string) => void; onClose: () => void }) {
  const watched = symbols.map((symbol) => stocks.find((stock) => stock.symbol === symbol)).filter(Boolean) as AnalyzedStock[];
  return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="watchlist-drawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-header"><div><span className="eyebrow">Local workspace</span><h2>Your watchlist</h2></div><button onClick={onClose} aria-label="Close watchlist">×</button></div>{watched.length ? <div className="drawer-list">{watched.map((stock) => <article key={stock.symbol}><button className="company-cell" onClick={() => onSelect(stock.symbol)}><StockMark symbol={stock.symbol} /><span><b>{stock.symbol}</b><small>{stock.name}</small></span></button><div><b>${stock.latestPrice.toFixed(2)}</b><small className={stock.drawdown52Week < 0 ? "negative" : "positive"}>{stock.drawdown52Week.toFixed(1)}% from high</small></div><button className="watch-button is-active" onClick={() => onToggle(stock.symbol)} aria-label={`Remove ${stock.symbol}`}>★</button></article>)}</div> : <div className="drawer-empty"><span>☆</span><h3>Build your research queue</h3><p>Add companies from Dip Finder or any company page. Everything stays on this device.</p><button className="primary-button" onClick={onClose}>Explore companies</button></div>}<div className="drawer-footer"><span>Stored only in this browser</span><button onClick={() => downloadWatchlist(symbols)}>Export JSON ↓</button></div></aside></div>;
}

function downloadWatchlist(symbols: string[]) { const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), symbols }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "tide-watchlist.json"; anchor.click(); URL.revokeObjectURL(url); }
function formatDate(value: string | null) { if (!value) return "Unavailable"; return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function readWatchlist(): string[] { if (typeof window === "undefined") return []; try { const saved: unknown = JSON.parse(localStorage.getItem("tide-watchlist") || "[]"); return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === "string") : []; } catch { return []; } }
function readTheme(): "light" | "dark" { if (typeof window === "undefined") return "light"; return localStorage.getItem("tide-theme") === "dark" ? "dark" : "light"; }
