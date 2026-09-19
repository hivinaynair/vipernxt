import { required } from "./config.js";
import type { Manifest } from "./contract.js";
import { file, GitHubError, github, head } from "./github.js";
import type { Recommendation } from "./jev.js";

export type Attempt = {
  agentId: string;
  phase: "build" | "review";
  base: string;
  startingRef?: string;
  startedAt: number;
  runId?: string;
  posted?: boolean;
  candidate?: string;
  branch?: string;
};
export type Batch = {
  workflowOwner?: string;
  issue: number;
  intakeHash: string;
  commit: string;
  manifestPath: string;
  manifest: Manifest;
  startedAt: number;
  status: "running" | "paused" | "blocked" | "review";
  candidate: string;
  accepted: string[];
  attempts: Record<string, number>;
  active?: Attempt;
  error?: string;
  pr?: string;
  feedback?: string;
  resultBranch?: string;
  triage?: { key: string; result: Recommendation };
  evidence: { job: string; commit: string; review: unknown }[];
};
export type State = { version: 1; batch?: Batch; lease?: { owner: string; until: number } };
const branch = "factory/state";
const path = "factory-state.json";
export async function readState(): Promise<{ state: State; sha?: string }> {
  try {
    const f = await file(path, branch);
    return { state: JSON.parse(f.text), sha: f.sha };
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return { state: { version: 1 } };
    throw e;
  }
}
export async function saveState(state: State, previous?: string) {
  if (!previous) {
    try {
      await github("/git/refs", "POST", {
        ref: `refs/heads/${branch}`,
        sha: await head(required("FACTORY_BASE_BRANCH")),
      });
    } catch (e) {
      if (!(e instanceof GitHubError && e.status === 422)) throw e;
    }
  }
  // GitHub's contents SHA is the compare-and-swap token. Competing transitions
  // cannot both win. Remote identities are saved before their side effects.
  const result = await github<{ content: { sha: string } }>(`/contents/${path}`, "PUT", {
    branch,
    message: "factory: checkpoint batch",
    sha: previous,
    content: Buffer.from(JSON.stringify(state, null, 2)).toString("base64"),
  });
  return result.content.sha;
}
