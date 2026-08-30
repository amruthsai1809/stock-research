import { addCalendarDays } from "@/src/application/options/optionPolicies";
import type { StockSummary } from "@/src/domain/stock";
import type { OptionsLabState } from "../useOptionsLab";
import styles from "../OptionsLab.module.css";

type Props = {
  stock: StockSummary;
  state: OptionsLabState;
  impliedVolatilityPct: number | null;
  onNumberChange: (field: "targetSpotPrice" | "volatilityShiftPct", value: number) => void;
  onTargetDateChange: (value: string) => void;
};

export function ScenarioControls({ stock, state, impliedVolatilityPct, onNumberChange, onTargetDateChange }: Props) {
  const priceMinimum = Math.max(0.01, Math.floor(stock.latestPrice * 0.45));
  const priceMaximum = Math.ceil(stock.latestPrice * 1.65);
  const targetVolatility = impliedVolatilityPct == null ? null : Math.max(0.01, impliedVolatilityPct + state.volatilityShiftPct);
  return <section className={`${styles.card} ${styles.scenarioCard}`} aria-labelledby="options-scenario-heading">
    <header className={styles.cardHeader}><div><span className={styles.step}>02 · Scenario</span><h2 id="options-scenario-heading">Move price and time together</h2></div><span className={styles.dateBadge}>{state.targetDate}</span></header>

    <div className={styles.quickMoves} aria-label="Quick stock-price scenarios">
      {[-20, -10, 10, 20].map((change) => <button type="button" key={change} onClick={() => onNumberChange("targetSpotPrice", round(stock.latestPrice * (1 + change / 100)))}>{change > 0 ? "+" : ""}{change}%</button>)}
    </div>

    <RangeField
      label="Stock price on scenario date"
      value={state.targetSpotPrice}
      minimum={priceMinimum}
      maximum={priceMaximum}
      step={0.5}
      prefix="$"
      onChange={(value) => onNumberChange("targetSpotPrice", value)}
    />

    <label className={styles.dateField}>
      <span><b>When does that move happen?</b><small>Time remaining changes the option even when the stock does not.</small></span>
      <input type="date" aria-label="Scenario date" min={stock.priceAsOf} max={state.expirationDate} value={state.targetDate} onChange={(event) => onTargetDateChange(event.target.value)} />
    </label>
    <div className={styles.timingButtons} aria-label="Quick scenario dates">
      {[7, 30, 60].map((days) => {
        const date = addCalendarDays(stock.priceAsOf, days);
        return <button type="button" key={days} disabled={date > state.expirationDate} onClick={() => onTargetDateChange(date)}>{days} days</button>;
      })}
      <button type="button" onClick={() => onTargetDateChange(state.expirationDate)}>Expiration</button>
    </div>

    <RangeField
      label="Implied volatility change"
      value={state.volatilityShiftPct}
      minimum={-40}
      maximum={80}
      step={1}
      suffix=" pts"
      onChange={(value) => onNumberChange("volatilityShiftPct", value)}
    />
    <p className={styles.volatilityReadout}><span>Derived today <b>{impliedVolatilityPct == null ? "—" : `${impliedVolatilityPct.toFixed(1)}%`}</b></span><span>Scenario <b>{targetVolatility == null ? "—" : `${targetVolatility.toFixed(1)}%`}</b></span></p>
  </section>;
}

function RangeField({ label, value, minimum, maximum, step, prefix, suffix, onChange }: { label: string; value: number; minimum: number; maximum: number; step: number; prefix?: string; suffix?: string; onChange: (value: number) => void }) {
  const displayValue = Math.min(maximum, Math.max(minimum, value));
  return <label className={styles.rangeField}><span><b>{label}</b><span>{prefix}<input type="number" aria-label={`${label} exact value`} min={minimum} max={maximum} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />{suffix}</span></span><input type="range" aria-label={label} min={minimum} max={maximum} step={step} value={displayValue} onChange={(event) => onChange(Number(event.target.value))} /><small><span>{prefix}{minimum}{suffix}</span><span>{prefix}{maximum}{suffix}</span></small></label>;
}

function round(value: number) { return Math.round(value * 100) / 100; }
