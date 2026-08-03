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
- `update-intelligence.mjs` normalizes official Form 13F information tables and House disclosure PDFs.
- Generated records retain report dates and source filing links so the UI can expose provenance.

The application loads that snapshot after the shell renders. This prevents a multi-megabyte dataset from being embedded in the JavaScript bundle and allows the browser to cache data independently from application code.

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
