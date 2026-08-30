"use client";

import { useEffect, useMemo, useState } from "react";
import type { MarketRepository } from "@/src/application/ports/repositories";
import type { AnalyzedStock } from "@/src/domain/stock";

type DetailState = {
  stocks: AnalyzedStock[];
  loading: boolean;
  error: string | null;
};

type ResolvedDetailState = Omit<DetailState, "loading"> & { key: string };

export function useStockDetails(repository: MarketRepository, symbols: string[]): DetailState {
  const key = [...new Set(symbols.filter(Boolean).map((symbol) => symbol.toUpperCase()))].sort().join(",");
  const normalized = useMemo(() => key ? key.split(",") : [], [key]);
  const [state, setState] = useState<ResolvedDetailState>({ key: "", stocks: [], error: null });

  useEffect(() => {
    let active = true;
    if (!normalized.length) return () => { active = false; };
    Promise.all(normalized.map((symbol) => repository.loadStock(symbol)))
      .then((stocks) => { if (active) setState({ key, stocks, error: null }); })
      .catch((error: unknown) => {
        if (active) setState({ key, stocks: [], error: error instanceof Error ? error.message : "Price history could not be loaded." });
      });
    return () => { active = false; };
  }, [key, normalized, repository]);

  if (!normalized.length) return { stocks: [], loading: false, error: null };
  if (state.key !== key) return { stocks: [], loading: true, error: null };
  return { stocks: state.stocks, loading: false, error: state.error };
}

export function useStockDetail(repository: MarketRepository, symbol: string | undefined) {
  const state = useStockDetails(repository, symbol ? [symbol] : []);
  return { stock: state.stocks[0] ?? null, loading: state.loading, error: state.error };
}
