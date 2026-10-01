import { afterEach, beforeEach, expect, test } from "bun:test";
import { type OwnerAlert, ownerAlert, safeAlertText } from "../agent/lib/owner-alert.js";
import { deliverOwnerAlert } from "../agent/lib/owner-delivery.js";
import { formatSlackAlert, notifyOwner } from "../agent/lib/pager.js";
import {
  postSlackAlert,
  reconcileSlackAlert,
  SlackDeliveryError,
} from "../agent/lib/slack-transport.js";
import type { OwnerPing, State } from "../agent/lib/store.js";

const envNames = [
  "SLACK_BOT_TOKEN",
  "SLACK_OWNER_CHANNEL",
  "SLACK_OWNER_WEBHOOK",
  "FACTORY_OWNER",
  "CURSOR_API_KEY",
] as const;
let oldEnv: (string | undefined)[];
beforeEach(() => {
  oldEnv = envNames.map((name) => process.env[name]);
  process.env.SLACK_BOT_TOKEN = "xoxb-unit-placeholder";
  process.env.SLACK_OWNER_CHANNEL = "C12345678";
  delete process.env.SLACK_OWNER_WEBHOOK;
});
afterEach(() => {
  envNames.forEach((name, i) => {
    if (oldEnv[i] === undefined) delete process.env[name];
    else process.env[name] = oldEnv[i];
  });
});

function ping(): OwnerPing & {
  id: string;
  alert: OwnerAlert;
  slack: NonNullable<OwnerPing["slack"]>;
} {
  return {
    key: "15:failed",
    issue: 15,
    id: "unit-notification",
    alert: ownerAlert(
      { event: "blocked", issue: 15, error: "failed", attention: "owner" },
      { version: 1 },
      10000,
    ),
    slack: { status: "pending", attempts: 0, destination: "C12345678" },
  };
}
function memory(initial: State = { version: 1, ownerPing: ping() }) {
  let state = structuredClone(initial);
  let version = 1;
  return {
    get: () => structuredClone(state),
    replace: (next: State) => {
      state = structuredClone(next);
      version++;
    },
    readState: async () => ({ state: structuredClone(state), sha: String(version) }),
    saveState: async (next: State, sha?: string) => {
      if (sha !== String(version)) throw new Error("CAS conflict");
      state = structuredClone(next);
      return String(++version);
    },
  };
}
const confirmed = { channel: "C12345678", ts: "10.123" };
const requestWith = (response: Response) => (async () => response) as unknown as typeof fetch;

