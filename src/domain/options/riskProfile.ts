import { err, ok, type Result } from "@/src/shared/core/result";
import { capitalAtRisk } from "./payoff";
import { priceOption } from "./pricing/binomialAmerican";
import { calculateGreeks } from "./pricing/greeks";
import type { ExerciseStyle, OptionDomainError, OptionPosition, PositionGreeks, PositionScenario, PositionValuation } from "./types";
import { validateOptionPosition } from "./validation";

export type PositionPricingContext = {
  exerciseStyle: ExerciseStyle;
  riskFreeRatePct: number;
  dividendYieldPct: number;
  binomialSteps?: number;
};

export function valuePosition(position: OptionPosition, scenario: PositionScenario, context: PositionPricingContext, initialSpotPrice: number): Result<PositionValuation, OptionDomainError> {
  const validation = validateOptionPosition(position);
  if (!validation.ok) return validation;
  let theoreticalPositionValue = 0;
  let profitLossDollars = 0;
  for (const leg of position.legs) {
    const price = priceOption({
      kind: leg.kind,
      exerciseStyle: context.exerciseStyle,
      spotPrice: scenario.spotPrice,
      strikePrice: leg.strikePrice,
      timeToExpiryYears: scenario.timeToExpiryYears,
      impliedVolatilityPct: scenario.impliedVolatilityPct,
      riskFreeRatePct: context.riskFreeRatePct,
      dividendYieldPct: context.dividendYieldPct,
      binomialSteps: context.binomialSteps,
    });
    if (!price.ok) return price;
    const direction = leg.direction === "long" ? 1 : -1;
    const units = leg.contractMultiplier * leg.contracts * direction;
    theoreticalPositionValue += price.value * units;
    profitLossDollars += (price.value - leg.premiumPerShare) * units;
  }
  const premium = capitalAtRisk(position);
  const equivalentShares = position.legs.reduce((total, leg) => total + leg.contractMultiplier * leg.contracts * (leg.direction === "long" ? 1 : -1), 0);
  return ok({
    theoreticalValuePerShare: theoreticalPositionValue / Math.max(1, Math.abs(equivalentShares)),
    profitLossDollars,
    returnOnPremiumPct: premium === 0 ? 0 : profitLossDollars / Math.abs(premium) * 100,
    shareComparisonDollars: (scenario.spotPrice - initialSpotPrice) * equivalentShares,
  });
}

export function positionGreeks(position: OptionPosition, scenario: PositionScenario, context: PositionPricingContext): Result<PositionGreeks, OptionDomainError> {
  const leg = position.legs[0];
  if (!leg || position.legs.length !== 1) return err({ code: "INVALID_INPUT", field: "position", message: "Aggregate Greeks currently require exactly one option leg." });
  const greeks = calculateGreeks({ ...context, ...scenario, kind: leg.kind, strikePrice: leg.strikePrice });
  if (!greeks.ok) return greeks;
  const signedUnits = leg.contractMultiplier * leg.contracts * (leg.direction === "long" ? 1 : -1);
  return ok({
    ...greeks.value,
    deltaDollars: greeks.value.deltaPerShare * signedUnits,
    gammaDollars: greeks.value.gammaPerShare * signedUnits,
    vegaDollarsPerVolatilityPoint: greeks.value.vegaPerVolatilityPoint * signedUnits,
    thetaDollarsPerCalendarDay: greeks.value.thetaPerCalendarDay * signedUnits,
    rhoDollarsPerRatePoint: greeks.value.rhoPerRatePoint * signedUnits,
  });
}
