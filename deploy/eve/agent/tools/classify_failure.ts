import { defineTool } from "eve/tools";
import { z } from "zod";
import { intake } from "../lib/contract.js";
import { github, type Issue } from "../lib/github.js";
import { classifyFailure } from "../lib/jev.js";
import { readState, saveState } from "../lib/store.js";
import { intakeIssueNumber, isTrusted } from "../lib/trust.js";

export default defineTool({
  description:
    "Record one advisory Jev classification for the current blocked batch. Does not retry, approve or change execution. Evidence comes from stored state, not model arguments.",
  inputSchema: z.object({}),
  async execute(_, ctx) {
    const { state, sha } = await readState();
    const batch = state.batch;
    const auth = ctx.session.auth.current;
    if (!batch || (!isTrusted(auth) && intakeIssueNumber(auth) !== batch.issue))
      throw new Error("Batch access denied");
    if (batch.status !== "blocked" || !batch.error) return { status: "no_blocked_failure" };
    const key = `${batch.active?.agentId ?? "none"}:${batch.error}`;
    if (batch.triage?.key === key) return batch.triage.result;
    const used = Math.max(0, ...Object.values(batch.attempts));
    let scopeValid = false;
    try {
      const issue = await github<Issue>(`/issues/${batch.issue}`);
      const contract = intake(issue.body ?? "");
      scopeValid =
        issue.state === "open" &&
        issue.labels.some((l) => l.name === "factory") &&
        contract.commit === batch.commit &&
        contract.manifest === batch.manifestPath;
    } catch {
      /* Missing evidence is a hold, never permission. */
    }
    const result = await classifyFailure({
      stage:
        batch.active?.phase === "integrated-review"
          ? "integration"
          : (batch.active?.phase ?? "dispatch"),
      code: "batch_blocked",
      summary: batch.error.slice(0, 4000),
      retriesRemaining: Math.max(0, batch.manifest.limits.attempts - used),
      scopeValid,
      budgetAvailable: Date.now() < batch.startedAt + batch.manifest.limits.runSeconds * 1000,
    });
    batch.triage = { key, result };
    await saveState(state, sha);
    return result;
  },
});
