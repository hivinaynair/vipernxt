import { defineWorkflowTool, type WorkflowStepToolContext } from "eve/tools";
import { FatalError, RetryableError } from "workflow";
import { z } from "zod";
import { approvedContract } from "../lib/approved-contract.js";
import { repository, required } from "../lib/config.js";
import { digest, intake, validateManifest } from "../lib/contract.js";
import { deploymentReceipt, runDeadline, verifyDeployment } from "../lib/deployment.js";
import { assertFaultIntake } from "../lib/faults.js";
import { file, github, head, type Issue, isAncestor } from "../lib/github.js";
import { assertApprovedIntake } from "../lib/intake.js";
import { classifyFailure } from "../lib/jev.js";
import { flushOwnerNotification } from "../lib/notify-owner.js";
import { postReceipt } from "../lib/receipt.js";
import { runBatch } from "../lib/run-batch.js";
import { verifyRuntime } from "../lib/runtime.js";
import { simulationIntake } from "../lib/simulation.js";
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
    "Run or adopt the approved hash-bound batch through build, independent review, CI repair and optional staging acceptance. Manual staging can use an operator-approved deployment receipt. Durable wakes/reconciliation cannot accept a slice.",
  inputSchema: z.object({}),
  execution: "background",
  async execute(_, ctx) {
    "use workflow";
    try {
      await register(ctx);
    } catch (error) {
      try {
        await flushOwnerNotification();
      } catch {
        /* Preserve the original registration hold. */
      }
      throw error;
    }
    return runBatch(ctx);
  },
});

export async function failRegister(
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
  if (state.batch?.issue === issueNumber) {
    state.batch.status = "blocked";
    state.batch.error = message;
    state.batch.failure = { code: "registration_failed", operation: "validation" };
  }
  await saveState(state, sha);
  const classification = await classifyFailure({
    stage: "dispatch",
    code: "registration_failed",
    summary: message,
    retriesRemaining: 0,
    scopeValid: false,
    budgetAvailable: false,
  });
  await postReceipt(issueNumber, {
    event: "classified",
    status: "blocked",
    error: message,
    attention: classification.attention,
    recommendation: classification.recommendation,
  });
  // The checkpoint and owner receipt already declare a hold. SDK retries must
  // not silently reattempt intake or repeat its receipt after that decision.
  throw new FatalError(message);
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
  if (state.lease && state.lease.until > Date.now())
    throw new RetryableError("Factory transition lease is busy; retry registration");
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
      if (Date.now() >= runDeadline(state.batch) && !state.batch.active?.posted)
        throw new Error("Original batch budget expired");
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
    const simulation = simulationIntake(
      manifest,
      repository(),
      process.env.FACTORY_SIMULATION_REPO,
      required("FACTORY_BASE_BRANCH"),
    );
    assertFaultIntake(manifest);
    const { coverage, readiness } = await approvedContract(manifest, source.commit, file, {
      allowSimulation: simulation,
    });
    if (simulation && coverage.scope !== "first-slice")
      throw new Error("Hosted simulation cannot certify an MVP");
    state.batch = {
      workflowOwner: ctx.callId,
      issue: issueNumber,
      intakeHash: digest(source),
      commit: source.commit,
      manifestPath: source.manifest,
      manifest,
      coverage,
      readiness,
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
      event: simulation ? "simulation-registered" : "registered",
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
