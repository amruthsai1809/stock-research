# ADR 0003: Split market snapshots with stable paths

- Status: Accepted
- Date: 2026-08-29

## Context

The product must cover roughly 2,500–2,600 eligible U.S.-listed securities, retain ten years of daily history or complete post-IPO history, deploy on a zero-cost Cloudflare/GitHub workflow, and avoid turning Git history into a daily time-series database.

A monolithic JSON payload would approach a gigabyte, make first load unacceptable, exceed Cloudflare’s per-asset limit, and force every visitor to download histories they never inspect. Committing one complete dated snapshot per day would also duplicate almost all prior observations in Git objects.

## Decision

Use a versioned static contract with three layers:

1. A compact market index contains identities, screen-time market capitalization, latest and prior annual facts, precomputed analytics, coverage metadata, and paths.
2. One archive per symbol contains identity, up to ten SEC-derived annual periods, and daily prices before the current calendar year.
3. One current-year delta per symbol contains only current-year daily prices.

The browser loads the index once. A repository validates, fetches, merges, analyzes, caches, and deduplicates archive/delta requests only for selected companies. Production files use stable symbol-derived paths and are generated in an ephemeral GitHub Actions workspace. They are ignored by Git and deployed directly to Cloudflare after validation.

## Consequences

- Startup transfer scales with the number of securities, not the number of historical sessions.
- An ordinary daily deployment changes the compact index and current-year deltas; historical archives remain cache-stable.
- A ten-year company chart costs two parallel static requests on first use and no additional requests after the repository cache is warm.
- A January refresh rolls the completed year into every archive. That deployment is intentionally larger.
- The static asset count is approximately twice the security count plus existing research profiles, comfortably below Cloudflare’s 20,000-file boundary at the approved universe size.
- No R2 bucket, database, paid market feed, or automated Git data commit is required.
- Provider corrections to older history are incorporated when the archive is rebuilt, so archives are cacheable but not permanently immutable.

## Rejected alternatives

- Daily dated full snapshots: excessive Git and deployment duplication.
- One market-history file: exceeds practical transfer and per-asset limits.
- One file per symbol per year: efficient daily changes but approaches or exceeds the static asset-count boundary.
- R2 object storage: viable, but unnecessary for the current universe and introduces billing configuration the project does not need.
- Browser-side direct provider calls: exposes every visitor to upstream rate limits, unstable CORS behavior, and inconsistent snapshots.
