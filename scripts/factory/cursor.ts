import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { git, hash, read, save } from "./core";

export type CursorConfig = { repository: string };
type Run = {
  id: string;
  agentId: string;
  status: string;
  result?: string;
  git?: { branches: { repoUrl: string; branch?: string }[] };
};
type Agent = { id: string; latestRunId?: string };
export type CloudReceipt = {
  agentId: string;
  runId?: string;
  requestHash: string;
  status: string;
  branch?: string;
  commit?: string;
  result?: string;
};
export class RemoteUncertain extends Error {}
const terminal = new Set(["FINISHED", "ERROR", "CANCELLED", "EXPIRED"]);
export function repository(value: string) {
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value))
    throw new Error("Cursor repository must be an explicit credential-free GitHub HTTPS URL");
  return value.replace(/\.git$/, "");
}
// Transport injection is for contract tests. Production always uses api.cursor.com.
export class CursorClient {
  constructor(
    private key: string,
    private transport: typeof fetch = fetch,
  ) {
    if (!key) throw new Error("Set CURSOR_API_KEY on the controller host");
  }
  async request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const response = await this.transport(`https://api.cursor.com/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    // Never include response bodies or request headers: either can contain secrets.
    if (!response.ok) throw new Error(`Cursor HTTP ${response.status}`);
    return response.json();
  }
}
export async function cursorRun(options: {
  client: CursorClient;
  dir: string;
  repo: string;
  base: string;
  prompt: string;
  stopped: () => boolean;
  review?: boolean;
  sleep?: () => Promise<unknown>;
}): Promise<CloudReceipt> {
  const { client, dir, base, prompt, stopped } = options;
  const repo = repository(options.repo);
  const path = join(dir, "cursor.json");
  const requestHash = hash({ repo, base, prompt, review: options.review ?? false });
  const receipt: CloudReceipt = existsSync(path)
    ? read<CloudReceipt>(path)
    : { agentId: `bc-${randomUUID()}`, requestHash, status: "PREPARED" };
  if (receipt.requestHash !== requestHash) throw new Error("Cloud attempt inputs changed");
  save(path, receipt); // Persist identity BEFORE POST; retry cannot create a second agent.
  const pause = options.sleep ?? (() => Bun.sleep(10000));
  const poll = async () => {
    if (!receipt.runId) {
      const agent: Agent = await client.request(`/agents/${receipt.agentId}`);
      if (agent.id !== receipt.agentId || !agent.latestRunId)
        throw new RemoteUncertain("Missing initial run identity");
      receipt.runId = agent.latestRunId;
      save(path, receipt);
    }
    const run: Run = await client.request(`/agents/${receipt.agentId}/runs/${receipt.runId}`);
    if (run.id !== receipt.runId || run.agentId !== receipt.agentId)
      throw new RemoteUncertain("Cursor returned another run");
    receipt.status = run.status;
    save(path, receipt);
    return run;
  };
  try {
    if (["PREPARED", "SUBMITTING"].includes(receipt.status) && !stopped()) {
      receipt.status = "SUBMITTING";
      save(path, receipt);
      try {
        const created: { agent: Agent; run: Run } = await client.request("/agents", "POST", {
          agentId: receipt.agentId,
          prompt: { text: prompt },
          repos: [{ url: repo, startingRef: base }],
          workOnCurrentBranch: false,
          autoCreatePR: false,
          mode: options.review ? "plan" : "agent",
        });
        if (created.agent.id !== receipt.agentId || created.run.agentId !== receipt.agentId)
          throw new RemoteUncertain("Cursor create identity mismatch");
        receipt.runId = created.run.id;
        receipt.status = created.run.status;
        save(path, receipt);
      } catch {
        // A timed-out POST may already have launched a billable worker. Reconcile by ID.
        await poll();
      }
    }
    if (receipt.status === "PREPARED") throw new Error("Cancelled before cloud dispatch");
    let failures = 0;
    while (!stopped()) {
      let run: Run;
      try {
        run = await poll();
        failures = 0;
      } catch (error) {
        if (++failures >= 3) throw error;
        await pause();
        continue;
      }
      if (terminal.has(run.status)) {
        if (run.status !== "FINISHED") throw new Error(`Cursor run ${run.status}`);
        const agent: Agent = await client.request(`/agents/${receipt.agentId}`);
        if (agent.latestRunId !== receipt.runId)
          throw new RemoteUncertain("Agent was continued outside this factory attempt");
        receipt.result = run.result;
        if (options.review) {
          save(path, receipt);
          return receipt;
        }
        const branches = run.git?.branches ?? [];
        if (
          branches.length !== 1 ||
          `https://${branches[0].repoUrl}`.replace(/\.git$/, "") !== repo ||
          !branches[0].branch?.startsWith("cursor/")
        )
          throw new Error("Expected exactly one Cursor result branch in the approved repository");
        receipt.branch = branches[0].branch;
        save(path, receipt);
        return receipt;
      }
      if (!["CREATING", "RUNNING"].includes(run.status))
        throw new RemoteUncertain("Unknown Cursor run status");
      await pause();
    }
    throw new Error("Cancelled or time budget exhausted");
  } catch (error) {
    if (!terminal.has(receipt.status) && receipt.status !== "PREPARED") {
      try {
        if (!receipt.runId) await poll();
        if (!terminal.has(receipt.status)) {
          try {
            await client.request(`/agents/${receipt.agentId}/runs/${receipt.runId}/cancel`, "POST");
          } catch {
            /* Verify terminal state, including 409. */
          }
          await poll();
        }
        if (!terminal.has(receipt.status)) throw new Error("Not terminal");
      } catch {
        throw new RemoteUncertain(
          `Remote work may still be active: ${receipt.agentId}. Reconcile in Cursor before retrying.`,
        );
      }
    }
    throw error;
  }
}
export async function implementWithCursor(options: {
  config: CursorConfig;
  dir: string;
  worktree: string;
  base: string;
  prompt: string;
  stopped: () => boolean;
  command: (argv: string[], label: string) => Promise<void>;
}) {
  const repo = repository(options.config.repository);
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: controller secret, never a cached Turbo input
  const client = new CursorClient(process.env.CURSOR_API_KEY ?? "");
  // A unique immutable source ref makes local integration commits accessible to Cursor.
  const source = `refs/heads/codex/factory-input/${hash({ base: options.base, dir: options.dir }).slice(0, 24)}`;
  await options.command(["git", "push", repo, `${options.base}:${source}`], "cloud-source");
  const receipt = await cursorRun({ ...options, client, repo });
  const branch = receipt.branch;
  if (!branch) throw new Error("Cloud result has no branch");
  git(options.worktree, "check-ref-format", `refs/heads/${branch}`);
  await options.command(["git", "fetch", "--no-tags", repo, `refs/heads/${branch}`], "cloud-fetch");
  const commit = git(options.worktree, "rev-parse", "FETCH_HEAD^{commit}");
  git(options.worktree, "merge-base", "--is-ancestor", options.base, commit);
  receipt.commit = commit;
  save(join(options.dir, "cursor.json"), receipt);
  // Import only the candidate tree into the isolated checkout. Existing scope/check gates apply.
  git(options.worktree, "read-tree", "--reset", "-u", commit);
}

