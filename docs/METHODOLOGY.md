# Research methodology

## Dip score

The Dip Finder is intentionally transparent:

```text
dip score = 62% price-dislocation score + 38% fundamental-quality score
```

Price dislocation considers trailing drawdown, one-month weakness, and distance from the 200-day average. Fundamental quality considers revenue growth, operating margin, free-cash-flow margin, cash conversion, balance-sheet structure, and share-count discipline.

Every component is normalized to a 0–100 range. This is a prioritization model, not a prediction or recommendation.

## Financial calculations

- Free cash flow: operating cash flow minus absolute capital expenditures
- Operating margin: operating income divided by revenue
- Free-cash-flow margin: free cash flow divided by revenue
- Cash conversion: operating cash flow divided by net income
- Liability ratio: total liabilities divided by total assets
- Drawdown: adjusted closing price relative to the trailing 52-week high
- Volatility: annualized standard deviation of logarithmic daily returns

## DCF laboratory

The valuation lab is a deliberately compact equity cash-flow model. It projects five years of reported free cash flow, discounts each year, adds a Gordon-growth terminal value, and divides the result by reported shares.

The model omits many company-specific adjustments. Its purpose is to make assumptions visible and testable, not to produce a precise target price.

## Data confidence

TIDE preserves missing values and exposes reporting dates. Composite models treat missing factors as neutral rather than inferring undisclosed values. This prevents absence of data from being mistaken for strong or weak performance.

## Portfolio comparison

Portfolio activity is parsed and normalized locally. Holdings are reconstructed from buys, sales, splits, fees, dividends, deposits, and withdrawals that appear in the imported history. TIDE prices supported securities with the latest available end-of-day snapshot.

The benchmark is cash-flow matched: each portfolio deposit is invested into the selected benchmark on the corresponding trading date, and withdrawals reduce the benchmark on the same basis. This avoids comparing a gradually funded portfolio with a hypothetical lump-sum investment. Results remain dependent on complete transaction history and are explicitly labeled when coverage is incomplete.

## Form 13F analysis

TIDE reads official SEC Form 13F information tables. Quarter comparisons use reported share counts to distinguish disclosed manager activity from market-value movement. Concentration is the share of reported 13F value represented by the largest positions; turnover is a value-change proxy, not audited fund turnover.

Form 13F is normally filed up to 45 days after quarter end. It covers specified long U.S.-listed securities and omits shorts, most cash, many bonds, and many foreign securities. It is not a complete or current portfolio.

## Public-official disclosures

Annual reports and periodic transaction reports use dollar ranges, not exact values. TIDE preserves each reported range and uses its midpoint only to order or size visual elements. The interface keeps annual holdings separate from later transactions and never infers a live portfolio from purchases and sales alone.

Ownership can include self, spouse, joint, and dependent accounts. Every displayed action links to the official filing, which remains authoritative if parsing or later amendments change a record.
