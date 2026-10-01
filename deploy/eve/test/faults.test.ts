import { afterEach, beforeEach, expect, test } from "bun:test";
import type { Manifest } from "../agent/lib/contract.js";
import type { cursor } from "../agent/lib/cursor.js";
import {
  assertFaultIntake,
  consumeFault,
  faultCursor,
  faultDeploymentRequest,
  faultEvaluator,
} from "../agent/lib/faults.js";
import type { github } from "../agent/lib/github.js";
import type { Batch } from "../agent/lib/store.js";

const names = [
  "FACTORY_REPO",
  "FACTORY_SIMULATION_REPO",
  "FACTORY_BASE_BRANCH",
  "FACTORY_FAULT_CAMPAIGN",
];
let prior: (string | undefined)[];
beforeEach(() => {
  prior = names.map((n) => process.env[n]);
  Object.assign(process.env, {
    FACTORY_REPO: "owner/test",
    FACTORY_SIMULATION_REPO: "owner/test",
    FACTORY_BASE_BRANCH: "staging",
    FACTORY_FAULT_CAMPAIGN: "test-campaign",
  });
});
afterEach(() =>
  names.forEach((n, i) => {
    if (prior[i] === undefined) delete process.env[n];
    else process.env[n] = prior[i];
  }),
);
function fixture(cases: NonNullable<Manifest["faults"]>["cases"]): Batch {
  return {
    active: { agentId: "bc-one", phase: "build", base: "a".repeat(40), startedAt: 1 },
    manifest: {
      simulation: true,
      jobs: [{}, {}],
      limits: { attempts: 2, jobSeconds: 1200, runSeconds: 7200 },
      faults: { campaign: "test-campaign", cases },
    },
  } as Batch;
}
test("fault intake rejects normal, unbound, production and over-budget manifests", () => {
  const b = fixture(["step-replay"]);
  for (const changed of [
    { ...b.manifest, simulation: undefined },
    { ...b.manifest, limits: { ...b.manifest.limits, attempts: 3 } },
  ])
    expect(() => assertFaultIntake(changed as Manifest)).toThrow();
  process.env.FACTORY_BASE_BRANCH = "main";
  expect(() => assertFaultIntake(b.manifest)).toThrow();
  process.env.FACTORY_BASE_BRANCH = "staging";
  process.env.FACTORY_SIMULATION_REPO = "owner/other";
  expect(() => assertFaultIntake(b.manifest)).toThrow();
});
test("disabled or wrong campaign never consumes or injects a fault", () => {
  const b = fixture(["step-replay"]);
  delete process.env.FACTORY_FAULT_CAMPAIGN;
  expect(consumeFault(b, "step-replay", 1)).toBeUndefined();
  expect(b.faultLedger).toBeUndefined();
  process.env.FACTORY_FAULT_CAMPAIGN = "other";
  expect(() => assertFaultIntake(b.manifest)).toThrow();
});
test("consumed faults survive checkpoints and cannot repeat without limit", () => {
  const b = fixture(["step-replay"]);
  consumeFault(b, "step-replay", 1);
  const restored = JSON.parse(JSON.stringify(b)) as Batch;
  expect(consumeFault(restored, "step-replay", 1)).toBeUndefined();
  expect(restored.faultLedger?.["step-replay"]).toMatchObject({
    count: 1,
    agentId: "bc-one",
    originalStartedAt: 1,
  });
});
test("launch reply is discarded only after a real upstream effect and prior checkpoint", async () => {
  const b = fixture(["launch-response-lost"]);
  const order: string[] = [];
  const upstream = (async () => {
    order.push("upstream");
    return { agent: { id: "bc-one" }, run: { id: "run-one" } };
  }) as typeof cursor;
  const call = faultCursor(
    b,
    async () => {
      order.push("checkpoint");
    },
    upstream,
  );
  await expect(call("/agents", "POST", {})).rejects.toThrow("reply deliberately discarded");
  expect(order).toEqual(["checkpoint", "upstream"]);
  expect(b.active?.runId).toBeUndefined();
  expect(b.active?.posted).toBeUndefined();
  expect(b.faultLedger?.["launch-response-lost"]?.runId).toBe("run-one");
  await call("/agents", "POST", {});
  expect(order.filter((x) => x === "upstream")).toHaveLength(2);
  expect(b.faultLedger?.["launch-response-lost"]?.count).toBe(1);
});
test("read fault cannot mask initial lookup or permit unbounded upstream reads", async () => {
  const b = fixture(["cursor-read-failures"]);
  let effects = 0,
    checkpoints = 0;
  const call = faultCursor(
    b,
    async () => {
      checkpoints++;
    },
    (async () => {
      effects++;
      return {};
    }) as typeof cursor,
  );
  await call("/agents/bc-one");
  expect(checkpoints).toBe(0);
  b.active!.posted = true;
  for (let i = 0; i < 4; i++) await expect(call("/agents/bc-one")).rejects.toThrow("503");
  await call("/agents/bc-one");
  expect(effects).toBe(6);
  expect(checkpoints).toBe(4);
});
test("lost staging reply follows one actual dispatch and is consumed durably", async () => {
  const b = fixture(["staging-response-lost"]);
  b.automaticDeployment = { id: "request-one" } as Batch["automaticDeployment"];
  const order: string[] = [];
  const call = faultDeploymentRequest(
    b,
    async () => {
      order.push("checkpoint");
    },
    (async () => {
      order.push("dispatch");
    }) as typeof github,
  );
  await expect(call("/actions/workflows/staging.yml/dispatches", "POST")).rejects.toThrow(
    "reply deliberately discarded",
  );
  expect(order).toEqual(["checkpoint", "dispatch"]);
  expect(b.faultLedger?.["staging-response-lost"]?.requestId).toBe("request-one");
});
test("invalid authentication probe uses GET and a test token, not the real binding", async () => {
  const original = globalThis.fetch;
  const calls: { url: string; method?: string; authorization?: string }[] = [];
  globalThis.fetch = (async (input, options) => {
    calls.push({
      url: String(input),
      method: options?.method,
      authorization: new Headers(options?.headers).get("Authorization") ?? undefined,
    });
    return new Response("denied", { status: 401 });
  }) as typeof fetch;
  try {
    const b = fixture(["cursor-auth-denied"]);
    await expect(
      faultCursor(b, async () => {}, (async () => {
        throw new Error("unexpected normal call");
      }) as typeof cursor)("/agents/bc-one"),
    ).rejects.toThrow("401");
    expect(calls).toEqual([
      {
        url: "https://api.cursor.com/v1/agents/bc-one",
        method: undefined,
        authorization: "Bearer invalid-scoped-fault-probe",
      },
    ]);
    expect(b.faultLedger?.["cursor-auth-denied"]?.providerStatus).toBe(401);
  } finally {
    globalThis.fetch = original;
  }
});
test("evaluator outage is bounded, checkpointed and does not serialize provider errors", async () => {
  const b = fixture(["jev-unavailable"]);
  let checkpoints = 0;
  const f = {
    stage: "build" as const,
    code: "unknown",
    summary: "Unknown remote outcome",
    retriesRemaining: 1,
    scopeValid: true,
    budgetAvailable: true,
  };
  const evaluate = faultEvaluator(
    b,
    async () => {
      checkpoints++;
    },
    async (_failure, model) => {
      if (model) throw Object.assign(new Error("secret-token"), { statusCode: 401 });
      return { type: "choice", choice: "investigate" };
    },
  );
  for (let i = 0; i < 3; i++) await expect(evaluate(f)).rejects.toThrow();
  expect(await evaluate(f)).toEqual({ type: "choice", choice: "investigate" });
  expect(checkpoints).toBe(3);
  expect(JSON.stringify(b)).not.toContain("secret-token");
  expect(b.faultLedger?.["jev-unavailable"]?.providerStatus).toBe(401);
});

test("fault schema rejects unsupported cases and duplicate injections", async () => {
  const { manifestSchema } = await import("../agent/lib/contract.js");
  for (const cases of [["arbitrary-code"], ["step-replay", "step-replay"]])
    expect(() => manifestSchema.shape.faults.parse({ campaign: "test-campaign", cases })).toThrow();
});
