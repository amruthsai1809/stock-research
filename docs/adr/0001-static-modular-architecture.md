# ADR 0001: Static modular architecture

- Status: Accepted
- Date: 2026-08-04

## Context

TIDE must remain deployable as a static, login-free application while supporting independent research capabilities and replaceable data sources.

## Decision

Use dependency-directed modules: domain policies, application ports and use cases, repository adapters, feature controllers/view-models, and presentation components. Concrete adapters are assembled only in the composition root. Cross-feature navigation belongs to the shell; feature modules do not import one another.

Generated research data is treated as untrusted input and parsed through runtime contracts at repository boundaries. Substantial React orchestration belongs in controller hooks so views remain focused on interaction and rendering.

## Consequences

- Domain calculations can be tested without React or a browser.
- Data providers and static snapshots can change without rewriting feature views.
- New features have an explicit extension path and do not enlarge a central controller.
- The repository has more small boundary modules, but their ownership and dependency direction are clear.
