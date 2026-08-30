import { err, ok, type Result } from "@/src/shared/core/result";
import type { OptionDomainError, OptionLeg, OptionPricingRequest, OptionPosition } from "./types";

const finitePositiveFields = ["spotPrice", "strikePrice"] as const;

export function validatePricingRequest(request: OptionPricingRequest): Result<OptionPricingRequest, OptionDomainError> {
  for (const field of finitePositiveFields) {
    if (!Number.isFinite(request[field]) || request[field] <= 0) {
      return err({ code: "INVALID_INPUT", field, message: `${field} must be a finite number greater than zero.` });
    }
  }
  if (!Number.isFinite(request.timeToExpiryYears) || request.timeToExpiryYears < 0) {
    return err({ code: "INVALID_INPUT", field: "timeToExpiryYears", message: "Time to expiration cannot be negative." });
  }
  if (!Number.isFinite(request.impliedVolatilityPct) || request.impliedVolatilityPct < 0 || request.impliedVolatilityPct > 1_000) {
    return err({ code: "INVALID_INPUT", field: "impliedVolatilityPct", message: "Implied volatility must be between 0% and 1,000%." });
  }
  if (!Number.isFinite(request.riskFreeRatePct) || request.riskFreeRatePct < -20 || request.riskFreeRatePct > 100) {
    return err({ code: "INVALID_INPUT", field: "riskFreeRatePct", message: "Risk-free rate must be between -20% and 100%." });
  }
  if (!Number.isFinite(request.dividendYieldPct) || request.dividendYieldPct < 0 || request.dividendYieldPct > 100) {
    return err({ code: "INVALID_INPUT", field: "dividendYieldPct", message: "Dividend yield must be between 0% and 100%." });
  }
  if (request.binomialSteps !== undefined && (!Number.isInteger(request.binomialSteps) || request.binomialSteps < 2 || request.binomialSteps > 2_000)) {
    return err({ code: "INVALID_INPUT", field: "binomialSteps", message: "Binomial steps must be an integer between 2 and 2,000." });
  }
  return ok(request);
}

export function validateOptionPosition(position: OptionPosition): Result<OptionPosition, OptionDomainError> {
  if (!position.legs.length) return err({ code: "INVALID_INPUT", field: "position", message: "An option position must contain at least one leg." });
  for (const leg of position.legs) {
    const invalid = invalidLegField(leg);
    if (invalid) return err({ code: "INVALID_INPUT", field: "position", message: invalid });
  }
  return ok(position);
}

function invalidLegField(leg: OptionLeg): string | null {
  if (!Number.isFinite(leg.strikePrice) || leg.strikePrice <= 0) return "Every strike price must be greater than zero.";
  if (!Number.isFinite(leg.premiumPerShare) || leg.premiumPerShare < 0) return "Every premium must be zero or greater.";
  if (!Number.isInteger(leg.contracts) || leg.contracts <= 0 || leg.contracts > 10_000) return "Contracts must be a positive integer no greater than 10,000.";
  if (!Number.isInteger(leg.contractMultiplier) || leg.contractMultiplier <= 0 || leg.contractMultiplier > 100_000) return "Contract multiplier must be a positive integer no greater than 100,000.";
  return null;
}
