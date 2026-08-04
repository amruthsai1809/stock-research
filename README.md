# TIDE

**A source-first equity research workbench for finding resilient businesses inside meaningful drawdowns.**

TIDE is public, login-free, and designed for static hosting. It combines five years of end-of-day market history with normalized SEC and public-disclosure data, then performs analysis locally in the browser.

## Product highlights

- Explainable Dip Finder combining price dislocation with business quality
- Company research cockpit with interactive OHLC, volume, moving averages, exact date hover, and deterministic “What changed?” insights
- Stock screener, comparison studio, annual financial explorer, and discounted cash-flow lab
- Explainable Stock Intelligence with five strategy profiles, factor attribution, confidence, conservative fair value, SEC insider and active-manager 13F signals, evidence export, and an optional BYOK AI research editor
- Private portfolio import for CSV, QFX/OFX, QIF, JSON, and best-effort PDF, including cash-flow-matched benchmark comparisons
- Institutional ownership lab with 27 curated managers, 20 quarters of history, source-linked filings, lifecycle detection, share-count changes, and per-position entry/add/trim/exit trails
- Public-disclosure explorer with 440 searchable congressional and executive filers, 65,000+ normalized transactions, sample-aware performance and activity rankings, activity-derived exposure signals, reporting-delay analysis, and original filing links
- Responsive layouts, light/dark themes, keyboard-accessible controls, and command-palette search
- Browser-only watchlists; imported portfolio records remain in memory unless the visitor explicitly exports them
- Automated static-data validation, runtime contracts, atomic refreshes, weekday refresh workflow, unit coverage, browser regression tests, accessibility checks, and bundle budgets

## Architecture

Visitors receive static application assets and dated research snapshots. There is no application database, login system, server-owned user state, or secret in the frontend.

```text
Scheduled data build                 Static deployment              Visitor browser
────────────────────                 ─────────────────              ───────────────
End-of-day prices       ─┐
SEC company facts       ─┼─ validate ─▶ dated JSON snapshots ─────▶ screening + valuation
SEC 13F filings         ─┤               HTML / CSS / JS            position histories
House / Senate / OGE    ─┘                                         disclosure analysis
Broker export file  ──────────────────────────────────────────────▶ private local analysis
```

The code is organized by responsibility:

- `src/domain` — typed financial entities and deterministic calculations
- `src/application/ports` — repository contracts that keep use cases independent of delivery and storage
- `src/modules/stock-intelligence` — a vertical slice with domain, application, infrastructure-facing contracts, controller, and view
- `src/app/composition` — the only place concrete browser repositories are assembled
- `src/features` — product capabilities grouped by user workflow
- `src/components` — reusable visual and chart primitives
- `src/infrastructure/repositories` — replaceable static-data access boundaries
- `scripts` — repeatable ingestion, normalization, lifecycle checks, and validation
- `public/data` — generated, dated research snapshots
- `tests` — rendered-output and data-integrity checks

See [Architecture](docs/ARCHITECTURE.md) and [Methodology](docs/METHODOLOGY.md) for details.

## Getting started

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

## Commands

```bash
npm run dev                # local development
npm run data:update        # prices and SEC fundamentals
npm run data:benchmarks    # SPY, QQQ, and VTI history
npm run data:intelligence  # institutional and public-disclosure snapshots
npm run data:government:leaderboard # rebuild ranks from the current local disclosure snapshot
npm run data:signals       # SEC insider and active-manager ownership signals
npm run data:update:all    # every generated research snapshot
npm run typecheck          # strict TypeScript validation
npm run lint               # static code checks
npm run build              # production build
npm run test:unit          # unit tests with enforced coverage thresholds
npm run test:e2e           # Chromium workflow and accessibility tests
npm run bundle:check       # reject oversized client chunks
npm run security:check     # audit production dependencies
npm test                   # types, unit coverage, build, bundle, and data tests
npm run quality            # lint plus the full non-browser quality gate
```

## Data policy

- Fundamentals come from SEC EDGAR Company Facts.
- Institutional positions come from official Form 13F filings and information tables.
- Public-official activity comes from official House Clerk, Senate eFD, and Office of Government Ethics disclosures, normalized through the MIT-licensed Kadoa pipeline.
- Prices are dated end-of-day snapshots and are never described as real-time.
- Missing facts remain missing. TIDE does not turn disclosure ranges into exact values or activity into a claimed live portfolio.
- Every material institutional or public-official record links to a primary filing.
- Stock Intelligence is deterministic; an optional user-selected AI provider explains the already-computed evidence and never supplies hidden score inputs.
- Rankings and inferred exposure signals are research context, not recommendations.

The current price adapter uses Yahoo Finance chart data as a community endpoint. It is isolated in `scripts/update-data.mjs` so it can be replaced without changing the product or domain layers.

## Privacy

TIDE has no login. Theme and watchlist preferences are the only values stored in browser local storage. Imported portfolio records and optional AI API keys stay in memory and disappear on refresh. Portfolio files are not transmitted to TIDE; an AI key and the on-screen evidence packet go directly to the selected provider only after the visitor explicitly requests a memo.

## License and attribution

TIDE is MIT licensed. See [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md).

## Disclaimer

TIDE is an educational research project, not investment advice. Market and filing data can be delayed, incomplete, amended, or corrected. Verify important information against the primary source.
