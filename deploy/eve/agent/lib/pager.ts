import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { repository } from "./config.js";
import { type OwnerAlert, ownerAlert, safeAlertText } from "./owner-alert.js";
import type { Receipt } from "./receipt.js";
import { type OwnerPing, readState, saveState } from "./store.js";

export function ownerLogin(value = process.env.FACTORY_OWNER) {
  return value && /^[A-Za-z0-9-]{1,39}$/.test(value) ? value : undefined;
}

export function ownerPingKey(receipt: Pick<Receipt, "issue" | "error">) {
  return `${receipt.issue}:${receipt.error ?? ""}`;
}

export function mentionLine(login = ownerLogin()) {
  const owner = ownerLogin(login);
  return owner ? `\ncc @${owner}` : "";
}

export function slackWebhook(value = process.env.SLACK_OWNER_WEBHOOK) {
  if (!value) return;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "hooks.slack.com" ||
      !url.pathname.startsWith("/services/")
    )
      return;
    return value;
  } catch {
    return;
  }
}

export function slackBotToken(value = process.env.SLACK_BOT_TOKEN) {
  return value?.startsWith("xoxb-") ? value : undefined;
}

export function slackOwnerChannel(value = process.env.SLACK_OWNER_CHANNEL) {
  return value && /^[CGDU][A-Z0-9]{8,}$/i.test(value) ? value : undefined;
}

export function slackOwnerUserId(value = process.env.SLACK_OWNER_USER_ID) {
  return value && /^U[A-Z0-9]{8,}$/i.test(value) ? value : undefined;
}

export function slackSigningSecret(value = process.env.SLACK_SIGNING_SECRET) {
  return value && value.length >= 8 ? value : undefined;
}

export function issueUrl(issue: number, repo = repository()) {
  return `https://github.com/${repo}/issues/${issue}`;
}

function repoName(override?: string) {
  if (override) return override;
  try {
    return repository();
  } catch {
    return "owner/product";
  }
}

export function formatSlackAlert(
  receipt: Receipt,
  options: { repo?: string; buttons?: boolean; alert?: OwnerAlert; id?: string } = {},
) {
  const url = issueUrl(receipt.issue, repoName(options.repo));
  const alert = options.alert ?? ownerAlert(receipt, { version: 1 });
  const slackEscape = (s: string) =>
    safeAlertText(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const mention = slackOwnerUserId();
  const text = `${mention ? `<@${mention}> ` : ""}Eve needs your attention: #${receipt.issue} — ${slackEscape(alert.task)}. ${slackEscape(alert.failure)}\nWhat Eve tried: ${slackEscape(alert.tried.join(" "))}\nWhat I need from you: ${slackEscape(alert.needed)}\n${url}`;
  const details = `Task: ${alert.task}
${alert.status}

What failed: ${alert.failure}

What Eve tried:
${alert.tried.join("\n")}

What I need from you: ${alert.needed}

As of ${new Date(alert.at).toISOString()}`;
  const blocks: unknown[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${mention ? `<@${mention}> ` : ""}*Eve needs your attention — #${receipt.issue}*`,
      },
    },
    { type: "section", text: { type: "plain_text", text: safeAlertText(details, 2900) } },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<${url}|Open issue and evidence>${alert.pr?.startsWith(`https://github.com/${repoName(options.repo)}/pull/`) ? ` · <${alert.pr}|Open PR>` : ""}`,
      },
    },
  ];
  if (options.buttons && options.id) {
    const value = JSON.stringify({ issue: receipt.issue, id: options.id });
    const button = (command: string, label: string) => ({
      type: "button",
      action_id: `factory_${command}`,
      text: { type: "plain_text", text: label },
      value,
    });
    const elements: unknown[] = [button("hold", "Hold")];
    if (alert.retryAllowed) elements.push(button("retry", "Retry"));
    if (alert.rejectAllowed) elements.push({ ...button("reject", "Reject"), style: "danger" });
    blocks.push({ type: "actions", block_id: "factory_owner", elements });
  }
  return { text, blocks };
}

export function verifySlackRequest(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  secret = slackSigningSecret(),
  now = Date.now(),
) {
  if (!secret || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 300) return false;
  const expected = `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`;
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Queue delivery before returning the first GitHub owner mention. No Slack I/O in engine steps. */
export async function notifyOwner(
  receipt: Receipt,
  deps: {
    readState?: typeof readState;
    saveState?: typeof saveState;
    slackConfigured?: boolean;
  } = {},
): Promise<boolean> {
  if (receipt.attention !== "owner") return false;
  const configured =
    deps.slackConfigured ?? Boolean((slackBotToken() && slackOwnerChannel()) || slackWebhook());
  if (!ownerLogin() && !configured) return false;
  const read = deps.readState ?? readState,
    save = deps.saveState ?? saveState;
  const key = ownerPingKey(receipt);
  for (let retry = 0; retry < 2; retry++) {
    const { state, sha } = await read();
    const prior = state.ownerPing?.key === key ? state.ownerPing : undefined;
    const resumedFailure =
      prior?.command === "retry" &&
      state.batch?.issue === receipt.issue &&
      state.batch.workflowOwner !== prior.workflowOwner &&
      ["blocked", "paused"].includes(state.batch.status);
    const existing = resumedFailure ? undefined : prior;
    if (existing?.slack && (existing.slack.status !== "unconfigured" || !configured)) return false;
    const destination = slackOwnerChannel() ?? (slackWebhook() ? "webhook" : undefined);
    const ping: OwnerPing = {
      ...existing,
      key,
      issue: receipt.issue,
      id: existing?.id ?? randomUUID(),
      workflowOwner: state.batch?.issue === receipt.issue ? state.batch.workflowOwner : undefined,
      alert: ownerAlert(receipt, state),
      slack: { status: configured ? "pending" : "unconfigured", attempts: 0, destination },
    };
    state.ownerPing = ping;
    try {
      await save(state, sha);
      return !existing;
    } catch (error) {
      if (retry === 1) throw error;
    }
  }
  return false;
}
