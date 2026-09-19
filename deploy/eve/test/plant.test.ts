import { describe, expect, test } from "bun:test";
import { parseReview } from "../agent/lib/contract.js";
import { stationFor } from "../agent/lib/cursor.js";
import { attentionFor, classifyFailure, eveMayResume } from "../agent/lib/jev.js";
import { formatReceipt } from "../agent/lib/receipt.js";
import { archiveBatch, isAuthorizedResume, type State } from "../agent/lib/store.js";
import { classifyStoredFailure } from "../agent/lib/triage.js";

describe("Jev routes owner vs Eve", () => {
  test("repair and retry_read belong to Eve; ask_owner and stop belong to the owner", () => {
    expect(attentionFor("repair")).toBe("eve");
    expect(attentionFor("retry_read")).toBe("eve");
    expect(attentionFor("investigate")).toBe("eve");
    expect(attentionFor("ask_owner")).toBe("owner");
    expect(attentionFor("stop")).toBe("owner");
  });
  test("Eve may resume only repair and retry_read", async () => {
    const repair = await classifyFailure(
      {
        stage: "build",
        code: "check_failed",
        summary: "wrong order",
        retriesRemaining: 1,
        scopeValid: true,
        budgetAvailable: true,
      },
      async () => ({ choice: "repair" }),
    );
    expect(repair.attention).toBe("eve");
    expect(repair.execution).toBe("hold");
    expect(eveMayResume(repair)).toBe(true);
    const investigate = await classifyFailure(
      {
        stage: "dispatch",
        code: "batch_blocked",
        summary: "GitHub HTTP 404 reading docs/x at abc",
        retriesRemaining: 1,
        scopeValid: true,
        budgetAvailable: true,
      },
      async () => ({ choice: "investigate" }),
    );
    expect(investigate.attention).toBe("eve");
    expect(eveMayResume(investigate)).toBe(false);
  });
  test("scope failure is owner attention without calling the model", async () => {
    const result = await classifyFailure(
      {
        stage: "dispatch",
        code: "batch_blocked",
        summary: "label removed",
        retriesRemaining: 1,
        scopeValid: false,
        budgetAvailable: true,
      },
      async () => ({ choice: "repair" }),
    );
    expect(result.recommendation).toBe("stop");
    expect(result.attention).toBe("owner");
  });
});

test("classifyStoredFailure never 403s when idle", async () => {
  const result = await classifyStoredFailure({
    readState: async () => ({ state: { version: 1 } }),
  });
  expect(result).toEqual({ status: "no_batch", attention: "owner" });
});

test("Eve repair resumes the reserved batch", async () => {
  const state: State = {
    version: 1,
    batch: {
      issue: 8,
      intakeHash: "x",
      commit: "a".repeat(40),
      manifestPath: "docs/batch.json",
      startedAt: Date.now(),
      status: "blocked",
      error: "check failed",
      candidate: "a".repeat(40),
      accepted: [],
      attempts: { select: 1 },
      evidence: [],
      manifest: {
        version: 1,
        id: "mvp",
        base: "a".repeat(40),
        approval: "ok",
        verification: "cursor-cloud",
        specFiles: ["docs/coverage.json"],
        coverageFile: "docs/coverage.json",
        setup: [],
        worker: { kind: "cursor", repository: "https://github.com/acme/product" },
        limits: { attempts: 3, jobSeconds: 600, runSeconds: 3600 },
        jobs: [],
        combinedChecks: [["bun", "test"]],
      },
    },
  };
  const receipts: unknown[] = [];
  const result = await classifyStoredFailure({
    readState: async () => ({ state, sha: "1" }),
    saveState: async (next) => {
      Object.assign(state, next);
      return "2";
    },
    github: async () =>
      ({
        state: "open",
        labels: [{ name: "factory" }],
        body:
          "```factory-batch\n" +
          JSON.stringify({ commit: "a".repeat(40), manifest: "docs/batch.json" }) +
          "\n```",
      }) as never,
    classify: async () =>
      classifyFailure(
        {
          stage: "build",
          code: "batch_blocked",
          summary: "check failed",
          retriesRemaining: 2,
          scopeValid: true,
          budgetAvailable: true,
        },
        async () => ({ choice: "repair" }),
      ),
    postReceipt: async (_issue, receipt) => {
      receipts.push(receipt);
    },
  });
  expect(result).toMatchObject({ attention: "eve", recommendation: "repair", resumed: true });
  expect(state.batch?.status).toBe("running");
  expect(receipts[0]).toMatchObject({ event: "jev-eve-resume", attention: "eve" });
});

