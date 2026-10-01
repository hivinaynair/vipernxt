import { expect, mock } from "bun:test";

const waits: number[] = [];
let attempts = 0;
let comments = 0;
mock.module("workflow", () => ({
  sleep: async (ms: number) => {
    waits.push(ms);
  },
}));
mock.module("../../agent/lib/store.js", () => ({
  readState: async () => ({
    state: {
      version: 1,
      ownerPing: { key: "15:error", id: "alert-id", issue: 15, slack: { status: "pending" } },
    },
  }),
}));
mock.module("../../agent/lib/owner-delivery.js", () => ({
  deliverOwnerAlert: async (key: string) => {
    expect(key).toBe("alert-id");
    return ++attempts < 3
      ? { status: "waiting", waitMs: attempts * 5000 }
      : { status: "failed", issue: 15, code: "ratelimited" };
  },
}));
mock.module("../../agent/lib/github.js", () => ({
  github: async (path: string, method: string, body: { body: string }) => {
    expect(path).toBe("/issues/15/comments");
    expect(method).toBe("POST");
    expect(body.body).toContain("Slack notification not confirmed");
    comments++;
  },
}));
const { flushOwnerNotification } = await import("../../agent/lib/notify-owner.js");
await flushOwnerNotification(15);
expect(attempts).toBe(3);
expect(waits).toEqual([5000, 10000]);
expect(comments).toBe(1);
await flushOwnerNotification(16);
expect(attempts).toBe(3);
console.log("Owner delivery uses durable waits and preserves issue fallback");
