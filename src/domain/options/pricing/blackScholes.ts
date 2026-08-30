import { err, ok, type Result } from "@/src/shared/core/result";
import { intrinsicValuePerShare } from "../payoff";
import type { OptionDomainError, OptionPricingRequest } from "../types";
import { validatePricingRequest } from "../validation";

export function blackScholesPrice(request: OptionPricingRequest): Result<number, OptionDomainError> {
  const validation = validatePricingRequest(request);
  if (!validation.ok) return validation;
  const { spotPrice: spot, strikePrice: strike, timeToExpiryYears: time, kind } = request;
  if (time === 0) return ok(intrinsicValuePerShare(kind, spot, strike));

  const sigma = request.impliedVolatilityPct / 100;
  const rate = request.riskFreeRatePct / 100;
  const dividend = request.dividendYieldPct / 100;
  if (sigma < 1e-8) {
    const discountedSpot = spot * Math.exp(-dividend * time);
    const discountedStrike = strike * Math.exp(-rate * time);
    return ok(kind === "call" ? Math.max(discountedSpot - discountedStrike, 0) : Math.max(discountedStrike - discountedSpot, 0));
  }

  const rootTime = Math.sqrt(time);
  const d1 = (Math.log(spot / strike) + (rate - dividend + sigma ** 2 / 2) * time) / (sigma * rootTime);
  const d2 = d1 - sigma * rootTime;
  const discountedSpot = spot * Math.exp(-dividend * time);
  const discountedStrike = strike * Math.exp(-rate * time);
  const price = kind === "call"
    ? discountedSpot * normalCdf(d1) - discountedStrike * normalCdf(d2)
    : discountedStrike * normalCdf(-d2) - discountedSpot * normalCdf(-d1);
  if (!Number.isFinite(price)) return err({ code: "NUMERICAL_FAILURE", message: "Black-Scholes pricing did not produce a finite value." });
  return ok(Math.max(0, price));
}

/** Abramowitz-Stegun approximation; maximum error is below 7.5e-8. */
export function normalCdf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}
