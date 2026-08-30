"use client";

import type { StockSummary } from "@/src/domain/stock";
import { StockMark } from "@/src/components/ui";
import { ContractEditor } from "./components/ContractEditor";
import { ScenarioControls } from "./components/ScenarioControls";
import { OutcomeSummary } from "./components/OutcomeSummary";
import { PayoffChart } from "./components/PayoffChart";
import { ScenarioHeatmap } from "./components/ScenarioHeatmap";
import { DriverAttribution } from "./components/DriverAttribution";
import { ModelAssumptions } from "./components/ModelAssumptions";
import { RiskSummary } from "./components/RiskSummary";
import { RiskDisclosure } from "./components/RiskDisclosure";
import { useOptionsLab } from "./useOptionsLab";
import styles from "./OptionsLab.module.css";

export function OptionsLab({ stocks, initialSymbol, onSelect, onSymbolChange }: { stocks: StockSummary[]; initialSymbol: string; onSelect: (symbol: string) => void; onSymbolChange?: (symbol: string) => void }) {
  const controller = useOptionsLab(stocks, initialSymbol);
  const analysis = controller.analysisResult.ok ? controller.analysisResult.value : null;
  const curve = controller.curveResult?.ok ? controller.curveResult.value : null;
  const error = !controller.analysisResult.ok
    ? controller.analysisResult.error.message
    : controller.curveResult && !controller.curveResult.ok ? controller.curveResult.error.message : null;

  return <div className={`view-stack ${styles.optionsLab}`}>
    <header className={styles.hero}>
      <div className={styles.heroCopy}><span>Interactive options laboratory</span><h1>See what price<br />and time actually do.</h1><p>Build a long call or put, move the stock and the calendar, and inspect exactly why the option gains or loses value.</p><div><span>No account</span><span>No API key</span><span>No live chain required</span></div></div>
      <div className={styles.heroContract}><StockMark symbol={controller.stock.symbol} size="lg" /><span><small>Exploring</small><b>{controller.stock.symbol}</b><em>${controller.stock.latestPrice.toFixed(2)} EOD</em></span><button type="button" onClick={() => onSelect(controller.stock.symbol)}>Open company research →</button></div>
    </header>

    <section className={styles.explainerStrip} aria-label="How to use Options Lab">
      <article><span>1</span><p><b>Choose a call or put</b><small>A call benefits from a rise. A put benefits from a fall.</small></p></article>
      <article><span>2</span><p><b>Enter the real contract</b><small>Strike, expiration, premium, and quantity define your risk.</small></p></article>
      <article><span>3</span><p><b>Move price and time</b><small>Compare the same stock move early versus near expiration.</small></p></article>
    </section>

    <div className={styles.workbench}>
      <ContractEditor
        stocks={stocks}
        stock={controller.stock}
        state={controller.state}
        onSelectSymbol={(symbol) => { controller.selectSymbol(symbol); onSymbolChange?.(symbol); }}
        onKindChange={controller.setKind}
        onNumberChange={controller.setNumber}
        onExpirationChange={(value) => controller.setDate("expirationDate", value)}
      />
      <ScenarioControls
        stock={controller.stock}
        state={controller.state}
        impliedVolatilityPct={analysis?.impliedVolatilityPct ?? null}
        onNumberChange={controller.setNumber}
        onTargetDateChange={(value) => controller.setDate("targetDate", value)}
      />
    </div>

    <ModelAssumptions state={controller.state} onToggle={controller.toggleAdvanced} onNumberChange={controller.setNumber} onExerciseStyleChange={controller.setExerciseStyle} />

    {error && <section className={styles.modelError} role="alert"><span>Check the contract</span><div><h2>This scenario cannot be modeled yet.</h2><p>{error}</p></div><button type="button" className="secondary-button" onClick={controller.reset}>Reset assumptions</button></section>}

    {analysis && curve && <>
      <OutcomeSummary analysis={analysis} currentSpotPrice={controller.stock.latestPrice} targetSpotPrice={controller.state.targetSpotPrice} />
      <RiskSummary analysis={analysis} />
      <PayoffChart curve={curve} targetSpotPrice={controller.state.targetSpotPrice} />
      <div className={styles.analysisGrid}>
        {controller.surface.data
          ? <ScenarioHeatmap surface={controller.surface.data} targetDate={controller.state.targetDate} targetSpotPrice={controller.state.targetSpotPrice} updating={controller.surface.status === "updating"} />
          : <section className={`${styles.card} ${styles.surfaceLoading}`} aria-live="polite" aria-busy="true"><i /><h2>Building the outcome map</h2><p>Calculating price and date combinations away from the main interface.</p></section>}
        <DriverAttribution attribution={analysis.attribution} />
      </div>
    </>}

    {controller.surface.status === "error" && controller.surface.error && <p className={styles.surfaceError} role="status">Outcome map unavailable: {controller.surface.error}</p>}
    <RiskDisclosure />
  </div>;
}
