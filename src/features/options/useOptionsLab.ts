"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { analyzeOptionPosition } from "@/src/application/options/analyzeOptionPosition";
import { buildScenarioCurve } from "@/src/application/options/buildScenarioCurve";
import { addCalendarDays, timeToExpiryYears } from "@/src/application/options/optionPolicies";
import type { OptionAnalysisInput, ScenarioSurface } from "@/src/application/options/types";
import { priceOption } from "@/src/domain/options/pricing/binomialAmerican";
import type { ExerciseStyle, OptionKind } from "@/src/domain/options/types";
import type { StockSummary } from "@/src/domain/stock";
import { isCurrentScenarioResponse, SCENARIO_WORKER_PROTOCOL_VERSION, type ScenarioWorkerRequest, type ScenarioWorkerResponse } from "./worker/scenarioWorkerProtocol";

export type OptionsLabState = {
  symbol: string;
  kind: OptionKind;
  exerciseStyle: ExerciseStyle;
  strikePrice: number;
  premiumPerShare: number;
  contracts: number;
  contractMultiplier: number;
  expirationDate: string;
  targetDate: string;
  targetSpotPrice: number;
  volatilityShiftPct: number;
  riskFreeRatePct: number;
  dividendYieldPct: number;
  advancedOpen: boolean;
};

type NumericField = { [Key in keyof OptionsLabState]: OptionsLabState[Key] extends number ? Key : never }[keyof OptionsLabState];
type Action =
  | { type: "RESET"; state: OptionsLabState }
  | { type: "SET_NUMBER"; field: NumericField; value: number }
  | { type: "SET_DATE"; field: "expirationDate" | "targetDate"; value: string }
  | { type: "SET_KIND"; value: OptionKind }
  | { type: "SET_STYLE"; value: ExerciseStyle }
  | { type: "TOGGLE_ADVANCED" };

type SurfaceState = { data: ScenarioSurface | null; status: "idle" | "updating" | "ready" | "error"; error: string | null };

export function useOptionsLab(stocks: readonly StockSummary[], initialSymbol: string) {
  const firstStock = stocks.find((stock) => stock.symbol === initialSymbol) ?? stocks[0];
  const [state, dispatch] = useReducer(reducer, firstStock, createInitialState);
  const stock = stocks.find((item) => item.symbol === state.symbol) ?? firstStock;
  const input = useMemo<OptionAnalysisInput>(() => ({
    kind: state.kind,
    exerciseStyle: state.exerciseStyle,
    asOfDate: stock.priceAsOf,
    expirationDate: state.expirationDate,
    currentSpotPrice: stock.latestPrice,
    strikePrice: state.strikePrice,
    premiumPerShare: state.premiumPerShare,
    contracts: state.contracts,
    contractMultiplier: state.contractMultiplier,
    targetDate: state.targetDate,
    targetSpotPrice: state.targetSpotPrice,
    volatilityShiftPct: state.volatilityShiftPct,
    riskFreeRatePct: state.riskFreeRatePct,
    dividendYieldPct: state.dividendYieldPct,
  }), [state, stock]);
  const analysisResult = useMemo(() => analyzeOptionPosition(input), [input]);
  const curveResult = useMemo(() => analysisResult.ok ? buildScenarioCurve(input, analysisResult.value.impliedVolatilityPct) : null, [analysisResult, input]);
  const [surface, setSurface] = useState<SurfaceState>({ data: null, status: "idle", error: null });
  const workerRef = useRef<Worker | null>(null);
  const latestRequestId = useRef(0);

  useEffect(() => {
    const worker = new Worker(new URL("./worker/scenarioWorker.ts", import.meta.url), { type: "module", name: "equity-lab-options-scenarios" });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<ScenarioWorkerResponse>) => {
      const response = event.data;
      if (!isCurrentScenarioResponse(response, latestRequestId.current)) return;
      if (response.ok) setSurface({ data: response.surface, status: "ready", error: null });
      else {
        const message = response.error.message;
        setSurface((current) => ({ data: current.data, status: "error", error: message }));
      }
    };
    worker.onerror = () => setSurface((current) => ({ data: current.data, status: "error", error: "The scenario grid could not be calculated." }));
    return () => { latestRequestId.current += 1; worker.terminate(); workerRef.current = null; };
  }, []);

  useEffect(() => {
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;
    if (!analysisResult.ok || !workerRef.current) return;
    setSurface((current) => ({ data: current.data, status: "updating", error: null }));
    const timer = window.setTimeout(() => {
      const request: ScenarioWorkerRequest = {
        protocolVersion: SCENARIO_WORKER_PROTOCOL_VERSION,
        type: "BUILD_SCENARIO_SURFACE",
        requestId,
        input,
        impliedVolatilityPct: analysisResult.value.impliedVolatilityPct,
      };
      workerRef.current?.postMessage(request);
    }, 90);
    return () => window.clearTimeout(timer);
  }, [analysisResult, input]);

  const selectSymbol = useCallback((symbol: string) => {
    const selected = stocks.find((item) => item.symbol === symbol);
    if (selected) dispatch({ type: "RESET", state: createInitialState(selected) });
  }, [stocks]);
  const reset = useCallback(() => dispatch({ type: "RESET", state: createInitialState(stock) }), [stock]);
  const setKind = useCallback((value: OptionKind) => {
    if (value === state.kind) return;
    const currentTime = timeToExpiryYears(stock.priceAsOf, state.expirationDate) ?? 90 / 365;
    const modelVolatility = analysisResult.ok ? analysisResult.value.impliedVolatilityPct : 35;
    const repriced = priceOption({
      kind: value,
      exerciseStyle: state.exerciseStyle,
      spotPrice: stock.latestPrice,
      strikePrice: state.strikePrice,
      timeToExpiryYears: currentTime,
      impliedVolatilityPct: modelVolatility,
      riskFreeRatePct: state.riskFreeRatePct,
      dividendYieldPct: state.dividendYieldPct,
      binomialSteps: 180,
    });
    dispatch({ type: "SET_KIND", value });
    if (repriced.ok) dispatch({ type: "SET_NUMBER", field: "premiumPerShare", value: roundTo(repriced.value, 2) });
  }, [analysisResult, state, stock]);

  return {
    state,
    stock,
    input,
    analysisResult,
    curveResult,
    surface,
    selectSymbol,
    reset,
    setNumber: (field: NumericField, value: number) => dispatch({ type: "SET_NUMBER", field, value }),
    setDate: (field: "expirationDate" | "targetDate", value: string) => dispatch({ type: "SET_DATE", field, value }),
    setKind,
    setExerciseStyle: (value: ExerciseStyle) => dispatch({ type: "SET_STYLE", value }),
    toggleAdvanced: () => dispatch({ type: "TOGGLE_ADVANCED" }),
  };
}

