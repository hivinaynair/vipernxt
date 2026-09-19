import { randomUUID } from "node:crypto";
import { enabled, repository, required } from "./config.js";
import {
  checkReview,
  digest,
  intake,
  type Job,
  validateDiff,
  verificationCommands,
} from "./contract.js";
import { advanceRemote } from "./cursor.js";
import { deploymentReceipt, runDeadline, verifyDeployment } from "./deployment.js";
import { GitHubError, github, head, type Issue, isAncestor } from "./github.js";
import { assertLease, claim } from "./lease.js";
import { type Batch, readState, saveState } from "./store.js";

export function deployedJob(b: Batch): Job {
  if (!b.coverage?.deployed || !b.deployment) throw new Error("Missing verified deployment");
  return {
    ...integratedJob(b),
    id: "__deployed_review__",
    title: "Deployed staging acceptance",
    checks: b.coverage.deployed.checks,
    browser: b.coverage.deployed.browser,
    requiresBrowser: Boolean(b.coverage.deployed.browser),
  };
}
export function integratedJob(b: Batch): Job {
  if (!b.coverage)
    throw new Error("Batch predates required coverage contract; create a newly approved batch");
  return {
    id: "__integrated_review__",
    title: "Integrated journey acceptance",
    instructions:
      "Verify every in-scope requirement together on the final candidate, including existing behavior and applicable signed-out, forbidden and cross-tenant cases.",
    steps: b.coverage.requirements.map((r) => r.id),
    dependsOn: [],
    paths: [],
    checks: b.coverage.integrated.checks,
    requiresBrowser: Boolean(b.coverage.integrated.browser),
    browser: b.coverage.integrated.browser,
  };
}

export function reviewCriteria(b: Batch, job: Job): string[] {
  if (!b.coverage) throw new Error("Missing coverage contract");
  return b.active?.phase === "integrated-review" || b.active?.phase === "deployed-review"
    ? b.coverage.requirements.map((r) => r.id)
    : b.coverage.requirements
        .filter((r) => r.delivery.kind === "job" && r.delivery.job === job.id)
        .map((r) => r.id);
}

export function promptRequirements(b: Batch, job: Job) {
  if (!b.coverage) throw new Error("Missing coverage contract");
  if (b.active?.phase === "integrated-review" || b.active?.phase === "deployed-review")
    return b.coverage.requirements;
  const catalog = new Map(b.coverage.requirements.map((r) => [r.id, r]));
  const included = new Set<string>();
  const visit = (id: string) => {
    if (included.has(id)) return;
    const requirement = catalog.get(id);
    if (!requirement) throw new Error(`Missing prerequisite requirement: ${id}`);
    included.add(id);
    requirement.dependsOn.forEach(visit);
  };
  reviewCriteria(b, job).forEach(visit);
  return b.coverage.requirements.filter((r) => included.has(r.id));
}

export function executionCommands(b: Batch, job: Job) {
  if (!b.deployment) return verificationCommands(b.manifest, job);
  return [
    ...b.manifest.setup,
    ...[...job.checks, ...(job.browser ? [job.browser] : [])].map((command) => [
      "env",
      `FACTORY_STAGING_URL=${b.deployment!.url}`,
      `E2E_BASE_URL=${b.deployment!.url}`,
      ...command,
    ]),
  ];
}
export function workerPrompt(b: Batch, job: Job): string {
  const contract = {
    job,
    deployment: b.deployment,
    requirements: promptRequirements(b, job),
    criterionIds: b.coverage ? reviewCriteria(b, job) : job.steps,
    specFiles: b.manifest.specFiles,
    commands: executionCommands(b, job),
  };
  if (
    b.active?.phase === "review" ||
    b.active?.phase === "integrated-review" ||
    b.active?.phase === "deployed-review"
  )
    return [
      b.deployment
        ? `Verify the actual deployed site at ${b.deployment.url}. Run checks with FACTORY_STAGING_URL=${b.deployment.url}. Never substitute localhost, mocks or a different URL. Use only approved test accounts/data; missing credentials or unavailable site must fail. Do not deploy or merge.`
        : "Verify the candidate in the worker environment.",
      "Independently verify this exact commit. Do not edit tracked files or push code. Ignore the builder's claims.",
      `Commit: ${b.active.base}. Compare against ${b.active.phase === "integrated-review" ? b.manifest.base : b.candidate}.`,
      "Use a writable Cloud VM for verification, not an early read-only exploration turn. First create and immediately remove a temporary file in the repository root using mktemp and rm, so repository hooks are active. Keep tracked files unchanged; never invoke the completion hook manually.",
      "For authentication, use dedicated Clerk development identities and runtime secrets with the pinned approved access matrix. Never bypass authentication or output credentials. Verify signed-out, role and cross-tenant denials where applicable.",
      "Read every pinned specification and verify every cited journey step, including fields, tables, validation, permissions and error states. Run every command, including browser evidence when requested. Return ONLY JSON:",
      '{"commit":"exact SHA","approved":true,"unchanged":true,"findings":[],"checks":[{"command":["exact","argv"],"exitCode":0,"evidence":"observed output"}],"criteria":[{"step":"exact requirement ID from criterionIds","passed":true,"evidence":"what you independently verified"}]}',
      "If any check fails or evidence is missing, approved must be false. Report the actual unchanged status using git status.",
      JSON.stringify(contract),
    ].join("\n");
  return [
    "Implement only this approved slice. Read AGENTS.md and all pinned specifications. Do not invent fields or requirements. Do not modify pinned evaluators, factory state, GitHub workflows or unrelated paths. Commit and push only the implementation branch; do not open or merge PRs or deploy.",
    `Base: ${b.active?.base}.`,
    JSON.stringify(contract),
    b.feedback ? `Previous review findings: ${b.feedback}` : "",
  ].join("\n");
}

