import { buildScenarioSurface } from "@/src/application/options/buildScenarioSurface";
import { SCENARIO_WORKER_PROTOCOL_VERSION, type ScenarioWorkerRequest, type ScenarioWorkerResponse } from "./scenarioWorkerProtocol";

type WorkerScope = {
  onmessage: ((event: MessageEvent<ScenarioWorkerRequest>) => void) | null;
  postMessage(message: ScenarioWorkerResponse): void;
};

const workerScope = self as unknown as WorkerScope;

workerScope.onmessage = (event) => {
  const request = event.data;
  if (request.protocolVersion !== SCENARIO_WORKER_PROTOCOL_VERSION || request.type !== "BUILD_SCENARIO_SURFACE") return;
  const result = buildScenarioSurface(request.input, request.impliedVolatilityPct);
  const response: ScenarioWorkerResponse = result.ok
    ? { protocolVersion: SCENARIO_WORKER_PROTOCOL_VERSION, type: "SCENARIO_SURFACE_RESULT", requestId: request.requestId, ok: true, surface: result.value }
    : { protocolVersion: SCENARIO_WORKER_PROTOCOL_VERSION, type: "SCENARIO_SURFACE_RESULT", requestId: request.requestId, ok: false, error: result.error };
  workerScope.postMessage(response);
};
