import { expect, test } from "bun:test";
import {
  applyOwnerCommand,
  looksLikeSecret,
  parseOwnerCommand,
  postSlackEvidence,
} from "../agent/lib/owner-command.js";
import { handleSlackCallback } from "../agent/lib/slack.js";
import type { Batch, State } from "../agent/lib/store.js";

const commit = "a".repeat(40);
function blockedState(overrides: Partial<Batch> = {}): State {
  return {
    version: 1,
    batch: {
      issue: 15,
      intakeHash: "h",
      commit,
      manifestPath: "docs/batch.json",
      startedAt: Date.now(),
      status: "blocked",
      error: "Cursor stage ended with ERROR",
      candidate: commit,
      accepted: [],
      attempts: {},
      evidence: [],
      manifest: {
        version: 1,
        id: "mvp",
        base: commit,
        approval: "ok",
        verification: "cursor-cloud",
        specFiles: ["docs/coverage.json"],
        coverageFile: "docs/coverage.json",
        setup: [],
        worker: { kind: "cursor", repository: "https://github.com/acme/product" },
        limits: { attempts: 2, jobSeconds: 600, runSeconds: 3600 },
        jobs: [],
        combinedChecks: [["bun", "test"]],
      },
      ...overrides,
    },
  };
}

test("Hold Retry Reject are the only owner commands", () => {
  expect(parseOwnerCommand(" Retry ")).toBe("retry");
  expect(parseOwnerCommand("please fix it")).toBeUndefined();
});

test("secrets never become issue comments", () => {
  expect(looksLikeSecret("xoxb-1234")).toBe(true);
  expect(looksLikeSecret("the reviewer JSON is truncated")).toBe(false);
});

test("Hold comments and leaves the batch blocked", async () => {
  const comments: string[] = [];
  const result = await applyOwnerCommand("hold", 15, {
    github: async (_path, _method, body) => {
      comments.push(String((body as { body?: string }).body));
      return undefined as never;
    },
  });
  expect(result).toEqual({ status: "held" });
  expect(comments[0]).toContain("Owner held from Slack");
});

test("Reject archives the batch and does not resume", async () => {
  let state = blockedState();
  const result = await applyOwnerCommand("reject", 15, {
    readState: async () => ({ state, sha: "1" }),
    saveState: async (next) => {
      state = next;
      return "2";
    },
    github: async () => undefined as never,
  });
  expect(result).toEqual({ status: "rejected" });
  expect(state.batch).toBeUndefined();
  expect(state.history?.[0]?.reason).toContain("rejected");
});

test("Retry dispatches only inside the same contract and budget", async () => {
  let state = blockedState();
  const ok = await applyOwnerCommand("retry", 15, {
    readState: async () => ({ state, sha: "1" }),
    saveState: async (next) => {
      state = next;
      return "2";
    },
    github: async () =>
      ({
        state: "open",
        labels: [{ name: "factory" }],
        body:
          "```factory-batch\n" + JSON.stringify({ commit, manifest: "docs/batch.json" }) + "\n```",
      }) as never,
  });
  expect(ok).toEqual({ status: "retry_dispatch", issue: 15 });
  expect(state.ownerPing?.command).toBe("retry");
  const expired = await applyOwnerCommand("retry", 15, {
    now: Date.now() + 4000_000,
    readState: async () => ({ state: blockedState({ startedAt: 1 }), sha: "1" }),
    saveState: async () => "2",
    github: async () =>
      ({
        state: "open",
        labels: [{ name: "factory" }],
        body:
          "```factory-batch\n" + JSON.stringify({ commit, manifest: "docs/batch.json" }) + "\n```",
      }) as never,
  });
  expect(expired).toMatchObject({ status: "cannot_retry" });
});

test("unsigned Slack requests never apply a command", async () => {
  const applied: string[] = [];
  const response = await handleSlackCallback(
    new Request("https://factory.example/callbacks/slack", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "block_actions",
        user: { id: "U12345678" },
        actions: [{ action_id: "factory_reject", value: "15" }],
      }),
    }),
    {
      verify: () => false,
      apply: async (command) => {
        applied.push(command);
        return { status: "rejected" };
      },
    },
  );
  expect(response.status).toBe(401);
  expect(applied).toEqual([]);
});

test("Slack challenge is returned before any owner command", async () => {
  const response = await handleSlackCallback(
    new Request("https://factory.example/callbacks/slack", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "url_verification", challenge: "abc" }),
    }),
    { verify: () => true },
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ challenge: "abc" });
});

test("only the configured Slack owner can Retry", async () => {
  const previous = process.env.SLACK_OWNER_USER_ID;
  process.env.SLACK_OWNER_USER_ID = "UOWNER0001";
  try {
    const dispatched: number[] = [];
    const denied = await handleSlackCallback(
      new Request("https://factory.example/callbacks/slack", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "block_actions",
          user: { id: "UOTHER0001" },
          actions: [{ action_id: "factory_retry", value: "15" }],
        }),
      }),
      {
        verify: () => true,
        apply: async () => ({ status: "retry_dispatch", issue: 15 }),
        dispatchRetry: async (issue) => {
          dispatched.push(issue);
        },
      },
    );
    expect(denied.status).toBe(204);
    expect(dispatched).toEqual([]);
    const allowed = await handleSlackCallback(
      new Request("https://factory.example/callbacks/slack", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "block_actions",
          user: { id: "UOWNER0001" },
          actions: [{ action_id: "factory_retry", value: "15" }],
        }),
      }),
      {
        verify: () => true,
        apply: async () => ({ status: "retry_dispatch", issue: 15 }),
        dispatchRetry: async (issue) => {
          dispatched.push(issue);
        },
      },
    );
    expect(allowed.status).toBe(204);
    expect(dispatched).toEqual([15]);
  } finally {
    if (previous === undefined) delete process.env.SLACK_OWNER_USER_ID;
    else process.env.SLACK_OWNER_USER_ID = previous;
  }
});

test("thread prose is evidence on the issue, not a dispatcher", async () => {
  const previous = process.env.SLACK_OWNER_USER_ID;
  process.env.SLACK_OWNER_USER_ID = "UOWNER0001";
  const evidence: string[] = [];
  try {
    await handleSlackCallback(
      new Request("https://factory.example/callbacks/slack", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "event_callback",
          event: {
            type: "message",
            user: "UOWNER0001",
            text: "reviewer JSON is truncated",
            channel: "C12345678",
            ts: "2.0",
            thread_ts: "1.0",
          },
        }),
      }),
      {
        verify: () => true,
        readState: async () => ({
          state: {
            version: 1,
            ownerPing: { key: "15:x", issue: 15, channel: "C12345678", ts: "1.0" },
          },
        }),
        evidence: async (issue, text) => {
          evidence.push(`${issue}:${text}`);
          return { status: "posted" };
        },
      },
    );
    expect(evidence).toEqual(["15:reviewer JSON is truncated"]);
  } finally {
    if (previous === undefined) delete process.env.SLACK_OWNER_USER_ID;
    else process.env.SLACK_OWNER_USER_ID = previous;
  }
});

test("evidence helper refuses secrets", async () => {
  expect(await postSlackEvidence(15, "xoxb-secret", async () => undefined as never)).toEqual({
    status: "secret",
  });
});
