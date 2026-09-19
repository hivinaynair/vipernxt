import { expect, test } from "bun:test";
import { advanceRemote, CursorError, type cursor } from "../agent/lib/cursor.js";
import type { Attempt } from "../agent/lib/store.js";

const attempt = (): Attempt => ({
  agentId: "bc-reserved",
  phase: "build",
  base: "a".repeat(40),
  startedAt: 0,
});
const transport = (fn: (path: string, method?: string, body?: unknown) => Promise<unknown>) =>
  fn as typeof cursor;
test("uncertain POST is reconciled using the reserved ID", async () => {
  const old = process.env.FACTORY_REPO;
  process.env.FACTORY_REPO = "acme/product";
  try {
    const a = attempt();
    let posts = 0;
    let exists = false;
    const request = transport(async (path, method, body) => {
      if (method === "POST") {
        posts++;
        expect((body as { agentId: string }).agentId).toBe(a.agentId);
        exists = true;
        throw new Error("response lost after remote accepted");
      }
      if (!exists) throw new CursorError(404);
      if (path.endsWith("/runs/run-1"))
        return { id: "run-1", agentId: a.agentId, status: "RUNNING" };
      return { id: a.agentId, latestRunId: "run-1" };
    });
    await expect(advanceRemote(a, "task", request)).rejects.toThrow();
    expect((await advanceRemote(a, "task", request))?.status).toBe("RUNNING");
    expect(posts).toBe(1);
  } finally {
    if (old === undefined) delete process.env.FACTORY_REPO;
    else process.env.FACTORY_REPO = old;
  }
});
test("read failure never becomes a new dispatch", async () => {
  let posts = 0;
  const request = transport(async (_, method) => {
    if (method === "POST") posts++;
    throw new CursorError(503);
  });
  await expect(advanceRemote(attempt(), "task", request)).rejects.toThrow();
  expect(posts).toBe(0);
});
test("missing previously launched agent is not silently replaced", async () => {
  let calls = 0;
  const request = transport(async () => {
    calls++;
    throw new CursorError(404);
  });
  await expect(advanceRemote({ ...attempt(), posted: true }, "task", request)).rejects.toThrow();
  expect(calls).toBe(1);
});
test("external continuation cannot be accepted as the registered run", async () => {
  const request = transport(async () => ({ id: "bc-reserved", latestRunId: "other-run" }));
  await expect(advanceRemote({ ...attempt(), runId: "run-1" }, "task", request)).rejects.toThrow(
    "changed outside factory",
  );
});
test("dispatch uses the pinned input branch and configured execution model", async () => {
  const old = process.env.FACTORY_REPO;
  process.env.FACTORY_REPO = "acme/product";
  try {
    const a = { ...attempt(), startingRef: "factory/input/bc-reserved" };
    const request = transport(async (_, method, body) => {
      if (method !== "POST") throw new CursorError(404);
      const payload = body as {
        repos: { startingRef: string }[];
        model: { id: string };
        autoCreatePR: boolean;
      };
      expect(payload.repos[0]?.startingRef).toBe(a.startingRef);
      expect(payload.model.id).toBe("grok-4.6");
      expect(payload.autoCreatePR).toBe(false);
      return {
        agent: { id: a.agentId },
        run: { id: "run-1", agentId: a.agentId, status: "CREATING" },
      };
    });
    await advanceRemote(a, "task", request);
    expect(a.runId).toBe("run-1");
    expect(a.posted).toBe(true);
  } finally {
    if (old === undefined) delete process.env.FACTORY_REPO;
    else process.env.FACTORY_REPO = old;
  }
});
