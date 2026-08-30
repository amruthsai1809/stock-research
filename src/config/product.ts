export const product = {
  name: "Equity Lab",
  shortName: "Equity Lab",
  mark: "EL",
  description: "Public-market analysis from end-of-day prices and official filings",
  storage: {
    theme: "equity-lab-theme",
    watchlist: "equity-lab-watchlist",
  },
  legacyStorage: {
    theme: ["stock-research-theme", "tide-theme"],
    watchlist: ["stock-research-watchlist", "tide-watchlist"],
  },
} as const;
