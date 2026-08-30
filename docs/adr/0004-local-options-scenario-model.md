# ADR 0004: Local options scenario model

## Status

Accepted.

## Context

Equity Lab needs to explain how an option changes when the underlying price, remaining time, and implied volatility change. The product is static, has no user accounts, and cannot assume that a delayed options feed may be republished. A useful first release must therefore work without a broker connection, API key, or licensed chain.

## Decision

Options Lab accepts a visitor-supplied strike, expiration, premium, and contract count. It combines those inputs with Equity Lab's existing end-of-day underlying price and performs every calculation in the browser.

- Long calls and long puts are the only exposed V1 strategies.
- The domain represents positions as immutable leg collections so defined-risk multi-leg strategies can be added without changing the pricing interface.
- American-style contracts use a Cox–Ross–Rubinstein tree with dividend yield and early exercise. European style uses Black–Scholes as an explicit alternate assumption.
- Implied volatility is recovered from the entered premium with a bracketed bisection solver. Inputs outside model bounds produce a typed error rather than `NaN` or a fabricated result.
- Expiration payoff is exact intrinsic value. Before-expiration value, Greeks, and price/time/volatility attribution are labeled as modeled values.
- The immediate scenario and payoff curve are synchronous. The full price-by-date surface runs in a Web Worker with a versioned protocol, monotonically increasing request IDs, and stale-response rejection.
- Modeling state is ephemeral. No contract, scenario, API key, or visitor action is sent to a server or written to browser storage.

## Consequences

The feature is free to run and does not create a new ingestion, storage, or deployment dependency. It is useful for understanding a known contract but is not an options-chain screener or executable quote. A future licensed quote adapter may populate the same inputs; it must not bypass the existing validation or calculation boundary.

The UI must state that it omits spreads, commissions, taxes, liquidity, assignment mechanics, and probability forecasts. Live-chain redistribution remains out of scope until a provider contract explicitly permits it.
