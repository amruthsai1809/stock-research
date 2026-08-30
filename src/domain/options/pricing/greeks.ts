import { err, ok, type Result } from "@/src/shared/core/result";
import type { OptionDomainError, OptionGreeks, OptionPricingRequest } from "../types";
import { priceOption } from "./binomialAmerican";

export function calculateGreeks(request: OptionPricingRequest): Result<OptionGreeks, OptionDomainError> {
  const base = stableGreekPrice(request);
  if (!base.ok) return base;
  if (request.timeToExpiryYears === 0) return ok({ deltaPerShare: 0, gammaPerShare: 0, vegaPerVolatilityPoint: 0, thetaPerCalendarDay: 0, rhoPerRatePoint: 0 });

  const spotStep = Math.max(0.01, request.spotPrice * 0.01);
  const up = stableGreekPrice({ ...request, spotPrice: request.spotPrice + spotStep });
  const down = stableGreekPrice({ ...request, spotPrice: Math.max(0.0001, request.spotPrice - spotStep) });
  const volUp = stableGreekPrice({ ...request, impliedVolatilityPct: request.impliedVolatilityPct + 0.5 });
  const volDown = stableGreekPrice({ ...request, impliedVolatilityPct: Math.max(0.0001, request.impliedVolatilityPct - 0.5) });
  const tomorrow = stableGreekPrice({ ...request, timeToExpiryYears: Math.max(0, request.timeToExpiryYears - 1 / 365) });
  const rateUp = stableGreekPrice({ ...request, riskFreeRatePct: request.riskFreeRatePct + 0.5 });
  const rateDown = stableGreekPrice({ ...request, riskFreeRatePct: request.riskFreeRatePct - 0.5 });
  const results = [up, down, volUp, volDown, tomorrow, rateUp, rateDown];
  const failure = results.find((result) => !result.ok);
  if (failure && !failure.ok) return err(failure.error);
  if (!up.ok || !down.ok || !volUp.ok || !volDown.ok || !tomorrow.ok || !rateUp.ok || !rateDown.ok) {
    return err({ code: "NUMERICAL_FAILURE", message: "Greek calculation failed." });
  }

  const actualDownStep = request.spotPrice - Math.max(0.0001, request.spotPrice - spotStep);
  const centeredSpotStep = (spotStep + actualDownStep) / 2;
  const delta = (up.value - down.value) / (spotStep + actualDownStep);
  const gamma = (up.value - 2 * base.value + down.value) / (centeredSpotStep ** 2);
  return ok({
    deltaPerShare: delta,
    gammaPerShare: gamma,
    vegaPerVolatilityPoint: volUp.value - volDown.value,
    thetaPerCalendarDay: tomorrow.value - base.value,
    rhoPerRatePoint: rateUp.value - rateDown.value,
  });
}

/** Averaging adjacent CRR trees reduces even/odd lattice oscillation in finite differences. */
function stableGreekPrice(request: OptionPricingRequest): Result<number, OptionDomainError> {
  const first = priceOption(request);
  if (!first.ok || request.exerciseStyle === "european" || request.timeToExpiryYears === 0) return first;
  const steps = Math.min(2_000, (request.binomialSteps ?? 180) + 1);
  const second = priceOption({ ...request, binomialSteps: steps });
  if (!second.ok) return second;
  return ok((first.value + second.value) / 2);
}
