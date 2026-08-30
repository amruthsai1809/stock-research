import type { OptionAnalysis } from "@/src/application/options/types";
import { formatOptionCurrency } from "../optionsViewModel";
import styles from "../OptionsLab.module.css";

export function RiskSummary({ analysis }: { analysis: OptionAnalysis }) {
  const greeks = analysis.currentGreeks;
  return <>
    <section className={styles.riskGrid} aria-label="Position risk summary">
      <article><span>Premium at risk</span><strong>{formatOptionCurrency(analysis.maximumLossDollars)}</strong><small>maximum loss for this long option</small></article>
      <article><span>Maximum profit</span><strong>{analysis.maximumProfitLabel}</strong><small>at expiration, before fees</small></article>
      <article><span>Delta exposure</span><strong>{greeks.deltaDollars.toFixed(1)}</strong><small>dollars per $1 stock move</small></article>
      <article><span>Daily theta</span><strong className={greeks.thetaDollarsPerCalendarDay >= 0 ? styles.positiveText : styles.negativeText}>{formatOptionCurrency(greeks.thetaDollarsPerCalendarDay, 2)}</strong><small>one modeled calendar day</small></article>
    </section>
    <section className={`${styles.card} ${styles.greeksCard}`} aria-labelledby="greeks-heading">
      <header className={styles.cardHeader}><div><span className={styles.step}>Sensitivity snapshot</span><h2 id="greeks-heading">Greeks in position dollars</h2></div><span className={styles.localBadge}>Current assumptions</span></header>
      <div className={styles.greekList}>
        <div><span>Delta</span><strong>{greeks.deltaDollars.toFixed(2)}</strong><small>P/L for a $1 stock move</small></div>
        <div><span>Gamma</span><strong>{greeks.gammaDollars.toFixed(3)}</strong><small>delta change per $1 move</small></div>
        <div><span>Vega</span><strong>{formatOptionCurrency(greeks.vegaDollarsPerVolatilityPoint, 2)}</strong><small>P/L per 1 volatility point</small></div>
        <div><span>Theta</span><strong>{formatOptionCurrency(greeks.thetaDollarsPerCalendarDay, 2)}</strong><small>P/L after one calendar day</small></div>
        <div><span>Rho</span><strong>{formatOptionCurrency(greeks.rhoDollarsPerRatePoint, 2)}</strong><small>P/L per 1 rate point</small></div>
      </div>
    </section>
  </>;
}
