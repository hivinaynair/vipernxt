import { expect, test } from "bun:test";
import { advanceStations } from "../agent/lib/advance-stations.js";
import { digest } from "../agent/lib/contract.js";
import { tick } from "../agent/lib/engine.js";
import { GitHubError } from "../agent/lib/github.js";
import { investigateFailure } from "../agent/lib/investigation.js";
import { classifyFailure, type Evaluator } from "../agent/lib/jev.js";
import type { Batch, State } from "../agent/lib/store.js";
import { classifyStoredFailure, recoveryBudget } from "../agent/lib/triage.js";

const base = "a".repeat(40),
  candidate = "b".repeat(40);
const source = { commit: base, manifest: "docs/batch.json" };
const certain = (choice: string) => ({
  choice,
  probabilities: {
    retry_read: choice === "retry_read" ? 1 : 0,
    repair: choice === "repair" ? 1 : 0,
    investigate: choice === "investigate" ? 1 : 0,
    ask_owner: choice === "ask_owner" ? 1 : 0,
    stop: choice === "stop" ? 1 : 0,
  },
});
function fixture() {
  let state: State = {
    version: 1,
    batch: {
      workflowOwner: "call-one",
      issue: 1,
      intakeHash: digest(source),
      commit: base,
      manifestPath: source.manifest,
      startedAt: Date.now(),
      status: "running",
      candidate: base,
      accepted: [],
      attempts: { loan: 1, unrelated: 3 },
      evidence: [],
      readiness: { sha256: "h", scope: "first-slice", approval: "approved" },
      active: {
        agentId: "bc-original",
        runId: "run-original",
        phase: "review",
        base: candidate,
        candidate,
        branch: "cursor/loan",
        startedAt: Date.now(),
        posted: true,
      },
      manifest: {
        version: 1,
        id: "pilot",
        base,
        approval: "approved",
        verification: "cursor-cloud",
        specFiles: ["docs/coverage.json"],
        coverageFile: "docs/coverage.json",
        requirementsFile: "docs/readiness.json",
        setup: [],
        worker: { kind: "cursor", repository: "https://github.com/acme/product" },
        limits: { attempts: 3, jobSeconds: 600, runSeconds: 3600 },
        jobs: [
          {
            id: "loan",
            title: "Loan",
            instructions: "Approved loan behavior",
            steps: ["J1.S1"],
            dependsOn: [],
            paths: ["apps"],
            checks: [["bun", "test"]],
            requiresBrowser: false,
          },
        ],
        combinedChecks: [["bun", "run", "check-types"]],
      },
      coverage: {
        version: 1,
        approval: "approved",
        scope: "first-slice",
        spineFile: "docs/spine.yaml",
        exclusions: [],
        foundations: {},
        integrated: { checks: [["bun", "run", "test:journeys"]] },
        requirements: [
          {
            id: "loan-created",
            step: "J1.S1",
            criterion: "Loan persists",
            dependsOn: [],
            delivery: { kind: "job", job: "loan" },
          },
        ],
      },
    },
  };
  let revision = 0,
    authorized = true,
    failRead = false,
    failRemote = false;
  let model: Evaluator = async () => certain("investigate");
  let remoteStatus = "RUNNING";
  let reads = 0,
    modelCalls = 0;
  const receipts: { event: string; attention?: string }[] = [];
  const identities: string[] = [];
  const readState = async () => ({ state: structuredClone(state), sha: String(revision) });
  const saveState = async (next: State, previous?: string) => {
    if (previous !== String(revision)) throw new Error("checkpoint conflict");
    state = structuredClone(next);
    return String(++revision);
  };
  const github = async <T>(path: string, method = "GET"): Promise<T> => {
    if (path === "/issues/1") {
      if (failRead) {
        failRead = false;
        throw new TypeError("fetch failed");
      }
      return {
        state: "open",
        labels: authorized ? [{ name: "factory" }] : [],
        body: "```factory-batch\n" + JSON.stringify(source) + "\n```",
      } as T;
    }
    if (path === "/git/refs" && method === "POST") return {} as T;
    if (path.startsWith("/compare/"))
      return { status: "ahead", files: [{ filename: "apps/loan.ts" }] } as T;
    if (path.startsWith("/pulls?")) return [] as T;
    if (path === "/pulls" && method === "POST")
      return { html_url: "https://github.com/acme/product/pull/2" } as T;
    throw new Error(`Unexpected request ${method} ${path}`);
  };
  const postReceipt = async (_issue: number, receipt: { event: string; attention?: string }) => {
    receipts.push(receipt);
  };
  const deps = {
    readState,
    saveState,
    github,
    postReceipt,
    repository: () => "acme/product",
    required: () => "staging",
    head: async (ref: string) =>
      ref === "staging"
        ? base
        : ref.startsWith("factory/input/")
          ? state.batch!.active!.base
          : candidate,
    advanceRemote: async (a: NonNullable<Batch["active"]>) => {
      identities.push(a.agentId);
      if (failRemote) {
        failRemote = false;
        throw new TypeError("fetch failed");
      }
      const integrated = a.phase === "integrated-review";
      return {
        id: a.runId ?? "run-new",
        agentId: a.agentId,
        status: "FINISHED",
        git: { branches: [{ repoUrl: "https://github.com/acme/product", branch: "cursor/loan" }] },
        result: JSON.stringify({
          commit: candidate,
          verdict: "approve",
          unchanged: true,
          findings: [],
          checks: (integrated
            ? [
                ["bun", "run", "test:journeys"],
                ["bun", "run", "check-types"],
              ]
            : [["bun", "test"]]
          ).map((command) => ({ command, exitCode: 0, evidence: "Observed pass" })),
          criteria: [
            { step: "loan-created", passed: true, evidence: "Observed approved behavior" },
          ],
        }),
      };
    },
  };
  const triage = async (options: Parameters<typeof classifyStoredFailure>[0] = {}) =>
    classifyStoredFailure({
      ...deps,
      ...options,
      classify: (failure) =>
        classifyFailure(failure, async (f) => {
          modelCalls++;
          return model(f);
        }),
      investigate: (batch) =>
        investigateFailure(batch, async <T>(path: string): Promise<T> => {
          reads++;
          const a = batch.active!;
          if (path === `/agents/${a.agentId}`)
            return { id: a.agentId, latestRunId: a.runId ?? "run-new" } as T;
          return { id: a.runId ?? "run-new", agentId: a.agentId, status: remoteStatus } as T;
        }),
    });
  const advance = () =>
    advanceStations("call-one", {
      readState,
      postReceipt,
      tick: () => tick(deps),
      classify: triage,
    });
  const block = (
    error: string,
    operation: NonNullable<Batch["failure"]>["operation"] = "remote",
  ) => {
    state.batch!.status = "blocked";
    state.batch!.error = error;
    state.batch!.failure = { code: "transition_failed", operation, jobId: "loan" };
  };
  return {
    state: () => state,
    deps,
    triage,
    advance,
    block,
    receipts,
    identities,
    setModel: (next: Evaluator) => {
      model = next;
    },
    setAuthorized: (next: boolean) => {
      authorized = next;
    },
    failRead: () => {
      failRead = true;
      state.batch!.networkRetries = { "bc-original": 3 };
    },
    failRemote: () => {
      failRemote = true;
      state.batch!.active!.posted = undefined;
      state.batch!.active!.runId = undefined;
      state.batch!.networkRetries = { "bc-original": 3 };
    },
    setRemote: (status: string) => {
      remoteStatus = status;
    },
    counts: () => ({ reads, modelCalls }),
  };
}

