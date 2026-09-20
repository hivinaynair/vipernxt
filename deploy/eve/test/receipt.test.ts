import { expect, test } from "bun:test";
import { GitHubError } from "../agent/lib/github.js";
import { formatReceipt, postReceipt } from "../agent/lib/receipt.js";
import { archiveBatch, type State } from "../agent/lib/store.js";

test("receipt names the transition an operator can see without logs", () => {
  const body = formatReceipt({
    event: "classified",
    issue: 8,
    status: "blocked",
    attention: "eve",
    recommendation: "repair",
    error: "GitHub HTTP 404 reading docs/batch.json at aaaa",
  });
  expect(body).toContain("<!-- factory-receipt -->");
  expect(body).toContain("Attention: Eve");
  expect(body).toContain("Jev: repair");
  expect(body).toContain("GitHub HTTP 404 reading docs/batch.json at aaaa");
});

test("comment failure does not throw", async () => {
  await postReceipt(8, { event: "blocked", error: "x" }, async () => {
    throw new GitHubError(500, "POST /issues/8/comments");
  });
});

test("new label archives the previous batch so register can start", () => {
  const state: State = {
    version: 1,
    batch: {
      issue: 4,
      intakeHash: "h",
      commit: "a".repeat(40),
      manifestPath: "docs/batch.json",
      startedAt: 1,
      status: "blocked",
      error: "GitHub HTTP 404",
      candidate: "a".repeat(40),
      accepted: [],
      attempts: {},
      evidence: [],
      manifest: {
        version: 1,
        id: "mvp",
        base: "a".repeat(40),
        approval: "a",
        verification: "cursor-cloud",
        specFiles: ["docs/coverage.json"],
        coverageFile: "docs/coverage.json",
        setup: [],
        worker: { kind: "cursor", repository: "https://github.com/acme/product" },
        limits: { attempts: 1, jobSeconds: 60, runSeconds: 60 },
        jobs: [
          {
            id: "loan",
            title: "Loan",
            instructions: "Loan",
            steps: ["J1.S1"],
            dependsOn: [],
            paths: ["apps"],
            checks: [["bun", "test"]],
            requiresBrowser: false,
          },
        ],
        combinedChecks: [["bun", "test"]],
      },
    },
  };
  archiveBatch(state, "New authorized factory label");
  expect(state.batch).toBeUndefined();
  expect(state.history?.[0]?.issue).toBe(4);
  expect(state.history?.[0]?.reason).toBe("New authorized factory label");
});
