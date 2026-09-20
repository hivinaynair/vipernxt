import { defineWorkflowTool, type WorkflowStepToolContext } from "eve/tools";
import { createHook, sleep } from "workflow";
import { z } from "zod";
import { runDeadline } from "../lib/deployment.js";
import { tick } from "../lib/engine.js";
import { readState } from "../lib/store.js";
import { classifyStoredFailure } from "../lib/triage.js";

export default defineWorkflowTool({
  description:
    "Record one advisory Jev classification from stored state. If Eve may resume, this tool continues the durable Cursor loop itself — do not call start_batch after it. Does not approve work, reset budgets, or invent scope.",
  inputSchema: z.object({}),
  execution: "background",
  async execute(_, ctx) {
    "use workflow";
    const result = await classify(ctx);
    if (!("resumed" in result) || result.resumed !== true) return result;
    for (let transition = 0; transition < 200; transition++) {
      let snapshot = await prepare(ctx);
      if (snapshot.status !== "running") return result;
      if (!snapshot.agentId) continue;
      using done = createHook({ token: `cursor:${snapshot.agentId}` });
      const hookHeld = await done.getConflict();
      const registeredAgent = snapshot.agentId;
      snapshot = await advance(ctx);
      if (snapshot.status !== "running") return result;
      if (snapshot.agentId !== registeredAgent) continue;
      const waitingAgent = snapshot.agentId;
      const deadline = new Date(snapshot.deadline!);
      await (hookHeld ? sleep(deadline) : Promise.race([done, sleep(deadline)]));
      snapshot = await advance(ctx);
      if (snapshot.status !== "running") return result;
      if (snapshot.agentId !== waitingAgent) continue;
      for (const delay of [5000, 15000]) {
        await sleep(delay);
        snapshot = await advance(ctx);
        if (snapshot.status !== "running" || snapshot.agentId !== waitingAgent) break;
      }
    }
    throw new Error("Batch transition limit reached");
  },
});

async function classify(ctx: WorkflowStepToolContext) {
  "use step";
  return classifyStoredFailure({ workflowOwner: ctx.callId });
}

async function advance(ctx: WorkflowStepToolContext) {
  "use step";
  const before = await readState();
  if (before.state.batch?.workflowOwner !== ctx.callId)
    throw new Error("Workflow ownership changed");
  await tick();
  const { state } = await readState();
  const b = state.batch!;
  return {
    status: b.status,
    agentId: b.active?.agentId,
    deadline: b.active
      ? Math.min(runDeadline(b), b.active.startedAt + b.manifest.limits.jobSeconds * 1000)
      : undefined,
    pr: b.pr,
    error: b.error,
  };
}

async function prepare(ctx: WorkflowStepToolContext) {
  "use step";
  const { state } = await readState();
  const b = state.batch;
  if (!b || b.workflowOwner !== ctx.callId) throw new Error("Workflow ownership changed");
  if (!b.active) await tick();
  const next = (await readState()).state.batch!;
  return {
    status: next.status,
    agentId: next.active?.agentId,
    deadline: next.active
      ? Math.min(runDeadline(next), next.active.startedAt + next.manifest.limits.jobSeconds * 1000)
      : undefined,
    pr: next.pr,
    error: next.error,
  };
}
