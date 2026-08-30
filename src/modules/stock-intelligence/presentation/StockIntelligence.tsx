"use client";

import { useMemo, useState } from "react";
import type { ResearchSignalRepository } from "@/src/application/ports/repositories";
import type { StockSummary } from "@/src/domain/stock";
import { StockMark, Tag } from "@/src/components/ui";
import { BrowserAiMemoGateway, buildEvidencePacket, buildLocalMemo } from "../application/aiMemoGateway";
import { intelligenceStrategies } from "../domain/scoring";
import type { AiProviderId, AiResearchMemo, StockIntelligenceScore } from "../domain/types";
import { useStockIntelligence } from "./useStockIntelligence";

const providerModels: Record<AiProviderId, string> = {
  openai: "gpt-5.6-terra",
  anthropic: "claude-sonnet-5",
  gemini: "gemini-3.6-flash",
};

export function StockIntelligence({ stocks, repository, onSelect }: { stocks: StockSummary[]; repository: ResearchSignalRepository; onSelect: (symbol: string) => void }) {
  const vm = useStockIntelligence(stocks, repository);
  const [query, setQuery] = useState("");
  const [universeView, setUniverseView] = useState<"ranked" | "opportunity" | "confidence">("ranked");
  const [visibleCount, setVisibleCount] = useState(100);
  const shown = useMemo(() => {
    const filtered = vm.scores.filter((score) => `${score.symbol} ${score.companyName}`.toLowerCase().includes(query.toLowerCase()));
    if (universeView === "opportunity") return [...filtered].sort((a, b) => b.opportunity - a.opportunity);
    if (universeView === "confidence") return [...filtered].sort((a, b) => b.confidence - a.confidence);
    return filtered;
  }, [query, universeView, vm.scores]);

  if (vm.failed) return <section className="panel intelligence-error"><b>Stock Intelligence could not load its evidence snapshot.</b><p>Refresh to retry. No factor is estimated when its source contract fails.</p></section>;
  if (!vm.dataset || !vm.selected) return <section className="panel intelligence-skeleton" aria-busy="true"><span className="ai-orbit" /><h2>Building the evidence matrix</h2><p>Normalizing fundamentals, price behavior, SEC insider activity, and 13F movement.</p></section>;

  const stock = stocks.find((item) => item.symbol === vm.selected?.symbol)!;
  const signal = vm.dataset.signals[vm.selected.symbol];
  return <div className="view-stack intelligence-view">
    <section className="intelligence-hero">
      <div className="intelligence-hero__copy">
        <span className="hero-panel__kicker"><i />Explainable stock intelligence</span>
        <h1>A score you can<br /><em>interrogate.</em></h1>
        <p>Every result is deterministic, factor-level, and source-aware. AI explains the evidence only after the math is complete.</p>
        <div className="intelligence-promise"><span>NO BLACK BOX</span><span>NO LOGIN</span><span>NO FABRICATED FACTORS</span></div>
      </div>
      <article className="score-spotlight">
        <div className="score-spotlight__top"><StockMark symbol={vm.selected.symbol} /><div><b>{vm.selected.symbol}</b><small>{vm.selected.companyName}</small></div><Tag tone={vm.selected.score >= 70 ? "good" : vm.selected.score < 45 ? "bad" : "warn"}>{vm.selected.grade}</Tag></div>
        <div className="score-dial" style={{ "--score": vm.selected.score } as React.CSSProperties}><div><strong>{vm.selected.score}</strong><span>/100</span></div></div>
        <div className="score-spotlight__meta"><span><b>{vm.selected.confidence}%</b><small>evidence coverage</small></span><span><b>{shortDate(vm.selected.dataAsOf)}</b><small>market data</small></span></div>
      </article>
    </section>

    <section className="strategy-ribbon panel" aria-label="Scoring strategy">
      <div><span className="eyebrow">Research lens</span><b>{intelligenceStrategies[vm.strategy].description}</b></div>
      <div className="strategy-tabs">{Object.entries(intelligenceStrategies).map(([id, item]) => <button key={id} className={vm.strategy === id ? "is-active" : ""} onClick={() => { vm.setStrategy(id as keyof typeof intelligenceStrategies); setVisibleCount(100); }}>{item.label}</button>)}</div>
    </section>

    <div className="intelligence-grid">
      <section className="panel intelligence-ranking">
        <div className="panel-heading"><div><span className="eyebrow">Covered universe</span><h2>Research priorities</h2><p>Ranked under the active strategy, not presented as buy recommendations.</p></div><Tag tone="neutral">{vm.scores.length} stocks</Tag></div>
        <div className="ranking-toolbar"><label><span>⌕</span><input value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(100); }} placeholder="Find a company" /></label><div>{(["ranked", "opportunity", "confidence"] as const).map((id) => <button key={id} className={universeView === id ? "is-active" : ""} onClick={() => { setUniverseView(id); setVisibleCount(100); }}>{id}</button>)}</div></div>
        <div className="ranking-list">{shown.slice(0, visibleCount).map((score, index) => <button key={score.symbol} className={vm.selected?.symbol === score.symbol ? "is-active" : ""} onClick={() => vm.setSelectedSymbol(score.symbol)}><span className="rank-number">{String(index + 1).padStart(2, "0")}</span><StockMark symbol={score.symbol} size="sm" /><span className="ranking-company"><b>{score.symbol}</b><small>{score.companyName}</small></span><span className="ranking-mini"><i style={{ width: `${score.score}%` }} /><small>{score.confidence}% confidence</small></span><strong>{score.score}</strong></button>)}</div>
        {visibleCount < shown.length && <button type="button" className="secondary-button incremental-load" onClick={() => setVisibleCount((current) => current + 100)}>Show 100 more <span>{visibleCount} of {shown.length}</span></button>}
      </section>

      <div className="intelligence-detail">
        <section className="panel score-overview">
          <div className="panel-heading"><div><span className="eyebrow">Score anatomy · {vm.selected.symbol}</span><h2>{vm.selected.grade} evidence</h2><p>Missing factors are removed and the remaining weights are normalized transparently.</p></div><button className="secondary-button" onClick={() => onSelect(vm.selected!.symbol)}>Full company research →</button></div>
          <div className="lens-grid"><Lens label="Quality" value={vm.selected.quality} note="Margins · cash · growth" /><Lens label="Opportunity" value={vm.selected.opportunity} note="Value · trend · 13F" /><Lens label="Resilience" value={vm.selected.resilience} note="Volatility · balance sheet" /><Lens label="Confidence" value={vm.selected.confidence} note="Weighted data coverage" /></div>
          <div className="valuation-callout"><div><span>Model fair value</span><b>{vm.selected.fairValue == null ? "Unavailable" : `$${vm.selected.fairValue.toFixed(2)}`}</b><small>Conservative cash-flow scenario, not a target</small></div><div><span>Margin of safety</span><b className={(vm.selected.marginOfSafety ?? 0) >= 0 ? "positive" : "negative"}>{vm.selected.marginOfSafety == null ? "—" : signedPct(vm.selected.marginOfSafety)}</b><small>vs. last known price ${stock.latestPrice.toFixed(2)}</small></div></div>
        </section>

        <section className="panel factor-attribution">
          <div className="panel-heading"><div><span className="eyebrow">Attribution</span><h2>What moved the score</h2><p>Effective weight × factor score = points contributed.</p></div></div>
          <div className="factor-list">{vm.selected.factors.map((factor) => <details key={factor.key} className={factor.status === "unavailable" ? "is-unavailable" : ""}><summary><span className="factor-name"><i className={`factor-icon factor-icon--${factor.key}`} /> <span><b>{factor.label}</b><small>{factor.status === "unavailable" ? factor.unavailableReason : `${factor.effectiveWeight.toFixed(1)}% effective weight`}</small></span></span><span className="factor-bar"><i style={{ width: `${factor.score ?? 0}%` }} /></span><strong>{factor.score ?? "N/A"}</strong><em>{factor.status === "available" ? `+${factor.contribution.toFixed(1)}` : "0.0"}</em></summary>{factor.status === "available" && <div className="factor-evidence">{factor.evidence.map((item) => <article key={item.label}><span className={`evidence-dot evidence-dot--${item.direction}`} /><div><b>{item.label}</b><p>{item.detail}</p></div><strong>{item.value}</strong></article>)}<small>Evidence dated {shortDate(factor.asOf)}</small></div>}</details>)}</div>
        </section>

        <section className="panel signal-tape">
          <div className="panel-heading"><div><span className="eyebrow">Ownership signals</span><h2>People & institutions</h2></div><Tag tone="neutral">Source-linked</Tag></div>
          <div className="signal-columns"><div><b>Corporate insiders</b><strong>{(signal?.insider.summary.purchaseCount ?? 0) + (signal?.insider.summary.saleCount ?? 0)}</strong><span>open-market transaction lines from recent Forms 4/4-A</span>{signal?.insider.transactions.slice(0, 3).map((trade) => <a key={`${trade.accession}-${trade.ownerName}-${trade.transactionDate}-${trade.shares}`} href={trade.sourceUrl} target="_blank" rel="noreferrer"><Tag tone={trade.action === "purchase" ? "good" : "warn"}>{trade.action}</Tag><span>{trade.ownerName}<small>{trade.ownerRole} · {shortDate(trade.transactionDate)}</small></span><b>{trade.value == null ? `${trade.shares.toLocaleString()} sh.` : compactMoney(trade.value)}</b></a>)}</div><div><b>Tracked 13F managers</b><strong>{signal?.institutional.managersHolding ?? 0}</strong><span>{signal?.institutional.managersReported ?? 0}/{signal?.institutional.expectedManagers ?? 0} tracked managers reported this period</span><dl><div><dt>New</dt><dd className="positive">+{signal?.institutional.managersNew ?? 0}</dd></div><div><dt>Increased</dt><dd className="positive">+{signal?.institutional.managersIncreased ?? 0}</dd></div><div><dt>Reduced</dt><dd className="negative">−{signal?.institutional.managersReduced ?? 0}</dd></div><div><dt>Exited</dt><dd className="negative">−{signal?.institutional.managersExited ?? 0}</dd></div></dl><small>Portfolio period {shortDate(signal?.institutional.reportDate ?? null)} · filings can lag 45 days</small></div></div>
        </section>

        <AiResearchPanel score={vm.selected} />
      </div>
    </div>

    <section className="methodology-strip"><div><b>Transparent by construction</b><p>{vm.dataset.methodology} Scores rank research priority over a 6–12 month lens; they are not probabilities, forecasts, or personalized advice.</p></div><div className="methodology-links"><a href={vm.dataset.sources.insiders} target="_blank" rel="noreferrer">SEC Forms 4 ↗</a><a href={vm.dataset.sources.institutions} target="_blank" rel="noreferrer">SEC 13F ↗</a><button onClick={() => downloadEvidence(vm.selected!)}>Export evidence ↓</button></div></section>
  </div>;
}

