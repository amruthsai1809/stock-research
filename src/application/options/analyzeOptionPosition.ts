import { err, ok, type Result } from "@/src/shared/core/result";
import { attributeOptionValueChange } from "@/src/domain/options/attribution";
import { priceOption } from "@/src/domain/options/pricing/binomialAmerican";
import { impliedVolatility } from "@/src/domain/options/pricing/impliedVolatility";
import { positionGreeks, valuePosition } from "@/src/domain/options/riskProfile";
import type { OptionPosition } from "@/src/domain/options/types";
import { calendarDaysBetween, timeToExpiryYears } from "./optionPolicies";
import type { OptionAnalysis, OptionAnalysisInput, OptionApplicationError } from "./types";

const ANALYSIS_STEPS = 180;

export function analyzeOptionPosition(input: OptionAnalysisInput): Result<OptionAnalysis, OptionApplicationError> {
  const dates = validateDates(input);
  if (!dates.ok) return dates;
  const position = createPosition(input);
  const pricingBase = {
    kind: input.kind,
    exerciseStyle: input.exerciseStyle,
    spotPrice: input.currentSpotPrice,
    strikePrice: input.strikePrice,
    timeToExpiryYears: dates.value.currentTime,
    riskFreeRatePct: input.riskFreeRatePct,
    dividendYieldPct: input.dividendYieldPct,
    binomialSteps: ANALYSIS_STEPS,
  } as const;
  const volatility = impliedVolatility({ ...pricingBase, premiumPerShare: input.premiumPerShare });
  if (!volatility.ok) return volatility;
  const targetVolatilityPct = Math.max(0.01, volatility.value + input.volatilityShiftPct);
  const context = { exerciseStyle: input.exerciseStyle, riskFreeRatePct: input.riskFreeRatePct, dividendYieldPct: input.dividendYieldPct, binomialSteps: ANALYSIS_STEPS } as const;
  const targetScenario = { spotPrice: input.targetSpotPrice, timeToExpiryYears: dates.value.targetTime, impliedVolatilityPct: targetVolatilityPct };
  const target = valuePosition(position, targetScenario, context, input.currentSpotPrice);
  if (!target.ok) return target;
  const greeks = positionGreeks(position, { spotPrice: input.currentSpotPrice, timeToExpiryYears: dates.value.currentTime, impliedVolatilityPct: volatility.value }, context);
  if (!greeks.ok) return greeks;

  const positionUnits = input.contracts * input.contractMultiplier;
  const stateValue = (state: { spotPrice: number; timeToExpiryYears: number; impliedVolatilityPct: number }) => {
    const result = priceOption({ ...pricingBase, ...state });
    return result.ok ? result.value : Number.NaN;
  };
  const attribution = attributeOptionValueChange(
    { spotPrice: input.currentSpotPrice, timeToExpiryYears: dates.value.currentTime, impliedVolatilityPct: volatility.value },
    targetScenario,
    stateValue,
    positionUnits,
  );
  if (![attribution.priceDollars, attribution.timeDollars, attribution.volatilityDollars, attribution.totalDollars].every(Number.isFinite)) {
    return err({ code: "NUMERICAL_FAILURE", message: "The scenario attribution could not be calculated for these inputs." });
  }

  const premiumPaidDollars = input.premiumPerShare * positionUnits;
  const breakEvenPrice = input.kind === "call" ? input.strikePrice + input.premiumPerShare : input.strikePrice - input.premiumPerShare;
  return ok({
    impliedVolatilityPct: volatility.value,
    targetVolatilityPct,
    daysToExpiration: dates.value.daysToExpiration,
    targetDaysElapsed: dates.value.targetDaysElapsed,
    targetTheoreticalValuePerShare: target.value.theoreticalValuePerShare,
    targetProfitLossDollars: target.value.profitLossDollars,
    targetReturnOnPremiumPct: target.value.returnOnPremiumPct,
    shareComparisonDollars: target.value.shareComparisonDollars,
    premiumPaidDollars,
    breakEvenPrice,
    maximumLossDollars: premiumPaidDollars,
    maximumProfitLabel: input.kind === "call" ? "Unlimited" : `$${Math.max(0, (input.strikePrice - input.premiumPerShare) * positionUnits).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
    currentGreeks: greeks.value,
    attribution,
  });
}

export function createPosition(input: OptionAnalysisInput): OptionPosition {
  return { legs: [{ kind: input.kind, direction: "long", strikePrice: input.strikePrice, premiumPerShare: input.premiumPerShare, contracts: input.contracts, contractMultiplier: input.contractMultiplier }] };
}

function validateDates(input: OptionAnalysisInput): Result<{ currentTime: number; targetTime: number; daysToExpiration: number; targetDaysElapsed: number }, OptionApplicationError> {
  const daysToExpiration = calendarDaysBetween(input.asOfDate, input.expirationDate);
  if (daysToExpiration == null) return err({ code: "INVALID_DATE", field: "expirationDate", message: "Use a valid contract expiration date." });
  if (daysToExpiration <= 0) return err({ code: "INVALID_DATE", field: "expirationDate", message: "Expiration must be after the end-of-day price date." });
  const targetDaysElapsed = calendarDaysBetween(input.asOfDate, input.targetDate);
  if (targetDaysElapsed == null) return err({ code: "INVALID_DATE", field: "targetDate", message: "Use a valid scenario date." });
  if (targetDaysElapsed < 0 || targetDaysElapsed > daysToExpiration) return err({ code: "INVALID_DATE", field: "targetDate", message: "Scenario date must be between the price date and expiration." });
  return ok({
    currentTime: timeToExpiryYears(input.asOfDate, input.expirationDate)!,
    targetTime: timeToExpiryYears(input.targetDate, input.expirationDate)!,
    daysToExpiration,
    targetDaysElapsed,
  });
}
