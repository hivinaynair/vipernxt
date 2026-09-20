import { expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { GitHubError } from "../agent/lib/github.js";
import {
  formatSlackAlert,
  mentionLine,
  notifyOwner,
  ownerPingKey,
  slackWebhook,
  verifySlackRequest,
} from "../agent/lib/pager.js";
import { formatReceipt, postReceipt } from "../agent/lib/receipt.js";
import type { State } from "../agent/lib/store.js";

test("owner ping key is the issue and error, not the receipt event", () => {
  expect(ownerPingKey({ issue: 15, error: "budget exhausted" })).toBe("15:budget exhausted");
});

test("webhook URLs that are not Slack incoming webhooks are ignored", () => {
  expect(slackWebhook("https://example.com/hooks")).toBeUndefined();
  expect(slackWebhook("https://hooks.slack.com/services/T/B/xxx")).toBe(
    "https://hooks.slack.com/services/T/B/xxx",
  );
});

test("Slack alert names the issue, Jev route, and GitHub link", () => {
  const alert = formatSlackAlert(
    {
      event: "blocked",
      issue: 15,
      attention: "owner",
      recommendation: "stop",
      error: "Batch time budget exhausted",
    },
    { repo: "hivinaynair/return-desk-cloud-test", buttons: true },
  );
  expect(alert.text).toContain("#15");
  expect(alert.text).toContain("stop");
  expect(alert.text).toContain("https://github.com/hivinaynair/return-desk-cloud-test/issues/15");
  expect(JSON.stringify(alert.blocks)).toContain("factory_retry");
});

test("Slack signatures older than five minutes or unsigned are rejected", () => {
  const secret = "8f742231b10e8888abcd99yyyzzz85a5";
  const ts = "1531420618";
  const body = "token=xyzz";
  const signature = `v0=${createHmac("sha256", secret).update(`v0:${ts}:${body}`).digest("hex")}`;
  expect(verifySlackRequest(body, ts, signature, secret, 1531420618 * 1000)).toBe(true);
  expect(verifySlackRequest(body, ts, signature, secret, 1531421000 * 1000)).toBe(false);
  expect(verifySlackRequest(body, ts, "v0=deadbeef", secret, 1531420618 * 1000)).toBe(false);
  expect(verifySlackRequest(body, ts, null, secret, 1531420618 * 1000)).toBe(false);
});

test("owner attention pings Slack once per issue error", async () => {
  let state: State = { version: 1 };
  const posts: string[] = [];
  const receipt = {
    event: "blocked",
    issue: 15,
    attention: "owner" as const,
    error: "budget exhausted",
  };
  const deps = {
    readState: async () => ({ state, sha: "1" }),
    saveState: async (next: State) => {
      state = next;
      return "2";
    },
    postSlack: async (body: { text: string }) => {
      posts.push(body.text);
      return { channel: "C12345678", ts: "1.2" };
    },
    repo: "acme/product",
  };
  expect(await notifyOwner(receipt, deps)).toBe(true);
  expect(await notifyOwner({ ...receipt, event: "classified" }, deps)).toBe(false);
  expect(posts).toHaveLength(1);
  expect(state.ownerPing).toMatchObject({ issue: 15, ts: "1.2" });
});

test("Slack failure still cannot throw out of postReceipt", async () => {
  await postReceipt(
    8,
    { event: "blocked", attention: "owner", error: "x" },
    async () => {
      throw new GitHubError(500, "POST /issues/8/comments");
    },
    async () => {
      throw new Error("slack down");
    },
  );
});

test("fresh owner receipt mentions FACTORY_OWNER", () => {
  expect(mentionLine("hivinaynair")).toBe("\ncc @hivinaynair");
  expect(mentionLine("bad login")).toBe("");
  const body =
    formatReceipt({
      event: "blocked",
      issue: 15,
      attention: "owner",
      error: "x",
    }) + mentionLine("hivinaynair");
  expect(body).toContain("cc @hivinaynair");
  expect(body).toContain("Attention: owner");
});
