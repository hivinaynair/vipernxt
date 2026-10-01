import { defineWorkflowTool, type WorkflowStepToolContext } from "eve/tools";
import { z } from "zod";
import { flushOwnerNotification } from "../lib/notify-owner.js";
import { runBatch } from "../lib/run-batch.js";
import { classifyStoredFailure } from "../lib/triage.js";

export default defineWorkflowTool({
  description:
    "Record one advisory Jev classification from stored state. If Eve may resume, this tool continues the durable Cursor loop itself — do not call start_batch after it. Does not approve work, reset budgets, or invent scope.",
  inputSchema: z.object({}),
  execution: "background",
  async execute(_, ctx) {
    "use workflow";
    const result = await classify(ctx);
    if (!("resumed" in result) || result.resumed !== true) {
      await flushOwnerNotification();
      return result;
    }
    return runBatch(ctx);
  },
});

async function classify(ctx: WorkflowStepToolContext) {
  "use step";
  return classifyStoredFailure({ workflowOwner: ctx.callId });
}
