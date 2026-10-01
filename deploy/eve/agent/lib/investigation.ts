import { cursor, type Run } from "./cursor.js";
import type { Batch } from "./store.js";
export type Investigation = {
  facts: string[];
  action: "reconcile" | "retry-build" | "retry-review" | "unresolved";
};
/** Only GET is exposed. Remote prose cannot authorize changes or acceptance. */
export async function investigateFailure(
  batch: Batch,
  read: <T>(path: string) => Promise<T> = (path) => cursor(path, "GET", undefined, 5000),
): Promise<Investigation> {
  const a = batch.active;
  if (!a) return { facts: ["No reserved identity to reconcile."], action: "unresolved" };
  try {
    const agent = await read<{ id: string; latestRunId?: string }>(`/agents/${a.agentId}`);
    if (agent.id !== a.agentId || !agent.latestRunId || (a.runId && a.runId !== agent.latestRunId))
      return { facts: ["Remote identity could not be verified."], action: "unresolved" };
    const run = await read<Run>(`/agents/${a.agentId}/runs/${agent.latestRunId}`);
    if (run.agentId !== a.agentId || run.id !== agent.latestRunId)
      return { facts: ["Remote run identity mismatch."], action: "unresolved" };
    if (!["CREATING", "RUNNING", "FINISHED", "ERROR", "EXPIRED"].includes(run.status))
      return { facts: ["Unsupported remote status."], action: "unresolved" };
    const facts = [`Verified reserved agent and run; phase=${a.phase}; status=${run.status}.`];
    if (["ERROR", "EXPIRED"].includes(run.status))
      return { facts, action: a.phase === "build" ? "retry-build" : "retry-review" };
    if (
      run.status === "FINISHED" &&
      a.phase !== "build" &&
      /did not return JSON|not valid JSON|Unexpected token/.test(batch.error ?? "")
    )
      return { facts, action: "retry-review" };
    // A lost launch response re-enters the engine using its existing identity.
    if (
      ["CREATING", "RUNNING", "FINISHED"].includes(run.status) &&
      batch.failure?.operation === "remote"
    )
      return { facts, action: "reconcile" };
    return { facts, action: "unresolved" };
  } catch {
    return { facts: ["Diagnostic reads did not establish a safe action."], action: "unresolved" };
  }
}
