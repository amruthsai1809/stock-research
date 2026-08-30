import styles from "../OptionsLab.module.css";

export function RiskDisclosure() {
  return <aside className={styles.disclosure} aria-label="Options risk disclosure"><span aria-hidden="true">!</span><div><b>Options can expire worthless.</b><p>This educational model is not a quote, recommendation, or probability forecast. It excludes bid–ask spreads, commissions, taxes, assignment mechanics, and market liquidity. Verify any contract with your broker and read the OCC options disclosure document before trading.</p></div><a href="https://www.theocc.com/company-information/documents-and-archives/options-disclosure-document" target="_blank" rel="noreferrer">Read the OCC disclosure ↗</a></aside>;
}
