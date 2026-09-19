import { defineTool } from "eve/tools";
import { z } from "zod";
import { readState } from "../lib/store.js";
import { intakeIssueNumber, isTrusted } from "../lib/trust.js";
export default defineTool({
  description: "Read current batch progress and verified evidence without dispatching work.",
  inputSchema: z.object({}),
  async execute(_, ctx) {
    const auth = ctx.session.auth.current;
    if (!isTrusted(auth) && intakeIssueNumber(auth) === null) throw new Error("Access denied");
    const { state } = await readState();
    const b = state.batch;
    if (!b)
      return {
        status: "idle",
        lastFailure: state.lastFailure,
        attention: state.lastFailure ? "owner" : undefined,
      };
    if (!isTrusted(auth) && intakeIssueNumber(auth) !== b.issue)
      throw new Error("Batch access denied");
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
  },
});
