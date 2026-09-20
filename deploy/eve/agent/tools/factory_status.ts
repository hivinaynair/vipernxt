import { defineTool } from "eve/tools";
import { z } from "zod";
import { factoryProgress } from "../lib/progress.js";
import { readState } from "../lib/store.js";
import { intakeIssueNumber, isTrusted } from "../lib/trust.js";
export default defineTool({
  description:
    "Read current batch progress for a mention. On a factory-labeled dispatch session this only tells you to call start_batch — it does not start, adopt, or skip the batch.",
  inputSchema: z.object({}),
  async execute(_, ctx) {
    const auth = ctx.session.auth.current;
    if (!isTrusted(auth) && intakeIssueNumber(auth) === null) throw new Error("Access denied");
    const { state } = await readState();
    const progress = factoryProgress(auth, state);
    if (progress.status !== "dispatch_required" && "issue" in progress && progress.issue) {
      if (!isTrusted(auth) && intakeIssueNumber(auth) !== progress.issue)
        throw new Error("Batch access denied");
    }
    return progress;
  },
});
