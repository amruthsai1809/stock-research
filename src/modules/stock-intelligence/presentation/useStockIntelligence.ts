"use client";

import { useEffect, useMemo, useState } from "react";
import type { ResearchSignalRepository } from "@/src/application/ports/repositories";
import type { AnalyzedStock } from "@/src/domain/stock";
import { scoreIntelligenceUniverse } from "../domain/scoring";
import type { IntelligenceStrategyId, ResearchSignalDataset } from "../domain/types";

export function useStockIntelligence(stocks: AnalyzedStock[], repository: ResearchSignalRepository) {
  const [dataset, setDataset] = useState<ResearchSignalDataset | null>(null);
  const [strategy, setStrategy] = useState<IntelligenceStrategyId>("balanced");
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    repository.load().then((value) => { if (active) setDataset(value); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [repository]);

  const scores = useMemo(() => dataset ? scoreIntelligenceUniverse(stocks, dataset.signals, strategy) : [], [dataset, stocks, strategy]);
  const selected = scores.find((score) => score.symbol === selectedSymbol) ?? scores[0] ?? null;

  return { dataset, scores, selected, selectedSymbol, setSelectedSymbol, strategy, setStrategy, failed };
}
