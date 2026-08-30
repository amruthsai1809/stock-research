import type { StockSummary } from "@/src/domain/stock";
import type { OptionKind } from "@/src/domain/options/types";
import type { OptionsLabState } from "../useOptionsLab";
import styles from "../OptionsLab.module.css";

type Props = {
  stocks: readonly StockSummary[];
  stock: StockSummary;
  state: OptionsLabState;
  onSelectSymbol: (symbol: string) => void;
  onKindChange: (kind: OptionKind) => void;
  onNumberChange: (field: "strikePrice" | "premiumPerShare" | "contracts", value: number) => void;
  onExpirationChange: (value: string) => void;
};

export function ContractEditor({ stocks, stock, state, onSelectSymbol, onKindChange, onNumberChange, onExpirationChange }: Props) {
  return <section className={`${styles.card} ${styles.contractCard}`} aria-labelledby="options-contract-heading">
    <header className={styles.cardHeader}>
      <div><span className={styles.step}>01 · Contract</span><h2 id="options-contract-heading">Describe what you would buy</h2></div>
      <span className={styles.localBadge}>Runs locally</span>
    </header>

    <label className={styles.companyField}>
      <span>Underlying company</span>
      <select aria-label="Underlying company" value={state.symbol} onChange={(event) => onSelectSymbol(event.target.value)}>
        {stocks.map((item) => <option key={item.symbol} value={item.symbol}>{item.symbol} — {item.name}</option>)}
      </select>
      <small>{stock.exchange} · End-of-day price ${stock.latestPrice.toFixed(2)} as of {stock.priceAsOf}</small>
    </label>

    <fieldset className={styles.segmentField}>
      <legend>Option type</legend>
      <div className={styles.segmented}>
        <button type="button" className={state.kind === "call" ? styles.activeSegment : ""} aria-pressed={state.kind === "call"} onClick={() => onKindChange("call")}><b>Call</b><small>Benefits from a rise</small></button>
        <button type="button" className={state.kind === "put" ? styles.activeSegment : ""} aria-pressed={state.kind === "put"} onClick={() => onKindChange("put")}><b>Put</b><small>Benefits from a fall</small></button>
      </div>
    </fieldset>

    <div className={styles.fieldGrid}>
      <NumberField label="Strike price" prefix="$" value={state.strikePrice} minimum={0.01} step={0.5} onChange={(value) => onNumberChange("strikePrice", value)} />
      <NumberField label="Premium per share" prefix="$" value={state.premiumPerShare} minimum={0} step={0.01} onChange={(value) => onNumberChange("premiumPerShare", value)} />
      <NumberField label="Contracts" value={state.contracts} minimum={1} maximum={10_000} step={1} onChange={(value) => onNumberChange("contracts", Math.round(value))} />
      <label className={styles.inputField}><span>Expiration date</span><input type="date" aria-label="Expiration date" min={stock.priceAsOf} value={state.expirationDate} onChange={(event) => onExpirationChange(event.target.value)} /></label>
    </div>

    <div className={styles.contractTranslation}>
      <span aria-hidden="true">×100</span>
      <p><b>One standard contract controls 100 shares.</b><small>Your ${state.premiumPerShare.toFixed(2)} quote costs {(state.premiumPerShare * state.contractMultiplier * state.contracts).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} for {state.contracts} contract{state.contracts === 1 ? "" : "s"}.</small></p>
    </div>
  </section>;
}

function NumberField({ label, prefix, value, minimum, maximum, step, onChange }: { label: string; prefix?: string; value: number; minimum: number; maximum?: number; step: number; onChange: (value: number) => void }) {
  return <label className={styles.inputField}><span>{label}</span><div>{prefix && <i>{prefix}</i>}<input type="number" aria-label={label} min={minimum} max={maximum} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></div></label>;
}
