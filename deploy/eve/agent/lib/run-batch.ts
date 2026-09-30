import type { WorkflowStepToolContext } from "eve/tools";
import { createHook, sleep } from "workflow";
import { runDeadline } from "./deployment.js";
import { tick } from "./engine.js";
import { readState } from "./store.js";

/** Shared durable driver for intake and recovery. Side effects live only in steps. */
export async function runBatch(ctx: WorkflowStepToolContext) {
  "use workflow";
  for (let transition = 0; transition < 10000; transition++) {
    let snapshot = await advance(ctx);
    if (snapshot.status !== "running") return snapshot;
    if (!snapshot.token) continue;
    using done = createHook({ token: snapshot.token });
    const held = await done.getConflict();
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
    throw new Error("Workflow ownership changed");
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
      ? `retry:${b.intakeHash}`
      : b.active
        ? `cursor:${b.active.agentId}`
        : b.automaticDeployment
          ? `deployment:${b.automaticDeployment.id}`
          : b.coverage?.ci && b.pr
            ? `ci:${b.intakeHash}:${b.candidate}`
            : undefined,
  };
}
