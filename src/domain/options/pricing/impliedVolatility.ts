import { err, ok, type Result } from "@/src/shared/core/result";
import type { ImpliedVolatilityRequest, OptionDomainError, OptionPricingRequest } from "../types";
import { priceOption } from "./binomialAmerican";

const MINIMUM_VOLATILITY_PCT = 0;
const MAXIMUM_VOLATILITY_PCT = 500;

export function impliedVolatility(request: ImpliedVolatilityRequest): Result<number, OptionDomainError> {
  if (!Number.isFinite(request.premiumPerShare) || request.premiumPerShare < 0) {
    return err({ code: "INVALID_INPUT", field: "premiumPerShare", message: "Premium must be a finite number that is zero or greater." });
  }
  if (request.timeToExpiryYears === 0) {
    return err({ code: "VOLATILITY_NOT_BRACKETED", field: "premiumPerShare", message: "Implied volatility is undefined at expiration." });
  }

  const withVolatility = (impliedVolatilityPct: number): OptionPricingRequest => ({ ...request, impliedVolatilityPct });
  const lowPrice = priceOption(withVolatility(MINIMUM_VOLATILITY_PCT));
  if (!lowPrice.ok) return lowPrice;
  const highPrice = priceOption(withVolatility(MAXIMUM_VOLATILITY_PCT));
  if (!highPrice.ok) return highPrice;
  const tolerance = Math.max(0.0001, request.premiumPerShare * 1e-7);
  if (request.premiumPerShare < lowPrice.value - tolerance || request.premiumPerShare > highPrice.value + tolerance) {
    return err({
      code: "PREMIUM_OUTSIDE_BOUNDS",
      field: "premiumPerShare",
      message: `Premium must be between $${lowPrice.value.toFixed(2)} and $${highPrice.value.toFixed(2)} for these contract inputs.`,
    });
  }

  let low = MINIMUM_VOLATILITY_PCT;
  let high = MAXIMUM_VOLATILITY_PCT;
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const middle = (low + high) / 2;
    const priced = priceOption(withVolatility(middle));
    if (!priced.ok) return priced;
    const difference = priced.value - request.premiumPerShare;
    if (Math.abs(difference) <= tolerance || high - low < 0.0001) return ok(middle);
    if (difference > 0) high = middle; else low = middle;
  }
  return ok((low + high) / 2);
}