function reducer(state: OptionsLabState, action: Action): OptionsLabState {
  if (action.type === "RESET") return action.state;
  if (action.type === "SET_NUMBER") return { ...state, [action.field]: Number.isFinite(action.value) ? action.value : 0 };
  if (action.type === "SET_DATE") {
    if (action.field === "expirationDate" && state.targetDate > action.value) return { ...state, expirationDate: action.value, targetDate: action.value };
    return { ...state, [action.field]: action.value };
  }
  if (action.type === "SET_KIND") return { ...state, kind: action.value };
  if (action.type === "SET_STYLE") return { ...state, exerciseStyle: action.value };
  return { ...state, advancedOpen: !state.advancedOpen };
}

function createInitialState(stock: StockSummary): OptionsLabState {
  const spot = stock.latestPrice;
  const strike = nearestStrike(spot);
  const expirationDate = addCalendarDays(stock.priceAsOf, 90);
  const priced = priceOption({ kind: "call", exerciseStyle: "american", spotPrice: spot, strikePrice: strike, timeToExpiryYears: 90 / 365, impliedVolatilityPct: 35, riskFreeRatePct: 4.25, dividendYieldPct: 0, binomialSteps: 180 });
  return {
    symbol: stock.symbol,
    kind: "call",
    exerciseStyle: "american",
    strikePrice: strike,
    premiumPerShare: roundTo(priced.ok ? priced.value : spot * 0.05, 2),
    contracts: 1,
    contractMultiplier: 100,
    expirationDate,
    targetDate: addCalendarDays(stock.priceAsOf, 30),
    targetSpotPrice: roundTo(spot * 1.1, 2),
    volatilityShiftPct: 0,
    riskFreeRatePct: 4.25,
    dividendYieldPct: 0,
    advancedOpen: false,
  };
}

function nearestStrike(spotPrice: number): number {
  const interval = spotPrice < 25 ? 1 : spotPrice < 100 ? 2.5 : spotPrice < 500 ? 5 : 10;
  return Math.max(interval, Math.round(spotPrice / interval) * interval);
}

function roundTo(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}
