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
import { GitHubError, github, head, type Issue } from "./github.js";
import { assertLease, claim } from "./lease.js";
import { type Batch, readState, saveState } from "./store.js";

export function workerPrompt(b: Batch, job: Job): string {
  const contract = {
    job,
    specFiles: b.manifest.specFiles,
    commands: verificationCommands(b.manifest, job),
  };
  if (b.active?.phase === "review")
    return [
      "Independently verify this exact commit. Do not edit tracked files or push code. Ignore the builder's claims.",
      `Commit: ${b.active.base}. Compare against ${b.candidate}.`,
      "Use a writable Cloud VM for verification, not an early read-only exploration turn. First create and immediately remove a temporary file in the repository root using mktemp and rm, so repository hooks are active. Keep tracked files unchanged; never invoke the completion hook manually.",
      "Read every pinned specification and verify every cited journey step, including fields, tables, validation, permissions and error states. Run every command, including browser evidence when requested. Return ONLY JSON:",
      '{"commit":"exact SHA","approved":true,"unchanged":true,"findings":[],"checks":[{"command":["exact","argv"],"exitCode":0,"evidence":"observed output"}],"criteria":[{"step":"journey ID","passed":true,"evidence":"what you independently verified"}]}',
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

export async function tick() {
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
    if (Date.now() >= b.startedAt + b.manifest.limits.runSeconds * 1000)
      throw new Error(
        "Batch time budget exhausted; reconcile any active Cursor run before resuming",
      );
    const job = b.manifest.jobs.find((j) => !b.accepted.includes(j.id));
    if (!job) {
      const branch = b.resultBranch;
      if (!branch || (await head(branch)) !== b.candidate)
        throw new Error("Final branch no longer matches verified candidate");
      const base = required("FACTORY_BASE_BRANCH");
      if ((await head(base)) !== b.manifest.base)
        throw new Error(
          "Target branch changed; combined verification must be rebased and repeated",
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
          body: `Implements approved batch #${b.issue}.\n\nJourney steps: ${[...new Set(b.manifest.jobs.flatMap((j) => j.steps))].join(", ")}\n\nIndependent verification receipts: [factory checkpoint](https://github.com/${repository()}/blob/factory/state/factory-state.json).\n\nNo staging merge or product deployment was performed.`,
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
        phase: "build",
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
      verificationCommands(b.manifest, job),
      job.steps,
    );
    if (!b.active.branch || (await head(b.active.branch)) !== b.active.base)
      throw new Error("Worker branch changed during independent review");
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
