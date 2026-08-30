import { err, ok, type Result } from "@/src/shared/core/result";
import { valuePosition } from "@/src/domain/options/riskProfile";
import { createPosition } from "./analyzeOptionPosition";
import { interpolateDate, timeToExpiryYears } from "./optionPolicies";
import type { OptionAnalysisInput, OptionApplicationError, ScenarioSurface } from "./types";

export function buildScenarioSurface(input: OptionAnalysisInput, impliedVolatilityPct: number, priceCount = 21, dateCount = 11): Result<ScenarioSurface, OptionApplicationError> {
  if (!Number.isFinite(impliedVolatilityPct) || impliedVolatilityPct <= 0) return err({ code: "INVALID_INPUT", field: "impliedVolatilityPct", message: "A positive implied volatility is required." });
  const expirationTime = timeToExpiryYears(input.asOfDate, input.expirationDate);
  if (expirationTime == null || expirationTime <= 0) return err({ code: "INVALID_DATE", field: "expirationDate", message: "Expiration must be after the price date." });
  const position = createPosition(input);
  const context = { exerciseStyle: input.exerciseStyle, riskFreeRatePct: input.riskFreeRatePct, dividendYieldPct: input.dividendYieldPct, binomialSteps: 80 } as const;
  const prices = linspace(Math.max(0.01, Math.min(input.currentSpotPrice, input.strikePrice) * 0.65), Math.max(input.currentSpotPrice, input.strikePrice) * 1.35, priceCount);
  const resolvedDateCount = Math.max(3, dateCount);
  const dates = Array.from({ length: resolvedDateCount }, (_, index) => interpolateDate(input.asOfDate, input.expirationDate, index / (resolvedDateCount - 1)));
  const volatility = Math.max(0.01, impliedVolatilityPct + input.volatilityShiftPct);
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  const profitLossDollars: number[][] = [];
  for (const date of dates) {
    const remaining = timeToExpiryYears(date, input.expirationDate) ?? 0;
    const row: number[] = [];
    for (const spotPrice of prices) {
      const value = valuePosition(position, { spotPrice, timeToExpiryYears: remaining, impliedVolatilityPct: volatility }, context, input.currentSpotPrice);
      if (!value.ok) return value;
      row.push(value.value.profitLossDollars);
      minimum = Math.min(minimum, value.value.profitLossDollars);
      maximum = Math.max(maximum, value.value.profitLossDollars);
    }
    profitLossDollars.push(row);
  }
  return ok({ prices, dates, profitLossDollars, minimumProfitLossDollars: minimum, maximumProfitLossDollars: maximum });
}

function linspace(minimum: number, maximum: number, count: number): number[] {
  const size = Math.max(5, Math.min(51, Math.round(count)));
  return Array.from({ length: size }, (_, index) => minimum + (maximum - minimum) * index / (size - 1));
}
