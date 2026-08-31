"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import type { ApplicationServices } from "@/src/application/ports/repositories";
import type { MarketIndex, StockSummary } from "@/src/domain/stock";
import { searchCompanies } from "@/src/domain/companySearch";
import { StockMark, Tag } from "@/src/components/ui";
import type { ResearchSignalDataset } from "@/src/modules/stock-intelligence/domain/types";
import { navigation, readSymbol, readView, writeView, type AppView } from "@/src/features/shell/navigation";
import { useResearchSignal, useStockDetail } from "@/src/features/market/useStockDetails";
import { product } from "@/src/config/product";
import { ProjectNotice } from "@/src/features/shell/ProjectNotice";

const Discover = lazy(() => import("@/src/features/discover/Discover").then((module) => ({ default: module.Discover })));
const DipFinder = lazy(() => import("@/src/features/dip-finder/DipFinder").then((module) => ({ default: module.DipFinder })));
const CompanyResearch = lazy(() => import("@/src/features/company/CompanyResearch").then((module) => ({ default: module.CompanyResearch })));
const Screener = lazy(() => import("@/src/features/screener/Screener").then((module) => ({ default: module.Screener })));
const Compare = lazy(() => import("@/src/features/compare/Compare").then((module) => ({ default: module.Compare })));
const ValuationLab = lazy(() => import("@/src/features/valuation/ValuationLab").then((module) => ({ default: module.ValuationLab })));
const OptionsLab = lazy(() => import("@/src/features/options/OptionsLab").then((module) => ({ default: module.OptionsLab })));
const FilingIntel = lazy(() => import("@/src/features/filings/FilingIntel").then((module) => ({ default: module.FilingIntel })));
const PortfolioLab = lazy(() => import("@/src/features/portfolio/PortfolioLab").then((module) => ({ default: module.PortfolioLab })));
const InstitutionalHoldings = lazy(() => import("@/src/features/institutional/InstitutionalHoldings").then((module) => ({ default: module.InstitutionalHoldings })));
const GovernmentInvestments = lazy(() => import("@/src/features/government/GovernmentInvestments").then((module) => ({ default: module.GovernmentInvestments })));
const StockIntelligence = lazy(() => import("@/src/modules/stock-intelligence/presentation/StockIntelligence").then((module) => ({ default: module.StockIntelligence })));

