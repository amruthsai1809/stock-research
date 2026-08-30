export type OptionKind = "call" | "put";
export type OptionDirection = "long" | "short";
export type ExerciseStyle = "american" | "european";

export type OptionLeg = {
  kind: OptionKind;
  direction: OptionDirection;
  strikePrice: number;
  premiumPerShare: number;
  contracts: number;
  contractMultiplier: number;
};

export type OptionPosition = {
  legs: readonly OptionLeg[];
};

export type OptionPricingRequest = {
  kind: OptionKind;
  exerciseStyle: ExerciseStyle;
  spotPrice: number;
  strikePrice: number;
  timeToExpiryYears: number;
  impliedVolatilityPct: number;
  riskFreeRatePct: number;
  dividendYieldPct: number;
  binomialSteps?: number;
};

export type OptionGreeks = {
  /** Change in option value for a $1 move in the underlying. */
  deltaPerShare: number;
  /** Change in delta for a $1 move in the underlying. */
  gammaPerShare: number;
  /** Change in option value for a one percentage-point volatility move. */
  vegaPerVolatilityPoint: number;
  /** One-calendar-day change in option value, holding other inputs constant. */
  thetaPerCalendarDay: number;
  /** Change in option value for a one percentage-point rate move. */
  rhoPerRatePoint: number;
};

export type PositionGreeks = OptionGreeks & {
  deltaDollars: number;
  gammaDollars: number;
  vegaDollarsPerVolatilityPoint: number;
  thetaDollarsPerCalendarDay: number;
  rhoDollarsPerRatePoint: number;
};

export type OptionDomainErrorCode =
  | "INVALID_INPUT"
  | "INVALID_PROBABILITY"
  | "PREMIUM_OUTSIDE_BOUNDS"
  | "VOLATILITY_NOT_BRACKETED"
  | "NUMERICAL_FAILURE";

export type OptionDomainError = {
  code: OptionDomainErrorCode;
  message: string;
  field?: keyof OptionPricingRequest | "premiumPerShare" | "position";
};

export type ImpliedVolatilityRequest = Omit<OptionPricingRequest, "impliedVolatilityPct"> & {
  premiumPerShare: number;
};

export type PositionScenario = {
  spotPrice: number;
  timeToExpiryYears: number;
  impliedVolatilityPct: number;
};

export type PositionValuation = {
  theoreticalValuePerShare: number;
  profitLossDollars: number;
  returnOnPremiumPct: number;
  shareComparisonDollars: number;
};

export type DriverAttribution = {
  priceDollars: number;
  timeDollars: number;
  volatilityDollars: number;
  totalDollars: number;
};
