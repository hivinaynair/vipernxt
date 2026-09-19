import { defineTool } from "eve/tools";
import { z } from "zod";
import { classifyStoredFailure } from "../lib/triage.js";

export default defineTool({
  description:
    "Record one advisory Jev classification. Routes the block to the owner or to Eve. Does not approve work, reset budgets, or invent scope. Evidence comes from stored state, not model arguments.",
  inputSchema: z.object({}),
  async execute() {
    return classifyStoredFailure();
  },
});
