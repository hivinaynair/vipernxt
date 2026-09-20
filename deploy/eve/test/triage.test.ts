import { expect, test } from "bun:test";
import { digest } from "../agent/lib/contract.js";
import type { Recommendation } from "../agent/lib/jev.js";
import type { Batch, State } from "../agent/lib/store.js";
import { classifyStoredFailure } from "../agent/lib/triage.js";

const repair: Recommendation = {
  version: 1,
  evidenceHash: "x",
  model: "typesafe-ai/jev",
  mode: "shadow",
  status: "evaluated",
  recommendation: "repair",
  attention: "eve",
  execution: "hold",
};

test("missing batch is no_batch, never access denied", async () => {
  const result = await classifyStoredFailure({
    readState: async () => ({ state: { version: 1 } }),
    saveState: async () => "1",
    github: async () => {
      throw new Error("unused");
    },
    classify: async () => repair,
    postReceipt: async () => {},
  });
  expect(result).toEqual({ status: "no_batch", attention: "owner" });
});

test("lastFailure still classifies so Eve can decide attention", async () => {
  const receipts: string[] = [];
  const result = await classifyStoredFailure({
    readState: async () => ({
      state: {
        version: 1,
        lastFailure: {
          at: 1,
          issue: 8,
          stage: "dispatch",
          error: "GitHub HTTP 404 reading docs/batch.json at aaaa",
        },
      },
    }),
    saveState: async () => "1",
    github: async () => {
      throw new Error("unused");
    },
    classify: async () => repair,
    postReceipt: async (_issue, receipt) => {
      receipts.push(`${receipt.attention}:${receipt.recommendation}`);
    },
  });
  expect(result).toMatchObject({ status: "no_batch", attention: "eve" });
  expect(receipts).toEqual(["eve:repair"]);
});

test("blocked batch records Jev attention without requiring a principal", async () => {
  const source = { commit: "a".repeat(40), manifest: "docs/batch.json" };
  const batch = {
    issue: 8,
    intakeHash: digest(source),
    commit: source.commit,
    manifestPath: source.manifest,
    startedAt: Date.now(),
    status: "blocked",
    error: "Cursor stage ended with ERROR",
    candidate: source.commit,
    accepted: [],
    attempts: { loan: 1 },
    evidence: [],
    manifest: {
      version: 1,
      id: "mvp",
      base: source.commit,
      approval: "approved",
      verification: "cursor-cloud",
      specFiles: ["docs/coverage.json"],
      coverageFile: "docs/coverage.json",
      setup: [],
      worker: { kind: "cursor", repository: "https://github.com/acme/product" },
      limits: { attempts: 2, jobSeconds: 600, runSeconds: 3600 },
      jobs: [],
      combinedChecks: [["bun", "test"]],
    },
  } as unknown as Batch;
  let state: State = { version: 1, batch };
  const result = await classifyStoredFailure({
    readState: async () => ({ state, sha: "1" }),
    saveState: async (next) => {
      state = next;
      return "2";
    },
    github: async () =>
      ({
        state: "open",
        labels: [{ name: "factory" }],
        body: "```factory-batch\n" + JSON.stringify(source) + "\n```",
      }) as never,
    classify: async () => repair,
    postReceipt: async () => {},
  });
  expect(result).toMatchObject({ attention: "eve", recommendation: "repair" });
  expect(state.batch?.triage?.result.attention).toBe("eve");
});

test("Eve resume continues the durable station loop", async () => {
  const { continuesStations } = await import("../agent/lib/triage.js");
  expect(continuesStations({ ...repair, resumed: true })).toBe(true);
  expect(continuesStations({ ...repair, resumed: false })).toBe(false);
  expect(continuesStations({ status: "no_batch", attention: "owner" })).toBe(false);
});
