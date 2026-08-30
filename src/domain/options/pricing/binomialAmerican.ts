import { err, ok, type Result } from "@/src/shared/core/result";
import { intrinsicValuePerShare } from "../payoff";
import type { OptionDomainError, OptionPricingRequest } from "../types";
import { validatePricingRequest } from "../validation";
import { blackScholesPrice } from "./blackScholes";

export function priceOption(request: OptionPricingRequest): Result<number, OptionDomainError> {
  return request.exerciseStyle === "european" ? blackScholesPrice(request) : binomialOptionPrice(request);
}

export function binomialOptionPrice(request: OptionPricingRequest): Result<number, OptionDomainError> {
  const validation = validatePricingRequest(request);
  if (!validation.ok) return validation;
  const { spotPrice: spot, strikePrice: strike, timeToExpiryYears: time, kind } = request;
  if (time === 0) return ok(intrinsicValuePerShare(kind, spot, strike));
  if (request.impliedVolatilityPct <= 0) return deterministicAmericanValue(request);

  const steps = request.binomialSteps ?? 180;
  const dt = time / steps;
  const sigma = request.impliedVolatilityPct / 100;
  const rate = request.riskFreeRatePct / 100;
  const dividend = request.dividendYieldPct / 100;
  const up = Math.exp(sigma * Math.sqrt(dt));
  const down = 1 / up;
  const growth = Math.exp((rate - dividend) * dt);
  const probabilityUp = (growth - down) / (up - down);
  if (!Number.isFinite(probabilityUp) || probabilityUp < 0 || probabilityUp > 1) {
    return err({ code: "INVALID_PROBABILITY", message: "The selected model inputs do not produce a valid binomial probability." });
  }

  const discount = Math.exp(-rate * dt);
  const values = new Float64Array(steps + 1);
  for (let index = 0; index <= steps; index += 1) {
    const terminalSpot = spot * up ** (steps - index) * down ** index;
    values[index] = intrinsicValuePerShare(kind, terminalSpot, strike);
  }

  for (let step = steps - 1; step >= 0; step -= 1) {
    for (let index = 0; index <= step; index += 1) {
      const continuation = discount * (probabilityUp * values[index] + (1 - probabilityUp) * values[index + 1]);
      const nodeSpot = spot * up ** (step - index) * down ** index;
      values[index] = Math.max(continuation, intrinsicValuePerShare(kind, nodeSpot, strike));
    }
  }
  if (!Number.isFinite(values[0])) return err({ code: "NUMERICAL_FAILURE", message: "Binomial pricing did not produce a finite value." });
  return ok(values[0]);
}

function deterministicAmericanValue(request: OptionPricingRequest): Result<number, OptionDomainError> {
  const steps = request.binomialSteps ?? 180;
  const rate = request.riskFreeRatePct / 100;
  const dividend = request.dividendYieldPct / 100;
  let best = intrinsicValuePerShare(request.kind, request.spotPrice, request.strikePrice);
  for (let step = 1; step <= steps; step += 1) {
    const time = request.timeToExpiryYears * step / steps;
    const futureSpot = request.spotPrice * Math.exp((rate - dividend) * time);
    const discountedExercise = intrinsicValuePerShare(request.kind, futureSpot, request.strikePrice) * Math.exp(-rate * time);
    best = Math.max(best, discountedExercise);
  }
  return ok(best);
}
