import { describe, expect, it } from "vitest";
import { attributeOptionValueChange } from "@/src/domain/options/attribution";
import { intrinsicValuePerShare, positionExpirationProfitLoss } from "@/src/domain/options/payoff";
import { binomialOptionPrice, priceOption } from "@/src/domain/options/pricing/binomialAmerican";
import { blackScholesPrice } from "@/src/domain/options/pricing/blackScholes";
import { calculateGreeks } from "@/src/domain/options/pricing/greeks";
import { impliedVolatility } from "@/src/domain/options/pricing/impliedVolatility";
import { positionGreeks, valuePosition } from "@/src/domain/options/riskProfile";
import { validateOptionPosition, validatePricingRequest } from "@/src/domain/options/validation";
import type { OptionPosition, OptionPricingRequest } from "@/src/domain/options/types";

const base: OptionPricingRequest = {
  kind: "call",
  exerciseStyle: "european",
  spotPrice: 100,
  strikePrice: 100,
  timeToExpiryYears: 1,
  impliedVolatilityPct: 20,
  riskFreeRatePct: 5,
  dividendYieldPct: 0,
  binomialSteps: 300,
};

const longCall: OptionPosition = {
  legs: [{ kind: "call", direction: "long", strikePrice: 100, premiumPerShare: 6, contracts: 1, contractMultiplier: 100 }],
};

describe("option payoff invariants", () => {
  it("calculates exact call and put intrinsic values", () => {
    expect(intrinsicValuePerShare("call", 120, 100)).toBe(20);
    expect(intrinsicValuePerShare("call", 80, 100)).toBe(0);
    expect(intrinsicValuePerShare("put", 80, 100)).toBe(20);
    expect(intrinsicValuePerShare("put", 120, 100)).toBe(0);
  });

  it("calculates expiration P/L using per-share premium and contract multiplier", () => {
    expect(positionExpirationProfitLoss(longCall, 120)).toBe(1_400);
    expect(positionExpirationProfitLoss(longCall, 100)).toBe(-600);
    expect(positionExpirationProfitLoss(longCall, 106)).toBe(0);
  });
});

