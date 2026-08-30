import type { ReactNode } from "react";
import type { AnalyzedStock } from "@/src/domain/stock";
import { formatCompactCurrency, formatPercent } from "@/src/domain/analytics";
import { calculateCompanySnapshot } from "./companySnapshotMetrics";

export function CompanySnapshot({ stock, marketCap }: { stock: AnalyzedStock; marketCap: number | null }) {
  const snapshot = calculateCompanySnapshot(stock, marketCap);
  const annual = stock.latestAnnual;
  const reportingCurrency = stock.reportingCurrency ?? stock.currency;
  const netCashDebtLabel = snapshot.netCashDebt == null ? "Net cash / debt" : snapshot.netCashDebt >= 0 ? "Net cash" : "Net debt";

  return <section className="company-snapshot" aria-labelledby="company-snapshot-title">
    <div className="company-snapshot__heading"><div><span className="eyebrow">Company snapshot</span><h2 id="company-snapshot-title">The business at a glance</h2></div><p>Latest market close · latest complete fiscal year</p></div>

    <div className="snapshot-primary-grid">
      <PrimaryMetric tone="teal" label="Market cap" help="Latest market price multiplied by outstanding shares, using the end-of-day market snapshot." value={formatCompactCurrency(snapshot.marketCap, stock.currency)} detail={snapshot.marketCapEstimated ? "Estimated from reported shares" : companySize(snapshot.marketCap)} />
      <PrimaryMetric tone="coral" label="Revenue" help="Revenue reported for the latest complete fiscal year." value={formatCompactCurrency(annual?.revenue, reportingCurrency)} detail={`${formatPercent(stock.revenueGrowth)} year over year`} />
      <PrimaryMetric tone="blue" label="Operating margin" help="Operating income divided by revenue for the latest complete fiscal year." value={formatPercent(stock.operatingMargin)} detail={snapshot.operatingMarginChange == null ? `FY ${annual?.year ?? "—"}` : `${signedPoints(snapshot.operatingMarginChange)} vs prior year`} />
      <PrimaryMetric tone="gold" label="Free cash flow" help="Operating cash flow less capital expenditure for the latest complete fiscal year." value={formatCompactCurrency(annual?.freeCashFlow, reportingCurrency)} detail={`${formatPercent(stock.freeCashFlowMargin)} margin`} />
    </div>

    <div className="snapshot-groups">
      <SnapshotGroup eyebrow="Valuation" title="What the market is paying">
        <SnapshotMetric label="P/E ratio" help="Market capitalization divided by latest annual net income. It is not shown when earnings are non-positive or currencies differ." value={snapshot.priceToEarnings == null ? "Not meaningful" : `${snapshot.priceToEarnings.toFixed(1)}×`} detail={snapshot.priceToEarningsReason ?? "Price / latest annual earnings"} />
        <SnapshotMetric label="FCF yield" help="Latest annual free cash flow divided by market capitalization. A negative percentage means the company consumed free cash flow." value={snapshot.freeCashFlowYield == null ? "Unavailable" : formatPercent(snapshot.freeCashFlowYield)} detail={snapshot.freeCashFlowYieldReason ?? (snapshot.freeCashFlowYield! < 0 ? "Negative annual free cash flow" : "Latest annual FCF / market cap")} tone={(snapshot.freeCashFlowYield ?? 0) < 0 ? "negative" : "neutral"} />
        <SnapshotMetric label="Dividend yield" help="Latest reported annual cash dividends divided by market capitalization. This is a trailing cash yield, not a forward dividend forecast." value={snapshot.dividendYield == null ? "None reported" : formatPercent(snapshot.dividendYield)} detail={snapshot.dividendYieldReason ?? "Trailing annual cash yield"} />
      </SnapshotGroup>

      <SnapshotGroup eyebrow="Capital structure" title="Balance-sheet and ownership discipline">
        <SnapshotMetric label={netCashDebtLabel} help="Cash and equivalents minus reported long-term debt. This comparison is suppressed for financial institutions." value={snapshot.netCashDebt == null ? snapshot.netCashDebtReason?.startsWith("Not comparable") ? "Not comparable" : "Unavailable" : formatCompactCurrency(Math.abs(snapshot.netCashDebt), reportingCurrency)} detail={snapshot.netCashDebtReason ?? (snapshot.netCashDebt! >= 0 ? "Cash exceeds long-term debt" : "Long-term debt exceeds cash")} />
        <SnapshotMetric label="Share-count change" help="Change in reported annual weighted-average shares. A decline may indicate buybacks; an increase indicates dilution." value={formatPercent(stock.shareChange)} detail={stock.shareChange == null ? "Comparable annual shares unavailable" : stock.shareChange <= 0 ? "Net reduction year over year" : "Dilution year over year"} tone={(stock.shareChange ?? 0) > 0 ? "negative" : "neutral"} />
      </SnapshotGroup>

      <SnapshotGroup eyebrow="Market behavior" title="How the stock has moved">
        <SnapshotMetric label="One-year return" help="Adjusted-close return over approximately 252 trading sessions." value={formatPercent(stock.oneYearReturn)} detail="Adjusted close · approximately 252 sessions" tone={stock.oneYearReturn < 0 ? "negative" : stock.oneYearReturn > 0 ? "positive" : "neutral"} />
        <SnapshotMetric label="52-week drawdown" help="Latest adjusted close relative to the highest adjusted close in the trailing 52 weeks." value={formatPercent(stock.drawdown52Week)} detail="From the trailing 52-week high" tone={stock.drawdown52Week < -20 ? "negative" : "neutral"} />
        <SnapshotMetric label="Annualized volatility" help="Annualized standard deviation of recent daily adjusted-close returns. Higher values mean wider historical price swings." value={`${stock.volatility.toFixed(1)}%`} detail="Realized from daily price changes" />
      </SnapshotGroup>
    </div>
  </section>;
}

function PrimaryMetric({ label, help, value, detail, tone }: { label: string; help: string; value: string; detail: string; tone: "teal" | "coral" | "blue" | "gold" }) {
  return <article className={`snapshot-primary snapshot-primary--${tone}`}><div className="snapshot-primary__top"><MetricLabel label={label} help={help} /></div><strong>{value}</strong><p>{detail}</p></article>;
}

function SnapshotGroup({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <article className="snapshot-group"><header className="snapshot-group__header"><div><span className="eyebrow">{eyebrow}</span><h3>{title}</h3></div></header><div className="snapshot-group__metrics">{children}</div></article>;
}

function SnapshotMetric({ label, help, value, detail, tone = "neutral" }: { label: string; help: string; value: string; detail: string; tone?: "neutral" | "positive" | "negative" }) {
  return <div className={`snapshot-metric snapshot-metric--${tone}`}><MetricLabel label={label} help={help} /><strong>{value}</strong><small title={detail}>{detail}</small></div>;
}

function MetricLabel({ label, help }: { label: string; help: string }) {
  return <div className="snapshot-metric__label"><b>{label}</b><span className="metric-help" tabIndex={0} role="note" aria-label={`${label}: ${help}`} data-help={help}>i</span></div>;
}

function signedPoints(value: number) { return `${value >= 0 ? "+" : ""}${value.toFixed(1)} pts`; }
function companySize(value: number | null) {
  if (value == null) return "Market value unavailable";
  if (value >= 200_000_000_000) return "Mega-cap company";
  if (value >= 10_000_000_000) return "Large-cap company";
  if (value >= 2_000_000_000) return "Mid-cap company";
  return "Small-cap company";
}
