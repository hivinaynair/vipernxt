import { intake } from "./contract.js";
import { runDeadline } from "./deployment.js";
import { github, type Issue } from "./github.js";
import { classifyFailure, eveMayResume, type Recommendation } from "./jev.js";
import { postReceipt } from "./receipt.js";
import { readState, type State, saveState } from "./store.js";

export type Classification =
  | (Recommendation & { resumed?: boolean })
  | { status: "no_batch"; attention: "owner" | "eve"; result?: Recommendation }
  | { status: "no_blocked_failure" };

function stageOf(state: State): "dispatch" | "build" | "review" | "integration" {
  const phase = state.batch?.active?.phase;
  if (phase === "integrated-review" || phase === "deployed-review") return "integration";
  if (phase === "build" || phase === "review") return phase;
  return state.lastFailure?.stage ?? "dispatch";
}

export async function classifyStoredFailure(
  deps: {
    readState?: typeof readState;
    saveState?: typeof saveState;
    github?: typeof github;
    classify?: typeof classifyFailure;
    postReceipt?: typeof postReceipt;
    workflowOwner?: string;
  } = {},
): Promise<Classification> {
  const read = deps.readState ?? readState;
  const save = deps.saveState ?? saveState;
  const gh = deps.github ?? github;
  const classify = deps.classify ?? classifyFailure;
  const receipt = deps.postReceipt ?? postReceipt;
  const { state, sha } = await read();
  const batch = state.batch;
  if (batch && batch.status === "blocked" && batch.error) {
    const key = `${batch.active?.agentId ?? "none"}:${batch.error}`;
    if (batch.triage?.key === key) return { ...batch.triage.result, resumed: false };
    const used = Math.max(0, ...Object.values(batch.attempts));
    let scopeValid = false;
    try {
      const issue = await gh<Issue>(`/issues/${batch.issue}`);
      const contract = intake(issue.body ?? "");
      scopeValid =
        issue.state === "open" &&
        issue.labels.some((l) => l.name === "factory") &&
        contract.commit === batch.commit &&
        contract.manifest === batch.manifestPath;
    } catch {
      /* Missing evidence is a hold, never permission. */
    }
    const result = await classify({
      stage: stageOf(state),
      code: "batch_blocked",
      summary: batch.error.slice(0, 4000),
      retriesRemaining: Math.max(0, batch.manifest.limits.attempts - used),
      scopeValid,
      budgetAvailable: Date.now() < runDeadline(batch),
    });
    batch.triage = { key, result };
    const resume = eveMayResume(result) && scopeValid;
    if (resume) {
      batch.status = "running";
      batch.error = undefined;
      if (deps.workflowOwner) batch.workflowOwner = deps.workflowOwner;
    }
    await save(state, sha);
    await receipt(batch.issue, {
      event: resume ? "jev-eve-resume" : "classified",
      status: batch.status,
      phase: batch.active?.phase,
      agentId: batch.active?.agentId,
      runId: batch.active?.runId,
      candidate: batch.candidate,
      error: resume ? undefined : batch.error,
      attention: result.attention,
      recommendation: result.recommendation,
    });
    return { ...result, resumed: resume };
  }
  if (state.lastFailure) {
    const failure = state.lastFailure;
    const result = await classify({
      stage: failure.stage,
      code: "batch_blocked",
      summary: failure.error.slice(0, 4000),
      retriesRemaining: 1,
      scopeValid: true,
      budgetAvailable: true,
    });
    await receipt(failure.issue, {
      event: "classified",
      status: "blocked",
      error: failure.error,
      attention: result.attention,
      recommendation: result.recommendation,
    });
    return { status: "no_batch", attention: result.attention, result };
  }
  return { status: "no_batch", attention: "owner" };
}

export function continuesStations(result: Classification) {
  return "resumed" in result && result.resumed === true;
}