export function EquityLabApp({ services }: { services: ApplicationServices }) {
  const [dataset, setDataset] = useState<MarketIndex | null>(null);
  const [researchSignals, setResearchSignals] = useState<ResearchSignalDataset | null>(null);
  const [dataError, setDataError] = useState(false);
  const stocks = dataset?.stocks ?? [];
  const [view, setView] = useState<AppView>(readView);
  const [selectedSymbol, setSelectedSymbol] = useState(() => readSymbol("AAPL"));
  const [watchlist, setWatchlist] = useState<string[]>(readWatchlist);
  const [searchOpen, setSearchOpen] = useState(false);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [projectNoticeOpen, setProjectNoticeOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(readTheme);
  const selectedStock = stocks.find((stock) => stock.symbol === selectedSymbol) ?? stocks[0];
  const selectedDetail = useStockDetail(services.marketRepository, view === "company" ? selectedStock?.symbol : undefined);
  const selectedSignal = useResearchSignal(
    services.researchSignalRepository,
    view === "company" ? selectedStock?.symbol : undefined,
    selectedStock ? researchSignals?.signals[selectedStock.symbol] : undefined,
  );

  useEffect(() => {
    let active = true;
    services.marketRepository.loadIndex().then((payload) => { if (active) setDataset(payload); }).catch(() => { if (active) setDataError(true); });
    return () => { active = false; };
  }, [services]);

  useEffect(() => {
    let active = true;
    services.researchSignalRepository.load().then((payload) => { if (active) setResearchSignals(payload); }).catch(() => { /* Market-signal panels degrade gracefully. */ });
    return () => { active = false; };
  }, [services]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(product.storage.theme, theme);
  }, [theme]);

  useEffect(() => {
    const handleHistory = () => { setView(readView()); setSelectedSymbol(readSymbol("AAPL")); };
    window.addEventListener("popstate", handleHistory);
    return () => window.removeEventListener("popstate", handleHistory);
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen((current) => !current); }
      if (event.key === "Escape") { setSearchOpen(false); setWatchlistOpen(false); setProjectNoticeOpen(false); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const nav = document.querySelector<HTMLElement>(".mobile-nav");
      const active = nav?.querySelector<HTMLElement>(".is-active");
      if (nav && active && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = Math.max(0, active.offsetLeft - nav.clientWidth / 2 + active.clientWidth / 2);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [dataset?.generatedAt, view]);

  const navigate = (next: AppView) => {
    setView(next);
    writeView(next, next === "company" || next === "options" ? selectedSymbol : undefined);
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
      localStorage.setItem(product.storage.watchlist, JSON.stringify(next));
      return next;
    });
  };

  if (!dataset) return <ProductLoading failed={dataError} />;

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => navigate("discover")} aria-label={`${product.name} home`}><span className="brand__mark">{product.mark}</span><span><b>{product.name}</b></span></button>
      <div className="sidebar-navigation">
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
      </div>
      <div className="sidebar-card"><span className="sidebar-card__icon">◉</span><b>Portfolio lab</b><p>Analyze a brokerage export without uploading it.</p><button onClick={() => navigate("portfolio")}>Open private lab →</button></div>
      <footer className="sidebar-footer"><span className="source-status"><i /> Static sources ready</span><small>SEC · House · EOD prices</small></footer>
    </aside>

    <div className="app-main">
      <header className="topbar">
        <button className="mobile-brand" onClick={() => navigate("discover")}><span className="brand__mark">{product.mark}</span>{product.shortName}</button>
        <button className="search-trigger" onClick={() => setSearchOpen(true)}><span>⌕</span><span>Search any company or ticker</span><kbd>⌘ K</kbd></button>
        <div className="topbar__actions">
          <div className="as-of"><span className="live-dot" /><span><b>End-of-day data</b><small>As of {formatDate(dataset.priceAsOf)}</small></span></div>
          <button className="round-button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}>{theme === "light" ? "◐" : "◑"}</button>
          <button className="watchlist-trigger" onClick={() => setWatchlistOpen(true)} aria-label="Open watchlist">★ <span>{watchlist.length}</span></button>
        </div>
      </header>

      <div className="data-banner"><span>Personal project</span><p>Non-commercial · Open source · No ads, payments, donations, or accounts · Not investment advice</p><div className="data-banner__actions"><button onClick={() => setProjectNoticeOpen(true)}>Project notice</button><button onClick={() => navigate("filings")}>Inspect sources →</button></div></div>

      <main className="content"><Suspense fallback={<FeatureLoading />}>
        {view === "discover" && <Discover stocks={stocks} onSelect={selectStock} onOpenDipFinder={() => navigate("dips")} marketRepository={services.marketRepository} />}
        {view === "dips" && <DipFinder stocks={stocks} onSelect={selectStock} watchlist={watchlist} onToggleWatchlist={toggleWatchlist} marketRepository={services.marketRepository} />}
        {view === "company" && selectedDetail.stock && <CompanyResearch stock={selectedDetail.stock} marketCap={selectedStock?.marketCap ?? null} researchSignal={selectedSignal} isWatched={watchlist.includes(selectedDetail.stock.symbol)} onToggleWatchlist={toggleWatchlist} onOpenValuation={() => navigate("valuation")} />}
        {view === "company" && !selectedDetail.stock && <DetailLoading error={selectedDetail.error} />}
        {view === "screener" && <Screener stocks={stocks} onSelect={selectStock} />}
        {view === "compare" && <Compare stocks={stocks} onSelect={selectStock} marketRepository={services.marketRepository} />}
        {view === "valuation" && <ValuationLab key={selectedSymbol} stocks={stocks} initialSymbol={selectedSymbol} onSelect={selectStock} />}
        {view === "options" && <OptionsLab stocks={stocks} initialSymbol={selectedSymbol} onSelect={selectStock} onSymbolChange={(symbol) => { setSelectedSymbol(symbol); writeView("options", symbol); }} />}
        {view === "filings" && <FilingIntel stocks={stocks} onSelect={selectStock} />}
        {view === "signals" && <StockIntelligence stocks={stocks} repository={services.researchSignalRepository} onSelect={selectStock} />}
        {view === "portfolio" && <PortfolioLab stocks={stocks} onSelect={selectStock} benchmarkRepository={services.benchmarkRepository} marketRepository={services.marketRepository} />}
        {view === "institutional" && <InstitutionalHoldings onSelect={selectStock} repository={services.institutionalRepository} />}
        {view === "government" && <GovernmentInvestments onSelect={selectStock} repository={services.governmentRepository} />}
      </Suspense></main>

      <footer className="site-footer"><span className="site-footer__identity"><b>{product.name}</b><span>· Personal, non-commercial, open-source project</span><button className="site-footer__notice" onClick={() => setProjectNoticeOpen(true)}>Project notice</button></span><span>Data as of {formatDate(dataset.priceAsOf)} · Not investment advice</span></footer>
    </div>

    <nav className="mobile-nav" aria-label="Mobile navigation">{navigation.map((item) => <button key={item.id} className={view === item.id ? "is-active" : ""} onClick={() => navigate(item.id)}><span>{item.glyph}</span><small>{item.shortLabel}</small></button>)}</nav>
    {searchOpen && <SearchDialog stocks={stocks} onSelect={selectStock} onClose={() => setSearchOpen(false)} />}
    {watchlistOpen && <WatchlistDrawer stocks={stocks} symbols={watchlist} onSelect={selectStock} onToggle={toggleWatchlist} onClose={() => setWatchlistOpen(false)} />}
    {projectNoticeOpen && <ProjectNotice onClose={() => setProjectNoticeOpen(false)} />}
  </div>;
}

