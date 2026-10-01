import { randomUUID } from "node:crypto";
import { digest, intake } from "./contract.js";
import { runDeadline } from "./deployment.js";
import { faultEvaluator } from "./faults.js";
import { github, type Issue } from "./github.js";
import { type Investigation, investigateFailure } from "./investigation.js";
import {
  classifyFailure,
  evaluateFailure,
  eveMayResume,
  type Failure,
  type Recommendation,
} from "./jev.js";
import { assertLease, claim } from "./lease.js";
import { postReceipt } from "./receipt.js";
import { type Batch, readState, type State, saveState } from "./store.js";
export type Classification =
  | (Recommendation & { resumed?: boolean })
  | { status: "no_batch"; attention: "owner" | "eve"; result?: Recommendation }
  | { status: "no_blocked_failure" };
function stageOf(state: State): Failure["stage"] {
  const phase = state.batch?.active?.phase;
  if (phase === "integrated-review" || phase === "deployed-review") return "integration";
  return phase === "build" || phase === "review" ? phase : "dispatch";
}
export function recoveryBudget(b: Batch) {
  const job =
    b.failure?.jobId ??
    (b.integrationRepair?.pending
      ? "__integration_repair__"
      : b.ci?.result === "repair"
        ? "__ci_repair__"
        : b.active?.phase === "deployed-review"
          ? "__deployed_review__"
          : b.active?.phase === "integrated-review"
            ? "__integrated_review__"
            : (b.manifest.jobs.find((j) => !b.accepted.includes(j.id))?.id ?? "delivery"));
  const phase = b.active?.phase ?? "dispatch";
  const key = `${phase}:${job}:${b.active?.base ?? b.candidate}`;
  const reviewKey = `${phase}:${job}:${b.active?.base}`;
  const remaining = Math.max(
    0,
    Math.min(
      2 - (b.recoveryAttempts?.[key] ?? 0),
      b.failure?.operation === "read"
        ? 2
        : phase === "build" || phase === "dispatch"
          ? b.manifest.limits.attempts - (b.attempts[job] ?? 0)
          : 2 - (b.unreadable?.[reviewKey] ?? 0),
    ),
  );
  const startedAt = b.active?.startedAt ?? b.retryStartedAt;
  const deadline = Math.min(
    runDeadline(b),
    startedAt === undefined ? Infinity : startedAt + b.manifest.limits.jobSeconds * 1000,
  );
  return { key, reviewKey, remaining, deadline };
}
export async function classifyStoredFailure(
  deps: {
    readState?: typeof readState;
    saveState?: typeof saveState;
    github?: typeof github;
    classify?: typeof classifyFailure;
    investigate?: typeof investigateFailure;
    postReceipt?: typeof postReceipt;
    workflowOwner?: string;
    automatic?: boolean;
  } = {},
): Promise<Classification> {
  const read = deps.readState ?? readState,
    save = deps.saveState ?? saveState;
  const gh = deps.github ?? github,
    classify = deps.classify ?? classifyFailure;
  const investigate = deps.investigate ?? investigateFailure,
    receipt = deps.postReceipt ?? postReceipt;
  const store = { read, save };
  const initial = await read();
  if (
    !initial.state.batch ||
    initial.state.batch.status !== "blocked" ||
    !initial.state.batch.error
  ) {
    if (initial.state.lastFailure && !initial.state.batch) {
      // No registered approved batch: never fabricate scope or budgets.
      const f = initial.state.lastFailure;
      const result = await classifyFailure({
        stage: f.stage,
        code: "registration_failed",
        summary: f.error.slice(0, 4000),
        retriesRemaining: 0,
        scopeValid: false,
        budgetAvailable: false,
      });
      await receipt(
        f.issue,
        {
          event: "classified",
          status: "blocked",
          error: f.error,
          attention: "owner",
          recommendation: "stop",
        },
        gh,
      );
      return { status: "no_batch", attention: "owner", result };
    }
    return initial.state.batch
      ? { status: "no_blocked_failure" }
      : { status: "no_batch", attention: "owner" };
  }
  if (deps.automatic && initial.state.batch.workflowOwner !== deps.workflowOwner)
    return { status: "no_blocked_failure" };
  const acquired = await claim(store);
  if (!acquired) return { status: "no_blocked_failure" };
  const { state, sha, owner } = acquired;
  let checkpointSha = sha;
  const b = state.batch;
  if (
    !b ||
    b.status !== "blocked" ||
    !b.error ||
    (deps.automatic && b.workflowOwner !== deps.workflowOwner)
  ) {
    state.lease = undefined;
    await save(state, checkpointSha);
    return { status: "no_blocked_failure" };
  }
  async function authorized() {
    try {
      const issue = await gh<Issue>(`/issues/${b!.issue}`);
      return (
        !issue.pull_request &&
        issue.state === "open" &&
        issue.labels.some((l) => l.name === "factory") &&
        digest(intake(issue.body ?? "")) === b!.intakeHash
      );
    } catch {
      return false;
    }
  }
  let scopeValid = await authorized();
  const budget = recoveryBudget(b);
  const failure: Failure = {
    stage: stageOf(state),
    code: b.failure?.code ?? "batch_blocked",
    summary: b.error.slice(0, 4000),
    retriesRemaining: budget.remaining,
    scopeValid,
    budgetAvailable: Date.now() < budget.deadline,
  };
  const key = digest({
    failure,
    budget,
    active: b.active,
    candidate: b.candidate,
    intakeHash: b.intakeHash,
    recoveryAttempts: b.recoveryAttempts,
  });
  if (b.triage?.key === key) {
    await assertLease(store, owner);
    state.lease = undefined;
    await save(state, checkpointSha);
    return { ...b.triage.result, resumed: false };
  }
  let result: Recommendation;
  let investigation: Investigation | undefined;
  let action: Investigation["action"] = "unresolved";
  try {
    const evaluate = faultEvaluator(
      b,
      async () => {
        await assertLease(store, owner);
        checkpointSha = await save(state, checkpointSha);
      },
      evaluateFailure,
    );
    const route = (input: Failure) =>
      deps.classify ? classify(input) : classifyFailure(input, evaluate);
    result = await route(failure);
    if (result.recommendation === "retry_read" && b.failure?.operation === "read")
      action = "reconcile";
    if (
      scopeValid &&
      failure.budgetAvailable &&
      failure.retriesRemaining > 0 &&
      (result.recommendation === "investigate" ||
        result.recommendation === "repair" ||
        (result.recommendation === "retry_read" && action === "unresolved"))
    ) {
      investigation = await investigate(structuredClone(b));
      action = investigation.action;
      // Jev performs one bounded AI diagnostic pass over fetched facts. A
      // recommendation cannot execute without a verified recovery action.
      if (result.recommendation === "investigate")
        result = await route({
          ...failure,
          code: "diagnostic_evidence",
          summary: JSON.stringify({
            original: failure.summary,
            facts: investigation.facts,
            action,
          }).slice(0, 4000),
        });
    }
  } catch {
    result = await classifyFailure({ ...failure, budgetAvailable: false });
  }
  if (eveMayResume(result)) scopeValid = await authorized();
  const resume =
    result.status === "evaluated" &&
    eveMayResume(result) &&
    scopeValid &&
    Date.now() < budget.deadline &&
    budget.remaining > 0 &&
    action !== "unresolved" &&
    (result.recommendation === "repair" || action === "reconcile" || action === "retry-review");
  if (!resume && result.attention === "eve")
    result = { ...result, recommendation: "ask_owner", attention: "owner" };
  if (!scopeValid || Date.now() >= budget.deadline || budget.remaining === 0)
    result = { ...result, recommendation: "stop", attention: "owner" };
  if (resume) {
    b.recoveryAttempts = {
      ...b.recoveryAttempts,
      [budget.key]: (b.recoveryAttempts?.[budget.key] ?? 0) + 1,
    };
    if (action === "retry-build" && b.active) {
      b.feedback = b.error;
      b.retryStartedAt = b.active.startedAt;
      b.active = undefined;
    } else if (action === "retry-review" && b.active) {
      b.feedback = b.error;
      b.unreadable = {
        ...b.unreadable,
        [budget.reviewKey]: (b.unreadable?.[budget.reviewKey] ?? 0) + 1,
      };
      b.active = {
        ...b.active,
        agentId: `bc-${randomUUID()}`,
        runId: undefined,
        posted: undefined,
        startingRef: undefined,
      };
    }
    b.status = "running";
    b.error = undefined;
    if (deps.workflowOwner) b.workflowOwner = deps.workflowOwner;
  }
  b.triage = { key, result, investigation, resumed: resume };
  await assertLease(store, owner);
  state.lease = undefined;
  await save(state, checkpointSha);
  await receipt(
    b.issue,
    {
      event: resume ? "jev-eve-resume" : "classified",
      status: b.status,
      phase: b.active?.phase,
      agentId: b.active?.agentId,
      runId: b.active?.runId,
      candidate: b.candidate,
      error: b.error,
      attention: resume ? "eve" : "owner",
      recommendation: result.recommendation,
    },
    gh,
  );
  return { ...result, resumed: resume };
}
export function continuesStations(result: Classification) {
  return "resumed" in result && result.resumed === true;
}
