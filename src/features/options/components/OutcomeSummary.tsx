import type { OptionAnalysis } from "@/src/application/options/types";
import { describeOutcome, formatOptionCurrency, formatOptionPercent } from "../optionsViewModel";
import styles from "../OptionsLab.module.css";

export function OutcomeSummary({ analysis, currentSpotPrice, targetSpotPrice }: { analysis: OptionAnalysis; currentSpotPrice: number; targetSpotPrice: number }) {
  const profitable = analysis.targetProfitLossDollars >= 0;
  return <section className={styles.outcomeSection} aria-labelledby="options-outcome-heading">
    <div className={styles.outcomeNarrative}>
      <span className={styles.step}>03 · Modeled outcome</span>
      <h2 id="options-outcome-heading">{profitable ? "This scenario makes money." : "This scenario loses money."}</h2>
      <p>{describeOutcome(analysis, targetSpotPrice, currentSpotPrice)}</p>
    </div>
    <div className={styles.outcomeGrid}>
      <article className={profitable ? styles.positiveMetric : styles.negativeMetric}><span>Option P/L</span><strong>{formatOptionCurrency(analysis.targetProfitLossDollars)}</strong><small>{formatOptionPercent(analysis.targetReturnOnPremiumPct)} on premium</small></article>
      <article><span>Option value then</span><strong>{formatOptionCurrency(analysis.targetTheoreticalValuePerShare, 2)}</strong><small>modeled per share</small></article>
      <article><span>Owning 100 shares</span><strong>{formatOptionCurrency(analysis.shareComparisonDollars)}</strong><small>same directional move</small></article>
      <article><span>Expiration break-even</span><strong>{formatOptionCurrency(analysis.breakEvenPrice, 2)}</strong><small>excludes fees and taxes</small></article>
    </div>
  </section>;
}
