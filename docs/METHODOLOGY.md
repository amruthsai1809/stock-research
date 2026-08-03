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

TIDE reads official SEC Form 13F information tables, combines compatible originals and amendments by report period, and retains up to 20 quarters per curated manager. Quarter comparisons use reported share counts to distinguish disclosed manager activity from market-value movement. Concentration is the share of reported 13F value represented by the largest positions; turnover is a share-change-based proxy, not audited fund turnover.

A position history labels the first loaded appearance as `entered`, subsequent share-count increases as `added`, decreases as `trimmed`, and disappearance as `exited`. These labels describe quarter-end snapshots. They do not identify the exact trade date or cost basis. If a position is already present in the earliest loaded quarter, the interface says “held since at least” that quarter.

CIK identities and the latest expected reporting quarter are validated during every refresh. Closed managers remain available in an archive and are not presented as current filers.

Form 13F is normally filed up to 45 days after quarter end. It covers specified long U.S.-listed securities and omits shorts, most cash, many bonds, and many foreign securities. It is not a complete or current portfolio.

## Public-official disclosures

Public transaction reports use dollar ranges, not exact values. TIDE preserves each reported range and uses its midpoint only to order or size visual elements. It always separates the transaction date from the public filing date and flags records marked late by the normalized source.

An activity-derived exposure signal is created only when a disclosed purchase occurs after the latest explicit full sale for the same ticker. Partial sales reduce the activity-range midpoint; an explicit full sale closes the episode. This is a discovery aid, not a claimed current holding, remaining share count, cost basis, or market value. The interface labels it accordingly.

Ownership can include self, spouse, joint, and dependent accounts. Every displayed action links to the official filing, which remains authoritative if parsing or later amendments change a record.

The public dataset combines House Clerk, Senate eFD, and OGE records normalized by the MIT-licensed Kadoa Congress Trading Monitor. Current-member metadata is refreshed from the `unitedstates/congress-legislators` registry. Coverage can still be affected by filing availability, parsing limitations, delayed reports, amendments, and source-site changes.
