export type AppView = "discover" | "dips" | "company" | "screener" | "compare" | "valuation" | "filings" | "portfolio" | "institutional" | "government";

export type NavigationItem = {
  id: AppView;
  label: string;
  shortLabel: string;
  glyph: string;
  section: "Research" | "Intelligence";
};

export const navigation: NavigationItem[] = [
  { id: "discover", label: "Discover", shortLabel: "Home", glyph: "⌂", section: "Research" },
  { id: "dips", label: "Dip Finder", shortLabel: "Dips", glyph: "↘", section: "Research" },
  { id: "screener", label: "Screener", shortLabel: "Screen", glyph: "⊞", section: "Research" },
  { id: "compare", label: "Compare", shortLabel: "Compare", glyph: "⇄", section: "Research" },
  { id: "valuation", label: "Valuation Lab", shortLabel: "Value", glyph: "◇", section: "Research" },
  { id: "filings", label: "Company filings", shortLabel: "SEC", glyph: "▤", section: "Research" },
  { id: "portfolio", label: "My Portfolio", shortLabel: "Portfolio", glyph: "◒", section: "Intelligence" },
  { id: "institutional", label: "13F Explorer", shortLabel: "13F", glyph: "◫", section: "Intelligence" },
  { id: "government", label: "Public officials", shortLabel: "Officials", glyph: "⌂", section: "Intelligence" },
];

const validViews = new Set<AppView>(navigation.map((item) => item.id).concat("company"));

export function readView(): AppView {
  if (typeof window === "undefined") return "discover";
  const value = new URLSearchParams(window.location.search).get("view") as AppView | null;
  return value && validViews.has(value) ? value : "discover";
}

export function writeView(view: AppView, symbol?: string, replace = false) {
  const url = new URL(window.location.href);
  if (view === "discover") url.searchParams.delete("view"); else url.searchParams.set("view", view);
  if (symbol) url.searchParams.set("symbol", symbol); else if (view !== "company") url.searchParams.delete("symbol");
  window.history[replace ? "replaceState" : "pushState"]({ view, symbol }, "", `${url.pathname}${url.search}${url.hash}`);
}

export function readSymbol(fallback = "AAPL") {
  if (typeof window === "undefined") return fallback;
  return new URLSearchParams(window.location.search).get("symbol")?.toUpperCase() || fallback;
}
