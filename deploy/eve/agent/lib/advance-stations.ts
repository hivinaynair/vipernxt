import { tick } from "./engine.js";
import { postReceipt } from "./receipt.js";
import { readState } from "./store.js";
import { classifyStoredFailure } from "./triage.js";
/** The durable step and fault simulations share this automatic recovery path. */
export async function advanceStations(
  workflowOwner: string,
  deps: {
    tick?: typeof tick;
    readState?: typeof readState;
    classify?: typeof classifyStoredFailure;
    postReceipt?: typeof postReceipt;
  } = {},
) {
  const read = deps.readState ?? readState;
  if ((await read()).state.batch?.workflowOwner !== workflowOwner) return;
  await (deps.tick ?? tick)();
  await recoverStations(workflowOwner, deps);
}

/** Separate durable invocation: triage must not share the engine's I/O budget. */
export async function recoverStations(
  workflowOwner: string,
  deps: {
    readState?: typeof readState;
    classify?: typeof classifyStoredFailure;
    postReceipt?: typeof postReceipt;
  } = {},
) {
  const read = deps.readState ?? readState;
  const b = (await read()).state.batch;
  if (b?.status !== "blocked" || b.workflowOwner !== workflowOwner) return;
  try {
    await (deps.classify ?? classifyStoredFailure)({ workflowOwner, automatic: true });
  } catch {
    const current = (await read()).state.batch;
    if (current?.status === "blocked" && current.workflowOwner === workflowOwner)
      await (deps.postReceipt ?? postReceipt)(current.issue, {
        event: "triage-unavailable",
        status: "blocked",
        attention: "owner",
        error: current.error,
      });
  }
}
