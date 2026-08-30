import type { ExerciseStyle } from "@/src/domain/options/types";
import type { OptionsLabState } from "../useOptionsLab";
import styles from "../OptionsLab.module.css";

type Props = {
  state: OptionsLabState;
  onToggle: () => void;
  onNumberChange: (field: "riskFreeRatePct" | "dividendYieldPct" | "contractMultiplier", value: number) => void;
  onExerciseStyleChange: (value: ExerciseStyle) => void;
};

export function ModelAssumptions({ state, onToggle, onNumberChange, onExerciseStyleChange }: Props) {
  return <section className={styles.assumptionSection}>
    <button type="button" className={styles.assumptionToggle} aria-expanded={state.advancedOpen} onClick={onToggle}><span><b>Model assumptions</b><small>American binomial model · Local calculation</small></span><span aria-hidden="true">{state.advancedOpen ? "−" : "+"}</span></button>
    {state.advancedOpen && <div className={styles.assumptionBody}>
      <label><span>Exercise style</span><select aria-label="Exercise style" value={state.exerciseStyle} onChange={(event) => onExerciseStyleChange(event.target.value as ExerciseStyle)}><option value="american">American</option><option value="european">European</option></select></label>
      <label><span>Risk-free rate (%)</span><input type="number" aria-label="Risk-free rate" min={-20} max={100} step={0.05} value={state.riskFreeRatePct} onChange={(event) => onNumberChange("riskFreeRatePct", Number(event.target.value))} /></label>
      <label><span>Dividend yield (%)</span><input type="number" aria-label="Dividend yield" min={0} max={100} step={0.05} value={state.dividendYieldPct} onChange={(event) => onNumberChange("dividendYieldPct", Number(event.target.value))} /></label>
      <label><span>Contract multiplier</span><input type="number" aria-label="Contract multiplier" min={1} max={100000} step={1} value={state.contractMultiplier} onChange={(event) => onNumberChange("contractMultiplier", Math.round(Number(event.target.value)))} /></label>
      <p>Before expiration, theoretical value uses a Cox–Ross–Rubinstein tree with dividend yield and early exercise. Implied volatility is solved from your premium. At expiration, payoff is exact intrinsic value.</p>
    </div>}
  </section>;
}