test("only owner holds queue notifications; machine recovery creates none", async () => {
  const db = memory({ version: 1 });
  expect(
    await notifyOwner(
      { issue: 15, event: "classified", attention: "eve" },
      { ...db, slackConfigured: true },
    ),
  ).toBe(false);
  expect(db.get().ownerPing).toBeUndefined();
});
test("missing Slack configuration records no claimed delivery and can be enabled later", async () => {
  process.env.FACTORY_OWNER = "unit-owner";
  const db = memory({ version: 1 });
  const receipt = { issue: 15, event: "blocked", attention: "owner" as const, error: "failed" };
  expect(await notifyOwner(receipt, { ...db, slackConfigured: false })).toBe(true);
  const id = db.get().ownerPing?.id;
  expect(db.get().ownerPing?.slack?.status).toBe("unconfigured");
  expect(await notifyOwner(receipt, { ...db, slackConfigured: true })).toBe(false);
  expect(db.get().ownerPing).toMatchObject({ id, slack: { status: "pending", attempts: 0 } });
});
test("delivery is confirmed by Slack channel and timestamp, then never posted twice", async () => {
  const db = memory();
  let posts = 0;
  const postSlack = async () => {
    posts++;
    return confirmed;
  };
  expect(await deliverOwnerAlert("unit-notification", { ...db, postSlack, now: 10000 })).toEqual({
    status: "done",
  });
  expect(db.get().ownerPing).toMatchObject({
    ...confirmed,
    slack: { status: "delivered", attempts: 1, confirmedAt: 10000 },
  });
  await deliverOwnerAlert("unit-notification", { ...db, postSlack, now: 20000 });
  expect(posts).toBe(1);
});
test("HTTP success with Slack ok:false is permanent failure, never false delivery", async () => {
  const db = memory();
  const postSlack = (p: OwnerPing) =>
    postSlackAlert(
      p,
      "acme/product",
      requestWith(Response.json({ ok: false, error: "invalid_auth" })),
    );
  expect(await deliverOwnerAlert("unit-notification", { ...db, postSlack, now: 10000 })).toEqual({
    status: "failed",
    issue: 15,
    code: "invalid_auth",
  });
  expect(db.get().ownerPing).toMatchObject({
    slack: { status: "failed", attempts: 1, lastError: "invalid_auth" },
  });
  expect(db.get().ownerPing?.ts).toBeUndefined();
});
test("rate limiting waits durably and can confirm the subsequent attempt", async () => {
  const db = memory();
  let posts = 0;
  const postSlack = async () => {
    if (++posts === 1) throw new SlackDeliveryError("ratelimited", "retryable", 12000);
    return confirmed;
  };
  expect(
    await deliverOwnerAlert("unit-notification", { ...db, postSlack, now: 10000 }),
  ).toMatchObject({ status: "waiting", waitMs: 12000 });
  expect(
    await deliverOwnerAlert("unit-notification", { ...db, postSlack, now: 21000 }),
  ).toMatchObject({ status: "waiting", waitMs: 1000 });
  expect(posts).toBe(1);
  expect(await deliverOwnerAlert("unit-notification", { ...db, postSlack, now: 22000 })).toEqual({
    status: "done",
  });
  expect(posts).toBe(2);
});
test("three definite rate-limit failures exhaust delivery budget", async () => {
  const db = memory();
  let posts = 0;
  const postSlack = async () => {
    posts++;
    throw new SlackDeliveryError("ratelimited", "retryable");
  };
  await deliverOwnerAlert("unit-notification", { ...db, postSlack, now: 10000 });
  await deliverOwnerAlert("unit-notification", { ...db, postSlack, now: 15000 });
  expect(
    await deliverOwnerAlert("unit-notification", { ...db, postSlack, now: 35000 }),
  ).toMatchObject({ status: "failed" });
  await deliverOwnerAlert("unit-notification", { ...db, postSlack, now: 100000 });
  expect(posts).toBe(3);
});
test("lost POST response reconciles history and never creates a second message", async () => {
  const db = memory();
  let posts = 0,
    reads = 0;
  const postSlack = async () => {
    posts++;
    throw new SlackDeliveryError("delivery_unconfirmed", "ambiguous");
  };
  const reconcileSlack = async () => {
    reads++;
    return confirmed;
  };
  await deliverOwnerAlert("unit-notification", { ...db, postSlack, reconcileSlack, now: 10000 });
  expect(
    await deliverOwnerAlert("unit-notification", { ...db, postSlack, reconcileSlack, now: 15000 }),
  ).toEqual({ status: "done" });
  expect(posts).toBe(1);
  expect(reads).toBe(1);
});
test("crash after claiming POST uses read-only reconciliation on replay", async () => {
  const p = ping();
  p.slack = { ...p.slack, status: "sending", claim: "old", until: 11000, attempts: 1 };
  const db = memory({ version: 1, ownerPing: p });
  let posts = 0,
    reads = 0;
  const deps = {
    ...db,
    postSlack: async () => {
      posts++;
      return confirmed;
    },
    reconcileSlack: async () => {
      reads++;
      return confirmed;
    },
  };
  expect(await deliverOwnerAlert(p.id, { ...deps, now: 10000 })).toMatchObject({
    status: "waiting",
  });
  await deliverOwnerAlert(p.id, { ...deps, now: 12000 });
  expect(posts).toBe(0);
  expect(reads).toBe(1);
});
test("uncertain delivery that cannot be found stops after bounded reads without reposting", async () => {
  const db = memory();
  let posts = 0,
    reads = 0;
  const deps = {
    ...db,
    postSlack: async () => {
      posts++;
      throw new SlackDeliveryError("delivery_unconfirmed", "ambiguous");
    },
    reconcileSlack: async () => {
      reads++;
      throw new SlackDeliveryError("delivery_unconfirmed", "ambiguous");
    },
  };
  await deliverOwnerAlert("unit-notification", { ...deps, now: 10000 });
  await deliverOwnerAlert("unit-notification", { ...deps, now: 15000 });
  expect(await deliverOwnerAlert("unit-notification", { ...deps, now: 35000 })).toMatchObject({
    status: "failed",
    code: "delivery_unconfirmed",
  });
  expect(posts).toBe(1);
  expect(reads).toBe(2);
});
test("failed checkpoint before POST creates no external effect", async () => {
  const db = memory();
  let posts = 0;
  expect(
    await deliverOwnerAlert("unit-notification", {
      ...db,
      now: 10000,
      saveState: async () => {
        throw new Error("CAS conflict");
      },
      postSlack: async () => {
        posts++;
        return confirmed;
      },
    }),
  ).toMatchObject({ status: "waiting" });
  expect(posts).toBe(0);
});
test("a newer notification wins over an old delivery finishing", async () => {
  const db = memory();
  await deliverOwnerAlert("unit-notification", {
    ...db,
    now: 10000,
    postSlack: async () => {
      const next = db.get();
      next.ownerPing = { ...ping(), id: "new-notification" };
      db.replace(next);
      return confirmed;
    },
  });
  expect(db.get().ownerPing).toMatchObject({
    id: "new-notification",
    slack: { status: "pending", attempts: 0 },
  });
});
test("factory lease defers notification I/O", async () => {
  const db = memory();
  const s = db.get();
  s.lease = { owner: "factory", until: 20000 };
  db.replace(s);
  let posts = 0;
  expect(
    await deliverOwnerAlert("unit-notification", {
      ...db,
      now: 10000,
      postSlack: async () => {
        posts++;
        return confirmed;
      },
    }),
  ).toMatchObject({ status: "waiting", waitMs: 10000 });
  expect(posts).toBe(0);
});
test("Slack rate-limit headers and malformed success responses are checked", async () => {
  await expect(
    postSlackAlert(
      ping(),
      "acme/product",
      requestWith(new Response(null, { status: 429, headers: { "retry-after": "12" } })),
    ),
  ).rejects.toMatchObject({ kind: "retryable", delayMs: 12000 });
  await expect(
    postSlackAlert(ping(), "acme/product", requestWith(Response.json({ ok: true }))),
  ).rejects.toMatchObject({ kind: "ambiguous" });
  await expect(
    postSlackAlert(ping(), "acme/product", requestWith(new Response(null, { status: 503 }))),
  ).rejects.toMatchObject({ kind: "ambiguous" });
});
test("history confirmation requires stable message identity and bot evidence", async () => {
  let calls = 0;
  const request = (async () => {
    calls++;
    return Response.json({
      ok: true,
      messages: [
        { ts: "1.0", client_msg_id: "unit-notification" },
        {
          ts: "2.0",
          bot_id: "BOTHER",
          metadata: { event_type: "eve_owner_alert", event_payload: { id: "other-notification" } },
        },
        {
          ts: "10.123",
          bot_id: "BUNIT",
          metadata: { event_type: "eve_owner_alert", event_payload: { id: "unit-notification" } },
        },
      ],
    });
  }) as unknown as typeof fetch;
  expect(await reconcileSlackAlert(ping(), request)).toEqual(confirmed);
  expect(calls).toBe(1);
});
test("webhook success needs an explicit ok and exposes no interactive buttons", async () => {
  delete process.env.SLACK_BOT_TOKEN;
  process.env.SLACK_OWNER_WEBHOOK = "https://hooks.slack.com/services/T/B/unit";
  const p = ping();
  p.slack.destination = "webhook";
  await expect(
    postSlackAlert(p, "acme/product", requestWith(new Response("no"))),
  ).rejects.toMatchObject({ kind: "ambiguous" });
  expect(await postSlackAlert(p, "acme/product", requestWith(new Response("ok")))).toEqual({});
});
test("alerts show failed task, attempted recovery, needed action, evidence and safe text", () => {
  process.env.CURSOR_API_KEY = "unit-provider-credential";
  const p = ping();
  p.alert.failure = "unit-provider-credential <@UOTHER> Bearer hidden";
  const message = formatSlackAlert(
    { issue: 15, event: "blocked" },
    { repo: "acme/product", alert: p.alert, id: p.id, buttons: true },
  );
  const body = JSON.stringify(message);
  expect(body).toContain("What Eve tried");
  expect(body).toContain("What I need from you");
  expect(body).toContain("github.com/acme/product/issues/15");
  expect(body).not.toContain("unit-provider-credential");
  expect(body).not.toContain("Bearer hidden");
  expect(message.text).toContain("&lt;@UOTHER&gt;");
  expect(body).toContain("factory_hold");
  expect(body).not.toContain("factory_retry");
  expect(safeAlertText("ghp_abcdef")).toBe("[redacted]");
});
