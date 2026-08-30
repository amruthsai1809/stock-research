import type { OptionKind, OptionLeg, OptionPosition } from "./types";

export function intrinsicValuePerShare(kind: OptionKind, spotPrice: number, strikePrice: number): number {
  return kind === "call" ? Math.max(spotPrice - strikePrice, 0) : Math.max(strikePrice - spotPrice, 0);
}

export function legExpirationProfitLoss(leg: OptionLeg, spotPrice: number): number {
  const value = intrinsicValuePerShare(leg.kind, spotPrice, leg.strikePrice);
  const direction = leg.direction === "long" ? 1 : -1;
  return (value - leg.premiumPerShare) * leg.contractMultiplier * leg.contracts * direction;
}

export function positionExpirationProfitLoss(position: OptionPosition, spotPrice: number): number {
  return position.legs.reduce((total, leg) => total + legExpirationProfitLoss(leg, spotPrice), 0);
}

export function capitalAtRisk(position: OptionPosition): number {
  return position.legs.reduce((total, leg) => {
    const direction = leg.direction === "long" ? 1 : -1;
    return total + leg.premiumPerShare * leg.contractMultiplier * leg.contracts * direction;
  }, 0);
}
