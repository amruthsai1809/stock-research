import type { DriverAttribution as Attribution } from "@/src/domain/options/types";
import { formatOptionCurrency } from "../optionsViewModel";
import styles from "../OptionsLab.module.css";

export function DriverAttribution({ attribution }: { attribution: Attribution }) {
  const drivers = [
    { label: "Stock-price move", detail: "Impact of changing only the underlying price", value: attribution.priceDollars },
    { label: "Time passing", detail: "Impact of fewer days remaining", value: attribution.timeDollars },
    { label: "Volatility shift", detail: "Impact of changing only implied volatility", value: attribution.volatilityDollars },
  ];
  const maximum = Math.max(1, ...drivers.map((driver) => Math.abs(driver.value)));
  return <section className={`${styles.card} ${styles.attributionCard}`} aria-labelledby="driver-attribution-heading">
    <header className={styles.chartHeader}><div><span className={styles.step}>Why it changed</span><h2 id="driver-attribution-heading">Separate price, time, and volatility</h2><p>Order-neutral Shapley attribution makes the three effects reconcile to the modeled value change.</p></div><strong>{formatOptionCurrency(attribution.totalDollars)}</strong></header>
    <div className={styles.driverList}>{drivers.map((driver) => <article key={driver.label}><div><b>{driver.label}</b><small>{driver.detail}</small></div><div className={styles.driverTrack}><i /><span className={driver.value >= 0 ? styles.positiveDriver : styles.negativeDriver} style={{ width: `${Math.max(2, Math.abs(driver.value) / maximum * 50)}%`, [driver.value >= 0 ? "left" : "right"]: "50%" }} /></div><strong className={driver.value >= 0 ? styles.positiveText : styles.negativeText}>{formatOptionCurrency(driver.value)}</strong></article>)}</div>
    <footer><span>Components</span><b>{formatOptionCurrency(attribution.priceDollars + attribution.timeDollars + attribution.volatilityDollars)}</b><span>Modeled change</span><b>{formatOptionCurrency(attribution.totalDollars)}</b></footer>
  </section>;
}
