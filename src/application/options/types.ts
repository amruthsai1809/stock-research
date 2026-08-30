import type { DriverAttribution, ExerciseStyle, OptionDomainError, OptionKind, PositionGreeks } from "@/src/domain/options/types";

export type OptionAnalysisInput = {
  kind: OptionKind;
  exerciseStyle: ExerciseStyle;
  asOfDate: string;
  expirationDate: string;
  currentSpotPrice: number;
  strikePrice: number;
  premiumPerShare: number;
  contracts: number;
  contractMultiplier: number;
  targetDate: string;
  targetSpotPrice: number;
  volatilityShiftPct: number;
  riskFreeRatePct: number;
  dividendYieldPct: number;
};

export type OptionAnalysis = {
  impliedVolatilityPct: number;
  targetVolatilityPct: number;
  daysToExpiration: number;
  targetDaysElapsed: number;
  targetTheoreticalValuePerShare: number;
  targetProfitLossDollars: number;
  targetReturnOnPremiumPct: number;
  shareComparisonDollars: number;
  premiumPaidDollars: number;
  breakEvenPrice: number;
  maximumLossDollars: number;
  maximumProfitLabel: string;
  currentGreeks: PositionGreeks;
  attribution: DriverAttribution;
};

export type ScenarioCurvePoint = {
  spotPrice: number;
  selectedDateProfitLossDollars: number;
  expirationProfitLossDollars: number;
};

export type ScenarioCurve = {
  points: readonly ScenarioCurvePoint[];
  selectedDate: string;
  expirationDate: string;
  breakEvenPrice: number;
};

export type ScenarioSurface = {
  prices: readonly number[];
  dates: readonly string[];
  profitLossDollars: readonly (readonly number[])[];
  minimumProfitLossDollars: number;
  maximumProfitLossDollars: number;
};

export type OptionApplicationError = OptionDomainError | {
  code: "INVALID_DATE";
  field: "asOfDate" | "expirationDate" | "targetDate";
  message: string;
};
