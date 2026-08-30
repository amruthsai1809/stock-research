import { ok, type Result } from "@/src/shared/core/result";
import { positionExpirationProfitLoss } from "@/src/domain/options/payoff";
import { valuePosition } from "@/src/domain/options/riskProfile";
import type { OptionDomainError } from "@/src/domain/options/types";
import { createPosition } from "./analyzeOptionPosition";
import { timeToExpiryYears } from "./optionPolicies";
import type { OptionAnalysisInput, OptionApplicationError, ScenarioCurve } from "./types";

export function buildScenarioCurve(input: OptionAnalysisInput, impliedVolatilityPct: number, pointCount = 61): Result<ScenarioCurve, OptionApplicationError | OptionDomainError> {
  const position = createPosition(input);
  const selectedTime = timeToExpiryYears(input.targetDate, input.expirationDate);
  if (selectedTime == null) return { ok: false, error: { code: "INVALID_DATE", field: "targetDate", message: "Use a valid scenario date." } };
  const anchors = [input.currentSpotPrice, input.strikePrice, input.targetSpotPrice];
  const minimum = Math.max(0.01, Math.min(...anchors) * 0.5);
  const maximum = Math.max(...anchors) * 1.5;
  const count = Math.max(11, Math.min(201, Math.round(pointCount)));
  const context = { exerciseStyle: input.exerciseStyle, riskFreeRatePct: input.riskFreeRatePct, dividendYieldPct: input.dividendYieldPct, binomialSteps: 100 } as const;
  const targetVolatilityPct = Math.max(0.01, impliedVolatilityPct + input.volatilityShiftPct);
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const spotPrice = minimum + (maximum - minimum) * index / (count - 1);
    const selected = valuePosition(position, { spotPrice, timeToExpiryYears: selectedTime, impliedVolatilityPct: targetVolatilityPct }, context, input.currentSpotPrice);
    if (!selected.ok) return selected;
    points.push({ spotPrice, selectedDateProfitLossDollars: selected.value.profitLossDollars, expirationProfitLossDollars: positionExpirationProfitLoss(position, spotPrice) });
  }
  return ok({ points, selectedDate: input.targetDate, expirationDate: input.expirationDate, breakEvenPrice: input.kind === "call" ? input.strikePrice + input.premiumPerShare : input.strikePrice - input.premiumPerShare });
}
