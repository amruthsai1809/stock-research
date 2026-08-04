# Architecture

## Design goals

TIDE is designed around four constraints: static deployment, explainable calculations, source traceability, and a codebase that remains approachable as the feature set grows.

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

TIDE uses pragmatic model-view separation rather than an application server:

- Domain modules are the model: typed financial entities and deterministic policies.
- Application modules define use cases and ports. They do not know whether data came from a JSON snapshot, test fixture, or future API.
- Presentation modules split React views from controller/view-model hooks when state orchestration is substantial.
- Repository adapters validate untrusted JSON with runtime contracts before it reaches a use case.
- The composition root is the only module allowed to construct concrete repositories.
- The shell owns cross-feature navigation, theme, watchlist, and route synchronization only.

There are no feature-to-feature imports. A company, portfolio, 13F manager, or public official can gain a new analysis surface without expanding a central component.

## Data boundary

The scripts directory is the ingestion boundary:

- `update-data.mjs` normalizes price history and issuer-specific SEC XBRL concepts.
- `update-institutional.mjs` validates manager CIK identities, combines Form 13F originals and amendments, derives lifecycle state, and emits a small directory plus lazy-loaded manager profiles.
- `update-government.mjs` normalizes House Clerk, Senate eFD, and OGE records, refreshes current-member metadata, and emits a directory, recent feed, methodology-aware leaderboard, metadata, and lazy-loaded filer profiles. The ranking policy is shared with `build-government-leaderboard.mjs` so existing snapshots can be rebuilt without another network ingestion.
- `update-intelligence.mjs` is the orchestration entry point for both intelligence pipelines.
- `update-research-signals.mjs` derives recent SEC Form 4/4-A open-market activity and active-manager 13F breadth for the covered stock universe.
- Generated records retain report dates and source filing links so the UI can expose provenance.

The application loads directories after the shell renders and requests an individual manager or filer profile only when selected. This keeps the JavaScript bundle small, avoids a single monolithic intelligence file, and lets the browser cache each immutable snapshot independently.

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

## Extension points

- Price providers can be replaced inside the ingestion script.
- Company coverage is controlled by `scripts/company-registry.mjs`.
- New cross-cutting scores belong in a focused module with a domain policy, application use case, runtime data contract, and methodology documentation.
- New product capabilities belong in a focused `src/features/<feature>` module.
- New source formats implement a parser or repository adapter without changing feature views.
- New datasets must add integrity assertions in `tests/` before publication.