function ProductLoading({ failed }: { failed: boolean }) {
  return <main className="product-loading"><div className="product-loading__brand"><span className="brand__mark">{product.mark}</span><b>{product.name}</b></div>{failed ? <><h1>Research data could not be loaded.</h1><p>Check your connection and refresh the page.</p><button className="primary-button" onClick={() => window.location.reload()}>Try again</button></> : <><div className="product-loading__pulse"><i /><i /><i /></div><h1>Preparing the research desk</h1><p>Loading the compact market index and SEC-derived fundamentals…</p></>}</main>;
}

function FeatureLoading() {
  return <section className="panel feature-loading" aria-live="polite" aria-busy="true"><span /><div><b>Opening research workspace</b><small>Loading only the tools needed for this view.</small></div></section>;
}

function DetailLoading({ error }: { error: string | null }) {
  return <section className="panel feature-loading" aria-live="polite" aria-busy={!error}><span /><div><b>{error ? "Company history could not be loaded" : "Opening company research"}</b><small>{error ?? "Fetching this company’s ten-year price file."}</small></div></section>;
}

function SearchDialog({ stocks, onSelect, onClose }: { stocks: StockSummary[]; onSelect: (symbol: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const results = searchCompanies(stocks, query, 10);
  const resultListId = "global-company-search-results";

  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="search-dialog" role="dialog" aria-modal="true" aria-label="Search companies" onMouseDown={(event) => event.stopPropagation()}>
      <div className="search-dialog__input"><span>⌕</span><input
        autoFocus
        role="combobox"
        aria-label="Search by ticker or company name"
        aria-autocomplete="list"
        aria-expanded="true"
        aria-controls={resultListId}
        aria-activedescendant={results[activeIndex] ? `${resultListId}-${results[activeIndex].symbol}` : undefined}
        value={query}
        onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && results.length) { event.preventDefault(); setActiveIndex((current) => (current + 1) % results.length); }
          if (event.key === "ArrowUp" && results.length) { event.preventDefault(); setActiveIndex((current) => (current - 1 + results.length) % results.length); }
          if (event.key === "Enter" && results[activeIndex]) { event.preventDefault(); onSelect(results[activeIndex].symbol); }
          if (/^[1-9]$/.test(event.key) && results[Number(event.key) - 1]) onSelect(results[Number(event.key) - 1].symbol);
        }}
        placeholder="Try “duol”, “Microsoft”, or a ticker…"
      /><kbd>ESC</kbd></div>
      <div className="search-dialog__hint"><span>{query ? "Best matches" : "Suggested companies"}</span><small>{results.length} results</small></div>
      <div className="search-results" id={resultListId} role="listbox">{results.map((stock, index) => <button
        role="option"
        id={`${resultListId}-${stock.symbol}`}
        aria-selected={index === activeIndex}
        className={index === activeIndex ? "is-active" : ""}
        key={stock.symbol}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => onSelect(stock.symbol)}
      ><StockMark symbol={stock.symbol} /><span><b>{stock.symbol}</b><small>{stock.name} · {stock.sector}</small></span><Tag tone={stock.drawdown52Week < -15 ? "warn" : "neutral"}>{stock.drawdown52Week.toFixed(1)}% from high</Tag><kbd>{index + 1}</kbd></button>)}</div>
      {!results.length && <div className="search-dialog__empty"><b>No company found</b><span>Try part of the company name, sector, or ticker.</span></div>}
      <div className="search-dialog__footer"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Open research</span><span>Partial names and common typos supported</span></div>
    </section>
  </div>;
}

