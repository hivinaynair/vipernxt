import type { WorkflowStepToolContext } from "eve/tools";
import { createHook, RetryableError, sleep } from "workflow";
import { recoverStations } from "./advance-stations.js";
import { runDeadline } from "./deployment.js";
import { tick } from "./engine.js";
import { consumeFault } from "./faults.js";
import { flushOwnerNotification } from "./notify-owner.js";
import { readState, saveState } from "./store.js";
import { hookConflict, wakeToken } from "./wake.js";

/** Shared durable driver for intake and recovery. Side effects live only in steps. */
export async function runBatch(ctx: WorkflowStepToolContext) {
  "use workflow";
  for (let transition = 0; transition < 10000; transition++) {
    let snapshot = await advance(ctx);
    if (snapshot.status === "blocked") {
      await recover(ctx);
      snapshot = await inspect(ctx);
    }
    if (snapshot.status !== "running") {
      if (["blocked", "paused"].includes(snapshot.status)) await flushOwnerNotification();
      return snapshot;
    }
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
    if (snapshot.status === "blocked") {
      await recover(ctx);
      snapshot = await inspect(ctx);
    }
    if (snapshot.status !== "running") {
      if (["blocked", "paused"].includes(snapshot.status)) await flushOwnerNotification();
      return snapshot;
    }
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
    return {
      status: "superseded" as const,
      waitMs: 0,
      token: undefined,
      pr: before.state.batch?.pr,
      error: undefined,
      deadline: Date.now(),
    };
  await tick();
  const after = await readState();
  const b = after.state.batch;
  if (
    b?.workflowOwner === ctx.callId &&
    b.status === "running" &&
    b.active &&
    !b.active.posted &&
    !after.state.lease
  ) {
    const expired = consumeFault(b, "stage-expired", 1);
    const replay = expired ?? consumeFault(b, "step-replay", 1);
    if (replay) {
      await saveState(after.state, after.sha);
      throw Object.assign(new RetryableError("Injected step failure after committed reservation"), {
        retryAfter: new Date(Date.now() + (expired ? 75000 : 10000)),
      });
    }
  }
  return snapshot(ctx);
}
async function recover(ctx: WorkflowStepToolContext) {
  "use step";
  await recoverStations(ctx.callId);
}
async function inspect(ctx: WorkflowStepToolContext) {
  "use step";
  return snapshot(ctx);
}
async function snapshot(ctx: WorkflowStepToolContext) {
  "use step";
  const after = (await readState()).state;
  const b = after.batch;
  if (!b || b.workflowOwner !== ctx.callId)
    return {
      status: "superseded" as const,
      waitMs: 0,
      token: undefined,
      pr: b?.pr,
      error: undefined,
      deadline: Date.now(),
    };
  // A concurrent transition may hold the lease. Keep the durable driver alive
  // until classification can claim it, instead of abandoning a blocked batch.
  const triagePending = b.status === "blocked" && (after.lease?.until ?? 0) > Date.now();
  const deadline = Math.min(
    runDeadline(b),
    b.active ? b.active.startedAt + b.manifest.limits.jobSeconds * 1000 : Infinity,
  );
  return {
    waitMs: Math.max(
      1,
      Math.min(
        triagePending
          ? (after.lease?.until ?? Date.now()) - Date.now()
          : b.retryAfter
            ? b.retryAfter - Date.now()
            : b.active
              ? 300000
              : 60000,
        triagePending ? 300000 : deadline - Date.now(),
      ),
    ),
    status: triagePending ? "running" : b.status,
    pr: b.pr,
    error: b.error,
    deadline,
    token: triagePending
      ? wakeToken("retry", b.intakeHash, ctx.callId)
      : b.retryAfter
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
