import {
  formatSlackAlert,
  slackBotToken,
  slackOwnerChannel,
  slackOwnerUserId,
  slackSigningSecret,
  slackWebhook,
} from "./pager.js";
import type { OwnerPing } from "./store.js";

export class SlackDeliveryError extends Error {
  constructor(
    public code: string,
    public kind: "retryable" | "permanent" | "ambiguous",
    public delayMs = 5000,
  ) {
    super(code);
  }
}
export type SlackConfirmation = { channel?: string; ts?: string };
function validConfirmation(value: unknown, channel: string): SlackConfirmation | undefined {
  const x = value as { channel?: string; ts?: string };
  return x?.channel === channel && /^\d+\.\d+$/.test(x.ts ?? "")
    ? { channel, ts: x.ts }
    : undefined;
}
async function slackRequest(url: string, init: RequestInit, request = fetch): Promise<Response> {
  try {
    return await request(url, { ...init, signal: AbortSignal.timeout(8000), redirect: "error" });
  } catch {
    throw new SlackDeliveryError("delivery_unconfirmed", "ambiguous");
  }
}
function responseFailure(response: Response) {
  if (response.status === 429) {
    const seconds = Number(response.headers.get("retry-after") ?? "5");
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 300)
      throw new SlackDeliveryError("rate_limit_wait_exceeds_window", "permanent");
    throw new SlackDeliveryError("ratelimited", "retryable", Math.max(1000, seconds * 1000));
  }
  if (!response.ok)
    throw new SlackDeliveryError(
      `http_${response.status}`,
      response.status >= 500 ? "ambiguous" : "permanent",
    );
}
export async function postSlackAlert(
  ping: OwnerPing,
  repo?: string,
  request = fetch,
): Promise<SlackConfirmation> {
  if (!ping.alert || !ping.id) throw new SlackDeliveryError("missing_alert", "permanent");
  const token = slackBotToken(),
    channel = slackOwnerChannel();
  const message = formatSlackAlert(
    { issue: ping.issue, event: "owner-alert", error: ping.alert.failure },
    {
      repo,
      id: ping.id,
      alert: ping.alert,
      buttons: Boolean(token && channel && slackOwnerUserId() && slackSigningSecret()),
    },
  );
  if (token && channel) {
    if (ping.slack?.destination && ping.slack.destination !== channel)
      throw new SlackDeliveryError("destination_changed", "permanent");
    const response = await slackRequest(
      "https://slack.com/api/chat.postMessage",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          ...message,
          channel,
          client_msg_id: ping.id,
          metadata: { event_type: "eve_owner_alert", event_payload: { id: ping.id } },
        }),
      },
      request,
    );
    responseFailure(response);
    let body: { ok?: boolean; error?: string; channel?: string; ts?: string };
    try {
      body = await response.json();
    } catch {
      throw new SlackDeliveryError("invalid_reply", "ambiguous");
    }
    if (!body.ok)
      throw new SlackDeliveryError(
        /^[a-z_]{1,80}$/.test(body.error ?? "")
          ? (body.error ?? "provider_error")
          : "provider_error",
        body.error === "ratelimited" ? "retryable" : "permanent",
      );
    const confirmed = validConfirmation(body, channel);
    if (!confirmed) throw new SlackDeliveryError("invalid_confirmation", "ambiguous");
    return confirmed;
  }
  const webhook = slackWebhook();
  if (!webhook) throw new SlackDeliveryError("slack_unconfigured", "permanent");
  if (ping.slack?.destination !== "webhook")
    throw new SlackDeliveryError("destination_changed", "permanent");
  const response = await slackRequest(
    webhook,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message.text }),
    },
    request,
  );
  responseFailure(response);
  if ((await response.text()).trim() !== "ok")
    throw new SlackDeliveryError("invalid_webhook_confirmation", "ambiguous");
  return {};
}

/** An uncertain POST is never replayed. Read-only history can confirm its stable message identity. */
export async function reconcileSlackAlert(
  ping: OwnerPing,
  request = fetch,
): Promise<SlackConfirmation> {
  const token = slackBotToken(),
    channel = slackOwnerChannel();
  if (!token || !channel || !ping.id || !ping.alert || ping.slack?.destination !== channel)
    throw new SlackDeliveryError("delivery_unconfirmed", "ambiguous");
  const params = new URLSearchParams({
    channel,
    oldest: String((ping.alert.at - 5000) / 1000),
    limit: "100",
    include_all_metadata: "true",
  });
  for (let page = 0; page < 2; page++) {
    const response = await slackRequest(
      `https://slack.com/api/conversations.history?${params}`,
      { headers: { Authorization: `Bearer ${token}` } },
      request,
    );
    if (response.status === 429) responseFailure(response);
    if (!response.ok) throw new SlackDeliveryError("confirmation_read_failed", "ambiguous");
    let body: {
      ok?: boolean;
      messages?: {
        ts?: string;
        bot_id?: string;
        client_msg_id?: string;
        metadata?: { event_type?: string; event_payload?: { id?: string } };
      }[];
      response_metadata?: { next_cursor?: string };
    };
    try {
      body = await response.json();
    } catch {
      throw new SlackDeliveryError("confirmation_read_failed", "ambiguous");
    }
    if (!body.ok) throw new SlackDeliveryError("confirmation_read_failed", "ambiguous");
    const match = body.messages?.find(
      (m) =>
        m.bot_id &&
        (m.client_msg_id === ping.id ||
          (m.metadata?.event_type === "eve_owner_alert" &&
            m.metadata.event_payload?.id === ping.id)),
    );
    if (match) {
      const confirmed = validConfirmation({ channel, ts: match.ts }, channel);
      if (confirmed) return confirmed;
    }
    const cursor = body.response_metadata?.next_cursor;
    if (!cursor) break;
    params.set("cursor", cursor);
  }
  throw new SlackDeliveryError("delivery_unconfirmed", "ambiguous");
}
