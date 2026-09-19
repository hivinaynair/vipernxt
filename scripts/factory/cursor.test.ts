import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { read, save } from "./core";
import {
  type CloudReceipt,
  CursorClient,
  cancelCursorAttempts,
  cursorRun,
  RemoteUncertain,
  repository,
} from "./cursor";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});
function fixture(
  options: {
    lost?: boolean;
    failure?: boolean;
    wrongRepo?: boolean;
    cancelFails?: boolean;
    review?: boolean;
    startingRef?: string;
  } = {},
) {
  const dir = mkdtempSync(join(tmpdir(), "cursor-contract-"));
  dirs.push(dir);
  let agentId = "";
  let state = "RUNNING";
  let posts = 0;
  let cancel = 0;
  const run = () => ({
    id: "run-test",
    agentId,
    status: state,
    result: '{"approved":true,"findings":[]}',
    git: {
      branches: [
        {
          repoUrl: options.wrongRepo ? "github.com/wrong/repo" : "github.com/test/product",
          branch: "cursor/feature",
        },
      ],
    },
  });
  const transport = (async (url: string | URL | Request, init?: RequestInit) => {
    expect(String(url).startsWith("https://api.cursor.com/v1/")).toBe(true);
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer test-secret");
    const path = new URL(String(url)).pathname;
    if (init?.method === "POST" && path === "/v1/agents") {
      const body = JSON.parse(String(init.body));
      expect(body.repos).toEqual([
        { url: "https://github.com/test/product", startingRef: options.startingRef ?? "base-sha" },
      ]);
      expect(body.workOnCurrentBranch).toBe(false);
      expect(body.autoCreatePR).toBe(false);
      expect(body.envVars).toBeUndefined();
      expect(body.model).toBeUndefined();
      posts++;
      agentId = body.agentId;
      expect(read<CloudReceipt>(join(dir, "cursor.json")).agentId).toBe(agentId);
      if (options.lost) throw new Error("Response lost after creation");
      return Response.json({ agent: { id: agentId }, run: run() });
    }
    if (path.endsWith("/cancel")) {
      cancel++;
      if (!options.cancelFails) state = "CANCELLED";
      return Response.json({});
    }
    if (path.endsWith("/runs/run-test")) return Response.json(run());
    return Response.json({ id: agentId, latestRunId: "run-test" });
  }) as typeof fetch;
  const args = {
    client: new CursorClient("test-secret", transport),
    dir,
    repo: "https://github.com/test/product",
    base: "base-sha",
    prompt: "Build one slice",
    stopped: () => false,
    review: options.review,
    startingRef: options.startingRef,
    sleep: async () => {
      state = options.failure ? "ERROR" : "FINISHED";
    },
  };
  return { args, posts: () => posts, cancel: () => cancel };
}
test("Cursor imports only a finished branch from the explicit repository", async () => {
  const f = fixture();
  const result = await cursorRun(f.args);
  expect(result.branch).toBe("cursor/feature");
  expect(f.posts()).toBe(1);
  await cursorRun(f.args);
  expect(f.posts()).toBe(1);
});
test("lost create response reconciles the persisted identity without another paid agent", async () => {
  const f = fixture({ lost: true });
  expect((await cursorRun(f.args)).status).toBe("FINISHED");
  expect(f.posts()).toBe(1);
});
test("remote ERROR is not accepted as completion", async () => {
  const f = fixture({ failure: true });
  await expect(cursorRun(f.args)).rejects.toThrow("ERROR");
});
test("another repository branch cannot become this product's result", async () => {
  const f = fixture({ wrongRepo: true });
  await expect(cursorRun(f.args)).rejects.toThrow("approved repository");
});
test("cancellation is confirmed remotely before returning", async () => {
  const f = fixture();
  let stop = false;
  await expect(
    cursorRun({
      ...f.args,
      stopped: () => stop,
      sleep: async () => {
        stop = true;
      },
    }),
  ).rejects.toThrow("Cancelled");
  expect(f.cancel()).toBe(1);
  expect(read<CloudReceipt>(join(f.args.dir, "cursor.json")).status).toBe("CANCELLED");
});
test("unconfirmed cancellation blocks replacement agents", async () => {
  const f = fixture({ cancelFails: true });
  let stop = false;
  await expect(
    cursorRun({
      ...f.args,
      stopped: () => stop,
      sleep: async () => {
        stop = true;
      },
    }),
  ).rejects.toBeInstanceOf(RemoteUncertain);
});
test("read-only review returns its verdict without requiring a code branch", async () => {
  const f = fixture({ review: true });
  const result = await cursorRun(f.args);
  expect(JSON.parse(result.result ?? "").approved).toBe(true);
});
test("cloud identity cannot be reused for changed instructions", async () => {
  const f = fixture();
  await cursorRun(f.args);
  await expect(cursorRun({ ...f.args, prompt: "Changed scope" })).rejects.toThrow("inputs changed");
});
test("credentials and arbitrary remotes cannot be embedded in configuration or error output", async () => {
  expect(() => repository("https://token@github.com/test/product")).toThrow();
  expect(() => repository("https://example.com/test/product")).toThrow();
  const client = new CursorClient(
    "secret",
    (async () => new Response("secret response body", { status: 401 })) as typeof fetch,
  );
  await expect(client.request("/agents")).rejects.toThrow("Cursor HTTP 401");
});

test("a local setup failure can fence an already dispatched remote attempt", async () => {
  const f = fixture();
  const receipt = await cursorRun(f.args);
  receipt.status = "RUNNING";
  save(join(f.args.dir, "cursor.json"), receipt);
  await cancelCursorAttempts(f.args.dir, f.args.client);
  expect(f.cancel()).toBe(1);
  expect(read<CloudReceipt>(join(f.args.dir, "cursor.json")).status).toBe("CANCELLED");
});

test("freshly pushed commits can be launched through their immutable branch ref", async () => {
  const f = fixture({ startingRef: "codex/factory-input/pinned" });
  expect((await cursorRun(f.args)).status).toBe("FINISHED");
});
