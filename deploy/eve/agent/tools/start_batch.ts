import { defineWorkflowTool, type WorkflowStepToolContext } from "eve/tools";
import { createHook, sleep } from "workflow";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { enabled, repository, required } from "../lib/config.js";
import { digest, intake, validateManifest } from "../lib/contract.js";
import { coverageSchema, validateCoverage } from "../lib/coverage.js";
import { deploymentReceipt, runDeadline, verifyDeployment } from "../lib/deployment.js";
import { tick } from "../lib/engine.js";
import { file, github, head, type Issue, isAncestor } from "../lib/github.js";
import { assertApprovedIntake } from "../lib/intake.js";
import { verifyRuntime } from "../lib/runtime.js";
import { readState, saveState } from "../lib/store.js";
import { intakeIssueNumber } from "../lib/trust.js";
export default defineWorkflowTool({
  description:
    "Run the approved GitHub batch or resume draft-PR delivery for deployed acceptance using an operator-approved factory-deployment receipt and durable Cursor waits. No repeated model polling.",
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
      state.batch.status === "review" &&
      !state.batch.deployment
    ) {
      if (state.batch.integratedReview?.commit !== state.batch.candidate || !state.batch.pr)
        throw new Error("Integrated acceptance and draft PR required");
      state.batch.deployment = {
        ...(await verifyDeployment(state.batch, deploymentReceipt(issue.body ?? ""))),
        startedAt: Date.now(),
      };
      state.batch.workflowOwner = ctx.callId;
      state.batch.status = "running";
      await saveState(state, sha);
      return { status: "deployed-acceptance-authorized" };
    }
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
      if (Date.now() >= runDeadline(state.batch)) throw new Error("Original batch budget expired");
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
  await assertApprovedIntake({
    intake: source.commit,
    base: manifest.base,
    targetHead: await head(required("FACTORY_BASE_BRANCH")),
    isAncestor,
  });
  const repo = await github<{ default_branch: string }>("");
  await verifyRuntime(
    manifest.specFiles,
    source.commit,
    repo.default_branch,
    required("FACTORY_CALLBACK_AUDIENCE"),
    file,
  );
  // Workers start from the intake commit so pinned catalogs exist in the tree.
  // manifest.base may be an earlier runtime pin; do not require identical blobs.
  for (const p of manifest.specFiles) await file(p, source.commit);
  const catalog = coverageSchema.parse(
    JSON.parse((await file(manifest.coverageFile, source.commit)).text),
  );
  if (!manifest.specFiles.includes(catalog.spineFile))
    throw new Error("Journey spine must be pinned");
  const coverage = validateCoverage(
    catalog,
    manifest,
    parseYaml((await file(catalog.spineFile, source.commit)).text),
  );
  state.batch = {
    workflowOwner: ctx.callId,
    issue: issueNumber,
    intakeHash: digest(source),
    commit: source.commit,
    manifestPath: source.manifest,
    manifest,
    coverage,
    startedAt: Date.now(),
    status: "running",
    candidate: source.commit,
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
