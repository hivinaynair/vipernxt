import { randomUUID } from "node:crypto";
import { postSlackAlert, reconcileSlackAlert, SlackDeliveryError } from "./slack-transport.js";
import { readState, saveState } from "./store.js";

export const MAX_SLACK_ATTEMPTS = 3;
export type DeliveryResult =
  | { status: "done" }
  | { status: "waiting"; waitMs: number }
  | { status: "failed"; issue: number; code: string };

export async function deliverOwnerAlert(
  key: string,
  deps: {
    readState?: typeof readState;
    saveState?: typeof saveState;
    postSlack?: typeof postSlackAlert;
    reconcileSlack?: typeof reconcileSlackAlert;
    now?: number;
  } = {},
): Promise<DeliveryResult> {
  const read = deps.readState ?? readState,
    save = deps.saveState ?? saveState;
  const now = deps.now ?? Date.now();
  const { state, sha } = await read();
  const ping = state.ownerPing,
    delivery = ping?.slack;
  if (
    !ping ||
    (ping.id ?? ping.key) !== key ||
    !delivery ||
    ["delivered", "unconfigured"].includes(delivery.status)
  )
    return { status: "done" };
  if (delivery.status === "failed")
    return {
      status: "failed",
      issue: ping.issue,
      code: delivery.lastError ?? "delivery_unconfirmed",
    };
  const busyUntil = Math.max(
    state.lease?.until ?? 0,
    delivery.status === "sending" ? (delivery.until ?? 0) : 0,
    delivery.nextAt ?? 0,
  );
  if (busyUntil > now) return { status: "waiting", waitMs: Math.min(300000, busyUntil - now) };
  if (delivery.attempts >= MAX_SLACK_ATTEMPTS) {
    delivery.status = "failed";
    delivery.lastError ??= "delivery_unconfirmed";
    delivery.claim = undefined;
    delivery.until = undefined;
    await save(state, sha);
    return {
      status: "failed",
      issue: ping.issue,
      code: delivery.lastError ?? "delivery_unconfirmed",
    };
  }
  // A replay after a claimed POST must reconcile, even if its reply was lost.
  const uncertain = delivery.ambiguous || delivery.status === "sending";
  const claim = randomUUID();
  delivery.status = "sending";
  delivery.claim = claim;
  delivery.until = now + 30000;
  delivery.nextAt = undefined;
  delivery.attempts++;
  try {
    await save(state, sha);
  } catch {
    return { status: "waiting", waitMs: 1000 };
  }
  let confirmation: Awaited<ReturnType<typeof postSlackAlert>> | undefined;
  let error: SlackDeliveryError | undefined;
  try {
    confirmation = await (uncertain
      ? (deps.reconcileSlack ?? reconcileSlackAlert)
      : (deps.postSlack ?? postSlackAlert))(ping);
  } catch (e) {
    error =
      e instanceof SlackDeliveryError
        ? e
        : new SlackDeliveryError("delivery_unconfirmed", "ambiguous");
  }
  // Re-read before committing: a newer notification or owner action must win.
  const current = await read();
  const latest = current.state.ownerPing;
  if (
    !latest ||
    latest.id !== ping.id ||
    (latest.id ?? latest.key) !== key ||
    latest.slack?.claim !== claim
  )
    return { status: "done" };
  if (confirmation !== undefined) {
    latest.channel = confirmation.channel;
    latest.ts = confirmation.ts;
    latest.slack = {
      ...latest.slack,
      status: "delivered",
      confirmedAt: deps.now ?? Date.now(),
      until: undefined,
      claim: undefined,
      lastError: undefined,
      ambiguous: false,
    };
  } else {
    const failure = error ?? new SlackDeliveryError("delivery_unconfirmed", "ambiguous");
    const retry = failure.kind !== "permanent" && latest.slack.attempts < MAX_SLACK_ATTEMPTS;
    const delay = Math.max(failure.delayMs, latest.slack.attempts === 1 ? 5000 : 20000);
    latest.slack = {
      ...latest.slack,
      status: retry ? "pending" : "failed",
      lastError: failure.code,
      ambiguous: Boolean(uncertain || failure.kind === "ambiguous"),
      until: undefined,
      claim: undefined,
      nextAt: retry ? now + delay : undefined,
    };
  }
  await save(current.state, current.sha);
  if (latest.slack.status === "delivered") return { status: "done" };
  if (latest.slack.status === "failed")
    return {
      status: "failed",
      issue: latest.issue,
      code: latest.slack.lastError ?? "delivery_unconfirmed",
    };
  return {
    status: "waiting",
    waitMs: Math.max(1, (latest.slack.nextAt ?? now) - (deps.now ?? Date.now())),
  };
}
