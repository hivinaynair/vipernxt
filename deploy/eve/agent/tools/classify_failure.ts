import { defineWorkflowTool, type WorkflowStepToolContext } from "eve/tools";
import { z } from "zod";
import { flushOwnerNotification } from "../lib/notify-owner.js";
import { runBatch } from "../lib/run-batch.js";
import { classifyStoredFailure } from "../lib/triage.js";

export default defineWorkflowTool({
  description:
    "Classify stored failure with Jev; safe recovery continues here. Do not call start_batch afterward. Never changes scope, approval or budgets.",
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
