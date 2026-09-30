import { randomUUID } from "node:crypto";
import {
  dispatchDeployment,
  reconcileDeployment,
  reserveDeployment,
} from "./automatic-deployment.js";
import { inspectCI } from "./ci.js";
import { repository, required } from "./config.js";
import {
  digest,
  extractReviewJson,
  intake,
  type Job,
  parseReview,
  validateDiff,
  verificationCommands,
} from "./contract.js";
import { advanceRemote, CursorError } from "./cursor.js";
import { deploymentReceipt, runDeadline, verifyDeployment } from "./deployment.js";
import { file, GitHubError, github, head, type Issue } from "./github.js";
import { assertLease, claim } from "./lease.js";
import { postReceipt } from "./receipt.js";
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

export function repairJob(b: Batch): Job {
  return {
    ...integratedJob(b),
    id: b.integrationRepair?.pending ? "__integration_repair__" : "__ci_repair__",
    title: "Repair approved CI failures",
    paths: [...new Set(b.manifest.jobs.flatMap((j) => j.paths))],
    instructions:
      b.feedback ?? "Repair the failed approved CI checks without changing requirements.",
  };
}
export function reviewCriteria(b: Batch, job: Job): string[] {
  if (!b.coverage) throw new Error("Missing coverage contract");
  return ["__ci_repair__", "__integration_repair__"].includes(job.id) ||
    b.active?.phase === "integrated-review" ||
    b.active?.phase === "deployed-review"
    ? b.coverage.requirements.map((r) => r.id)
    : b.coverage.requirements
        .filter((r) => r.delivery.kind === "job" && r.delivery.job === job.id)
        .map((r) => r.id);
}

export function promptRequirements(b: Batch, job: Job) {
  if (!b.coverage) throw new Error("Missing coverage contract");
  if (
    ["__ci_repair__", "__integration_repair__"].includes(job.id) ||
    b.active?.phase === "integrated-review" ||
    b.active?.phase === "deployed-review"
  )
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
  if (b.deployment)
    return [
      ...b.manifest.setup,
      ...[...job.checks, ...(job.browser ? [job.browser] : [])].map((command) => [
        "env",
        `FACTORY_STAGING_URL=${b.deployment!.url}`,
        `E2E_BASE_URL=${b.deployment!.url}`,
        ...command,
      ]),
    ];
  // Combined checks belong to integrated review. Setup is prep, not evidence.
  if (job.id.startsWith("__")) return verificationCommands(b.manifest, job);
  return [...job.checks, ...(job.browser ? [job.browser] : [])];
}
export function workerPrompt(b: Batch, job: Job): string {
  const contract = {
    job,
    deployment: b.deployment,
    requirements: promptRequirements(b, job),
    criterionIds: b.coverage ? reviewCriteria(b, job) : job.steps,
    specFiles: b.manifest.specFiles,
    readiness: b.readiness,
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
      b.feedback ? `Previous verification problem: ${b.feedback}` : "",
      "Independently verify this exact commit. Do not edit tracked files or push code. Ignore the builder's claims.",
      `Commit: ${b.active.base}. Compare against ${b.active.phase === "integrated-review" ? b.manifest.base : b.candidate}.`,
      "Use a writable Cloud VM for verification, not an early read-only exploration turn. First create and immediately remove a temporary file in the repository root using mktemp and rm, so repository hooks are active. Keep tracked files unchanged; never invoke the completion hook manually.",
      "For authentication, use dedicated Clerk development identities and runtime secrets with the pinned approved access matrix. Never bypass authentication or output credentials. Verify signed-out, role and cross-tenant denials where applicable.",
      "Read every pinned specification and verify every cited journey step, including fields, tables, validation, permissions and error states. Run every command, including browser evidence when requested. Your entire reply must be one JSON object. The first character is { and the last is }. No prose, headings or fences.",
      "If you approve, return this object with real evidence strings. Copy every command and criterionIds value exactly. Extra checks are allowed. Use notes for nonblocking observations; findings are blockers. Do not abbreviate the commit, rename argv or invent steps:",
      JSON.stringify({
        commit: b.active.base,
        verdict: "approve",
        unchanged: true,
        findings: [],
        checks: contract.commands.map((command) => ({
          command,
          exitCode: 0,
          evidence: "observed output",
        })),
        criteria: contract.criterionIds.map((step) => ({
          step,
          passed: true,
          evidence: "what you independently verified",
        })),
      }),
      "Missing business policy or permissions must reject and hold for the owner. request_changes requests an implementation repair within the existing contract and attempt budget. reject holds for the owner. If any required check fails or evidence is missing, verdict must not be approve. Report the actual unchanged status using git status.",
      JSON.stringify(contract),
    ].join("\n");
  return [
    "Implement only this approved slice. Read AGENTS.md and all pinned specifications. Do not invent fields or requirements. Do not modify pinned evaluators, factory state, GitHub workflows or unrelated paths. Commit and push only the implementation branch; do not open or merge PRs or deploy.",
    `Base: ${b.active?.base}.`,
    JSON.stringify(contract),
    b.feedback ? `Previous review findings: ${b.feedback}` : "",
  ].join("\n");
}

