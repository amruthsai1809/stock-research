# TIDE

**Fundamentals-first equity research for finding resilient businesses inside meaningful drawdowns.**

TIDE is a public, login-free stock research workbench. It combines five years of end-of-day market history with normalized SEC filing data, then performs screening, ranking, comparison, and valuation calculations locally in the browser.

## Product highlights

- Explainable Dip Finder combining price dislocation and business quality
- Company research cockpit with deterministic “What changed?” insights
- Annual financial statement explorer with value, growth, and margin modes
- Interactive quality-factor decomposition and filing provenance
- Local stock screener, comparison studio, and discounted cash-flow lab
- Command-palette search, responsive layouts, light/dark themes, and accessible controls
- Browser-only watchlists with JSON export—no login or tracking database
- Daily static-data refresh workflow suitable for a public repository

## Architecture

The deployed application is static from the user’s perspective: the browser receives application assets and a dated market-data snapshot. There is no application database, account system, or secret in the frontend.

```text
Daily build             Static deployment                 Visitor browser
────────────            ─────────────────                 ───────────────
Price history  ─┐       HTML / CSS / JS          ─┐      Dip scoring
SEC filings    ─┴─▶     market-data.json          ┴─▶    Screening
Normalization           dated + source-labeled            Valuation
Quality checks                                             Local watchlists
```

The code is organized by responsibility:

- `src/domain` — types, financial formulas, and ranking logic
- `src/features` — product capabilities grouped by user workflow
- `src/components` — reusable visual primitives
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
npm run lint         # static code checks
npm run build        # production build
npm test             # build + rendered and data-quality tests
```

## Data policy

- Fundamentals come from the SEC EDGAR Company Facts API.
- Prices are a dated end-of-day snapshot obtained by the build-time provider adapter.
- Price data is never described as real-time.
- Missing filing facts stay missing; TIDE does not silently estimate them.
- Every ranking is research context, not a recommendation.

The current price adapter uses Yahoo Finance chart data as a community endpoint. It is isolated in `scripts/update-data.mjs` so it can be replaced with a licensed provider without changing the product or domain layers.

## Privacy

TIDE has no login. Watchlists and preferences are stored in the visitor’s browser and can be exported manually. No portfolio data is transmitted to the application.

## Disclaimer

TIDE is an educational research project, not investment advice. Market data can be delayed, incomplete, or corrected after publication. Verify important information against primary filings and an authorized market-data source.

## License

MIT. See [LICENSE](LICENSE).