const live = { enabled, repository, required, readState, saveState, github, head, advanceRemote };
export async function tick(overrides: Partial<typeof live> = {}) {
  const { enabled, repository, required, readState, saveState, github, head, advanceRemote } = {
    ...live,
    ...overrides,
  };
  if (!enabled()) return;
  const store = { read: readState, save: saveState };
  const current = await store.read();
  if (!current.state.batch || current.state.batch.status !== "running") return;
  const acquired = await claim(store);
  if (!acquired) return;
  const { state, sha, owner } = acquired;
  const b = state.batch;
  const checkpoint = () => {
    state.lease = undefined;
    return saveState(state, sha);
  };
  if (!b || b.status !== "running") {
    await checkpoint();
    return;
  }
  try {
    if (!b.coverage)
      throw new Error("Batch predates required coverage contract; create a newly approved batch");
    const issue = await github<Issue>(`/issues/${b.issue}`);
    if (
      issue.state !== "open" ||
      !issue.labels.some((l) => l.name === "factory") ||
      digest(intake(issue.body ?? "")) !== b.intakeHash
    ) {
      b.status = "paused";
      b.error =
        "Issue closed, factory label removed, or approved contract changed. No new dispatch.";
      await checkpoint();
      return;
    }
    if (Date.now() >= runDeadline(b))
      throw new Error(
        "Batch time budget exhausted; reconcile any active Cursor run before resuming",
      );
    const nextJob = b.manifest.jobs.find((j) => !b.accepted.includes(j.id));
    if (b.deployment) {
      const receipt = deploymentReceipt(issue.body ?? "");
      if (
        receipt.deploymentId !== b.deployment.deploymentId ||
        receipt.statusId !== b.deployment.statusId
      )
        throw new Error("Approved deployment receipt changed");
      const verified = await verifyDeployment(b, receipt, github);
      if (verified.url !== b.deployment.url) throw new Error("Deployment URL changed");
    }
    const job = b.deployment ? deployedJob(b) : (nextJob ?? integratedJob(b));
    if (!b.deployment && !nextJob && b.integratedReview?.commit === b.candidate) {
      const branch = b.resultBranch;
      if (!branch || (await head(branch)) !== b.candidate)
        throw new Error("Final branch no longer matches verified candidate");
      const base = required("FACTORY_BASE_BRANCH");
      if (!(await isAncestor(b.commit, await head(base))))
        throw new Error(
          "Target branch no longer contains the approved intake; combined verification must be rebased and repeated",
        );
      const existing = await github<{ html_url: string }[]>(
        `/pulls?state=open&head=${encodeURIComponent(repository().split("/")[0] + ":" + branch)}&base=${encodeURIComponent(base)}`,
      );
      await assertLease(store, owner);
      const pr =
        existing[0] ??
        (await github<{ html_url: string }>("/pulls", "POST", {
          title: `Factory: ${b.manifest.id}`,
          head: branch,
          base,
          draft: true,
          body: `Implements approved batch #${b.issue}.\n\nScope: ${b.coverage?.scope}. Integrated acceptance verified at ${b.candidate}.\n\nJourney steps: ${[...new Set(b.manifest.jobs.flatMap((j) => j.steps))].join(", ")}\n\nIndependent verification receipts: [factory checkpoint](https://github.com/${repository()}/blob/factory/state/factory-state.json).\n\nNo staging merge or product deployment was performed.`,
        }));
      b.pr = pr.html_url;
      b.status = "review";
      await checkpoint();
      return;
    }
    if (!job.dependsOn.every((id) => b.accepted.includes(id)))
      throw new Error("Dependency not accepted");
    if (!b.active) {
      const count = b.attempts[job.id] ?? 0;
      if (count >= b.manifest.limits.attempts) throw new Error("Slice attempt budget exhausted");
      b.attempts[job.id] = count + 1;
      b.active = {
        agentId: `bc-${randomUUID()}`,
        phase: b.deployment ? "deployed-review" : nextJob ? "build" : "integrated-review",
        branch: nextJob ? undefined : b.resultBranch,
        base: b.candidate,
        startedAt: Date.now(),
      };
      await checkpoint();
      return; // Identity is committed BEFORE the next tick can launch.
    }
    if (Date.now() >= b.active.startedAt + b.manifest.limits.jobSeconds * 1000)
      throw new Error("Cursor stage time budget exhausted; remote may still be running");
    await assertLease(store, owner);
    if (!b.active.posted) {
      // Cursor v1 rejected raw commit startingRef in the live test. Give it a
      // dedicated branch pinned to that commit, never a moving product branch.
      const ref = `factory/input/${b.active.agentId}`;
      try {
        await github("/git/refs", "POST", { ref: `refs/heads/${ref}`, sha: b.active.base });
      } catch (error) {
        if (!(error instanceof GitHubError && error.status === 422)) throw error;
      }
      if ((await head(ref)) !== b.active.base)
        throw new Error("Cursor input ref differs from pinned commit");
      b.active.startingRef = ref;
    }
    const run = await advanceRemote(b.active, workerPrompt(b, job));
    if (!run || ["CREATING", "RUNNING"].includes(run.status)) {
      await checkpoint();
      return;
    }
    if (run.status !== "FINISHED") throw new Error(`Cursor stage ended with ${run.status}`);
    if (b.active.phase === "build") {
      const branches = run.git?.branches ?? [];
      const branch = branches[0]?.branch;
      if (
        branches.length !== 1 ||
        !branch?.startsWith("cursor/") ||
        branches[0].repoUrl.replace(/^https:\/\//, "").replace(/\.git$/, "") !==
          `github.com/${repository()}`
      )
        throw new Error("Unexpected Cursor result repository or branch");
      const candidate = await head(branch);
      const diff = await github<{
        status: string;
        files?: { filename: string; previous_filename?: string }[];
      }>(`/compare/${b.candidate}...${candidate}`);
      if (diff.status !== "ahead" || !diff.files?.length || diff.files.length >= 300)
        throw new Error("Candidate is not a bounded descendant diff");
      validateDiff(diff.files, job, [...b.manifest.specFiles, b.manifestPath]);
      b.active = {
        agentId: `bc-${randomUUID()}`,
        phase: "review",
        base: candidate,
        candidate,
        branch,
        startedAt: Date.now(),
      };
      await checkpoint();
      return;
    }
    const raw = run.result
      ?.trim()
      .replace(/^```(?:json)?\s*/, "")
      .replace(/\s*```$/, "");
    const review = checkReview(
      JSON.parse(raw ?? "null"),
      b.active.base,
      executionCommands(b, job),
      reviewCriteria(b, job),
    );
    if (b.active.phase === "deployed-review") {
      const verified = await verifyDeployment(b, b.deployment!, github);
      if (verified.url !== b.deployment!.url)
        throw new Error("Deployment URL changed during review");
      b.deployedReview = { commit: b.active.base, url: verified.url, review };
      b.active = undefined;
      b.status = b.coverage.scope === "mvp" ? "mvp-complete" : "slice-complete";
      await checkpoint();
      return;
    }
    if (!b.active.branch || (await head(b.active.branch)) !== b.active.base)
      throw new Error("Worker branch changed during independent review");
    if (b.active.phase === "integrated-review") {
      b.integratedReview = { commit: b.active.base, review };
      b.active = undefined;
      await checkpoint();
      return;
    }
    b.evidence.push({ job: job.id, commit: b.active.base, review });
    b.accepted.push(job.id);
    b.candidate = b.active.base;
    b.resultBranch = b.active.branch;
    b.active = undefined;
    await checkpoint();
  } catch (e) {
    // A lost checkpoint race is retried from fresh state. Never overwrite a
    // concurrent pause/cancel with the older in-memory snapshot.
    b.status = "blocked";
    b.error = e instanceof Error ? e.message.slice(0, 500) : "Factory transition failed";
    await checkpoint();
  }
}
