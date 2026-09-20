import { createHmac, timingSafeEqual } from "node:crypto";
import { repository } from "./config.js";
import type { Receipt } from "./receipt.js";
import { type OwnerPing, readState, type State, saveState } from "./store.js";

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
  options: { repo?: string; buttons?: boolean } = {},
) {
  const url = issueUrl(receipt.issue, repoName(options.repo));
  const error = (receipt.error ?? "Eve is holding.").slice(0, 400);
  const route = receipt.recommendation ? `Jev: ${receipt.recommendation}` : "Eve needs you";
  const text = `Factory #${receipt.issue} needs you. ${route}. ${error} ${url}`;
  const blocks: unknown[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Factory #${receipt.issue} needs you*\n${route}\n${error}\n<${url}|Open issue>`,
      },
    },
  ];
  if (options.buttons) {
    blocks.push({
      type: "actions",
      block_id: "factory_owner",
      elements: [
        {
          type: "button",
          action_id: "factory_hold",
          text: { type: "plain_text", text: "Hold" },
          value: String(receipt.issue),
        },
        {
          type: "button",
          action_id: "factory_retry",
          text: { type: "plain_text", text: "Retry" },
          style: "primary",
          value: String(receipt.issue),
        },
        {
          type: "button",
          action_id: "factory_reject",
          text: { type: "plain_text", text: "Reject" },
          style: "danger",
          value: String(receipt.issue),
        },
      ],
    });
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

export type SlackPost = (body: {
  text: string;
  blocks?: unknown[];
  channel?: string;
}) => Promise<{ channel?: string; ts?: string } | void>;

const livePost: SlackPost = async (body) => {
  const token = slackBotToken();
  const channel = slackOwnerChannel();
  if (token && channel) {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel, ...body }),
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    const json = (await response.json()) as { ok?: boolean; channel?: string; ts?: string };
    if (!json.ok) return;
    return { channel: json.channel, ts: json.ts };
  }
  const webhook = slackWebhook();
  if (!webhook) return;
  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: body.text }),
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
};

export async function notifyOwner(
  receipt: Receipt,
  deps: {
    readState?: typeof readState;
    saveState?: typeof saveState;
    postSlack?: SlackPost;
    repo?: string;
  } = {},
): Promise<boolean> {
  if (receipt.attention !== "owner") return false;
  const canMention = Boolean(ownerLogin());
  const canSlack = Boolean((slackBotToken() && slackOwnerChannel()) || slackWebhook());
  if (!canMention && !canSlack && !deps.postSlack) return false;
  const key = ownerPingKey(receipt);
  const read = deps.readState ?? readState;
  const save = deps.saveState ?? saveState;
  let state: State | undefined;
  let sha: string | undefined;
  try {
    const snapshot = await read();
    state = snapshot.state;
    sha = snapshot.sha;
    if (state.ownerPing?.key === key) return false;
  } catch {
    /* A missed dedupe can double-ping. A missed first ping cannot. */
  }
  if (canSlack || deps.postSlack) {
    try {
      const posted = await (deps.postSlack ?? livePost)(
        formatSlackAlert(receipt, {
          repo: deps.repo,
          buttons: Boolean(slackBotToken() && slackOwnerChannel()) || Boolean(deps.postSlack),
        }),
      );
      if (state) {
        const ping: OwnerPing = {
          key,
          issue: receipt.issue,
          channel: posted?.channel,
          ts: posted?.ts,
        };
        state.ownerPing = ping;
        if (sha !== undefined) await save(state, sha);
      }
    } catch {
      // Slack is a pager. A post failure must not roll back a checkpoint.
    }
  } else if (state) {
    state.ownerPing = { key, issue: receipt.issue };
    try {
      if (sha !== undefined) await save(state, sha);
    } catch {
      /* GitHub mention still fires. */
    }
  }
  return true;
}
