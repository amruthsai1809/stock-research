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

## Data boundary

`scripts/update-data.mjs` is the ingestion boundary. It downloads public inputs, maps issuer-specific XBRL concepts into a stable annual schema, validates minimum coverage, rounds market observations, and emits one versioned JSON snapshot.

The application loads that snapshot after the shell renders. This prevents a multi-megabyte dataset from being embedded in the JavaScript bundle and allows the browser to cache data independently from application code.

## State

- Research data is immutable after load.
- Navigation and modeling assumptions are ephemeral React state.
- Watchlists and theme preference use local storage because they are explicitly device-local.
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
