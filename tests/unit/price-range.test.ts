import { describe, expect, it } from "vitest";
import { priceRangeCutoff, selectPriceRange } from "@/src/domain/priceRange";
import type { PricePoint } from "@/src/domain/stock";

const point = (date: string): PricePoint => ({ date, open: 1, high: 1, low: 1, close: 1, adjustedClose: 1, volume: 1 });

describe("price ranges", () => {
  it("supports an explicit ten-year cutoff", () => {
    expect(priceRangeCutoff("2026-08-28", "10Y")).toBe("2016-08-28");
  });

  it("returns complete post-IPO history when the company is newer than the range", () => {
    const prices = [point("2021-07-28"), point("2026-08-28")];
    expect(selectPriceRange(prices, "10Y")).toEqual(prices);
  });

  it("excludes observations before the selected boundary", () => {
    const prices = [point("2016-08-27"), point("2016-08-28"), point("2026-08-28")];
    expect(selectPriceRange(prices, "10Y").map((item) => item.date)).toEqual(["2016-08-28", "2026-08-28"]);
  });
});
