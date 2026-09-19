import { afterEach, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateVerification } from "../factory/cursor";
import { type Issue, issueHash, Linear } from "./linear";
import { eventCommand, parseCommand, verifyWebhook } from "./protocol";
import { type Config, Controller } from "./service";
import type { Batch, Store } from "./store";

const dirs: string[] = [];
const stores: Store[] = [];
afterEach(() => {
  for (const s of stores) s.close();
  stores.length = 0;
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs.length = 0;
});
function fixture() {
  const data = mkdtempSync(join(tmpdir(), "controller-"));
  dirs.push(data);
  const config: Config = {
    data,
    token: "a".repeat(32),
    clientId: "client",
    webhookSecret: "secret",
    workspace: "workspace",
    users: ["owner"],
    teams: {
      team: {
        repository: "owner/repo",
        states: { running: "working", review: "review", canceled: "canceled" },
      },
    },
  };
  const linear = {
    issue: async () => issue(),
    comment: async () => "build",
    activity: async () => {},
    state: async () => {},
  } as unknown as Linear;
  const c = new Controller(config, linear, "http://localhost:8080");
  stores.push(c.store);
  return c;
}
function issue(): Issue {
  return {
    id: "issue",
    title: "Approved",
    description: "Acceptance",
    archivedAt: null,
    team: { id: "team" },
    parent: null,
    state: { id: "todo", type: "unstarted" },
    relations: { nodes: [], pageInfo: { hasNextPage: false } },
  };
}
function batch(c: Controller): Batch {
  const root = join(c.config.data, "repo");
  mkdirSync(root);
  return {
    id: "batch",
    root,
    repository: "owner/repo",
    commit: "a".repeat(40),
    manifest: "factory.json",
    issueId: "issue",
    teamId: "team",
    jobIssues: { A: "issue" },
    snapshots: { issue: issueHash(issue()) },
    requested: "ready",
    sessions: [],
  };
}
function event(text = "build", user = "owner") {
  return {
    type: "AgentSessionEvent",
    action: "created",
    organizationId: "workspace",
    oauthClientId: "client",
    appUserId: "app",
    webhookTimestamp: Date.now(),
    agentSession: { id: "session", issueId: "issue", creatorId: user, comment: { body: text } },
  };
}
function signed(c: Controller, e: unknown, id = "delivery") {
  const body = JSON.stringify(e);
  return new Request("http://localhost/webhooks/linear", {
    method: "POST",
    headers: {
      "linear-signature": createHmac("sha256", c.config.webhookSecret).update(body).digest("hex"),
      "linear-delivery": id,
    },
    body,
  });
}
test("command grammar never treats prose or shell as an action", () => {
  for (const a of ["build", "status", "pause", "resume", "cancel", "retry"])
    expect(parseCommand(`@vipernxt ${a}`)).toBe(a);
  expect(parseCommand("@vipernxt")).toBe("status");
  for (const s of [
    "please build",
    "build; curl evil",
    "status\nbuild",
    "> @vipernxt build",
    "run batch",
    "implement this",
  ])
    expect(parseCommand(s)).toBeUndefined();
});
test("webhook requires exact signature and recent signed timestamp", () => {
  const raw = JSON.stringify({ webhookTimestamp: 1000 });
  const sig = createHmac("sha256", "key").update(raw).digest("hex");
  expect(verifyWebhook(raw, sig, "key", 1001)).toBe(true);
  expect(verifyWebhook(raw, sig, "wrong", 1001)).toBe(false);
  expect(verifyWebhook(raw, sig, "key", 61001)).toBe(false);
  expect(verifyWebhook(`${raw} `, sig, "key", 1001)).toBe(false);
});
test("durable duplicate webhook and duplicate session create execute only once", async () => {
  const c = fixture(),
    b = batch(c);
  c.store.save(b);
  const e = event();
  expect((await c.handle(signed(c, e))).status).toBe(202);
  await c.handle(signed(c, e));
  await c.handle(signed(c, e, "other-delivery"));
  await c.inbox();
  expect(c.store.get(b.id)?.requested).toBe("queued");
  expect(c.store.db.query<{ n: number }, []>("SELECT count(*) AS n FROM outbox").get()?.n).toBe(1);
  expect(c.children.size).toBe(0);
});
test("unauthorized person and wrong workspace cannot release a batch", async () => {
  const c = fixture(),
    b = batch(c);
  c.store.save(b);
  await c.handle(signed(c, event("build", "stranger")));
  await c.inbox();
  expect(c.store.get(b.id)?.requested).toBe("ready");
  expect((await c.handle(signed(c, { ...event(), organizationId: "other" }))).status).toBe(403);
});
test("bare mention is read-only and unregistered ticket cannot launch", async () => {
  const c = fixture(),
    b = batch(c);
  c.store.save(b);
  await c.handle(signed(c, event("@vipernxt")));
  await c.inbox();
  expect(c.store.get(b.id)?.requested).toBe("ready");
  const other = {
    ...event(),
    agentSession: { ...event().agentSession, id: "other", issueId: "unknown" },
  };
  await c.handle(signed(c, other, "other"));
  await c.inbox();
  expect(c.children.size).toBe(0);
});
test("HTTP controls require bearer token and preserve batch scope", async () => {
  const c = fixture(),
    b = batch(c);
  c.store.save(b);
  const url = `http://localhost/v1/batches/${b.id}/build`;
  expect((await c.handle(new Request(url, { method: "POST" }))).status).toBe(401);
  expect(
    (
      await c.handle(
        new Request(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${c.config.token}` },
        }),
      )
    ).status,
  ).toBe(200);
  c.execute(c.store.get(b.id)!, "pause");
  expect(c.store.get(b.id)?.requested).toBe("paused");
  c.execute(c.store.get(b.id)!, "resume");
  expect(c.store.get(b.id)?.requested).toBe("resume");
  expect(c.store.get(b.id)?.commit).toBe(b.commit);
});
test("scope drift is held, status-only changes are ignored", async () => {
  const c = fixture(),
    b = batch(c);
  const original = issue();
  const changed = { ...original, state: { id: "progress", type: "started" } };
  expect(issueHash(changed)).toBe(issueHash(original));
  c.linear.issue = async () => ({ ...original, description: "Different scope" });
  await expect(c.fresh(b)).rejects.toThrow("scope changed");
});
test("submission idempotency persists and rejects changed inputs", () => {
  const c = fixture(),
    b = batch(c);
  expect(c.store.submit("key", { x: 1 }, b)).toBe(b.id);
  expect(c.store.submit("key", { x: 1 }, b)).toBe(b.id);
  expect(() => c.store.submit("key", { x: 2 }, b)).toThrow("different scope");
});
test("failed Linear update stays in outbox and does not disappear", async () => {
  const c = fixture();
  c.store.enqueue({ session: "s", body: "hello" });
  c.linear.activity = async () => {
    throw new Error("outage");
  };
  await c.outbox();
  const row = c.store.db
    .query<{ done: number; tries: number }, []>("SELECT done,tries FROM outbox")
    .get();
  expect(row).toEqual({ done: 0, tries: 1 });
});
test("remote verification requires exact candidate, all commands and browser evidence", () => {
  const expected = { checks: [["bun", "test"]], browser: true };
  const value = {
    commit: "c",
    tree: "t",
    unchanged: true,
    checks: [{ command: ["bun", "test"], exitCode: 0, output: "2 pass" }],
    browser: { passed: true, cases: 2, evidence: "trace and screenshot" },
  };
  expect(() => validateVerification(value, "c", "t", expected)).not.toThrow();
  for (const v of [
    { ...value, commit: "wrong" },
    { ...value, checks: [] },
    { ...value, browser: { passed: true, cases: 0, evidence: "" } },
    { ...value, unchanged: false },
  ])
    expect(() => validateVerification(v, "c", "t", expected)).toThrow();
});
test("Linear OAuth stays in client and partial GraphQL failures are rejected", async () => {
  const requests: string[] = [];
  const transport = (async (url: unknown, opts: RequestInit) => {
    requests.push(String(url));
    if (String(url).includes("oauth"))
      return Response.json({ access_token: "secret", expires_in: 3600 });
    expect((opts.headers as Record<string, string>).Authorization).toBe("Bearer secret");
    return Response.json({ data: { viewer: { id: "a" } }, errors: [{ message: "partial" }] });
  }) as typeof fetch;
  const l = new Linear("id", "key", transport);
  await expect(l.identity()).rejects.toThrow("partial result");
  await expect(l.identity()).rejects.toThrow();
  expect(requests.filter((r) => r.includes("oauth"))).toHaveLength(1);
});

test("stale scheduler snapshot cannot overwrite a newly requested cancellation", () => {
  const c = fixture(),
    b = batch(c);
  c.store.save(b);
  const stale = c.store.get(b.id) as Batch;
  const current = c.store.get(b.id) as Batch;
  c.execute(current, "cancel");
  stale.requested = "running";
  expect(() => c.store.save(stale)).toThrow("concurrently");
  expect(c.store.get(b.id)?.requested).toBe("cancelled");
});
test("only the installed app mention URL is removed from command text", () => {
  const url = "https://linear.app/bridge/profiles/app";
  expect(parseCommand(`[@ViperNxt](${url}) build`, url)).toBe("build");
  expect(parseCommand(`${url} status`, url)).toBe("status");
  expect(parseCommand("[@ViperNxt](https://evil.test) build", url)).toBeUndefined();
});

test("real Linear mention markup only strips the installed app", () => {
  const e = event();
  e.appUserId = "98905f29-e76d-463e-a113-2779b99ad7a2";
  expect(eventCommand(e, `<user id="${e.appUserId}" notify>vipernxt</user> status`)).toBe("status");
  expect(
    eventCommand(e, '<user id="00000000-0000-0000-0000-000000000000" notify>vipernxt</user> build'),
  ).toBeUndefined();
  expect(eventCommand(e, "please build this")).toBeUndefined();
});