test("automatic read recovery reaches accepted delivery without an owner notification", async () => {
  const f = fixture();
  f.failRead();
  const start = f.state().batch!.startedAt,
    stage = f.state().batch!.active!.startedAt;
  await f.advance();
  expect(f.state().batch!.triage?.resumed).toBe(true);
  expect(f.state().batch!.active!.startedAt).toBe(stage);
  for (let i = 0; i < 7 && f.state().batch!.status === "running"; i++) await f.advance();
  expect(f.state().batch!.accepted).toEqual(["loan"]);
  expect(f.state().batch!.integratedReview?.commit).toBe(candidate);
  expect(f.state().batch!.pr).toContain("/pull/2");
  expect(f.state().batch!.startedAt).toBe(start);
  expect(f.receipts.some((r) => r.attention === "owner")).toBe(false);
});

test("lost launch response is investigated and reuses the same identity before acceptance", async () => {
  const f = fixture();
  f.failRemote();
  f.setModel(async () => certain(f.counts().modelCalls === 1 ? "investigate" : "retry_read"));
  await f.advance();
  expect(f.counts()).toEqual({ reads: 2, modelCalls: 2 });
  expect(f.state().batch!.triage?.investigation?.action).toBe("reconcile");
  expect(f.state().batch!.active!.agentId).toBe("bc-original");
  await f.advance();
  expect(f.state().batch!.accepted).toEqual(["loan"]);
  expect(f.identities).toEqual(["bc-original", "bc-original"]);
  expect(f.receipts.some((r) => r.attention === "owner")).toBe(false);
});

