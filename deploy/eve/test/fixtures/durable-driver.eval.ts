import { mock } from "bun:test";
import assert from "node:assert/strict";
import type { WorkflowStepToolContext } from "eve/tools";
import type { Batch } from "../../agent/lib/store.js";

let batch = {} as Batch;
let ticks = 0;
let waits = 0;
let rejectConflict = false;
let failFirst = false;
let classifications = 0;
const tokens: string[] = [];
mock.module("workflow", () => ({
  createHook({ token }: { token: string }) {
    assert.ok(token.endsWith(":call_new"), "adoption must not reuse the predecessor's hook");
    tokens.push(token);
    return Object.assign(new Promise<void>(() => {}), {
      async getConflict() {
        if (rejectConflict) {
          rejectConflict = false;
          throw Object.assign(new Error("already in use"), { name: "HookConflictError" });
        }
        return null;
      },
      [Symbol.dispose]() {},
    });
  },
  async sleep(ms: number) {
    assert.ok(ms > 0 && ms <= 300000, "durable wait stays within the station deadline");
    waits++;
  },
}));
mock.module("../../agent/lib/store.js", () => ({
  readState: async () => ({ state: { batch } }),
  saveState: async () => "mock-sha",
}));
mock.module("../../agent/lib/engine.js", () => ({
  tick: async () => {
    ticks++;
    if (ticks === 1 && failFirst) batch.status = "blocked";
    if (ticks === 3) batch.status = "slice-complete";
  },
}));
mock.module("../../agent/lib/triage.js", () => ({
  classifyStoredFailure: async ({
    workflowOwner,
    automatic,
  }: {
    workflowOwner: string;
    automatic: boolean;
  }) => {
    assert.equal(automatic, true);
    assert.equal(workflowOwner, batch.workflowOwner);
    assert.equal(batch.status, "blocked");
    classifications++;
    batch.status = "running";
    return { resumed: true };
  },
}));
const { runBatch } = await import("../../agent/lib/run-batch.js");
const ctx = { callId: "call_new" } as WorkflowStepToolContext;
for (const kind of ["cursor", "conflict", "ci", "deployment", "triage"] as const) {
  const start = Date.now();
  batch = {
    workflowOwner: "call_new",
    status: "running",
    startedAt: start,
    intakeHash: "intake",
    candidate: "a".repeat(40),
    attempts: { SELECT: 1 },
    manifest: { limits: { runSeconds: 7200, jobSeconds: 1200 } },
    active: {
      agentId: "bc-same",
      runId: "run-same",
      phase: "build",
      startedAt: start,
      base: "a".repeat(40),
      posted: true,
    },
  } as unknown as Batch;
  if (kind === "ci" || kind === "deployment") {
    batch.active = undefined;
    batch.pr = "https://github.com/owner/test/pull/1";
    batch.coverage = {
      ci: { app: "github-actions", checks: ["Check"], maxRepairs: 2 },
    } as Batch["coverage"];
    if (kind === "deployment")
      batch.automaticDeployment = { id: "deployment-same" } as Batch["automaticDeployment"];
  }
  ticks = waits = classifications = 0;
  failFirst = kind === "triage";
  rejectConflict = kind === "conflict";
  await runBatch(ctx);
  assert.equal(batch.status, "slice-complete");
  assert.equal(ticks, 3);
  assert.equal(waits, 1);
  assert.equal(classifications, kind === "triage" ? 1 : 0);
  assert.equal(batch.startedAt, start);
  assert.deepEqual(batch.attempts, { SELECT: 1 });
  if (batch.active) {
    assert.equal(batch.active.agentId, "bc-same");
    assert.equal(batch.active.runId, "run-same");
    assert.equal(batch.active.startedAt, start);
  }
}
batch.status = "running";
ticks = 0;
const obsolete = await runBatch({ callId: "call_old" } as WorkflowStepToolContext);
assert.equal(obsolete.status, "superseded", "normal handoff must not report an owner failure");
assert.equal(ticks, 0, "an obsolete workflow must not tick the engine");
assert.ok(tokens.length >= 4);
console.log(
  "Durable handoff, rejected conflicts, CI/deployment wakes and obsolete-owner guard passed.",
);
