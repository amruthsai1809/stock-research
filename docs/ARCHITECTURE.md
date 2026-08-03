# Architecture

## Design goals

TIDE is designed around four constraints: static deployment, explainable calculations, source traceability, and a codebase that remains approachable as the feature set grows.

## Dependency direction

```text
UI primitives
    ↑
Feature modules
    ↑
Domain analytics ← Domain types
    ↑
Generated data boundary
```

Feature modules may consume domain functions and UI primitives. Domain modules never import React, browser APIs, or generated data. This keeps financial formulas deterministic and portable.

## Model, view, and data boundaries

TIDE uses pragmatic model-view separation rather than an application server:

- Domain modules are the model: typed financial entities, parsers, and deterministic calculations.
- Feature modules are the views and view-model orchestration for one user workflow.
- Repository adapters are the data-access boundary and can be replaced without changing domain calculations.
- The shell owns cross-feature navigation, theme, watchlist, and route synchronization only.

There are no feature-to-feature imports. A company, portfolio, 13F manager, or public official can gain a new analysis surface without expanding a central component.

## Data boundary

The scripts directory is the ingestion boundary:

- `update-data.mjs` normalizes price history and issuer-specific SEC XBRL concepts.
- `update-institutional.mjs` validates manager CIK identities, combines Form 13F originals and amendments, derives lifecycle state, and emits a small directory plus lazy-loaded manager profiles.
- `update-government.mjs` normalizes House Clerk, Senate eFD, and OGE records, refreshes current-member metadata, and emits a directory, recent feed, metadata, and lazy-loaded filer profiles.
- `update-intelligence.mjs` is the orchestration entry point for both intelligence pipelines.
- Generated records retain report dates and source filing links so the UI can expose provenance.

The application loads directories after the shell renders and requests an individual manager or filer profile only when selected. This keeps the JavaScript bundle small, avoids a single monolithic intelligence file, and lets the browser cache each immutable snapshot independently.

## Intelligence lifecycle

- A manager registry identifies curated 13F filers by CIK.
- Each refresh verifies the CIK’s current SEC identity before accepting data.
- The expected report quarter is calculated from the filing calendar.
- Missing expected reports become `delayed`; ended managers become `archived` and leave the active directory.
- Original filings, restatements, additions, confidential-treatment flags, report dates, filing dates, and source URLs remain explicit.
- Public-filer `active` state is refreshed from the current Congress roster rather than hard-coded in the interface.

This lifecycle data belongs to the generated model. The React views only render its state, so a closure, new filing, amendment, or membership change does not require a UI code change.

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
- New scores belong in `src/domain/analytics.ts` with methodology documentation.
- New product capabilities belong in a focused `src/features/<feature>` module.
- New source formats implement a parser or repository adapter without changing feature views.
- New datasets must add integrity assertions in `tests/` before publication.