test("verified terminal builder recovery launches a replacement inside the original clock", async () => {
  const f = fixture();
  const b = f.state().batch!;
  b.active!.phase = "build";
  b.active!.base = base;
  const clock = b.active!.startedAt;
  f.block("Cursor build ended with ERROR");
  f.setRemote("ERROR");
  await f.advance();
  expect(f.state().batch!.active).toBeUndefined();
  await f.advance();
  expect(f.state().batch!.active!.agentId).not.toBe("bc-original");
  expect(f.state().batch!.active!.startedAt).toBe(clock);
  expect(f.state().batch!.attempts.loan).toBe(2);
  await f.advance();
  await f.advance();
  expect(f.state().batch!.accepted).toEqual(["loan"]);
  expect(f.receipts.some((r) => r.attention === "owner")).toBe(false);
});

for (const defect of [
  "attempts",
  "station-clock",
  "run-clock",
  "authorization",
  "credentials",
  "rejected-review",
  "review-format-budget",
])
  test(`${defect} holds for the owner without diagnostic or worker launches`, async () => {
    const f = fixture();
    const b = f.state().batch!;
    f.block("Cursor build ended with ERROR");
    if (defect === "attempts") {
      b.active!.phase = "build";
      b.attempts.loan = 3;
    }
    if (defect === "station-clock") b.active!.startedAt = 1;
    if (defect === "run-clock") b.startedAt = 1;
    if (defect === "authorization") f.setAuthorized(false);
    if (defect === "credentials") b.error = "Cursor HTTP 401 Unauthorized";
    if (defect === "rejected-review")
      b.error = "Independent review reject: missing business policy";
    if (defect === "review-format-budget") b.unreadable = { [`review:loan:${candidate}`]: 2 };
    await f.advance();
    expect(f.state().batch!.status).toBe("blocked");
    expect(f.receipts.at(-1)?.attention).toBe("owner");
    expect(f.counts()).toEqual({ reads: 0, modelCalls: 0 });
    expect(f.identities).toEqual([]);
  });

test("low confidence gets one diagnostic pass then an owner hold", async () => {
  const f = fixture();
  f.block("A worker transition failed");
  f.setModel(async () => ({
    choice: "repair",
    probabilities: { repair: 0.45, retry_read: 0.3, investigate: 0.25, ask_owner: 0, stop: 0 },
  }));
  await f.advance();
  expect(f.counts()).toEqual({ reads: 2, modelCalls: 2 });
  expect(f.state().batch!.status).toBe("blocked");
  expect(f.receipts.at(-1)?.attention).toBe("owner");
  await f.advance();
  expect(f.counts()).toEqual({ reads: 2, modelCalls: 2 });
});

test("model outage and inconclusive remote evidence cannot loop or resume", async () => {
  const f = fixture();
  f.block("Worker transition failed");
  f.setRemote("UNKNOWN");
  f.setModel(async () => {
    throw new Error("secret-token");
  });
  await f.advance();
  await f.advance();
  expect(f.state().batch!.status).toBe("blocked");
  expect(f.counts()).toEqual({ reads: 2, modelCalls: 2 });
  expect(JSON.stringify(f.state())).not.toContain("secret-token");
  expect(f.receipts.at(-1)?.attention).toBe("owner");
});

test("authorization removed during diagnostic evaluation prevents resumption", async () => {
  const f = fixture();
  f.block("Worker transition failed");
  f.setModel(async () => {
    f.setAuthorized(false);
    return certain("repair");
  });
  f.setRemote("ERROR");
  await f.advance();
  expect(f.state().batch!.status).toBe("blocked");
  expect(f.state().batch!.active?.agentId).toBe("bc-original");
  expect(f.receipts.at(-1)?.attention).toBe("owner");
});

test("unrelated exhausted job does not consume this phase's recovery budget", () => {
  const f = fixture();
  f.state().batch!.active!.phase = "build";
  expect(recoveryBudget(f.state().batch!).remaining).toBe(2);
});

