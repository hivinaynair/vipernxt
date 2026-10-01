import { createGateway } from "ai";
import { repository, required } from "./config.js";
import type { Manifest } from "./contract.js";
import { CursorError, type cursor } from "./cursor.js";
import type { github } from "./github.js";
import type { Evaluator, evaluateFailure } from "./jev.js";
import { simulationIntake } from "./simulation.js";
import type { Batch } from "./store.js";
export type Fault = NonNullable<Manifest["faults"]>["cases"][number];
export function assertFaultIntake(manifest: Manifest) {
  if (!manifest.faults) return;
  if (!manifest.simulation || process.env.FACTORY_FAULT_CAMPAIGN !== manifest.faults.campaign)
    throw new Error("Fault intake requires an explicitly enabled simulation campaign");
  simulationIntake(
    manifest,
    repository(),
    process.env.FACTORY_SIMULATION_REPO,
    required("FACTORY_BASE_BRANCH"),
  );
}
export function consumeFault(b: Batch, name: Fault, limit: number) {
  if (
    !b.manifest.faults?.cases.includes(name) ||
    !b.manifest.simulation ||
    process.env.FACTORY_FAULT_CAMPAIGN !== b.manifest.faults.campaign
  )
    return undefined;
  assertFaultIntake(b.manifest);
  const count = b.faultLedger?.[name]?.count ?? 0;
  if (count >= limit) return undefined;
  const entry: NonNullable<Batch["faultLedger"]>[string] = {
    count: count + 1,
    at: Date.now(),
    agentId: b.active?.agentId,
    runId: b.active?.runId,
    originalStartedAt: b.active?.startedAt,
    requestId: b.automaticDeployment?.id,
    outcome: "armed",
  };
  b.faultLedger = { ...b.faultLedger, [name]: entry };
  return entry;
}
export function faultCursor(
  b: Batch,
  checkpoint: () => Promise<unknown>,
  request: typeof cursor,
): typeof cursor {
  return async <T>(
    path: string,
    method = "GET",
    body?: unknown,
    timeoutMs?: number,
  ): Promise<T> => {
    // A deliberately invalid GET token cannot mutate or rotate real credentials.
    const denied = method === "GET" ? consumeFault(b, "cursor-auth-denied", 1) : undefined;
    if (denied) {
      await checkpoint();
      const response = await fetch(`https://api.cursor.com/v1${path}`, {
        headers: {
          Authorization: "Bearer invalid-scoped-fault-probe",
        },
        signal: AbortSignal.timeout(10000),
        redirect: "error",
      });
      denied.providerStatus = response.status;
      denied.outcome = "actual-invalid-auth-response";
      throw new CursorError(
        response.status >= 400 ? response.status : 500,
        "Scoped authentication fault probe",
      );
    }
    const lost =
      path === "/agents" && method === "POST"
        ? consumeFault(b, "launch-response-lost", 1)
        : undefined;
    // Only fail reads AFTER a launch, not the pre-launch 404 lookup.
    const launched = b.active?.posted || Boolean(b.faultLedger?.["launch-response-lost"]?.runId);
    const unavailable =
      method === "GET" && launched ? consumeFault(b, "jev-unavailable", 1) : undefined;
    const readFailure =
      method === "GET" && launched
        ? consumeFault(
            b,
            "cursor-read-failures",
            b.manifest.faults?.cases.includes("launch-response-lost") ? 3 : 4,
          )
        : undefined;
    if (lost || readFailure || unavailable) await checkpoint();
    const result = await request<T>(path, method, body, timeoutMs);
    if (lost) {
      const created = result as { agent?: { id?: string }; run?: { id?: string } };
      lost.runId = created.run?.id;
      lost.outcome = "actual-launch-reply-discarded";
      throw new TypeError("fetch failed: Cursor launch reply deliberately discarded");
    }
    if (readFailure) {
      readFailure.outcome = "actual-read-reply-discarded";
      throw new CursorError(503, "Scoped read-response fault");
    }
    if (unavailable) {
      unavailable.outcome = "actual-read-reply-withheld-for-diagnostic-trial";
      throw new Error("Remote result unavailable; diagnostic reconciliation required");
    }
    return result;
  };
}
export function faultDeploymentRequest(
  b: Batch,
  checkpoint: () => Promise<unknown>,
  request: typeof github,
): typeof github {
  return async <T>(path: string, method = "GET", body?: unknown): Promise<T> => {
    const fault =
      method === "POST" && path.endsWith("/dispatches")
        ? consumeFault(b, "staging-response-lost", 1)
        : undefined;
    if (fault) await checkpoint();
    const result = await request<T>(path, method, body);
    if (fault) {
      fault.outcome = "actual-dispatch-reply-discarded";
      throw new TypeError("fetch failed: staging dispatch reply deliberately discarded");
    }
    return result;
  };
}
export function faultEvaluator(
  b: Batch,
  checkpoint: () => Promise<unknown>,
  evaluate: typeof evaluateFailure,
): Evaluator {
  return async (failure) => {
    const fault = consumeFault(b, "jev-unavailable", 3);
    if (!fault) return evaluate(failure);
    await checkpoint();
    try {
      // This sends a real request with an invalid test key; production secrets
      // remain untouched. The default evaluator's 10s timeout still applies.
      return await evaluate(
        failure,
        createGateway({
          apiKey: "vck_live_fault_probe_invalid_000000000000000000000000",
        }).evaluationModel("typesafe-ai/jev"),
      );
    } catch (error) {
      fault.outcome = "actual-evaluator-error";
      const e = error as { statusCode?: number; cause?: { statusCode?: number } };
      fault.providerStatus = e.statusCode ?? e.cause?.statusCode;
      throw error;
    }
  };
}
