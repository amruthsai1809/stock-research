export const product = {
  name: "Equity Lab",
  shortName: "Equity Lab",
  mark: "EL",
  description: "Evidence-first U.S. equity research",
  storage: {
    theme: "equity-lab-theme",
    watchlist: "equity-lab-watchlist",
  },
  legacyStorage: {
    theme: ["stock-research-theme", "tide-theme"],
    watchlist: ["stock-research-watchlist", "tide-watchlist"],
  },
} as const;
