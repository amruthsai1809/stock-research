import { describe, expect, it } from "vitest";
import { searchCompanies, type CompanySearchRecord } from "@/src/domain/companySearch";

const companies: CompanySearchRecord[] = [
  { symbol: "MCHP", name: "Microchip Technology Inc.", sector: "Technology" },
  { symbol: "DUOL", name: "Duolingo Inc.", sector: "Consumer Discretionary" },
  { symbol: "MSFT", name: "Microsoft Corporation", sector: "Technology" },
  { symbol: "SPOT", name: "Spotify Technology S.A.", sector: "Consumer Discretionary" },
  { symbol: "NFLX", name: "Netflix Inc.", sector: "Consumer Discretionary" },
];

describe("company search ranking", () => {
  it("finds companies by partial company name without a ticker", () => {
    expect(searchCompanies(companies, "duol").map((company) => company.symbol)).toEqual(["DUOL"]);
    expect(searchCompanies(companies, "soft")[0]?.symbol).toBe("MSFT");
  });

  it("prioritizes exact tickers over broader name matches", () => {
    expect(searchCompanies(companies, "MCHP")[0]?.symbol).toBe("MCHP");
    expect(searchCompanies(companies, "micro").map((company) => company.symbol)).toEqual(["MCHP", "MSFT"]);
  });

  it("supports multi-word intent and restrained typo tolerance", () => {
    expect(searchCompanies(companies, "spotify tech")[0]?.symbol).toBe("SPOT");
    expect(searchCompanies(companies, "netflx")[0]?.symbol).toBe("NFLX");
  });
});
