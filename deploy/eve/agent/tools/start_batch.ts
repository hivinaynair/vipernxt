import { defineWorkflowTool, type WorkflowStepToolContext } from "eve/tools";
import { createHook, sleep } from "workflow";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { repository, required } from "../lib/config.js";
import { digest, intake, validateManifest } from "../lib/contract.js";
import { coverageSchema, validateCoverage } from "../lib/coverage.js";
import { deploymentReceipt, runDeadline, verifyDeployment } from "../lib/deployment.js";
import { tick } from "../lib/engine.js";
import { file, github, head, type Issue, isAncestor } from "../lib/github.js";
import { assertApprovedIntake } from "../lib/intake.js";
import { postReceipt } from "../lib/receipt.js";
import { verifyRuntime } from "../lib/runtime.js";
import {
  archiveBatch,
  isAuthorizedResume,
  readState,
  type State,
  saveState,
} from "../lib/store.js";
import { intakeIssueNumber } from "../lib/trust.js";

export default defineWorkflowTool({
  description:
    "Run the approved GitHub batch or resume draft-PR delivery for deployed acceptance using an operator-approved factory-deployment receipt and durable Cursor waits. Deadline or callback is enough; the hook body cannot accept a slice.",
  inputSchema: z.object({}),
  execution: "background",
  async execute(_, ctx) {
    "use workflow";
    await register(ctx);
    // Hook is a faster wake. Deadline is a complete wake. Either one is enough.
    for (let transition = 0; transition < 200; transition++) {
      let snapshot = await prepare(ctx);
      if (snapshot.status !== "running") return snapshot;
      if (!snapshot.agentId) continue;
      using done = createHook({ token: `cursor:${snapshot.agentId}` });
      if (await done.getConflict()) return { status: "another_workflow_owns_stage" };
      const registeredAgent = snapshot.agentId;
      snapshot = await advance(ctx);
      if (snapshot.status !== "running") return snapshot;
      if (snapshot.agentId !== registeredAgent) continue;
      const waitingAgent = snapshot.agentId;
      const deadline = new Date(snapshot.deadline!);
      await Promise.race([done, sleep(deadline)]);
      snapshot = await advance(ctx);
      if (snapshot.status !== "running") return snapshot;
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

async function failRegister(
  state: State,
  sha: string | undefined,
  issueNumber: number,
  source: { commit?: string; manifest?: string } | undefined,
  error: unknown,
): Promise<never> {
  "use step";
  const message =
    error instanceof Error ? error.message.slice(0, 500) : "Factory registration failed";
  state.lastFailure = {
    at: Date.now(),
    issue: issueNumber,
    stage: "dispatch",
    error: message,
    commit: source?.commit,
    manifestPath: source?.manifest,
  };
  await saveState(state, sha);
  await postReceipt(issueNumber, {
    event: "blocked",
    status: "blocked",
    error: message,
    attention: "owner",
  });
  throw error instanceof Error ? error : new Error(message);
}

async function register(ctx: WorkflowStepToolContext) {
  "use step";
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
      await postReceipt(issueNumber, {
        event: "deployed-acceptance-authorized",
        status: "running",
        candidate: state.batch.candidate,
        pr: state.batch.pr,
      });
      return { status: "deployed-acceptance-authorized" };
    }
    if (
      state.batch.issue === issueNumber &&
      state.batch.intakeHash === digest(source) &&
      state.batch.workflowOwner === ctx.callId
    )
      return { status: state.batch.status };
    if (isAuthorizedResume(state.batch, issueNumber, digest(source))) {
      if (Date.now() >= runDeadline(state.batch)) throw new Error("Original batch budget expired");
      state.batch.workflowOwner = ctx.callId;
      state.batch.status = "running";
      state.batch.error = undefined;
      await saveState(state, sha);
      await postReceipt(issueNumber, {
        event: "resuming",
        status: "running",
        phase: state.batch.active?.phase,
        agentId: state.batch.active?.agentId,
        candidate: state.batch.candidate,
      });
      return { status: "resuming" };
    }
    if (state.batch.status === "running")
      throw new Error("Another workflow owns the running batch");
    archiveBatch(state, "New authorized factory label");
  }
  try {
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
    state.lastFailure = undefined;
    await saveState(state, sha);
    await postReceipt(issueNumber, {
      event: "registered",
      status: "running",
      candidate: source.commit,
    });
    return {
      status: "registered",
      slices: manifest.jobs.map((j) => ({ id: j.id, title: j.title })),
    };
  } catch (error) {
    await failRegister(state, sha, issueNumber, source, error);
  }
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
