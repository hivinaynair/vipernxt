import { defineWorkflowTool, type WorkflowStepToolContext } from "eve/tools";
import { RetryableError } from "workflow";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { repository, required } from "../lib/config.js";
import { digest, intake, validateManifest } from "../lib/contract.js";
import { coverageSchema, validateCoverage } from "../lib/coverage.js";
import { deploymentReceipt, runDeadline, verifyDeployment } from "../lib/deployment.js";
import { file, github, head, type Issue, isAncestor } from "../lib/github.js";
import { assertApprovedIntake } from "../lib/intake.js";
import { postReceipt } from "../lib/receipt.js";
import { validateReadiness } from "../lib/requirements-readiness.js";
import { runBatch } from "../lib/run-batch.js";
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
    "Run or adopt the approved hash-bound batch through build, independent review, CI repair and optional staging acceptance. Manual staging can use an operator-approved deployment receipt. Durable wakes/reconciliation cannot accept a slice.",
  inputSchema: z.object({}),
  execution: "background",
  async execute(_, ctx) {
    "use workflow";
    await register(ctx);
    return runBatch(ctx);
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
    const files: Record<string, string> = {};
    for (const p of manifest.specFiles) files[p] = (await file(p, source.commit)).text;
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
    const packet = JSON.parse(files[manifest.requirementsFile]);
    const readiness = validateReadiness({
      coverageFile: manifest.coverageFile,
      file: manifest.requirementsFile,
      packetText: files[manifest.requirementsFile],
      approval: manifest.approval,
      scope: coverage.scope,
      specFiles: manifest.specFiles,
      files,
      state: parseYaml(files[packet.stateFile]),
      requirementIds: coverage.requirements.map((r) => r.id),
      staging: Boolean(coverage.deployed?.automatic),
      requiredArtifacts: [
        manifest.coverageFile,
        coverage.spineFile,
        ...(coverage.accessFile ? [coverage.accessFile] : []),
        ...(coverage.deployed?.automatic
          ? [
              coverage.deployed.automatic.workflow,
              ".github/scripts/factory-staging.ts",
              ...coverage.deployed.automatic.sources,
            ]
          : []),
      ],
    });
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
