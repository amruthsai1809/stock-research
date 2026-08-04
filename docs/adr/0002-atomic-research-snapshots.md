# ADR 0002: Atomic research snapshots

- Status: Accepted
- Date: 2026-08-04

## Context

Market, 13F, and public-disclosure refreshes generate related indexes, metadata, feeds, and profile files. Replacing files as they are downloaded can expose a mixed or incomplete dataset when a refresh fails.

## Decision

Build multi-file datasets in a sibling staging directory. Validate identifiers, counts, profile completeness, and snapshot lineage before replacing the published directory. Use temporary-file rename for single-file outputs. Preserve and restore the previous directory if the final swap fails.

## Consequences

- Readers observe either the previous complete snapshot or the new complete snapshot.
- Failed refreshes are recoverable without manual data reconstruction.
- Generators require explicit validation before commit, which adds a small amount of code and temporary disk use.
