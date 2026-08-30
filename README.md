# Equity Lab

Equity Lab is deployed at [el.amruthg.com](https://el.amruthg.com). The former `equitylab.amruthg.com` hostname permanently redirects to the canonical address.

An evidence-first, login-free U.S. equity research workbench. The production universe screens Nasdaq, NYSE, and NYSE American securities for a market capitalization of at least $1 billion, includes common shares and ADRs, excludes funds and non-common instruments, and publishes ten years of end-of-day history or the complete available history for newer IPOs.

## What it does

- Explainable Dip Finder combining price dislocation with business quality
- Company research with interactive price/volume charts, 10Y range controls, SEC-derived annuals, and source lineage
- Screener, two-company comparison, financial explorer, and transparent DCF lab
- Deterministic Stock Intelligence with selectable strategies, factor attribution, confidence, SEC insider and active-manager evidence, and optional bring-your-own-key AI writing
- Browser-local portfolio import for CSV, QFX/OFX, QIF, JSON, and best-effort PDF
- Source-linked 13F history and public-official disclosure research
- Local watchlists, responsive layouts, light/dark themes, keyboard search, and accessibility checks

DUOL is a required acceptance symbol in the universe and data-quality gates.

## Zero-cost data architecture

The browser does not download every company’s price history at startup:

```text
Nasdaq screen + SEC identifiers + EOD provider
                    |
              scheduled build
                    |
     validate + build compact summaries
                    |
       Cloudflare Worker + static assets
          /                    \
 compact market index     per-symbol files
 loaded at startup        loaded on demand
                         /              \
                  stable archive   current-year delta
```

- `public/data/market/index.json` contains compact, precomputed summaries for search, sorting, screening, and scores.
- A selected chart fetches only that symbol’s stable archive and small current-year delta. Requests are validated, cached, and deduplicated by the repository adapter.
- Production market files are generated in the GitHub Actions workspace, deployed directly to Cloudflare, and ignored by Git. There are no dated daily copies and no automated data commits.
- Stable file paths let Cloudflare reuse unchanged historical assets. On an ordinary trading day only the index and current-year deltas change.
- Scheduled refreshes use the last validated Cloudflare deployment as an immutable baseline, merge only the newest end-of-day sessions, and carry forward SEC annuals. This avoids refetching ten years of source data and tolerates SEC blocking shared CI runner addresses.
- The repository retains a small legacy development fixture so a clean clone can build and test without a network backfill.
- No R2 bucket, database, login system, or server-owned user data is required.

The current full screen is expected to fluctuate around 2,500–2,600 securities as prices and listings change. The generated index records both the eligible count and published count on every refresh.

## Architecture

- `src/domain` — typed financial entities and deterministic calculations
- `src/application/ports` — repository contracts independent of delivery and storage
- `src/app/composition` — the only concrete-adapter composition root
- `src/features` — product capabilities grouped by workflow
- `src/modules/stock-intelligence` — a vertical slice with domain, application, and presentation boundaries
- `src/infrastructure/repositories` — runtime-validated static adapters and on-demand history cache
- `scripts/market` — universe policy and build-time summary generation
- `scripts` — repeatable ingestion and normalization jobs
- `tests` — unit, architecture, data-integrity, rendered-output, browser, visual, and accessibility checks

See [Architecture](docs/ARCHITECTURE.md), [Methodology](docs/METHODOLOGY.md), and the [static modular architecture ADR](docs/adr/0001-static-modular-architecture.md).

## Local development

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

The checked-in fixture is enough for ordinary development. To create a current local sample, set `MARKET_SYMBOLS` to a comma-separated list before running `npm run data:update`. Omit it for the production-sized universe.

## Commands

```bash
npm run dev                 # local development server
npm run data:update         # universe, 10Y prices, and SEC fundamentals
npm run data:benchmarks     # long SPY, QQQ, and VTI histories
npm run data:intelligence   # institutional and public-disclosure snapshots
npm run data:signals        # SEC insider and market-opinion signals
npm run typecheck           # strict TypeScript validation
npm run lint                # static code checks
npm run build               # production Cloudflare build
npm run test:unit           # unit tests with coverage thresholds
npm run test:data           # generated-data and architecture contracts
npm run test:e2e            # real Chromium workflows and accessibility
npm run bundle:check        # client-asset budgets
npm run cloudflare:check    # Worker size, modules, and static-asset limits
npm run security:check      # production dependency audit
npm test                    # types, unit coverage, build, bundle, and data
npm run quality             # complete non-browser quality gate
npm run deploy:cloudflare   # deploy a validated build with Wrangler
```

## Automation and deployment

`.github/workflows/quality.yml` validates every push and pull request. `.github/workflows/update-market-data.yml` runs after U.S. market days, creates the production data entirely in the ephemeral runner, validates it, builds once, and deploys the result. It requires only `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets; neither is exposed to the client.

The Cloudflare project uses static assets plus the Vinext application Worker. Keep it on the Workers Free plan for a hard no-spend operating boundary. The canonical production hostname is `el.amruthg.com`; `equitylab.amruthg.com` is retained only as a permanent redirect.

## Data and privacy policy

- Fundamentals come from SEC EDGAR Company Facts.
- The universe joins Nasdaq’s market screen to SEC exchange and CIK identifiers.
- Prices are end-of-day community data and are never described as real time.
- Missing source facts remain missing; the product does not manufacture values.
- Institutional and public-official evidence links to primary filings.
- Stock Intelligence scoring is deterministic. Optional AI explains an already-computed evidence packet and never supplies hidden score inputs.
- There is no login. Theme and watchlist preferences are stored locally. Imported portfolio records and optional AI keys remain in memory unless the visitor explicitly exports or sends an evidence packet.

The price and universe adapters are isolated so a licensed or alternative provider can replace them without changing domain or presentation code.

## License and disclaimer

MIT licensed. See [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md).

This is an educational research project, not investment advice. Market and filing data can be delayed, incomplete, amended, or corrected. Verify material decisions against primary sources.