const live = {
  repository,
  required,
  readState,
  saveState,
  github,
  head,
  advanceRemote,
  postReceipt,
  file,
};
export async function tick(overrides: Partial<typeof live> = {}) {
  const {
    repository,
    required,
    readState,
    saveState,
    github,
    head,
    advanceRemote,
    postReceipt,
    file,
  } = {
    ...live,
    ...overrides,
  };
  const store = { read: readState, save: saveState };
  const current = await store.read();
  if (
    !current.state.batch ||
    current.state.batch.status !== "running" ||
    (current.state.batch.retryAfter ?? 0) > Date.now()
  )
    return;
  const acquired = await claim(store);
  if (!acquired) return;
  const { state, sha, owner } = acquired;
  const b = state.batch;
  let checkpointSha = sha;
  const checkpoint = async (keepLease = false) => {
    if (!keepLease) state.lease = undefined;
    checkpointSha = await saveState(state, checkpointSha);
    return checkpointSha;
  };
  const retryReview = (reason: string, job: Job) => {
    if (!b?.active || b.active.phase === "build") throw new Error("No reviewer to retry");
    const key = `${b.active.phase}:${job.id}:${b.active.base}`;
    const retries = (b.unreadable?.[key] ?? 0) + 1;
    if (retries > 2) throw new Error(`Review retry budget exhausted: ${reason}`);
    b.unreadable = { ...b.unreadable, [key]: retries };
    b.feedback = reason;
    // Preserve the original stage clock and candidate; only the remote identity changes.
    b.active = {
      agentId: `bc-${randomUUID()}`,
      phase: b.active.phase,
      base: b.active.base,
      candidate: b.active.candidate,
      branch: b.active.branch,
      startedAt: b.active.startedAt,
    };
  };
  const persist = async (event: string) => {
    await checkpoint();
    if (!b) return;
    await postReceipt(
      b.issue,
      {
        event,
        status: b.status,
        phase: b.active?.phase,
        agentId: b.active?.agentId,
        runId: b.active?.runId,
        candidate: b.active?.candidate ?? b.candidate,
        deadline: b.active
          ? Math.min(runDeadline(b), b.active.startedAt + b.manifest.limits.jobSeconds * 1000)
          : undefined,
        error: b.error,
        pr: b.pr,
        attention: b.status === "blocked" || b.status === "paused" ? "owner" : undefined,
      },
      github,
    );
  };
  if (!b || b.status !== "running") {
    await checkpoint();
    return;
  }
  try {
    b.retryAfter = undefined;
    if (!b.coverage)
      throw new Error("Batch predates required coverage contract; create a newly approved batch");
    if (!b.readiness)
      throw new Error("Batch predates required readiness gate; create a newly approved batch");
    const issue = await github<Issue>(`/issues/${b.issue}`);
    if (
      issue.state !== "open" ||
      !issue.labels.some((l) => l.name === "factory") ||
      digest(intake(issue.body ?? "")) !== b.intakeHash
    ) {
      b.status = "paused";
      b.error =
        "Issue closed, factory label removed, or approved contract changed. No new dispatch.";
      await persist("paused");
      return;
    }
    if (Date.now() >= runDeadline(b) && !b.active?.posted)
      throw new Error(
        "Batch time budget exhausted; reconcile any active Cursor run before resuming",
      );
    const nextJob = b.manifest.jobs.find((j) => !b.accepted.includes(j.id));
    if (b.deployment) {
      const receipt = b.automaticDeployment ? b.deployment : deploymentReceipt(issue.body ?? "");
      if (
        receipt.deploymentId !== b.deployment.deploymentId ||
        receipt.statusId !== b.deployment.statusId
      )
        throw new Error("Approved deployment receipt changed");
      const verified = await verifyDeployment(b, receipt, github);
      if (verified.url !== b.deployment.url) throw new Error("Deployment URL changed");
    }
    const repairing = b.ci?.result === "repair" || b.integrationRepair?.pending;
    const job = repairing
      ? repairJob(b)
      : b.deployment
        ? deployedJob(b)
        : (nextJob ?? integratedJob(b));
    if (!b.deployment && !nextJob && b.integratedReview?.commit === b.candidate) {
      const branch = b.resultBranch;
      if (!branch || (await head(branch)) !== b.candidate)
        throw new Error("Final branch no longer matches verified candidate");
      const base = required("FACTORY_BASE_BRANCH");
      if ((await head(base)) !== b.commit)
        throw new Error(
          "Target branch changed since intake; rebase the candidate and repeat approved integration",
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
      if (b.coverage.ci) {
        const ciResult = await inspectCI(b, github);
        if (ciResult === "pending") {
          await persist("ci-pending");
          return;
        }
        if (ciResult === "repair") {
          await persist("ci-repair-reserved");
          return;
        }
      }
      if (b.coverage.deployed?.automatic) {
        if (!b.automaticDeployment) {
          b.automaticDeployment = await reserveDeployment(b, base, file);
          await persist("deployment-reserved");
          return;
        }
        if (!b.automaticDeployment.posted) {
          const ref = `factory/deployment/${b.automaticDeployment.id}`;
          try {
            await github("/git/refs", "POST", { ref: `refs/heads/${ref}`, sha: b.commit });
          } catch (e) {
            if (!(e instanceof GitHubError && e.status === 422)) throw e;
          }
          if ((await head(ref)) !== b.commit) throw new Error("Deployment input ref changed");
          await assertLease(store, owner);
          b.automaticDeployment.posted = true;
          // Save dispatch intent before the non-idempotent workflow API call.
          await checkpoint(true);
          await assertLease(store, owner);
          try {
            await dispatchDeployment(b, ref, github);
          } catch (e) {
            if (e instanceof GitHubError && e.status >= 400 && e.status < 500 && e.status !== 429)
              throw e;
            /* dispatch may have succeeded; reconcile the reserved identity */
          }
          await checkpoint();

          return;
        }
        const verified = await reconcileDeployment(b, github);
        if (!verified) {
          await checkpoint();
          return;
        }
        b.deployment = { ...verified, startedAt: Date.now() };
        await persist("deployment-verified");
        return;
      }
      b.status = "review";
      await persist("draft-pr");
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
        phase: b.deployment
          ? "deployed-review"
          : nextJob || repairing
            ? "build"
            : "integrated-review",
        branch: nextJob || repairing ? undefined : b.resultBranch,
        base: b.pendingRevision?.job === job.id ? b.pendingRevision.base : b.candidate,
        startedAt: Date.now(),
      };
      await persist("station-reserved");
      return; // Identity is committed BEFORE the next tick can launch.
    }
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
      if (Date.now() >= runDeadline(b))
        throw new Error("Batch time budget exhausted; remote may still be running");
      if (Date.now() >= b.active.startedAt + b.manifest.limits.jobSeconds * 1000)
        throw new Error("Cursor stage time budget exhausted; remote may still be running");
      await checkpoint();
      return;
    }
    if (run.status !== "FINISHED") {
      if (run.status === "ERROR" || run.status === "EXPIRED") {
        const reason = `Cursor ${b.active.phase} ended with ${run.status}`;
        if (b.active.phase === "build") {
          b.feedback = reason;
          b.active = undefined;
        } else retryReview(reason, job);
        await persist("station-retry");
        return;
      }
      throw new Error(`Cursor stage ended with ${run.status}`);
    }
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
      await persist("review-station");
      return;
    }
    if (b.active.phase !== "deployed-review") {
      if (!b.active.branch || (await head(b.active.branch)) !== b.active.base)
        throw new Error("Worker branch changed during independent review");
    }
    let reviewJson: unknown;
    try {
      reviewJson = extractReviewJson(run.result);
      if (!reviewJson || typeof reviewJson !== "object" || Array.isArray(reviewJson))
        throw new Error("Independent review must return a JSON object");
    } catch (error) {
      retryReview(error instanceof Error ? error.message : "Unreadable review", job);
      await persist("review-retry");
      return;
    }
    let parsed: ReturnType<typeof parseReview>;
    try {
      parsed = parseReview(
        reviewJson,
        b.active.base,
        executionCommands(b, job),
        reviewCriteria(b, job),
      );
    } catch (error) {
      if (b.active.phase !== "review") throw error;
      retryReview(error instanceof Error ? error.message : "Unreadable review", job);
      await persist("review-retry");
      return;
    }
    if (parsed.verdict !== "approve") {
      if (
        (b.active.phase === "integrated-review" ||
          (b.active.phase === "deployed-review" && b.automaticDeployment)) &&
        parsed.verdict === "request_changes"
      ) {
        const attempts = (b.integrationRepair?.attempts ?? 0) + 1;
        if (attempts > 2) throw new Error("Integrated repair budget exhausted");
        b.integrationRepair = { attempts, pending: true };
        b.integratedReview = undefined;
        b.deployment = undefined;
        b.deployedReview = undefined;
        b.automaticDeployment = undefined;
        b.feedback =
          parsed.review.findings.join("\n") ||
          "Repair failing integrated acceptance within approved requirements";
        b.active = undefined;
        await persist("integration-repair-reserved");
        return;
      }
      if (b.active.phase === "review" && parsed.verdict === "request_changes") {
        const revisions = (b.revisions?.[job.id] ?? 0) + 1;
        if (revisions > 2) {
          throw new Error(
            `Review revision limit reached: ${parsed.review.findings.join("; ") || "contract not met"}`,
          );
        }
        b.revisions = { ...b.revisions, [job.id]: revisions };
        b.feedback = parsed.review.findings.join("\n") || "Independent review requested changes";
        b.pendingRevision = { job: job.id, base: b.active.base, branch: b.active.branch };
        b.active = undefined;
        await persist("request-changes");
        return;
      }
      throw new Error(
        `Independent review ${parsed.verdict}: ${parsed.review.findings.join("; ") || "contract not met"}`,
      );
    }
    const review = parsed.review;
    if (b.active.phase === "deployed-review") {
      if (b.coverage.ci && (await inspectCI(b, github)) !== "passed") {
        b.active = undefined;
        if (b.ci?.result === "repair") {
          await persist("ci-repair-reserved");
          return;
        }
        throw new Error("Required CI no longer passes at deployed acceptance");
      }
      const verified = await verifyDeployment(b, b.deployment!, github);
      if (verified.url !== b.deployment!.url)
        throw new Error("Deployment URL changed during review");
      b.deployedReview = { commit: b.active.base, url: verified.url, review };
      b.active = undefined;
      b.status = b.coverage.scope === "mvp" ? "mvp-complete" : "slice-complete";
      await persist(b.status);
      return;
    }
    if (b.active.phase === "integrated-review") {
      b.integratedReview = { commit: b.active.base, review };
      b.active = undefined;
      await persist("integrated-review");
      return;
    }
    b.pendingRevision = undefined;
    b.feedback = undefined;
    b.evidence.push({ job: job.id, commit: b.active.base, review });
    if (["__ci_repair__", "__integration_repair__"].includes(job.id)) {
      if (!b.resultBranch) throw new Error("CI repair has no delivery branch");
      const currentHead = await head(b.resultBranch);
      if (![b.candidate, b.active.base].includes(currentHead))
        throw new Error("Delivery branch changed during CI repair");
      if (currentHead !== b.active.base) {
        await assertLease(store, owner);
        await github(`/git/refs/heads/${b.resultBranch}`, "PATCH", {
          sha: b.active.base,
          force: false,
        });
      }
      if (b.ci) b.ci = { ...b.ci, commit: b.active.base, result: "pending" };
      if (b.integrationRepair) b.integrationRepair.pending = false;
      b.integratedReview = undefined;
    } else b.accepted.push(job.id);
    b.candidate = b.active.base;
    if (!["__ci_repair__", "__integration_repair__"].includes(job.id))
      b.resultBranch = b.active.branch;
    b.active = undefined;
    await persist("slice-accepted");
  } catch (e) {
    // A lost checkpoint race is retried from fresh state. Never overwrite a
    // concurrent pause/cancel with the older in-memory snapshot.
    const message = e instanceof Error ? e.message.slice(0, 500) : "Factory transition failed";
    const transient =
      ((e instanceof GitHubError || e instanceof CursorError) &&
        (e.status === 429 || e.status >= 500)) ||
      (e instanceof Error &&
        (e.name === "TimeoutError" ||
          (e.name === "TypeError" && /fetch|network/i.test(e.message))));
    const retryKey = b.active?.agentId ?? b.automaticDeployment?.id ?? `delivery:${b.candidate}`;
    const retries = b.networkRetries?.[retryKey] ?? 0;
    if (transient && retries < 3 && Date.now() < runDeadline(b)) {
      b.networkRetries = { ...b.networkRetries, [retryKey]: retries + 1 };
      b.retryAfter = Date.now() + 15000 * (retries + 1);
      await persist("transport-retry");
      return;
    }
    b.status = "blocked";
    b.error = message;
    await persist("blocked");
  }
}
