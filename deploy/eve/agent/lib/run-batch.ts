import type { WorkflowStepToolContext } from "eve/tools";
import { createHook, FatalError, sleep } from "workflow";
import { runDeadline } from "./deployment.js";
import { tick } from "./engine.js";
import { readState } from "./store.js";
import { hookConflict, wakeToken } from "./wake.js";

/** Shared durable driver for intake and recovery. Side effects live only in steps. */
export async function runBatch(ctx: WorkflowStepToolContext) {
  "use workflow";
  for (let transition = 0; transition < 10000; transition++) {
    let snapshot = await advance(ctx);
    if (snapshot.status !== "running") return snapshot;
    if (!snapshot.token) continue;
    using done = createHook({ token: snapshot.token });
    let held = false;
    try {
      held = Boolean(await done.getConflict());
    } catch (error) {
      // Some hosted SDK paths reject a conflict rather than returning its run.
      if (!hookConflict(error)) throw error;
      held = true;
    }
    const registered = snapshot.token;
    snapshot = await advance(ctx);
    if (snapshot.status !== "running") return snapshot;
    if (snapshot.token !== registered) continue;
    // A callback is a wake, never acceptance. Periodic reconciliation also
    // covers missing callbacks, workflow dispatch ambiguity and partial CI.
    await (held ? sleep(snapshot.waitMs) : Promise.race([done, sleep(snapshot.waitMs)]));
  }
  throw new Error("Batch transition limit reached; checkpoint retained");
}
async function advance(ctx: WorkflowStepToolContext) {
  "use step";
  const before = await readState();
  if (before.state.batch?.workflowOwner !== ctx.callId)
    throw new FatalError("Workflow ownership changed");
  await tick();
  const b = (await readState()).state.batch!;
  const deadline = Math.min(
    runDeadline(b),
    b.active ? b.active.startedAt + b.manifest.limits.jobSeconds * 1000 : Infinity,
  );
  return {
    waitMs: Math.max(
      1,
      Math.min(
        b.retryAfter ? b.retryAfter - Date.now() : b.active ? 300000 : 60000,
        deadline - Date.now(),
      ),
    ),
    status: b.status,
    pr: b.pr,
    error: b.error,
    deadline,
    token: b.retryAfter
      ? wakeToken("retry", b.intakeHash, ctx.callId)
      : b.active
        ? wakeToken("cursor", b.active.agentId, ctx.callId)
        : b.automaticDeployment
          ? wakeToken("deployment", b.automaticDeployment.id, ctx.callId)
          : b.coverage?.ci && b.pr
            ? wakeToken("ci", `${b.intakeHash}:${b.candidate}`, ctx.callId)
            : undefined,
  };
}
