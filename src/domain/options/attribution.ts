import type { DriverAttribution } from "./types";

type Driver = "price" | "time" | "volatility";
type State = { spotPrice: number; timeToExpiryYears: number; impliedVolatilityPct: number };

/**
 * Exact three-factor Shapley attribution. The three components always add to
 * the modeled value change and do not depend on an arbitrary update order.
 */
export function attributeOptionValueChange(initial: State, target: State, value: (state: State) => number, positionUnits: number): DriverAttribution {
  const contributions: Record<Driver, number> = { price: 0, time: 0, volatility: 0 };
  const permutations: readonly (readonly Driver[])[] = [
    ["price", "time", "volatility"], ["price", "volatility", "time"],
    ["time", "price", "volatility"], ["time", "volatility", "price"],
    ["volatility", "price", "time"], ["volatility", "time", "price"],
  ];
  for (const order of permutations) {
    let state = initial;
    let previous = value(state);
    for (const driver of order) {
      state = applyDriver(state, target, driver);
      const next = value(state);
      contributions[driver] += (next - previous) / permutations.length;
      previous = next;
    }
  }
  const priceDollars = contributions.price * positionUnits;
  const timeDollars = contributions.time * positionUnits;
  const volatilityDollars = contributions.volatility * positionUnits;
  return { priceDollars, timeDollars, volatilityDollars, totalDollars: (value(target) - value(initial)) * positionUnits };
}

function applyDriver(state: State, target: State, driver: Driver): State {
  if (driver === "price") return { ...state, spotPrice: target.spotPrice };
  if (driver === "time") return { ...state, timeToExpiryYears: target.timeToExpiryYears };
  return { ...state, impliedVolatilityPct: target.impliedVolatilityPct };
}