export async function reviewWithCursor(options: {
  config: CursorConfig;
  dir: string;
  worktree: string;
  base: string;
  tree: string;
  instructions: string;
  stopped: () => boolean;
  command: (argv: string[], label: string) => Promise<void>;
}) {
  const dir = join(options.dir, "cursor-review");
  const candidatePath = join(dir, "candidate.json");
  const candidate = existsSync(candidatePath)
    ? read<{ tree: string; base: string; commit: string }>(candidatePath)
    : {
        tree: options.tree,
        base: options.base,
        commit: git(
          options.worktree,
          "-c",
          "user.name=Factory Review",
          "-c",
          "user.email=factory@localhost",
          "commit-tree",
          options.tree,
          "-p",
          options.base,
          "-m",
          "Candidate for independent review",
        ),
      };
  if (candidate.tree !== options.tree || candidate.base !== options.base)
    throw new RemoteUncertain("Review candidate changed during recovery");
  save(candidatePath, candidate);
  const repo = repository(options.config.repository);
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: controller secret, never a cached Turbo input
  const client = new CursorClient(process.env.CURSOR_API_KEY ?? "");
  await options.command(
    [
      "git",
      "push",
      repo,
      `${candidate.commit}:refs/heads/codex/factory-review/${hash({ dir }).slice(0, 24)}`,
    ],
    "review-source",
  );
  const receipt = await cursorRun({
    client,
    dir,
    repo,
    base: candidate.commit,
    review: true,
    stopped: options.stopped,
    prompt: `Review only. Do not edit, commit, push, open PRs or merge. Inspect the diff from ${options.base} to HEAD against this contract. Do not trust the builder summary. Return ONLY JSON {"approved":boolean,"findings":string[]} with concrete correctness, security or acceptance defects. Approve only when no actionable defects remain.\n${options.instructions}`,
  });
  let verdict: { approved: boolean; findings: string[] };
  try {
    verdict = JSON.parse(receipt.result ?? "");
  } catch {
    throw new Error("Cursor review did not return a JSON verdict");
  }
  save(join(options.dir, "review.json"), verdict);
  if (verdict.approved !== true || !Array.isArray(verdict.findings) || verdict.findings.length)
    throw new Error("Independent Cursor review found defects; see review.json");
}

/** Fence remote work even if local setup/checks fail before the adapter can resume it. */
export async function cancelCursorAttempts(dir: string, client?: CursorClient) {
  for (const folder of [dir, join(dir, "cursor-review")]) {
    const path = join(folder, "cursor.json");
    if (!existsSync(path)) continue;
    const receipt = read<CloudReceipt>(path);
    if (receipt.status === "PREPARED" || terminal.has(receipt.status)) continue;
    try {
      // biome-ignore lint/suspicious/noUndeclaredEnvVars: controller credential, not cached build input
      client ??= new CursorClient(process.env.CURSOR_API_KEY ?? "");
      if (!receipt.runId) {
        const agent: Agent = await client.request(`/agents/${receipt.agentId}`);
        if (agent.id !== receipt.agentId || !agent.latestRunId)
          throw new Error("No remote identity");
        receipt.runId = agent.latestRunId;
      }
      const url = `/agents/${receipt.agentId}/runs/${receipt.runId}`;
      try {
        await client.request(`${url}/cancel`, "POST");
      } catch {
        /* Terminal runs return 409. */
      }
      const run: Run = await client.request(url);
      if (run.id !== receipt.runId || run.agentId !== receipt.agentId || !terminal.has(run.status))
        throw new Error("Remote cancellation not confirmed");
      receipt.status = run.status;
      save(path, receipt);
    } catch {
      throw new RemoteUncertain(
        `Remote work may still be active: ${receipt.agentId}. Reconcile in Cursor before retrying.`,
      );
    }
  }
}
