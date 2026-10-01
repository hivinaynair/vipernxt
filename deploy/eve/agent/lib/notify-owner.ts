import { sleep } from "workflow";
import { github } from "./github.js";
import { deliverOwnerAlert } from "./owner-delivery.js";
import { readState } from "./store.js";

/** Slack has separate invocation and retry budgets; it never decides factory acceptance. */
export async function flushOwnerNotification(issue?: number) {
  "use workflow";
  const key = await pendingKey(issue);
  if (!key) return;
  for (let i = 0; i < 8; i++) {
    const result = await deliver(key);
    if (result.status === "failed") {
      await reportFailure(key, result.issue, result.code ?? "delivery_unconfirmed");
      return;
    }
    if (result.status === "done") return;
    await sleep(result.waitMs ?? 1000);
  }
}
async function pendingKey(issue?: number) {
  "use step";
  const { state } = await readState();
  const ping = state.ownerPing;
  return ping &&
    (issue === undefined || ping.issue === issue) &&
    ping.slack &&
    ["pending", "sending", "failed"].includes(ping.slack.status)
    ? (ping.id ?? ping.key)
    : undefined;
}
async function deliver(key: string) {
  "use step";
  return deliverOwnerAlert(key);
}
async function reportFailure(key: string, issue: number, code: string) {
  "use step";
  const { state } = await readState();
  if ((state.ownerPing?.id ?? state.ownerPing?.key) !== key) return;
  // GitHub already has the hold and mention. Delivery failure stays visible there.
  try {
    await github(`/issues/${issue}/comments`, "POST", {
      body: `**Slack notification not confirmed.** ${code}. Eve remains held; use this issue for the failure evidence and owner decision.`,
    });
  } catch {
    /* Notification failure must not change factory state. */
  }
}
