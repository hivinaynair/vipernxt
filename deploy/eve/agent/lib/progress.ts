import type { SessionAuthContext } from "eve/context";
import type { State } from "./store.js";
import { intakeIssueNumber } from "./trust.js";

export function factoryProgress(auth: SessionAuthContext | null, state: State) {
  const issue = intakeIssueNumber(auth);
  if (issue)
    return {
      status: "dispatch_required" as const,
      issue,
      nextTool: "start_batch" as const,
      message:
        "This is a factory label session. Call start_batch now. Reading status does not start or adopt a batch.",
    };
  const b = state.batch;
  if (!b)
    return {
      status: "idle" as const,
      lastFailure: state.lastFailure,
      attention: state.lastFailure ? ("owner" as const) : undefined,
    };
  return {
    status: b.status,
    issue: b.issue,
    accepted: b.accepted,
    total: b.manifest.jobs.length,
    phase: b.active?.phase,
    error: b.error,
    pr: b.pr,
    candidate: b.candidate,
    deployment: b.deployment,
    deployedAcceptance: b.deployedReview,
    attention: b.triage?.result.attention,
    triage: b.triage?.result,
    lastFailure: state.lastFailure,
  };
}