test("uncertain write without reconcilable remote evidence never authorizes another write", async () => {
  const f = fixture();
  f.block("GitHub HTTP 502 POST /pulls", "write");
  f.setModel(async () => certain("retry_read"));
  await f.advance();
  expect(f.state().batch!.status).toBe("blocked");
  expect(f.state().batch!.triage?.investigation?.action).toBe("unresolved");
  expect(f.identities).toEqual([]);
});

test("diagnostic remote identity mismatch cannot produce a recovery action", async () => {
  const f = fixture();
  f.block("Lost launch response");
  let calls = 0;
  const facts = await investigateFailure(f.state().batch!, async <T>() => {
    calls++;
    return { id: "different-agent", latestRunId: "different-run" } as T;
  });
  expect(facts.action).toBe("unresolved");
  expect(calls).toBe(1);
});

test("triage outage reaches the owner instead of silently abandoning the workflow", async () => {
  const f = fixture();
  f.block("A failure");
  await advanceStations("call-one", {
    readState: f.deps.readState,
    tick: async () => {},
    classify: async () => {
      throw new GitHubError(503);
    },
    postReceipt: f.deps.postReceipt,
  });
  expect(f.receipts.at(-1)).toMatchObject({ event: "triage-unavailable", attention: "owner" });
});

test("obsolete workflow cannot classify or page its successor", async () => {
  const f = fixture();
  f.block("A failure");
  let calls = 0;
  await advanceStations("old-owner", {
    readState: f.deps.readState,
    tick: async () => {
      calls++;
    },
    classify: async () => {
      calls++;
      return { status: "no_blocked_failure" };
    },
    postReceipt: f.deps.postReceipt,
  });
  expect(calls).toBe(0);
  expect(f.receipts).toEqual([]);
});

test("cached owner decision is invalidated when phase budgets change", async () => {
  const f = fixture();
  f.block("Cursor build ended with ERROR");
  f.state().batch!.active!.phase = "build";
  f.state().batch!.attempts.loan = 3;
  await f.triage();
  expect(f.state().batch!.status).toBe("blocked");
  f.state().batch!.attempts.loan = 2; // simulate an explicit corrected checkpoint
  f.setRemote("ERROR");
  await f.triage();
  expect(f.state().batch!.status).toBe("running");
});

test("compare-and-swap prevents classification from overwriting a concurrent pause", async () => {
  const f = fixture();
  f.block("Worker transition failed");
  f.setRemote("ERROR");
  f.setModel(async () => {
    const snapshot = await f.deps.readState();
    snapshot.state.batch!.status = "paused";
    await f.deps.saveState(snapshot.state, snapshot.sha);
    return certain("repair");
  });
  await f.advance();
  expect(f.state().batch!.status).toBe("paused");
  expect(f.state().batch!.active!.agentId).toBe("bc-original");
  expect(f.state().batch!.recoveryAttempts).toBeUndefined();
});

test("busy triage lease neither starts diagnostics nor pages the owner", async () => {
  const f = fixture();
  f.block("Worker transition failed");
  f.state().lease = { owner: "other-transition", until: Date.now() + 300000 };
  await f.advance();
  expect(f.counts()).toEqual({ reads: 0, modelCalls: 0 });
  expect(f.receipts).toEqual([]);
});

test("an expired replacement stage cannot launch a worker", async () => {
  const f = fixture();
  f.state().batch!.active!.phase = "build";
  f.state().batch!.active!.posted = undefined;
  f.state().batch!.active!.startedAt = 1;
  await f.advance();
  expect(f.state().batch!.status).toBe("blocked");
  expect(f.identities).toEqual([]);
  expect(f.receipts.at(-1)?.attention).toBe("owner");
});

test("repeated recoverable reads stop after two automatic continuations", async () => {
  const f = fixture();
  for (let i = 0; i < 3; i++) {
    f.block("fetch failed", "read");
    f.state().batch!.failure!.code = "read_transient";
    await f.advance();
    expect(f.state().batch!.status).toBe(i < 2 ? "running" : "blocked");
  }
  expect(Object.values(f.state().batch!.recoveryAttempts!)).toEqual([2]);
  expect(f.receipts.filter((r) => r.attention === "owner")).toHaveLength(1);
});

test("last builder attempt can reconcile a read without buying a new builder", async () => {
  const f = fixture();
  const b = f.state().batch!;
  b.active!.phase = "build";
  b.attempts.loan = 3;
  f.failRead();
  await f.advance();
  expect(f.state().batch!.status).toBe("running");
  expect(f.state().batch!.attempts.loan).toBe(3);
  expect(f.state().batch!.active!.agentId).toBe("bc-original");
});
