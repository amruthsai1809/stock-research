# Architecture

## Design goals

Equity Lab is designed around five constraints: zero-cost deployment, explainable calculations, source traceability, scalable static data, and a codebase that remains approachable as the feature set grows.

## Dependency direction

```text
React view → controller/view-model → application use case → domain policy
                                                      ↓
                                             repository port
                                                      ↓
                                   static JSON repository adapter

AppBootstrap → composition root → concrete adapters
```

Feature modules may consume domain functions and UI primitives. Domain modules never import React, browser APIs, or generated data. This keeps financial formulas deterministic and portable.

## Model, view, and data boundaries

The product uses pragmatic model-view separation rather than a stateful application server:

- Domain modules are the model: typed financial entities and deterministic policies.
- Application modules define use cases and ports. They do not know whether data came from a JSON snapshot, test fixture, or future API.
- Presentation modules split React views from controller/view-model hooks when state orchestration is substantial.
- Repository adapters validate untrusted JSON with runtime contracts before it reaches a use case.
- The composition root is the only module allowed to construct concrete repositories.
- The shell owns cross-feature navigation, theme, watchlist, and route synchronization only.

There are no feature-to-feature imports. A company, portfolio, 13F manager, or public official can gain a new analysis surface without expanding a central component.

## Data boundary

The scripts directory is the ingestion boundary:

- `market/universe.mjs` implements the $1 billion Nasdaq/NYSE/NYSE American common-share and ADR policy by joining Nasdaq screening data to SEC identifiers. It rejects non-common instruments and requires DUOL as an acceptance symbol.
- `update-data.mjs` fetches ten years of end-of-day history (or complete post-IPO history), normalizes issuer-specific SEC XBRL concepts, and emits the split market contract.
- `update-institutional.mjs` validates manager CIK identities, combines Form 13F originals and amendments, derives lifecycle state, and emits a small directory plus lazy-loaded manager profiles.
- `update-government.mjs` normalizes House Clerk, Senate eFD, and OGE records, refreshes current-member metadata, and emits a directory, recent feed, methodology-aware leaderboard, metadata, and lazy-loaded filer profiles. The ranking policy is shared with `build-government-leaderboard.mjs` so existing snapshots can be rebuilt without another network ingestion.
- `update-intelligence.mjs` is the orchestration entry point for both intelligence pipelines.
- `update-research-signals.mjs` derives recent SEC Form 4/4-A open-market activity and active-manager 13F breadth for the covered stock universe.
- Generated records retain report dates and source filing links so the UI can expose provenance.

The market boundary follows the same pattern. A compact, precomputed index supports search and universe-wide analysis. A chart or portfolio fetches only the requested companies through a cache-deduplicating repository. Each company is split into a stable historical archive and a small current-year delta, so ordinary daily deployments do not rewrite ten years of unchanged observations.

The scheduled updater treats the current Cloudflare deployment as its last-known-good baseline. It loads stable archives and current-year deltas, requests only the newest market sessions, merges by trading date, trims to the ten-year contract, and carries forward SEC-derived annuals. The original full-refresh path remains available for controlled backfills; routine CI refreshes do not depend on SEC accepting shared GitHub runner IP addresses.

The application loads directories after the shell renders and requests an individual company, manager, or filer profile only when selected. This keeps the initial transfer and JavaScript bundle small, avoids monolithic datasets, and lets the browser and Cloudflare cache immutable history independently.

Every generated research snapshot is assembled in a sibling staging directory, validated for completeness and lineage, and then swapped into place. Single-file generators use an atomic temporary-file rename. A failed refresh therefore leaves the last known-good dataset intact instead of exposing a partially written index or profile set. Production market files exist only in the ephemeral GitHub runner and Cloudflare static deployment; Git history never receives daily data snapshots.

## Intelligence lifecycle

- A manager registry identifies curated 13F filers by CIK.
- Each refresh verifies the CIK’s current SEC identity before accepting data.
- The expected report quarter is calculated from the filing calendar.
- Missing expected reports become `delayed`; verified lifecycle overrides mark ended managers `archived` and remove them from active directories and consensus.
- Original filings, restatements, additions, confidential-treatment flags, report dates, filing dates, and source URLs remain explicit.
- Public-filer `active` state is refreshed from the current Congress roster rather than hard-coded in the interface.

This lifecycle data belongs to the generated model. The React views only render its state. Closed managers retain source-linked history but are never described as current.

## Stock-intelligence boundary

The Stock Intelligence vertical slice uses Strategy for selectable factor weights, Repository for data access, Adapter for AI providers and static snapshots, and a composition root for dependency injection. Scoring is deterministic and runs before any language-model call. Missing inputs are removed from the denominator, effective weights are exposed, and confidence reports weighted evidence coverage.

The optional AI gateway receives a small evidence packet for one selected company. API keys exist only in component memory, are cleared on refresh and provider changes, and are never written to local storage. The gateway can be replaced with a server proxy later without changing scoring or presentation contracts.

Architecture boundary tests prevent domain-to-framework imports, presentation-to-infrastructure imports, and repository construction outside the composition root.

## State

- Research data is immutable after load.
- Navigation and modeling assumptions are ephemeral React state.
- Watchlists and theme preference use local storage because they are explicitly device-local.
- Imported portfolio transactions stay in memory. Persistence happens only when a visitor explicitly exports a file.
- There is no server-owned user state.

## Failure behavior

- Missing source facts render as missing values.
- A failed data load produces a product-specific recovery screen.
- A failed scheduled refresh does not overwrite the previous valid snapshot.
- The build workflow validates types and rendered output before changes are accepted.

## Quality boundaries

- Zod contracts validate static JSON at repository boundaries before domain code receives it.
- Unit tests cover domain policies, view-model filtering and sorting, runtime contracts, ranking rules, and atomic snapshot helpers with enforced coverage thresholds.
- Browser tests exercise ten-year chart controls, on-demand company loading, disclosure ranking and position ordering, manager lifecycle labeling, portfolio import, global search, theme switching, desktop/mobile feature boundaries, visual stability, and WCAG A/AA checks.
- Feature-level lazy loading keeps large parsers and research workbenches out of the initial client bundle. CI rejects any individual client asset above the documented bundle budget.
- Dependency updates are monitored automatically, and production dependencies are audited on every quality run.

## Extension points

- Price providers can be replaced inside the ingestion script.
- Company coverage is controlled by the explicit policy in `scripts/market/universe.mjs`; small symbol lists are supported only as development refresh scopes.
- New cross-cutting scores belong in a focused module with a domain policy, application use case, runtime data contract, and methodology documentation.
- New product capabilities belong in a focused `src/features/<feature>` module.
- New source formats implement a parser or repository adapter without changing feature views.
- New datasets must add integrity assertions in `tests/` before publication.

## Decisions

- [ADR 0001: Static modular architecture](adr/0001-static-modular-architecture.md)
- [ADR 0002: Atomic research snapshots](adr/0002-atomic-research-snapshots.md)
- [ADR 0003: Split market snapshots with stable paths](adr/0003-split-market-snapshots.md)