function Lens({ label, value, note }: { label: string; value: number; note: string }) { return <article><span>{label}</span><strong>{value}</strong><i><i style={{ width: `${value}%` }} /></i><small>{note}</small></article>; }

function AiResearchPanel({ score }: { score: StockIntelligenceScore }) {
  const [provider, setProvider] = useState<AiProviderId>("openai");
  const [model, setModel] = useState(providerModels.openai);
  const [apiKey, setApiKey] = useState("");
  const [memo, setMemo] = useState<AiResearchMemo>(() => buildLocalMemo(score));
  const [memoKey, setMemoKey] = useState(`${score.symbol}:${score.strategy}`);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const currentKey = `${score.symbol}:${score.strategy}`;
  const selectedMemo = memoKey === currentKey ? memo : buildLocalMemo(score);

  const chooseProvider = (value: AiProviderId) => { setProvider(value); setModel(providerModels[value]); setApiKey(""); setError(""); };
  const generate = async () => {
    setStatus("loading"); setError("");
    try { setMemo(await new BrowserAiMemoGateway().generate({ provider, model, apiKey, score })); setMemoKey(currentKey); setStatus("idle"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The AI memo could not be generated."); setStatus("error"); }
  };
  return <section className="panel ai-research-panel">
    <div className="panel-heading"><div><span className="eyebrow">AI research editor</span><h2>Interpretation, grounded in the score</h2><p>The score is always computed locally. AI receives only the visible evidence packet and writes a memo.</p></div><Tag tone={selectedMemo.provider === "local" ? "neutral" : "blue"}>{selectedMemo.provider === "local" ? "Local explanation" : `${selectedMemo.provider} · ${selectedMemo.model}`}</Tag></div>
    <div className="ai-memo"><div className="ai-memo__lead"><span className="ai-orbit">AI</span><div><h3>{selectedMemo.headline}</h3><p>{selectedMemo.summary}</p></div></div><div className="ai-case-grid"><MemoList title="Supportive evidence" items={selectedMemo.bullCase} tone="positive" /><MemoList title="Counter-evidence" items={selectedMemo.bearCase} tone="negative" /><MemoList title="What to verify next" items={selectedMemo.watchItems} tone="neutral" /></div><div className="ai-verdict"><span>Research verdict</span><p>{selectedMemo.verdict}</p></div></div>
    <div className="ai-actions"><button className="primary-button" onClick={() => setSettingsOpen((value) => !value)}>{settingsOpen ? "Close AI setup" : "Generate with my AI key"}</button><button className="secondary-button" onClick={() => { setMemo(buildLocalMemo(score)); setMemoKey(currentKey); }}>Use local explanation</button><small>Local mode is free and sends nothing.</small></div>
    {settingsOpen && <div className="ai-settings"><div className="ai-security"><b>Your key is held in memory only.</b><p>It is sent directly from this tab to the provider when you click Generate. This product never stores it, but browser-side keys carry more exposure than a backend proxy. Use a restricted, low-limit key and revoke it after use.</p></div><div className="provider-tabs">{(["openai", "anthropic", "gemini"] as const).map((item) => <button key={item} className={provider === item ? "is-active" : ""} onClick={() => chooseProvider(item)}>{item}</button>)}</div><label><span>API key</span><input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={`Paste ${provider} key`} /></label><label><span>Model ID</span><input value={model} onChange={(event) => setModel(event.target.value)} /></label><details><summary>Exactly what will be sent</summary><pre>{JSON.stringify(buildEvidencePacket(score), null, 2)}</pre></details>{error && <p className="ai-error" role="alert">{error}</p>}<button className="primary-button" disabled={status === "loading" || !apiKey.trim()} onClick={() => void generate()}>{status === "loading" ? "Writing evidence memo…" : "Generate research memo"}</button></div>}
  </section>;
}

function MemoList({ title, items, tone }: { title: string; items: string[]; tone: string }) { return <div className={`memo-list memo-list--${tone}`}><b>{title}</b><ul>{items.length ? items.slice(0, 3).map((item) => <li key={item}>{item}</li>) : <li>No item identified from available evidence.</li>}</ul></div>; }
function shortDate(value: string | null) { if (!value) return "Unavailable"; return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function signedPct(value: number) { return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`; }
function compactMoney(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value); }
function downloadEvidence(score: StockIntelligenceScore) { const blob = new Blob([JSON.stringify(buildEvidencePacket(score), null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${score.symbol.toLowerCase()}-research-evidence.json`; anchor.click(); URL.revokeObjectURL(url); }
