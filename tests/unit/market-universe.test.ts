import { describe, expect, it } from "vitest";
import { isEligibleSecurity, symbolSlug, universePolicy } from "../../scripts/market/universe.mjs";

describe("market universe policy", () => {
  it("encodes the approved coverage contract", () => {
    expect(universePolicy.minimumMarketCap).toBe(1_000_000_000);
    expect(universePolicy.exchanges).toEqual(["Nasdaq", "NYSE", "NYSE American"]);
    expect(universePolicy.securityTypes).toEqual(["common-stock", "adr"]);
    expect(universePolicy.historyYears).toBe(10);
  });

  it.each([
    ["Duolingo Inc. Class A Common Stock", true],
    ["Advance Auto Parts Inc.", true],
    ["Arm Holdings plc American Depositary Shares", true],
    ["Aegon Ltd. New York Registry Shares", true],
    ["IRSA Global Depositary Shares representing Common Stock", true],
    ["Example Corp. Series A Preferred Stock", false],
    ["Example Corp. Depositary Shares representing Preferred Stock", false],
    ["Example Acquisition Corp. Units", false],
    ["Example Income Fund Common Stock", false],
    ["Example 6.25% Senior Notes due 2035", false],
    ["Example Corp. Warrants", false],
    ["WaFd Inc. Depositary Shares", false],
    ["BlackRock Capital Allocation Term Trust Common Shares of Beneficial Interest", false],
    ["Calamos Strategic Total Return Common Stock", false],
    ["General American Investors Inc. Common Stock", false],
    ["ASA Gold and Precious Metals Limited", false],
  ])("classifies %s", (name, expected) => {
    expect(isEligibleSecurity(name)).toBe(expected);
  });

  it("distinguishes finance vehicles from operating real-estate trusts", () => {
    expect(isEligibleSecurity("FS Credit Opportunities Corp. Common Stock", { sector: "Finance", industry: "Trusts Except Educational Religious and Charitable" })).toBe(false);
    expect(isEligibleSecurity("Federal Realty Investment Trust Common Stock", { sector: "Real Estate", industry: "Real Estate Investment Trusts" })).toBe(true);
  });

  it("creates stable Cloudflare-safe filenames", () => {
    expect(symbolSlug("BRK.B")).toBe("brk-b");
    expect(symbolSlug(" duol ")).toBe("duol");
  });
});