function WatchlistDrawer({ stocks, symbols, onSelect, onToggle, onClose }: { stocks: StockSummary[]; symbols: string[]; onSelect: (symbol: string) => void; onToggle: (symbol: string) => void; onClose: () => void }) {
  const watched = symbols.map((symbol) => stocks.find((stock) => stock.symbol === symbol)).filter(Boolean) as StockSummary[];
  return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="watchlist-drawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-header"><div><span className="eyebrow">Local workspace</span><h2>Your watchlist</h2></div><button onClick={onClose} aria-label="Close watchlist">×</button></div>{watched.length ? <div className="drawer-list">{watched.map((stock) => <article key={stock.symbol}><button className="company-cell" onClick={() => onSelect(stock.symbol)}><StockMark symbol={stock.symbol} /><span><b>{stock.symbol}</b><small>{stock.name}</small></span></button><div><b>${stock.latestPrice.toFixed(2)}</b><small className={stock.drawdown52Week < 0 ? "negative" : "positive"}>{stock.drawdown52Week.toFixed(1)}% from high</small></div><button className="watch-button is-active" onClick={() => onToggle(stock.symbol)} aria-label={`Remove ${stock.symbol}`}>★</button></article>)}</div> : <div className="drawer-empty"><span>☆</span><h3>Build your research queue</h3><p>Add companies from Dip Finder or any company page. Everything stays on this device.</p><button className="primary-button" onClick={onClose}>Explore companies</button></div>}<div className="drawer-footer"><span>Stored only in this browser</span><button onClick={() => downloadWatchlist(symbols)}>Export JSON ↓</button></div></aside></div>;
}

function downloadWatchlist(symbols: string[]) { const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), symbols }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "equity-lab-watchlist.json"; anchor.click(); URL.revokeObjectURL(url); }
function formatDate(value: string | null) { if (!value) return "Unavailable"; return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function readWatchlist(): string[] { if (typeof window === "undefined") return []; try { const saved: unknown = JSON.parse(readStoredValue([product.storage.watchlist, ...product.legacyStorage.watchlist]) ?? "[]"); return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === "string") : []; } catch { return []; } }
function readTheme(): "light" | "dark" { if (typeof window === "undefined") return "light"; return readStoredValue([product.storage.theme, ...product.legacyStorage.theme]) === "dark" ? "dark" : "light"; }
function readStoredValue(keys: readonly string[]): string | null { for (const key of keys) { const value = localStorage.getItem(key); if (value !== null) return value; } return null; }
