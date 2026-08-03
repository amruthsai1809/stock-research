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