describe("pricing models", () => {
  it("matches the standard Black-Scholes call reference", () => {
    const result = blackScholesPrice(base);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeCloseTo(10.4506, 3);
  });

  it("satisfies European put-call parity with continuous dividends", () => {
    const call = blackScholesPrice({ ...base, dividendYieldPct: 2 });
    const put = blackScholesPrice({ ...base, kind: "put", dividendYieldPct: 2 });
    expect(call.ok && put.ok).toBe(true);
    if (call.ok && put.ok) {
      const parity = base.spotPrice * Math.exp(-0.02) - base.strikePrice * Math.exp(-0.05);
      expect(call.value - put.value).toBeCloseTo(parity, 5);
    }
  });

  it("never values an American option below the equivalent European option", () => {
    for (const kind of ["call", "put"] as const) {
      const european = priceOption({ ...base, kind, exerciseStyle: "european" });
      const american = binomialOptionPrice({ ...base, kind, exerciseStyle: "american", binomialSteps: 500 });
      expect(european.ok && american.ok).toBe(true);
      if (european.ok && american.ok) expect(american.value + 0.02).toBeGreaterThanOrEqual(european.value);
    }
  });

  it("converges toward Black-Scholes for a non-dividend European call", () => {
    const analytic = blackScholesPrice(base);
    const tree = binomialOptionPrice({ ...base, exerciseStyle: "american", binomialSteps: 1_000 });
    expect(analytic.ok && tree.ok).toBe(true);
    if (analytic.ok && tree.ok) expect(tree.value).toBeCloseTo(analytic.value, 2);
  });

  it("returns exact intrinsic value at expiration", () => {
    const result = priceOption({ ...base, spotPrice: 83, strikePrice: 100, kind: "put", timeToExpiryYears: 0, exerciseStyle: "american" });
    expect(result).toEqual({ ok: true, value: 17 });
  });

  it("handles deterministic near-zero volatility without NaN", () => {
    const result = priceOption({ ...base, impliedVolatilityPct: 0, exerciseStyle: "american" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(Number.isFinite(result.value)).toBe(true);
  });

  it("rejects an invalid binomial probability instead of clamping silently", () => {
    const result = binomialOptionPrice({ ...base, riskFreeRatePct: 100, impliedVolatilityPct: 0.01, binomialSteps: 2, exerciseStyle: "american" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_PROBABILITY");
  });
});

describe("implied volatility and Greeks", () => {
  it("recovers volatility from a premium produced by the same model", () => {
    const priced = priceOption({ ...base, exerciseStyle: "american", impliedVolatilityPct: 37, binomialSteps: 160 });
    expect(priced.ok).toBe(true);
    if (!priced.ok) return;
    const solved = impliedVolatility({ ...base, exerciseStyle: "american", premiumPerShare: priced.value, binomialSteps: 160 });
    expect(solved.ok).toBe(true);
    if (solved.ok) expect(solved.value).toBeCloseTo(37, 2);
  });

  it("rejects premiums outside model bounds", () => {
    const result = impliedVolatility({ ...base, premiumPerShare: 500 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PREMIUM_OUTSIDE_BOUNDS");
  });

  it("returns Greeks with conventional long-call signs", () => {
    const result = calculateGreeks({ ...base, exerciseStyle: "american" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.deltaPerShare).toBeGreaterThan(0);
    expect(result.value.gammaPerShare).toBeGreaterThan(0);
    expect(result.value.vegaPerVolatilityPoint).toBeGreaterThan(0);
    expect(result.value.thetaPerCalendarDay).toBeLessThan(0);
    expect(result.value.rhoPerRatePoint).toBeGreaterThan(0);
  });

  it("scales per-share Greeks into dollar position Greeks", () => {
    const result = positionGreeks(longCall, { spotPrice: 100, timeToExpiryYears: 0.5, impliedVolatilityPct: 25 }, { exerciseStyle: "american", riskFreeRatePct: 4, dividendYieldPct: 0, binomialSteps: 160 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.deltaDollars).toBeCloseTo(result.value.deltaPerShare * 100, 8);
  });
});

describe("position risk and validation", () => {
  it("compares an option scenario with owning the equivalent shares", () => {
    const result = valuePosition(longCall, { spotPrice: 110, timeToExpiryYears: 0.2, impliedVolatilityPct: 25 }, { exerciseStyle: "american", riskFreeRatePct: 4, dividendYieldPct: 0 }, 100);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.shareComparisonDollars).toBe(1_000);
      expect(Number.isFinite(result.value.profitLossDollars)).toBe(true);
    }
  });

  it("rejects invalid pricing and position fields", () => {
    expect(validatePricingRequest({ ...base, spotPrice: 0 }).ok).toBe(false);
    expect(validatePricingRequest({ ...base, timeToExpiryYears: -1 }).ok).toBe(false);
    expect(validatePricingRequest({ ...base, impliedVolatilityPct: 2_000 }).ok).toBe(false);
    expect(validatePricingRequest({ ...base, binomialSteps: 1 }).ok).toBe(false);
    expect(validateOptionPosition({ legs: [] }).ok).toBe(false);
    expect(validateOptionPosition({ legs: [{ ...longCall.legs[0], contracts: 0 }] }).ok).toBe(false);
  });

  it("attributes price, time, and volatility without order bias", () => {
    const initial = { spotPrice: 100, timeToExpiryYears: 1, impliedVolatilityPct: 20 };
    const target = { spotPrice: 110, timeToExpiryYears: 0.5, impliedVolatilityPct: 30 };
    const value = (state: typeof initial) => state.spotPrice * 0.5 + state.timeToExpiryYears * 4 + state.impliedVolatilityPct * 0.1 + state.spotPrice * state.timeToExpiryYears * 0.01;
    const result = attributeOptionValueChange(initial, target, value, 100);
    expect(result.priceDollars + result.timeDollars + result.volatilityDollars).toBeCloseTo(result.totalDollars, 8);
    expect(result.totalDollars).toBeCloseTo((value(target) - value(initial)) * 100, 8);
  });
});