test("stale batches archive instead of blocking the next label", () => {
  const state: State = {
    version: 1,
    batch: {
      issue: 4,
      intakeHash: "old",
      commit: "a".repeat(40),
      manifestPath: "docs/old.json",
      startedAt: 0,
      status: "blocked",
      error: "GitHub HTTP 404",
      candidate: "a".repeat(40),
      accepted: [],
      attempts: {},
      evidence: [],
      manifest: {
        version: 1,
        id: "old",
        base: "a".repeat(40),
        approval: "ok",
        verification: "cursor-cloud",
        specFiles: ["docs/coverage.json"],
        coverageFile: "docs/coverage.json",
        setup: [],
        worker: { kind: "cursor", repository: "https://github.com/acme/product" },
        limits: { attempts: 1, jobSeconds: 600, runSeconds: 3600 },
        jobs: [],
        combinedChecks: [["bun", "test"]],
      },
    },
  };
  archiveBatch(state, "superseded by authorized start");
  expect(state.batch).toBeUndefined();
  expect(state.history?.[0]?.issue).toBe(4);
  expect(state.history?.[0]?.reason).toContain("superseded");
});

test("reviewer cannot invent criterion IDs", () => {
  const commit = "a".repeat(40);
  expect(() =>
    parseReview(
      {
        commit,
        verdict: "approve",
        unchanged: true,
        findings: [],
        checks: [{ command: ["bun", "test"], exitCode: 0, evidence: "ok" }],
        criteria: [{ step: "invented", passed: true, evidence: "no" }],
      },
      commit,
      [["bun", "test"]],
      ["loan-created"],
    ),
  ).toThrow("invented criterion");
});

test("request_changes needs findings and is not an approval", () => {
  const commit = "a".repeat(40);
  const parsed = parseReview(
    {
      commit,
      verdict: "request_changes",
      unchanged: true,
      findings: ["empty state missing"],
      checks: [{ command: ["bun", "test"], exitCode: 1, evidence: "failed" }],
      criteria: [{ step: "loan-created", passed: false, evidence: "missing row" }],
    },
    commit,
    [["bun", "test"]],
    ["loan-created"],
  );
  expect(parsed.verdict).toBe("request_changes");
});

test("review station uses a different vendor and plan mode", () => {
  expect(stationFor("build")).toMatchObject({ mode: "agent", model: { id: "grok-4.6" } });
  expect(stationFor("review")).toMatchObject({
    mode: "plan",
    model: { id: "claude-4.6-sonnet-thinking" },
  });
  expect(stationFor("review").model).not.toHaveProperty("params");
});

test("Jev-orphaned running batch can be adopted by the next authorized label", () => {
  const batch = {
    issue: 10,
    intakeHash: "x",
    status: "running" as const,
    error: undefined,
    triage: {
      key: "agent:Cursor HTTP 400",
      result: {
        version: 1 as const,
        evidenceHash: "h",
        model: "typesafe-ai/jev" as const,
        mode: "shadow" as const,
        status: "evaluated" as const,
        recommendation: "retry_read" as const,
        attention: "eve" as const,
        execution: "hold" as const,
      },
    },
  };
  expect(isAuthorizedResume(batch as never, 10, "x")).toBe(true);
  expect(
    isAuthorizedResume({ ...batch, status: "running", triage: undefined } as never, 10, "x"),
  ).toBe(false);
  expect(isAuthorizedResume({ ...batch, status: "blocked" } as never, 10, "x")).toBe(true);
});

test("receipts name the issue, station, and who must act", () => {
  expect(
    formatReceipt({
      event: "blocked",
      issue: 8,
      status: "blocked",
      error: "GitHub HTTP 404 reading docs/x at abc",
      attention: "owner",
    }),
  ).toContain("Attention: owner");
});
