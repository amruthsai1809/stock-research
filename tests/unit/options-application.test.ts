import { describe, expect, it } from "vitest";
import { analyzeOptionPosition } from "@/src/application/options/analyzeOptionPosition";
import { buildScenarioCurve } from "@/src/application/options/buildScenarioCurve";
import { buildScenarioSurface } from "@/src/application/options/buildScenarioSurface";
import { addCalendarDays, calendarDaysBetween, interpolateDate, parseDateOnly, timeToExpiryYears } from "@/src/application/options/optionPolicies";
import type { OptionAnalysisInput } from "@/src/application/options/types";
import { priceOption } from "@/src/domain/options/pricing/binomialAmerican";
import { isCurrentScenarioResponse, SCENARIO_WORKER_PROTOCOL_VERSION, type ScenarioWorkerResponse } from "@/src/features/options/worker/scenarioWorkerProtocol";

function input(): OptionAnalysisInput {
  const premium = priceOption({ kind: "call", exerciseStyle: "american", spotPrice: 100, strikePrice: 100, timeToExpiryYears: 90 / 365, impliedVolatilityPct: 30, riskFreeRatePct: 4.25, dividendYieldPct: 0, binomialSteps: 180 });
  if (!premium.ok) throw new Error(premium.error.message);
  return {
    kind: "call", exerciseStyle: "american", asOfDate: "2026-08-28", expirationDate: "2026-11-26",
    currentSpotPrice: 100, strikePrice: 100, premiumPerShare: premium.value, contracts: 1, contractMultiplier: 100,
    targetDate: "2026-09-27", targetSpotPrice: 110, volatilityShiftPct: 5, riskFreeRatePct: 4.25, dividendYieldPct: 0,
  };
}

describe("date-only option policies", () => {
  it("uses UTC calendar days without intraday ambiguity", () => {
    expect(parseDateOnly("2026-02-29")).toBeNull();
    expect(parseDateOnly("2028-02-29")).not.toBeNull();
    expect(calendarDaysBetween("2026-08-28", "2026-11-26")).toBe(90);
    expect(timeToExpiryYears("2026-08-28", "2026-11-26")).toBeCloseTo(90 / 365, 10);
    expect(addCalendarDays("2026-08-28", 30)).toBe("2026-09-27");
    expect(interpolateDate("2026-08-28", "2026-11-26", 0.5)).toBe("2026-10-12");
  });
});

describe("option analysis use case", () => {
  it("derives IV and produces internally reconciled scenario metrics", () => {
    const result = analyzeOptionPosition(input());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.impliedVolatilityPct).toBeCloseTo(30, 2);
    expect(result.value.targetVolatilityPct).toBeCloseTo(35, 2);
    expect(result.value.daysToExpiration).toBe(90);
    expect(result.value.targetDaysElapsed).toBe(30);
    expect(result.value.attribution.priceDollars + result.value.attribution.timeDollars + result.value.attribution.volatilityDollars).toBeCloseTo(result.value.attribution.totalDollars, 6);
  });

  it("returns clear date errors", () => {
    const before = analyzeOptionPosition({ ...input(), targetDate: "2026-08-01" });
    const expired = analyzeOptionPosition({ ...input(), expirationDate: "2026-08-28" });
    expect(before.ok).toBe(false);
    expect(expired.ok).toBe(false);
    if (!before.ok) expect(before.error.code).toBe("INVALID_DATE");
  });

  it("builds ordered, finite scenario curves and surfaces", () => {
    const curve = buildScenarioCurve(input(), 30, 31);
    const surface = buildScenarioSurface(input(), 30, 15, 7);
    expect(curve.ok && surface.ok).toBe(true);
    if (!curve.ok || !surface.ok) return;
    expect(curve.value.points).toHaveLength(31);
    expect(curve.value.points.every((point, index, values) => Number.isFinite(point.selectedDateProfitLossDollars) && (index === 0 || point.spotPrice > values[index - 1].spotPrice))).toBe(true);
    expect(surface.value.prices).toHaveLength(15);
    expect(surface.value.dates).toHaveLength(7);
    expect(surface.value.profitLossDollars).toHaveLength(7);
    expect(surface.value.profitLossDollars.every((row) => row.length === 15 && row.every(Number.isFinite))).toBe(true);
    expect(surface.value.minimumProfitLossDollars).toBeLessThanOrEqual(surface.value.maximumProfitLossDollars);
  });
});

describe("scenario worker protocol", () => {
  it("accepts only the latest versioned response", () => {
    const response: ScenarioWorkerResponse = { protocolVersion: SCENARIO_WORKER_PROTOCOL_VERSION, type: "SCENARIO_SURFACE_RESULT", requestId: 8, ok: false, error: { code: "INVALID_INPUT", message: "test" } };
    expect(isCurrentScenarioResponse(response, 8)).toBe(true);
    expect(isCurrentScenarioResponse(response, 9)).toBe(false);
  });
});
