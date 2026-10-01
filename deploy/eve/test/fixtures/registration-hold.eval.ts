import { expect, mock } from "bun:test";
import type { State } from "../../agent/lib/store.js";

class FatalError extends Error {
  fatal = true;
  constructor(message: string) {
    super(message);
    this.name = "FatalError";
  }
}
mock.module("workflow", () => ({ FatalError, RetryableError: Error, sleep: async () => {} }));
mock.module("eve/tools", () => ({ defineWorkflowTool: (tool: unknown) => tool }));
mock.module("../../agent/lib/run-batch.js", () => ({
  runBatch: () => {
    throw new Error("Registration hold must not start the driver");
  },
}));
const saved: State[] = [];
const receipts: unknown[] = [];
mock.module("../../agent/lib/store.js", () => ({
  saveState: async (state: State) => {
    saved.push(structuredClone(state));
    return "checkpoint";
  },
  readState: async () => ({ state: { version: 1 }, sha: "prior" }),
  archiveBatch: () => {},
  isAuthorizedResume: () => false,
}));
mock.module("../../agent/lib/receipt.js", () => ({
  postReceipt: async (issue: number, receipt: unknown) => {
    receipts.push({ issue, receipt });
  },
}));
const { failRegister } = await import("../../agent/tools/start_batch.js");
const state: State = { version: 1 };
let failure: unknown;
try {
  await failRegister(
    state,
    "prior",
    37,
    { commit: "pinned", manifest: "fault.json" },
    new Error("Fault intake requires an explicitly enabled simulation campaign"),
  );
} catch (error) {
  failure = error;
}
expect(failure).toBeInstanceOf(FatalError);
expect((failure as FatalError).fatal).toBe(true);
expect(saved).toHaveLength(1);
expect(saved[0].lastFailure).toMatchObject({
  issue: 37,
  stage: "dispatch",
  commit: "pinned",
  manifestPath: "fault.json",
});
expect(saved[0].batch).toBeUndefined();
expect(receipts).toHaveLength(1);
expect(receipts[0]).toMatchObject({
  issue: 37,
  receipt: { status: "blocked", attention: "owner", recommendation: "stop" },
});
console.log("Registration hold is fatal after one checkpoint and owner receipt");
