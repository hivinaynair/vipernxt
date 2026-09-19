import { defineWorkflowTool, type WorkflowStepToolContext } from "eve/tools";
import { createHook, sleep } from "workflow";
import { z } from "zod";
import { enabled, repository, required } from "../lib/config.js";
import { digest, intake, validateManifest } from "../lib/contract.js";
import { tick } from "../lib/engine.js";
import { file, github, head, type Issue } from "../lib/github.js";
import { verifyRuntime } from "../lib/runtime.js";
import { readState, saveState } from "../lib/store.js";
import { intakeIssueNumber } from "../lib/trust.js";
export default defineWorkflowTool({
  description:
    "Run the approved GitHub batch using durable Cursor completion waits. No repeated model polling.",
  inputSchema: z.object({}),
  execution: "background",
  async execute(_, ctx) {
    "use workflow";
    await register(ctx);
    // One workflow owns the batch. Each stage gets a hook registered before
    // launch and a deadline that survives redeploys and missed callbacks.
    for (let transition = 0; transition < 200; transition++) {
      let snapshot = await prepare(ctx);
      if (snapshot.status !== "running") return snapshot;
      if (!snapshot.agentId) continue;
      using done = createHook({ token: `cursor:${snapshot.agentId}` });
      if (await done.getConflict()) return { status: "another_workflow_owns_stage" };
      const registeredAgent = snapshot.agentId;
      snapshot = await advance(ctx); // Launch only after hook registration.
      if (snapshot.status !== "running") return snapshot;
      if (snapshot.agentId !== registeredAgent) continue;
      const waitingAgent = snapshot.agentId;
      const deadline = new Date(snapshot.deadline!);
      await Promise.race([done, sleep(deadline)]);
      // A stop hook may precede Cursor's terminal API status. Allow a small,
      // bounded settling window, then wait for this run's deadline.
      for (const delay of [0, 5000, 15000, 30000]) {
        if (delay) await sleep(delay);
        snapshot = await advance(ctx);
        if (snapshot.status !== "running" || snapshot.agentId !== waitingAgent) break;
      }
      if (snapshot.status !== "running") return snapshot;
      if (snapshot.agentId === waitingAgent) {
        await sleep(deadline);
        snapshot = await advance(ctx);
        if (snapshot.status !== "running") return snapshot;
      }
    }
    throw new Error("Batch transition limit reached");
  },
});

async function register(ctx: WorkflowStepToolContext) {
  "use step";
  if (!enabled())
    throw new Error("Factory dispatch disabled until deployment verification completes");
  const issueNumber = intakeIssueNumber(ctx.session.auth.current);
  if (!issueNumber) throw new Error("Execution requires an authorized factory label event");
  const issue = await github<Issue>(`/issues/${issueNumber}`);
  if (
    issue.pull_request ||
    issue.state !== "open" ||
    !issue.labels.some((l) => l.name === "factory")
  )
    throw new Error("Issue is not eligible");
  const source = intake(issue.body ?? "");
  const { state, sha } = await readState();
  if (state.batch) {
    if (
      state.batch.issue === issueNumber &&
      state.batch.intakeHash === digest(source) &&
      state.batch.workflowOwner === ctx.callId
    )
      return { status: state.batch.status };
    if (
      state.batch.issue === issueNumber &&
      state.batch.intakeHash === digest(source) &&
      state.batch.status === "blocked"
    ) {
      // A new authorized label event may resume the SAME reserved run.
      // Preserve identity, clocks, attempts and evidence; no budget reset.
      if (Date.now() >= state.batch.startedAt + state.batch.manifest.limits.runSeconds * 1000)
        throw new Error("Original batch budget expired");
      state.batch.workflowOwner = ctx.callId;
      state.batch.status = "running";
      state.batch.error = undefined;
      await saveState(state, sha);
      return { status: "resuming" };
    }
    throw new Error("Another batch is registered; archive it explicitly before starting another");
  }
  const manifest = validateManifest(
    JSON.parse((await file(source.manifest, source.commit)).text),
    repository(),
  );
  if (manifest.base !== (await head(required("FACTORY_BASE_BRANCH"))))
    throw new Error("Approved base differs from target branch head");
  const repo = await github<{ default_branch: string }>("");
  await verifyRuntime(
    manifest.specFiles,
    manifest.base,
    repo.default_branch,
    required("FACTORY_CALLBACK_AUDIENCE"),
    file,
  );
  // Every pinned artifact must exist in the actual worker base, not only in
  // a different manifest commit. A worker cannot silently lose requirements.
  for (const p of manifest.specFiles) {
    if ((await file(p, source.commit)).sha !== (await file(p, manifest.base)).sha)
      throw new Error(`Pinned artifact differs from execution base: ${p}`);
  }
  state.batch = {
    workflowOwner: ctx.callId,
    issue: issueNumber,
    intakeHash: digest(source),
    commit: source.commit,
    manifestPath: source.manifest,
    manifest,
    startedAt: Date.now(),
    status: "running",
    candidate: manifest.base,
    accepted: [],
    attempts: {},
    evidence: [],
  };
  await saveState(state, sha);
  return { status: "registered", slices: manifest.jobs.map((j) => ({ id: j.id, title: j.title })) };
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
      ? Math.min(
          b.startedAt + b.manifest.limits.runSeconds * 1000,
          b.active.startedAt + b.manifest.limits.jobSeconds * 1000,
        )
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
      ? Math.min(
          next.startedAt + next.manifest.limits.runSeconds * 1000,
          next.active.startedAt + next.manifest.limits.jobSeconds * 1000,
        )
      : undefined,
    pr: next.pr,
    error: next.error,
  };
}
