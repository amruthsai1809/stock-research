# Research methodology

## Equity universe and price history

Each production refresh screens Nasdaq market data and joins each ticker to the SEC exchange/CIK registry. A security is eligible when its screen-time market capitalization is at least $1 billion, it maps to Nasdaq or NYSE (including NYSE American listings reported through the NYSE family), and it is a common equity or ADR. Name-based instrument rules reject ETFs, funds, preferred shares, warrants, rights, units, notes, bonds, debentures, and similar non-common securities. The generated index records the exact eligible and successfully published counts because the universe changes with prices, listings, and corporate actions.

The generator requests a rolling ten-year end-of-day window. A company listed within that window retains its complete available post-IPO history. Prices are adjusted for comparison and return calculations; unadjusted OHLC and volume remain available for chart inspection. “Ten years” is a data-coverage boundary, not a statement that every newer listing has ten calendar years of observations.

Market capitalization is used only for universe eligibility and valuation context. It is a screen-time snapshot, not a real-time quote. DUOL is an explicit acceptance symbol so the coverage policy is tested against a newer, non-index growth company.

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

## Options laboratory

Options Lab is a local scenario model for a visitor-entered long call or long put. It does not ingest or republish an options chain. The current underlying value is the latest available end-of-day adjusted close; strike, expiration, premium, and quantity come from the visitor.

Expiration profit and loss is exact for the entered premium:

```text
long call P/L = (max(stock price − strike, 0) − premium) × multiplier × contracts
long put P/L  = (max(strike − stock price, 0) − premium) × multiplier × contracts
```

Before expiration, American-style theoretical value uses a Cox–Ross–Rubinstein binomial tree with continuous dividend yield and early-exercise checks. European-style value uses Black–Scholes. Implied volatility is solved from the visitor's premium by bracketed bisection after checking the model's attainable premium bounds. Greeks are stable finite differences from the same selected pricing model and are shown both per share and in position dollars.

Dates are UTC date-only values. Time to expiration is remaining calendar days divided by 365; the interface does not imply intraday precision from end-of-day source data. Price, time, and volatility contributions use an exact three-factor Shapley decomposition, so their components reconcile to the total modeled option-value change without depending on an arbitrary update order.

The model omits bid–ask spreads, commissions, taxes, liquidity, discrete dividend schedules, assignment mechanics, probability forecasts, and broker margin. It is educational scenario analysis, not a quote, recommendation, or claim that a contract can be executed at the entered premium.

## Data confidence

The product preserves missing values and exposes reporting dates. Composite models treat missing factors as neutral rather than inferring undisclosed values. This prevents absence of data from being mistaken for strong or weak performance.

## Ownership and activity signals

Insider activity comes from SEC Forms 4 and 4/A. Equity Lab counts only open-market purchase and sale transaction codes, keeps the filing and transaction dates distinct, and aggregates one year of activity even when the detailed table is capped for presentation. The business-day refresh checks the current quarter for newly filed forms and combines them with recent SEC quarterly bulk archives.

Short interest comes from FINRA's official equity short-interest files. FINRA normally publishes this dataset twice monthly, so checking it every business day improves discovery latency but does not create a new observation when the source has not changed. Short interest is not daily short volume. Percentage of float is shown only when a reliable float value is available; otherwise the interface labels the denominator as shares outstanding. Days to cover uses reported short interest divided by the available average-volume observation.

Institutional breadth is limited to the explicitly tracked Form 13F manager registry. A company view uses the latest report period shared by the generated manager profiles and reports both the number of managers that filed that period and the number expected. Adds, trims, entries, and exits compare share counts between consistent quarter-end snapshots. They are delayed disclosures of specified long positions, not real-time ownership or evidence of a current trade.

## Portfolio comparison

Portfolio activity is parsed and normalized locally. Holdings are reconstructed from buys, sales, splits, fees, dividends, deposits, and withdrawals that appear in the imported history. The product prices supported securities with the latest available end-of-day snapshot.

The benchmark is cash-flow matched: each portfolio deposit is invested into the selected benchmark on the corresponding trading date, and withdrawals reduce the benchmark on the same basis. This avoids comparing a gradually funded portfolio with a hypothetical lump-sum investment. Results remain dependent on complete transaction history and are explicitly labeled when coverage is incomplete.

## Form 13F analysis

The product reads official SEC Form 13F information tables, combines compatible originals and amendments by report period, and retains up to 20 quarters per curated manager. Quarter comparisons use reported share counts to distinguish disclosed manager activity from market-value movement. Concentration is the share of reported 13F value represented by the largest positions; turnover is a share-change-based proxy, not audited fund turnover.

A position history labels the first loaded appearance as `entered`, subsequent share-count increases as `added`, decreases as `trimmed`, and disappearance as `exited`. These labels describe quarter-end snapshots. They do not identify the exact trade date or cost basis. If a position is already present in the earliest loaded quarter, the interface says “held since at least” that quarter.

CIK identities and the latest expected reporting quarter are validated during every refresh. Closed managers remain available in an archive and are not presented as current filers.

Form 13F is normally filed up to 45 days after quarter end. It covers specified long U.S.-listed securities and omits shorts, most cash, many bonds, and many foreign securities. It is not a complete or current portfolio.

## Public-official disclosures

Public transaction reports use dollar ranges, not exact values. The product preserves each reported range and uses its midpoint only to order or size visual elements. It always separates the transaction date from the public filing date and flags records marked late by the normalized source.

The disclosure leaderboard compares officials using eligible non-derivative purchases with valid ticker and price coverage. Its one-year return is the median underlying-security return one year after those purchases. Options, warrants, and other derivative proxies are excluded because an underlying stock return is not the return of the disclosed instrument. The consistency rank uses the 95% Wilson lower bound of the positive one-year outcome rate, so a small perfect sample does not automatically outrank a large history.

Every performance row includes its observation count. Confidence is `high` for at least 20 one-year observations, `medium` for 5â€“19, and `limited` below 5 or whenever the loaded history is truncated. The default leaderboard excludes limited samples; they remain available behind an explicit coverage control.

An activity-derived exposure signal is created only when a disclosed purchase occurs after the latest explicit full sale for the same ticker. Partial sales reduce the activity-range midpoint; an explicit full sale closes the episode. This is a discovery aid, not a claimed current holding, remaining share count, cost basis, or market value. The interface labels it accordingly.

Ownership can include self, spouse, joint, and dependent accounts. Every displayed action links to the official filing, which remains authoritative if parsing or later amendments change a record.

The public dataset combines House Clerk, Senate eFD, and OGE records normalized by the MIT-licensed Kadoa Congress Trading Monitor. Current-member metadata is refreshed from the `unitedstates/congress-legislators` registry. Coverage can still be affected by filing availability, parsing limitations, delayed reports, amendments, and source-site changes.
