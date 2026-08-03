# TIDE

**Fundamentals-first equity research for finding resilient businesses inside meaningful drawdowns.**

TIDE is a public, login-free stock research workbench. It combines five years of end-of-day market history with normalized SEC filing data, then performs screening, ranking, comparison, and valuation calculations locally in the browser.

## Product highlights

- Explainable Dip Finder combining price dislocation and business quality
- Company research cockpit with deterministic “What changed?” insights
- Annual financial statement explorer with value, growth, and margin modes
- Interactive quality-factor decomposition and filing provenance
- Local stock screener, comparison studio, and discounted cash-flow lab
- Private portfolio import for CSV, QFX/OFX, QIF, JSON, and best-effort PDF, with a normalized audit ledger
- Cash-flow-matched portfolio comparisons, holdings reconstruction, drawdown, volatility, and attribution context
- SEC 13F explorer with eight-quarter history, concentration maps, entries, exits, and share-count changes
- Public-official disclosure explorer with annual value ranges, action timelines, filters, and original filing links
- Command-palette search, responsive layouts, light/dark themes, and accessible controls
- Browser-only watchlists with JSON export—no login or tracking database
- Daily static-data refresh workflow suitable for a public repository

## Architecture

The deployed application is static from the user’s perspective: the browser receives application assets and a dated market-data snapshot. There is no application database, account system, or secret in the frontend.

```text
Daily build             Static deployment                 Visitor browser
────────────            ─────────────────                 ───────────────
Price history   ─┐      HTML / CSS / JS             ─┐    Dip scoring
ETF histories   ├─▶    benchmark-data.json          │     Portfolio benchmarks
SEC company data├─▶    market-data.json             │     Screening + valuation
SEC 13F tables  ├─▶    institutional-data.json      ├─▶   13F change analysis
House records   ─┘      government-data.json         │     Disclosure timelines
                        dated + source-labeled        └─▶   Local portfolio analysis
```

The code is organized by responsibility:

- `src/domain` — types, financial formulas, and ranking logic
- `src/features` — product capabilities grouped by user workflow
- `src/components` — reusable visual primitives
- `src/infrastructure` — replaceable repositories at the static-data boundary
- `scripts` — repeatable static-data ingestion and normalization
- `public/data` — generated, dated research snapshot
- `tests` — rendered-output and data-integrity checks

More detail is available in [Architecture](docs/ARCHITECTURE.md) and [Methodology](docs/METHODOLOGY.md).

## Getting started

Requirements: Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

Then open the local URL printed in the terminal.

## Commands

```bash
npm run dev          # local development
npm run data:update  # refresh prices and SEC fundamentals
npm run data:benchmarks   # refresh SPY, QQQ, and VTI histories
npm run data:intelligence # refresh SEC 13F and House disclosure snapshots
npm run data:update:all   # refresh every generated research snapshot
npm run lint         # static code checks
npm run build        # production build
npm test             # build + rendered and data-quality tests
```

## Data policy

- Fundamentals come from the SEC EDGAR Company Facts API.
- Institutional positions come from official SEC Form 13F information tables.
- Public-official records come from the U.S. House Financial Disclosure database.
- Prices are a dated end-of-day snapshot obtained by the build-time provider adapter.
- Price data is never described as real-time.
- Missing filing facts stay missing; TIDE does not silently estimate them.
- Every ranking is research context, not a recommendation.

The current price adapter uses Yahoo Finance chart data as a community endpoint. It is isolated in `scripts/update-data.mjs` so it can be replaced with a licensed provider without changing the product or domain layers.

## Privacy

TIDE has no login. Watchlists and theme preference are stored in the visitor’s browser and can be exported manually. Imported portfolio records remain in memory only and disappear on refresh unless the visitor explicitly exports normalized JSON. No portfolio document is transmitted to the application.

## Disclaimer

TIDE is an educational research project, not investment advice. Market data can be delayed, incomplete, or corrected after publication. Verify important information against primary filings and an authorized market-data source.

## License

MIT. See [LICENSE](LICENSE).
