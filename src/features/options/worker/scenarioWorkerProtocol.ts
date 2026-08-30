import type { OptionAnalysisInput, OptionApplicationError, ScenarioSurface } from "@/src/application/options/types";

export const SCENARIO_WORKER_PROTOCOL_VERSION = 1 as const;

export type ScenarioWorkerRequest = {
  protocolVersion: typeof SCENARIO_WORKER_PROTOCOL_VERSION;
  type: "BUILD_SCENARIO_SURFACE";
  requestId: number;
  input: OptionAnalysisInput;
  impliedVolatilityPct: number;
};

export type ScenarioWorkerResponse = {
  protocolVersion: typeof SCENARIO_WORKER_PROTOCOL_VERSION;
  type: "SCENARIO_SURFACE_RESULT";
  requestId: number;
} & (
  | { ok: true; surface: ScenarioSurface }
  | { ok: false; error: OptionApplicationError }
);

export function isCurrentScenarioResponse(response: ScenarioWorkerResponse, latestRequestId: number): boolean {
  return response.protocolVersion === SCENARIO_WORKER_PROTOCOL_VERSION && response.requestId === latestRequestId;
}
